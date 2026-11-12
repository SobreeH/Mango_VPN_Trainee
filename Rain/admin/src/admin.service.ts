import { PrismaClient } from '@prisma/client';
import { DeviceDto, VpnSessionDto, AuditLogDto, AgentVersionDto } from '@mango/shared';

const prisma = new PrismaClient();

export class AdminService {
  async getDevices(userId: string, isAdmin: boolean): Promise<DeviceDto[]> {
    const devices = await prisma.device.findMany({
      where: isAdmin ? {} : { userId },
      orderBy: { lastSeen: 'desc' },
      take: 50,
    });

    return devices.map(d => ({
      id: d.id,
      userId: d.userId,
      deviceName: d.deviceName,
      osInfo: d.osInfo,
      macAddress: d.macAddress,
      lastSeen: d.lastSeen.toISOString(),
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async getSessions(userId: string, isAdmin: boolean): Promise<VpnSessionDto[]> {
    const sessions = await prisma.vpnSession.findMany({
      where: isAdmin ? {} : { peer: { userId } },
      orderBy: { connectedAt: 'desc' },
      take: 50,
    });

    return sessions.map(s => ({
      id: s.id,
      peerId: s.peerId,
      connectedAt: s.connectedAt.toISOString(),
      disconnectedAt: s.disconnectedAt ? s.disconnectedAt.toISOString() : null,
      clientPublicIp: s.clientPublicIp,
      bytesRx: Number(s.bytesRx),
      bytesTx: Number(s.bytesTx),
      durationSeconds: s.disconnectedAt
        ? Math.floor((s.disconnectedAt.getTime() - s.connectedAt.getTime()) / 1000)
        : Math.floor((Date.now() - s.connectedAt.getTime()) / 1000),
    }));
  }

  async getAuditLogs(): Promise<AuditLogDto[]> {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return logs.map(l => ({
      id: l.id,
      userId: l.userId,
      action: l.action,
      metadataJson: (l.metadataJson as Record<string, unknown>) || null,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async getAgentVersions(): Promise<AgentVersionDto[]> {
    const versions = await prisma.agentVersion.findMany({
      orderBy: { releasedAt: 'desc' },
    });

    return versions.map(v => ({
      id: v.id,
      versionString: v.versionString,
      downloadUrl: v.downloadUrl,
      checksumSha256: v.checksumSha256,
      isMandatory: v.isMandatory,
      releasedAt: v.releasedAt.toISOString(),
    }));
  }
}

