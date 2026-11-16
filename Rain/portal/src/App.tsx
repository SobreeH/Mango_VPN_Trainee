import React, { useState, useEffect, useCallback } from 'react';
import {
  LoginResponse,
  AuthTokenResponse,
  AgentHealthResponse,
  AgentStatusResponse,
  RoleName,
} from '@mango/shared';

// นำเข้า Component ลูกทั้งหมด
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { LoginForm } from './components/LoginForm';
import { OtpModal } from './components/OtpModal';
import { VpnDashboard } from './components/VpnDashboard';
import { AdminPanel } from './components/AdminPanel';
import { Toast, ToastType } from './components/Toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const AGENT_BASE_URL = 'http://127.0.0.1:47821';

// บัญชีทดสอบมาตรฐาน (Demo Accounts)
const DEMO_ACCOUNTS: Record<string, { role: RoleName; phone: string }> = {
  admin_user: { role: 'ADMIN', phone: '+15551234567' },
  staff_user: { role: 'STAFF', phone: '+15552345678' },
  client_user: { role: 'CLIENT', phone: '+15553456789' },
};

export default function App() {
  // =========================================================================
  // 1. สถานะการล็อกอินและตัวตน (Authentication State)
  // =========================================================================
  const [username, setUsername] = useState('staff_user');
  const [password, setPassword] = useState('MangoVPN2026!');
  const [mfaChallenge, setMfaChallenge] = useState<LoginResponse | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [authData, setAuthData] = useState<AuthTokenResponse | null>(null);

  // แท็บเมนูที่เลือกในแถบ Sidebar ด้านซ้าย (connect | history | devices | agent)
  const [activeTab, setActiveTab] = useState<NavTab>('connect');

  // =========================================================================
  // 2. สถานะระบบและเน็ตเวิร์ก (System & Telemetry State)
  // =========================================================================
  const [portalOnline, setPortalOnline] = useState<boolean>(false);
  const [agentInstalled, setAgentInstalled] = useState<boolean>(false);
  const [agentVersion, setAgentVersion] = useState<string>('');
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [assignedIp, setAssignedIp] = useState<string | null>(null);
  const [bytesRx, setBytesRx] = useState<number>(0);
  const [bytesTx, setBytesTx] = useState<number>(0);

  // =========================================================================
  // 3. สถานะข้อความแจ้งเตือน (Toast Notification State)
  // =========================================================================
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // ฟังก์ชันยิง Toast แจ้งเตือนมุมขวาบน
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  // ฟังก์ชันปิด Toast (ใช้ useCallback คงที่เพื่อไม่ให้ Timer รีเซ็ต)
  const handleCloseToast = useCallback(() => {
    setToast(null);
  }, []);

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
      } catch {
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

    try {
      const cleanUsername = username.trim();
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setMfaChallenge(json.data);
        showToast(`ส่งรหัสยืนยัน OTP ไปที่ ${json.data.maskedPhoneNumber}`, 'info');
        return;
      }
      throw new Error(json.error?.message || 'Invalid credentials');
    } catch {
      // Dev Mock Fallback: ถ้า API หลังบ้านออฟไลน์
      const cleanUsername = username.trim();
      const demoAccount = DEMO_ACCOUNTS[cleanUsername];
      if (demoAccount && password === 'MangoVPN2026!') {
        setMfaChallenge({
          requiresOtp: true,
          challengeId: 'mock-challenge-dev',
          maskedPhoneNumber: '+1555****567',
          expiresInSeconds: 300,
          message: 'Dev Mock Mode',
        });
        showToast('โหมดจำลอง (Dev Mode): ใช้ OTP เลข 123456 ได้เลยครับ', 'info');
      } else {
        showToast('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ลองใช้: admin_user / MangoVPN2026!)', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันยืนยัน OTP Step 3 -> Step 4
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setLoading(true);

    try {
      // Dev Mock Mode
      if (mfaChallenge.challengeId === 'mock-challenge-dev') {
        const cleanUsername = username.trim();
        const demoAccount = DEMO_ACCOUNTS[cleanUsername] || { role: 'ADMIN', phone: '+15551234567' };
        setAuthData({
          accessToken: 'mock-jwt-access-token-mango-2026',
          refreshToken: 'mock-jwt-refresh-token-mango-2026',
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: {
            id: 'mock-dev-uuid-001',
            username: cleanUsername,
            phoneNumber: demoAccount.phone,
            role: demoAccount.role,
          },
        });
        setMfaChallenge(null);
        showToast(`เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ${cleanUsername} (${demoAccount.role})`, 'success');
        return;
      }

      // API จริง
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
      showToast(`เข้าสู่ระบบสำเร็จในฐานะ ${json.data.user.username} (${json.data.user.role})`, 'success');
    } catch (err: any) {
      showToast(err.message || 'การยืนยันรหัส OTP ล้มเหลว', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันสั่งเชื่อมต่อ VPN Step 5
  const handleConnectVpn = async () => {
    if (!authData) return;
    if (!agentInstalled) {
      showToast('ไม่พบเซอร์วิส Agent บนเครื่อง 127.0.0.1:47821 (กรุณารัน: npm run mock:agent)', 'error');
      return;
    }

    setConnectionState('connecting');
    setLoading(true);

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
      showToast('เชื่อมต่อ WireGuard Tunnel เรียบร้อยแล้ว!', 'success');
    } catch (err: any) {
      setConnectionState('disconnected');
      showToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ VPN', 'error');
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
      showToast('ตัดการเชื่อมต่อ WireGuard VPN เรียบร้อยแล้ว', 'info');
    } catch {
      showToast('ไม่สามารถตัดการเชื่อมต่อได้อย่างสมบูรณ์', 'error');
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
    setActiveTab('connect');
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  // =========================================================================
  // เมื่อล็อกอินแล้ว: แสดง Full Dashboard Layout พร้อม Sidebar ด้านซ้าย
  // =========================================================================
  if (authData) {
    return (
      <div className="min-h-screen bg-[#060a08] text-slate-100 flex font-sans">
        {/* ป๊อปอัปแจ้งเตือน Toast มุมบนขวา */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={handleCloseToast}
          />
        )}

        {/* เมนูนำทางด้านซ้าย (Sidebar) */}
        <Sidebar
          user={authData.user}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSignOut={handleSignOut}
        />

        {/* พื้นที่แสดงเนื้อหาหลัก (Main Content) */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* 1. หน้าเชื่อมต่อ VPN */}
          {activeTab === 'connect' && (
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
              onNotify={showToast}
            />
          )}

          {/* 2. หน้าประวัติ (แสดงเฉพาะ Sessions & Audit Logs) */}
          {activeTab === 'history' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    ประวัติการใช้งานระบบ (Sessions & Audit Logs)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ตรวจสอบประวัติการเชื่อมต่อ VPN และบันทึกกิจกรรมความปลอดภัย
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  ← กลับหน้าเชื่อมต่อ VPN
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="sessions"
                allowedTabs={['sessions', 'logs']}
              />
            </div>
          )}

          {/* 3. หน้าอุปกรณ์ (แสดงเฉพาะ Registered Devices) */}
          {activeTab === 'devices' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    อุปกรณ์ที่ลงทะเบียน (Registered Devices)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    รายชื่อเครื่องคอมพิวเตอร์และอุปกรณ์ที่ได้รับอนุญาตในระบบ
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  ← กลับหน้าเชื่อมต่อ VPN
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="devices"
                allowedTabs={['devices']}
              />
            </div>
          )}

          {/* 4. หน้า Agent (แสดงเฉพาะ Releases & Downloads) */}
          {activeTab === 'agent' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    ไคลเอนต์เอเจนต์ (Agent Versions & Releases)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ดาวน์โหลดและตรวจสอบเวอร์ชันของ Mango Windows Agent
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  ← กลับหน้าเชื่อมต่อ VPN
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="versions"
                allowedTabs={['versions']}
              />
            </div>
          )}
        </main>
      </div>
    );
  }

  // =========================================================================
  // ก่อนล็อกอิน: แสดงหน้า Login Form กึ่งกลางจอ
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* ป๊อปอัปแจ้งเตือน Toast มุมบนขวา */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleCloseToast}
        />
      )}

      {/* 1. ส่วนหัว: แถบสถานะระบบ */}
      <Header
        portalOnline={portalOnline}
        agentInstalled={agentInstalled}
        agentVersion={agentVersion}
        connectionState={connectionState}
        isLoggedIn={false}
        onSignOut={handleSignOut}
      />

      {/* 2. พื้นที่เนื้อหาหลัก (Login / OTP Box) */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md transition-all duration-300">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur">
            {/* หน้าที่ 1: ฟอร์มล็อกอิน */}
            {!mfaChallenge && (
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
            {mfaChallenge && (
              <OtpModal
                maskedPhoneNumber={mfaChallenge.maskedPhoneNumber}
                otpCode={otpCode}
                setOtpCode={setOtpCode}
                loading={loading}
                onVerify={handleVerifyOtp}
                onBack={() => setMfaChallenge(null)}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
