import { useEffect, useState, type FormEvent } from 'react';
import {
  KeyRound,
  LogOut,
  AlertCircle,
  Sun,
  Moon,
  Lock,
  User,
  Eye,
  EyeOff,
  Power,
  ShieldCheck,
  Activity,
  HelpCircle,
} from 'lucide-react';
import { z } from 'zod';
import QRCode from 'qrcode';
import { RoleName, type AuthTokensResponse, type AuthUserDto, type LoginResponse } from '@mango/shared';
import { loginUser, logoutUser, verifyOtpCode, type AuthRefreshContext } from './api/auth';
import { AgentStatusCard } from './components/AgentStatusCard';
import { DEFAULT_API_URL } from './lib/adminApi';
import { AuditLogsTab } from './components/AuditLogsTab';
import { AgentVersionsTab } from './components/AgentVersionsTab';
import { UsersTab } from './components/UsersTab';
import { DevicesTab } from './components/DevicesTab';
import { SessionsTab } from './components/SessionsTab';
import { PoliciesTab } from './components/PoliciesTab';

export interface PortalSession {
  accessToken: string;
  refreshToken?: string;
  user: AuthUserDto;
}

export interface AppProps {
  initialSession?: PortalSession | null;
  apiBaseUrl?: string;
}

type AdminTab = 'audit-logs' | 'agent-versions' | 'users' | 'devices' | 'sessions' | 'policies';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const otpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6 digits authenticator code'),
});

type AuthStep =
  | { kind: 'login' }
  | { kind: 'mfa'; challenge: LoginResponse }
  | { kind: 'authenticated'; session: AuthTokensResponse };

