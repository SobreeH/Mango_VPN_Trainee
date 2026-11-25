import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PolicyAction, PolicyProtocol, RoleName, type VpnPolicyDto } from '@mango/shared';
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

describe('Portal Admin Policies Tab (fetch seam)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not render Policies tab for STAFF or CLIENT', () => {
    for (const role of [RoleName.STAFF, RoleName.CLIENT]) {
      renderWithQuery(
        <App
          initialSession={{
            accessToken: 'non-admin-token',
            user: {
              id: `u-${role}`,
              username: `${role.toLowerCase()}.user`,
              email: `${role.toLowerCase()}@mango.local`,
              role,
              totpEnabled: true,
            },
          }}
        />,
      );
      expect(screen.queryByRole('tab', { name: /^Policies$/i })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it('renders honest empty state when GET /api/policies returns []', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/policies')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(
      <App
        initialSession={{
          accessToken: 'admin-token',
          user: {
            id: 'u-admin',
            username: 'admin.user',
            email: 'admin@mango.local',
            role: RoleName.ADMIN,
            totpEnabled: true,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Policies$/i }));

    await waitFor(() => {
      expect(screen.getByText(/No policies configured/i)).toBeInTheDocument();
    });
  });

  it('renders real error alert when GET /api/policies fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/policies')) {
        return new Response(JSON.stringify({ message: 'Database unavailable' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(
      <App
        initialSession={{
          accessToken: 'admin-token',
          user: {
            id: 'u-admin',
            username: 'admin.user',
            email: 'admin@mango.local',
            role: RoleName.ADMIN,
            totpEnabled: true,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Policies$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Database unavailable/i);
    });
  });

  it('allows ADMIN to create and delete a policy', async () => {
    let policies: VpnPolicyDto[] = [];

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.endsWith('/api/policies') && method === 'GET') {
        return new Response(JSON.stringify({ items: policies }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/policies') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const created: VpnPolicyDto = {
          id: 'pol-1',
          role: body.role,
          name: body.name,
          targetCidr: body.targetCidr,
          protocol: body.protocol,
          portRange: body.portRange ?? null,
          action: body.action,
          priority: body.priority ?? 100,
          enabled: true,
        };
        policies = [created];
        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/policies/pol-1') && method === 'DELETE') {
        policies = [];
        return new Response(JSON.stringify({ success: true, id: 'pol-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(
      <App
        initialSession={{
          accessToken: 'admin-token',
          user: {
            id: 'u-admin',
            username: 'admin.user',
            email: 'admin@mango.local',
            role: RoleName.ADMIN,
            totpEnabled: true,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Policies$/i }));
    await waitFor(() => {
      expect(screen.getByText(/No policies configured/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Policy Name/i), {
      target: { value: 'Deny Production DB' },
    });
    fireEvent.change(screen.getByLabelText(/Role/i), {
      target: { value: RoleName.STAFF },
    });
    fireEvent.change(screen.getByLabelText(/Target CIDR/i), {
      target: { value: '10.99.0.0/16' },
    });
    fireEvent.change(screen.getByLabelText(/Protocol/i), {
      target: { value: PolicyProtocol.TCP },
    });
    fireEvent.change(screen.getByLabelText(/Port Range/i), {
      target: { value: '5432' },
    });
    fireEvent.change(screen.getByLabelText(/Action/i), {
      target: { value: PolicyAction.DENY },
    });
    fireEvent.change(screen.getByLabelText(/Priority/i), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Policy/i }));

    await waitFor(() => {
      expect(screen.getByText('Deny Production DB')).toBeInTheDocument();
      expect(screen.getByText('10.99.0.0/16')).toBeInTheDocument();
      expect(screen.getByText('Priority 0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

    // ConfirmModal opens and asks for confirmation
    expect(await screen.findByText('Delete Security Policy')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete policy/i)).toBeInTheDocument();

    // Test Cancel: policy should NOT be deleted
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText('Delete Security Policy')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Deny Production DB')).toBeInTheDocument();

    // Click Delete again, and Confirm
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    expect(await screen.findByText('Delete Security Policy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Delete Policy/i }));

    await waitFor(() => {
      expect(screen.getByText(/No policies configured/i)).toBeInTheDocument();
    });
  });

  it('filters policies by search term, role, and action honestly', async () => {
    const mockPolicies: VpnPolicyDto[] = [
      {
        id: 'pol-1',
        name: 'Allow Internal Web',
        role: RoleName.STAFF,
        targetCidr: '10.20.0.0/16',
        protocol: PolicyProtocol.TCP,
        portRange: '80,443',
        action: PolicyAction.ALLOW,
        priority: 100,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'pol-2',
        name: 'Deny Database Direct',
        role: RoleName.CLIENT,
        targetCidr: '10.30.0.0/16',
        protocol: PolicyProtocol.TCP,
        portRange: '5432',
        action: PolicyAction.DENY,
        priority: 200,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/policies')) {
        return new Response(JSON.stringify({ items: mockPolicies }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    renderWithQuery(
      <App
        initialSession={{
          accessToken: 'admin-token',
          user: {
            id: 'u-admin',
            username: 'admin.user',
            email: 'admin@mango.local',
            role: RoleName.ADMIN,
            totpEnabled: true,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Policies$/i }));

    await waitFor(() => {
      expect(screen.getByText('Allow Internal Web')).toBeInTheDocument();
      expect(screen.getByText('Deny Database Direct')).toBeInTheDocument();
      expect(screen.getByText('2 / 2 Policies')).toBeInTheDocument();
    });

    // Test Search input
    const searchInput = screen.getByLabelText(/Search policies/i);
    fireEvent.change(searchInput, { target: { value: 'Internal' } });
    expect(screen.getByText('Allow Internal Web')).toBeInTheDocument();
    expect(screen.queryByText('Deny Database Direct')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 2 Policies')).toBeInTheDocument();

    // Clear search
    fireEvent.click(screen.getByLabelText(/Clear search/i));
    expect(screen.getByText('Deny Database Direct')).toBeInTheDocument();

    // Filter by Role: CLIENT
    const roleSelect = screen.getByLabelText(/Role:/i);
    fireEvent.change(roleSelect, { target: { value: RoleName.CLIENT } });
    expect(screen.queryByText('Allow Internal Web')).not.toBeInTheDocument();
    expect(screen.getByText('Deny Database Direct')).toBeInTheDocument();

    // Filter by Action: ALLOW (no match for CLIENT + ALLOW)
    const actionSelect = screen.getByLabelText(/Action:/i);
    fireEvent.change(actionSelect, { target: { value: PolicyAction.ALLOW } });
    expect(screen.getByText(/No policies match your search or filters/i)).toBeInTheDocument();

    // Click Clear Filters button
    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/i }));
    expect(screen.getByText('Allow Internal Web')).toBeInTheDocument();
    expect(screen.getByText('Deny Database Direct')).toBeInTheDocument();
  });
});
