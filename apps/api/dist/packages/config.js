/**
 * @falcon/config
 * Gerenciamento de variáveis de ambiente e Logger Estruturado com Redação de Segredos (Seção 22 e 24 do PDF).
 */

                                                                                
                                                           

                                  
                           
                     
                     
                     
                     
                     
                         
                          
                    
                   
                     
                   
                       
                  
                  
                 
                  
                                
 

const DEFAULT_DEV_KMS_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const DEFAULT_DEV_JWT_SECRET =
  'falcon_jwt_super_secret_development_key_min_32_chars';

export function loadEnvConfig(
  env                                     = process.env,
)                  {
  const nodeEnv = (env.NODE_ENV                   ) || 'development';
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
    logLevel: (env.LOG_LEVEL            ) || 'info',
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

export function redactSensitiveData   (input   )    {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    // Redige Bearer tokens ou URLs com senha embutida
    return input
      .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
      .replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1[REDACTED]$3')                ;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item))                ;
  }
  if (typeof input === 'object') {
    const out                          = {};
    for (const [key, value] of Object.entries(input                           )) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSensitiveData(value);
      }
    }
    return out     ;
  }
  return input;
}

                           
                    
                  
                  
                  
                          
                                    
 

export class StructuredLogger {
                   service        ;
                   sink                            ;

  constructor(service        , sink                            ) {
    this.service = service;
    this.sink = sink;
  }

          emit(
    level          ,
    message        ,
    context                          ,
  )           {
    const sanitizedContext = context ? redactSensitiveData(context) : undefined;
    const entry           = {
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

  debug(message        , context                          )           {
    return this.emit('debug', message, context);
  }

  info(message        , context                          )           {
    return this.emit('info', message, context);
  }

  warn(message        , context                          )           {
    return this.emit('warn', message, context);
  }

  error(message        , context                          )           {
    return this.emit('error', message, context);
  }
}
