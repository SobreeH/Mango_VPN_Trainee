import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedDatabase } from './seed.js';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://mango:mangosecret@localhost:15432/mangovpn_v2_test?schema=public';

describe('Database Seeder (Rain/admin/src/seed.ts)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL } },
    });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('throws if SEED_ADMIN_USERNAME is missing', async () => {
    await expect(
      seedDatabase(prisma, {
        SEED_ADMIN_PASSWORD: 'SuperSecurePassword123!',
      }),
    ).rejects.toThrow(/SEED_ADMIN_USERNAME/i);
  });

  it('throws if SEED_ADMIN_PASSWORD is missing or too short', async () => {
    await expect(
      seedDatabase(prisma, {
        SEED_ADMIN_USERNAME: 'admin',
      }),
    ).rejects.toThrow(/SEED_ADMIN_PASSWORD/i);

    await expect(
      seedDatabase(prisma, {
        SEED_ADMIN_USERNAME: 'admin',
        SEED_ADMIN_PASSWORD: 'short',
      }),
    ).rejects.toThrow(/SEED_ADMIN_PASSWORD/i);
  });

  it('provisions ADMIN, STAFF, CLIENT roles and an initial ADMIN user with hashed password', async () => {
    const result = await seedDatabase(prisma, {
      SEED_ADMIN_USERNAME: 'rootadmin',
      SEED_ADMIN_PASSWORD: 'StrongAdminPassword!99',
      SEED_ADMIN_EMAIL: 'rootadmin@mango.internal',
    });

    expect(result.roles).toEqual(
      expect.arrayContaining([RoleName.ADMIN, RoleName.STAFF, RoleName.CLIENT]),
    );
    expect(result.adminUsername).toBe('rootadmin');

    const roles = await prisma.role.findMany();
    expect(roles).toHaveLength(3);

    const admin = await prisma.user.findUnique({
      where: { username: 'rootadmin' },
      include: { role: true },
    });
    expect(admin).not.toBeNull();
    expect(admin!.email).toBe('rootadmin@mango.internal');
    expect(admin!.role.name).toBe(RoleName.ADMIN);
    expect(admin!.isActive).toBe(true);
    expect(admin!.totpEnabled).toBe(false);
    expect(await bcrypt.compare('StrongAdminPassword!99', admin!.passwordHash)).toBe(true);

    // Idempotent second run
    await seedDatabase(prisma, {
      SEED_ADMIN_USERNAME: 'rootadmin',
      SEED_ADMIN_PASSWORD: 'StrongAdminPassword!99',
      SEED_ADMIN_EMAIL: 'rootadmin@mango.internal',
    });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.role.count()).toBe(3);
  });
});
