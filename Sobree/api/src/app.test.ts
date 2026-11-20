import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrismaClient } from './lib/prisma.js';

describe('GET /health (Fastify app.inject against PostgreSQL)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://mango:mangosecret@localhost:15432/mangovpn_v2_test?schema=public',
      JWT_SECRET: process.env.JWT_SECRET ?? 'a'.repeat(32),
      REFRESH_SECRET: process.env.REFRESH_SECRET ?? 'b'.repeat(32),
      TOTP_ENCRYPTION_KEY:
        process.env.TOTP_ENCRYPTION_KEY ??
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      DAEMON_SHARED_SECRET: process.env.DAEMON_SHARED_SECRET ?? 'c'.repeat(32),
    });

    const prisma = createPrismaClient(config.databaseUrl);
    app = await buildApp({ config, prisma });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 200 with status ok and database connected', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
