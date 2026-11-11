import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  loadEnvConfig,
  redactSensitiveData,
  StructuredLogger,
} from './index.ts';

describe('@falcon/config', () => {
  it('loads default development configuration safely', () => {
    const cfg = loadEnvConfig({ NODE_ENV: 'development' });
    assert.equal(cfg.nodeEnv, 'development');
    assert.equal(cfg.coreDbName, 'falcon_core');
    assert.equal(cfg.masterKmsKeyHex.length, 64);
  });

  it('rejects default KMS key in production mode', () => {
    assert.throws(
      () => loadEnvConfig({ NODE_ENV: 'production' }),
      /FALCON_MASTER_KMS_KEY_HEX/,
    );
  });

  it('redacts passwords, tokens, API keys, and connection URLs from logs', () => {
    const entries: unknown[] = [];
    const logger = new StructuredLogger('test-service', (entry) =>
      entries.push(entry),
    );

    const logged = logger.info(
      'Connecting to postgresql://tenant_u:mySuperSecretPass123@localhost:5432/tenant_1 with Bearer eyJhbGciOiJIUzI1NiJ9',
      {
        organizationId: 'org-123',
        dbPassword: 'secret-db-password',
        oauthAccessToken: 'gho_123456789',
        nested: {
          anthropicApiKey: 'sk-ant-12345',
          safeField: 'visible-value',
        },
      },
    );

    assert.equal(logged.organizationId, 'org-123');
    assert.ok(!logged.message.includes('mySuperSecretPass123'));
    assert.ok(!logged.message.includes('eyJhbGciOiJIUzI1NiJ9'));
    assert.equal(logged.context?.dbPassword, '[REDACTED]');
    assert.equal(logged.context?.oauthAccessToken, '[REDACTED]');
    assert.equal(
      (logged.context?.nested as Record<string, unknown>)?.anthropicApiKey,
      '[REDACTED]',
    );
    assert.equal(
      (logged.context?.nested as Record<string, unknown>)?.safeField,
      'visible-value',
    );
  });
});
