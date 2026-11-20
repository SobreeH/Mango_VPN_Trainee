export interface ApiConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  refreshSecret: string;
  totpEncryptionKey: string;
  daemonSharedSecret: string;
  corsOrigin: string | boolean;
}

const MIN_SECRET_LENGTH = 32;
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;

function requireNonEmpty(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireStrongSecret(env: NodeJS.ProcessEnv, key: string): string {
  const value = requireNonEmpty(env, key);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Environment variable ${key} must be at least ${MIN_SECRET_LENGTH} characters long`,
    );
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const databaseUrl = requireNonEmpty(env, 'DATABASE_URL');
  const jwtSecret = requireStrongSecret(env, 'JWT_SECRET');
  const refreshSecret = requireStrongSecret(env, 'REFRESH_SECRET');
  const daemonSharedSecret = requireStrongSecret(env, 'DAEMON_SHARED_SECRET');

  const totpEncryptionKey = requireNonEmpty(env, 'TOTP_ENCRYPTION_KEY');
  if (!HEX_64_REGEX.test(totpEncryptionKey)) {
    throw new Error(
      'Environment variable TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
  }

  const parsedPort = Number(env.PORT ?? '4000');
  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    throw new Error('Environment variable PORT must be a valid TCP port (1-65535)');
  }

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: parsedPort,
    databaseUrl,
    jwtSecret,
    refreshSecret,
    totpEncryptionKey,
    daemonSharedSecret,
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:3000',
  };
}
