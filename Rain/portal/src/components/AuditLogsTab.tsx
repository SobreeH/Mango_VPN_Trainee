import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, ShieldAlert, X } from 'lucide-react';
import type { AuditLogDto } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { fetchAuditLogs } from '../lib/adminApi';

interface AuditLogsTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportAuditLogsToCsv(logsToExport: AuditLogDto[]) {
  const headers = ['Timestamp', 'Actor Username', 'Actor User ID', 'Action', 'Target Type', 'Target ID', 'IP Address', 'Metadata'];
  const rows = logsToExport.map((log) => [
    new Date(log.createdAt).toISOString(),
    log.actorUsername ?? '',
    log.actorUserId ?? '',
    log.action,
    log.targetType,
    log.targetId ?? '',
    log.ipAddress ?? '',
    log.metadata ? JSON.stringify(log.metadata) : '',
  ]);

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mango-vpn-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AuditLogsTab({ apiBaseUrl, accessToken, auth }: AuditLogsTabProps) {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);

  const query = useQuery({
    queryKey: ['audit-logs', apiBaseUrl, page, actionFilter, targetTypeFilter, searchFilter],
    queryFn: () =>
      fetchAuditLogs(
        apiBaseUrl,
        accessToken,
        {
          page,
          pageSize: 20,
          action: actionFilter || undefined,
          targetType: targetTypeFilter || undefined,
          search: searchFilter || undefined,
        },
        auth,
      ),
  });

  const logs = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  return (
    <section aria-label="Audit Logs" className="space-y-6">
      {/* Search & Filter Header Card */}
      <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-100">Audit Logs & Security Trail</h2>
              <p className="text-[11px] text-stone-400">Zero-Trust activity records and administrator actions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => exportAuditLogsToCsv(logs)}
            disabled={logs.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="audit-action-filter" className="block text-xs font-medium text-stone-400 mb-1.5">
              Action filter
            </label>
            <input
              id="audit-action-filter"
              type="text"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. auth.login"
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-3.5 py-2 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="audit-target-filter" className="block text-xs font-medium text-stone-400 mb-1.5">
              Target type filter
            </label>
            <input
              id="audit-target-filter"
              type="text"
              value={targetTypeFilter}
              onChange={(e) => {
                setTargetTypeFilter(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. AUTH, AGENT_VERSION"
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-3.5 py-2 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="audit-search-filter" className="block text-xs font-medium text-stone-400 mb-1.5">
              Search
            </label>
            <div className="relative">
              <input
                id="audit-search-filter"
                type="text"
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Username, IP, target ID..."
                className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-3.5 py-2 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {query.isError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-300 flex items-center gap-2 shadow-lg"
        >
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{query.error instanceof Error ? query.error.message : 'Failed to load audit logs'}</span>
        </div>
      )}

      {query.isLoading ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-8 text-center text-xs text-stone-400 shadow-xl">
          Loading audit logs...
        </div>
      ) : logs.length === 0 && !query.isError ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-12 text-center text-xs text-stone-400 shadow-xl space-y-2">
          <FileText className="h-8 w-8 text-stone-600 mx-auto" />
          <p className="text-stone-300 font-medium">No audit logs found.</p>
          <p className="text-[11px] text-stone-500">Activity logs matching current filters will appear here.</p>
        </div>
      ) : logs.length > 0 ? (
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#1e1d1a]/85 shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141311]/80 text-[11px] uppercase tracking-wider text-stone-400 border-b border-white/5">
                <tr>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Target</th>
                  <th className="px-4 py-3.5">IP</th>
                  <th className="px-4 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-stone-400 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-200">
                      {log.actorUsername ?? log.actorUserId ?? 'system'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-amber-300">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-300">{log.targetType}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-stone-400">{log.ipAddress ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-stone-200 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 text-xs text-stone-400 border-t border-white/5 bg-[#141311]/40">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-stone-200 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-stone-200 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Payload Modal / Drawer */}
      {selectedLog && (
        <div className="rounded-3xl border border-amber-500/20 bg-[#1e1d1a]/95 p-5 shadow-2xl backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-xs font-bold text-stone-100 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Audit Payload: {selectedLog.action}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-400 hover:text-stone-100 hover:bg-white/5 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Close</span>
            </button>
          </div>
          <pre className="overflow-x-auto rounded-2xl bg-[#141311] border border-white/5 p-4 text-[11px] font-mono text-amber-200/90 leading-relaxed">
            {JSON.stringify(
              {
                id: selectedLog.id,
                targetType: selectedLog.targetType,
                targetId: selectedLog.targetId,
                metadata: selectedLog.metadata,
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </section>
  );
}
