import React, { useState, useEffect, useCallback } from 'react';
import {
  LoginResponse,
  AuthTokenResponse,
  AgentHealthResponse,
  AgentStatusResponse,
  RoleName,
} from '@mango/shared';

// นำเข้า Component ลูกทั้งหมด
import { Sidebar, NavTab } from './components/Sidebar';
import { LoginForm } from './components/LoginForm';
import { OtpModal } from './components/OtpModal';
import { VpnDashboard } from './components/VpnDashboard';
import { AdminPanel } from './components/AdminPanel';
import { Toast, ToastType } from './components/Toast';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useI18n } from './i18n/I18nContext';
import { formatMessage } from './i18n/translations';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const AGENT_BASE_URL = 'http://127.0.0.1:47821';

// บัญชีทดสอบมาตรฐาน (Demo Accounts)
const DEMO_ACCOUNTS: Record<string, { role: RoleName; phone: string }> = {
  admin_user: { role: 'ADMIN', phone: '+15551234567' },
  staff_user: { role: 'STAFF', phone: '+15552345678' },
  client_user: { role: 'CLIENT', phone: '+15553456789' },
};

export default function App() {
  const { t } = useI18n();

  // =========================================================================
  // 1. สถานะการล็อกอินและตัวตน (Authentication State)
  // =========================================================================
  const [username, setUsername] = useState('admin_user');
  const [password, setPassword] = useState('MangoVPN2026!');
  const [mfaChallenge, setMfaChallenge] = useState<LoginResponse | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [mockExpectedOtp, setMockExpectedOtp] = useState<string>('');
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
        showToast(formatMessage(t.toasts.otpSent, { phone: json.data.maskedPhoneNumber }), 'info');
        return;
      }
      throw new Error(json.error?.message || 'Invalid credentials');
    } catch {
      // Dev Mock Fallback: ถ้า API หลังบ้านออฟไลน์
      const cleanUsername = username.trim();
      let account = DEMO_ACCOUNTS[cleanUsername];

      // ค้นหาใน customUsers ที่สร้างผ่าน Admin Panel ด้วย
      let customUserObj: any = null;
      if (!account) {
        try {
          const savedUsers = sessionStorage.getItem('mango_custom_users');
          if (savedUsers) {
            const list = JSON.parse(savedUsers);
            const found = list.find((u: any) => u.username === cleanUsername);
            if (found) {
              account = { role: found.roleName, phone: found.phoneNumber };
              customUserObj = found;
            }
          }
        } catch {}
      }

      // ตรวจสอบว่าถูกลบหรือถูกระงับสิทธิ์หรือไม่
      let isSuspended = false;
      try {
        const deleted = sessionStorage.getItem('mango_deleted_users');
        if (deleted && customUserObj && JSON.parse(deleted).includes(customUserObj.id)) {
          showToast('บัญชีผู้ใช้นี้ถูกลบออกจากระบบแล้ว', 'error');
          return;
        }
        const toggled = sessionStorage.getItem('mango_toggled_users');
        if (toggled && customUserObj && JSON.parse(toggled)[customUserObj.id] === false) {
          isSuspended = true;
        }
      } catch {}

      if (isSuspended) {
        showToast('บัญชีผู้ใช้นี้ถูกระงับสิทธิ์การใช้งาน (Suspended)', 'error');
        return;
      }

      if (account && password === 'MangoVPN2026!') {
        // สุ่มรหัส OTP 6 หลักใหม่ทุกครั้ง (Dynamic 6-Digit Code)
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setMockExpectedOtp(generatedOtp);

        setMfaChallenge({
          requiresOtp: true,
          challengeId: 'mock-challenge-dev',
          maskedPhoneNumber: account.phone ? account.phone.substring(0, 5) + '****' + account.phone.slice(-3) : '+1555****567',
          expiresInSeconds: 300,
          message: 'Dev Mock Mode',
        });
        // จำลองการส่ง SMS Notification เข้ามาที่หน้าจอ
        showToast(
          formatMessage(t.toasts.smsOtpReceived, { otp: generatedOtp }),
          'info',
        );
      } else {
        showToast(t.toasts.invalidCredentials, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันขอรหัส OTP ใหม่ (Resend OTP Generator)
  const handleResendOtp = () => {
    if (!mfaChallenge) return;
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setMockExpectedOtp(newOtp);
    setOtpCode('');
    showToast(
      formatMessage(t.toasts.smsOtpReceived, { otp: newOtp }),
      'info',
    );
  };

  // ฟังก์ชันยืนยัน OTP Step 3 -> Step 4
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setLoading(true);

    try {
      // Dev Mock Mode: ตรวจสอบความถูกต้องของรหัส OTP ที่สุ่มขึ้นมา
      if (mfaChallenge.challengeId === 'mock-challenge-dev') {
        const cleanOtp = otpCode.trim();
        if (cleanOtp !== mockExpectedOtp) {
          showToast(t.toasts.invalidOtpCode, 'error');
          setLoading(false);
          return;
        }

        const cleanUsername = username.trim();
        let demoAccount = DEMO_ACCOUNTS[cleanUsername];
        if (!demoAccount) {
          try {
            const savedUsers = sessionStorage.getItem('mango_custom_users');
            if (savedUsers) {
              const list = JSON.parse(savedUsers);
              const found = list.find((u: any) => u.username === cleanUsername);
              if (found) {
                demoAccount = { role: found.roleName, phone: found.phoneNumber };
              }
            }
          } catch {}
        }
        if (!demoAccount) {
          demoAccount = { role: 'ADMIN', phone: '+15551234567' };
        }
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
        showToast(
          formatMessage(t.toasts.loginSuccessWelcome, {
            username: cleanUsername,
            role: demoAccount.role,
          }),
          'success',
        );
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
      showToast(
        formatMessage(t.toasts.loginSuccessAs, {
          username: json.data.user.username,
          role: json.data.user.role,
        }),
        'success',
      );
    } catch (err: any) {
      showToast(err.message || t.toasts.otpFailed, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันสั่งเชื่อมต่อ VPN Step 5
  const handleConnectVpn = async () => {
    if (!authData) return;
    if (!agentInstalled) {
      showToast(t.toasts.agentNotFound, 'error');
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
      showToast(t.toasts.vpnConnected, 'success');
    } catch (err: any) {
      setConnectionState('disconnected');
      showToast(err.message || t.toasts.vpnConnectError, 'error');
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
      showToast(t.toasts.vpnDisconnected, 'info');
    } catch {
      // โหมด Fallback / Dev Simulator: อัปเดตสถานะหน้าจอให้ตัดการเชื่อมต่อสำเร็จเสมอ แม้ Agent พอร์ต 47821 ไม่ได้รันอยู่
      setConnectionState('disconnected');
      setAssignedIp(null);
      showToast(t.toasts.vpnDisconnected, 'info');
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
    showToast(t.toasts.signedOut, 'info');
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

          {/* 2. หน้าประวัติ (CLIENT ดูเฉพาะ Sessions ของตัวเอง, STAFF/ADMIN ดูได้ทั้ง Sessions & Logs) */}
          {activeTab === 'history' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    {authData.user.role === 'CLIENT'
                      ? t.pages.historyClientTitle
                      : t.pages.historyAdminTitle}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {authData.user.role === 'CLIENT'
                      ? t.pages.historyClientSubtitle
                      : t.pages.historyAdminSubtitle}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  {t.common.backToConnect}
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="sessions"
                allowedTabs={authData.user.role === 'CLIENT' ? ['sessions'] : ['sessions', 'logs']}
                userRole={authData.user.role}
                onShowToast={showToast}
              />
            </div>
          )}

          {/* 3. หน้าอุปกรณ์ (แสดงเฉพาะ Registered Devices) */}
          {activeTab === 'devices' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    {t.pages.devicesTitle}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.pages.devicesSubtitle}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  {t.common.backToConnect}
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="devices"
                allowedTabs={['devices']}
                userRole={authData.user.role}
                onShowToast={showToast}
              />
            </div>
          )}

          {/* 4. หน้าจัดการผู้ใช้ (User Management - ADMIN ONLY) */}
          {activeTab === 'users' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    {t.pages.usersTitle}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.pages.usersSubtitle}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  {t.common.backToConnect}
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="users"
                allowedTabs={['users']}
                userRole={authData.user.role}
                onShowToast={showToast}
              />
            </div>
          )}

          {/* 5. หน้านโยบายความปลอดภัย (Zero-Trust Policies - ADMIN ONLY) */}
          {activeTab === 'policies' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    {t.pages.policiesTitle}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.pages.policiesSubtitle}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  {t.common.backToConnect}
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="policies"
                allowedTabs={['policies']}
                userRole={authData.user.role}
                onShowToast={showToast}
              />
            </div>
          )}

          {/* 6. หน้า Audit Logs (ADMIN ONLY) */}
          {activeTab === 'audit_logs' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    {t.pages.auditLogsTitle}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.pages.auditLogsSubtitle}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  {t.common.backToConnect}
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="logs"
                allowedTabs={['logs']}
                userRole={authData.user.role}
                onShowToast={showToast}
              />
            </div>
          )}

          {/* 7. หน้า Agent (แสดงเฉพาะ Releases & Downloads) */}
          {activeTab === 'agent' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    {authData.user.role === 'ADMIN'
                      ? t.pages.agentAdminTitle
                      : t.pages.agentUserTitle}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {authData.user.role === 'ADMIN'
                      ? t.pages.agentAdminSubtitle
                      : t.pages.agentUserSubtitle}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('connect')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  {t.common.backToConnect}
                </button>
              </div>

              <AdminPanel
                accessToken={authData.accessToken}
                apiBaseUrl={API_BASE_URL}
                initialTab="versions"
                allowedTabs={['versions']}
                userRole={authData.user.role}
                onShowToast={showToast}
              />
            </div>
          )}
        </main>
      </div>
    );
  }

  // =========================================================================
  // ก่อนล็อกอิน: แสดงหน้า Login Form สไตล์ Mobile App
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#040806] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      {/* ป๊อปอัปแจ้งเตือน Toast มุมบนขวา */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleCloseToast}
        />
      )}

      {/* สถานะเซิร์ฟเวอร์จิ๋ว และตัวเลือกภาษา */}
      <div className="w-full max-w-[400px] flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${portalOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <span>{portalOnline ? t.common.gatewayOnline : t.common.gatewayStandby}</span>
        </div>
        <LanguageSwitcher compact />
      </div>

      {/* กรอบขนาด Mobile App Card */}
      <div className="w-full max-w-[400px] bg-[#070d0a] border border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-emerald-950/20">
        {/* หน้าที่ 1: ฟอร์มล็อกอิน Mobile */}
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

        {/* หน้าที่ 2: โมดอลกรอก OTP Mobile */}
        {mfaChallenge && (
          <OtpModal
            maskedPhoneNumber={mfaChallenge.maskedPhoneNumber}
            otpCode={otpCode}
            setOtpCode={setOtpCode}
            loading={loading}
            onVerify={handleVerifyOtp}
            onBack={() => setMfaChallenge(null)}
            onResendOtp={handleResendOtp}
          />
        )}
      </div>
    </div>
  );
}
