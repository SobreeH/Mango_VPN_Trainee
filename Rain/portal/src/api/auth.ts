import type {
  ApiErrorResponse,
  AuthTokensResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  RefreshRequest,
  VerifyOtpRequest,
} from '@mango/shared';
import { getApiBaseUrl } from '../lib/env';

export interface AuthRefreshContext {
  refreshToken?: string;
  apiBaseUrl?: string;
  onSessionUpdate?: (session: AuthTokensResponse) => void;
  onAuthExpired?: (message: string) => void;
}

const inflightRefreshes = new Map<string, Promise<AuthTokensResponse>>();

async function postJson<TReq, TRes>(
  path: string,
  body: TReq,
  apiBaseUrl = getApiBaseUrl(),
): Promise<TRes> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errBody = (await response.json()) as Partial<ApiErrorResponse>;
      if (errBody.message) {
        message = errBody.message;
      }
    } catch {
      // keep fallback HTTP status message when response body is not JSON
    }
    throw new Error(message);
  }

  return (await response.json()) as TRes;
}

export function loginUser(payload: LoginRequest): Promise<LoginResponse> {
  return postJson<LoginRequest, LoginResponse>('/api/auth/login', payload);
}

export function verifyOtpCode(payload: VerifyOtpRequest): Promise<AuthTokensResponse> {
  return postJson<VerifyOtpRequest, AuthTokensResponse>('/api/auth/verify-otp', payload);
}

export function logoutUser(payload: LogoutRequest): Promise<LogoutResponse> {
  return postJson<LogoutRequest, LogoutResponse>('/api/auth/logout', payload);
}

export function refreshAuthTokens(
  refreshToken: string,
  apiBaseUrl = getApiBaseUrl(),
): Promise<AuthTokensResponse> {
  return postJson<RefreshRequest, AuthTokensResponse>(
    '/api/auth/refresh',
    { refreshToken },
    apiBaseUrl,
  );
}

function getOrStartRefresh(
  refreshToken: string,
  apiBaseUrl?: string,
): Promise<AuthTokensResponse> {
  const existing = inflightRefreshes.get(refreshToken);
  if (existing) return existing;

  const promise = refreshAuthTokens(refreshToken, apiBaseUrl).finally(() => {
    inflightRefreshes.delete(refreshToken);
  });
  inflightRefreshes.set(refreshToken, promise);
  return promise;
}

export async function fetchWithRefresh(
  url: string,
  accessToken: string,
  init?: RequestInit,
  auth?: AuthRefreshContext,
): Promise<Response> {
  const makeRequest = (token: string) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

  const response = await makeRequest(accessToken);
  if (response.status !== 401) {
    return response;
  }

  if (!auth?.refreshToken) {
    auth?.onAuthExpired?.('Session expired. Please sign in again.');
    return response;
  }

  let refreshed: AuthTokensResponse;
  try {
    refreshed = await getOrStartRefresh(auth.refreshToken, auth.apiBaseUrl);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Session expired. Please sign in again.';
    auth.onAuthExpired?.(message);
    throw err instanceof Error ? err : new Error(message);
  }

  auth.onSessionUpdate?.(refreshed);
  return makeRequest(refreshed.accessToken);
}
