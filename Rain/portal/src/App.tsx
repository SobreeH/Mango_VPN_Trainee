import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Shield, LayoutDashboard } from 'lucide-react';
import {
  LoginResponse,
  AuthTokenResponse,
  AgentHealthResponse,
  AgentStatusResponse,
} from '@mango/shared';

// นำเข้า Component ลูกทั้งหมด
import { Header } from './components/Header';
import { LoginForm } from './components/LoginForm';
import { OtpModal } from './components/OtpModal';
import { VpnDashboard } from './components/VpnDashboard';
import { AdminPanel } from './components/AdminPanel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const AGENT_BASE_URL = 'http://127.0.0.1:47821';

export default function App() {
  // =========================================================================
  // 1. สถานะการล็อกอินและตัวตน (Authentication State)
  // =========================================================================
  const [username, setUsername] = useState('admin_user');
  const [password, setPassword] = useState('MangoVPN2026!');
  const [mfaChallenge, setMfaChallenge] = useState<LoginResponse | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [authData, setAuthData] = useState<AuthTokenResponse | null>(null);

  // มุมมองปัจจุบันเมื่อล็อกอินแล้ว: 'vpn' (หน้าเชื่อมต่อ) หรือ 'admin' (หน้าหลังบ้าน)
  const [activeView, setActiveView] = useState<'vpn' | 'admin'>('vpn');

  // =========================================================================
  // 2. สถานะระบบและเน็ตเวิร์ก (System & Telemetry State)
  // =========================================================================
  const [portalOnline, setPortalOnline] = useState<boolean>(true);
  const [agentInstalled, setAgentInstalled] = useState<boolean>(false);
  const [agentVersion, setAgentVersion] = useState<string>('');
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [assignedIp, setAssignedIp] = useState<string | null>(null);
  const [bytesRx, setBytesRx] = useState<number>(0);
  const [bytesTx, setBytesTx] = useState<number>(0);

  // =========================================================================
  // 3. สถานะข้อความแจ้งเตือน (UI Feedback State)
  // =========================================================================
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // ตรวจสอบความพร้อมของ Backend API (ทุก 5 วินาที)
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

  // ตรวจสอบสถานะ Windows Agent ในเครื่อง 127.0.0.1:47821 (ทุก 3 วินาที)
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

  // ดึงปริมาณข้อมูล RX/TX แบบเรียลไทม์เมื่อต่อ VPN สำเร็จ (ทุก 1.5 วินาที)
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

  // ฟังก์ชันล็อกอิน Step 1 -> Step 2
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

  // ฟังก์ชันยืนยัน OTP Step 3 -> Step 4
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

  // ฟังก์ชันสั่งเชื่อมต่อ VPN Step 5
  const handleConnectVpn = async () => {
    if (!authData) return;
    if (!agentInstalled) {
      setErrorMessage('Local Windows Agent service not detected on 127.0.0.1:47821. Please run mock-agent.js');
      return;
    }

    setConnectionState('connecting');
    setLoading(true);
    setErrorMessage(null);

    try {
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

  // ฟังก์ชันสั่งตัดการเชื่อมต่อ VPN
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

  // ฟังก์ชันออกจากระบบ (Sign Out)
  const handleSignOut = () => {
    if (connectionState === 'connected') {
      handleDisconnectVpn();
    }
    setAuthData(null);
    setMfaChallenge(null);
    setOtpCode('');
    setActiveView('vpn'); // รีเซ็ตมุมมองกลับไปหน้าหลัก
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. ส่วนหัว: แถบสถานะระบบ */}
      <Header
        portalOnline={portalOnline}
        agentInstalled={agentInstalled}
        agentVersion={agentVersion}
        connectionState={connectionState}
        isLoggedIn={!!authData}
        onSignOut={handleSignOut}
      />

      {/* 2. พื้นที่เนื้อหาหลัก (Main Content) */}
      <main className="flex-1 flex items-center justify-center p-6">
        {/* ปรับความกว้างของการ์ด: ถ้าเป็นหน้า Admin ให้กว้างขึ้นเป็น max-w-2xl */}
        <div className={`w-full transition-all duration-300 ${
          authData && activeView === 'admin' ? 'max-w-2xl' : 'max-w-md'
        }`}>

          {/* ป้ายแจ้งเตือนข้อผิดพลาด (Error Alert) */}
          {errorMessage && (
            <div className="mb-4 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-sm flex items-start space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ป้ายแจ้งข้อมูลความสำเร็จ (Success / Info Alert) */}
          {infoMessage && (
            <div className="mb-4 p-4 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-200 text-sm flex items-start space-x-2">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* การ์ดบรรจุหน้าจอ (Card Container) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur">
            
            {/* หน้าที่ 1: ฟอร์มล็อกอิน */}
            {!authData && !mfaChallenge && (
              <LoginForm
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                loading={loading}
                onSubmit={handleLogin}
              />
            )}

            {/* หน้าที่ 2: โมดอลกรอก OTP */}
            {!authData && mfaChallenge && (
              <OtpModal
                maskedPhoneNumber={mfaChallenge.maskedPhoneNumber}
                otpCode={otpCode}
                setOtpCode={setOtpCode}
                loading={loading}
                onVerify={handleVerifyOtp}
                onBack={() => setMfaChallenge(null)}
              />
            )}

            {/* หน้าที่ 3: แดชบอร์ดเมื่อล็อกอินสำเร็จแล้ว */}
            {authData && (
              <div className="space-y-4">
                {/* สวิตช์สลับหน้า (แสดงเฉพาะ Role ADMIN) */}
                {authData.user.role === 'ADMIN' && (
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setActiveView('vpn')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                        activeView === 'vpn'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>VPN Client</span>
                    </button>

                    <button
                      onClick={() => setActiveView('admin')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                        activeView === 'admin'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Admin Console</span>
                    </button>
                  </div>
                )}

                {/* แสดง View ตามที่เลือก */}
                {activeView === 'vpn' ? (
                  <VpnDashboard
                    user={authData.user}
                    assignedIp={assignedIp}
                    connectionState={connectionState}
                    bytesRx={bytesRx}
                    bytesTx={bytesTx}
                    agentInstalled={agentInstalled}
                    agentVersion={agentVersion}
                    loading={loading}
                    onConnect={handleConnectVpn}
                    onDisconnect={handleDisconnectVpn}
                  />
                ) : (
                  <AdminPanel
                    accessToken={authData.accessToken}
                    apiBaseUrl={API_BASE_URL}
                  />
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
