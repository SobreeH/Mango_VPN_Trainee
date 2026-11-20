import type {
  AgentErrorResponse,
  AgentHealthResponse,
  AgentStatusResponse,
  ConnectTicketResponse,
} from '@mango/shared';

export const AGENT_BASE_URL =
  import.meta.env.VITE_AGENT_URL ?? 'http://127.0.0.1:47821';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

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
  const res = await fetch(`${AGENT_BASE_URL}/health`, {
    method: 'GET',
  });
  if (!res.ok) {
    throw await parseAgentError(res, `Agent health check failed (${res.status})`);
  }
  return (await res.json()) as AgentHealthResponse;
}

export async function fetchAgentStatus(pairingToken: string): Promise<AgentStatusResponse> {
  const res = await fetch(`${AGENT_BASE_URL}/status`, {
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

export async function requestConnectTicket(accessToken: string): Promise<ConnectTicketResponse> {
  const res = await fetch(`${API_BASE_URL}/api/vpn/ticket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to obtain connect ticket (${res.status})`);
  }
  return (await res.json()) as ConnectTicketResponse;
}
