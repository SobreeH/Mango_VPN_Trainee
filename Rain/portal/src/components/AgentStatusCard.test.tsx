import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgentStatusCard } from './AgentStatusCard';

describe('AgentStatusCard (fetch seam)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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
});
