import type { FastifyInstance } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  AgentVersionDto,
  AgentVersionListResponse,
  CreateAgentVersionRequest,
  UpdateAgentVersionRequest,
} from '@mango/shared';
import { writeAuditLog } from './audit.js';

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;
const SHA256_REGEX = /^[0-9a-fA-F]{64}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AgentVersionError extends Error {
  readonly statusCode: number;
  readonly code: 'AGENT_VERSION_OUTDATED' | 'AGENT_VERSION_INACTIVE' | 'AGENT_VERSION_INVALID';

  constructor(
    message: string,
    code: 'AGENT_VERSION_OUTDATED' | 'AGENT_VERSION_INACTIVE' | 'AGENT_VERSION_INVALID' = 'AGENT_VERSION_OUTDATED',
    statusCode = 426,
  ) {
    super(message);
    this.name = 'AgentVersionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function compareSemver(a: string, b: string): number {
  const matchA = SEMVER_REGEX.exec(a.trim());
  const matchB = SEMVER_REGEX.exec(b.trim());
  if (!matchA || !matchB) {
    throw new AgentVersionError(
      `Invalid agent version format: expected X.Y.Z`,
      'AGENT_VERSION_INVALID',
      400,
    );
  }
  for (let i = 1; i <= 3; i += 1) {
    const numA = Number.parseInt(matchA[i]!, 10);
    const numB = Number.parseInt(matchB[i]!, 10);
    if (numA !== numB) {
      return numA > numB ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Validates that an agent connecting with `(version, platform)` is not explicitly
 * deactivated (`isActive: false`) and meets or exceeds the highest active `isRequired`
 * version registered for that platform.
 */
export async function assertAgentVersionAllowed(
  prisma: PrismaClient,
  version: string,
  platform: string,
): Promise<void> {
  const normalizedVersion = version.trim();
  const normalizedPlatform = platform.trim();

  if (!SEMVER_REGEX.test(normalizedVersion)) {
    throw new AgentVersionError(
      `Agent version "${version}" is not a valid X.Y.Z semver string`,
      'AGENT_VERSION_INVALID',
      400,
    );
  }
  if (!normalizedPlatform) {
    throw new AgentVersionError('Agent platform is required', 'AGENT_VERSION_INVALID', 400);
  }

  const versions = await prisma.agentVersion.findMany({
    where: { platform: normalizedPlatform },
  });

  const exactMatch = versions.find((v) => v.version === normalizedVersion);
  if (exactMatch && !exactMatch.isActive) {
    throw new AgentVersionError(
      `Agent version ${normalizedVersion} for ${normalizedPlatform} has been deactivated. Please update your MANGO VPN agent.`,
      'AGENT_VERSION_INACTIVE',
      426,
    );
  }

  const requiredVersions = versions.filter((v) => v.isActive && v.isMandatory);
  if (requiredVersions.length === 0) {
    return;
  }

  let highestRequired = requiredVersions[0]!.version;
  for (const candidate of requiredVersions.slice(1)) {
    if (compareSemver(candidate.version, highestRequired) > 0) {
      highestRequired = candidate.version;
    }
  }

  if (compareSemver(normalizedVersion, highestRequired) < 0) {
    throw new AgentVersionError(
      `Agent version ${normalizedVersion} for ${normalizedPlatform} is below the minimum required version ${highestRequired}. Please upgrade before connecting.`,
      'AGENT_VERSION_OUTDATED',
      426,
    );
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toDto(row: {
  id: string;
  version: string;
  platform: string;
  downloadUrl: string;
  checksumSha256: string;
  isActive: boolean;
  isMandatory: boolean;
  releasedAt: Date;
}): AgentVersionDto {
  return {
    id: row.id,
    version: row.version,
    platform: row.platform,
    downloadUrl: row.downloadUrl,
    sha256Checksum: row.checksumSha256,
    isActive: row.isActive,
    isRequired: row.isMandatory,
    releasedAt: row.releasedAt.toISOString(),
  };
}

export function registerAgentVersionRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get('/agent-versions', async (_request, reply) => {
    const rows = await prisma.agentVersion.findMany({
      orderBy: [{ releasedAt: 'desc' }, { version: 'desc' }],
    });
    const response: AgentVersionListResponse = {
      items: rows.map(toDto),
    };
    return reply.status(200).send(response);
  });

  app.post<{ Body: CreateAgentVersionRequest }>('/agent-versions', async (request, reply) => {
    const body = request.body ?? ({} as CreateAgentVersionRequest);
    const version = typeof body.version === 'string' ? body.version.trim() : '';
    const platform = typeof body.platform === 'string' ? body.platform.trim() : '';
    const downloadUrl = typeof body.downloadUrl === 'string' ? body.downloadUrl.trim() : '';
    const sha256Checksum = typeof body.sha256Checksum === 'string' ? body.sha256Checksum.trim().toLowerCase() : '';

    if (!SEMVER_REGEX.test(version)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'version must follow X.Y.Z semver format',
      });
    }
    if (!platform) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'platform is required',
      });
    }
    if (!isValidHttpUrl(downloadUrl)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'downloadUrl must be a valid http or https URL',
      });
    }
    if (!SHA256_REGEX.test(sha256Checksum)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'sha256Checksum must be a 64-character hex string',
      });
    }

    try {
      const created = await prisma.agentVersion.create({
        data: {
          version,
          platform,
          downloadUrl,
          checksumSha256: sha256Checksum,
          isActive: body.isActive ?? true,
          isMandatory: body.isRequired ?? false,
        },
      });

      const actorUserId = (request as { authUser?: { id: string } }).authUser?.id ?? null;
      await writeAuditLog(prisma, {
        actorUserId,
        action: 'agent_version.create',
        targetType: 'AGENT_VERSION',
        targetId: created.id,
        ipAddress: request.ip,
        metadata: {
          version: created.version,
          platform: created.platform,
          isActive: created.isActive,
          isRequired: created.isMandatory,
        },
      });

      return reply.status(201).send(toDto(created));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: `Agent version ${version} for platform ${platform} already exists`,
        });
      }
      throw err;
    }
  });

  app.patch<{ Params: { id: string }; Body: UpdateAgentVersionRequest }>(
    '/agent-versions/:id',
    async (request, reply) => {
      const { id } = request.params;
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Agent version id must be a valid UUID',
        });
      }

      const existing = await prisma.agentVersion.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Agent version not found',
        });
      }

      const body = request.body ?? {};
      const data: Prisma.AgentVersionUpdateInput = {};

      if (body.downloadUrl !== undefined) {
        const downloadUrl = typeof body.downloadUrl === 'string' ? body.downloadUrl.trim() : '';
        if (!isValidHttpUrl(downloadUrl)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'downloadUrl must be a valid http or https URL',
          });
        }
        data.downloadUrl = downloadUrl;
      }

      if (body.sha256Checksum !== undefined) {
        const sha256Checksum =
          typeof body.sha256Checksum === 'string' ? body.sha256Checksum.trim().toLowerCase() : '';
        if (!SHA256_REGEX.test(sha256Checksum)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'sha256Checksum must be a 64-character hex string',
          });
        }
        data.checksumSha256 = sha256Checksum;
      }

      if (body.isActive !== undefined) {
        data.isActive = Boolean(body.isActive);
      }

      if (body.isRequired !== undefined) {
        data.isMandatory = Boolean(body.isRequired);
      }

      const updated = await prisma.agentVersion.update({
        where: { id },
        data,
      });

      const actorUserId = (request as { authUser?: { id: string } }).authUser?.id ?? null;
      await writeAuditLog(prisma, {
        actorUserId,
        action: 'agent_version.update',
        targetType: 'AGENT_VERSION',
        targetId: updated.id,
        ipAddress: request.ip,
        metadata: {
          version: updated.version,
          platform: updated.platform,
          isActive: updated.isActive,
          isRequired: updated.isMandatory,
        },
      });

      return reply.status(200).send(toDto(updated));
    },
  );
}
