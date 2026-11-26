import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PolicyAction, PolicyProtocol, PrismaClient, RoleName } from '@prisma/client';

function loadEnvFileIfPresent(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const line = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

type PolicySeed = { role: RoleName; name: string; targetCidr: string; protocol: PolicyProtocol; portRange: string | null; action: PolicyAction; priority: number };
const policies: PolicySeed[] = [
  { role: RoleName.ADMIN, name: 'Track B: Admin Zone (HTTP/HTTPS)', targetCidr: '10.99.0.0/24', protocol: PolicyProtocol.ANY, portRange: null, action: PolicyAction.ALLOW, priority: 10 },
  { role: RoleName.ADMIN, name: 'Track B: Staff Zone (HTTP/HTTPS)', targetCidr: '10.20.0.0/16', protocol: PolicyProtocol.ANY, portRange: null, action: PolicyAction.ALLOW, priority: 20 },
  { role: RoleName.ADMIN, name: 'Track B: Client Zone (HTTP/HTTPS)', targetCidr: '10.30.0.0/24', protocol: PolicyProtocol.ANY, portRange: null, action: PolicyAction.ALLOW, priority: 30 },
  { role: RoleName.STAFF, name: 'Track B: Deny Admin Zone', targetCidr: '10.99.0.0/24', protocol: PolicyProtocol.ANY, portRange: null, action: PolicyAction.DENY, priority: 50 },
  { role: RoleName.STAFF, name: 'Track B: Allow Staff Web (HTTP)', targetCidr: '10.20.0.0/16', protocol: PolicyProtocol.TCP, portRange: '80', action: PolicyAction.ALLOW, priority: 100 },
  { role: RoleName.STAFF, name: 'Allow Internal Web', targetCidr: '10.20.0.0/16', protocol: PolicyProtocol.TCP, portRange: '443', action: PolicyAction.ALLOW, priority: 101 },
  { role: RoleName.STAFF, name: 'Track B: Allow Client Zone (HTTP)', targetCidr: '10.30.0.0/24', protocol: PolicyProtocol.TCP, portRange: '80', action: PolicyAction.ALLOW, priority: 110 },
  { role: RoleName.STAFF, name: 'Track B: Allow Client Zone (HTTPS)', targetCidr: '10.30.0.0/24', protocol: PolicyProtocol.TCP, portRange: '443', action: PolicyAction.ALLOW, priority: 111 },
  { role: RoleName.CLIENT, name: 'Block Admin Subnet', targetCidr: '10.99.0.0/24', protocol: PolicyProtocol.ANY, portRange: null, action: PolicyAction.DENY, priority: 50 },
  { role: RoleName.CLIENT, name: 'Track B: Deny Staff Zone', targetCidr: '10.20.0.0/16', protocol: PolicyProtocol.ANY, portRange: null, action: PolicyAction.DENY, priority: 60 },
  { role: RoleName.CLIENT, name: 'Track B: Allow Client Zone (HTTP)', targetCidr: '10.30.0.0/24', protocol: PolicyProtocol.TCP, portRange: '80', action: PolicyAction.ALLOW, priority: 100 },
  { role: RoleName.CLIENT, name: 'Track B: Allow Client Zone (HTTPS)', targetCidr: '10.30.0.0/24', protocol: PolicyProtocol.TCP, portRange: '443', action: PolicyAction.ALLOW, priority: 101 },
];

export async function seedTestTargetPolicies(prisma: PrismaClient): Promise<void> {
  const roles = new Map<RoleName, { id: string }>();
  for (const name of [RoleName.ADMIN, RoleName.STAFF, RoleName.CLIENT]) {
    const role = await prisma.role.findFirst({ where: { name } });
    if (!role) throw new Error(`Missing ${name} role. Run npm run db:seed first.`);
    roles.set(name, role);
  }
  for (const policy of policies) {
    const roleId = roles.get(policy.role)!.id;
    const data = { roleId, name: policy.name, targetCidr: policy.targetCidr, protocol: policy.protocol, portRange: policy.portRange, action: policy.action, priority: policy.priority, enabled: true };
    const existing = await prisma.vpnPolicy.findFirst({ where: { roleId, name: policy.name } });
    if (existing) await prisma.vpnPolicy.update({ where: { id: existing.id }, data });
    else await prisma.vpnPolicy.create({ data });
  }
}

async function main() {
  loadEnvFileIfPresent(path.resolve(process.cwd(), '.env'));
  loadEnvFileIfPresent(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env'));
  const prisma = new PrismaClient();
  try { await seedTestTargetPolicies(prisma); console.log(`Seeded ${policies.length} Track B VPN policies.`); } finally { await prisma.$disconnect(); }
}
const isEntrypoint = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) main().catch((err) => { console.error('Track B policy seed failed:', err instanceof Error ? err.message : err); process.exit(1); });
