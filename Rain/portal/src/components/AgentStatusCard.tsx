import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Key, Power, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import type { AgentHealthResponse, AgentStatusResponse, RoleName } from '@mango/shared';
import {
  AgentHttpError,
  checkAgentHealth,
  connectAgent,
  disconnectAgent,
  fetchAgentStatus,
  requestConnectTicket,
} from '../api/agent';
import type { AuthRefreshContext } from '../api/auth';

type AgentViewState =
  | { kind: 'checking' }
  | { kind: 'unreachable'; reason: string }
  | { kind: 'unpaired'; health: AgentHealthResponse; error: string | null }
  | { kind: 'paired'; health: AgentHealthResponse; status: AgentStatusResponse };

export interface AgentStatusCardProps {
  accessToken?: string;
  userRole?: RoleName;
  auth?: AuthRefreshContext;
}

export function AgentStatusCard({ accessToken, userRole, auth }: AgentStatusCardProps) {
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
      const { ticket } = await requestConnectTicket(accessToken, auth);
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
    <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 shadow-2xl backdrop-blur-xl max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Windows Agent
          </span>
          {view.kind !== 'checking' && 'health' in view && (
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-stone-400 border border-white/5">
              v{view.health.version}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void probeAgent(pairingToken)}
          aria-label="Refresh Agent Status"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#262420]/70 px-3 py-1.5 text-xs text-stone-300 hover:text-stone-100 hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh</span>
        </button>
      </div>

      {view.kind === 'checking' && (
        <p className="text-xs text-stone-400">Checking local Windows Agent...</p>
      )}

      {view.kind === 'unreachable' && (
        <div className="space-y-2 rounded-2xl border border-red-500/20 bg-red-950/20 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <WifiOff className="h-4 w-4 text-red-400" />
            <span>Agent Unreachable</span>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Start the local MANGO Windows Agent on 127.0.0.1:47821 ({view.reason}).
          </p>
        </div>
      )}

      {view.kind === 'unpaired' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <Key className="h-4 w-4" />
            <span>Agent Reachable (Unpaired)</span>
          </div>

          {view.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
              <span>{view.error}</span>
            </div>
          )}

          <form onSubmit={handlePairSubmit} className="space-y-3" noValidate>
            <label
              htmlFor="agent-pairing-token"
              className="block text-xs font-medium text-stone-300"
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
                className="flex-1 h-11 rounded-xl border border-white/10 bg-[#262420]/70 px-4 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isPairing}
                className="h-11 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-5 text-xs font-bold text-stone-950 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-colors"
              >
                {isPairing ? 'Pairing...' : 'Pair Agent'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view.kind === 'paired' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium border bg-[#162a1e]/90 border-emerald-900/40 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Agent Paired &amp; Ready</span>
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-400">Tunnel:</span>
              <span
                className={`font-mono font-semibold ${
                  view.status.state === 'connected' ? 'text-emerald-400' : 'text-stone-400'
                }`}
              >
                {view.status.state}
              </span>
            </div>
          </div>

          {tunnelError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
              <span>{tunnelError}</span>
            </div>
          )}

          <div className="rounded-2xl border border-white/5 bg-[#141311]/60 p-4 space-y-2 text-xs">
            {view.status.state === 'connected' && userRole && (
              <div className="flex items-center justify-between text-stone-400">
                <span>Connected Role</span>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                  {userRole}
                </span>
              </div>
            )}

            {view.status.assignedIp && (
              <div className="flex items-center justify-between text-stone-400">
                <span>Assigned VPN IP</span>
                <span className="font-mono text-amber-300 font-bold">{view.status.assignedIp}</span>
              </div>
            )}

            {view.status.serverEndpoint && (
              <div className="flex items-center justify-between text-stone-400">
                <span>Gateway Endpoint</span>
                <span className="font-mono text-stone-300">{view.status.serverEndpoint}</span>
              </div>
            )}

            {view.status.allowedIps && view.status.allowedIps.length > 0 && (
              <div className="flex items-start justify-between gap-2 text-stone-400">
                <span>Permitted Networks</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {view.status.allowedIps.map((cidr) => (
                    <span
                      key={cidr}
                      className="rounded bg-stone-800/80 border border-white/5 px-2 py-0.5 font-mono text-[11px] text-stone-200"
                    >
                      {cidr}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-stone-400">
              <span>Curve25519 Key</span>
              <span className="font-mono text-stone-400">
                {view.status.publicKey.slice(0, 12)}...
              </span>
            </div>
          </div>

          {/* Action Button: Ergonomically bounded & harmonious according to HCI */}
          <div className="pt-1 flex justify-center">
            {view.status.state === 'connected' ? (
              <button
                type="button"
                disabled={isTunnelBusy}
                onClick={() => void handleDisconnectVpn()}
                className="w-full sm:w-auto min-w-[200px] h-11 flex items-center justify-center gap-2 rounded-xl border border-rose-900/50 bg-[#381a1c] px-6 text-xs sm:text-sm font-bold text-rose-200 hover:bg-rose-900/60 hover:text-white transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                <Power className="h-4 w-4" />
                <span>{isTunnelBusy ? 'Disconnecting...' : 'Disconnect VPN'}</span>
              </button>
            ) : (
              accessToken && (
                <button
                  type="button"
                  disabled={isTunnelBusy}
                  onClick={() => void handleConnectVpn()}
                  className="w-full sm:w-auto min-w-[200px] h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 text-xs sm:text-sm shadow-lg shadow-emerald-950/40 border border-emerald-500/40 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{isTunnelBusy ? 'Connecting...' : 'Connect VPN'}</span>
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
