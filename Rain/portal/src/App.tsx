import { useState } from 'react';
import { Shield } from 'lucide-react';
import { RoleName, type AuthUserDto } from '@mango/shared';
import { DEFAULT_API_URL } from './lib/adminApi';
import { AuditLogsTab } from './components/AuditLogsTab';
import { AgentVersionsTab } from './components/AgentVersionsTab';

export interface PortalSession {
  accessToken: string;
  user: AuthUserDto;
}

export interface AppProps {
  initialSession?: PortalSession | null;
  apiBaseUrl?: string;
}

type AdminTab = 'audit-logs' | 'agent-versions';

export function App({ initialSession = null, apiBaseUrl = DEFAULT_API_URL }: AppProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('audit-logs');
  const isAdmin = initialSession?.user.role === RoleName.ADMIN;

  if (!initialSession || !isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
        <section className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">MANGO VPN</h1>
          <p className="text-sm text-slate-400">Zero-Trust WireGuard Portal</p>
          {initialSession && (
            <p className="text-xs text-slate-400">
              Signed in as {initialSession.user.username} ({initialSession.user.role})
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">MANGO VPN</h1>
              <p className="text-xs text-slate-400">Zero-Trust WireGuard Portal — Admin Console</p>
            </div>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            {initialSession.user.username} ({initialSession.user.role})
          </span>
        </header>

        <div role="tablist" aria-label="Admin Governance" className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit-logs'}
            onClick={() => setActiveTab('audit-logs')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'audit-logs'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            Audit Logs
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'agent-versions'}
            onClick={() => setActiveTab('agent-versions')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'agent-versions'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            Agent Versions
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          {activeTab === 'audit-logs' ? (
            <AuditLogsTab apiBaseUrl={apiBaseUrl} accessToken={initialSession.accessToken} />
          ) : (
            <AgentVersionsTab apiBaseUrl={apiBaseUrl} accessToken={initialSession.accessToken} />
          )}
        </div>
      </div>
    </main>
  );
}

export default App;
