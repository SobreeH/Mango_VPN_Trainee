import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Key, Power, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import type { AgentHealthResponse, AgentStatusResponse } from '@mango/shared';
import {
  AgentHttpError,
  checkAgentHealth,
  connectAgent,
  disconnectAgent,
  fetchAgentStatus,
  requestConnectTicket,
} from '../api/agent';

type AgentViewState =
  | { kind: 'checking' }
  | { kind: 'unreachable'; reason: string }
  | { kind: 'unpaired'; health: AgentHealthResponse; error: string | null }
  | { kind: 'paired'; health: AgentHealthResponse; status: AgentStatusResponse };

export interface AgentStatusCardProps {
  accessToken?: string;
}

export function AgentStatusCard({ accessToken }: AgentStatusCardProps) {
  const [view, setView] = useState<AgentViewState>({ kind: 'checking' });
  const [pairingToken, setPairingToken] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [isTunnelBusy, setIsTunnelBusy] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);

  const probeAgent = useCallback(async (tokenToCheck?: string) => {
    setView({ kind: 'checking' });
    let health: AgentHealthResponse;
    try {
      health = await checkAgentHealth();
    } catch (err) {
      setView({
        kind: 'unreachable',
        reason: err instanceof Error ? err.message : 'Local Windows Agent is not responding',
      });
      return;
    }

    const activeToken = (tokenToCheck ?? '').trim();
    if (!activeToken) {
      setView({ kind: 'unpaired', health, error: null });
      return;
    }

    try {
      const status = await fetchAgentStatus(activeToken);
      setView({ kind: 'paired', health, status });
    } catch (err) {
      const message =
        err instanceof AgentHttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to pair with local agent';
      setView({ kind: 'unpaired', health, error: message });
    }
  }, []);

  useEffect(() => {
    void probeAgent();
  }, [probeAgent]);

  async function handlePairSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = pairingToken.trim();
    if (!trimmed) {
      if (view.kind === 'unpaired') {
        setView({ ...view, error: 'Pairing token is required' });
      }
      return;
    }
    setIsPairing(true);
    try {
      if (view.kind === 'unpaired') {
        try {
          const status = await fetchAgentStatus(trimmed);
          setView({ kind: 'paired', health: view.health, status });
        } catch (err) {
          const message =
            err instanceof AgentHttpError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Failed to pair with local agent';
          setView({ kind: 'unpaired', health: view.health, error: message });
        }
      } else {
        await probeAgent(trimmed);
      }
    } finally {
      setIsPairing(false);
    }
  }

  async function handleConnectVpn() {
    if (view.kind !== 'paired' || !accessToken) return;
    setTunnelError(null);
    setIsTunnelBusy(true);
    try {
      const { ticket } = await requestConnectTicket(accessToken);
      const res = await connectAgent(pairingToken.trim(), ticket);
      setView({
        ...view,
        status: {
          ...view.status,
          state: res.state,
          publicKey: res.publicKey,
          assignedIp: res.assignedIp,
          serverEndpoint: res.serverEndpoint,
          allowedIps: res.allowedIps ?? view.status.allowedIps,
          sessionId: res.sessionId ?? null,
          connectedSince: res.connectedSince,
          lastError: null,
        },
      });
    } catch (err) {
      setTunnelError(err instanceof Error ? err.message : 'Failed to connect VPN');
    } finally {
      setIsTunnelBusy(false);
    }
  }

  async function handleDisconnectVpn() {
    if (view.kind !== 'paired') return;
    setTunnelError(null);
    setIsTunnelBusy(true);
    try {
      const res = await disconnectAgent(pairingToken.trim());
      setView({
        ...view,
        status: {
          ...view.status,
          state: res.state,
          assignedIp: null,
          serverEndpoint: null,
          allowedIps: [],
          sessionId: null,
          connectedSince: null,
          lastError: null,
        },
      });
    } catch (err) {
      setTunnelError(err instanceof Error ? err.message : 'Failed to disconnect VPN');
    } finally {
      setIsTunnelBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Windows Agent
        </span>
        <button
          type="button"
          onClick={() => void probeAgent(pairingToken)}
          aria-label="Refresh Agent Status"
          className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh</span>
        </button>
      </div>

      {view.kind === 'checking' && (
        <p className="text-xs text-slate-400">Checking local Windows Agent...</p>
      )}

      {view.kind === 'unreachable' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-red-300">
            <WifiOff className="h-4 w-4 text-red-400" />
            <span>Agent Unreachable</span>
          </div>
          <p className="text-xs text-slate-400">
            Start the local MANGO Windows Agent on 127.0.0.1:47821 ({view.reason}).
          </p>
        </div>
      )}

      {view.kind === 'unpaired' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <Key className="h-4 w-4" />
              <span>Agent Reachable (Unpaired)</span>
            </div>
            <span className="text-xs text-slate-400">v{view.health.version}</span>
          </div>

          {view.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded border border-red-500/40 bg-red-950/50 p-2 text-xs text-red-200"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
              <span>{view.error}</span>
            </div>
          )}

          <form onSubmit={handlePairSubmit} className="space-y-2" noValidate>
            <label
              htmlFor="agent-pairing-token"
              className="block text-xs font-medium text-slate-300"
            >
              Agent Pairing Token
            </label>
            <div className="flex gap-2">
              <input
                id="agent-pairing-token"
                type="password"
                value={pairingToken}
                onChange={(e) => setPairingToken(e.target.value)}
                placeholder="Paste X-Mango-Agent-Token"
                className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isPairing}
                className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {isPairing ? 'Pairing...' : 'Pair Agent'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view.kind === 'paired' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Agent Paired &amp; Ready</span>
            </div>
            <span className="text-xs text-slate-400">v{view.health.version}</span>
          </div>

          {tunnelError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded border border-red-500/40 bg-red-950/50 p-2 text-xs text-red-200"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
              <span>{tunnelError}</span>
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Tunnel State</span>
              <span
                className={`font-mono font-semibold ${
                  view.status.state === 'connected' ? 'text-emerald-300' : 'text-slate-200'
                }`}
              >
                {view.status.state}
              </span>
            </div>

            {view.status.assignedIp && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Assigned VPN IP</span>
                <span className="font-mono text-amber-300">{view.status.assignedIp}</span>
              </div>
            )}

            {view.status.serverEndpoint && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Gateway Endpoint</span>
                <span className="font-mono text-slate-300">{view.status.serverEndpoint}</span>
              </div>
            )}

            {view.status.allowedIps && view.status.allowedIps.length > 0 && (
              <div className="flex items-start justify-between gap-2 text-slate-400">
                <span>Permitted Networks</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {view.status.allowedIps.map((cidr) => (
                    <span
                      key={cidr}
                      className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-200"
                    >
                      {cidr}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-400">
              <span>Curve25519 Key</span>
              <span className="font-mono text-slate-300">
                {view.status.publicKey.slice(0, 12)}...
              </span>
            </div>
          </div>

          {view.status.state === 'connected' ? (
            <button
              type="button"
              disabled={isTunnelBusy}
              onClick={() => void handleDisconnectVpn()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/60 disabled:opacity-50"
            >
              <Power className="h-3.5 w-3.5" />
              <span>{isTunnelBusy ? 'Disconnecting...' : 'Disconnect VPN'}</span>
            </button>
          ) : (
            accessToken && (
              <button
                type="button"
                disabled={isTunnelBusy}
                onClick={() => void handleConnectVpn()}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{isTunnelBusy ? 'Connecting...' : 'Connect VPN'}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
