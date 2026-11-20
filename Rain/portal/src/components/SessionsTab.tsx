import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SessionStatus, type VpnSessionDto } from '@mango/shared';
import { disconnectSession, fetchSessions } from '../lib/adminApi';

interface SessionsTabProps {
  apiBaseUrl: string;
  accessToken: string;
}

export function SessionsTab({ apiBaseUrl, accessToken }: SessionsTabProps) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['admin-sessions', apiBaseUrl],
    queryFn: () => fetchSessions(apiBaseUrl, accessToken),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => disconnectSession(apiBaseUrl, accessToken, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-sessions', apiBaseUrl] });
    },
  });

  const sessions: VpnSessionDto[] = listQuery.data?.items ?? [];
  const activeError = listQuery.error ?? disconnectMutation.error ?? null;

  return (
    <section aria-label="Sessions" className="space-y-4">
      {activeError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200"
        >
          {activeError instanceof Error ? activeError.message : 'Session request failed'}
        </div>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading VPN sessions...</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          No VPN sessions found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">User / Device</th>
                <th className="px-3 py-2">Assigned IP</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{s.username ?? s.userId}</div>
                    <div className="text-slate-400">{s.hostname ?? s.deviceId}</div>
                  </td>
                  <td className="px-3 py-2 font-mono">{s.assignedIp}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        s.status === SessionStatus.ACTIVE
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-700/40 text-slate-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={s.status !== SessionStatus.ACTIVE || disconnectMutation.isPending}
                      onClick={() => disconnectMutation.mutate(s.id)}
                      className="rounded border border-red-700/60 px-2 py-1 text-xs text-red-200 hover:bg-red-950/60 disabled:opacity-40"
                    >
                      Disconnect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
