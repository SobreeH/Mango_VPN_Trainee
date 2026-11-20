import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  DeviceStatus,
  PolicyAction,
  PolicyProtocol,
  PrismaClient,
  RoleName,
  SessionStatus,
} from '@prisma/client';
import type {
  DaemonAddPeerRequest,
  DaemonRemovePeerRequest,
  DaemonSyncPoliciesRequest,
} from '@mango/shared';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { buildApp, type VpnDaemonClient } from './app.js';
import { loadConfig, type ApiConfig } from './config.js';
import { createPrismaClient } from './lib/prisma.js';

describe('Admin Policies & Daemon Sync HTTP Seam (app.inject against PostgreSQL)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let config: ApiConfig;

  const addedPeers: DaemonAddPeerRequest[] = [];
  const syncedPayloads: DaemonSyncPoliciesRequest[] = [];

  const fakeDaemon: VpnDaemonClient = {
    async addPeer(req: DaemonAddPeerRequest) {
      addedPeers.push(req);
    },
    async removePeer(_req: DaemonRemovePeerRequest) {},
    async syncPolicies(req: DaemonSyncPoliciesRequest) {
      syncedPayloads.push(req);
    },
  };

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
    app = await buildApp({ config, prisma, vpnDaemon: fakeDaemon });
  });

  beforeEach(async () => {
    addedPeers.length = 0;
    syncedPayloads.length = 0;
    await prisma.vpnSession.deleteMany();
    await prisma.vpnPeer.deleteMany();
    await prisma.device.deleteMany();
    await prisma.connectTicket.deleteMany();
    await prisma.vpnPolicy.deleteMany();
    await prisma.agentVersion.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedUser(username: string, roleName: RoleName) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role` },
    });
    const passwordHash = await bcrypt.hash('StrongPassword!2026', 4);
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@mango.internal`,
        passwordHash,
        roleId: role.id,
        isActive: true,
        totpEnabled: true,
      },
      include: { role: true },
    });
    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role.name,
        tokenVersion: user.tokenVersion,
        type: 'access',
      },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: 900 },
    );
    return { user, role, token };
  }

  it('rejects unauthenticated (401) and non-ADMIN STAFF/CLIENT tokens (403) on policy endpoints', async () => {
    const { token: staffToken } = await seedUser('staff.pol', RoleName.STAFF);
    const { token: clientToken } = await seedUser('client.pol', RoleName.CLIENT);

    const unauth = await app.inject({ method: 'GET', url: '/api/policies' });
    expect(unauth.statusCode).toBe(401);

    for (const token of [staffToken, clientToken]) {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/policies',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(403);

      const postRes = await app.inject({
        method: 'POST',
        url: '/api/policies',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          role: 'STAFF',
          name: 'Allow Core',
          targetCidr: '10.0.0.0/8',
          protocol: 'ANY',
          action: 'ALLOW',
        },
      });
      expect(postRes.statusCode).toBe(403);

      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/policies/00000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(delRes.statusCode).toBe(403);
    }
  });

  it('validates policy fields and rejects malformed CIDR, portRange, protocol, or action with 400', async () => {
    const { token: adminToken } = await seedUser('admin.val', RoleName.ADMIN);

    const invalidPayloads = [
      {
        role: 'STAFF',
        name: 'Bad CIDR',
        targetCidr: '999.10.0.0/24',
        protocol: 'ANY',
        action: 'ALLOW',
      },
      {
        role: 'STAFF',
        name: 'Port on ANY',
        targetCidr: '10.0.0.0/8',
        protocol: 'ANY',
        portRange: '443',
        action: 'ALLOW',
      },
      {
        role: 'STAFF',
        name: 'Inverted port range',
        targetCidr: '10.0.0.0/8',
        protocol: 'TCP',
        portRange: '8080-80',
        action: 'ALLOW',
      },
      {
        role: 'STAFF',
        name: 'Bad action',
        targetCidr: '10.0.0.0/8',
        protocol: 'TCP',
        portRange: '443',
        action: 'REJECT',
      },
    ];

    for (const payload of invalidPayloads) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/policies',
        headers: { authorization: `Bearer ${adminToken}` },
        payload,
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('creates, lists, and deletes policies, syncing active peers to vpn-daemon and recording AuditLogs', async () => {
    const { token: adminToken, user: adminUser } = await seedUser('admin.pol', RoleName.ADMIN);
    const { user: staffUser } = await seedUser('staff.active', RoleName.STAFF);

    // Seed an active VPN session for staffUser
    const device = await prisma.device.create({
      data: {
        userId: staffUser.id,
        hostname: 'staff-laptop',
        fingerprint: 'fp-staff-active-1',
        status: DeviceStatus.ACTIVE,
      },
    });
    const pubKey = Buffer.alloc(32, 7).toString('base64');
    const peer = await prisma.vpnPeer.create({
      data: {
        userId: staffUser.id,
        deviceId: device.id,
        publicKey: pubKey,
        assignedIp: '10.13.13.50',
        isActive: true,
      },
    });
    await prisma.vpnSession.create({
      data: {
        userId: staffUser.id,
        deviceId: device.id,
        peerId: peer.id,
        assignedIp: '10.13.13.50',
        status: SessionStatus.ACTIVE,
      },
    });

    // Create DENY rule (priority 10) for STAFF
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        role: 'STAFF',
        name: 'Deny Secret Subnet',
        targetCidr: '10.99.0.0/16',
        protocol: 'TCP',
        portRange: '443',
        action: 'DENY',
        priority: 10,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.action).toBe(PolicyAction.DENY);
    expect(created.priority).toBe(10);

    // Verify daemon sync was called with the active peer and its new DENY rule
    expect(syncedPayloads).toHaveLength(1);
    expect(syncedPayloads[0]?.peers).toEqual([
      {
        publicKey: pubKey,
        assignedIp: '10.13.13.50',
        role: RoleName.STAFF,
        policies: [
          {
            targetCidr: '10.99.0.0/16',
            protocol: PolicyProtocol.TCP,
            portRange: '443',
            action: PolicyAction.DENY,
            priority: 10,
          },
        ],
      },
    ]);

    // Verify AuditLog recorded POLICY_CREATED
    const createAudit = await prisma.auditLog.findFirst({
      where: { actorUserId: adminUser.id, action: 'POLICY_CREATED', targetId: created.id },
    });
    expect(createAudit).not.toBeNull();

    // List policies
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/policies',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items).toHaveLength(1);

    // Delete policy
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/policies/${created.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);

    // Verify daemon sync was called again with empty policies for the active peer
    expect(syncedPayloads).toHaveLength(2);
    expect(syncedPayloads[1]?.peers[0]?.policies).toEqual([]);

    const deleteAudit = await prisma.auditLog.findFirst({
      where: { actorUserId: adminUser.id, action: 'POLICY_DELETED', targetId: created.id },
    });
    expect(deleteAudit).not.toBeNull();
  });

  it('passes role policies on POST /api/vpn/connect and enforces agent version allowlist', async () => {
    const { user: staffUser, role: staffRole, token: staffToken } = await seedUser(
      'staff.conn',
      RoleName.STAFF,
    );

    await prisma.vpnPolicy.create({
      data: {
        roleId: staffRole.id,
        name: 'Allow App',
        targetCidr: '10.20.0.0/16',
        protocol: PolicyProtocol.TCP,
        portRange: '443',
        action: PolicyAction.ALLOW,
        priority: 20,
        enabled: true,
      },
    });

    await prisma.agentVersion.create({
      data: {
        version: '2.0.0',
        platform: 'windows-x64',
        checksumSha256: 'a'.repeat(64),
        downloadUrl: 'https://downloads.mango.local/agent-2.0.0.msi',
        isActive: true,
        isMandatory: true,
      },
    });

    const ticket1 = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(ticket1.statusCode).toBe(201);

    // Outdated agent version must be rejected with 426
    const outdatedRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: ticket1.json().ticket,
        publicKey: Buffer.alloc(32, 9).toString('base64'),
        deviceFingerprint: 'fp-ver-test',
        hostname: 'win11-ver',
        agentVersion: '1.0.0',
      },
    });
    expect(outdatedRes.statusCode).toBe(426);

    // Valid agent version succeeds and forwards policies to vpnDaemon.addPeer
    const ticket2 = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    const okRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: ticket2.json().ticket,
        publicKey: Buffer.alloc(32, 9).toString('base64'),
        deviceFingerprint: 'fp-ver-test',
        hostname: 'win11-ver',
        agentVersion: '2.0.0',
      },
    });
    expect(okRes.statusCode).toBe(200);
    expect(addedPeers).toHaveLength(1);
    expect(addedPeers[0]?.policies).toEqual([
      {
        targetCidr: '10.20.0.0/16',
        protocol: PolicyProtocol.TCP,
        portRange: '443',
        action: PolicyAction.ALLOW,
        priority: 20,
      },
    ]);
    void staffUser;
  });
});
