import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoleName, VpnProviderType } from '@mango/shared';
import { AgentStatusCard } from './AgentStatusCard';

describe('AgentStatusCard (fetch seam)', () => {
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

  it('displays Agent Unreachable when /health fails with a network error and never fakes readiness', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<AgentStatusCard />);

    await waitFor(() => {
      expect(screen.getByText(/agent unreachable/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/paired & ready/i)).not.toBeInTheDocument();
  });

  it('displays Agent Reachable (Unpaired) when /health succeeds and no pairing token is set', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'mango-agent-windows',
          version: '2.0.0',
          tunnelActive: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<AgentStatusCard />);

    await waitFor(() => {
      expect(screen.getByText(/agent reachable \(unpaired\)/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/v2\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/agent pairing token/i)).toBeInTheDocument();
  });

  it('stays Unpaired and shows server error when /status rejects pairing token with 401', async () => {
    fetchMock
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
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_PAIRING_TOKEN',
              message: 'Missing or invalid pairing token',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    render(<AgentStatusCard />);

    await waitFor(() => {
      expect(screen.getByLabelText(/agent pairing token/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/agent pairing token/i), {
      target: { value: 'wrong-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pair agent/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/missing or invalid pairing token/i);
    });
    expect(screen.getByText(/agent reachable \(unpaired\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/paired & ready/i)).not.toBeInTheDocument();
  });

  it('displays Agent Paired & Ready when /health and /status succeed with valid pairing token', async () => {
    fetchMock
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
        new Response(
          JSON.stringify({
            state: 'disconnected',
            version: '2.0.0',
            publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            assignedIp: null,
            serverEndpoint: null,
            connectedSince: null,
            bytesReceived: 0,
            bytesSent: 0,
            lastError: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    render(<AgentStatusCard />);

    await waitFor(() => {
      expect(screen.getByLabelText(/agent pairing token/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/agent pairing token/i), {
      target: { value: 'valid-pairing-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pair agent/i }));

    await waitFor(() => {
      expect(screen.getByText(/agent paired & ready/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:47821/status',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'X-Mango-Agent-Token': 'valid-pairing-token',
        }),
      }),
    );
  });

  it('connects VPN via ticket + agent /connect, displays assigned IP and permitted networks, and disconnects', async () => {
    fetchMock
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
        new Response(
          JSON.stringify({
            state: 'disconnected',
            version: '2.0.0',
            publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            assignedIp: null,
            serverEndpoint: null,
            allowedIps: [],
            connectedSince: null,
            bytesReceived: 0,
            bytesSent: 0,
            lastError: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ticket: 'one-time-connect-ticket',
            expiresAt: '2026-11-20T03:00:00Z',
            expiresInSeconds: 60,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'WireGuard tunnel connected',
            state: 'connected',
            publicKey: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
            sessionId: 'sess-123',
            assignedIp: '10.13.13.4',
            serverEndpoint: 'vpn.mango.internal:51820',
            allowedIps: ['10.20.0.0/16'],
            connectedSince: '2026-11-20T02:59:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'WireGuard tunnel disconnected',
            state: 'disconnected',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    render(<AgentStatusCard accessToken="jwt-access-token" userRole={RoleName.STAFF} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/agent pairing token/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/agent pairing token/i), {
      target: { value: 'valid-pairing-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pair agent/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect vpn/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /connect vpn/i }));

    await waitFor(() => {
      expect(screen.getByText('10.13.13.4')).toBeInTheDocument();
    });
    expect(screen.getByText('10.20.0.0/16')).toBeInTheDocument();
    expect(screen.getByText(/^connected$/i)).toBeInTheDocument();
    expect(screen.getByText(/connected role/i)).toBeInTheDocument();
    expect(screen.getByText('STAFF')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /disconnect vpn/i }));

    await waitFor(() => {
      expect(screen.getByText(/^disconnected$/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('10.13.13.4')).not.toBeInTheDocument();
    expect(screen.queryByText(/connected role/i)).not.toBeInTheDocument();
  });

  it('surfaces connect errors honestly without faking connected state', async () => {
    fetchMock
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
        new Response(
          JSON.stringify({
            state: 'disconnected',
            version: '2.0.0',
            publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            assignedIp: null,
            serverEndpoint: null,
            allowedIps: [],
            connectedSince: null,
            bytesReceived: 0,
            bytesSent: 0,
            lastError: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ticket: 'expired-ticket',
            expiresAt: '2026-11-20T03:00:00Z',
            expiresInSeconds: 60,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'API_CONNECT_REJECTED',
              message: 'Connect ticket has expired',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    render(<AgentStatusCard accessToken="jwt-access-token" userRole={RoleName.STAFF} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/agent pairing token/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/agent pairing token/i), {
      target: { value: 'valid-pairing-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pair agent/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect vpn/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /connect vpn/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/connect ticket has expired/i);
    });
    expect(screen.queryByText(/^connected$/i)).not.toBeInTheDocument();
  });

  it('connects via selected Fortinet provider and forwards providerType to local agent', async () => {
    fetchMock
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
        new Response(
          JSON.stringify({
            state: 'disconnected',
            version: '2.0.0',
            publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            providerType: VpnProviderType.WIREGUARD,
            assignedIp: null,
            serverEndpoint: null,
            allowedIps: [],
            connectedSince: null,
            bytesReceived: 0,
            bytesSent: 0,
            lastError: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ticket: 'fg-ticket-1',
            expiresAt: '2026-11-24T03:00:00Z',
            expiresInSeconds: 60,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Fortinet SSL-VPN tunnel connected',
            state: 'connected',
            providerType: VpnProviderType.FORTINET,
            peerIdentity: 'fortinet-alice-1',
            publicKey: 'fortinet-alice-1',
            sessionId: 'sess-fg-1',
            assignedIp: '10.40.0.2',
            serverEndpoint: 'fg.mango.internal:443',
            allowedIps: ['10.20.0.0/16'],
            connectedSince: '2026-11-24T02:59:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    render(<AgentStatusCard accessToken="jwt-access-token" userRole={RoleName.STAFF} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/agent pairing token/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/agent pairing token/i), {
      target: { value: 'valid-pairing-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pair agent/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/vpn provider/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/vpn provider/i), {
      target: { value: `default:${VpnProviderType.FORTINET}` },
    });
    fireEvent.click(screen.getByRole('button', { name: /connect vpn/i }));

    await waitFor(() => {
      expect(screen.getByText('10.40.0.2')).toBeInTheDocument();
    });

    expect(screen.getByText('fg.mango.internal:443')).toBeInTheDocument();
    expect(screen.getAllByText(/Fortinet SSL-VPN/i).length).toBeGreaterThan(0);

    const agentConnectCall = fetchMock.mock.calls[3]!;
    expect(agentConnectCall[0]).toBe('http://127.0.0.1:47821/connect');
    expect(JSON.parse(String(agentConnectCall[1]?.body))).toEqual(
      expect.objectContaining({
        ticket: 'fg-ticket-1',
        providerType: VpnProviderType.FORTINET,
      }),
    );
  });

  it('allows inspecting Client, Gateway, and Network topology nodes interactively', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
            service: 'mango-agent-windows',
            version: '2.0.0',
            tunnelActive: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: 'connected',
            version: '2.0.0',
            publicKey: 'PUBKEY1234567890ABCDEF',
            assignedIp: '10.13.13.9',
            serverEndpoint: 'vpn.mango.internal:51820',
            allowedIps: ['10.20.0.0/16', '10.25.0.0/16'],
            connectedSince: '2026-11-25T02:00:00Z',
            bytesReceived: 2048,
            bytesSent: 1024,
            lastError: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    render(<AgentStatusCard accessToken="jwt-token" userRole={RoleName.STAFF} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/agent pairing token/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/agent pairing token/i), {
      target: { value: 'valid-pairing-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pair agent/i }));

    expect(await screen.findByText('TUNNEL ACTIVE')).toBeInTheDocument();

    // Inspect Client Node
    fireEvent.click(screen.getByRole('button', { name: /Inspect client node/i }));
    const region = screen.getByRole('region', { name: /Topology node details/i });
    expect(region).toHaveTextContent('10.13.13.9');

    // Inspect Gateway Node
    fireEvent.click(screen.getByRole('button', { name: /Inspect gateway node/i }));
    expect(region).toHaveTextContent('PUBKEY1234');
    expect(region).toHaveTextContent('CONNECTED (Zero-Trust)');

    // Inspect Network Node
    fireEvent.click(screen.getByRole('button', { name: /Inspect network node/i }));
    expect(region).toHaveTextContent('10.25.0.0/16');

    // Close inspector
    fireEvent.click(screen.getByRole('button', { name: /Close node details/i }));
    expect(screen.queryByRole('region', { name: /Topology node details/i })).not.toBeInTheDocument();
  });

  it('supports English language (lang="en") and Light mode (isDark={false}) in AgentStatusCard and NetworkTopology', async () => {
    fetchMock
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
        new Response(
          JSON.stringify({
            state: 'disconnected',
            version: '2.0.0',
            publicKey: 'PUBKEY1234567890ABCDEF',
            assignedIp: null,
            serverEndpoint: null,
            allowedIps: [],
            connectedSince: null,
            bytesReceived: 0,
            bytesSent: 0,
            lastError: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    render(
      <AgentStatusCard
        accessToken="jwt-token"
        userRole={RoleName.CLIENT}
        lang="en"
        isDark={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/agent pairing token/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/agent pairing token/i), {
      target: { value: 'valid-pairing-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pair agent/i }));

    expect(await screen.findByText('Ready to Connect VPN')).toBeInTheDocument();
    expect(screen.getByText('Your Device')).toBeInTheDocument();
    expect(screen.getByText('Corporate Network')).toBeInTheDocument();
    expect(screen.getByText('Permitted Networks')).toBeInTheDocument();
  });
});
