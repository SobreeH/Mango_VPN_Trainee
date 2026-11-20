import type {
  AgentVersionDto,
  AgentVersionListResponse,
  AuditLogListResponse,
  AuditLogQuery,
  CreateAgentVersionRequest,
  CreateUserRequest,
  DeviceDto,
  DeviceListResponse,
  UpdateAgentVersionRequest,
  UpdateUserStatusRequest,
  UserDto,
  UserListResponse,
  VpnSessionDto,
  VpnSessionListResponse,
} from '@mango/shared';

export const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function requestJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

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
  );
}

export function fetchAgentVersions(
  apiBaseUrl: string,
  accessToken: string,
): Promise<AgentVersionListResponse> {
  return requestJson<AgentVersionListResponse>(
    `${apiBaseUrl}/api/agent-versions`,
    accessToken,
  );
}

export function createAgentVersion(
  apiBaseUrl: string,
  accessToken: string,
  payload: CreateAgentVersionRequest,
): Promise<AgentVersionDto> {
  return requestJson<AgentVersionDto>(`${apiBaseUrl}/api/agent-versions`, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAgentVersion(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  payload: UpdateAgentVersionRequest,
): Promise<AgentVersionDto> {
  return requestJson<AgentVersionDto>(`${apiBaseUrl}/api/agent-versions/${id}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function fetchUsers(
  apiBaseUrl: string,
  accessToken: string,
): Promise<UserListResponse> {
  return requestJson<UserListResponse>(`${apiBaseUrl}/api/users`, accessToken);
}

export function createUser(
  apiBaseUrl: string,
  accessToken: string,
  payload: CreateUserRequest,
): Promise<UserDto> {
  return requestJson<UserDto>(`${apiBaseUrl}/api/users`, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUserStatus(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
  payload: UpdateUserStatusRequest,
): Promise<UserDto> {
  return requestJson<UserDto>(`${apiBaseUrl}/api/users/${id}/status`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function fetchDevices(
  apiBaseUrl: string,
  accessToken: string,
): Promise<DeviceListResponse> {
  return requestJson<DeviceListResponse>(`${apiBaseUrl}/api/devices`, accessToken);
}

export function revokeDevice(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
): Promise<DeviceDto> {
  return requestJson<DeviceDto>(`${apiBaseUrl}/api/devices/${id}/revoke`, accessToken, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function fetchSessions(
  apiBaseUrl: string,
  accessToken: string,
): Promise<VpnSessionListResponse> {
  return requestJson<VpnSessionListResponse>(`${apiBaseUrl}/api/sessions`, accessToken);
}

export function disconnectSession(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
): Promise<VpnSessionDto> {
  return requestJson<VpnSessionDto>(`${apiBaseUrl}/api/sessions/${id}/disconnect`, accessToken, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
