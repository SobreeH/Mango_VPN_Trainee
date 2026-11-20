import { pathToFileURL } from 'node:url';
import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const MIN_ADMIN_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 10;

const DEFAULT_ROLES: Array<{ name: RoleName; description: string }> = [
  { name: RoleName.ADMIN, description: 'Full administrative access to MANGO VPN' },
  { name: RoleName.STAFF, description: 'Staff VPN access to internal resources' },
  { name: RoleName.CLIENT, description: 'Restricted client VPN access' },
];

export interface SeedResult {
  roles: RoleName[];
  adminUsername: string;
}

/**
 * Seeds the baseline RBAC roles (ADMIN, STAFF, CLIENT) and an initial ADMIN user
 * using credentials supplied via environment variables.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SeedResult> {
  const username = env.SEED_ADMIN_USERNAME?.trim();
  if (!username) {
    throw new Error('Missing required environment variable: SEED_ADMIN_USERNAME');
  }

  const password = env.SEED_ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error('Missing required environment variable: SEED_ADMIN_PASSWORD');
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `Environment variable SEED_ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long`,
    );
  }

  const email = env.SEED_ADMIN_EMAIL?.trim() || `${username}@mangovpn.local`;

  const roleRecords = await Promise.all(
    DEFAULT_ROLES.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description },
        create: { name: role.name, description: role.description },
      }),
    ),
  );

  const adminRole = roleRecords.find((r) => r.name === RoleName.ADMIN);
  if (!adminRole) {
    throw new Error('Failed to provision ADMIN role');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { username },
    update: {
      email,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
    create: {
      username,
      email,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  return {
    roles: roleRecords.map((r) => r.name),
    adminUsername: username,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await seedDatabase(prisma, process.env);
    console.log(
      `Seeded roles [${result.roles.join(', ')}] and ADMIN user "${result.adminUsername}".`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error('Database seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
