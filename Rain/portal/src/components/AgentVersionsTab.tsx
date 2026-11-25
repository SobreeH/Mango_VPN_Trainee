import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Download, Package, Shield, UploadCloud } from 'lucide-react';
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
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-stone-100 tracking-tight">
              จัดการเวอร์ชัน Agent (Agent Versions Registry)
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            ควบคุมเวอร์ชันของไคลเอนต์ Windows Agent ที่อนุญาตให้เชื่อมต่อเข้าระบบ Zero-Trust
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-3 py-1 rounded-full bg-white/5 text-stone-300 border border-white/5">
            ทั้งหมด {versions.length} เวอร์ชัน
          </span>
        </div>
      </div>

      {/* Publish Form Card */}
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 shadow-2xl backdrop-blur-xl space-y-5"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-stone-100">
          <UploadCloud className="h-4 w-4 text-amber-400" />
          <span>Publish Agent Version</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="agent-version" className="block text-xs font-medium text-stone-300">
              Version
            </label>
            <input
              id="agent-version"
              type="text"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="เช่น 2.0.0"
              className="w-full h-10 rounded-xl border border-white/10 bg-[#262420]/70 px-3.5 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-platform" className="block text-xs font-medium text-stone-300">
              Platform
            </label>
            <input
              id="agent-platform"
              type="text"
              required
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full h-10 rounded-xl border border-white/10 bg-[#262420]/70 px-3.5 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-download-url" className="block text-xs font-medium text-stone-300">
              Download URL
            </label>
            <input
              id="agent-download-url"
              type="url"
              required
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="https://downloads.mango.local/agent-2.0.0.msi"
              className="w-full h-10 rounded-xl border border-white/10 bg-[#262420]/70 px-3.5 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-checksum" className="block text-xs font-medium text-stone-300">
              SHA-256 Checksum
            </label>
            <input
              id="agent-checksum"
              type="text"
              required
              value={sha256Checksum}
              onChange={(e) => setSha256Checksum(e.target.value)}
              placeholder="64-character hex SHA-256"
              className="w-full h-10 rounded-xl border border-white/10 bg-[#262420]/70 px-3.5 text-xs font-mono text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/5">
          <label className="flex items-center gap-2.5 text-xs text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-[#262420] text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="font-medium">Minimum required version</span>
            <span className="text-stone-500 text-[11px]">(บังคับให้อุปกรณ์ต้องใช้เวอร์ชันนี้หรือใหม่กว่า)</span>
          </label>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="h-10 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-5 text-xs font-bold text-stone-950 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Publishing...' : 'Publish Version'}
          </button>
        </div>
      </form>

      {/* Error Alert */}
      {activeError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-xs text-red-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <span>{activeError instanceof Error ? activeError.message : 'Agent version operation failed'}</span>
        </div>
      )}

      {/* Table / List View */}
      {listQuery.isLoading ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-8 text-center text-xs text-stone-400">
          Loading agent versions...
        </div>
      ) : versions.length === 0 && !listQuery.error ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-8 text-center space-y-2">
          <Package className="h-8 w-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No agent versions registered.</p>
          <p className="text-xs text-stone-500">ยังไม่มีประวัติการเผยแพร่เวอร์ชัน Agent ในระบบ</p>
        </div>
      ) : versions.length > 0 ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141311]/80 text-[11px] uppercase tracking-wider text-stone-400 border-b border-white/5">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Version</th>
                  <th className="px-5 py-3.5 font-bold">Platform</th>
                  <th className="px-5 py-3.5 font-bold">SHA-256</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {versions.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-100 text-sm">{item.version}</span>
                        {item.downloadUrl && (
                          <a
                            href={item.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download Link"
                            className="text-stone-500 hover:text-amber-400"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-stone-300 font-mono text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
                        {item.platform}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-stone-400 text-xs" title={item.sha256Checksum}>
                      <span className="bg-black/30 px-2 py-0.5 rounded border border-white/5">
                        {item.sha256Checksum.slice(0, 12)}...
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                            item.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-stone-800/50 text-stone-400 border-stone-700/50'
                          }`}
                        >
                          {item.isActive && <CheckCircle2 className="h-3 w-3" />}
                          <span>{item.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                        {item.isRequired && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold">
                            <Shield className="h-3 w-3" />
                            <span>Required</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: item.id,
                              patch: { isActive: !item.isActive },
                            })
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                            item.isActive
                              ? 'border-white/10 bg-[#262420] text-stone-300 hover:bg-rose-950/60 hover:text-rose-200 hover:border-rose-900/50'
                              : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50'
                          }`}
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
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                            item.isRequired
                              ? 'border-white/10 bg-[#262420] text-stone-300 hover:text-white'
                              : 'border-amber-500/30 bg-amber-950/30 text-amber-300 hover:bg-amber-900/50'
                          }`}
                        >
                          {item.isRequired ? 'Mark Optional' : 'Mark Required'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
