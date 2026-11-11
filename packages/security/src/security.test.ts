import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeIdempotencyKey,
  computeSha256Checksum,
  hashPassword,
  SecretVault,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './index.ts';

const KEY_V1 =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const KEY_V2 =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('@falcon/security', () => {
  it('encrypts and decrypts tenant DB credentials with AES-256-GCM and tenant AAD binding', () => {
    const vault = new SecretVault(KEY_V1, 'kms-v1');
    const encrypted = vault.encrypt('pg_pass_tenant_alpha_99!', 'org-alpha');

    assert.ok(!encrypted.includes('pg_pass_tenant_alpha_99!'));
    assert.equal(
      vault.decrypt(encrypted, 'org-alpha'),
      'pg_pass_tenant_alpha_99!',
    );

    // Tentativa de descriptografar o segredo do Tenant Alpha usando o contexto do Tenant Beta deve falhar!
    assert.throws(
      () => vault.decrypt(encrypted, 'org-beta'),
      /Falha na verificação criptográfica/,
    );
  });

  it('supports key rotation seamlessly between KMS key versions', () => {
    const oldVault = new SecretVault(KEY_V1, 'kms-v1');
    const cipherV1 = oldVault.encrypt('meta_oauth_token_xyz', 'org-1');

    const newVault = new SecretVault(KEY_V2, 'kms-v2', { 'kms-v1': KEY_V1 });
    assert.equal(newVault.decrypt(cipherV1, 'org-1'), 'meta_oauth_token_xyz');

    const rotated = newVault.rotateSecret(cipherV1, 'org-1');
    assert.ok(rotated.includes('"keyId":"kms-v2"'));
    assert.equal(newVault.decrypt(rotated, 'org-1'), 'meta_oauth_token_xyz');
  });

  it('hashes and verifies passwords with scrypt and timing-safe comparison', () => {
    const hash = hashPassword('Falcon#2026!Secure');
    assert.equal(verifyPassword('Falcon#2026!Secure', hash), true);
    assert.equal(verifyPassword('WrongPassword123', hash), false);
  });

  it('signs and verifies tenant-bound session tokens and rejects tampering', () => {
    const secret = 'test_jwt_secret_key_for_falcon_growth_32b';
    const token = signSessionToken(
      {
        sub: 'user-01',
        orgId: 'org-tenant-01',
        role: 'OWNER',
        email: 'ceo@empresa.com.br',
      },
      secret,
      3600,
    );

    const verified = verifySessionToken(token, secret);
    assert.equal(verified.sub, 'user-01');
    assert.equal(verified.orgId, 'org-tenant-01');
    assert.equal(verified.role, 'OWNER');

    // Adulterar payload (ex: tentar trocar orgId no token) deve falhar na verificação HMAC
    const [h, , s] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...verified, orgId: 'org-tenant-02' }),
    ).toString('base64url');
    assert.throws(
      () => verifySessionToken(`${h}.${forgedPayload}.${s}`, secret),
      /Assinatura do token de sessão inválida/,
    );
  });

  it('generates deterministic idempotency keys and SHA-256 checksums', () => {
    const k1 = computeIdempotencyKey('org-1', 'social.publish', {
      postId: 'p-10',
      versionId: 'v-2',
    });
    const k2 = computeIdempotencyKey('org-1', 'social.publish', {
      versionId: 'v-2',
      postId: 'p-10',
    });
    const kDifferentTenant = computeIdempotencyKey('org-2', 'social.publish', {
      postId: 'p-10',
      versionId: 'v-2',
    });

    assert.equal(k1, k2);
    assert.notEqual(k1, kDifferentTenant);
    assert.equal(computeSha256Checksum('art-v1-content').length, 64);
  });
});