export function App({ initialSession = null, apiBaseUrl = DEFAULT_API_URL }: AppProps) {
  const [step, setStep] = useState<AuthStep>(
    initialSession
      ? {
          kind: 'authenticated',
          session: {
            accessToken: initialSession.accessToken,
            refreshToken: initialSession.refreshToken ?? '',
            expiresIn: 900,
            user: initialSession.user,
          },
        }
      : { kind: 'login' },
  );
  const [activeTab, setActiveTab] = useState<AdminTab>('audit-logs');
  const [clientTab, setClientTab] = useState<'connection' | 'profile' | 'help'>('connection');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('mango-theme');
        return saved !== null ? saved === 'dark' : true;
      }
      return true;
    } catch {
      return true;
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showSetupKey, setShowSetupKey] = useState(false);
  const [showVpnPanel, setShowVpnPanel] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('mango-theme', isDark ? 'dark' : 'light');
      }
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDark]);

  useEffect(() => {
    let active = true;
    if (step.kind === 'mfa' && step.challenge.status === 'MFA_SETUP_REQUIRED') {
      QRCode.toDataURL(step.challenge.otpauthUri, { width: 192, margin: 1 })
        .then((url) => {
          if (active) setQrDataUrl(url);
        })
        .catch(() => {
          if (active) setQrDataUrl(null);
        });
    } else {
      setQrDataUrl(null);
    }
    return () => {
      active = false;
    };
  }, [step]);

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Invalid login input');
      return;
    }

    setIsSubmitting(true);
    try {
      const challenge = await loginUser(parsed.data);
      setOtpCode('');
      setStep({ kind: 'mfa', challenge });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== 'mfa') return;
    setErrorMessage(null);

    const parsed = otpSchema.safeParse({ code: otpCode });
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Invalid 6-digit code');
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await verifyOtpCode({
        mfaToken: step.challenge.mfaToken,
        code: parsed.data.code,
      });
      setPassword('');
      setOtpCode('');
      setStep({ kind: 'authenticated', session });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearLocalSession(nextError: string | null = null) {
    setUsername('');
    setPassword('');
    setOtpCode('');
    setErrorMessage(nextError);
    setStep({ kind: 'login' });
  }

  async function handleLogout() {
    if (step.kind !== 'authenticated') return;
    setErrorMessage(null);
    try {
      await logoutUser({ refreshToken: step.session.refreshToken });
    } catch {
      // Clear local session even if server revocation request fails
    } finally {
      clearLocalSession(null);
    }
  }

  const authContext: AuthRefreshContext | undefined =
    step.kind === 'authenticated'
      ? {
          refreshToken: step.session.refreshToken,
          apiBaseUrl,
          onSessionUpdate: (newSession) => setStep({ kind: 'authenticated', session: newSession }),
          onAuthExpired: (message) => {
            clearLocalSession(
              message ||
                (lang === 'th'
                  ? 'เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
                  : 'Session expired. Please sign in again.'),
            );
          },
        }
      : undefined;

  if (step.kind === 'authenticated') {
    const isAdmin = step.session.user.role === RoleName.ADMIN;
    const isClient = step.session.user.role === RoleName.CLIENT;

    return (
      <main className={`min-h-screen p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}>
        {/* Ambient Glows: Warm Golden Amber & Leaf Green */}
        <div className={`absolute -top-32 left-1/3 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
          isDark ? 'bg-amber-500/18' : 'bg-yellow-400/25'
        }`} />
        <div className={`absolute -bottom-32 right-12 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
          isDark ? 'bg-emerald-600/15' : 'bg-emerald-300/25'
        }`} />

        {isAdmin ? (
          /* Admin Modern Full-Screen Dashboard with Floating Sidebar */
          <div className="w-full flex-1 flex flex-col md:flex-row gap-6 relative z-10 items-stretch">
            
            {/* Left Sidebar */}
            <aside className={`w-full md:w-64 lg:w-72 shrink-0 rounded-3xl border shadow-2xl p-6 flex flex-col justify-between backdrop-blur-xl transition-colors min-h-[calc(100vh-6rem)] ${
              isDark ? 'border-white/5 bg-[#1e1d1a]/85' : 'border-stone-200/90 bg-white/95'
            }`}>
              <div className="space-y-7">
                {/* Brand Header */}
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl" role="img" aria-label="Mango">🥭</span>
                  <div>
                    <h1 className={`text-base font-bold tracking-tight ${isDark ? 'text-stone-100' : 'text-slate-900'}`}>
                      MANGO VPN
                    </h1>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-stone-400' : 'text-amber-700'}`}>
                      Mango Consultant Co., Ltd.
                    </p>
                  </div>
                </div>

                {/* Navigation Groups */}
                <nav role="tablist" aria-label="Admin Governance" className="space-y-6">
                  {/* Group 1: Management (จัดการ) */}
                  <div className="space-y-1">
                    <p className={`text-xs font-semibold px-3 pb-1 tracking-wide ${isDark ? 'text-stone-400' : 'text-slate-500'}`}>
                      {lang === 'th' ? 'จัดการ' : 'Management'}
                    </p>
                    {[
                      { id: 'users', labelTh: 'ผู้ใช้', labelEn: 'Users' },
                      { id: 'devices', labelTh: 'อุปกรณ์', labelEn: 'Devices' },
                      { id: 'policies', labelTh: 'นโยบาย', labelEn: 'Policies' },
                    ].map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          aria-label={item.labelEn}
                          aria-selected={isActive}
                          onClick={() => setActiveTab(item.id as AdminTab)}
                          className={`w-full flex items-center px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all text-left ${
                            isActive
                              ? isDark
                                ? 'bg-[#7a4918]/85 text-amber-100 font-semibold shadow-sm'
                                : 'bg-[#f59e0b] text-stone-950 font-semibold shadow-sm'
                              : isDark
                                ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 font-medium'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                          }`}
                        >
                          <span>{lang === 'th' ? item.labelTh : item.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Group 2: Live Monitoring (ติดตามสด) */}
                  <div className="space-y-1">
                    <p className={`text-xs font-semibold px-3 pb-1 tracking-wide ${isDark ? 'text-stone-400' : 'text-slate-500'}`}>
                      {lang === 'th' ? 'ติดตามสด' : 'Live Monitoring'}
                    </p>
                    {[
                      { id: 'sessions', labelTh: 'เซสชัน', labelEn: 'Sessions' },
                    ].map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          aria-label={item.labelEn}
                          aria-selected={isActive}
                          onClick={() => setActiveTab(item.id as AdminTab)}
                          className={`w-full flex items-center px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all text-left ${
                            isActive
                              ? isDark
                                ? 'bg-[#7a4918]/85 text-amber-100 font-semibold shadow-sm'
                                : 'bg-[#f59e0b] text-stone-950 font-semibold shadow-sm'
                              : isDark
                                ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 font-medium'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                          }`}
                        >
                          <span>{lang === 'th' ? item.labelTh : item.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Group 3: Audit & System (ตรวจสอบ) */}
                  <div className="space-y-1">
                    <p className={`text-xs font-semibold px-3 pb-1 tracking-wide ${isDark ? 'text-stone-400' : 'text-slate-500'}`}>
                      {lang === 'th' ? 'ตรวจสอบ' : 'Audit & System'}
                    </p>
                    {[
                      { id: 'audit-logs', labelTh: 'บันทึกการใช้งาน', labelEn: 'Audit Logs' },
                      { id: 'agent-versions', labelTh: 'เวอร์ชัน Agent', labelEn: 'Agent Versions' },
                    ].map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          aria-label={item.labelEn}
                          aria-selected={isActive}
                          onClick={() => setActiveTab(item.id as AdminTab)}
                          className={`w-full flex items-center px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all text-left ${
                            isActive
                              ? isDark
                                ? 'bg-[#7a4918]/85 text-amber-100 font-semibold shadow-sm'
                                : 'bg-[#f59e0b] text-stone-950 font-semibold shadow-sm'
                              : isDark
                                ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 font-medium'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                          }`}
                        >
                          <span>{lang === 'th' ? item.labelTh : item.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>
                </nav>
              </div>

              {/* Sidebar Footer */}
              <div className={`pt-4 border-t space-y-1.5 ${isDark ? 'border-stone-800/60' : 'border-stone-200/80'}`}>
                <div className="text-xs">
                  <span className={`font-semibold ${isDark ? 'text-stone-200' : 'text-slate-800'}`}>
                    {step.session.user.username}
                  </span>
                  <span className="text-stone-500 mx-1.5">·</span>
                  <span className="text-amber-400 font-bold">{step.session.user.role}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Log Out"
                  className="w-full flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-rose-400 transition-colors pt-1"
                >
                  <LogOut className="h-3 w-3" />
                  <span>{lang === 'th' ? 'ออกจากระบบ' : 'Log Out'}</span>
                </button>
              </div>
            </aside>

            {/* Right Main Content Area */}
            <section className="flex-1 w-full space-y-6 min-h-[calc(100vh-6rem)]">
              {/* Main Content Header */}
              <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? 'text-stone-100' : 'text-slate-900'}`}>
                    {activeTab === 'users' && (lang === 'th' ? 'ผู้ใช้' : 'Users')}
                    {activeTab === 'devices' && (lang === 'th' ? 'อุปกรณ์' : 'Devices')}
                    {activeTab === 'policies' && (lang === 'th' ? 'นโยบาย' : 'Policies')}
                    {activeTab === 'sessions' && (lang === 'th' ? 'เซสชัน' : 'Sessions')}
                    {activeTab === 'audit-logs' && (lang === 'th' ? 'บันทึกการใช้งาน' : 'Audit Logs')}
                    {activeTab === 'agent-versions' && (lang === 'th' ? 'เวอร์ชัน Agent' : 'Agent Versions')}
                  </h2>
                </div>

                {/* Top Right Utility Controls matching Reference Mockup */}
                <div className="flex items-center gap-3">
                  {/* Collapsible VPN Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowVpnPanel(!showVpnPanel)}
                    title={lang === 'th' ? 'แผงควบคุม VPN' : 'VPN Control Panel'}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                      showVpnPanel
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : isDark
                          ? 'border-white/5 bg-[#262420]/70 text-stone-400 hover:text-stone-200'
                          : 'border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    <Power className="h-3 w-3 text-amber-400" />
                    <span className="hidden sm:inline">{lang === 'th' ? 'VPN' : 'VPN'}</span>
                  </button>

                  {/* Language Switcher Pills */}
                  <div className={`flex items-center rounded-full p-1 text-xs font-semibold shadow-inner border transition-colors ${
                    isDark ? 'bg-[#1e1d1a]/85 border-white/5' : 'bg-white border-stone-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setLang('th')}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        lang === 'th'
                          ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                          : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      TH
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        lang === 'en'
                          ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                          : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      EN
                    </button>
                  </div>

                  {/* Theme Switcher Capsule (Sun | Moon) */}
                  <div
                    role="group"
                    aria-label="Toggle theme"
                    className={`flex items-center rounded-full p-1 text-xs font-semibold shadow-inner border transition-colors ${
                      isDark ? 'bg-[#1e1d1a]/85 border-white/5' : 'bg-white border-stone-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setIsDark(false)}
                      aria-label="Light mode"
                      className={`p-1.5 rounded-full transition-colors ${
                        !isDark
                          ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDark(true)}
                      aria-label="Dark mode"
                      className={`p-1.5 rounded-full transition-colors ${
                        isDark
                          ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </header>

              {/* Collapsible VPN Agent Status Card for Admin */}
              <div className={`transition-all duration-300 ${showVpnPanel ? 'block pb-2' : 'hidden'}`}>
                <AgentStatusCard
                  accessToken={step.session.accessToken}
                  userRole={step.session.user.role}
                  auth={authContext}
                />
              </div>

              {/* Active Tab View */}
              <div>
                {activeTab === 'audit-logs' && (
                  <AuditLogsTab
                    apiBaseUrl={apiBaseUrl}
                    accessToken={step.session.accessToken}
                    auth={authContext}
                  />
                )}
                {activeTab === 'agent-versions' && (
                  <AgentVersionsTab
                    apiBaseUrl={apiBaseUrl}
                    accessToken={step.session.accessToken}
                    auth={authContext}
                  />
                )}
                {activeTab === 'users' && (
                  <UsersTab
                    apiBaseUrl={apiBaseUrl}
                    accessToken={step.session.accessToken}
                    auth={authContext}
                  />
                )}
                {activeTab === 'devices' && (
                  <DevicesTab
                    apiBaseUrl={apiBaseUrl}
                    accessToken={step.session.accessToken}
                    auth={authContext}
                  />
                )}
                {activeTab === 'sessions' && (
                  <SessionsTab
                    apiBaseUrl={apiBaseUrl}
                    accessToken={step.session.accessToken}
                    auth={authContext}
                  />
                )}
                {activeTab === 'policies' && (
                  <PoliciesTab
                    apiBaseUrl={apiBaseUrl}
                    accessToken={step.session.accessToken}
                    auth={authContext}
                  />
                )}
              </div>
            </section>
          </div>
        ) : isClient ? (
          /* Client Focused Clean Portal - Simple, 1-Click VPN Access without Clutter */
          <div className="max-w-5xl mx-auto w-full space-y-6 relative z-10 py-2 sm:py-4">
            {/* Top Navbar */}
            <header className={`rounded-3xl border shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-xl transition-colors ${
              isDark ? 'border-white/5 bg-[#1e1d1a]/85 shadow-black/80' : 'border-stone-200/90 bg-white/95 shadow-stone-200/60'
            }`}>
              {/* Brand & User Role */}
              <div className="flex items-center gap-3">
                <span className="text-3xl" role="img" aria-label="Mango">🥭</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className={`text-base font-bold tracking-tight ${isDark ? 'text-stone-100' : 'text-slate-900'}`}>
                      MANGO VPN
                    </h1>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                      CLIENT PORTAL
                    </span>
                  </div>
                  <p className={`text-[10px] font-medium ${isDark ? 'text-stone-400' : 'text-amber-700'}`}>
                    Mango Consultant Co., Ltd.
                  </p>
                </div>
              </div>

              {/* Utility Controls & Logout */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Language Switcher */}
                <div className={`flex items-center rounded-full p-1 text-xs font-semibold shadow-inner border transition-colors ${
                  isDark ? 'bg-[#141311] border-white/5' : 'bg-white border-stone-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setLang('th')}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      lang === 'th'
                        ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                        : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    TH
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      lang === 'en'
                        ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                        : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    EN
                  </button>
                </div>

                {/* Theme Switcher */}
                <div
                  role="group"
                  aria-label="Toggle theme"
                  className={`flex items-center rounded-full p-1 text-xs font-semibold shadow-inner border transition-colors ${
                    isDark ? 'bg-[#141311] border-white/5' : 'bg-white border-stone-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setIsDark(false)}
                    aria-label="Light mode"
                    className={`p-1.5 rounded-full transition-colors ${
                      !isDark
                        ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDark(true)}
                    aria-label="Dark mode"
                    className={`p-1.5 rounded-full transition-colors ${
                      isDark
                        ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* User Info & Logout Button */}
                <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                  <span className={`text-xs font-semibold hidden md:inline ${isDark ? 'text-stone-200' : 'text-slate-800'}`}>
                    {step.session.user.username}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Log Out"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 bg-[#262420] text-stone-300 hover:bg-rose-950/60 hover:text-rose-200 hover:border-rose-900/50 transition-colors shadow-sm"
                  >
                    <LogOut className="h-3.5 w-3.5 text-rose-400" />
                    <span>{lang === 'th' ? 'ออกจากระบบ' : 'Log Out'}</span>
                  </button>
                </div>
              </div>
            </header>

            {/* Client Greeting Header */}
            <div>
              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? 'text-stone-100' : 'text-slate-900'}`}>
                {lang === 'th' ? `ยินดีต้อนรับ, ${step.session.user.username}` : `Welcome, ${step.session.user.username}`}
              </h2>
              <p className={`text-xs font-medium mt-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                {lang === 'th'
                  ? 'ระบบเครือข่ายระยะไกลความปลอดภัยสูง (สิทธิ์การเข้าถึงสำหรับลูกค้า)'
                  : 'Zero-Trust Secure Remote Access (Client Access Privilege)'}
              </p>
            </div>

            {/* Direct VPN Connection Card - 100% Focused */}
            <div className="w-full">
              <AgentStatusCard
                accessToken={step.session.accessToken}
                userRole={step.session.user.role}
                auth={authContext}
              />
            </div>
          </div>
        ) : (
          /* Staff User Portal - Full-Screen Sidebar Dashboard matching Mockup */
          <div className="w-full flex-1 flex flex-col md:flex-row gap-6 relative z-10 items-stretch">
            {/* Left Sidebar */}
            <aside className={`w-full md:w-64 lg:w-72 shrink-0 rounded-3xl border shadow-2xl p-6 flex flex-col justify-between backdrop-blur-xl transition-colors min-h-[calc(100vh-6rem)] ${
              isDark ? 'border-white/5 bg-[#1e1d1a]/85 shadow-black/80' : 'border-stone-200/90 bg-white/95 shadow-stone-200/60'
            }`}>
              <div className="space-y-7">
                {/* Brand Header */}
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl" role="img" aria-label="Mango">🥭</span>
                  <div>
                    <h1 className={`text-base font-bold tracking-tight ${isDark ? 'text-stone-100' : 'text-slate-900'}`}>
                      MANGO VPN
                    </h1>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-stone-400' : 'text-amber-700'}`}>
                      Mango Consultant Co., Ltd.
                    </p>
                  </div>
                </div>

                {/* Non-Admin Navigation Menu */}
                <nav role="tablist" aria-label="Client Navigation" className="space-y-2">
                  {[
                    { id: 'connection', labelTh: 'การเชื่อมต่อ', labelEn: 'Connection', icon: Activity },
                    { id: 'profile', labelTh: 'โปรไฟล์และความปลอดภัย', labelEn: 'Profile & Security', icon: ShieldCheck },
                    { id: 'help', labelTh: 'ช่วยเหลือ', labelEn: 'Help', icon: HelpCircle },
                  ].map((item) => {
                    const isActive = clientTab === item.id;
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-label={item.labelEn}
                        aria-selected={isActive}
                        onClick={() => setClientTab(item.id as 'connection' | 'profile' | 'help')}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs sm:text-sm transition-all text-left ${
                          isActive
                            ? isDark
                              ? 'bg-[#7a4918] text-amber-200 font-semibold shadow-sm'
                              : 'bg-[#f59e0b] text-stone-950 font-semibold shadow-sm'
                            : isDark
                              ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 font-medium'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <ItemIcon className="h-4 w-4 shrink-0" />
                        <span>{lang === 'th' ? item.labelTh : item.labelEn}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Sidebar Footer: User Info & Log Out */}
              <div className={`pt-4 border-t space-y-2 ${isDark ? 'border-stone-800/60' : 'border-stone-200/80'}`}>
                <div className="text-xs">
                  <span className={`font-semibold ${isDark ? 'text-stone-200' : 'text-slate-800'}`}>
                    {step.session.user.username}
                  </span>
                  <span className="text-stone-500 mx-1.5">·</span>
                  <span className={`font-bold ${
                    step.session.user.role === 'STAFF' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {step.session.user.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Log Out"
                  className="w-full flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-rose-400 transition-colors pt-1"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{lang === 'th' ? 'ออกจากระบบ' : 'Log Out'}</span>
                </button>
              </div>
            </aside>

            {/* Right Main Content Area */}
            <section className="flex-1 w-full space-y-6 min-h-[calc(100vh-6rem)]">
              {/* Header Greeting matching Reference Mockup */}
              <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? 'text-stone-100' : 'text-slate-900'}`}>
                    {lang === 'th' ? `สวัสดี, ${step.session.user.username}` : `Welcome, ${step.session.user.username}`}
                  </h2>
                  <p className={`text-xs font-medium mt-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    {lang === 'th' ? 'สถานะการเชื่อมต่อของคุณตอนนี้' : 'Your current connection status'}
                  </p>
                </div>

                {/* Top Right Controls: Language & Theme Capsules */}
                <div className="flex items-center gap-3">
                  {/* Language Switcher */}
                  <div className={`flex items-center rounded-full p-1 text-xs font-semibold shadow-inner border transition-colors ${
                    isDark ? 'bg-[#1e1d1a]/85 border-white/5' : 'bg-white border-stone-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setLang('th')}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        lang === 'th'
                          ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                          : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      TH
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        lang === 'en'
                          ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                          : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      EN
                    </button>
                  </div>

                  {/* Theme Switcher Capsule (Sun | Moon) */}
                  <div
                    role="group"
                    aria-label="Toggle theme"
                    className={`flex items-center rounded-full p-1 text-xs font-semibold shadow-inner border transition-colors ${
                      isDark ? 'bg-[#1e1d1a]/85 border-white/5' : 'bg-white border-stone-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setIsDark(false)}
                      aria-label="Light mode"
                      className={`p-1.5 rounded-full transition-colors ${
                        !isDark
                          ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDark(true)}
                      aria-label="Dark mode"
                      className={`p-1.5 rounded-full transition-colors ${
                        isDark
                          ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </header>

              {/* Tab Views */}
              {clientTab === 'connection' && (
                <div className="w-full">
                  <AgentStatusCard
                    accessToken={step.session.accessToken}
                    userRole={step.session.user.role}
                    auth={authContext}
                  />
                </div>
              )}

              {clientTab === 'profile' && (
                <div className="w-full space-y-6">
                  {/* Profile Card */}
                  <div className={`rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl ${
                    isDark ? 'border-white/5 bg-[#1e1d1a]/85 shadow-black/80' : 'border-stone-200/90 bg-white/95 shadow-stone-200/60'
                  }`}>
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                          {lang === 'th' ? 'ข้อมูลโปรไฟล์และความปลอดภัย' : 'Profile & Security Overview'}
                        </h3>
                        <p className="text-xs text-stone-400 mt-1">
                          {lang === 'th' ? 'ข้อมูลบัญชีผู้ใช้และสถานะการยืนยันตัวตน' : 'Account credentials and identity posture'}
                        </p>
                      </div>
                      <span className={`font-mono text-xs font-bold px-3 py-1 rounded-full border ${
                        step.session.user.role === 'STAFF'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      }`}>
                        {step.session.user.role}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className={`p-4 rounded-2xl border ${isDark ? 'border-white/5 bg-[#141311]/70' : 'border-stone-200 bg-stone-50'}`}>
                        <span className="text-stone-400 block text-[11px]">{lang === 'th' ? 'ชื่อผู้ใช้' : 'Username'}</span>
                        <span className="font-semibold text-stone-100 text-sm mt-0.5 block">{step.session.user.username}</span>
                      </div>
                      <div className={`p-4 rounded-2xl border ${isDark ? 'border-white/5 bg-[#141311]/70' : 'border-stone-200 bg-stone-50'}`}>
                        <span className="text-stone-400 block text-[11px]">{lang === 'th' ? 'อีเมลองค์กร' : 'Email'}</span>
                        <span className="font-semibold text-stone-100 text-sm mt-0.5 block">{step.session.user.email}</span>
                      </div>
                      <div className={`p-4 rounded-2xl border ${isDark ? 'border-white/5 bg-[#141311]/70' : 'border-stone-200 bg-stone-50'}`}>
                        <span className="text-stone-400 block text-[11px]">{lang === 'th' ? 'การยืนยันตัวตน 2 ขั้น (MFA)' : 'Two-Factor Authentication'}</span>
                        <span className="font-semibold text-emerald-400 text-sm mt-0.5 block flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4" />
                          {lang === 'th' ? 'เปิดใช้งานแล้ว (TOTP Authenticator)' : 'Enabled (TOTP Authenticator)'}
                        </span>
                      </div>
                      <div className={`p-4 rounded-2xl border ${isDark ? 'border-white/5 bg-[#141311]/70' : 'border-stone-200 bg-stone-50'}`}>
                        <span className="text-stone-400 block text-[11px]">{lang === 'th' ? 'สถานะเซสชัน' : 'Session Status'}</span>
                        <span className="font-semibold text-stone-200 text-sm mt-0.5 block">
                          {lang === 'th' ? 'ทำงานอยู่ (หมุนเวียนโทเค็นอัตโนมัติ)' : 'Active (Auto-refreshing JWT)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {clientTab === 'help' && (
                <div className="w-full space-y-6">
                  {/* Help & Troubleshooting Card */}
                  <div className={`rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl ${
                    isDark ? 'border-white/5 bg-[#1e1d1a]/85 shadow-black/80' : 'border-stone-200/90 bg-white/95 shadow-stone-200/60'
                  }`}>
                    <div className="border-b border-white/5 pb-4">
                      <h3 className={`text-lg font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                        {lang === 'th' ? 'ช่วยเหลือและแก้ปัญหาการใช้งาน' : 'Help & Troubleshooting'}
                      </h3>
                      <p className="text-xs text-stone-400 mt-1">
                        {lang === 'th' ? 'วิธีเชื่อมต่อและข้อแนะนำสำหรับโปรแกรม MANGO Windows Agent' : 'Guidance for connecting via MANGO Windows Agent'}
                      </p>
                    </div>

                    <div className="space-y-4 text-xs leading-relaxed text-stone-300">
                      <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'border-white/5 bg-[#141311]/70' : 'border-stone-200 bg-stone-50'}`}>
                        <h4 className="font-bold text-amber-400 text-sm">
                          {lang === 'th' ? '1. ตรวจสอบการทำงานของ Windows Agent' : '1. Verify Windows Agent is Running'}
                        </h4>
                        <p className="text-stone-400">
                          {lang === 'th'
                            ? 'โปรแกรม MANGO Windows Agent จะต้องเปิดทำงานอยู่ในเบื้องหลัง และเปิดพอร์ต 127.0.0.1:47821 บนเครื่องคอมพิวเตอร์ของคุณ'
                            : 'MANGO Windows Agent must run in the background listening on loopback port 127.0.0.1:47821.'}
                        </p>
                      </div>

                      <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'border-white/5 bg-[#141311]/70' : 'border-stone-200 bg-stone-50'}`}>
                        <h4 className="font-bold text-amber-400 text-sm">
                          {lang === 'th' ? '2. การจับคู่ Agent (Pairing Token)' : '2. Agent Pairing Token'}
                        </h4>
                        <p className="text-stone-400">
                          {lang === 'th'
                            ? 'หากหน้าจอขึ้นสถานะ "Agent Reachable (Unpaired)" ให้คัดลอก Pairing Token ที่สร้างจากคอนฟิกของ Agent มาวางในช่อง Agent Pairing Token แล้วกดยืนยัน'
                            : 'If the status says "Agent Reachable (Unpaired)", paste your token into the Agent Pairing Token field and click Pair Agent.'}
                        </p>
                      </div>

                      <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'border-white/5 bg-[#141311]/70' : 'border-stone-200 bg-stone-50'}`}>
                        <h4 className="font-bold text-emerald-400 text-sm">
                          {lang === 'th' ? '3. ติดต่อฝ่ายไอที (IT Support)' : '3. IT Support Contact'}
                        </h4>
                        <p className="text-stone-400">
                          {lang === 'th'
                            ? 'หากพบปัญหาการเข้าถึงเครือข่าย หรือต้องการเพิ่มสิทธิ์การใช้งาน กรุณาติดต่อ: บริษัท แมงโก้ คอนซัลแตนท์ จำกัด (แผนกไอที) โทร 02-xxx-xxxx หรืออีเมล support@mangoconsultant.com'
                            : 'Need additional network permissions or experiencing issues? Contact IT Support at support@mangoconsultant.com'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={`min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#141311] text-stone-100' : 'bg-[#fcfbf7] text-stone-900'
    }`}>
      {/* Ambient gradient glows (Mango Theme: Warm Golden Amber & Moss/Mint Green) */}
      <div className={`absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
        isDark ? 'bg-amber-500/18' : 'bg-yellow-400/25'
      }`} />
      <div className={`absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
        isDark ? 'bg-emerald-600/15' : 'bg-emerald-300/25'
      }`} />

      {/* Centered Floating 2-Column Card */}
      <section className={`w-full max-w-3xl lg:max-w-4xl min-h-[580px] grid grid-cols-1 md:grid-cols-12 rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-md relative z-10 transition-colors duration-300 ${
        isDark
          ? 'border-white/5 bg-[#1e1d1a]/85 shadow-black/80'
          : 'border-stone-200/90 bg-white/95 shadow-stone-200/60'
      }`}>
        
        {/* Left Column: Mango Hero Banner */}
        <div className={`md:col-span-5 p-8 sm:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r relative overflow-hidden transition-colors duration-300 ${
          isDark
            ? 'bg-gradient-to-br from-amber-500/10 via-[#1a1815] to-[#141311] border-white/5'
            : 'bg-gradient-to-br from-yellow-400/15 via-[#faf8f2] to-white border-stone-200/80'
        }`}>
          {/* Subtle inner accent glow */}
          <div className={`absolute -top-12 -left-12 w-44 h-44 rounded-full blur-2xl pointer-events-none ${
            isDark ? 'bg-amber-500/15' : 'bg-yellow-400/20'
          }`} />

          {/* Top Brand Header */}
          <div className="space-y-1 relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl" role="img" aria-label="Mango">🥭</span>
              <div>
                <h1 className={`text-lg font-bold tracking-tight flex items-center gap-1.5 ${
                  isDark ? 'text-stone-100' : 'text-stone-900'
                }`}>
                  MANGO VPN
                </h1>
                <p className={`text-[11px] font-medium ${
                  isDark ? 'text-amber-400' : 'text-amber-600'
                }`}>Mango Consultant Co., Ltd.</p>
              </div>
            </div>
          </div>

          {/* Center Greeting & Tagline */}
          <div className="my-8 md:my-0 space-y-3 relative z-10">
            <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug ${
              isDark ? 'text-stone-100' : 'text-stone-900'
            }`}>
              {lang === 'th' ? 'ยินดีต้อนรับกลับมา' : 'Welcome back'}
            </h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${
              isDark ? 'text-stone-300/90' : 'text-stone-600'
            }`}>
              {lang === 'th'
                ? 'เข้าสู่ระบบเพื่อใช้งานเครือข่ายองค์กรของคุณ'
                : 'Sign in to access your company network'}
            </p>
          </div>

          {/* Bottom Copyright Footer */}
          <div className={`relative z-10 pt-4 border-t ${
            isDark ? 'border-white/5' : 'border-stone-200/80'
          }`}>
            <p className={`text-[10px] ${
              isDark ? 'text-stone-500' : 'text-stone-400'
            }`}>
              {lang === 'th'
                ? `© ${new Date().getFullYear()} บริษัท แมงโก้ คอนซัลแตนท์ จำกัด`
                : `© ${new Date().getFullYear()} Mango Consultant Co., Ltd.`}
            </p>
          </div>
        </div>

        {/* Right Column: Sign In & MFA Form */}
        <div className={`md:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-6 transition-colors duration-300 ${
          isDark ? 'bg-[#1e1d1a]/80' : 'bg-white/95'
        }`}>
          {/* Top Bar: Language & Theme Switches */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${
              isDark ? 'text-stone-400' : 'text-stone-500'
            }`}>
              {step.kind === 'mfa'
                ? (lang === 'th' ? 'ขั้นตอนที่ 2: ยืนยันตัวตน' : 'Step 2: 2FA Verification')
                : (lang === 'th' ? 'เข้าสู่ระบบเครือข่าย' : 'Network Access')}
            </span>

            <div className="flex items-center gap-2">
              {/* Language Switcher Pills */}
              <div className={`flex items-center rounded-full p-1 text-xs font-semibold shadow-inner border transition-colors ${
                isDark ? 'bg-[#141311] border-white/5' : 'bg-stone-100 border-stone-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setLang('th')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    lang === 'th'
                      ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                      : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  TH
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    lang === 'en'
                      ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                      : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  EN
                </button>
              </div>

              {/* Theme Switcher Capsule (Sun | Moon) */}
              <div
                role="group"
                aria-label="Toggle theme"
                className={`flex items-center rounded-full p-1 text-xs font-semibold shadow-inner border transition-colors ${
                  isDark ? 'bg-[#141311] border-white/5' : 'bg-stone-100 border-stone-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsDark(false)}
                  aria-label="Light mode"
                  className={`p-1.5 rounded-full transition-colors ${
                    !isDark
                      ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDark(true)}
                  aria-label="Dark mode"
                  className={`p-1.5 rounded-full transition-colors ${
                    isDark
                      ? 'bg-[#f59e0b] text-stone-950 shadow-sm font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Form Header */}
          <div>
            <h3 className={`text-xl sm:text-2xl font-bold ${
              isDark ? 'text-stone-100' : 'text-stone-900'
            }`}>
              {step.kind === 'login'
                ? (lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign in')
                : (lang === 'th' ? 'ยืนยันตัวตน 2 ชั้น' : 'Two-Factor Authentication')}
            </h3>
            <p className={`text-xs mt-1 ${
              isDark ? 'text-stone-400' : 'text-stone-500'
            }`}>
              {step.kind === 'login'
                ? (lang === 'th' ? 'กรอกข้อมูลชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน' : 'Enter your credentials to access the VPN dashboard')
                : (lang === 'th' ? 'กรอกรหัส 6 หลักจากแอป Authenticator' : 'Enter 6-digit code from Authenticator app')}
            </p>
          </div>

          {/* Error / Notification Banner */}
          {errorMessage && (
            <div
              role="alert"
              className={`rounded-2xl border p-3.5 text-xs shadow-inner ${
                errorMessage.includes('เซสชัน') || errorMessage.toLowerCase().includes('session')
                  ? 'border-amber-500/30 bg-amber-950/30 text-amber-200 flex items-start gap-2.5'
                  : step.kind === 'mfa'
                    ? 'border-red-900/60 bg-red-950/60 text-center text-red-200 space-y-1'
                    : 'flex items-start gap-2 border-red-500/40 bg-red-950/50 text-red-200'
              }`}
            >
              {step.kind === 'mfa' ? (
                <>
                  <div className="flex items-center justify-center gap-1.5 font-bold text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>
                      {errorMessage.includes('6 digits')
                        ? errorMessage
                        : (lang === 'th' ? 'รหัสไม่ถูกต้องหรือหมดอายุ' : errorMessage)}
                    </span>
                  </div>
                  <p className="text-[11px] text-red-400/90">
                    {lang === 'th'
                      ? 'ใช้รหัสล่าสุดจากแอป รหัสเปลี่ยนทุก 30 วินาที'
                      : 'Use the latest code from Authenticator app, rotates every 30s'}
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${
                    errorMessage.includes('เซสชัน') || errorMessage.toLowerCase().includes('session')
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`} />
                  <span>{errorMessage}</span>
                </>
              )}
            </div>
          )}

          {/* Login Form */}
          {step.kind === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="username" className={`block text-xs sm:text-sm font-medium ${
                  isDark ? 'text-stone-300' : 'text-stone-700'
                }`}>
                  {lang === 'th' ? 'ชื่อผู้ใช้' : 'Username'}                 
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-3.5 h-4 w-4 pointer-events-none ${
                    isDark ? 'text-stone-500' : 'text-stone-400'
                  }`} />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    aria-label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น somchai หรือ admin' : 'e.g. somchai or admin'}
                    className={`w-full h-11 rounded-xl border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-colors ${
                      isDark
                        ? 'border-white/10 bg-[#262420]/70 text-stone-100 placeholder-stone-500 focus:border-amber-400'
                        : 'border-stone-300 bg-white text-stone-900 placeholder-stone-400 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className={`block text-xs sm:text-sm font-medium ${
                  isDark ? 'text-stone-300' : 'text-stone-700'
                }`}>
                  {lang === 'th' ? 'รหัสผ่าน' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-3.5 h-4 w-4 pointer-events-none ${
                    isDark ? 'text-stone-500' : 'text-stone-400'
                  }`} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full h-11 rounded-xl border pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-colors ${
                      isDark
                        ? 'border-white/10 bg-[#262420]/70 text-stone-100 placeholder-stone-500 focus:border-amber-400'
                        : 'border-stone-300 bg-white text-stone-900 placeholder-stone-400 focus:border-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide secret' : 'Show secret'}
                    title={lang === 'th' ? (showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน') : (showPassword ? 'Hide password' : 'Show password')}
                    className={`absolute right-3 top-3 p-1 rounded-lg transition-colors ${
                      isDark
                        ? 'text-stone-400 hover:text-stone-200 hover:bg-[#262420]'
                        : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-label="Sign In"
                className="w-full h-11 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-stone-950 font-bold px-4 text-sm shadow-md shadow-amber-500/20 transition-all hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Signing in...') : (lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign in')}
              </button>

              {/* Helper text directly under sign in button matching reference */}
              <p className={`text-[11px] text-center pt-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                {lang === 'th'
                  ? 'บัญชีสร้างโดยผู้ดูแลระบบ หากเข้าไม่ได้ติดต่อฝ่ายไอที'
                  : "Accounts are created by your admin. Contact IT if you can't sign in."}
              </p>
            </form>
          )}

          {/* MFA Challenge Form */}
          {step.kind === 'mfa' && (
            <form onSubmit={handleOtpSubmit} className="space-y-5" noValidate>
              <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
                <KeyRound className="h-4 w-4" />
                <span>
                  {step.challenge.status === 'MFA_SETUP_REQUIRED'
                    ? 'Set Up Authenticator'
                    : 'Two-Factor Verification'}
                </span>
              </div>

              {/* QR Code and Secret Key block for First-time setup */}
              {step.challenge.status === 'MFA_SETUP_REQUIRED' && (
                <div className={`space-y-3 rounded-2xl border p-4 text-center ${
                  isDark ? 'border-white/5 bg-[#141311]/80' : 'border-stone-200 bg-stone-50'
                }`}>
                  <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>
                    Scan this QR code with your Authenticator app, or enter the key manually.
                  </p>
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="TOTP Authenticator QR Code"
                      className="mx-auto rounded-xl bg-white p-2 shadow-md"
                    />
                  )}
                  <code className={`block break-all rounded-lg px-2 py-1 text-xs font-mono font-bold border ${
                    isDark ? 'bg-[#262420] text-amber-300 border-white/5' : 'bg-stone-200 text-amber-800 border-stone-300'
                  }`}>
                    {step.challenge.secretBase32}
                  </code>
                </div>
              )}

              {/* 6-Digit Individual PIN Slots */}
              <div className="space-y-2">
                <label htmlFor="otp-code" className={`block text-xs sm:text-sm font-medium ${
                  isDark ? 'text-stone-300' : 'text-stone-700'
                }`}>
                  6-Digit Code
                </label>
                <div className="relative">
                  {/* Accessible master input covering the PIN slots */}
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    aria-label="6-Digit Code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.slice(0, 6))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-text z-20"
                    autoFocus
                  />

                  {/* 6 Visual PIN Slots */}
                  <div
                    role="group"
                    aria-label="OTP digit inputs"
                    className="grid grid-cols-6 gap-2 sm:gap-3 relative z-10 pointer-events-none"
                  >
                    {[0, 1, 2, 3, 4, 5].map((index) => {
                      const char = otpCode[index] ?? '';
                      const isCurrent = otpCode.length === index || (otpCode.length === 6 && index === 5);
                      return (
                        <div
                          key={index}
                          className={`h-14 sm:h-16 rounded-2xl flex items-center justify-center font-mono text-2xl font-bold transition-all shadow-sm ${
                            char
                              ? isDark
                                ? 'bg-[#262420] border-2 border-amber-500/40 text-stone-100 shadow-inner'
                                : 'bg-white border-2 border-stone-300 text-stone-900 shadow-inner'
                              : isCurrent
                                ? isDark
                                  ? 'bg-[#262420] border-2 border-amber-500 ring-2 ring-amber-500/25 text-stone-100'
                                  : 'bg-white border-2 border-amber-500 ring-2 ring-amber-500/25 text-stone-900'
                                : isDark
                                  ? 'bg-[#141311]/60 border border-white/5 text-stone-500'
                                  : 'bg-stone-50 border border-stone-200 text-stone-400'
                          }`}
                        >
                          {char ? (
                            <span>{char}</span>
                          ) : isCurrent ? (
                            <span className="w-0.5 h-6 bg-amber-500 animate-pulse rounded" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Verify Action Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                aria-label="Verify"
                className="w-full h-11 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-stone-950 font-bold px-4 text-sm shadow-md shadow-amber-500/20 transition-all hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting
                  ? (lang === 'th' ? 'กำลังตรวจสอบ...' : 'Verifying...')
                  : (lang === 'th' ? 'ยืนยัน' : 'Verify')}
              </button>

              {/* Bottom Setup & Back Links */}
              <div className="space-y-2 pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowSetupKey(!showSetupKey)}
                  className={`text-xs underline transition-colors ${
                    isDark ? 'text-stone-400 hover:text-amber-400' : 'text-stone-600 hover:text-amber-600'
                  }`}
                >
                  {lang === 'th'
                    ? (showSetupKey ? 'ซ่อนคำแนะนำการตั้งค่า' : 'ตั้งค่าแอป Authenticator ใหม่ด้วยคีย์')
                    : (showSetupKey ? 'Hide Setup Instructions' : 'Set up Authenticator app with key')}
                </button>

                {showSetupKey && (
                  <p className={`text-[11px] p-2.5 rounded-xl border text-left leading-relaxed ${
                    isDark ? 'border-white/5 bg-[#141311] text-stone-300' : 'border-stone-200 bg-stone-100 text-stone-700'
                  }`}>
                    {lang === 'th'
                      ? '💡 หากเปลี่ยนเครื่องหรือต้องการผูก Authenticator ใหม่ กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อขอรีเซ็ตคีย์ MFA ตามนโยบายความปลอดภัย Zero-Trust'
                      : '💡 If you changed your device or need to re-link Authenticator, please contact your Administrator to reset your MFA token under Zero-Trust policy.'}
                  </p>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => clearLocalSession(null)}
                    className={`text-xs transition-colors ${
                      isDark ? 'text-stone-500 hover:text-stone-300' : 'text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    {lang === 'th' ? '← ย้อนกลับไปหน้าเข้าสู่ระบบ' : '← Back to Sign In'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Bottom IT Help Note */}
          <div className={`pt-3 text-center border-t ${
            isDark ? 'border-slate-800/40 text-slate-400' : 'border-slate-200/80 text-slate-500'
          }`}>
            <p className="text-[11px]">
              {lang === 'th'
                ? 'บัญชีสร้างโดยผู้ดูแลระบบ หากเข้าไม่ได้ติดต่อฝ่ายไอที'
                : 'Accounts are provisioned by Administrator. Contact IT support for assistance.'}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
