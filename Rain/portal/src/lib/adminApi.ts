import type {
  AgentVersionDto,
  AgentVersionListResponse,
  AuditLogListResponse,
  AuditLogQuery,
  CreateAgentVersionRequest,
  CreateUserRequest,
  CreateVpnGatewayRequest,
  CreateVpnPolicyRequest,
  DeleteGatewayResponse,
  DeletePolicyResponse,
  DeviceDto,
  DeviceListResponse,
  DisconnectAllSessionsResponse,
  UpdateAgentVersionRequest,
  UpdateUserStatusRequest,
  UpdateVpnGatewayRequest,
  UserDto,
  UserListResponse,
  VpnGatewayDto,
  VpnGatewayListResponse,
  VpnPolicyDto,
  VpnPolicyListResponse,
  VpnSessionDto,
  VpnSessionListResponse,
} from '@mango/shared';
import { fetchWithRefresh, type AuthRefreshContext } from '../api/auth';
import { getApiBaseUrl } from './env';

export const DEFAULT_API_URL = getApiBaseUrl();

async function requestJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
  auth?: AuthRefreshContext,
): Promise<T> {
  const response = await fetchWithRefresh(
    url,
    accessToken,
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    },
    auth,
  );

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errBody = (await response.json()) as { message?: string };
      if (errBody?.message) {
        message = errBody.message;
      }
    } catch {
      // keep fallback HTTP status message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function fetchAuditLogs(
  apiBaseUrl: string,
  accessToken: string,
  query: AuditLogQuery,
  auth?: AuthRefreshContext,
): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.action?.trim()) params.set('action', query.action.trim());
  if (query.targetType?.trim()) params.set('targetType', query.targetType.trim());
  if (query.actorUserId?.trim()) params.set('actorUserId', query.actorUserId.trim());
  if (query.search?.trim()) params.set('search', query.search.trim());
  const qs = params.toString();
  return requestJson<AuditLogListResponse>(
    `${apiBaseUrl}/api/audit-logs${qs ? `?${qs}` : ''}`,
    accessToken,
    undefined,
    auth,
  );
}

export function fetchAgentVersions(
  apiBaseUrl: string,
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<AgentVersionListResponse> {
  return requestJson<AgentVersionListResponse>(
    `${apiBaseUrl}/api/agent-versions`,
    accessToken,
    undefined,
    auth,
  );
}

export function createAgentVersion(
  apiBaseUrl: string,
  accessToken: string,
  payload: CreateAgentVersionRequest,
  auth?: AuthRefreshContext,
): Promise<AgentVersionDto> {
  return requestJson<AgentVersionDto>(
    `${apiBaseUrl}/api/agent-versions`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateAgentVersion(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  payload: UpdateAgentVersionRequest,
  auth?: AuthRefreshContext,
): Promise<AgentVersionDto> {
  return requestJson<AgentVersionDto>(
    `${apiBaseUrl}/api/agent-versions/${encodeURIComponent(id)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function fetchUsers(
  apiBaseUrl: string,
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<UserListResponse> {
  return requestJson<UserListResponse>(`${apiBaseUrl}/api/users`, accessToken, undefined, auth);
}

export function createUser(
  apiBaseUrl: string,
  accessToken: string,
  payload: CreateUserRequest,
  auth?: AuthRefreshContext,
): Promise<UserDto> {
  return requestJson<UserDto>(
    `${apiBaseUrl}/api/users`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateUserStatus(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  payload: UpdateUserStatusRequest,
  auth?: AuthRefreshContext,
): Promise<UserDto> {
  return requestJson<UserDto>(
    `${apiBaseUrl}/api/users/${encodeURIComponent(id)}/status`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function fetchDevices(
  apiBaseUrl: string,
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<DeviceListResponse> {
  return requestJson<DeviceListResponse>(`${apiBaseUrl}/api/devices`, accessToken, undefined, auth);
}

export function revokeDevice(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  auth?: AuthRefreshContext,
): Promise<DeviceDto> {
  return requestJson<DeviceDto>(
    `${apiBaseUrl}/api/devices/${encodeURIComponent(id)}/revoke`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    auth,
  );
}

export function fetchSessions(
  apiBaseUrl: string,
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<VpnSessionListResponse> {
  return requestJson<VpnSessionListResponse>(
    `${apiBaseUrl}/api/sessions`,
    accessToken,
    undefined,
    auth,
  );
}

export function disconnectSession(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  auth?: AuthRefreshContext,
): Promise<VpnSessionDto> {
  return requestJson<VpnSessionDto>(
    `${apiBaseUrl}/api/sessions/${encodeURIComponent(id)}/disconnect`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    auth,
  );
}

export function disconnectAllSessions(
  apiBaseUrl: string,
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<DisconnectAllSessionsResponse> {
  return requestJson<DisconnectAllSessionsResponse>(
    `${apiBaseUrl}/api/sessions/disconnect-all`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    auth,
  );
}

export function fetchPolicies(
  apiBaseUrl: string,
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<VpnPolicyListResponse> {
  return requestJson<VpnPolicyListResponse>(
    `${apiBaseUrl}/api/policies`,
    accessToken,
    undefined,
    auth,
  );
}

export function createPolicy(
  apiBaseUrl: string,
  accessToken: string,
  payload: CreateVpnPolicyRequest,
  auth?: AuthRefreshContext,
): Promise<VpnPolicyDto> {
  return requestJson<VpnPolicyDto>(
    `${apiBaseUrl}/api/policies`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function deletePolicy(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  auth?: AuthRefreshContext,
): Promise<DeletePolicyResponse> {
  return requestJson<DeletePolicyResponse>(
    `${apiBaseUrl}/api/policies/${encodeURIComponent(id)}`,
    accessToken,
    { method: 'DELETE' },
    auth,
  );
}

export function fetchGateways(
  apiBaseUrl: string,
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<VpnGatewayListResponse> {
  return requestJson<VpnGatewayListResponse>(
    `${apiBaseUrl}/api/gateways`,
    accessToken,
    undefined,
    auth,
  );
}

export function createGateway(
  apiBaseUrl: string,
  accessToken: string,
  payload: CreateVpnGatewayRequest,
  auth?: AuthRefreshContext,
): Promise<VpnGatewayDto> {
  return requestJson<VpnGatewayDto>(
    `${apiBaseUrl}/api/gateways`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateGateway(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  payload: UpdateVpnGatewayRequest,
  auth?: AuthRefreshContext,
): Promise<VpnGatewayDto> {
  return requestJson<VpnGatewayDto>(
    `${apiBaseUrl}/api/gateways/${encodeURIComponent(id)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function deleteGateway(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  auth?: AuthRefreshContext,
): Promise<DeleteGatewayResponse> {
  return requestJson<DeleteGatewayResponse>(
    `${apiBaseUrl}/api/gateways/${encodeURIComponent(id)}`,
    accessToken,
    { method: 'DELETE' },
    auth,
  );
}

export function fetchAvailableAgentVersions(
  apiBaseUrl: string,
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<AgentVersionListResponse> {
  return requestJson<AgentVersionListResponse>(
    `${apiBaseUrl}/api/vpn/agent-versions`,
    accessToken,
    undefined,
    auth,
  );
}
