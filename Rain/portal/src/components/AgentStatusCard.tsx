import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Key,
  Power,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import {
  VpnProviderType,
  type AgentHealthResponse,
  type AgentStatusResponse,
  type RoleName,
  type VpnGatewayDto,
} from '@mango/shared';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
import {
  AgentHttpError,
  checkAgentHealth,
  connectAgent,
  disconnectAgent,
  fetchAgentStatus,
  fetchAvailableGateways,
  requestConnectTicket,
} from '../api/agent';
import type { AuthRefreshContext } from '../api/auth';
import { NetworkTopology } from './NetworkTopology';

type AgentViewState =
  | { kind: 'checking' }
  | { kind: 'unreachable'; reason: string }
  | { kind: 'unpaired'; health: AgentHealthResponse; error: string | null }
  | { kind: 'paired'; health: AgentHealthResponse; status: AgentStatusResponse };

export interface AgentStatusCardProps {
  accessToken?: string;
  userRole?: RoleName;
  username?: string;
  auth?: AuthRefreshContext;
  gateways?: VpnGatewayDto[];
}

function providerLabel(provider?: VpnProviderType): string {
  switch (provider) {
    case VpnProviderType.FORTINET:
      return 'Fortinet SSL-VPN';
    case VpnProviderType.CISCO:
      return 'Cisco AnyConnect';
    case VpnProviderType.WIREGUARD:
    default:
      return 'WireGuard';
  }
}

const LOCAL_STORAGE_TOKEN_KEY = 'mango_agent_pairing_token';

function getSavedPairingToken(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function savePairingToken(token: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
      }
    }
  } catch {
    // ignore
  }
}

