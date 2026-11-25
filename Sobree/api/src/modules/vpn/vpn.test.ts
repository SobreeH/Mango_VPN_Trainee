import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  DeviceStatus,
  GatewayIpamMode,
  PolicyAction,
  PolicyProtocol,
  PrismaClient,
  RoleName,
  SessionStatus,
  VpnProviderType,
} from '@prisma/client';
import type { DaemonAddPeerRequest, DaemonRemovePeerRequest } from '@mango/shared';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { buildApp, type VpnDaemonClient } from '../../app.js';
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

describe('VPN Connect & Disconnect HTTP Seam (app.inject against PostgreSQL)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let config: ApiConfig;

  const addedPeers: DaemonAddPeerRequest[] = [];
  const removedPeers: DaemonRemovePeerRequest[] = [];
  let addPeerError: Error | null = null;
  let removePeerError: Error | null = null;

  const fakeDaemon: VpnDaemonClient = {
    async addPeer(req) {
      if (addPeerError) throw addPeerError;
      addedPeers.push(req);
    },
    async removePeer(req) {
      if (removePeerError) throw removePeerError;
      removedPeers.push(req);
    },
    async syncPolicies() {},
  };

  function generateWgPublicKey(): string {
    return crypto.randomBytes(32).toString('base64');
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

    prisma = createPrismaClient(config.databaseUrl);
    app = await buildApp({ config, prisma, vpnDaemon: fakeDaemon });
  });

  beforeEach(async () => {
    addedPeers.length = 0;
    removedPeers.length = 0;
    addPeerError = null;
    removePeerError = null;

    await prisma.vpnSession.deleteMany();
    await prisma.vpnPeer.deleteMany();
    await prisma.device.deleteMany();
    await prisma.vpnPolicy.deleteMany();
    await prisma.agentVersion.deleteMany();
    await prisma.connectTicket.deleteMany();
    await prisma.vpnGateway.deleteMany();
    await prisma.authRateLimit.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedUserAndTicket(options: {
    username: string;
    isActive?: boolean;
    role?: RoleName;
    expiresInMs?: number;
  }) {
    const roleName = options.role ?? RoleName.STAFF;
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role` },
    });

    const passwordHash = await bcrypt.hash('StrongPassword!2026', 4);
    const user = await prisma.user.create({
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

    const rawTicket = crypto.randomBytes(32).toString('base64url');
    const ticketHash = crypto.createHash('sha256').update(rawTicket).digest('hex');
    await prisma.connectTicket.create({
      data: {
        userId: user.id,
        ticketHash,
        expiresAt: new Date(Date.now() + (options.expiresInMs ?? 60_000)),
      },
    });

    return { user, role, rawTicket };
  }

  it('redeems a valid Connect Ticket, allocates an IP in 10.13.13.0/24, calls vpn-daemon, and records session + audit log', async () => {
    const { user, role, rawTicket } = await seedUserAndTicket({ username: 'bob' });
    await prisma.vpnPolicy.create({
      data: {
        roleId: role.id,
        name: 'Allow Internal Corp',
        targetCidr: '10.20.0.0/16',
        protocol: PolicyProtocol.ANY,
        action: PolicyAction.ALLOW,
        priority: 10,
        enabled: true,
      },
    });

    const publicKey = generateWgPublicKey();
    const res = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: rawTicket,
        publicKey,
        deviceFingerprint: 'fp-bob-win11',
        hostname: 'BOB-LAPTOP',
        agentVersion: '2.0.0',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.assignedIp).toMatch(/^10\.13\.13\.\d+$/);
    expect(body.sessionId).toBeTruthy();
    expect(body.allowedIps).toContain('10.20.0.0/16');
    expect(body.serverEndpoint).toBeTruthy();

    expect(addedPeers).toHaveLength(1);
    expect(addedPeers[0]).toMatchObject({
      publicKey,
      assignedIp: body.assignedIp,
      role: RoleName.STAFF,
    });

    const session = await prisma.vpnSession.findUnique({ where: { id: body.sessionId } });
    expect(session?.status).toBe(SessionStatus.ACTIVE);
    expect(session?.assignedIp).toBe(body.assignedIp);

    const audit = await prisma.auditLog.findFirst({
      where: { actorUserId: user.id, action: 'VPN_CONNECTED' },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects ticket reuse (401) and expired tickets (401)', async () => {
    const { rawTicket } = await seedUserAndTicket({ username: 'carol' });

    const first = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: rawTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-carol',
        hostname: 'CAROL-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(first.statusCode).toBe(200);

    const reuse = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: rawTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-carol',
        hostname: 'CAROL-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(reuse.statusCode).toBe(401);

    const expired = await seedUserAndTicket({ username: 'dave', expiresInMs: -5_000 });
    const expiredRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: expired.rawTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-dave',
        hostname: 'DAVE-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(expiredRes.statusCode).toBe(401);
  });

  it('rejects disabled users (403) and revoked devices (403)', async () => {
    const disabled = await seedUserAndTicket({ username: 'eve-disabled', isActive: false });
    const disabledRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: disabled.rawTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-eve',
        hostname: 'EVE-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(disabledRes.statusCode).toBe(403);

    const active = await seedUserAndTicket({ username: 'frank' });
    await prisma.device.create({
      data: {
        userId: active.user.id,
        hostname: 'FRANK-PC',
        fingerprint: 'fp-frank-revoked',
        status: DeviceStatus.REVOKED,
      },
    });
    const revokedRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: active.rawTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-frank-revoked',
        hostname: 'FRANK-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(revokedRes.statusCode).toBe(403);
    expect(addedPeers).toHaveLength(0);
  });

  it('allocates unique VPN IPs under concurrent connect requests without duplicates', async () => {
    const users = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => seedUserAndTicket({ username: `concurrent-${n}` })),
    );

    const responses = await Promise.all(
      users.map((u, idx) =>
        app.inject({
          method: 'POST',
          url: '/api/vpn/connect',
          payload: {
            ticket: u.rawTicket,
            publicKey: generateWgPublicKey(),
            deviceFingerprint: `fp-concurrent-${idx}`,
            hostname: `HOST-${idx}`,
            agentVersion: '2.0.0',
          },
        }),
      ),
    );

    for (const res of responses) {
      expect(res.statusCode).toBe(200);
    }

    const ips = responses.map((r) => r.json().assignedIp as string);
    expect(new Set(ips).size).toBe(5);
    expect(addedPeers).toHaveLength(5);
  });

  it('surfaces vpn-daemon failure honestly (502) and does not leave an ACTIVE session', async () => {
    const { user, rawTicket } = await seedUserAndTicket({ username: 'grace' });
    addPeerError = new Error('vpn-daemon connection refused');

    const res = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: rawTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-grace',
        hostname: 'GRACE-PC',
        agentVersion: '2.0.0',
      },
    });

    expect(res.statusCode).toBe(502);
    const activeSessions = await prisma.vpnSession.findMany({
      where: { userId: user.id, status: SessionStatus.ACTIVE },
    });
    expect(activeSessions).toHaveLength(0);
  });

  it('disconnects active session via POST /api/vpn/disconnect and calls vpn-daemon removePeer', async () => {
    const { user, rawTicket } = await seedUserAndTicket({ username: 'heidi' });
    const publicKey = generateWgPublicKey();

    const connectRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: rawTicket,
        publicKey,
        deviceFingerprint: 'fp-heidi',
        hostname: 'HEIDI-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(connectRes.statusCode).toBe(200);
    const { sessionId } = connectRes.json();

    const disconnectRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/disconnect',
      payload: {
        sessionId,
        publicKey,
      },
    });

    expect(disconnectRes.statusCode).toBe(200);
    expect(disconnectRes.json().success).toBe(true);
    expect(removedPeers).toEqual([{ publicKey }]);

    const session = await prisma.vpnSession.findUnique({ where: { id: sessionId } });
    expect(session?.status).toBe(SessionStatus.DISCONNECTED);
    expect(session?.disconnectedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { actorUserId: user.id, action: 'VPN_DISCONNECTED' },
    });
    expect(audit).not.toBeNull();
  });

  it('removes the prior ephemeral peer key when a device reconnects with a new Curve25519 key', async () => {
    const first = await seedUserAndTicket({ username: 'ivan' });
    const firstKey = generateWgPublicKey();
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: first.rawTicket,
        publicKey: firstKey,
        deviceFingerprint: 'fp-ivan',
        hostname: 'IVAN-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(res1.statusCode).toBe(200);
    const assignedIp = res1.json().assignedIp;

    const secondTicketRaw = crypto.randomBytes(32).toString('base64url');
    await prisma.connectTicket.create({
      data: {
        userId: first.user.id,
        ticketHash: crypto.createHash('sha256').update(secondTicketRaw).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const secondKey = generateWgPublicKey();
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: secondTicketRaw,
        publicKey: secondKey,
        deviceFingerprint: 'fp-ivan',
        hostname: 'IVAN-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().assignedIp).toBe(assignedIp);
    expect(removedPeers).toEqual([{ publicKey: firstKey }]);
    expect(addedPeers[1]).toMatchObject({ publicKey: secondKey, assignedIp });
  });

  it('enforces the mandatory agent version per platform when platform is provided', async () => {
    await prisma.agentVersion.create({
      data: {
        version: '3.0.0',
        platform: 'linux-x64',
        checksumSha256: 'd'.repeat(64),
        downloadUrl: 'https://downloads.mango.local/agent-linux-3.0.0.tar.gz',
        isActive: true,
        isMandatory: true,
      },
    });

    const { rawTicket } = await seedUserAndTicket({ username: 'judy' });
    const outdatedRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: rawTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-judy-linux',
        hostname: 'JUDY-LINUX',
        agentVersion: '2.0.0',
        platform: 'linux-x64',
      },
    });
    expect(outdatedRes.statusCode).toBe(426);
    expect(outdatedRes.json()).toMatchObject({ error: 'AGENT_VERSION_OUTDATED' });
    expect(outdatedRes.json().message).toContain('linux-x64');

    const { rawTicket: freshTicket } = await seedUserAndTicket({ username: 'kevin' });
    const upToDateRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: freshTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-kevin-linux',
        hostname: 'KEVIN-LINUX',
        agentVersion: '3.0.0',
        platform: 'linux-x64',
      },
    });
    expect(upToDateRes.statusCode).toBe(200);
  });

  it('defaults platform to windows-x64 when platform is omitted', async () => {
    await prisma.agentVersion.create({
      data: {
        version: '3.0.0',
        platform: 'windows-x64',
        checksumSha256: 'e'.repeat(64),
        downloadUrl: 'https://downloads.mango.local/agent-windows-3.0.0.msi',
        isActive: true,
        isMandatory: true,
      },
    });

    const { rawTicket } = await seedUserAndTicket({ username: 'laura' });
    const outdatedRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: rawTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-laura-win',
        hostname: 'LAURA-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(outdatedRes.statusCode).toBe(426);
    expect(outdatedRes.json().message).toContain('windows-x64');

    const { rawTicket: freshTicket } = await seedUserAndTicket({ username: 'mike' });
    const upToDateRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: freshTicket,
        publicKey: generateWgPublicKey(),
        deviceFingerprint: 'fp-mike-win',
        hostname: 'MIKE-PC',
        agentVersion: '3.0.0',
      },
    });
    expect(upToDateRes.statusCode).toBe(200);
  });

  it('supports Fortinet and Cisco gateways with role discovery, per-gateway IPAM, and ephemeral tunnelConfig', async () => {
    const fgGateway = await prisma.vpnGateway.create({
      data: {
        name: 'HQ FortiGate SSL-VPN',
        providerType: VpnProviderType.FORTINET,
        endpoint: 'fg.mango.internal:443',
        subnetCidr: '10.40.0.0/24',
        ipamMode: GatewayIpamMode.API_MANAGED,
        dns: ['10.40.0.1'],
        allowedRoles: [RoleName.STAFF, RoleName.ADMIN],
        isEnabled: true,
      },
    });
    await prisma.vpnGateway.create({
      data: {
        name: 'Cisco Admin Only',
        providerType: VpnProviderType.CISCO,
        endpoint: 'asa.mango.internal:443',
        subnetCidr: '10.50.0.0/24',
        ipamMode: GatewayIpamMode.API_MANAGED,
        allowedRoles: [RoleName.ADMIN],
        isEnabled: true,
      },
    });

    const { user: staffUser } = await seedUserAndTicket({ username: 'nina-fg', role: RoleName.STAFF });
    const staffToken = jwt.sign(
      {
        sub: staffUser.id,
        role: RoleName.STAFF,
        tokenVersion: staffUser.tokenVersion,
        type: 'access',
      },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: 900 },
    );

    const gwRes = await app.inject({
      method: 'GET',
      url: '/api/vpn/gateways',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(gwRes.statusCode).toBe(200);
    expect(gwRes.json().items).toHaveLength(1);
    expect(gwRes.json().items[0].id).toBe(fgGateway.id);

    const ticketRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/ticket',
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { gatewayId: fgGateway.id },
    });
    expect(ticketRes.statusCode).toBe(201);
    expect(ticketRes.json().gatewayId).toBe(fgGateway.id);
    expect(ticketRes.json().providerType).toBe(VpnProviderType.FORTINET);

    const connectRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/connect',
      payload: {
        ticket: ticketRes.json().ticket,
        deviceFingerprint: 'fp-nina-fg',
        hostname: 'NINA-PC',
        agentVersion: '2.0.0',
      },
    });
    expect(connectRes.statusCode).toBe(200);
    const body = connectRes.json();
    expect(body.providerType).toBe(VpnProviderType.FORTINET);
    expect(body.gatewayId).toBe(fgGateway.id);
    expect(body.assignedIp).toBe('10.40.0.2');
    expect(body.serverEndpoint).toBe('fg.mango.internal:443');
    expect(body.tunnelConfig).toMatchObject({
      providerType: 'FORTINET',
      protocol: 'fortinet',
      username: 'nina-fg',
    });
    expect(typeof body.tunnelConfig.ephemeralSecret).toBe('string');

    expect(addedPeers[0]).toMatchObject({
      providerType: 'FORTINET',
      gatewayId: fgGateway.id,
      peerIdentity: body.peerIdentity,
      assignedIp: '10.40.0.2',
    });

    const discRes = await app.inject({
      method: 'POST',
      url: '/api/vpn/disconnect',
      payload: {
        sessionId: body.sessionId,
        peerIdentity: body.peerIdentity,
      },
    });
    expect(discRes.statusCode).toBe(200);
    expect(removedPeers[0]).toMatchObject({
      providerType: 'FORTINET',
      gatewayId: fgGateway.id,
      peerIdentity: body.peerIdentity,
    });
  });
});
