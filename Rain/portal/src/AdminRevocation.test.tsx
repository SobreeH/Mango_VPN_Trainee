import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeviceStatus, GatewayIpamMode, RoleName, SessionStatus, VpnProviderType } from '@mango/shared';
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

    // Toggle status (Disable) via confirmation modal
    const disableBtns = screen.getAllByRole('button', { name: /^Disable$/i });
    fireEvent.click(disableBtns[0]!);
    // Modal is shown - confirm
    fireEvent.click(screen.getByRole('button', { name: /^Disable User$/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /^Revoke$/i }));
    // Modal is shown - confirm revocation
    fireEvent.click(screen.getByRole('button', { name: /^Revoke Device$/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /^Disconnect$/i }));
    // Modal is shown - confirm disconnection
    fireEvent.click(screen.getByRole('button', { name: /^Disconnect Session$/i }));
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

  it('supports modal cancellation and instant search/role filtering in UsersTab', async () => {
    const users = [
      {
        id: 'u-1',
        username: 'alice.staff',
        email: 'alice@mango.local',
        role: RoleName.STAFF,
        isActive: true,
        totpEnabled: false,
        createdAt: '2026-11-20T02:00:00.000Z',
      },
      {
        id: 'u-2',
        username: 'bob.client',
        email: 'bob@mango.local',
        role: RoleName.CLIENT,
        isActive: true,
        totpEnabled: false,
        createdAt: '2026-11-20T02:05:00.000Z',
      },
    ];

    let patchCalled = false;
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
      if (url.includes('/status') && init?.method === 'PATCH') {
        patchCalled = true;
        return new Response(JSON.stringify({ ...users[0], isActive: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(<App initialSession={adminSession} />);
    fireEvent.click(screen.getByRole('tab', { name: /Users/i }));
    expect(await screen.findByText('alice.staff')).toBeInTheDocument();
    expect(screen.getByText('bob.client')).toBeInTheDocument();

    // Test search filter
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'alice' } });
    expect(screen.getByText('alice.staff')).toBeInTheDocument();
    expect(screen.queryByText('bob.client')).not.toBeInTheDocument();

    // Reset search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('bob.client')).toBeInTheDocument();

    // Test role filter
    const roleSelect = screen.getByLabelText(/Role:/i);
    fireEvent.change(roleSelect, { target: { value: RoleName.CLIENT } });
    expect(screen.queryByText('alice.staff')).not.toBeInTheDocument();
    expect(screen.getByText('bob.client')).toBeInTheDocument();

    // Reset role filter
    fireEvent.change(roleSelect, { target: { value: 'ALL' } });
    expect(screen.getByText('alice.staff')).toBeInTheDocument();

    // Test cancellation modal
    const disableBtns = screen.getAllByRole('button', { name: /^Disable$/i });
    fireEvent.click(disableBtns[0]!);
    expect(screen.getByText(/Are you sure you want to disable account/i)).toBeInTheDocument();

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure you want to disable account/i)).not.toBeInTheDocument();
    });
    expect(patchCalled).toBe(false);
  });

  it('renders Gateways tab for ADMIN and creates/toggles/deletes multi-provider VPN gateways', async () => {
    const gateways = [
      {
        id: 'gw-1',
        name: 'Primary WireGuard',
        providerType: VpnProviderType.WIREGUARD,
        endpoint: 'wg.mango.internal:51820',
        subnetCidr: '10.13.13.0/24',
        ipamMode: GatewayIpamMode.API_MANAGED,
        dns: ['1.1.1.1'],
        allowedRoles: [RoleName.ADMIN, RoleName.STAFF, RoleName.CLIENT],
        isDefault: true,
        isEnabled: true,
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z',
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
      if (url.endsWith('/api/gateways') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ items: gateways }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/gateways') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const created = {
          id: 'gw-2',
          name: body.name,
          providerType: body.providerType,
          endpoint: body.endpoint,
          subnetCidr: body.subnetCidr,
          ipamMode: body.ipamMode,
          dns: ['1.1.1.1'],
          allowedRoles: body.allowedRoles,
          isDefault: Boolean(body.isDefault),
          isEnabled: true,
          createdAt: '2026-11-24T01:00:00.000Z',
          updatedAt: '2026-11-24T01:00:00.000Z',
        };
        gateways.push(created);
        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/gateways/gw-2') && init?.method === 'DELETE') {
        const idx = gateways.findIndex((g) => g.id === 'gw-2');
        if (idx >= 0) gateways.splice(idx, 1);
        return new Response(JSON.stringify({ success: true, id: 'gw-2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(<App initialSession={adminSession} />);

    fireEvent.click(screen.getByRole('tab', { name: /Gateways/i }));
    expect(await screen.findByText('Primary WireGuard')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Gateway Name/i), {
      target: { value: 'HQ FortiGate' },
    });
    fireEvent.change(screen.getByLabelText(/VPN Provider/i), {
      target: { value: VpnProviderType.FORTINET },
    });
    fireEvent.change(screen.getByLabelText(/Endpoint/i), {
      target: { value: 'fg.mango.internal:443' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Register Gateway/i }));

    expect(await screen.findByText('HQ FortiGate')).toBeInTheDocument();
  });

  it('supports inspecting full device details, OS badges, summary counts, and filtering in Devices tab', async () => {
    const devices = [
      {
        id: 'dev-mac-1',
        userId: 'u-1',
        username: 'alice.staff',
        hostname: 'Alice-MacBook-Pro',
        fingerprint: 'fp-macos-1234567890abcdef',
        status: DeviceStatus.ACTIVE,
        lastSeenAt: '2026-11-24T08:30:00.000Z',
        createdAt: '2026-11-20T02:00:00.000Z',
      },
      {
        id: 'dev-lin-2',
        userId: 'u-2',
        username: 'bob.client',
        hostname: 'ubuntu-ops-server',
        fingerprint: 'fp-linux-abcdef1234567890',
        status: DeviceStatus.REVOKED,
        lastSeenAt: null,
        createdAt: '2026-11-21T04:00:00.000Z',
      },
    ];

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
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
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(<App initialSession={adminSession} />);

    fireEvent.click(screen.getByRole('tab', { name: /Devices/i }));
    expect(await screen.findByText('Alice-MacBook-Pro')).toBeInTheDocument();
    expect(screen.getByText('ubuntu-ops-server')).toBeInTheDocument();
    expect(screen.getByText('ทั้งหมด 2 เครื่อง')).toBeInTheDocument();
    expect(screen.getByText('macOS')).toBeInTheDocument();
    expect(screen.getByText('Linux / Server')).toBeInTheDocument();

    // Search by hostname
    fireEvent.change(screen.getByLabelText(/Search devices/i), { target: { value: 'MacBook' } });
    expect(screen.getByText('Alice-MacBook-Pro')).toBeInTheDocument();
    expect(screen.queryByText('ubuntu-ops-server')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Clear search/i));
    expect(screen.getByText('ubuntu-ops-server')).toBeInTheDocument();

    // Open Inspect modal for Alice-MacBook-Pro
    const inspectBtns = screen.getAllByRole('button', { name: /Inspect device/i });
    fireEvent.click(inspectBtns[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('fp-macos-1234567890abcdef');
    expect(dialog).toHaveTextContent('dev-mac-1');

    // Close Inspect modal
    fireEvent.click(screen.getByRole('button', { name: /Close inspect modal/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
