import { useEffect, useState, type FormEvent } from 'react';
import { Shield, KeyRound, LogOut, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import QRCode from 'qrcode';
import type { AuthTokensResponse, LoginResponse } from '@mango/shared';
import { loginUser, logoutUser, verifyOtpCode } from './api/auth';
import { AgentStatusCard } from './components/AgentStatusCard';

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

export function App() {
  const [step, setStep] = useState<AuthStep>({ kind: 'login' });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleLogout() {
    if (step.kind !== 'authenticated') return;
    setErrorMessage(null);
    try {
      await logoutUser({ refreshToken: step.session.refreshToken });
    } finally {
      setUsername('');
      setPassword('');
      setOtpCode('');
      setStep({ kind: 'login' });
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <section className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl space-y-6">
        <header className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">MANGO VPN</h1>
          <p className="text-sm text-slate-400">Zero-Trust WireGuard Portal</p>
        </header>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {step.kind === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium text-slate-300">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {step.kind === 'mfa' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4" noValidate>
            <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <KeyRound className="h-4 w-4" />
              <span>
                {step.challenge.status === 'MFA_SETUP_REQUIRED'
                  ? 'Set Up Authenticator'
                  : 'Two-Factor Verification'}
              </span>
            </div>

            {step.challenge.status === 'MFA_SETUP_REQUIRED' && (
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4 text-center">
                <p className="text-xs text-slate-400">
                  Scan this QR code with your Authenticator app, or enter the key manually.
                </p>
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="TOTP Authenticator QR Code"
                    className="mx-auto rounded bg-white p-2"
                  />
                )}
                <code className="block break-all rounded bg-slate-900 px-2 py-1 text-xs text-amber-300">
                  {step.challenge.secretBase32}
                </code>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="otp-code" className="block text-sm font-medium text-slate-300">
                6-Digit Code
              </label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center font-mono text-lg tracking-widest text-slate-100 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        )}

        {step.kind === 'authenticated' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Signed in as</span>
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  {step.session.user.role}
                </span>
              </div>
              <p className="text-lg font-semibold text-slate-100">{step.session.user.username}</p>
              <p className="text-xs text-slate-400">{step.session.user.email}</p>
            </div>

            <AgentStatusCard />

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
