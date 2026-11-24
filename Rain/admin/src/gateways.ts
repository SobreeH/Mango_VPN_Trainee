import type { FastifyInstance } from 'fastify';
import {
  GatewayIpamMode as PrismaGatewayIpamMode,
  Prisma,
  RoleName as PrismaRoleName,
  VpnProviderType as PrismaVpnProviderType,
  type PrismaClient,
} from '@prisma/client';
import {
  GatewayIpamMode,
  RoleName,
  VpnProviderType,
  type CreateVpnGatewayRequest,
  type DeleteGatewayResponse,
  type UpdateVpnGatewayRequest,
  type VpnGatewayDto,
  type VpnGatewayListResponse,
} from '@mango/shared';
import { writeAuditLog } from './audit.js';
import { UUID_REGEX } from './revocation.js';

const IPV4_CIDR_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

function isValidIpv4Cidr(raw: string): boolean {
  const match = IPV4_CIDR_REGEX.exec(raw.trim());
  if (!match) return false;
  for (let i = 1; i <= 4; i += 1) {
    const octet = Number.parseInt(match[i]!, 10);
    if (octet < 0 || octet > 255) return false;
  }
  const prefix = Number.parseInt(match[5]!, 10);
  return prefix >= 8 && prefix <= 30;
}

export function toGatewayDto(row: {
  id: string;
  name: string;
  providerType: PrismaVpnProviderType;
  endpoint: string;
  subnetCidr: string;
  ipamMode: PrismaGatewayIpamMode;
  dns: string[];
  allowedRoles: PrismaRoleName[];
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): VpnGatewayDto {
  return {
    id: row.id,
    name: row.name,
    providerType: row.providerType as VpnProviderType,
    endpoint: row.endpoint,
    subnetCidr: row.subnetCidr,
    ipamMode: row.ipamMode as GatewayIpamMode,
    dns: [...row.dns],
    allowedRoles: row.allowedRoles.map((r) => r as RoleName),
    isDefault: row.isDefault,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseAllowedRoles(input: unknown): RoleName[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const valid = new Set<string>(Object.values(RoleName));
  const roles: RoleName[] = [];
  for (const item of input) {
    const norm = String(item).trim().toUpperCase();
    if (!valid.has(norm)) return null;
    if (!roles.includes(norm as RoleName)) roles.push(norm as RoleName);
  }
  return roles;
}

export function registerGatewayRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/gateways', async (_request, reply) => {
    const rows = await prisma.vpnGateway.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    const response: VpnGatewayListResponse = {
      items: rows.map(toGatewayDto),
    };
    return reply.status(200).send(response);
  });

  app.post<{ Body: Partial<CreateVpnGatewayRequest> }>('/gateways', async (request, reply) => {
    const body = request.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const providerInput = typeof body.providerType === 'string' ? body.providerType.trim().toUpperCase() : '';
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    const subnetCidr = typeof body.subnetCidr === 'string' && body.subnetCidr.trim()
      ? body.subnetCidr.trim()
      : '10.13.13.0/24';
    const ipamInput = typeof body.ipamMode === 'string' && body.ipamMode.trim()
      ? body.ipamMode.trim().toUpperCase()
      : GatewayIpamMode.API_MANAGED;
    const dns = Array.isArray(body.dns)
      ? body.dns.map((d) => String(d).trim()).filter(Boolean)
      : ['1.1.1.1'];
    const allowedRoles = body.allowedRoles === undefined
      ? [RoleName.ADMIN, RoleName.STAFF, RoleName.CLIENT]
      : parseAllowedRoles(body.allowedRoles);
    const isDefault = Boolean(body.isDefault ?? false);
    const isEnabled = body.isEnabled ?? true;

    if (!name || name.length < 2 || name.length > 100) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'name must be between 2 and 100 characters',
      });
    }
    if (!Object.values(VpnProviderType).includes(providerInput as VpnProviderType)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'providerType must be WIREGUARD, FORTINET, or CISCO',
      });
    }
    if (!endpoint) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'endpoint is required',
      });
    }
    if (!isValidIpv4Cidr(subnetCidr)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'subnetCidr must be a valid IPv4 CIDR between /8 and /30',
      });
    }
    if (!Object.values(GatewayIpamMode).includes(ipamInput as GatewayIpamMode)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'ipamMode must be API_MANAGED or GATEWAY_ASSIGNED',
      });
    }
    if (!allowedRoles) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'allowedRoles must be a non-empty list of ADMIN, STAFF, or CLIENT',
      });
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.vpnGateway.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
          });
        }

        const row = await tx.vpnGateway.create({
          data: {
            name,
            providerType: providerInput as PrismaVpnProviderType,
            endpoint,
            subnetCidr,
            ipamMode: ipamInput as PrismaGatewayIpamMode,
            dns: dns.length > 0 ? dns : ['1.1.1.1'],
            allowedRoles: allowedRoles as PrismaRoleName[],
            isDefault,
            isEnabled,
          },
        });

        await writeAuditLog(tx, {
          actorUserId: request.authUser?.id ?? null,
          action: 'GATEWAY_CREATED',
          targetType: 'VpnGateway',
          targetId: row.id,
          ipAddress: request.ip,
          metadata: {
            name: row.name,
            providerType: row.providerType,
            endpoint: row.endpoint,
            subnetCidr: row.subnetCidr,
          },
        });

        return row;
      });

      return reply.status(201).send(toGatewayDto(created));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'A gateway with that name already exists',
        });
      }
      throw err;
    }
  });

  app.patch<{ Params: { id: string }; Body: Partial<UpdateVpnGatewayRequest> }>(
    '/gateways/:id',
    async (request, reply) => {
      const { id } = request.params;
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid gateway id',
        });
      }

      const existing = await prisma.vpnGateway.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'VPN gateway not found',
        });
      }

      const body = request.body ?? {};
      const data: Prisma.VpnGatewayUpdateInput = {};

      if (body.name !== undefined) {
        const name = body.name.trim();
        if (!name || name.length < 2 || name.length > 100) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'name must be between 2 and 100 characters',
          });
        }
        data.name = name;
      }
      if (body.providerType !== undefined) {
        const provider = String(body.providerType).trim().toUpperCase();
        if (!Object.values(VpnProviderType).includes(provider as VpnProviderType)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'providerType must be WIREGUARD, FORTINET, or CISCO',
          });
        }
        data.providerType = provider as PrismaVpnProviderType;
      }
      if (body.endpoint !== undefined) {
        const endpoint = body.endpoint.trim();
        if (!endpoint) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'endpoint cannot be empty',
          });
        }
        data.endpoint = endpoint;
      }
      if (body.subnetCidr !== undefined) {
        const cidr = body.subnetCidr.trim();
        if (!isValidIpv4Cidr(cidr)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'subnetCidr must be a valid IPv4 CIDR between /8 and /30',
          });
        }
        data.subnetCidr = cidr;
      }
      if (body.ipamMode !== undefined) {
        const mode = String(body.ipamMode).trim().toUpperCase();
        if (!Object.values(GatewayIpamMode).includes(mode as GatewayIpamMode)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'ipamMode must be API_MANAGED or GATEWAY_ASSIGNED',
          });
        }
        data.ipamMode = mode as PrismaGatewayIpamMode;
      }
      if (body.dns !== undefined) {
        data.dns = body.dns.map((d) => String(d).trim()).filter(Boolean);
      }
      if (body.allowedRoles !== undefined) {
        const parsedRoles = parseAllowedRoles(body.allowedRoles);
        if (!parsedRoles) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'allowedRoles must be a non-empty list of ADMIN, STAFF, or CLIENT',
          });
        }
        data.allowedRoles = parsedRoles as PrismaRoleName[];
      }
      if (body.isDefault !== undefined) {
        data.isDefault = Boolean(body.isDefault);
      }
      if (body.isEnabled !== undefined) {
        data.isEnabled = Boolean(body.isEnabled);
      }

      try {
        const updated = await prisma.$transaction(async (tx) => {
          if (body.isDefault === true) {
            await tx.vpnGateway.updateMany({
              where: { isDefault: true, id: { not: id } },
              data: { isDefault: false },
            });
          }

          const row = await tx.vpnGateway.update({
            where: { id },
            data,
          });

          await writeAuditLog(tx, {
            actorUserId: request.authUser?.id ?? null,
            action: 'GATEWAY_UPDATED',
            targetType: 'VpnGateway',
            targetId: id,
            ipAddress: request.ip,
            metadata: {
              name: row.name,
              providerType: row.providerType,
              isEnabled: row.isEnabled,
              isDefault: row.isDefault,
            },
          });

          return row;
        });

        return reply.status(200).send(toGatewayDto(updated));
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A gateway with that name already exists',
          });
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/gateways/:id', async (request, reply) => {
    const { id } = request.params;
    if (!UUID_REGEX.test(id)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid gateway id',
      });
    }

    const existing = await prisma.vpnGateway.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'VPN gateway not found',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.vpnGateway.delete({ where: { id } });
      await writeAuditLog(tx, {
        actorUserId: request.authUser?.id ?? null,
        action: 'GATEWAY_DELETED',
        targetType: 'VpnGateway',
        targetId: id,
        ipAddress: request.ip,
        metadata: {
          name: existing.name,
          providerType: existing.providerType,
        },
      });
    });

    const result: DeleteGatewayResponse = { success: true, id };
    return reply.status(200).send(result);
  });
}
