import type { FastifyInstance } from 'fastify';
import {
  PolicyAction as PrismaPolicyAction,
  PolicyProtocol as PrismaPolicyProtocol,
  RoleName as PrismaRoleName,
  SessionStatus,
  type PrismaClient,
} from '@prisma/client';
import {
  PolicyAction,
  PolicyProtocol,
  RoleName,
  type CreateVpnPolicyRequest,
  type DaemonPolicyRule,
  type DaemonSyncPoliciesRequest,
  type DeletePolicyResponse,
  type VpnPolicyDto,
  type VpnPolicyListResponse,
} from '@mango/shared';
import { writeAuditLog } from './audit.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IPV4_CIDR_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

function toSharedRole(role: PrismaRoleName): RoleName {
  switch (role) {
    case PrismaRoleName.ADMIN:
      return RoleName.ADMIN;
    case PrismaRoleName.STAFF:
      return RoleName.STAFF;
    case PrismaRoleName.CLIENT:
    default:
      return RoleName.CLIENT;
  }
}

function toSharedProtocol(protocol: PrismaPolicyProtocol): PolicyProtocol {
  switch (protocol) {
    case PrismaPolicyProtocol.TCP:
      return PolicyProtocol.TCP;
    case PrismaPolicyProtocol.UDP:
      return PolicyProtocol.UDP;
    case PrismaPolicyProtocol.ICMP:
      return PolicyProtocol.ICMP;
    case PrismaPolicyProtocol.ANY:
    default:
      return PolicyProtocol.ANY;
  }
}

function toSharedAction(action: PrismaPolicyAction): PolicyAction {
  return action === PrismaPolicyAction.ALLOW ? PolicyAction.ALLOW : PolicyAction.DENY;
}

function isValidIpv4Cidr(raw: string): boolean {
  const match = IPV4_CIDR_REGEX.exec(raw.trim());
  if (!match) return false;
  for (let i = 1; i <= 4; i += 1) {
    const octet = Number.parseInt(match[i]!, 10);
    if (octet < 0 || octet > 255) return false;
  }
  const prefix = Number.parseInt(match[5]!, 10);
  return prefix >= 0 && prefix <= 32;
}

function validatePortRange(raw: string | null | undefined, protocol: PolicyProtocol): string | null | Error {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return null;
  }
  if (protocol !== PolicyProtocol.TCP && protocol !== PolicyProtocol.UDP) {
    return new Error('portRange is only supported for TCP or UDP protocols');
  }
  const trimmed = raw.trim();
  const parts = trimmed.split('-');
  if (parts.length > 2) {
    return new Error('portRange must be a single port or start-end range');
  }
  const parsePort = (part: string): number | null => {
    if (!/^\d{1,5}$/.test(part.trim())) return null;
    const n = Number.parseInt(part.trim(), 10);
    return n >= 1 && n <= 65535 ? n : null;
  };
  const start = parsePort(parts[0]!);
  if (start === null) {
    return new Error('portRange must contain valid ports between 1 and 65535');
  }
  if (parts.length === 2) {
    const end = parsePort(parts[1]!);
    if (end === null || start > end) {
      return new Error('portRange must be a valid ascending range (start <= end)');
    }
    return `${start}-${end}`;
  }
  return String(start);
}

