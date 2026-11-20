import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditLogDto } from '@mango/shared';
import { fetchAuditLogs } from '../lib/adminApi';

interface AuditLogsTabProps {
  apiBaseUrl: string;
  accessToken: string;
}

export function AuditLogsTab({ apiBaseUrl, accessToken }: AuditLogsTabProps) {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);

  const query = useQuery({
    queryKey: ['audit-logs', apiBaseUrl, page, actionFilter, targetTypeFilter, searchFilter],
    queryFn: () =>
      fetchAuditLogs(apiBaseUrl, accessToken, {
        page,
        pageSize: 20,
        action: actionFilter || undefined,
        targetType: targetTypeFilter || undefined,
        search: searchFilter || undefined,
      }),
  });

  const logs = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  return (
    <section aria-label="Audit Logs" className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="audit-action-filter" className="block text-xs font-medium text-slate-400 mb-1">
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label htmlFor="audit-target-filter" className="block text-xs font-medium text-slate-400 mb-1">
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label htmlFor="audit-search-filter" className="block text-xs font-medium text-slate-400 mb-1">
            Search
          </label>
          <input
            id="audit-search-filter"
            type="text"
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Username, IP, target ID..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </div>
      </div>

      {query.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-200"
        >
          {query.error instanceof Error ? query.error.message : 'Failed to load audit logs'}
        </div>
      )}

      {query.isLoading ? (
        <p className="text-sm text-slate-400">Loading audit logs...</p>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
          No audit logs found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-300">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-200">{log.actorUsername ?? log.actorUserId ?? 'system'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-amber-300">{log.action}</td>
                  <td className="px-4 py-3 text-slate-300">{log.targetType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.ipAddress ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-slate-700 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-700 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {selectedLog && (
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Audit Payload: {selectedLog.action}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-200">
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
