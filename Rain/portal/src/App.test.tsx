import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoleName } from '@mango/shared';
import { App } from './App';

function renderApp(props: Parameters<typeof App>[0] = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App {...props} />
    </QueryClientProvider>,
  );
}

describe('Portal Auth + TOTP Flow (fetch seam)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    try { window.localStorage?.clear?.(); } catch {}
    try { window.sessionStorage?.clear?.(); } catch {}
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    try { window.localStorage?.clear?.(); } catch {}
    try { window.sessionStorage?.clear?.(); } catch {}
  });

  it('validates login fields with Zod before calling fetch and has no pre-filled password', () => {
    renderApp();

    const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    expect(usernameInput.value).toBe('');
    expect(passwordInput.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/username is required/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('guides first-time user through Login -> TOTP QR enrollment -> OTP verify -> Authenticated -> Logout', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'MFA_SETUP_REQUIRED',
            mfaToken: 'mfa-jwt-setup',
            otpauthUri: 'otpauth://totp/MANGO%20VPN:alice?secret=JBSWY3DPEHPK3PXP&issuer=MANGO%20VPN',
            secretBase32: 'JBSWY3DPEHPK3PXP',
            user: {
              id: 'u-1',
              username: 'alice',
              email: 'alice@mango.internal',
              role: RoleName.ADMIN,
              totpEnabled: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'access-jwt-1',
            refreshToken: 'refresh-tok-1',
            expiresIn: 900,
            user: {
              id: 'u-1',
              username: 'alice',
              email: 'alice@mango.internal',
              role: RoleName.ADMIN,
              totpEnabled: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
            service: 'mango-agent-windows',
            version: '2.0.0',
            tunnelActive: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderApp();

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'StrongPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // TOTP Enrollment step
    await waitFor(() => {
      expect(screen.getByText(/set up authenticator/i)).toBeInTheDocument();
    });
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByAltText(/totp authenticator qr code/i)).toBeInTheDocument();
    });

    // Zod validation rejects non-6-digit code
    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '12ab' } });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/6 digits/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Valid 6-digit code -> authenticated
    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
    });

    // Logout
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('guides returning user through Login -> TOTP verification and displays real server/network errors', async () => {
    // 1. Server 429 lockout error
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Account temporarily locked due to too many failed attempts.',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderApp();

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'bob' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'WrongPass!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Account temporarily locked/i);
    });

    // 2. Network error
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to fetch/i);
    });

    // 3. Returning user MFA_REQUIRED
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'MFA_REQUIRED',
          mfaToken: 'mfa-jwt-verify',
          user: {
            id: 'u-2',
            username: 'bob',
            email: 'bob@mango.internal',
            role: RoleName.CLIENT,
            totpEnabled: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/two-factor verification/i)).toBeInTheDocument();
    });
    expect(screen.queryByAltText(/totp authenticator qr code/i)).not.toBeInTheDocument();
  });

  it('silently refreshes expired accessToken on 401 and retries the request once', async () => {
    let auditCallCount = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'mango-agent-windows',
            version: '2.0.0',
            tunnelActive: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/api/audit-logs')) {
        auditCallCount += 1;
        const headers = init?.headers as Record<string, string> | undefined;
        const authHeader = headers?.Authorization ?? headers?.authorization;
        if (auditCallCount === 1) {
          expect(authHeader).toBe('Bearer expired-access-token');
          return new Response(
            JSON.stringify({
              statusCode: 401,
              error: 'Unauthorized',
              message: 'Access token expired',
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }
        expect(authHeader).toBe('Bearer fresh-access-token');
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'log-refresh-1',
                actorUserId: 'u-1',
                actorUsername: 'alice',
                action: 'auth.login',
                targetType: 'AUTH',
                targetId: 'u-1',
                ipAddress: '127.0.0.1',
                metadata: null,
                createdAt: '2026-11-20T03:00:00Z',
              },
            ],
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.endsWith('/api/auth/refresh')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({
          refreshToken: 'valid-refresh-token',
        });
        return new Response(
          JSON.stringify({
            accessToken: 'fresh-access-token',
            refreshToken: 'fresh-refresh-token',
            expiresIn: 900,
            user: {
              id: 'u-1',
              username: 'alice',
              email: 'alice@mango.internal',
              role: RoleName.ADMIN,
              totpEnabled: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderApp({
      initialSession: {
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token',
        user: {
          id: 'u-1',
          username: 'alice',
          email: 'alice@mango.internal',
          role: RoleName.ADMIN,
          totpEnabled: true,
        },
      },
      apiBaseUrl: 'http://localhost:4000',
    });

    await waitFor(() => {
      expect(screen.getByText('auth.login')).toBeInTheDocument();
    });
    expect(auditCallCount).toBe(2);
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('logs out cleanly with an error message when token refresh fails on 401', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'mango-agent-windows',
            version: '2.0.0',
            tunnelActive: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Access token expired',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.endsWith('/api/auth/refresh')) {
        return new Response(
          JSON.stringify({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Refresh token revoked',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderApp({
      initialSession: {
        accessToken: 'expired-access-token',
        refreshToken: 'revoked-refresh-token',
        user: {
          id: 'u-1',
          username: 'alice',
          email: 'alice@mango.internal',
          role: RoleName.ADMIN,
          totpEnabled: true,
        },
      },
      apiBaseUrl: 'http://localhost:4000',
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/refresh token revoked/i);
  });

  it('loads active agent installers in the Staff Help tab from /api/vpn/agent-versions', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/vpn/agent-versions')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'ver-staff-1',
                version: '1.4.0',
                platform: 'windows-x64',
                downloadUrl: 'https://downloads.mango.local/mango-agent-1.4.0.msi',
                sha256Checksum: 'c'.repeat(64),
                isActive: true,
                isRequired: true,
                releasedAt: '2026-11-26T00:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('127.0.0.1:47821')) {
        return new Response(JSON.stringify({ message: 'Agent offline' }), { status: 503 });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderApp({
      initialSession: {
        accessToken: 'staff-token',
        refreshToken: 'staff-refresh',
        user: {
          id: 'u-staff',
          username: 'somchai_staff',
          email: 'somchai@mango.internal',
          role: RoleName.STAFF,
          totpEnabled: true,
        },
      },
      apiBaseUrl: 'http://localhost:4000',
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Help$/i }));

    expect(await screen.findByText('v1.4.0')).toBeInTheDocument();
    expect(screen.getByText('windows-x64')).toBeInTheDocument();
    const downloadLink = screen.getByRole('link', { name: /ดาวน์โหลด|Download/i });
    expect(downloadLink).toHaveAttribute(
      'href',
      'https://downloads.mango.local/mango-agent-1.4.0.msi',
    );
  });
});
