import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SessionStatus, VpnProviderType, type VpnSessionDto } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { disconnectSession, fetchSessions } from '../lib/adminApi';
import { ConfirmModal } from './ConfirmModal';

interface SessionsTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

export function SessionsTab({ apiBaseUrl, accessToken, auth }: SessionsTabProps) {
  const queryClient = useQueryClient();
  const [sessionToDisconnect, setSessionToDisconnect] = useState<{
    id: string;
    username: string;
    assignedIp: string;
  } | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-sessions', apiBaseUrl],
    queryFn: () => fetchSessions(apiBaseUrl, accessToken, auth),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => disconnectSession(apiBaseUrl, accessToken, id, auth),
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
      ) : sessions.length === 0 && !listQuery.error ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          No VPN sessions found.
        </div>
      ) : sessions.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">User / Device</th>
                <th className="px-3 py-2">Provider / Gateway</th>
                <th className="px-3 py-2">Assigned IP</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sessions.map((s) => {
                const provider = s.providerType ?? VpnProviderType.WIREGUARD;
                const providerBadgeClass =
                  provider === VpnProviderType.FORTINET
                    ? 'bg-rose-500/15 text-rose-300'
                    : provider === VpnProviderType.CISCO
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'bg-emerald-500/15 text-emerald-300';
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-100">{s.username ?? s.userId}</div>
                      <div className="text-slate-400">{s.hostname ?? s.deviceId}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${providerBadgeClass}`}>
                        {provider}
                      </span>
                      {s.gatewayName && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{s.gatewayName}</div>
                      )}
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
                      onClick={() =>
                        setSessionToDisconnect({
                          id: s.id,
                          username: s.username ?? s.userId,
                          assignedIp: s.assignedIp,
                        })
                      }
                      className="rounded border border-red-700/60 px-2 py-1 text-xs text-red-200 hover:bg-red-950/60 disabled:opacity-40"
                    >
                      Disconnect
                    </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Confirmation Modal for Disconnect Session */}
      <ConfirmModal
        isOpen={sessionToDisconnect !== null}
        title="Disconnect Active VPN Session"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to force disconnect the session for user{' '}
              <strong className="text-slate-100">{sessionToDisconnect?.username}</strong>?
            </p>
            <p className="font-mono text-xs text-emerald-400">
              Assigned IP: {sessionToDisconnect?.assignedIp}
            </p>
            <p className="text-xs text-amber-400 font-medium pt-1">
              ⚠️ The VPN peer/session will be immediately removed from the gateway daemon, terminating
              active network access.
            </p>
          </div>
        }
        confirmLabel="Disconnect Session"
        confirmVariant="danger"
        isLoading={disconnectMutation.isPending}
        onConfirm={() => {
          if (sessionToDisconnect) {
            disconnectMutation.mutate(sessionToDisconnect.id, {
              onSettled: () => setSessionToDisconnect(null),
            });
          }
        }}
        onCancel={() => setSessionToDisconnect(null)}
      />
    </section>
  );
}
