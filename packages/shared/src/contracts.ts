/**
 * MANGO VPN - Shared API Contracts & Data Transfer Objects (DTOs)
 * 
 * Shared between:
 * - apps/portal (React Web Frontend)
 * - apps/api (Node.js/Fastify Backend)
 * - apps/agent-windows (Windows Client Agent loopback bridge)
 * - scripts/mock-agent.js (Agent simulator)
 */

// ==========================================
// 1. Roles & Core Security Enums
// ==========================================

export type RoleName = 'ADMIN' | 'STAFF' | 'CLIENT';

export type PolicyAction = 'ALLOW' | 'DENY';

export type NetworkProtocol = 'TCP' | 'UDP' | 'ICMP' | 'ALL';

export type AgentConnectionState = 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'error';

// ==========================================
// 2. Authentication Flow (Step 1 -> 4)
// ==========================================

/**
 * Step 1: User Submits Credentials
 * POST /api/auth/login
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Step 2: Server responds with MFA Challenge
 * Response from POST /api/auth/login
 */
export interface LoginResponse {
  requiresOtp: boolean;
  challengeId: string;
  maskedPhoneNumber: string;
  expiresInSeconds: number;
  message: string;
}

/**
 * Step 3: User submits OTP code
 * POST /api/auth/verify-otp
 */
export interface VerifyOtpRequest {
  challengeId: string;
  otpCode: string;
}

/**
 * Step 4: Server issues JWT and User context
 * Response from POST /api/auth/verify-otp (or POST /api/auth/refresh)
 */
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // in seconds
  user: {
    id: string;
    username: string;
    phoneNumber: string;
    role: RoleName;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ==========================================
// 3. Local Windows Agent Loopback Contracts
// (127.0.0.1:47821)
// ==========================================

/**
 * Agent Health Check
 * GET http://127.0.0.1:47821/health
 */
export interface AgentHealthResponse {
  status: 'ok';
  service: 'mango-agent-windows';
  version: string;
  uptimeSeconds: number;
  tunnelActive: boolean;
}

/**
 * Portal signals local agent to initiate tunnel
 * POST http://127.0.0.1:47821/connect
 */
export interface AgentConnectRequest {
  accessToken: string;
  backendUrl?: string; // Optional override; defaults to configured API endpoint
}

/**
 * Local Agent Status Inquiry
 * GET http://127.0.0.1:47821/status
 */
export interface AgentStatusResponse {
  state: AgentConnectionState;
  assignedIp?: string;
  serverEndpoint?: string;
  publicKey?: string;
  connectedSince?: string; // ISO 8601 string
  bytesReceived: number;
  bytesSent: number;
  lastError?: string;
}

/**
 * Portal signals local agent to disconnect
 * POST http://127.0.0.1:47821/disconnect
 */
export interface AgentDisconnectRequest {
  reason?: string;
}

export interface AgentDisconnectResponse {
  success: boolean;
  message: string;
  state: AgentConnectionState;
}

// ==========================================
// 4. Backend VPN Negotiation Contracts
// (Local Agent -> Backend API: POST /api/vpn/connect)
// ==========================================

/**
 * Local Agent registers WireGuard key and requests tunnel lease
 * POST /api/vpn/connect
 * Header: Authorization: Bearer <accessToken>
 */
export interface VpnConnectRequest {
  publicKey: string;           // Base64-encoded WireGuard Curve25519 public key generated on client
  deviceId?: string;           // Hardware GUID or client machine identifier
  deviceName?: string;         // Hostname
  osInfo?: string;             // e.g. "Windows 11 Pro 23H2"
  macAddress?: string;         // Primary NIC MAC for device binding
}

/**
 * Server assigns IP, registers peer with wg0, returns tunnel configuration
 * Response from POST /api/vpn/connect
 */
export interface VpnConnectResponse {
  peerId: string;
  assignedIp: string;          // e.g., "10.13.13.45/32"
  serverPublicKey: string;     // Server's WireGuard public key
  endpoint: string;            // Server WAN IP:Port, e.g. "vpn.mangovpn.internal:51820"
  allowedIps: string[];        // Routes to route over tunnel, e.g. ["10.13.13.0/24", "172.16.0.0/16"]
  dnsServers: string[];        // Internal DNS, e.g. ["10.13.13.1"]
  keepaliveSeconds: number;    // WireGuard PersistentKeepalive (e.g. 25)
  sessionId: string;
  leaseExpiresAt: string;      // ISO 8601
}

/**
 * Local Agent terminates session
 * POST /api/vpn/disconnect
 */
export interface VpnDisconnectRequest {
  peerId: string;
  sessionId: string;
  bytesRx: number;
  bytesTx: number;
}

export interface VpnDisconnectResponse {
  success: boolean;
  message: string;
  disconnectedAt: string;
}

// ==========================================
// 5. Admin & Management DTOs (Junior Dev CRUD)
// ==========================================

export interface DeviceDto {
  id: string;
  userId: string;
  deviceName: string;
  osInfo: string;
  macAddress?: string | null;
  lastSeen: string;
  createdAt: string;
}

export interface VpnSessionDto {
  id: string;
  peerId: string;
  connectedAt: string;
  disconnectedAt?: string | null;
  clientPublicIp: string;
  bytesRx: number;
  bytesTx: number;
  durationSeconds?: number;
}

export interface AuditLogDto {
  id: string;
  userId?: string | null;
  action: string;
  metadataJson?: Record<string, unknown> | null;
  ipAddress: string;
  createdAt: string;
}

export interface AgentVersionDto {
  id: string;
  versionString: string;
  downloadUrl: string;
  checksumSha256: string;
  isMandatory: boolean;
  releasedAt: string;
}

export interface VpnPolicyDto {
  id: string;
  roleId: string;
  roleName?: string;
  destinationCidr: string;
  protocol: NetworkProtocol;
  portRange: string; // e.g., "80,443" or "1024-65535" or "ANY"
  action: PolicyAction;
}

// ==========================================
// 6. Generic API Envelope
// ==========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

