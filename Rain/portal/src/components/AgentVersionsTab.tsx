import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentVersionDto, UpdateAgentVersionRequest } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import {
  createAgentVersion,
  fetchAgentVersions,
  updateAgentVersion,
} from '../lib/adminApi';

interface AgentVersionsTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

export function AgentVersionsTab({ apiBaseUrl, accessToken, auth }: AgentVersionsTabProps) {
  const queryClient = useQueryClient();
  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('windows-x64');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [sha256Checksum, setSha256Checksum] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  const listQuery = useQuery({
    queryKey: ['agent-versions', apiBaseUrl],
    queryFn: () => fetchAgentVersions(apiBaseUrl, accessToken, auth),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAgentVersion(
        apiBaseUrl,
        accessToken,
        {
          version,
          platform,
          downloadUrl,
          sha256Checksum,
          isActive: true,
          isRequired,
        },
        auth,
      ),
    onSuccess: () => {
      setVersion('');
      setDownloadUrl('');
      setSha256Checksum('');
      setIsRequired(false);
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', apiBaseUrl] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateAgentVersionRequest }) =>
      updateAgentVersion(apiBaseUrl, accessToken, id, patch, auth),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', apiBaseUrl] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const versions: AgentVersionDto[] = listQuery.data?.items ?? [];
  const activeError =
    listQuery.error ?? createMutation.error ?? updateMutation.error ?? null;

  return (
    <section aria-label="Agent Versions" className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-100">Publish Agent Version</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="agent-version" className="block text-xs text-slate-400 mb-1">
              Version
            </label>
            <input
              id="agent-version"
              type="text"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.3.0"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="agent-platform" className="block text-xs text-slate-400 mb-1">
              Platform
            </label>
            <input
              id="agent-platform"
              type="text"
              required
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="agent-download-url" className="block text-xs text-slate-400 mb-1">
              Download URL
            </label>
            <input
              id="agent-download-url"
              type="url"
              required
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="https://downloads.mango.local/agent-1.3.0.msi"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="agent-checksum" className="block text-xs text-slate-400 mb-1">
              SHA-256 Checksum
            </label>
            <input
              id="agent-checksum"
              type="text"
              required
              value={sha256Checksum}
              onChange={(e) => setSha256Checksum(e.target.value)}
              placeholder="64-character hex SHA-256"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-100"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Minimum required version
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            Publish Version
          </button>
        </div>
      </form>

      {activeError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-200"
        >
          {activeError instanceof Error ? activeError.message : 'Agent version operation failed'}
        </div>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading agent versions...</p>
      ) : versions.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
          No agent versions registered.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">SHA-256</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {versions.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-100">{item.version}</td>
                  <td className="px-4 py-3 text-slate-300">{item.platform}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400" title={item.sha256Checksum}>
                    {item.sha256Checksum.slice(0, 12)}...
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs ${
                        item.isActive
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-700/40 text-slate-400'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {item.isRequired && (
                      <span className="inline-block rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                        Required
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({
                          id: item.id,
                          patch: { isActive: !item.isActive },
                        })
                      }
                      className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({
                          id: item.id,
                          patch: { isRequired: !item.isRequired },
                        })
                      }
                      className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      {item.isRequired ? 'Mark Optional' : 'Mark Required'}
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