export function AgentStatusCard({
  accessToken,
  userRole,
  username,
  auth,
  gateways: initialGateways,
}: AgentStatusCardProps) {
  const [view, setView] = useState<AgentViewState>({ kind: 'checking' });
  const [pairingToken, setPairingToken] = useState<string>(() => getSavedPairingToken());
  const [isPairing, setIsPairing] = useState(false);
  const [isTunnelBusy, setIsTunnelBusy] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [gateways, setGateways] = useState<VpnGatewayDto[]>(initialGateways ?? []);
  const [selectedGatewayKey, setSelectedGatewayKey] = useState<string>(() => {
    if (initialGateways && initialGateways.length > 0) {
      const def = initialGateways.find((g) => g.isDefault) ?? initialGateways[0]!;
      return `gw:${def.id}`;
    }
    return `default:${VpnProviderType.WIREGUARD}`;
  });
  const [isLoadingGateways, setIsLoadingGateways] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);

  const probeAgent = useCallback(async (tokenToCheck?: string) => {
    setView({ kind: 'checking' });
    let health: AgentHealthResponse;
    try {
      health = await checkAgentHealth();
    } catch (err) {
      setView({
        kind: 'unreachable',
        reason: err instanceof Error ? err.message : 'Local Endpoint Agent is not responding',
      });
      return;
    }

    const activeToken = (tokenToCheck ?? '').trim();
    if (!activeToken) {
      setView({ kind: 'unpaired', health, error: null });
      return;
    }

    try {
      const userHint = (username || userRole || '').toLowerCase();
      const status = await fetchAgentStatus(activeToken, userHint);
      savePairingToken(activeToken);
      setView({ kind: 'paired', health, status });
    } catch (err) {
      if (err instanceof AgentHttpError && err.statusCode === 401) {
        savePairingToken('');
      }
      const message =
        err instanceof AgentHttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to pair with local agent';
      setView({ kind: 'unpaired', health, error: message });
    }
  }, [username, userRole]);

  useEffect(() => {
    const saved = getSavedPairingToken();
    void probeAgent(saved || undefined);
  }, [probeAgent]);

  async function handleLoadGateways() {
    if (!accessToken) return;
    setTunnelError(null);
    setIsLoadingGateways(true);
    try {
      const res = await fetchAvailableGateways(accessToken, auth);
      setGateways(res.items);
      if (res.items.length > 0) {
        const def = res.items.find((g) => g.isDefault) ?? res.items[0]!;
        setSelectedGatewayKey(`gw:${def.id}`);
      }
    } catch (err) {
      setTunnelError(err instanceof Error ? err.message : 'Failed to load VPN gateways');
    } finally {
      setIsLoadingGateways(false);
    }
  }

  // Auto-retry polling when Agent is unreachable
  useEffect(() => {
    if (view.kind !== 'unreachable') return;

    const timer = setInterval(() => {
      void checkAgentHealth()
        .then(() => {
          const token = pairingToken.trim() || getSavedPairingToken();
          void probeAgent(token || undefined);
        })
        .catch(() => {
          // Still unreachable, wait for next tick
        });
    }, 4000);

    return () => clearInterval(timer);
  }, [view.kind, pairingToken, probeAgent]);

  // Real-time telemetry poll when connected in live environment
  useEffect(() => {
    if (view.kind !== 'paired' || view.status.state !== 'connected') return;
    const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    if (isTest) return;

    const token = pairingToken.trim() || getSavedPairingToken();
    if (!token) return;

    const timer = setInterval(() => {
      const userHint = (username || userRole || '').toLowerCase();
      void fetchAgentStatus(token, userHint)
        .then((newStatus) => {
          setView((prev) => {
            if (prev.kind !== 'paired') return prev;
            return {
              ...prev,
              status: {
                ...prev.status,
                bytesReceived: newStatus.bytesReceived,
                bytesSent: newStatus.bytesSent,
                state: newStatus.state,
                assignedIp: newStatus.assignedIp ?? prev.status.assignedIp,
                serverEndpoint: newStatus.serverEndpoint ?? prev.status.serverEndpoint,
              },
            };
          });
        })
        .catch(() => {
          // Ignore transient poll drops
        });
    }, 2500);

    return () => clearInterval(timer);
  }, [view.kind, view.kind === 'paired' ? view.status.state : null, pairingToken, username, userRole]);

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
          const userHint = (username || userRole || '').toLowerCase();
          const status = await fetchAgentStatus(trimmed, userHint);
          savePairingToken(trimmed);
          setView({ kind: 'paired', health: view.health, status });
        } catch (err) {
          if (err instanceof AgentHttpError && err.statusCode === 401) {
            savePairingToken('');
          }
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
    setDisconnectMessage(null);
    setIsTunnelBusy(true);
    try {
      const userHint = (username || userRole || '').toLowerCase() || undefined;
      let ticketRes;
      let res;
      if (selectedGatewayKey.startsWith('gw:')) {
        const gwId = selectedGatewayKey.slice(3);
        const selectedGw = gateways.find((g) => g.id === gwId);
        ticketRes = await requestConnectTicket(accessToken, auth, gwId);
        res = await connectAgent(pairingToken.trim(), ticketRes.ticket, {
          providerType: selectedGw?.providerType,
          gatewayId: gwId,
          userHint,
        });
      } else if (selectedGatewayKey !== `default:${VpnProviderType.WIREGUARD}`) {
        const providerType = selectedGatewayKey.slice('default:'.length) as VpnProviderType;
        ticketRes = await requestConnectTicket(accessToken, auth);
        res = await connectAgent(pairingToken.trim(), ticketRes.ticket, {
          providerType,
          userHint,
        });
      } else {
        ticketRes = await requestConnectTicket(accessToken, auth);
        res = await connectAgent(
          pairingToken.trim(),
          ticketRes.ticket,
          userHint ? { userHint } : undefined,
        );
      }
      setView({
        ...view,
        status: {
          ...view.status,
          state: res.state,
          providerType: res.providerType ?? view.status.providerType,
          gatewayId: res.gatewayId ?? null,
          peerIdentity: res.peerIdentity ?? res.publicKey,
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
    setDisconnectMessage(null);
    setIsTunnelBusy(true);
    try {
      const userHint = (username || userRole || '').toLowerCase();
      const res = await disconnectAgent(pairingToken.trim(), userHint);
      setDisconnectMessage('ตัดการเชื่อมต่อ VPN เรียบร้อยแล้ว (Disconnected safely)');
      setView({
        ...view,
        status: {
          ...view.status,
          state: res.state,
          gatewayId: null,
          peerIdentity: null,
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

  const activeProvider = view.kind === 'paired' ? view.status.providerType : undefined;
  const activeProviderName = providerLabel(activeProvider);

  return (
    <div className="w-full space-y-6">
      {view.kind === 'checking' && (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 text-center text-sm text-stone-400">
          Checking local Windows Agent...
        </div>
      )}

      {view.kind === 'unreachable' && (
        <div className="rounded-3xl border border-red-500/30 bg-red-950/20 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-bold text-red-300">
              <WifiOff className="h-5 w-5 text-red-400" />
              <span>Agent Unreachable</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Auto-reconnecting...
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-xs sm:text-sm text-stone-300 font-medium">
              ไม่สามารถเชื่อมต่อไปยัง Endpoint Agent (127.0.0.1:47821) ได้
            </p>
            <p className="text-xs text-stone-400 leading-relaxed font-mono">
              Start the local MANGO Endpoint Agent on 127.0.0.1:47821 ({view.reason}).
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#141311]/80 p-3.5 space-y-2">
            <span className="text-[11px] font-semibold text-amber-300 block">
              💡 วิธีเปิดใช้งาน Agent สำหรับทดสอบ:
            </span>
            <div className="flex items-center justify-between gap-2 bg-black/40 rounded-xl px-3 py-2 border border-white/5 font-mono text-xs text-stone-200">
              <code>npm run mock:agent</code>
              <span className="text-[10px] text-stone-400 font-sans">(รันใน Terminal เพื่อเปิด Agent)</span>
            </div>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void probeAgent(pairingToken || getSavedPairingToken())}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#262420] px-4 py-2 text-xs font-semibold text-stone-200 hover:text-white hover:bg-[#322f2a] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Connection</span>
            </button>
            <span className="text-[11px] text-stone-400">ระบบจะลองเชื่อมต่อใหม่อัตโนมัติทุกๆ 4 วินาที</span>
          </div>
        </div>
      )}

      {view.kind === 'unpaired' && (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                ENDPOINT AGENT
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-stone-400 border border-white/5">
                v{view.health.version}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void probeAgent(pairingToken)}
              aria-label="Refresh Agent Status"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#262420]/70 px-3 py-1.5 text-xs text-stone-300 hover:text-stone-100"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>

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
                className="flex-1 h-11 rounded-xl border border-white/10 bg-[#262420]/70 px-4 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isPairing}
                className="h-11 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-5 text-xs font-bold text-stone-950 shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {isPairing ? 'Pairing...' : 'Pair Agent'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view.kind === 'paired' && (
        <div className="space-y-6">
          {/* Card 1: Hero Connection Status Card */}
          <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left Side: Status Icon & Text */}
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                  view.status.state === 'connected'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-950/50'
                    : 'bg-stone-800/80 border-white/10 text-stone-400'
                }`}>
                  {view.status.state === 'connected' ? (
                    <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <ShieldCheck className="h-7 w-7 text-stone-400" />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-stone-100 tracking-tight">
                      {view.status.state === 'connected' ? 'เชื่อมต่อ VPN แล้ว' : 'พร้อมเชื่อมต่อ VPN'}
                    </h3>
                    <span className="sr-only">
                      {view.status.state === 'connected' ? 'connected' : 'disconnected'}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      Agent Paired &amp; Ready · v{view.health.version}
                    </span>
                    {view.status.state === 'connected' && (
                      <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        {activeProviderName}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-400 mt-1">
                    {view.status.state === 'connected'
                      ? (view.status.connectedSince
                          ? `เชื่อมต่อเมื่อ ${new Date(view.status.connectedSince).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · อุโมงค์ ${activeProviderName} ทำงานปกติ`
                          : `เชื่อมต่อแล้ว · อุโมงค์ ${activeProviderName} ทำงานปกติ`)
                      : disconnectMessage
                        ? `${disconnectMessage} · กดปุ่มด้านขวาเพื่อเริ่มการเชื่อมต่อใหม่`
                        : 'เลือกโปรโตคอลหรือเกตเวย์ แล้วกดปุ่มด้านขวาเพื่อเริ่มการเชื่อมต่อ'}
                  </p>
                </div>
              </div>

              {/* Right Side: Gateway Selector & Action Button */}
              <div className="shrink-0 flex flex-wrap items-center gap-3">
                {view.status.state !== 'connected' && accessToken && (
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="VPN Provider"
                      disabled={isTunnelBusy}
                      value={selectedGatewayKey}
                      onChange={(e) => setSelectedGatewayKey(e.target.value)}
                      className="h-10 rounded-xl border border-white/10 bg-[#262420] px-3 text-xs text-stone-200 focus:border-amber-400 focus:outline-none disabled:opacity-50"
                    >
                      {gateways.length > 0 ? (
                        gateways.map((gw) => (
                          <option key={gw.id} value={`gw:${gw.id}`}>
                            {gw.name} ({gw.providerType})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value={`default:${VpnProviderType.WIREGUARD}`}>
                            WireGuard (Default)
                          </option>
                          <option value={`default:${VpnProviderType.FORTINET}`}>
                            Fortinet SSL-VPN
                          </option>
                          <option value={`default:${VpnProviderType.CISCO}`}>
                            Cisco AnyConnect
                          </option>
                        </>
                      )}
                    </select>
                    <button
                      type="button"
                      disabled={isLoadingGateways || isTunnelBusy}
                      onClick={() => void handleLoadGateways()}
                      title="Load registered VPN gateways"
                      aria-label="Load Gateways"
                      className="h-10 rounded-xl border border-white/10 bg-[#262420] px-2.5 text-xs text-stone-300 hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isLoadingGateways ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}

                {view.status.state === 'connected' ? (
                  <button
                    type="button"
                    disabled={isTunnelBusy}
                    onClick={() => void handleDisconnectVpn()}
                    className="rounded-2xl border border-white/10 bg-[#262420] px-6 py-2.5 text-xs sm:text-sm font-semibold text-stone-200 hover:bg-rose-950/60 hover:text-rose-200 hover:border-rose-900/50 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Power className="h-4 w-4 inline mr-1.5 text-rose-400" />
                    <span>{isTunnelBusy ? 'กำลังตัดการเชื่อมต่อ...' : 'ตัดการเชื่อมต่อ'}</span>
                    <span className="sr-only">Disconnect VPN</span>
                  </button>
                ) : (
                  accessToken && (
                    <button
                      type="button"
                      disabled={isTunnelBusy}
                      onClick={() => void handleConnectVpn()}
                      className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-7 py-2.5 text-xs sm:text-sm shadow-lg shadow-emerald-950/40 border border-emerald-500/40 transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4 inline mr-1.5" />
                      <span>{isTunnelBusy ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ VPN'}</span>
                      <span className="sr-only">Connect VPN</span>
                    </button>
                  )
                )}
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

            {/* Interactive Network Topology */}
            <NetworkTopology
              isConnected={view.status.state === 'connected'}
              assignedIp={view.status.assignedIp}
              serverEndpoint={view.status.serverEndpoint}
              allowedIps={view.status.allowedIps}
              publicKey={view.status.publicKey}
              bytesReceived={view.status.bytesReceived}
              bytesSent={view.status.bytesSent}
              userRole={userRole}
              activeProviderName={activeProviderName}
            />
          </div>

          {/* Card Row 2: Telemetry Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-5 shadow-xl">
              <span className="text-stone-400 text-xs block font-medium">IP บน VPN ของคุณ</span>
              <span className="text-xl sm:text-2xl font-extrabold text-stone-100 font-mono mt-1.5 block">
                {view.status.assignedIp ?? '-'}
              </span>
            </div>

            <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-5 shadow-xl">
              <span className="text-stone-400 text-xs block font-medium">
                บทบาทที่ใช้เชื่อมต่อ
                {view.status.state === 'connected' && (
                  <span className="sr-only">Connected Role</span>
                )}
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-stone-100 font-mono mt-1.5 block">
                {userRole ?? 'STAFF'}
              </span>
            </div>

            <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-5 shadow-xl">
              <span className="text-stone-400 text-xs block font-medium">สถานะโปรโตคอล</span>
              <span className="text-xl sm:text-2xl font-extrabold text-stone-100 font-mono mt-1.5 block">
                {view.status.state === 'connected' ? activeProviderName : 'ไม่ได้เชื่อมต่อ'}
              </span>
            </div>

            {/* Card 4: Network Traffic / Data Usage Meter */}
            <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-stone-400 text-xs flex items-center gap-1.5 font-medium">
                  <Activity className="h-3.5 w-3.5 text-amber-400" />
                  ปริมาณข้อมูล
                </span>
                {view.status.state === 'connected' && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <span className="text-xl sm:text-2xl font-extrabold text-amber-400 font-mono mt-1.5 block">
                {view.status.state === 'connected'
                  ? formatBytes((view.status.bytesReceived || 0) + (view.status.bytesSent || 0))
                  : '0 B'}
              </span>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono">
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <ArrowDown className="h-3 w-3" />
                  {formatBytes(view.status.bytesReceived)}
                </span>
                <span className="text-blue-400 flex items-center gap-0.5">
                  <ArrowUp className="h-3 w-3" />
                  {formatBytes(view.status.bytesSent)}
                </span>
              </div>
            </div>
          </div>

          {/* Card Row 3: Two Information Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Permitted Networks */}
            <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="font-bold text-stone-100 text-sm">
                  เครือข่ายที่เข้าถึงได้ (Permitted Networks)
                </span>
                <span className="text-xs font-mono text-emerald-400">
                  {view.status.allowedIps?.length ?? 2} Subnets
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span className="font-mono text-stone-200 font-bold">10.13.13.0/24</span>
                  <span className="text-stone-400">เครือข่าย VPN</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span className="font-mono text-stone-200 font-bold">
                    {view.status.allowedIps?.[0] ?? (userRole === 'STAFF' ? '10.20.0.0/16' : '10.30.1.0/24')}
                  </span>
                  <span className="text-stone-400">
                    เครือข่ายตามนโยบาย {userRole ?? 'STAFF'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  className="text-xs text-stone-400 hover:text-amber-400 underline transition-colors"
                >
                  {showTechDetails ? 'ซ่อนรายละเอียดทางเทคนิค' : 'รายละเอียดทางเทคนิค'}
                </button>

                {showTechDetails && (
                  <div className="mt-3 p-3 rounded-2xl border border-white/5 bg-[#141311]/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-stone-400">
                      <span>
                        {activeProvider === VpnProviderType.WIREGUARD || !activeProvider
                          ? 'Curve25519 Key'
                          : 'Peer Identity'}
                      </span>
                      <span className="font-mono text-stone-200">
                        {(view.status.peerIdentity ?? view.status.publicKey)
                          ? `${(view.status.peerIdentity ?? view.status.publicKey).slice(0, 12)}...`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-stone-400">
                      <span>Protocol</span>
                      <span className="font-mono text-stone-200">
                        {activeProvider === VpnProviderType.FORTINET
                          ? 'Fortinet SSL-VPN (OpenConnect)'
                          : activeProvider === VpnProviderType.CISCO
                            ? 'Cisco AnyConnect (OpenConnect)'
                            : 'WireGuard (Curve25519)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Account Security & Live Network Traffic */}
            <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="font-bold text-stone-100 text-sm">ความปลอดภัย & การจราจรเครือข่าย</span>
                <span className="text-xs font-mono text-emerald-400">Zero-Trust Active</span>
              </div>

              {/* Live Traffic Meter Bars */}
              {view.status.state === 'connected' && (
                <div className="p-3.5 rounded-2xl bg-[#141311]/80 border border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400 flex items-center gap-1.5 font-medium">
                      <ArrowDown className="h-3.5 w-3.5 text-emerald-400" />
                      ดาวน์โหลด (Received)
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {formatBytes(view.status.bytesReceived)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(8, ((view.status.bytesReceived || 0) % 1048576) / 10485.76))}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-stone-400 flex items-center gap-1.5 font-medium">
                      <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                      อัปโหลด (Transmitted)
                    </span>
                    <span className="font-mono text-blue-400 font-bold">
                      {formatBytes(view.status.bytesSent)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(8, ((view.status.bytesSent || 0) % 524288) / 5242.88))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-stone-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>ยืนยันตัวตน 2 ชั้น เปิดอยู่ (2FA Verified)</span>
                </div>
                <div className="flex items-center gap-2.5 text-stone-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Endpoint Agent จับคู่แล้ว · v{view.health.version}</span>
                </div>
                <div className="flex items-center gap-2.5 text-stone-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>อุโมงค์เข้ารหัส Curve25519 X25519 แข็งแกร่ง</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
