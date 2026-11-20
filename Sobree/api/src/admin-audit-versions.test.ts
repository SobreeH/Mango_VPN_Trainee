import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { RoleName } from '@mango/shared';
import { buildApp } from './app.js';
import { loadConfig, type ApiConfig } from './config.js';
import { createPrismaClient } from './lib/prisma.js';
import { AgentVersionError, assertAgentVersionAllowed, recordAuthAuditEvent } from '@mango/rain-admin';

describe('Admin Audit Logs & Agent Versions (app.inject against PostgreSQL)', () => {
  let app: FastifyInstance;
  let config: ApiConfig;
  const prisma = createPrismaClient(
    process.env.DATABASE_URL ??
      'postgresql://mango:mangosecret@localhost:15432/mangovpn_v2_test?schema=public',
  );

  let adminToken: string;
  let staffToken: string;
  let clientToken: string;
  let adminUserId: string;
  let staffUserId: string;

  function signAccessToken(user: { id: string; username: string; role: RoleName; tokenVersion: number }) {
    return jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        tokenVersion: user.tokenVersion,
        type: 'access',
      },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
  }

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

    app = await buildApp({ config, prisma });
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.agentVersion.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();

    const adminRole = await prisma.role.create({ data: { name: RoleName.ADMIN, description: 'Admin' } });
    const staffRole = await prisma.role.create({ data: { name: RoleName.STAFF, description: 'Staff' } });
    const clientRole = await prisma.role.create({ data: { name: RoleName.CLIENT, description: 'Client' } });

    const adminUser = await prisma.user.create({
      data: {
        username: 'admin.test',
        email: 'admin.test@mango.local',
        passwordHash: 'hash',
        roleId: adminRole.id,
        isActive: true,
        tokenVersion: 0,
      },
    });
    const staffUser = await prisma.user.create({
      data: {
        username: 'staff.test',
        email: 'staff.test@mango.local',
        passwordHash: 'hash',
        roleId: staffRole.id,
        isActive: true,
        tokenVersion: 0,
      },
    });
    const clientUser = await prisma.user.create({
      data: {
        username: 'client.test',
        email: 'client.test@mango.local',
        passwordHash: 'hash',
        roleId: clientRole.id,
        isActive: true,
        tokenVersion: 0,
      },
    });

    adminUserId = adminUser.id;
    staffUserId = staffUser.id;

    adminToken = signAccessToken({ id: adminUser.id, username: adminUser.username, role: RoleName.ADMIN, tokenVersion: 0 });
    staffToken = signAccessToken({ id: staffUser.id, username: staffUser.username, role: RoleName.STAFF, tokenVersion: 0 });
    clientToken = signAccessToken({ id: clientUser.id, username: clientUser.username, role: RoleName.CLIENT, tokenVersion: 0 });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('RBAC Guard & Audit Logs (GET /api/audit-logs)', () => {
    it('returns 401 when unauthenticated and 403 for STAFF and CLIENT tokens', async () => {
      const unauth = await app.inject({ method: 'GET', url: '/api/audit-logs' });
      expect(unauth.statusCode).toBe(401);

      const staffRes = await app.inject({
        method: 'GET',
        url: '/api/audit-logs',
        headers: { authorization: `Bearer ${staffToken}` },
      });
      expect(staffRes.statusCode).toBe(403);

      const clientRes = await app.inject({
        method: 'GET',
        url: '/api/audit-logs',
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(clientRes.statusCode).toBe(403);
    });

    it('lists paginated and filtered audit logs including auth events for ADMIN', async () => {
      await recordAuthAuditEvent(prisma, {
        event: 'login',
        actorUserId: staffUserId,
        ipAddress: '192.168.1.50',
        metadata: { mfaRequired: true, username: 'staff.test' },
      });
      await recordAuthAuditEvent(prisma, {
        event: 'verify-otp',
        actorUserId: staffUserId,
        ipAddress: '192.168.1.50',
        metadata: { method: 'totp' },
      });
      await recordAuthAuditEvent(prisma, {
        event: 'logout',
        actorUserId: adminUserId,
        ipAddress: '10.0.0.2',
        metadata: { reason: 'user_initiated' },
      });

      const allRes = await app.inject({
        method: 'GET',
        url: '/api/audit-logs?page=1&pageSize=2',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(allRes.statusCode).toBe(200);
      const allBody = allRes.json();
      expect(allBody.total).toBe(3);
      expect(allBody.page).toBe(1);
      expect(allBody.pageSize).toBe(2);
      expect(allBody.totalPages).toBe(2);
      expect(allBody.items).toHaveLength(2);
      expect(allBody.items[0].actorUsername).toBe('admin.test');
      expect(allBody.items[0].action).toBe('auth.logout');
      expect(allBody.items[0].ipAddress).toBe('10.0.0.2');
      expect(allBody.items[0].metadata).toEqual({ reason: 'user_initiated' });

      const filteredRes = await app.inject({
        method: 'GET',
        url: `/api/audit-logs?action=auth.verify_otp&actorUserId=${staffUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(filteredRes.statusCode).toBe(200);
      const filteredBody = filteredRes.json();
      expect(filteredBody.total).toBe(1);
      expect(filteredBody.items[0].action).toBe('auth.verify_otp');
      expect(filteredBody.items[0].actorUsername).toBe('staff.test');
      expect(filteredBody.items[0].metadata).toEqual({ method: 'totp' });
    });
  });

  describe('Agent Versions CRUD & Enforcement', () => {
    const validChecksum = 'a'.repeat(64);

    it('rejects non-ADMIN roles with 403 on agent-versions endpoints', async () => {
      const staffGet = await app.inject({
        method: 'GET',
        url: '/api/agent-versions',
        headers: { authorization: `Bearer ${staffToken}` },
      });
      expect(staffGet.statusCode).toBe(403);

      const clientPost = await app.inject({
        method: 'POST',
        url: '/api/agent-versions',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          version: '1.0.0',
          platform: 'windows-x64',
          downloadUrl: 'https://downloads.mango.local/agent-1.0.0.msi',
          sha256Checksum: validChecksum,
        },
      });
      expect(clientPost.statusCode).toBe(403);
    });

    it('creates, lists, and updates agent versions while writing AuditLog entries', async () => {
      const badRes = await app.inject({
        method: 'POST',
        url: '/api/agent-versions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          version: 'not-semver',
          platform: 'windows-x64',
          downloadUrl: 'ftp://invalid',
          sha256Checksum: 'short',
        },
      });
      expect(badRes.statusCode).toBe(400);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/agent-versions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          version: '1.2.0',
          platform: 'windows-x64',
          downloadUrl: 'https://downloads.mango.local/mango-agent-1.2.0.msi',
          sha256Checksum: validChecksum,
          isActive: true,
          isRequired: true,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json();
      expect(created.version).toBe('1.2.0');
      expect(created.platform).toBe('windows-x64');
      expect(created.sha256Checksum).toBe(validChecksum);
      expect(created.isActive).toBe(true);
      expect(created.isRequired).toBe(true);

      const dupRes = await app.inject({
        method: 'POST',
        url: '/api/agent-versions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          version: '1.2.0',
          platform: 'windows-x64',
          downloadUrl: 'https://downloads.mango.local/mango-agent-1.2.0.msi',
          sha256Checksum: validChecksum,
        },
      });
      expect(dupRes.statusCode).toBe(409);

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/agent-versions/${created.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isRequired: false, isActive: false },
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = patchRes.json();
      expect(patched.isRequired).toBe(false);
      expect(patched.isActive).toBe(false);

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/agent-versions',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().items).toHaveLength(1);
      expect(listRes.json().items[0].id).toBe(created.id);

      const auditRes = await app.inject({
        method: 'GET',
        url: '/api/audit-logs?targetType=AGENT_VERSION',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(auditRes.statusCode).toBe(200);
      const auditActions = auditRes.json().items.map((i: { action: string }) => i.action);
      expect(auditActions).toContain('agent_version.create');
      expect(auditActions).toContain('agent_version.update');
    });

    it('enforces minimum-required and active agent versions in assertAgentVersionAllowed', async () => {
      await prisma.agentVersion.create({
        data: {
          version: '1.5.0',
          platform: 'windows-x64',
          downloadUrl: 'https://downloads.mango.local/mango-agent-1.5.0.msi',
          checksumSha256: validChecksum,
          isActive: true,
          isMandatory: true,
        },
      });
      await prisma.agentVersion.create({
        data: {
          version: '1.6.0',
          platform: 'windows-x64',
          downloadUrl: 'https://downloads.mango.local/mango-agent-1.6.0.msi',
          checksumSha256: validChecksum,
          isActive: false,
          isMandatory: false,
        },
      });

      await expect(assertAgentVersionAllowed(prisma, '1.4.9', 'windows-x64')).rejects.toThrow(
        AgentVersionError,
      );
      await expect(assertAgentVersionAllowed(prisma, '1.4.12', 'windows-x64')).rejects.toThrow(
        /1\.5\.0/,
      );
      await expect(assertAgentVersionAllowed(prisma, '1.6.0', 'windows-x64')).rejects.toThrow(
        AgentVersionError,
      );

      await expect(assertAgentVersionAllowed(prisma, '1.5.0', 'windows-x64')).resolves.toBeUndefined();
      await expect(assertAgentVersionAllowed(prisma, '1.10.0', 'windows-x64')).resolves.toBeUndefined();
      await expect(assertAgentVersionAllowed(prisma, '1.0.0', 'linux-x64')).resolves.toBeUndefined();
    });
  });
});
