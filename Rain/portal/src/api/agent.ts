import type {
  AgentConnectResponse,
  AgentDisconnectResponse,
  AgentErrorResponse,
  AgentHealthResponse,
  AgentStatusResponse,
  ConnectTicketResponse,
  VpnGatewayListResponse,
  VpnProviderType,
} from '@mango/shared';
import { getAgentBaseUrl, getApiBaseUrl } from '../lib/env';
import { fetchWithRefresh, type AuthRefreshContext } from './auth';

export const AGENT_BASE_URL = getAgentBaseUrl();

export class AgentHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AgentHttpError';
  }
}

async function parseAgentError(res: Response, fallback: string): Promise<AgentHttpError> {
  try {
    const body = (await res.json()) as Partial<AgentErrorResponse>;
    if (body.error?.message) {
      return new AgentHttpError(
        res.status,
        body.error.code ?? 'AGENT_ERROR',
        body.error.message,
      );
    }
  } catch {
    // ignore non-JSON body
  }
  return new AgentHttpError(res.status, 'AGENT_ERROR', fallback);
}

export async function checkAgentHealth(): Promise<AgentHealthResponse> {
  const res = await fetch(`${getAgentBaseUrl()}/health`, {
    method: 'GET',
  });
  if (!res.ok) {
    throw await parseAgentError(res, `Agent health check failed (${res.status})`);
  }
  return (await res.json()) as AgentHealthResponse;
}

export async function fetchAgentStatus(pairingToken: string): Promise<AgentStatusResponse> {
  const res = await fetch(`${getAgentBaseUrl()}/status`, {
    method: 'GET',
    headers: {
      'X-Mango-Agent-Token': pairingToken,
    },
  });
  if (!res.ok) {
    throw await parseAgentError(res, `Agent status check failed (${res.status})`);
  }
  return (await res.json()) as AgentStatusResponse;
}

export async function fetchAvailableGateways(
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<VpnGatewayListResponse> {
  const res = await fetchWithRefresh(
    `${auth?.apiBaseUrl ?? getApiBaseUrl()}/api/vpn/gateways`,
    accessToken,
    { method: 'GET' },
    auth,
  );
  if (!res.ok) {
    let message = `Failed to load VPN gateways (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore non-JSON body
    }
    throw new Error(message);
  }
  return (await res.json()) as VpnGatewayListResponse;
}

export async function requestConnectTicket(
  accessToken: string,
  auth?: AuthRefreshContext,
  gatewayId?: string,
): Promise<ConnectTicketResponse> {
  const init: RequestInit = gatewayId
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayId }),
      }
    : { method: 'POST' };

  const res = await fetchWithRefresh(
    `${auth?.apiBaseUrl ?? getApiBaseUrl()}/api/vpn/ticket`,
    accessToken,
    init,
    auth,
  );
  if (!res.ok) {
    let message = `Failed to obtain connect ticket (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore non-JSON body
    }
    throw new Error(message);
  }
  return (await res.json()) as ConnectTicketResponse;
}

export async function connectAgent(
  pairingToken: string,
  ticket: string,
  options?: { providerType?: VpnProviderType; gatewayId?: string },
): Promise<AgentConnectResponse> {
  const payload: Record<string, string> = { ticket };
  if (options?.providerType) {
    payload.providerType = options.providerType;
  }
  if (options?.gatewayId) {
    payload.gatewayId = options.gatewayId;
  }

  const res = await fetch(`${getAgentBaseUrl()}/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mango-Agent-Token': pairingToken,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await parseAgentError(res, `Agent connect failed (${res.status})`);
  }
  return (await res.json()) as AgentConnectResponse;
}

export async function disconnectAgent(pairingToken: string): Promise<AgentDisconnectResponse> {
  const res = await fetch(`${getAgentBaseUrl()}/disconnect`, {
    method: 'POST',
    headers: {
      'X-Mango-Agent-Token': pairingToken,
    },
  });
  if (!res.ok) {
    throw await parseAgentError(res, `Agent disconnect failed (${res.status})`);
  }
  return (await res.json()) as AgentDisconnectResponse;
}
