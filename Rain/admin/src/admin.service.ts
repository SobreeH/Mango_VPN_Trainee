import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DeviceDto, VpnSessionDto, AuditLogDto, AgentVersionDto, VpnPolicyDto } from '@mango/shared';

const prisma = new PrismaClient();

export interface CreateUserDto {
  username: string;
  password?: string;
  phoneNumber: string;
  roleName: 'ADMIN' | 'STAFF' | 'CLIENT';
}

export interface UserDto {
  id: string;
  username: string;
  phoneNumber: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

export class AdminService {
  async createUser(data: CreateUserDto): Promise<UserDto> {
    const role = await prisma.role.findUnique({ where: { name: data.roleName } });
    if (!role) {
      throw new Error(`Role ${data.roleName} not found`);
    }

    const password = data.password || 'MangoVPN2026!';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        phoneNumber: data.phoneNumber,
        roleId: role.id,
        isActive: true,
      },
      include: { role: true },
    });

    return {
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      roleName: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    };
  }
  async getUsers(): Promise<UserDto[]> {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });

    return users.map(u => ({
      id: u.id,
      username: u.username,
      phoneNumber: u.phoneNumber,
      roleName: u.role.name,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async getPolicies(): Promise<VpnPolicyDto[]> {
    const policies = await prisma.vpnPolicy.findMany({
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });

    return policies.map(p => ({
      id: p.id,
      roleId: p.roleId,
      roleName: p.role?.name,
      destinationCidr: p.destinationCidr,
      protocol: p.protocol as any,
      portRange: p.portRange,
      action: p.action as any,
    }));
  }
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

  async revokeDevice(deviceId: string): Promise<boolean> {
    const existing = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!existing) {
      throw new Error('Device not found');
    }
    await prisma.device.delete({ where: { id: deviceId } });
    return true;
  }
}

