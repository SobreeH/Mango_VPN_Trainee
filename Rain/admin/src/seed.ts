import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- [Rain] Seeding MANGO VPN Database ---');

  // 1. Seed Roles
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
    console.log(`[Role] Seeded: ${role.name} (${role.id})`);
  }

  // 2. Seed Role-Based VPN Policies (Firewall Rules)
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
  ];

  for (const p of policiesData) {
    await prisma.vpnPolicy.create({
      data: p,
    });
    console.log(`[Policy] Seeded rule for Role ${p.roleId}: ${p.protocol} ${p.destinationCidr}:${p.portRange} -> ${p.action}`);
  }

  // 3. Seed Users with default password "MangoVPN2026!"
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
    console.log(`[User] Seeded: ${user.username} (${user.phoneNumber}) with password: MangoVPN2026!`);
  }

  // 4. Seed Initial Agent Version
  await prisma.agentVersion.upsert({
    where: { versionString: '1.0.0' },
    update: {},
    create: {
      versionString: '1.0.0',
      downloadUrl: 'https://downloads.mangovpn.internal/agents/mango-vpn-agent-windows-amd64.exe',
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      isMandatory: false,
    },
  });
  console.log('[AgentVersion] Seeded: 1.0.0');

  console.log('--- [Rain] Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

