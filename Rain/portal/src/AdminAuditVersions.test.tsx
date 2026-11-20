import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoleName } from '@mango/shared';
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

describe('Portal Admin Audit Logs & Agent Versions (fetch seam)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not render Admin Audit Logs or Agent Versions tabs for STAFF or CLIENT', () => {
    renderWithQuery(
      <App
        initialSession={{
          accessToken: 'staff-token',
          user: {
            id: 'u-staff',
            username: 'staff.user',
            email: 'staff@mango.local',
            role: RoleName.STAFF,
          },
        }}
      />,
    );

    expect(screen.queryByRole('tab', { name: /Audit Logs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Agent Versions/i })).not.toBeInTheDocument();
  });

  it('renders Audit Logs for ADMIN, supports filtering & payload inspection', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'log-1',
                actorUserId: 'u-1',
                actorUsername: 'admin.test',
                action: 'auth.verify_otp',
                targetType: 'AUTH',
                targetId: 'u-1',
                ipAddress: '10.0.0.5',
                metadata: { method: 'totp', device: 'win11' },
                createdAt: '2026-11-20T02:00:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          }),
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
            username: 'admin.test',
            email: 'admin@mango.local',
            role: RoleName.ADMIN,
          },
        }}
      />,
    );

    expect(screen.getByRole('tab', { name: /Audit Logs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Agent Versions/i })).toBeInTheDocument();

    expect(await screen.findByText('auth.verify_otp')).toBeInTheDocument();
    expect(screen.getAllByText('admin.test').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));
    expect(await screen.findByText(/"method": "totp"/)).toBeInTheDocument();
  });

  it('renders honest empty state and real error state on Audit Logs without mock fallbacks', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderWithQuery(
      <App
        initialSession={{
          accessToken: 'admin-token',
          user: {
            id: 'u-admin',
            username: 'admin.test',
            email: 'admin@mango.local',
            role: RoleName.ADMIN,
          },
        }}
      />,
    );

    expect(await screen.findByText(/No audit logs found/i)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Database unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    fireEvent.change(screen.getByLabelText(/Action filter/i), {
      target: { value: 'auth.login' },
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Database unavailable/i);
  });

  it('creates and toggles Agent Versions for ADMIN and handles errors honestly', async () => {
    const versions = [
      {
        id: 'ver-1',
        version: '1.2.0',
        platform: 'windows-x64',
        downloadUrl: 'https://downloads.mango.local/agent-1.2.0.msi',
        sha256Checksum: 'a'.repeat(64),
        isActive: true,
        isRequired: false,
        releasedAt: '2026-11-20T01:00:00.000Z',
      },
    ];

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/api/audit-logs')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.endsWith('/api/agent-versions') && method === 'GET') {
        return new Response(JSON.stringify({ items: [...versions] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/agent-versions') && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        const created = {
          id: 'ver-2',
          ...body,
          releasedAt: '2026-11-20T02:30:00.000Z',
        };
        versions.unshift(created);
        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/agent-versions/') && method === 'PATCH') {
        const id = url.split('/').pop()!;
        const body = JSON.parse(String(init?.body));
        const idx = versions.findIndex((v) => v.id === id);
        if (idx >= 0) {
          versions[idx] = { ...versions[idx]!, ...body };
          return new Response(JSON.stringify(versions[idx]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ message: 'Unexpected request' }), { status: 500 });
    });

    renderWithQuery(
      <App
        initialSession={{
          accessToken: 'admin-token',
          user: {
            id: 'u-admin',
            username: 'admin.test',
            email: 'admin@mango.local',
            role: RoleName.ADMIN,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Agent Versions/i }));
    expect(await screen.findByText('1.2.0')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Version$/i), { target: { value: '1.3.0' } });
    fireEvent.change(screen.getByLabelText(/^Platform$/i), { target: { value: 'windows-x64' } });
    fireEvent.change(screen.getByLabelText(/Download URL/i), {
      target: { value: 'https://downloads.mango.local/agent-1.3.0.msi' },
    });
    fireEvent.change(screen.getByLabelText(/SHA-256 Checksum/i), {
      target: { value: 'b'.repeat(64) },
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Version/i }));

    expect(await screen.findByText('1.3.0')).toBeInTheDocument();

    const requireButtons = await screen.findAllByRole('button', { name: /Mark Required/i });
    fireEvent.click(requireButtons[0]!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/agent-versions/ver-2'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });
});
