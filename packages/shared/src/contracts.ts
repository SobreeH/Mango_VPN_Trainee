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

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: RoleName;
  isActive?: boolean;
}

export interface UpdateUserStatusRequest {
  isActive: boolean;
}

export interface UserListResponse {
  items: UserDto[];
}

export interface DeviceDto {
  id: string;
  userId: string;
  username?: string;
  hostname: string;
  fingerprint: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface DeviceListResponse {
  items: DeviceDto[];
}

export interface VpnSessionDto {
  id: string;
  userId: string;
  username?: string;
  deviceId: string;
  hostname?: string;
  assignedIp: string;
  status: SessionStatus;
  connectedAt: string;
  disconnectedAt: string | null;
}

export interface VpnSessionListResponse {
  items: VpnSessionDto[];
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

export interface CreateVpnPolicyRequest {
  role: RoleName;
  name: string;
  targetCidr: string;
  protocol: PolicyProtocol;
  portRange?: string | null;
  action: PolicyAction;
  priority?: number;
  enabled?: boolean;
}

export interface VpnPolicyListResponse {
  items: VpnPolicyDto[];
}

export interface DeletePolicyResponse {
  success: boolean;
  id: string;
}

export interface AuditLogDto {
  id: string;
  actorUserId: string | null;
  actorUsername?: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  ipAddress?: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  targetType?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface AuditLogListResponse {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AgentVersionDto {
  id: string;
  version: string;
  platform: string;
  downloadUrl: string;
  sha256Checksum: string;
  isActive: boolean;
  isRequired: boolean;
  releasedAt: string;
}

export interface CreateAgentVersionRequest {
  version: string;
  platform: string;
  downloadUrl: string;
  sha256Checksum: string;
  isActive?: boolean;
  isRequired?: boolean;
}

export interface UpdateAgentVersionRequest {
  downloadUrl?: string;
  sha256Checksum?: string;
  isActive?: boolean;
  isRequired?: boolean;
}

export interface AgentVersionListResponse {
  items: AgentVersionDto[];
}
export interface AuthUserDto {
  id: string;
  username: string;
  email: string;
  role: RoleName;
  totpEnabled: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export type LoginResponse =
  | {
      status: 'MFA_SETUP_REQUIRED';
      mfaToken: string;
      otpauthUri: string;
      secretBase32: string;
      user: AuthUserDto;
    }
  | {
      status: 'MFA_REQUIRED';
      mfaToken: string;
      user: AuthUserDto;
    };

export interface VerifyOtpRequest {
  mfaToken: string;
  code: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserDto;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface LogoutResponse {
  success: boolean;
}

export interface ConnectTicketResponse {
  ticket: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface VpnConnectRequest {
  ticket: string;
  publicKey: string;
  deviceFingerprint: string;
  hostname: string;
  agentVersion: string;
  platform?: string;
}

export interface VpnConnectResponse {
  sessionId: string;
  assignedIp: string;
  serverPublicKey: string;
  serverEndpoint: string;
  allowedIps: string[];
  dns: string[];
  connectedAt: string;
}

export interface VpnDisconnectRequest {
  sessionId?: string;
  publicKey?: string;
  deviceFingerprint?: string;
}

export interface VpnDisconnectResponse {
  success: boolean;
  sessionId: string | null;
  disconnectedAt: string | null;
}

export interface DaemonPolicyRule {
  targetCidr: string;
  protocol: PolicyProtocol;
  portRange: string | null;
  action: PolicyAction;
  priority: number;
}

export interface DaemonAddPeerRequest {
  publicKey: string;
  assignedIp: string;
  role?: RoleName;
  policies?: DaemonPolicyRule[];
}

export interface DaemonPeerPolicySync {
  publicKey: string;
  assignedIp: string;
  role: RoleName;
  policies: DaemonPolicyRule[];
}

export interface DaemonSyncPoliciesRequest {
  peers: DaemonPeerPolicySync[];
}

export interface DaemonRemovePeerRequest {
  publicKey: string;
}

export interface DaemonPeerResponse {
  success: boolean;
  publicKey: string;
  assignedIp?: string;
}

export type AgentTunnelState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface AgentHealthResponse {
  status: 'ok';
  service: 'mango-agent-windows';
  version: string;
  uptimeSeconds?: number;
  tunnelActive: boolean;
}

export interface AgentStatusResponse {
  state: AgentTunnelState;
  version: string;
  publicKey: string;
  assignedIp: string | null;
  serverEndpoint: string | null;
  allowedIps?: string[];
  sessionId?: string | null;
  connectedSince: string | null;
  bytesReceived: number;
  bytesSent: number;
  lastError: string | null;
}

export interface AgentConnectRequest {
  ticket: string;
}

export interface AgentConnectResponse {
  success: boolean;
  message: string;
  state: AgentTunnelState;
  publicKey: string;
  assignedIp: string | null;
  serverEndpoint: string | null;
  allowedIps?: string[];
  sessionId?: string | null;
  connectedSince: string | null;
}

export interface AgentDisconnectResponse {
  success: boolean;
  message: string;
  state: AgentTunnelState;
}

export interface AgentErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
