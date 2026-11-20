import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  PORT: '4000',
  DATABASE_URL: 'postgresql://mango:mangosecret@localhost:15432/mangovpn_v2_test?schema=public',
  JWT_SECRET: 'a'.repeat(32),
  REFRESH_SECRET: 'b'.repeat(32),
  TOTP_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  DAEMON_SHARED_SECRET: 'c'.repeat(32),
});

describe('loadConfig (fail-fast environment validation)', () => {
  it('returns validated config when all required environment variables are present and strong', () => {
    const config = loadConfig(validEnv());

    expect(config.port).toBe(4000);
    expect(config.databaseUrl).toContain('postgresql://');
    expect(config.jwtSecret).toHaveLength(32);
    expect(config.refreshSecret).toHaveLength(32);
    expect(config.totpEncryptionKey).toHaveLength(64);
    expect(config.daemonSharedSecret).toHaveLength(32);
  });

  it.each([
    'DATABASE_URL',
    'JWT_SECRET',
    'REFRESH_SECRET',
    'TOTP_ENCRYPTION_KEY',
    'DAEMON_SHARED_SECRET',
  ] as const)('throws when %s is missing', (key) => {
    const env = validEnv();
    delete env[key];

    expect(() => loadConfig(env)).toThrow(key);
  });

  it.each(['JWT_SECRET', 'REFRESH_SECRET', 'DAEMON_SHARED_SECRET'] as const)(
    'throws when %s is weaker than 32 characters',
    (key) => {
      const env = validEnv();
      env[key] = 'too-short';

      expect(() => loadConfig(env)).toThrow(key);
    },
  );

  it('throws when TOTP_ENCRYPTION_KEY is not a 64-char hex string (32 bytes)', () => {
    const env = validEnv();
    env.TOTP_ENCRYPTION_KEY = 'not-a-valid-32-byte-hex-key';

    expect(() => loadConfig(env)).toThrow('TOTP_ENCRYPTION_KEY');
  });
});
