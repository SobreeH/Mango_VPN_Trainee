import { Shield } from 'lucide-react';

export function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <section className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">MANGO VPN</h1>
        <p className="text-sm text-slate-400">Zero-Trust WireGuard Portal</p>
      </section>
    </main>
  );
}

export default App;
