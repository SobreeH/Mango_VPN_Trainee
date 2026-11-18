import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://mango:mangosecret@localhost:5432/mangovpn?schema=public';
}

const prisma = new PrismaClient();

async function main() {
  console.log('========================================================');
  console.log('--- [Rain] Seeding MANGO VPN Database (All 8 Tables) ---');
  console.log('========================================================');

  // ----------------------------------------------------
  // 1. Seed Roles (Table: roles)
  // ----------------------------------------------------
  console.log('\n[1/8] Seeding Roles...');
  const rolesData = [
    { name: 'ADMIN', description: 'Full access to all internal networks, policy engine, and admin panels' },
    { name: 'STAFF', description: 'Access to corporate internal subnets (10.0.0.0/8, 172.16.0.0/12)' },
    { name: 'CLIENT', description: 'Restricted zero-trust isolated access to designated single-host targets' },
  ];

  const rolesMap: Record<string, string> = {};

  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    rolesMap[r.name] = role.id;
    console.log(`  -> Role: ${role.name.padEnd(8)} (ID: ${role.id})`);
  }

  // ----------------------------------------------------
  // 2. Seed Role-Based VPN Policies (Table: vpn_policies)
  // ----------------------------------------------------
  console.log('\n[2/8] Seeding VPN Policies...');
  // Clear existing policies to keep seeder idempotent and prevent duplicates
  await prisma.vpnPolicy.deleteMany({});

  const policiesData = [
    {
      roleId: rolesMap['ADMIN']!,
      destinationCidr: '0.0.0.0/0',
      protocol: 'ALL',
      portRange: 'ANY',
      action: 'ALLOW',
    },
    {
      roleId: rolesMap['STAFF']!,
      destinationCidr: '10.0.0.0/8',
      protocol: 'ALL',
      portRange: 'ANY',
      action: 'ALLOW',
    },
    {
      roleId: rolesMap['STAFF']!,
      destinationCidr: '172.16.0.0/12',
      protocol: 'ALL',
      portRange: 'ANY',
      action: 'ALLOW',
    },
    {
      roleId: rolesMap['CLIENT']!,
      destinationCidr: '10.13.13.100/32',
      protocol: 'TCP',
      portRange: '80,443',
      action: 'ALLOW',
    },
    {
      roleId: rolesMap['CLIENT']!,
      destinationCidr: '10.13.13.101/32',
      protocol: 'TCP',
      portRange: '8080',
      action: 'ALLOW',
    },
  ];

  for (const p of policiesData) {
    await prisma.vpnPolicy.create({
      data: p,
    });
    console.log(`  -> Policy: ${p.protocol.padEnd(4)} ${p.destinationCidr.padEnd(16)} : ${p.portRange.padEnd(8)} -> ${p.action}`);
  }

  // ----------------------------------------------------
  // 3. Seed Users (Table: users)
  // ----------------------------------------------------
  console.log('\n[3/8] Seeding Users...');
  const passwordHash = await bcrypt.hash('MangoVPN2026!', 10);

  const usersData = [
    {
      username: 'admin_user',
      passwordHash,
      phoneNumber: '+15551234567',
      roleId: rolesMap['ADMIN']!,
      isActive: true,
    },
    {
      username: 'staff_user',
      passwordHash,
      phoneNumber: '+15552345678',
      roleId: rolesMap['STAFF']!,
      isActive: true,
    },
    {
      username: 'client_user',
      passwordHash,
      phoneNumber: '+15553456789',
      roleId: rolesMap['CLIENT']!,
      isActive: true,
    },
  ];

  const usersMap: Record<string, string> = {};

  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        passwordHash: u.passwordHash,
        phoneNumber: u.phoneNumber,
        roleId: u.roleId,
        isActive: u.isActive,
      },
      create: u,
    });
    usersMap[u.username] = user.id;
    console.log(`  -> User: ${user.username.padEnd(12)} (${user.phoneNumber}) [Password: MangoVPN2026!]`);
  }

  // ----------------------------------------------------
  // 4. Seed Devices (Table: devices)
  // ----------------------------------------------------
  console.log('\n[4/8] Seeding Hardware Devices...');
  const adminId = usersMap['admin_user']!;
  const staffId = usersMap['staff_user']!;
  const clientId = usersMap['client_user']!;

  const devicesData = [
    {
      userId: adminId,
      deviceName: 'Rain-Dev-Workstation',
      osInfo: 'Windows 11 Pro 23H2 (x86_64)',
      macAddress: '00:1A:2B:3C:4D:5E',
      lastSeen: new Date(),
    },
    {
      userId: adminId,
      deviceName: 'Admin-Travel-MacBook',
      osInfo: 'macOS Sonoma 14.5 (Apple M3)',
      macAddress: 'A4:83:E7:22:11:00',
      lastSeen: new Date(Date.now() - 3600 * 1000 * 48), // 2 days ago
    },
    {
      userId: staffId,
      deviceName: 'Staff-ThinkPad-T14',
      osInfo: 'Ubuntu 24.04 LTS (x86_64)',
      macAddress: '3C:52:82:77:88:99',
      lastSeen: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    },
    {
      userId: clientId,
      deviceName: 'Client-Dell-Latitude',
      osInfo: 'Windows 10 Enterprise (x86_64)',
      macAddress: 'F0:18:98:44:55:66',
      lastSeen: new Date(Date.now() - 3600 * 1000 * 24), // 1 day ago
    },
    {
      userId: clientId,
      deviceName: 'Client-iPhone-15',
      osInfo: 'iOS 18.1 (ARM64)',
      macAddress: '12:34:56:78:9A:BC',
      lastSeen: new Date(Date.now() - 3600 * 1000 * 72), // 3 days ago
    },
  ];

  const devicesMap: Record<string, string> = {};

  for (const d of devicesData) {
    let device = await prisma.device.findFirst({
      where: { userId: d.userId, deviceName: d.deviceName },
    });

    if (!device) {
      device = await prisma.device.create({ data: d });
    } else {
      device = await prisma.device.update({
        where: { id: device.id },
        data: { osInfo: d.osInfo, macAddress: d.macAddress, lastSeen: d.lastSeen },
      });
    }

    devicesMap[d.deviceName] = device.id;
    console.log(`  -> Device: ${device.deviceName.padEnd(24)} (${device.osInfo})`);
  }

  // ----------------------------------------------------
  // 5. Seed WireGuard VPN Peers (Table: vpn_peers)
  // ----------------------------------------------------
  console.log('\n[5/8] Seeding WireGuard VPN Peers...');
  const peersData = [
    {
      userId: adminId,
      deviceId: devicesMap['Rain-Dev-Workstation'],
      publicKey: 'xTqB9G2V0N5fH7k1W8zL4pM6rS9uY3aE8cI0oQ2vD4g=',
      assignedIp: '10.13.13.10/32',
      isEnabled: true,
    },
    {
      userId: adminId,
      deviceId: devicesMap['Admin-Travel-MacBook'],
      publicKey: 'vK4lM8nO2pQ4rS6tU8vW0xY2zA4bC6dE8fG0hI2jK4l=',
      assignedIp: '10.13.13.11/32',
      isEnabled: true,
    },
    {
      userId: staffId,
      deviceId: devicesMap['Staff-ThinkPad-T14'],
      publicKey: 'mK7vL9aP3nQ2wE1rT4yU5iO6pA8sD0fG2hJ4kL6zX8c=',
      assignedIp: '10.13.13.20/32',
      isEnabled: true,
    },
    {
      userId: clientId,
      deviceId: devicesMap['Client-Dell-Latitude'],
      publicKey: 'pQ9rS2tU4vW6xY8zA0bC2dE4fG6hI8jK0lM2nO4pQ6r=',
      assignedIp: '10.13.13.30/32',
      isEnabled: true,
    },
    {
      userId: clientId,
      deviceId: devicesMap['Client-iPhone-15'],
      publicKey: 'hJ3kL5mN7oP9qR1sT3uV5wX7yZ9aB1cD3eF5gH7iJ9k=',
      assignedIp: '10.13.13.31/32',
      isEnabled: false,
    },
  ];

  const peersMap: Record<string, string> = {};

  for (const peer of peersData) {
    const seededPeer = await prisma.vpnPeer.upsert({
      where: { publicKey: peer.publicKey },
      update: {
        userId: peer.userId,
        deviceId: peer.deviceId,
        assignedIp: peer.assignedIp,
        isEnabled: peer.isEnabled,
      },
      create: peer,
    });
    peersMap[seededPeer.assignedIp] = seededPeer.id;
    console.log(`  -> Peer: IP ${seededPeer.assignedIp.padEnd(14)} Key: ${seededPeer.publicKey.substring(0, 15)}... (Enabled: ${seededPeer.isEnabled})`);
  }

  // ----------------------------------------------------
  // 6. Seed VPN Sessions & Telemetry (Table: vpn_sessions)
  // ----------------------------------------------------
  console.log('\n[6/8] Seeding VPN Sessions & Telemetry...');
  await prisma.vpnSession.deleteMany({});

  const now = Date.now();
  const sessionsData = [
    {
      peerId: peersMap['10.13.13.10/32']!, // Admin Workstation - Active Online
      connectedAt: new Date(now - 2 * 3600 * 1000), // Connected 2 hours ago
      disconnectedAt: null, // Online right now!
      clientPublicIp: '203.144.144.1',
      bytesRx: BigInt(158329472), // ~151 MB
      bytesTx: BigInt(894237184), // ~852 MB
    },
    {
      peerId: peersMap['10.13.13.20/32']!, // Staff ThinkPad - Active Online
      connectedAt: new Date(now - 45 * 60 * 1000), // Connected 45 mins ago
      disconnectedAt: null, // Online right now!
      clientPublicIp: '180.180.12.34',
      bytesRx: BigInt(54210000), // ~51 MB
      bytesTx: BigInt(124500000), // ~118 MB
    },
    {
      peerId: peersMap['10.13.13.30/32']!, // Client Dell - Past closed session
      connectedAt: new Date(now - 26 * 3600 * 1000), // 26 hours ago
      disconnectedAt: new Date(now - 22 * 3600 * 1000), // Lasted 4 hours
      clientPublicIp: '110.164.55.99',
      bytesRx: BigInt(2097152000), // ~2 GB
      bytesTx: BigInt(524288000), // ~500 MB
    },
    {
      peerId: peersMap['10.13.13.11/32']!, // Admin Laptop - Past closed session
      connectedAt: new Date(now - 72 * 3600 * 1000), // 3 days ago
      disconnectedAt: new Date(now - 70 * 3600 * 1000), // Lasted 2 hours
      clientPublicIp: '49.228.10.12',
      bytesRx: BigInt(314572800), // ~300 MB
      bytesTx: BigInt(62914560), // ~60 MB
    },
  ];

  for (const s of sessionsData) {
    const session = await prisma.vpnSession.create({ data: s });
    const status = session.disconnectedAt ? 'CLOSED' : 'ACTIVE ONLINE';
    console.log(`  -> Session: Peer ${session.peerId.substring(0, 8)} | IP: ${session.clientPublicIp.padEnd(14)} | ${status.padEnd(13)} | Rx: ${(Number(session.bytesRx) / 1024 / 1024).toFixed(1)} MB, Tx: ${(Number(session.bytesTx) / 1024 / 1024).toFixed(1)} MB`);
  }

  // ----------------------------------------------------
  // 7. Seed Security Audit Logs (Table: audit_logs)
  // ----------------------------------------------------
  console.log('\n[7/8] Seeding Security Audit Logs...');
  await prisma.auditLog.deleteMany({});

  const auditLogsData = [
    {
      userId: adminId,
      action: 'AUTH_LOGIN_SUCCESS',
      ipAddress: '203.144.144.1',
      metadataJson: { method: 'PASSWORD_AND_SMS_OTP', role: 'ADMIN', portalVersion: '0.1.0' },
      createdAt: new Date(now - 2 * 3600 * 1000 - 30000),
    },
    {
      userId: adminId,
      action: 'DEVICE_REGISTERED',
      ipAddress: '203.144.144.1',
      metadataJson: { deviceName: 'Rain-Dev-Workstation', os: 'Windows 11' },
      createdAt: new Date(now - 2 * 3600 * 1000 - 20000),
    },
    {
      userId: adminId,
      action: 'VPN_TUNNEL_ESTABLISHED',
      ipAddress: '203.144.144.1',
      metadataJson: { assignedIp: '10.13.13.10/32', endpoint: '127.0.0.1:51820', cipher: 'ChaCha20-Poly1305' },
      createdAt: new Date(now - 2 * 3600 * 1000),
    },
    {
      userId: adminId,
      action: 'POLICY_CREATED',
      ipAddress: '203.144.144.1',
      metadataJson: { role: 'STAFF', destinationCidr: '172.16.0.0/12', action: 'ALLOW' },
      createdAt: new Date(now - 90 * 60 * 1000),
    },
    {
      userId: staffId,
      action: 'AUTH_LOGIN_SUCCESS',
      ipAddress: '180.180.12.34',
      metadataJson: { method: 'PASSWORD_AND_SMS_OTP', role: 'STAFF' },
      createdAt: new Date(now - 50 * 60 * 1000),
    },
    {
      userId: staffId,
      action: 'VPN_TUNNEL_ESTABLISHED',
      ipAddress: '180.180.12.34',
      metadataJson: { assignedIp: '10.13.13.20/32', endpoint: '127.0.0.1:51820' },
      createdAt: new Date(now - 45 * 60 * 1000),
    },
    {
      userId: clientId,
      action: 'AUTH_LOGIN_FAILED',
      ipAddress: '110.164.55.99',
      metadataJson: { reason: 'INVALID_PASSWORD', attemptCount: 1 },
      createdAt: new Date(now - 27 * 3600 * 1000),
    },
    {
      userId: clientId,
      action: 'AUTH_LOGIN_SUCCESS',
      ipAddress: '110.164.55.99',
      metadataJson: { method: 'PASSWORD_AND_SMS_OTP', role: 'CLIENT' },
      createdAt: new Date(now - 26 * 3600 * 1000),
    },
    {
      userId: clientId,
      action: 'VPN_TUNNEL_DISCONNECTED',
      ipAddress: '110.164.55.99',
      metadataJson: { sessionDurationSeconds: 14400, totalBytesTransferred: 2621440000 },
      createdAt: new Date(now - 22 * 3600 * 1000),
    },
  ];

  for (const log of auditLogsData) {
    await prisma.auditLog.create({ data: log });
    console.log(`  -> AuditLog: ${log.action.padEnd(26)} by user ${log.userId ? log.userId.substring(0, 8) : 'SYSTEM'} from ${log.ipAddress}`);
  }

  // ----------------------------------------------------
  // 8. Seed Agent Versions (Table: agent_versions)
  // ----------------------------------------------------
  console.log('\n[8/8] Seeding Agent Versions...');
  const versionsData = [
    {
      versionString: '1.0.0',
      downloadUrl: 'https://downloads.mangovpn.internal/agents/mango-vpn-agent-windows-amd64.exe',
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      isMandatory: false,
    },
    {
      versionString: '1.1.0-beta',
      downloadUrl: 'https://downloads.mangovpn.internal/agents/mango-vpn-agent-windows-amd64-v1.1.0-beta.exe',
      checksumSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      isMandatory: false,
    },
  ];

  for (const v of versionsData) {
    const version = await prisma.agentVersion.upsert({
      where: { versionString: v.versionString },
      update: {
        downloadUrl: v.downloadUrl,
        checksumSha256: v.checksumSha256,
        isMandatory: v.isMandatory,
      },
      create: v,
    });
    console.log(`  -> AgentVersion: ${version.versionString} (${version.downloadUrl})`);
  }

  console.log('\n========================================================');
  console.log('--- [Rain] Seeding Completed Successfully! (8/8) ---');
  console.log('========================================================');
}

main()
  .catch((e) => {
    console.error('[Seeder Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
