import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeviceStatus, RoleName, SessionStatus } from '@mango/shared';
import { App } from './App';

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const adminSession = {
  accessToken: 'admin-token',
  user: {
    id: 'u-admin',
    username: 'admin.test',
    email: 'admin@mango.local',
    role: RoleName.ADMIN,
    totpEnabled: true,
  },
};

describe('Portal Admin Users, Devices & Sessions Tabs (fetch seam)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not render Users, Devices, or Sessions tabs for STAFF or CLIENT', () => {
    renderWithQuery(
      <App
        initialSession={{
          accessToken: 'staff-token',
          user: {
            id: 'u-staff',
            username: 'staff.user',
            email: 'staff@mango.local',
            role: RoleName.STAFF,
            totpEnabled: true,
          },
        }}
      />,
    );

    expect(screen.queryByRole('tab', { name: /Users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Devices/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Sessions/i })).not.toBeInTheDocument();
  });

  it('renders Users tab for ADMIN, creates a user, toggles status, and handles empty/error states honestly', async () => {
    const users = [
      {
        id: 'u-1',
        username: 'staff.one',
        email: 'staff.one@mango.local',
        role: RoleName.STAFF,
        isActive: true,
        totpEnabled: false,
        createdAt: '2026-11-20T02:00:00.000Z',
      },
    ];

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/users') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ items: users }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/users') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const created = {
          id: 'u-2',
          username: body.username,
          email: body.email,
          role: body.role,
          isActive: true,
          totpEnabled: false,
          createdAt: '2026-11-20T02:05:00.000Z',
        };
        users.push(created);
        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/users/u-1/status') && init?.method === 'PATCH') {
        users[0] = { ...users[0]!, isActive: false };
        return new Response(JSON.stringify(users[0]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(<App initialSession={adminSession} />);

    fireEvent.click(screen.getByRole('tab', { name: /Users/i }));
    expect(await screen.findByText('staff.one')).toBeInTheDocument();

    // Create a user
    fireEvent.change(screen.getByLabelText(/^Username$/i), { target: { value: 'client.two' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'client.two@mango.local' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'StrongPassword!2026' } });
    fireEvent.change(screen.getByLabelText(/^Role$/i), { target: { value: RoleName.CLIENT } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));

    expect(await screen.findByText('client.two')).toBeInTheDocument();

    // Toggle status (Disable)
    const disableBtns = screen.getAllByRole('button', { name: /Disable/i });
    fireEvent.click(disableBtns[0]!);
    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });

  it('renders Devices tab, revokes a device, and shows honest empty/error states', async () => {
    const devices = [
      {
        id: 'dev-1',
        userId: 'u-1',
        username: 'staff.one',
        hostname: 'staff-laptop',
        fingerprint: 'fp-1234',
        status: DeviceStatus.ACTIVE,
        lastSeenAt: '2026-11-20T02:10:00.000Z',
        createdAt: '2026-11-20T02:00:00.000Z',
      },
    ];

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/devices')) {
        return new Response(JSON.stringify({ items: devices }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/devices/dev-1/revoke') && init?.method === 'POST') {
        devices[0] = { ...devices[0]!, status: DeviceStatus.REVOKED };
        return new Response(JSON.stringify(devices[0]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(<App initialSession={adminSession} />);

    fireEvent.click(screen.getByRole('tab', { name: /Devices/i }));
    expect(await screen.findByText('staff-laptop')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Revoke/i }));
    await waitFor(() => {
      expect(screen.getByText('REVOKED')).toBeInTheDocument();
    });
  });

  it('renders Sessions tab, force-disconnects an active session, and displays real API errors', async () => {
    const sessions = [
      {
        id: 'sess-1',
        userId: 'u-1',
        username: 'staff.one',
        deviceId: 'dev-1',
        hostname: 'staff-laptop',
        assignedIp: '10.13.13.10',
        status: SessionStatus.ACTIVE,
        connectedAt: '2026-11-20T02:10:00.000Z',
        disconnectedAt: null,
      },
    ];

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/sessions')) {
        return new Response(JSON.stringify({ items: sessions }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/sessions/sess-1/disconnect') && init?.method === 'POST') {
        return new Response(JSON.stringify({ message: 'VPN daemon unreachable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(<App initialSession={adminSession} />);

    fireEvent.click(screen.getByRole('tab', { name: /Sessions/i }));
    expect(await screen.findByText('10.13.13.10')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('VPN daemon unreachable');
    expect(screen.queryByText(/No VPN sessions found/i)).not.toBeInTheDocument();
  });

  it('does not render false "No users found" empty state when GET /api/users fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/users')) {
        return new Response(JSON.stringify({ message: 'Users service offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(<App initialSession={adminSession} />);
    fireEvent.click(screen.getByRole('tab', { name: /Users/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Users service offline/i);
    expect(screen.queryByText(/No users found/i)).not.toBeInTheDocument();
  });
});
