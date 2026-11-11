/**
 * @falcon/config
 * Gerenciamento de variáveis de ambiente e Logger Estruturado com Redação de Segredos (Seção 22 e 24 do PDF).
 */

export type EnvironmentMode = 'development' | 'test' | 'staging' | 'production';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface FalconEnvConfig {
  nodeEnv: EnvironmentMode;
  logLevel: LogLevel;
  coreDbHost: string;
  coreDbPort: number;
  coreDbName: string;
  coreDbUser: string;
  coreDbPassword: string;
  masterKmsKeyHex: string;
  jwtSecret: string;
  redisUrl: string;
  s3Endpoint: string;
  s3Region: string;
  s3BucketName: string;
  apiHost: string;
  apiPort: number;
  webUrl: string;
  dataDir: string;
  pixelAgentsServerUrl?: string;
}

const DEFAULT_DEV_KMS_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const DEFAULT_DEV_JWT_SECRET =
  'falcon_jwt_super_secret_development_key_min_32_chars';

export function loadEnvConfig(
  env: Record<string, string | undefined> = process.env,
): FalconEnvConfig {
  const nodeEnv = (env.NODE_ENV as EnvironmentMode) || 'development';
  const isVercel = Boolean(env.VERCEL);
  const masterKmsKeyHex =
    env.FALCON_MASTER_KMS_KEY_HEX ||
    env.FALCON_MASTER_KMS_KEY ||
    DEFAULT_DEV_KMS_KEY;
  const jwtSecret = env.FALCON_JWT_SECRET || DEFAULT_DEV_JWT_SECRET;

  if (nodeEnv === 'production' && !isVercel) {
    if (
      !env.FALCON_MASTER_KMS_KEY_HEX ||
      env.FALCON_MASTER_KMS_KEY_HEX === DEFAULT_DEV_KMS_KEY
    ) {
      throw new Error(
        'FALCON_MASTER_KMS_KEY_HEX deve ser configurada com uma chave exclusiva de 64 caracteres hexadecimais em produção.',
      );
    }
    if (!env.FALCON_JWT_SECRET || env.FALCON_JWT_SECRET.length < 32) {
      throw new Error(
        'FALCON_JWT_SECRET exclusiva com no mínimo 32 caracteres é obrigatória em produção.',
      );
    }
  }

  if (!/^[0-9a-fA-F]{64}$/.test(masterKmsKeyHex)) {
    throw new Error(
      'FALCON_MASTER_KMS_KEY_HEX inválida: deve conter exatamente 64 caracteres hexadecimais (32 bytes).',
    );
  }

  return {
    nodeEnv,
    logLevel: (env.LOG_LEVEL as LogLevel) || 'info',
    coreDbHost: env.FALCON_CORE_DB_HOST || '127.0.0.1',
    coreDbPort: Number(env.FALCON_CORE_DB_PORT || 5432),
    coreDbName: env.FALCON_CORE_DB_NAME || 'falcon_core',
    coreDbUser: env.FALCON_CORE_DB_USER || 'falcon_admin',
    coreDbPassword: env.FALCON_CORE_DB_PASSWORD || 'falcon_core_local_dev_password',
    masterKmsKeyHex,
    jwtSecret,
    redisUrl: env.REDIS_URL || 'redis://127.0.0.1:6379',
    s3Endpoint: env.S3_ENDPOINT || 'http://127.0.0.1:9000',
    s3Region: env.S3_REGION || 'us-east-1',
    s3BucketName: env.S3_BUCKET_NAME || 'falcon-growth-storage',
    apiHost: env.API_HOST || '127.0.0.1',
    apiPort: Number(env.PORT || env.API_PORT || 4000),
    webUrl: env.WEB_URL || 'http://localhost:3000',
    dataDir:
      env.FALCON_DATA_DIR ||
      (isVercel ? '/tmp/falcon-growth-data' : './.falcon-data'),
    pixelAgentsServerUrl: env.PIXEL_AGENTS_SERVER_URL,
  };
}

export const loadFalconEnvConfig = loadEnvConfig;

/**
 * Padrões de chaves sensíveis que NUNCA podem aparecer em logs estruturados (Seção 24 do PDF).
 */
const SENSITIVE_KEY_PATTERN =
  /password|secret|token|authorization|api_?key|kms_?key|private_?key|credential|cookie|encrypted_/i;

export function redactSensitiveData<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    // Redige Bearer tokens ou URLs com senha embutida
    return input
      .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
      .replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1[REDACTED]$3') as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSensitiveData(value);
      }
    }
    return out as T;
  }
  return input;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  organizationId?: string;
  context?: Record<string, unknown>;
}

export class StructuredLogger {
  private readonly service: string;
  private readonly sink?: (entry: LogEntry) => void;

  constructor(service: string, sink?: (entry: LogEntry) => void) {
    this.service = service;
    this.sink = sink;
  }

  private emit(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): LogEntry {
    const sanitizedContext = context ? redactSensitiveData(context) : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message: redactSensitiveData(message),
      ...(sanitizedContext?.organizationId
        ? { organizationId: String(sanitizedContext.organizationId) }
        : {}),
      ...(sanitizedContext ? { context: sanitizedContext } : {}),
    };
    if (this.sink) {
      this.sink(entry);
    }
    return entry;
  }

  debug(message: string, context?: Record<string, unknown>): LogEntry {
    return this.emit('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): LogEntry {
    return this.emit('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): LogEntry {
    return this.emit('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): LogEntry {
    return this.emit('error', message, context);
  }
}
