import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { buildApp } from '../../app.js';
import { loadConfig, type ApiConfig } from '../../config.js';
import { createPrismaClient } from '../../lib/prisma.js';
import { createAuthenticateHook, requireRole } from '../../middleware/auth.js';
import { RoleName as SharedRoleName } from '@mango/shared';

function decodeBase32(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 char: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function computeTestTotp(secretBase32: string, timestampMs = Date.now()): string {
  const key = decodeBase32(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

describe('Auth + TOTP + JWT HTTP Seam (app.inject against PostgreSQL)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let config: ApiConfig;

  const testPassword = 'ValidTestPassword!2026';

  beforeAll(async () => {
    config = loadConfig({
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

    prisma = createPrismaClient(config.databaseUrl);
    app = await buildApp({ config, prisma });
  });

  beforeEach(async () => {
    await prisma.authRateLimit.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();

    const adminRole = await prisma.role.create({
      data: { name: RoleName.ADMIN, description: 'Admin' },
    });
    const clientRole = await prisma.role.create({
      data: { name: RoleName.CLIENT, description: 'Client' },
    });

    const passwordHash = await bcrypt.hash(testPassword, 10);

    await prisma.user.create({
      data: {
        username: 'alice',
        email: 'alice@mango.internal',
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
        totpEnabled: false,
      },
    });

    await prisma.user.create({
      data: {
        username: 'disabled_user',
        email: 'disabled@mango.internal',
        passwordHash,
        roleId: clientRole.id,
        isActive: false,
        totpEnabled: false,
      },
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects invalid credentials with 401 and locks out after 5 failed attempts (429)', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'alice', password: 'WrongPassword!' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBeTruthy();
    }

    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: testPassword },
    });
    expect(lockedRes.statusCode).toBe(429);
    expect(lockedRes.json().message).toMatch(/locked|too many/i);
  });

  it('rejects disabled accounts with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'disabled_user', password: testPassword },
    });
    expect(res.statusCode).toBe(403);
  });

  it('completes first-time TOTP enrollment, returning-user TOTP verification, and issues HS256 JWT + rotating refresh tokens', async () => {
    // 1. First-time login -> MFA_SETUP_REQUIRED
    const login1 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: testPassword },
    });
    expect(login1.statusCode).toBe(200);
    const body1 = login1.json();
    expect(body1.status).toBe('MFA_SETUP_REQUIRED');
    expect(body1.mfaToken).toBeTruthy();
    expect(body1.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(body1.secretBase32).toBeTruthy();

    // 2. Reject wrong TOTP code
    const badOtp = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { mfaToken: body1.mfaToken, code: '000000' },
    });
    // In the 1-in-1,000,000 chance 000000 matches, we'd use a different code, but practically it's 401
    if (computeTestTotp(body1.secretBase32) !== '000000') {
      expect(badOtp.statusCode).toBe(401);
    }

    // 3. Verify valid TOTP code (also works for ±1 step)
    const validCode = computeTestTotp(body1.secretBase32);
    const verify1 = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { mfaToken: body1.mfaToken, code: validCode },
    });
    expect(verify1.statusCode).toBe(200);
    const tokens1 = verify1.json();
    expect(tokens1.accessToken).toBeTruthy();
    expect(tokens1.refreshToken).toBeTruthy();
    expect(tokens1.user.username).toBe('alice');
    expect(tokens1.user.totpEnabled).toBe(true);

    // Verify JWT is HS256-pinned
    const decoded = jwt.verify(tokens1.accessToken, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;
    expect(decoded.role).toBe(RoleName.ADMIN);

    // 4. Returning user login -> MFA_REQUIRED (no secret exposed)
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: testPassword },
    });
    expect(login2.statusCode).toBe(200);
    const body2 = login2.json();
    expect(body2.status).toBe('MFA_REQUIRED');
    expect(body2.secretBase32).toBeUndefined();

    // 5. Verify returning user with ±1 step tolerance (previous 30s window)
    const prevStepCode = computeTestTotp(body1.secretBase32, Date.now() - 30_000);
    const verify2 = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { mfaToken: body2.mfaToken, code: prevStepCode },
    });
    expect(verify2.statusCode).toBe(200);
  });

  it('rotates refresh tokens, revokes entire family on reuse, and invalidates family on logout', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: testPassword },
    });
    const { mfaToken, secretBase32 } = loginRes.json();
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { mfaToken, code: computeTestTotp(secretBase32) },
    });
    const { refreshToken: token1 } = verifyRes.json();

    // Rotate token1 -> token2
    const refresh1 = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token1 },
    });
    expect(refresh1.statusCode).toBe(200);
    const { refreshToken: token2 } = refresh1.json();
    expect(token2).toBeTruthy();
    expect(token2).not.toBe(token1);

    // Replay token1 -> reuse detected, entire family revoked
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token1 },
    });
    expect(replayRes.statusCode).toBe(401);
    expect(replayRes.json().message).toMatch(/reuse/i);

    // token2 (same family) must now also be revoked
    const afterReuseRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token2 },
    });
    expect(afterReuseRes.statusCode).toBe(401);

    // Fresh login + logout revokes the new family
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: testPassword },
    });
    const verify2 = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { mfaToken: login2.json().mfaToken, code: computeTestTotp(secretBase32) },
    });
    const { refreshToken: token3 } = verify2.json();

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refreshToken: token3 },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().success).toBe(true);

    const afterLogoutRefresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: token3 },
    });
    expect(afterLogoutRefresh.statusCode).toBe(401);
  });

  it('enforces authenticate and requireRole middleware with HS256-pinned JWTs', async () => {
    // Create a CLIENT user
    const clientRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.CLIENT } });
    const passwordHash = await bcrypt.hash(testPassword, 10);
    await prisma.user.create({
      data: {
        username: 'bob_client',
        email: 'bob@mango.internal',
        passwordHash,
        roleId: clientRole.id,
        isActive: true,
        totpEnabled: false,
      },
    });

    // Get ADMIN token
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: testPassword },
    });
    const adminTokens = (
      await app.inject({
        method: 'POST',
        url: '/api/auth/verify-otp',
        payload: {
          mfaToken: adminLogin.json().mfaToken,
          code: computeTestTotp(adminLogin.json().secretBase32),
        },
      })
    ).json();

    // Get CLIENT token
    const clientLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'bob_client', password: testPassword },
    });
    const clientTokens = (
      await app.inject({
        method: 'POST',
        url: '/api/auth/verify-otp',
        payload: {
          mfaToken: clientLogin.json().mfaToken,
          code: computeTestTotp(clientLogin.json().secretBase32),
        },
      })
    ).json();

    // GET /api/auth/me rejects missing/invalid tokens and accepts valid HS256 token
    const noAuth = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(noAuth.statusCode).toBe(401);

    const meAdmin = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${adminTokens.accessToken}` },
    });
    expect(meAdmin.statusCode).toBe(200);
    expect(meAdmin.json().role).toBe(RoleName.ADMIN);

    // Test requireRole(ADMIN) on a Fastify route
    const roleApp = Fastify();
    const authenticate = createAuthenticateHook(config, prisma);
    roleApp.get(
      '/admin-only',
      { preHandler: [authenticate, requireRole(SharedRoleName.ADMIN)] },
      async (req) => ({ ok: true, user: req.authUser }),
    );

    const clientDenied = await roleApp.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${clientTokens.accessToken}` },
    });
    expect(clientDenied.statusCode).toBe(403);

    const adminAllowed = await roleApp.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${adminTokens.accessToken}` },
    });
    expect(adminAllowed.statusCode).toBe(200);
    await roleApp.close();
  });
});