export async function buildDaemonPolicySyncPayload(
  prisma: PrismaClient,
): Promise<DaemonSyncPoliciesRequest> {
  const [activeSessions, enabledPolicies] = await Promise.all([
    prisma.vpnSession.findMany({
      where: { status: SessionStatus.ACTIVE },
      include: {
        peer: true,
        user: { include: { role: true } },
      },
    }),
    prisma.vpnPolicy.findMany({
      where: { enabled: true },
      include: { role: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  const rulesByRole = new Map<RoleName, DaemonPolicyRule[]>();
  for (const policy of enabledPolicies) {
    const role = toSharedRole(policy.role.name);
    const list = rulesByRole.get(role) ?? [];
    list.push({
      targetCidr: policy.targetCidr,
      protocol: toSharedProtocol(policy.protocol),
      portRange: policy.portRange,
      action: toSharedAction(policy.action),
      priority: policy.priority,
    });
    rulesByRole.set(role, list);
  }

  return {
    peers: activeSessions.map((session) => {
      const role = toSharedRole(session.user.role.name);
      return {
        publicKey: session.peer.publicKey,
        assignedIp: session.assignedIp,
        role,
        policies: rulesByRole.get(role) ?? [],
      };
    }),
  };
}

export function registerPolicyRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  syncPolicies?: (req: DaemonSyncPoliciesRequest) => Promise<void>,
): void {
  app.get('/policies', async (_request, reply) => {
    const rows = await prisma.vpnPolicy.findMany({
      include: { role: true },
      orderBy: [{ role: { name: 'asc' } }, { priority: 'asc' }, { createdAt: 'asc' }],
    });

    const items: VpnPolicyDto[] = rows.map((row) => ({
      id: row.id,
      role: toSharedRole(row.role.name),
      name: row.name,
      targetCidr: row.targetCidr,
      protocol: toSharedProtocol(row.protocol),
      portRange: row.portRange,
      action: toSharedAction(row.action),
      priority: row.priority,
      enabled: row.enabled,
    }));

    const response: VpnPolicyListResponse = { items };
    return reply.status(200).send(response);
  });

  app.post<{ Body: Partial<CreateVpnPolicyRequest> }>('/policies', async (request, reply) => {
    const body = request.body ?? {};
    const roleInput = typeof body.role === 'string' ? body.role.trim().toUpperCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const targetCidr = typeof body.targetCidr === 'string' ? body.targetCidr.trim() : '';
    const protocolInput = typeof body.protocol === 'string' ? body.protocol.trim().toUpperCase() : '';
    const actionInput = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';
    const priority = body.priority ?? 100;
    const enabled = body.enabled ?? true;

    if (!Object.values(RoleName).includes(roleInput as RoleName)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'role must be ADMIN, STAFF, or CLIENT',
      });
    }
    if (!name) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'name is required',
      });
    }
    if (!isValidIpv4Cidr(targetCidr)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'targetCidr must be a valid IPv4 CIDR (e.g. 10.0.0.0/8)',
      });
    }
    if (!Object.values(PolicyProtocol).includes(protocolInput as PolicyProtocol)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'protocol must be ANY, TCP, UDP, or ICMP',
      });
    }
    if (!Object.values(PolicyAction).includes(actionInput as PolicyAction)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'action must be ALLOW or DENY',
      });
    }
    if (!Number.isInteger(priority) || priority < 0 || priority > 100000) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'priority must be an integer between 0 and 100000',
      });
    }

    const portResult = validatePortRange(body.portRange, protocolInput as PolicyProtocol);
    if (portResult instanceof Error) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: portResult.message,
      });
    }

    const roleRecord = await prisma.role.findUnique({
      where: { name: roleInput as PrismaRoleName },
    });
    if (!roleRecord) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Role ${roleInput} does not exist`,
      });
    }

    const actorUserId = (request as { authUser?: { id?: string } }).authUser?.id ?? null;

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.vpnPolicy.create({
        data: {
          roleId: roleRecord.id,
          name,
          targetCidr,
          protocol: protocolInput as PrismaPolicyProtocol,
          portRange: portResult,
          action: actionInput as PrismaPolicyAction,
          priority,
          enabled,
        },
        include: { role: true },
      });

      await writeAuditLog(tx, {
        actorUserId,
        action: 'POLICY_CREATED',
        targetType: 'VpnPolicy',
        targetId: row.id,
        ipAddress: request.ip,
        metadata: {
          role: roleInput,
          name,
          targetCidr,
          protocol: protocolInput,
          portRange: portResult,
          action: actionInput,
          priority,
          enabled,
        },
      });

      return row;
    });

    if (syncPolicies) {
      try {
        const payload = await buildDaemonPolicySyncPayload(prisma);
        await syncPolicies(payload);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'VPN daemon policy sync failed';
        return reply.status(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message: `Policy saved but VPN daemon sync failed: ${reason}`,
        });
      }
    }

    const dto: VpnPolicyDto = {
      id: created.id,
      role: toSharedRole(created.role.name),
      name: created.name,
      targetCidr: created.targetCidr,
      protocol: toSharedProtocol(created.protocol),
      portRange: created.portRange,
      action: toSharedAction(created.action),
      priority: created.priority,
      enabled: created.enabled,
    };

    return reply.status(201).send(dto);
  });

  app.delete<{ Params: { id: string } }>('/policies/:id', async (request, reply) => {
    const { id } = request.params;
    if (!UUID_REGEX.test(id)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'id must be a valid UUID',
      });
    }

    const existing = await prisma.vpnPolicy.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Policy not found',
      });
    }

    const actorUserId = (request as { authUser?: { id?: string } }).authUser?.id ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.vpnPolicy.delete({ where: { id } });
      await writeAuditLog(tx, {
        actorUserId,
        action: 'POLICY_DELETED',
        targetType: 'VpnPolicy',
        targetId: id,
        ipAddress: request.ip,
        metadata: {
          role: existing.role.name,
          name: existing.name,
          targetCidr: existing.targetCidr,
          action: existing.action,
        },
      });
    });

    if (syncPolicies) {
      try {
        const payload = await buildDaemonPolicySyncPayload(prisma);
        await syncPolicies(payload);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'VPN daemon policy sync failed';
        return reply.status(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message: `Policy deleted but VPN daemon sync failed: ${reason}`,
        });
      }
    }

    const result: DeletePolicyResponse = { success: true, id };
    return reply.status(200).send(result);
  });
}
