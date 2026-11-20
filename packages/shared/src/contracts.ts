export enum RoleName {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CLIENT = 'CLIENT',
}

export enum DeviceStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  PENDING = 'PENDING',
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  DISCONNECTED = 'DISCONNECTED',
  EXPIRED = 'EXPIRED',
}

export enum PolicyAction {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export enum PolicyProtocol {
  ANY = 'ANY',
  TCP = 'TCP',
  UDP = 'UDP',
  ICMP = 'ICMP',
}

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}

export interface UserDto {
  id: string;
  username: string;
  email: string;
  role: RoleName;
  isActive: boolean;
  totpEnabled: boolean;
  createdAt: string;
}

export interface DeviceDto {
  id: string;
  userId: string;
  hostname: string;
  fingerprint: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface VpnSessionDto {
  id: string;
  userId: string;
  deviceId: string;
  assignedIp: string;
  status: SessionStatus;
  connectedAt: string;
  disconnectedAt: string | null;
}

export interface VpnPolicyDto {
  id: string;
  role: RoleName;
  name: string;
  targetCidr: string;
  protocol: PolicyProtocol;
  portRange: string | null;
  action: PolicyAction;
  priority: number;
  enabled: boolean;
}

export interface AuditLogDto {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentVersionDto {
  id: string;
  version: string;
  platform: string;
  checksumSha256: string;
  downloadUrl: string;
  isMandatory: boolean;
  releasedAt: string;
}
