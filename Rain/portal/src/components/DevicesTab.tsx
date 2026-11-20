import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeviceStatus, type DeviceDto } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { fetchDevices, revokeDevice } from '../lib/adminApi';

interface DevicesTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

export function DevicesTab({ apiBaseUrl, accessToken, auth }: DevicesTabProps) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['admin-devices', apiBaseUrl],
    queryFn: () => fetchDevices(apiBaseUrl, accessToken, auth),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeDevice(apiBaseUrl, accessToken, id, auth),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-devices', apiBaseUrl] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sessions', apiBaseUrl] });
    },
  });

  const devices: DeviceDto[] = listQuery.data?.items ?? [];
  const activeError = listQuery.error ?? revokeMutation.error ?? null;

  return (
    <section aria-label="Devices" className="space-y-4">
      {activeError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200"
        >
          {activeError instanceof Error ? activeError.message : 'Device request failed'}
        </div>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading devices...</p>
      ) : devices.length === 0 && !listQuery.error ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          No devices found.
        </div>
      ) : devices.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">Hostname</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {devices.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{d.hostname}</div>
                    <div className="font-mono text-[11px] text-slate-400">{d.fingerprint}</div>
                  </td>
                  <td className="px-3 py-2">{d.username ?? d.userId}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        d.status === DeviceStatus.ACTIVE
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-red-500/15 text-red-300'
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={d.status === DeviceStatus.REVOKED || revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(d.id)}
                      className="rounded border border-red-700/60 px-2 py-1 text-xs text-red-200 hover:bg-red-950/60 disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
