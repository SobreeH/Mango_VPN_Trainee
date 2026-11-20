import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoleName } from '@mango/shared';
import { App } from './App';

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('Portal Auth + TOTP Flow (fetch seam)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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
});
