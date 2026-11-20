import type {
  AgentVersionDto,
  AgentVersionListResponse,
  AuditLogListResponse,
  AuditLogQuery,
  CreateAgentVersionRequest,
  CreateVpnPolicyRequest,
  UpdateAgentVersionRequest,
  VpnPolicyDto,
  VpnPolicyListResponse,
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

export function fetchPolicies(
  apiBaseUrl: string,
  accessToken: string,
): Promise<VpnPolicyListResponse> {
  return requestJson<VpnPolicyListResponse>(`${apiBaseUrl}/api/policies`, accessToken);
}

export function createPolicy(
  apiBaseUrl: string,
  accessToken: string,
  payload: CreateVpnPolicyRequest,
): Promise<VpnPolicyDto> {
  return requestJson<VpnPolicyDto>(`${apiBaseUrl}/api/policies`, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deletePolicy(
  apiBaseUrl: string,
  accessToken: string,
  id: string,
): Promise<{ success: boolean; id: string }> {
  return requestJson<{ success: boolean; id: string }>(
    `${apiBaseUrl}/api/policies/${id}`,
    accessToken,
    { method: 'DELETE' },
  );
}
