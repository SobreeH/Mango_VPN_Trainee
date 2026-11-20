import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { buildApp } from '../../app.js';
import { loadConfig, type ApiConfig } from '../../config.js';
import { createPrismaClient } from '../../lib/prisma.js';

describe('VPN Connect Ticket HTTP Seam (app.inject against PostgreSQL)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let config: ApiConfig;

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
    await prisma.connectTicket.deleteMany();
    await prisma.authRateLimit.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedUser(options: { username: string; isActive?: boolean; role?: RoleName }) {
    const roleName = options.role ?? RoleName.CLIENT;
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role` },
    });

    const passwordHash = await bcrypt.hash('StrongPassword!2026', 4);
    return prisma.user.create({
      data: {
        username: options.username,
        email: `${options.username}@mango.internal`,
        passwordHash,
        roleId: role.id,
        isActive: options.isActive ?? true,
        totpEnabled: true,
      },
      include: { role: true },
    });
  }

  function signAccessToken(user: { id: string; tokenVersion: number; role: { name: RoleName } }) {
    return jwt.sign(
      {
        sub: user.id,
        role: user.role.name,
        tokenVersion: user.tokenVersion,
        type: 'access',
      },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: 900 },
    );
  }

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects disabled (inactive) users even with a valid JWT', async () => {
    const disabledUser = await seedUser({ username: 'disabled-user', isActive: false });
    const accessToken = signAccessToken(disabledUser);

    const res = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(401);
    const tickets = await prisma.connectTicket.findMany({ where: { userId: disabledUser.id } });
    expect(tickets).toHaveLength(0);
  });

  it('issues a short-lived single-use Connect Ticket hashed in PostgreSQL and records an audit log', async () => {
    const activeUser = await seedUser({ username: 'alice', isActive: true, role: RoleName.STAFF });
    const accessToken = signAccessToken(activeUser);

    const before = Date.now();
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res1.statusCode).toBe(201);
    const body1 = res1.json();
    expect(typeof body1.ticket).toBe('string');
    expect(body1.ticket.length).toBeGreaterThanOrEqual(32);
    expect(body1.expiresInSeconds).toBe(60);

    const expiresAtMs = new Date(body1.expiresAt).getTime();
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 50_000);
    expect(expiresAtMs).toBeLessThanOrEqual(Date.now() + 70_000);

    // Verify stored hashed (not plaintext) and unredeemed
    const expectedHash = crypto.createHash('sha256').update(body1.ticket).digest('hex');
    const stored = await prisma.connectTicket.findUnique({ where: { ticketHash: expectedHash } });
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(activeUser.id);
    expect(stored?.redeemedAt).toBeNull();

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { actorUserId: activeUser.id, action: 'VPN_TICKET_ISSUED' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.targetType).toBe('ConnectTicket');
    expect(audit?.targetId).toBe(stored?.id);

    // Second request issues a distinct ticket
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.json().ticket).not.toBe(body1.ticket);
  });
});
