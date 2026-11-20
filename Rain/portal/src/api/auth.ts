import type {
  ApiErrorResponse,
  AuthTokensResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  VerifyOtpRequest,
} from '@mango/shared';
import { getApiBaseUrl } from '../lib/env';

async function postJson<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
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
