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

export interface CreatePolicyDto {
  roleName: 'ADMIN' | 'STAFF' | 'CLIENT';
  destinationCidr: string;
  protocol: 'ALL' | 'TCP' | 'UDP' | 'ICMP';
  portRange: string;
  action: 'ALLOW' | 'DENY';
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

  async createPolicy(data: CreatePolicyDto): Promise<VpnPolicyDto> {
    const role = await prisma.role.findUnique({ where: { name: data.roleName } });
    if (!role) {
      throw new Error(`Role ${data.roleName} not found`);
    }

    const policy = await prisma.vpnPolicy.create({
      data: {
        roleId: role.id,
        destinationCidr: data.destinationCidr,
        protocol: data.protocol,
        portRange: data.portRange,
        action: data.action,
      },
      include: { role: true },
    });

    return {
      id: policy.id,
      roleId: policy.roleId,
      roleName: policy.role?.name,
      destinationCidr: policy.destinationCidr,
      protocol: policy.protocol as any,
      portRange: policy.portRange,
      action: policy.action as any,
    };
  }

  async updatePolicy(policyId: string, data: Partial<CreatePolicyDto>, adminUserId?: string): Promise<VpnPolicyDto> {
    const existing = await prisma.vpnPolicy.findUnique({
      where: { id: policyId },
      include: { role: true },
    });

    if (!existing) {
      throw new Error('Policy not found');
    }

    let roleId = existing.roleId;
    if (data.roleName && data.roleName !== existing.role.name) {
      const role = await prisma.role.findUnique({ where: { name: data.roleName } });
      if (!role) {
        throw new Error(`Role ${data.roleName} not found`);
      }
      roleId = role.id;
    }

    const updated = await prisma.vpnPolicy.update({
      where: { id: policyId },
      data: {
        roleId,
        destinationCidr: data.destinationCidr ?? existing.destinationCidr,
        protocol: data.protocol ?? existing.protocol,
        portRange: data.portRange ?? existing.portRange,
        action: data.action ?? existing.action,
      },
      include: { role: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'VPN_POLICY_UPDATED',
        ipAddress: '127.0.0.1',
        metadataJson: {
          policyId: updated.id,
          role: updated.role.name,
          destinationCidr: updated.destinationCidr,
          protocol: updated.protocol,
          portRange: updated.portRange,
          action: updated.action,
        },
      },
    });

    return {
      id: updated.id,
      roleId: updated.roleId,
      roleName: updated.role?.name,
      destinationCidr: updated.destinationCidr,
      protocol: updated.protocol as any,
      portRange: updated.portRange,
      action: updated.action as any,
    };
  }

  async deletePolicy(policyId: string): Promise<boolean> {
    const existing = await prisma.vpnPolicy.findUnique({ where: { id: policyId } });
    if (!existing) {
      throw new Error('Policy not found');
    }
    await prisma.vpnPolicy.delete({ where: { id: policyId } });
    return true;
  }

  async disconnectSession(sessionId: string, adminUserId?: string): Promise<boolean> {
    const session = await prisma.vpnSession.findUnique({
      where: { id: sessionId },
      include: {
        peer: {
          include: {
            user: true,
            device: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.disconnectedAt) {
      return true; // Already disconnected
    }

    // Mark session as disconnected
    await prisma.vpnSession.update({
      where: { id: sessionId },
      data: { disconnectedAt: new Date() },
    });

    // Write immutable security audit log
    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'VPN_SESSION_DISCONNECTED',
        ipAddress: session.clientPublicIp,
        metadataJson: {
          sessionId: session.id,
          peerId: session.peerId,
          targetUsername: session.peer?.user?.username,
          deviceName: session.peer?.device?.deviceName,
          assignedIp: session.peer?.assignedIp,
          terminatedBy: 'ADMIN_KICK',
          bytesRx: Number(session.bytesRx),
          bytesTx: Number(session.bytesTx),
        },
      },
    });

    return true;
  }

  async toggleUserStatus(userId: string, adminUserId?: string): Promise<UserDto> {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !existing.isActive },
      include: { role: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'USER_STATUS_UPDATED',
        ipAddress: '127.0.0.1',
        metadataJson: {
          targetUserId: updated.id,
          targetUsername: updated.username,
          previousStatus: existing.isActive,
          newStatus: updated.isActive,
          statusLabel: updated.isActive ? 'ACTIVE' : 'SUSPENDED',
        },
      },
    });

    return {
      id: updated.id,
      username: updated.username,
      phoneNumber: updated.phoneNumber,
      roleName: updated.role.name,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deleteUser(userId: string, adminUserId?: string): Promise<boolean> {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'USER_DELETED',
        ipAddress: '127.0.0.1',
        metadataJson: {
          deletedUserId: existing.id,
          deletedUsername: existing.username,
          role: existing.role.name,
        },
      },
    });

    await prisma.user.delete({
      where: { id: userId },
    });

    return true;
  }
}

