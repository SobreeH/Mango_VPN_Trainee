import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  User as UserIcon,
  Activity,
  ArrowRight,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import {
  LoginResponse,
  AuthTokenResponse,
  AgentHealthResponse,
  AgentStatusResponse,
} from '@mango/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const AGENT_BASE_URL = 'http://127.0.0.1:47821';

export default function App() {
  // Authentication State
  const [username, setUsername] = useState('admin_user');
  const [password, setPassword] = useState('MangoVPN2026!');
  const [mfaChallenge, setMfaChallenge] = useState<LoginResponse | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [authData, setAuthData] = useState<AuthTokenResponse | null>(null);

  // Status & Telemetry
  const [portalOnline, setPortalOnline] = useState<boolean>(true);
  const [agentInstalled, setAgentInstalled] = useState<boolean>(false);
  const [agentVersion, setAgentVersion] = useState<string>('');
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [assignedIp, setAssignedIp] = useState<string | null>(null);
  const [bytesRx, setBytesRx] = useState<number>(0);
  const [bytesTx, setBytesTx] = useState<number>(0);

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Poll backend health
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        setPortalOnline(res.ok);
      } catch {
        setPortalOnline(false);
      }
    };
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // 1. Healthcheck Poller for Local Agent (127.0.0.1:47821)
  useEffect(() => {
    const checkAgentHealth = async () => {
      try {
        const res = await fetch(`${AGENT_BASE_URL}/health`, {
          method: 'GET',
          mode: 'cors',
        });
        if (res.ok) {
          const data: AgentHealthResponse = await res.json();
          setAgentInstalled(true);
          setAgentVersion(data.version);
          if (data.tunnelActive) {
            setConnectionState('connected');
          }
        } else {
          setAgentInstalled(false);
        }
      } catch (e) {
        setAgentInstalled(false);
      }
    };

    checkAgentHealth();
    const interval = setInterval(checkAgentHealth, 3000);
    return () => clearInterval(interval);
  }, []);

  // 2. Telemetry Poller when Connected
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`${AGENT_BASE_URL}/status`);
        if (res.ok) {
          const status: AgentStatusResponse = await res.json();
          if (status.assignedIp) setAssignedIp(status.assignedIp);
          setBytesRx(status.bytesReceived);
          setBytesTx(status.bytesSent);
          if (status.state === 'disconnected') {
            setConnectionState('disconnected');
          }
        }
      } catch (e) {
        console.error('Failed to poll agent status', e);
      }
    };

    const interval = setInterval(pollStatus, 1500);
    return () => clearInterval(interval);
  }, [connectionState]);

  // 3. Handle Login (Step 1 -> 2)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Login failed. Please verify credentials.');
      }

      setMfaChallenge(json.data);
      setInfoMessage(`Verification code sent to ${json.data.maskedPhoneNumber}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to connect to Management API');
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Verify OTP (Step 3 -> 4)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: mfaChallenge.challengeId,
          otpCode,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Invalid verification code');
      }

      setAuthData(json.data);
      setMfaChallenge(null);
      setInfoMessage(`Authenticated as ${json.data.user.username} (${json.data.user.role})`);
    } catch (err: any) {
      setErrorMessage(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle VPN Connect (Step 5)
  const handleConnectVpn = async () => {
    if (!authData) return;
    if (!agentInstalled) {
      setErrorMessage('Local Windows Agent service not detected on 127.0.0.1:47821. Please run mock-agent.js or install the agent.');
      return;
    }

    setConnectionState('connecting');
    setLoading(true);
    setErrorMessage(null);

    try {
      // Browser commands local Windows Agent over loopback PNA
      const res = await fetch(`${AGENT_BASE_URL}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: authData.accessToken,
          backendUrl: API_BASE_URL,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Agent failed to establish WireGuard tunnel');
      }

      setConnectionState('connected');
      if (json.assignedIp) {
        setAssignedIp(json.assignedIp);
      }
      setInfoMessage('Secure WireGuard tunnel established!');
    } catch (err: any) {
      setConnectionState('disconnected');
      setErrorMessage(err.message || 'Failed to trigger agent connection');
    } finally {
      setLoading(false);
    }
  };

  // 6. Handle VPN Disconnect
  const handleDisconnectVpn = async () => {
    setLoading(true);
    try {
      await fetch(`${AGENT_BASE_URL}/disconnect`, { method: 'POST' });
      setConnectionState('disconnected');
      setAssignedIp(null);
      setInfoMessage('WireGuard tunnel disconnected');
    } catch (err: any) {
      setErrorMessage('Failed to cleanly disconnect agent');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    if (connectionState === 'connected') {
      handleDisconnectVpn();
    }
    setAuthData(null);
    setMfaChallenge(null);
    setOtpCode('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">
            🥭
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg tracking-wide text-white">MANGO VPN</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
                Zero-Trust v0.1
              </span>
            </div>
            <p className="text-xs text-slate-400">Enterprise WireGuard Remote Access</p>
          </div>
        </div>

        {/* Global Status Pills */}
        <div className="flex items-center space-x-3 text-xs font-medium">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <span className={`w-2 h-2 rounded-full ${portalOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="text-slate-300">{portalOnline ? 'Portal Online' : 'API Offline'}</span>
          </div>

          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border ${
            agentInstalled
              ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${agentInstalled ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
            <span>Agent: {agentInstalled ? `Installed (${agentVersion})` : 'Missing (127.0.0.1:47821)'}</span>
          </div>

          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border ${
            connectionState === 'connected'
              ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200'
              : connectionState === 'connecting'
              ? 'bg-amber-900/40 border-amber-500 text-amber-200 animate-pulse'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <Activity className="w-3.5 h-3.5" />
            <span className="capitalize">{connectionState}</span>
          </div>

          {authData && (
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-4 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-sm flex items-start space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-4 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-200 text-sm flex items-start space-x-2">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Card Container */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur">

            {/* SCREEN 1: User / Password Sign In */}
            {!authData && !mfaChallenge && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Sign in to VPN</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter corporate credentials to authenticate with MANGO VPN gateway.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="your.username"
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Continue to MFA</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <span className="font-semibold text-slate-300 block">Default Demo Credentials:</span>
                  <div>• Admin: <code className="text-amber-400">admin_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
                  <div>• Staff: <code className="text-amber-400">staff_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
                  <div>• Client: <code className="text-amber-400">client_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
                </div>
              </form>
            )}

            {/* SCREEN 2: 2-Factor OTP Verification Modal */}
            {!authData && mfaChallenge && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Two-Factor Authentication</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter the 6-digit verification code sent to <span className="text-amber-400 font-mono">{mfaChallenge.maskedPhoneNumber}</span>.
                  </p>
                </div>

                <div className="py-2">
                  <label className="block text-xs font-medium text-slate-300 mb-2 text-center">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    autoFocus
                    required
                    className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 bg-slate-950 border border-slate-700 rounded-lg text-amber-400 placeholder-slate-700 focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-500 text-center mt-2">
                    (In dev mode, check backend API terminal logs for generated OTP)
                  </p>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMfaChallenge(null)}
                    className="w-1/3 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="w-2/3 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
              </form>
            )}

            {/* SCREEN 3: Authenticated State & VPN Control */}
            {authData && (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-semibold text-white">{authData.user.username}</h3>
                    <span className="text-xs text-slate-400">Role: <span className="text-amber-400 font-mono">{authData.user.role}</span></span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                      {authData.user.phoneNumber}
                    </span>
                  </div>
                </div>

                {/* Connection Status Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Assigned VPN IP</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {assignedIp || 'Not Assigned'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Endpoint</span>
                    <span className="font-mono text-slate-300">127.0.0.1:51820 (WireGuard)</span>
                  </div>

                  {connectionState === 'connected' && (
                    <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                      <div>RX: {(bytesRx / 1024).toFixed(1)} KB</div>
                      <div className="text-right">TX: {(bytesTx / 1024).toFixed(1)} KB</div>
                    </div>
                  )}
                </div>

                {/* Big Green VPN Connect Button */}
                {connectionState !== 'connected' ? (
                  <button
                    onClick={handleConnectVpn}
                    disabled={loading || !agentInstalled}
                    className="w-full py-4 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black tracking-wider uppercase rounded-xl transition shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        <span>VPN CONNECT</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnectVpn}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wide uppercase rounded-xl transition shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-2 text-sm"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>DISCONNECT VPN</span>
                  </button>
                )}

                {!agentInstalled && (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-xs text-amber-300 space-y-1">
                    <div className="font-semibold flex items-center space-x-1">
                      <span>⚠️ Client Agent Not Running</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Run the mock agent simulator in your terminal:
                    </p>
                    <code className="block bg-slate-950 p-1.5 rounded text-amber-400 font-mono text-[11px]">
                      node scripts/mock-agent.js
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* Status Indicators Footer */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-300 mb-1">Status Indicators:</div>
              <div className="flex justify-between items-center">
                <span>Agent Status:</span>
                <span className={`font-mono ${agentInstalled ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {agentInstalled ? `Installed [${agentVersion}]` : 'Not Detected'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Connection:</span>
                <span className={`font-mono capitalize ${
                  connectionState === 'connected' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                }`}>
                  [{connectionState}]
                </span>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
