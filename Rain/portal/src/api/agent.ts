import type {
  AgentConnectResponse,
  AgentDisconnectResponse,
  AgentErrorResponse,
  AgentHealthResponse,
  AgentStatusResponse,
  ConnectTicketResponse,
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

export async function requestConnectTicket(
  accessToken: string,
  auth?: AuthRefreshContext,
): Promise<ConnectTicketResponse> {
  const res = await fetchWithRefresh(
    `${auth?.apiBaseUrl ?? getApiBaseUrl()}/api/vpn/ticket`,
    accessToken,
    { method: 'POST' },
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
  userHint?: string,
): Promise<AgentConnectResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Mango-Agent-Token': pairingToken,
  };
  if (userHint) {
    headers['X-Mango-Dev-User'] = userHint;
  }
  const res = await fetch(`${getAgentBaseUrl()}/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ticket, userHint }),
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
