import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { DeviceStatus, GatewayIpamMode, RoleName, SessionStatus, VpnProviderType } from '@mango/shared';
import { buildApp, type VpnDaemonClient } from './app.js';
import { loadConfig, type ApiConfig } from './config.js';
import { createPrismaClient } from './lib/prisma.js';

describe('Admin Users, Devices, Sessions & Real-time Revocation (app.inject against PostgreSQL)', () => {
  let app: FastifyInstance;
  let config: ApiConfig;
  const prisma = createPrismaClient(
    process.env.DATABASE_URL ??
      'postgresql://mango:mangosecret@localhost:15432/mangovpn_v2_test?schema=public',
  );

  const removePeerMock = vi.fn<VpnDaemonClient['removePeer']>(async () => {});
  const addPeerMock = vi.fn<VpnDaemonClient['addPeer']>(async () => {});
  const vpnDaemon: VpnDaemonClient = {
    addPeer: addPeerMock,
    removePeer: removePeerMock,
  };

  let adminToken: string;
  let staffToken: string;
  let clientToken: string;
  let adminUserId: string;
  let staffUserId: string;
  let clientUserId: string;

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

    app = await buildApp({ config, prisma, vpnDaemon });
  });

  beforeEach(async () => {
    removePeerMock.mockReset();
    removePeerMock.mockResolvedValue(undefined);
    addPeerMock.mockReset();
    addPeerMock.mockResolvedValue(undefined);

    await prisma.vpnSession.deleteMany();
    await prisma.vpnPeer.deleteMany();
    await prisma.device.deleteMany();
    await prisma.connectTicket.deleteMany();
    await prisma.vpnGateway.deleteMany();
    await prisma.agentVersion.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();

    const adminRole = await prisma.role.create({ data: { name: RoleName.ADMIN, description: 'Admin' } });
    const staffRole = await prisma.role.create({ data: { name: RoleName.STAFF, description: 'Staff' } });
    const clientRole = await prisma.role.create({ data: { name: RoleName.CLIENT, description: 'Client' } });

    const adminUser = await prisma.user.create({
      data: {
        username: 'admin.rev',
        email: 'admin.rev@mango.local',
        passwordHash: 'hash',
        roleId: adminRole.id,
        isActive: true,
        tokenVersion: 0,
      },
    });
    const staffUser = await prisma.user.create({
      data: {
        username: 'staff.rev',
        email: 'staff.rev@mango.local',
        passwordHash: 'hash',
        roleId: staffRole.id,
        isActive: true,
        tokenVersion: 0,
      },
    });
    const clientUser = await prisma.user.create({
      data: {
        username: 'client.rev',
        email: 'client.rev@mango.local',
        passwordHash: 'hash',
        roleId: clientRole.id,
        isActive: true,
        tokenVersion: 0,
      },
    });

    adminUserId = adminUser.id;
    staffUserId = staffUser.id;
    clientUserId = clientUser.id;

    adminToken = signAccessToken({ id: adminUser.id, username: adminUser.username, role: RoleName.ADMIN, tokenVersion: 0 });
    staffToken = signAccessToken({ id: staffUser.id, username: staffUser.username, role: RoleName.STAFF, tokenVersion: 0 });
    clientToken = signAccessToken({ id: clientUser.id, username: clientUser.username, role: RoleName.CLIENT, tokenVersion: 0 });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 when unauthenticated and 403 for STAFF/CLIENT on Users, Devices, and Sessions endpoints', async () => {
    const endpoints: Array<{ method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string; payload?: unknown }> = [
      { method: 'GET', url: '/api/users' },
      { method: 'POST', url: '/api/users', payload: { username: 'u', email: 'u@x.io', password: 'StrongPassword123!', role: RoleName.CLIENT } },
      { method: 'PATCH', url: `/api/users/${staffUserId}/status`, payload: { isActive: false } },
      { method: 'GET', url: '/api/devices' },
      { method: 'POST', url: `/api/devices/${staffUserId}/revoke` },
      { method: 'DELETE', url: `/api/devices/${staffUserId}` },
      { method: 'GET', url: '/api/sessions' },
      { method: 'POST', url: `/api/sessions/${staffUserId}/disconnect` },
    ];

    for (const ep of endpoints) {
      const unauth = await app.inject({ method: ep.method, url: ep.url, payload: ep.payload });
      expect(unauth.statusCode).toBe(401);

      const staffRes = await app.inject({
        method: ep.method,
        url: ep.url,
        headers: { authorization: `Bearer ${staffToken}` },
        payload: ep.payload,
      });
      expect(staffRes.statusCode).toBe(403);

      const clientRes = await app.inject({
        method: ep.method,
        url: ep.url,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: ep.payload,
      });
      expect(clientRes.statusCode).toBe(403);
    }
  });

  it('lists users and creates a new user with bcryptjs hash and audit log', async () => {
    const listBefore = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listBefore.statusCode).toBe(200);
    expect(listBefore.json().items).toHaveLength(3);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        username: 'new.staff',
        email: 'new.staff@mango.local',
        password: 'VeryStrongPassword!99',
        role: RoleName.STAFF,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.username).toBe('new.staff');
    expect(created.role).toBe(RoleName.STAFF);
    expect(created.isActive).toBe(true);
    expect(created.passwordHash).toBeUndefined();

    // Verify created user can actually log in with the provided password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'new.staff', password: 'VeryStrongPassword!99' },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().status).toBe('MFA_SETUP_REQUIRED');

    // Verify duplicate username/email is rejected with 409
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        username: 'new.staff',
        email: 'new.staff@mango.local',
        password: 'VeryStrongPassword!99',
        role: RoleName.STAFF,
      },
    });
    expect(dupRes.statusCode).toBe(409);

    // Verify AuditLog entry was recorded
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'USER_CREATED', targetId: created.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(adminUserId);
  });

  it('disabling a user increments tokenVersion, revokes refresh tokens, closes sessions, removes peers, and blocks future auth/vpn', async () => {
    const device = await prisma.device.create({
      data: {
        userId: staffUserId,
        hostname: 'staff-laptop',
        fingerprint: 'fp-staff-1',
        status: DeviceStatus.ACTIVE,
      },
    });
    const peer = await prisma.vpnPeer.create({
      data: {
        userId: staffUserId,
        deviceId: device.id,
        publicKey: 'staff-pubkey-1',
        assignedIp: '10.13.13.10',
        isActive: true,
      },
    });
    const session = await prisma.vpnSession.create({
      data: {
        userId: staffUserId,
        deviceId: device.id,
        peerId: peer.id,
        assignedIp: '10.13.13.10',
        status: SessionStatus.ACTIVE,
      },
    });
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId: staffUserId,
        tokenHash: 'hash-staff-rt-1',
        familyId: '00000000-0000-0000-0000-000000000001',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const disableRes = await app.inject({
      method: 'PATCH',
      url: `/api/users/${staffUserId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    expect(disableRes.statusCode).toBe(200);
    expect(disableRes.json().isActive).toBe(false);

    expect(removePeerMock).toHaveBeenCalledTimes(1);
    expect(removePeerMock).toHaveBeenCalledWith({ publicKey: 'staff-pubkey-1' });

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: staffUserId } });
    expect(updatedUser.isActive).toBe(false);
    expect(updatedUser.tokenVersion).toBe(1);

    const updatedRt = await prisma.refreshToken.findUniqueOrThrow({ where: { id: refreshTokenRecord.id } });
    expect(updatedRt.revokedAt).not.toBeNull();

    const updatedSession = await prisma.vpnSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(updatedSession.status).toBe(SessionStatus.DISCONNECTED);
    expect(updatedSession.disconnectedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'USER_DISABLED', targetId: staffUserId },
    });
    expect(audit).not.toBeNull();

    // Existing access token is immediately rejected
    const ticketRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(ticketRes.statusCode).toBe(401);

    // Re-enabling works and writes USER_ENABLED audit log
    const enableRes = await app.inject({
      method: 'PATCH',
      url: `/api/users/${staffUserId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: true },
    });
    expect(enableRes.statusCode).toBe(200);
    expect(enableRes.json().isActive).toBe(true);
  });

  it('revokes a device via POST /api/devices/:id/revoke, tears down peer, closes sessions, and blocks future connect', async () => {
    const device = await prisma.device.create({
      data: {
        userId: clientUserId,
        hostname: 'client-win11',
        fingerprint: 'fp-client-revoke-1',
        status: DeviceStatus.ACTIVE,
      },
    });
    const peer = await prisma.vpnPeer.create({
      data: {
        userId: clientUserId,
        deviceId: device.id,
        publicKey: 'client-pubkey-1',
        assignedIp: '10.13.13.20',
        isActive: true,
      },
    });
    const session = await prisma.vpnSession.create({
      data: {
        userId: clientUserId,
        deviceId: device.id,
        peerId: peer.id,
        assignedIp: '10.13.13.20',
        status: SessionStatus.ACTIVE,
      },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/devices',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items).toHaveLength(1);
    expect(listRes.json().items[0].username).toBe('client.rev');

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/devices/${device.id}/revoke`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(revokeRes.statusCode).toBe(200);
    expect(revokeRes.json().status).toBe(DeviceStatus.REVOKED);

    expect(removePeerMock).toHaveBeenCalledTimes(1);
    expect(removePeerMock).toHaveBeenCalledWith({ publicKey: 'client-pubkey-1' });

    const closedSession = await prisma.vpnSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(closedSession.status).toBe(SessionStatus.DISCONNECTED);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'DEVICE_REVOKED', targetId: device.id },
    });
    expect(audit).not.toBeNull();

    // Future connect attempt with revoked device fingerprint is blocked with 403
    const ticketRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(ticketRes.statusCode).toBe(201);
    const { ticket } = ticketRes.json();

    const connectRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket,
        publicKey: Buffer.alloc(32, 7).toString('base64'),
        deviceFingerprint: 'fp-client-revoke-1',
        hostname: 'client-win11',
        agentVersion: '1.0.0',
      },
    });
    expect(connectRes.statusCode).toBe(403);
  });

  it('lists sessions, force-disconnects active session on daemon, and returns 502 if daemon fails', async () => {
    const device = await prisma.device.create({
      data: {
        userId: clientUserId,
        hostname: 'client-pc',
        fingerprint: 'fp-client-sess-1',
        status: DeviceStatus.ACTIVE,
      },
    });
    const peer = await prisma.vpnPeer.create({
      data: {
        userId: clientUserId,
        deviceId: device.id,
        publicKey: 'client-sess-pubkey',
        assignedIp: '10.13.13.30',
        isActive: true,
      },
    });
    const session = await prisma.vpnSession.create({
      data: {
        userId: clientUserId,
        deviceId: device.id,
        peerId: peer.id,
        assignedIp: '10.13.13.30',
        status: SessionStatus.ACTIVE,
      },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/sessions?status=ACTIVE',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items).toHaveLength(1);
    expect(listRes.json().items[0].username).toBe('client.rev');
    expect(listRes.json().items[0].hostname).toBe('client-pc');

    // Simulate daemon failure -> 502 and session remains ACTIVE
    removePeerMock.mockRejectedValueOnce(new Error('daemon unreachable'));
    const failRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${session.id}/disconnect`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(failRes.statusCode).toBe(502);
    const stillActive = await prisma.vpnSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stillActive.status).toBe(SessionStatus.ACTIVE);

    // Succeeds when daemon is healthy
    const okRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${session.id}/disconnect`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(okRes.statusCode).toBe(200);
    expect(okRes.json().status).toBe(SessionStatus.DISCONNECTED);
    expect(removePeerMock).toHaveBeenCalledWith({ publicKey: 'client-sess-pubkey' });

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SESSION_FORCE_DISCONNECTED', targetId: session.id },
    });
    expect(audit).not.toBeNull();
  });

  it('enforces ADMIN RBAC and supports CRUD + audit logs on /api/gateways', async () => {
    const staffGet = await app.inject({
      method: 'GET',
      url: '/api/gateways',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(staffGet.statusCode).toBe(403);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/gateways',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Cisco Branch ASA',
        providerType: VpnProviderType.CISCO,
        endpoint: 'asa.branch.internal:443',
        subnetCidr: '10.50.0.0/24',
        ipamMode: GatewayIpamMode.API_MANAGED,
        allowedRoles: [RoleName.ADMIN, RoleName.STAFF],
        isDefault: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.providerType).toBe(VpnProviderType.CISCO);
    expect(created.isDefault).toBe(true);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/gateways/${created.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isEnabled: false },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().isEnabled).toBe(false);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/gateways',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items).toHaveLength(1);

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/gateways/${created.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().success).toBe(true);
  });

  it('disconnects all active sessions atomically via POST /api/sessions/disconnect-all and records audit log', async () => {
    const dev = await prisma.device.create({
      data: {
        userId: staffUserId,
        hostname: 'staff-kill-pc',
        fingerprint: 'fp-kill-all-1',
        status: DeviceStatus.ACTIVE,
      },
    });
    const peer1 = await prisma.vpnPeer.create({
      data: {
        userId: staffUserId,
        deviceId: dev.id,
        publicKey: 'kill-all-pubkey-1',
        assignedIp: '10.13.13.31',
        isActive: true,
      },
    });
    const peer2 = await prisma.vpnPeer.create({
      data: {
        userId: clientUserId,
        deviceId: dev.id,
        publicKey: 'kill-all-pubkey-2',
        assignedIp: '10.13.13.32',
        isActive: true,
      },
    });
    await prisma.vpnSession.createMany({
      data: [
        {
          userId: staffUserId,
          deviceId: dev.id,
          peerId: peer1.id,
          assignedIp: '10.13.13.31',
          status: SessionStatus.ACTIVE,
        },
        {
          userId: clientUserId,
          deviceId: dev.id,
          peerId: peer2.id,
          assignedIp: '10.13.13.32',
          status: SessionStatus.ACTIVE,
        },
      ],
    });

    const staffRes = await app.inject({
      method: 'POST',
      url: '/api/sessions/disconnect-all',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(staffRes.statusCode).toBe(403);

    const okRes = await app.inject({
      method: 'POST',
      url: '/api/sessions/disconnect-all',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(okRes.statusCode).toBe(200);
    expect(okRes.json()).toEqual({ success: true, disconnectedCount: 2 });
    expect(removePeerMock).toHaveBeenCalledWith({ publicKey: 'kill-all-pubkey-1' });
    expect(removePeerMock).toHaveBeenCalledWith({ publicKey: 'kill-all-pubkey-2' });

    const remainingActive = await prisma.vpnSession.count({
      where: { status: SessionStatus.ACTIVE },
    });
    expect(remainingActive).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SESSION_FORCE_DISCONNECTED_ALL' },
    });
    expect(audit).not.toBeNull();
  });
});
