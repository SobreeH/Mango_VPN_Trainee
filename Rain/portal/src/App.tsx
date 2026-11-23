import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LogOut, AlertCircle, Sun, Moon, Lock, User, Eye, EyeOff } from 'lucide-react';
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
          onAuthExpired: (message) => clearLocalSession(message),
        }
      : undefined;

  if (step.kind === 'authenticated') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 sm:p-6 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label="Mango">🥭</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                  MANGO VPN
                  <span className="text-xs font-normal text-slate-400">Zero-Trust Portal</span>
                </h1>
                <p className="text-xs text-amber-400/90 font-medium">Mango Consultant Co., Ltd.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-sm font-semibold text-slate-100">{step.session.user.username}</span>
                  <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
                    {step.session.user.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{step.session.user.email}</p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log Out"
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-rose-950/60 hover:text-rose-200 hover:border-rose-700/50 transition-colors shadow-sm"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </div>
          </header>

          <AgentStatusCard
            accessToken={step.session.accessToken}
            userRole={step.session.user.role}
            auth={authContext}
          />

          {step.session.user.role === RoleName.ADMIN && (
            <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 sm:p-6 backdrop-blur-md shadow-xl">
              <div role="tablist" aria-label="Admin Governance" className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
                {(
                  [
                    ['audit-logs', 'Audit Logs'],
                    ['agent-versions', 'Agent Versions'],
                    ['users', 'Users'],
                    ['devices', 'Devices'],
                    ['sessions', 'Sessions'],
                    ['policies', 'Policies'],
                  ] as const
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tabKey}
                    onClick={() => setActiveTab(tabKey)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === tabKey
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5">
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
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Ambient warm gradient glows */}
      <div className={`absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
        isDark ? 'bg-amber-500/15' : 'bg-amber-300/35'
      }`} />
      <div className={`absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
        isDark ? 'bg-emerald-500/10' : 'bg-emerald-300/25'
      }`} />

      {/* Centered Floating 2-Column Card (Compact / Non-full width, with roomy vertical min-height) */}
      <section className={`w-full max-w-3xl lg:max-w-4xl min-h-[580px] grid grid-cols-1 md:grid-cols-12 rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-md relative z-10 transition-colors duration-300 ${
        isDark
          ? 'border-slate-800/80 bg-slate-900/95 shadow-black/40'
          : 'border-slate-200/90 bg-white/95 shadow-slate-300/60'
      }`}>
        
        {/* Left Column: Mango Hero Banner */}
        <div className={`md:col-span-5 p-8 sm:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r relative overflow-hidden transition-colors duration-300 ${
          isDark
            ? 'bg-gradient-to-br from-amber-600/25 via-amber-950/20 to-slate-950 border-slate-800/60'
            : 'bg-gradient-to-br from-amber-500/15 via-amber-100/50 to-slate-50 border-slate-200/80'
        }`}>
          {/* Subtle inner accent glow */}
          <div className={`absolute -top-12 -left-12 w-44 h-44 rounded-full blur-2xl pointer-events-none ${
            isDark ? 'bg-amber-500/20' : 'bg-amber-300/30'
          }`} />

          {/* Top Brand Header */}
          <div className="space-y-1 relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl" role="img" aria-label="Mango">🥭</span>
              <div>
                <h1 className={`text-lg font-bold tracking-tight flex items-center gap-1.5 ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}>
                  MANGO VPN
                </h1>
                <p className={`text-[11px] font-medium ${
                  isDark ? 'text-amber-300/80' : 'text-amber-700'
                }`}>Mango Consultant Co., Ltd.</p>
              </div>
            </div>
          </div>

          {/* Center Greeting & Tagline */}
          <div className="my-8 md:my-0 space-y-3 relative z-10">
            <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {lang === 'th' ? 'ยินดีต้อนรับกลับมา' : 'Welcome Back!'}
            </h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${
              isDark ? 'text-slate-300/90' : 'text-slate-600'
            }`}>
              {lang === 'th'
                ? 'เข้าสู่ระบบเพื่อใช้งานเครือข่ายองค์กรของคุณ'
                : 'Log in to access your organization secure zero-trust network.'}
            </p>
          </div>

          {/* Bottom Copyright Footer */}
          <div className={`relative z-10 pt-4 border-t ${
            isDark ? 'border-slate-800/50' : 'border-slate-200/80'
          }`}>
            <p className={`text-[10px] ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}>
              © {new Date().getFullYear()} บริษัท แมงโก้ คอนซัลแตนท์ จำกัด
            </p>
          </div>
        </div>

        {/* Right Column: Sign In & MFA Form */}
        <div className={`md:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-6 transition-colors duration-300 ${
          isDark ? 'bg-slate-950/80' : 'bg-white/95'
        }`}>
          {/* Top Bar: Language & Theme Switches */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {step.kind === 'mfa'
                ? (lang === 'th' ? 'ขั้นตอนที่ 2: ยืนยันตัวตน' : 'Step 2: 2FA Verification')
                : (lang === 'th' ? 'เข้าสู่ระบบเครือข่าย' : 'Network Access')}
            </span>

            <div className="flex items-center gap-2">
              {/* Language Switcher Pills */}
              <div className={`flex items-center rounded-full p-0.5 text-xs font-semibold shadow-inner border transition-colors ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setLang('th')}
                  className={`px-2.5 py-0.5 rounded-full transition-colors ${
                    lang === 'th'
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                      : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  TH
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-0.5 rounded-full transition-colors ${
                    lang === 'en'
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                      : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  EN
                </button>
              </div>

              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={() => setIsDark(!isDark)}
                aria-label="Toggle theme"
                className={`flex items-center justify-center h-7 w-7 rounded-full border transition-colors shadow-inner ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-amber-400 hover:text-amber-300'
                    : 'bg-slate-100 border-slate-200 text-amber-600 hover:text-amber-700'
                }`}
              >
                {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Form Header */}
          <div>
            <h3 className={`text-xl sm:text-2xl font-bold ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {step.kind === 'login'
                ? (lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign In')
                : (lang === 'th' ? 'ยืนยันตัวตน 2 ชั้น' : 'Two-Factor Authentication')}
            </h3>
            <p className={`text-xs mt-1 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {step.kind === 'login'
                ? (lang === 'th' ? 'กรอกข้อมูลชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน' : 'Enter your credentials to access the VPN dashboard')
                : (lang === 'th' ? 'กรอกรหัส 6 หลักจากแอป Authenticator' : 'Enter 6-digit code from Authenticator app')}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className={`rounded-2xl border p-3.5 text-xs text-red-200 space-y-1 shadow-inner ${
                step.kind === 'mfa'
                  ? 'border-red-900/60 bg-red-950/60 text-center'
                  : 'flex items-start gap-2 border-red-500/40 bg-red-950/50'
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
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
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
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {lang === 'th' ? 'ชื่อผู้ใช้' : 'Username'}
                  <span className={`text-[11px] ml-1.5 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>(Username)</span>
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-3.5 h-4 w-4 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    aria-label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น somchai หรือ admin' : 'e.g. somchai or admin'}
                    className={`w-full h-11 rounded-xl border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors ${
                      isDark
                        ? 'border-slate-700 bg-slate-900/80 text-slate-100 placeholder-slate-500 focus:border-amber-400'
                        : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className={`block text-xs sm:text-sm font-medium ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {lang === 'th' ? 'รหัสผ่าน' : 'Password'}
                  <span className={`text-[11px] ml-1.5 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>(Password)</span>
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-3.5 h-4 w-4 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full h-11 rounded-xl border pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors ${
                      isDark
                        ? 'border-slate-700 bg-slate-900/80 text-slate-100 placeholder-slate-500 focus:border-amber-400'
                        : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide secret' : 'Show secret'}
                    title={lang === 'th' ? (showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน') : (showPassword ? 'Hide password' : 'Show password')}
                    className={`absolute right-3 top-3 p-1 rounded-lg transition-colors ${
                      isDark
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
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
                className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 text-sm shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Signing in...') : (lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign In')}
              </button>
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
                  isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
                }`}>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Scan this QR code with your Authenticator app, or enter the key manually.
                  </p>
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="TOTP Authenticator QR Code"
                      className="mx-auto rounded-xl bg-white p-2 shadow-md"
                    />
                  )}
                  <code className={`block break-all rounded-lg px-2 py-1 text-xs font-mono font-bold ${
                    isDark ? 'bg-slate-950 text-amber-300' : 'bg-slate-200 text-amber-700'
                  }`}>
                    {step.challenge.secretBase32}
                  </code>
                </div>
              )}

              {/* 6-Digit Individual PIN Slots */}
              <div className="space-y-2">
                <label htmlFor="otp-code" className={`block text-xs sm:text-sm font-medium ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
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

                  {/* 6 Visual PIN Slots matching the Reference Image */}
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
                                ? 'bg-slate-900 border-2 border-slate-700 text-slate-100 shadow-inner'
                                : 'bg-white border-2 border-slate-300 text-slate-900 shadow-inner'
                              : isCurrent
                                ? isDark
                                  ? 'bg-slate-900/90 border-2 border-amber-500 ring-2 ring-amber-500/20 text-slate-100'
                                  : 'bg-white border-2 border-amber-500 ring-2 ring-amber-500/20 text-slate-900'
                                : isDark
                                  ? 'bg-slate-900/60 border border-slate-800 text-slate-500'
                                  : 'bg-slate-50 border border-slate-200 text-slate-400'
                          }`}
                        >
                          {char ? (
                            <span>{char}</span>
                          ) : isCurrent ? (
                            <span className="w-0.5 h-6 bg-amber-400 animate-pulse rounded" />
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
                className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 text-sm shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    isDark ? 'text-slate-400 hover:text-amber-400' : 'text-slate-600 hover:text-amber-600'
                  }`}
                >
                  {lang === 'th'
                    ? (showSetupKey ? 'ซ่อนคำแนะนำการตั้งค่า' : 'ตั้งค่าแอป Authenticator ใหม่ด้วยคีย์')
                    : (showSetupKey ? 'Hide Setup Instructions' : 'Set up Authenticator app with key')}
                </button>

                {showSetupKey && (
                  <p className={`text-[11px] p-2.5 rounded-xl border text-left leading-relaxed ${
                    isDark ? 'border-slate-800 bg-slate-900/80 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
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
                      isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'
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
