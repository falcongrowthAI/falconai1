/**
 * @falcon/security
 * Cofre de Segredos (AES-256-GCM com AAD por Tenant), Hashing de Senhas (scrypt),
 * Assinatura de Tokens JWT/HMAC e Chaves de Idempotência / Checksum SHA-256.
 * Atende às Seções 6.3, 11.3, 21, 22 e 23 do Documento Mestre.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

export interface EncryptedSecretEnvelope {
  /** Identificador da versão da chave mestra no cofre (suporta rotação de chaves) */
  keyId: string;
  /** Algoritmo utilizado */
  alg: 'aes-256-gcm';
  /** Vetor de inicialização (96-bit base64url) */
  iv: string;
  /** Tag de autenticação GCM (128-bit base64url) */
  tag: string;
  /** Texto cifrado (base64url) */
  ciphertext: string;
}

/**
 * Cofre criptográfico (SecretVault) para proteger credenciais de bancos de dados
 * individuais de cada tenant e tokens OAuth do FALCON CONNECT.
 * Inclui suporte a Additional Authenticated Data (AAD) vinculado ao organizationId,
 * impedindo que um segredo cifrado de um tenant seja transplantado para outro registro!
 */
export class SecretVault {
  private readonly keys = new Map<string, Buffer>();
  private readonly activeKeyId: string;

  constructor(
    masterKeyHex: string,
    activeKeyId = 'kms-v1',
    previousKeys: Record<string, string> = {},
  ) {
    if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
      throw new Error(
        'Master KMS key deve conter exatamente 64 caracteres hexadecimais (32 bytes).',
      );
    }
    this.activeKeyId = activeKeyId;
    this.keys.set(activeKeyId, Buffer.from(masterKeyHex, 'hex'));

    for (const [kid, hex] of Object.entries(previousKeys)) {
      if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error(`Chave anterior ${kid} inválida.`);
      }
      this.keys.set(kid, Buffer.from(hex, 'hex'));
    }
  }

  /**
   * Criptografa um segredo em texto puro vinculando opcionalmente ao contexto (AAD, ex: organizationId).
   */
  encrypt(plaintext: string, aadContext?: string): string {
    const key = this.keys.get(this.activeKeyId)!;
    const iv = randomBytes(12); // 96 bits recomendados pelo NIST para AES-GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv, {
      authTagLength: 16,
    });

    if (aadContext) {
      cipher.setAAD(Buffer.from(aadContext, 'utf8'));
    }

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const envelope: EncryptedSecretEnvelope = {
      keyId: this.activeKeyId,
      alg: 'aes-256-gcm',
      iv: iv.toString('base64url'),
      tag: tag.toString('base64url'),
      ciphertext: encrypted.toString('base64url'),
    };

    return JSON.stringify(envelope);
  }

  /**
   * Descriptografa um envelope JSON validando autenticidade e AAD.
   */
  decrypt(serializedEnvelope: string, aadContext?: string): string {
    let envelope: EncryptedSecretEnvelope;
    try {
      envelope = JSON.parse(serializedEnvelope) as EncryptedSecretEnvelope;
    } catch {
      throw new Error('Envelope de segredo corrompido ou formato inválido.');
    }

    if (
      !envelope ||
      envelope.alg !== 'aes-256-gcm' ||
      !envelope.keyId ||
      !envelope.iv ||
      !envelope.tag ||
      typeof envelope.ciphertext !== 'string'
    ) {
      throw new Error('Envelope de segredo inválido.');
    }

    const key = this.keys.get(envelope.keyId);
    if (!key) {
      throw new Error(`Chave KMS não encontrada para keyId: ${envelope.keyId}`);
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(envelope.iv, 'base64url'),
      { authTagLength: 16 },
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));

    if (aadContext) {
      decipher.setAAD(Buffer.from(aadContext, 'utf8'));
    }

    try {
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      throw new Error(
        'Falha na verificação criptográfica do segredo (chave incorreta, texto adulterado ou contexto de tenant inválido).',
      );
    }
  }

  /**
   * Re-criptografa um segredo com a chave ativa atual (para rotação segura de credenciais).
   */
  rotateSecret(serializedEnvelope: string, aadContext?: string): string {
    const plaintext = this.decrypt(serializedEnvelope, aadContext);
    return this.encrypt(plaintext, aadContext);
  }
}

/**
 * Hashing seguro de senhas com scrypt + salt aleatório de 16 bytes.
 */
export function hashPassword(password: string): string {
  if (!password || password.length < 8) {
    throw new Error('A senha deve possuir no mínimo 8 caracteres.');
  }
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const derived = scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return timingSafeEqual(derived, expectedBuf);
}

/**
 * Tokens de sessão assinados (formato JWT HS256 compacto sem dependências externas)
 * vinculando estritamente o usuário à organização/tenant autenticada.
 */
export interface SessionTokenPayload {
  sub: string; // userId
  orgId: string; // organizationId (Tenant)
  role: string; // Papel do usuário na organização
  email: string;
  isInternalAdmin?: boolean;
  iat: number;
  exp: number;
}

export function signSessionToken(
  payload: Omit<SessionTokenPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds = 60 * 60 * 8, // 8 horas padrão
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const headerB64 = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString(
    'base64url',
  );
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
): SessionTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de token de sessão inválido.');
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac('sha256', secret).update(signingInput).digest();
  const actualSig = Buffer.from(signatureB64, 'base64url');

  if (
    expectedSig.length !== actualSig.length ||
    !timingSafeEqual(expectedSig, actualSig)
  ) {
    throw new Error('Assinatura do token de sessão inválida.');
  }

  const payload = JSON.parse(
    Buffer.from(payloadB64, 'base64url').toString('utf8'),
  ) as SessionTokenPayload;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new Error('Token de sessão expirado.');
  }
  if (!payload.sub || !payload.orgId || !payload.role) {
    throw new Error('Token de sessão incompleto: sub, orgId e role são obrigatórios.');
  }
  return payload;
}

/**
 * Gera chave determinística de idempotência (Seção 11.3 do Documento Mestre)
 * para impedir duplicidade de publicação, cobrança ou provisionamento.
 */
export function computeIdempotencyKey(
  organizationId: string,
  operationNamespace: string,
  parameters: Record<string, unknown>,
): string {
  const canonical = JSON.stringify(
    parameters,
    Object.keys(parameters).sort(),
  );
  return createHash('sha256')
    .update(`${organizationId}:${operationNamespace}:${canonical}`)
    .digest('hex');
}

/**
 * Calcula checksum SHA-256 para versionamento de arquivos/entregáveis e vínculo exato de aprovação (Seção 12.3 e 23).
 */
export function computeSha256Checksum(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}
