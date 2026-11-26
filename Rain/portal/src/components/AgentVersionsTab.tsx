import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Download, Package, Search, Shield, UploadCloud, X } from 'lucide-react';
import type { AgentVersionDto, UpdateAgentVersionRequest } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import {
  createAgentVersion,
  fetchAgentVersions,
  updateAgentVersion,
} from '../lib/adminApi';
import { getThemeClasses, type UiLang } from '../lib/theme';

interface AgentVersionsTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
  lang?: UiLang;
  isDark?: boolean;
}

export function AgentVersionsTab({ apiBaseUrl, accessToken, auth, lang = 'th', isDark = true }: AgentVersionsTabProps) {
  const t = getThemeClasses(isDark);
  const queryClient = useQueryClient();
  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('windows-x64');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [sha256Checksum, setSha256Checksum] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'ALL' | 'windows-x64' | 'linux-x64'>('ALL');

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
  const filteredVersions = versions.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      term === '' ||
      item.version.toLowerCase().includes(term) ||
      item.platform.toLowerCase().includes(term) ||
      item.sha256Checksum.toLowerCase().includes(term);
    const matchesPlatform = platformFilter === 'ALL' || item.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });
  const activeError =
    listQuery.error ?? createMutation.error ?? updateMutation.error ?? null;

  return (
    <section aria-label="Agent Versions" className="space-y-6">
      {/* Header Info Banner */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b ${t.border}`}>
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-400" />
            <h2 className={`text-lg font-bold tracking-tight ${t.heading}`}>
              {lang === 'th' ? 'จัดการเวอร์ชัน Agent (Agent Versions Registry)' : 'Agent Versions Registry'}
            </h2>
          </div>
          <p className={`text-xs mt-1 ${t.muted}`}>
            {lang === 'th'
              ? 'ควบคุมเวอร์ชันของไคลเอนต์ Windows Agent ที่อนุญาตให้เชื่อมต่อเข้าระบบ Zero-Trust'
              : 'Manage allowed Windows/Linux Agent releases and minimum required versions'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs px-3 py-1 rounded-full border ${t.pillMuted}`}>
            {lang === 'th' ? `ทั้งหมด ${versions.length} เวอร์ชัน` : `Total ${versions.length} Versions`}
          </span>
        </div>
      </div>

      {/* Publish Form Card */}
      <form
        onSubmit={handleSubmit}
        className={`rounded-3xl border p-6 space-y-5 ${t.card}`}
      >
        <div className={`flex items-center gap-2 text-sm font-bold ${t.heading}`}>
          <UploadCloud className="h-4 w-4 text-amber-400" />
          <span>{lang === 'th' ? 'เผยแพร่เวอร์ชันใหม่ (Publish Version)' : 'Publish Agent Version'}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="agent-version" className={`block text-xs font-medium ${t.muted}`}>
              {lang === 'th' ? 'เวอร์ชัน (Version)' : 'Version'}
            </label>
            <input
              id="agent-version"
              aria-label="Version"
              type="text"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="เช่น 2.0.0"
              className={`w-full h-10 rounded-xl border px-3.5 text-xs focus:outline-none transition-colors ${t.input}`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-platform" className={`block text-xs font-medium ${t.muted}`}>
              {lang === 'th' ? 'แพลตฟอร์ม (Platform)' : 'Platform'}
            </label>
            <input
              id="agent-platform"
              aria-label="Platform"
              type="text"
              required
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={`w-full h-10 rounded-xl border px-3.5 text-xs focus:outline-none transition-colors ${t.input}`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-download-url" className={`block text-xs font-medium ${t.muted}`}>
              {lang === 'th' ? 'ลิงก์ดาวน์โหลด (Download URL)' : 'Download URL'}
            </label>
            <input
              id="agent-download-url"
              aria-label="Download URL"
              type="url"
              required
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="https://downloads.mango.local/agent-2.0.0.msi"
              className={`w-full h-10 rounded-xl border px-3.5 text-xs focus:outline-none transition-colors ${t.input}`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-checksum" className={`block text-xs font-medium ${t.muted}`}>
              SHA-256 Checksum
            </label>
            <input
              id="agent-checksum"
              aria-label="SHA-256 Checksum"
              type="text"
              required
              value={sha256Checksum}
              onChange={(e) => setSha256Checksum(e.target.value)}
              placeholder="64-character hex SHA-256"
              className={`w-full h-10 rounded-xl border px-3.5 text-xs font-mono focus:outline-none transition-colors ${t.input}`}
            />
          </div>
        </div>

        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t ${t.border}`}>
          <label className={`flex items-center gap-2.5 text-xs cursor-pointer ${t.text}`}>
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-[#262420] text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="font-medium">
              {lang === 'th' ? 'กำหนดเป็นเวอร์ชันขั้นต่ำ' : 'Minimum required version'}
            </span>
            <span className={`text-[11px] ${t.muted}`}>
              {lang === 'th' ? '(บังคับให้อุปกรณ์ต้องใช้เวอร์ชันนี้หรือใหม่กว่า)' : '(Enforce minimum client version)'}
            </span>
          </label>

          <button
            type="submit"
            aria-label="Publish Version"
            disabled={createMutation.isPending}
            className="h-10 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-5 text-xs font-bold text-stone-950 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending
              ? (lang === 'th' ? 'กำลังเผยแพร่...' : 'Publishing...')
              : (lang === 'th' ? 'เผยแพร่เวอร์ชัน' : 'Publish Version')}
          </button>
        </div>
      </form>

      {/* Error Alert */}
      {activeError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-xs text-red-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <span>{activeError instanceof Error ? activeError.message : 'Agent version operation failed'}</span>
        </div>
      )}

      {/* Search & Platform Filter Bar */}
      {versions.length > 0 && (
        <div className={`flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between rounded-2xl border p-4 ${t.card}`}>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
            <input
              type="text"
              aria-label="Search agent versions"
              placeholder={lang === 'th' ? 'ค้นหาเวอร์ชัน แพลตฟอร์ม หรือ SHA-256...' : 'Search version, platform, or SHA-256...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full sm:max-w-sm h-10 rounded-xl border pl-9 pr-9 text-xs focus:outline-none transition-colors ${t.input}`}
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full ${t.muted}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter platform"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value as 'ALL' | 'windows-x64' | 'linux-x64')}
              className={`h-10 rounded-xl border px-3 text-xs focus:outline-none cursor-pointer ${t.input}`}
            >
              <option value="ALL">{lang === 'th' ? 'ทุกแพลตฟอร์ม' : 'All Platforms'}</option>
              <option value="windows-x64">windows-x64</option>
              <option value="linux-x64">linux-x64</option>
            </select>
          </div>
        </div>
      )}

      {/* Table / List View */}
      {listQuery.isLoading ? (
        <div className={`rounded-3xl border p-8 text-center text-xs ${t.card} ${t.muted}`}>
          {lang === 'th' ? 'กำลังโหลดข้อมูลเวอร์ชัน Agent...' : 'Loading agent versions...'}
        </div>
      ) : versions.length === 0 && !listQuery.error ? (
        <div className={`rounded-3xl border p-8 text-center space-y-2 ${t.card}`}>
          <Package className="h-8 w-8 text-stone-500 mx-auto mb-2" />
          <p className={`text-sm font-semibold ${t.text}`}>
            {lang === 'th' ? 'ยังไม่มีเวอร์ชัน Agent ในระบบ' : 'No agent versions registered.'}
          </p>
          {lang === 'th' && <span className="sr-only">No agent versions registered.</span>}
          <p className={`text-xs ${t.muted}`}>
            {lang === 'th' ? 'ยังไม่มีประวัติการเผยแพร่เวอร์ชัน Agent ในระบบ' : 'Published client builds will appear here.'}
          </p>
        </div>
      ) : filteredVersions.length === 0 ? (
        <div className={`rounded-3xl border p-8 text-center text-xs space-y-2 ${t.card} ${t.muted}`}>
          <p>{lang === 'th' ? 'ไม่พบเวอร์ชัน Agent ที่ตรงกับการค้นหา' : 'No agent versions match your search.'}</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setPlatformFilter('ALL');
            }}
            className="text-amber-400 hover:underline font-semibold"
          >
            {lang === 'th' ? 'ล้างการค้นหา' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <div className={`rounded-3xl border overflow-hidden ${t.card}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`text-[11px] uppercase tracking-wider ${t.tableHead}`}>
                <tr>
                  <th className="px-5 py-3.5 font-bold">{lang === 'th' ? 'เวอร์ชัน' : 'Version'}</th>
                  <th className="px-5 py-3.5 font-bold">{lang === 'th' ? 'แพลตฟอร์ม' : 'Platform'}</th>
                  <th className="px-5 py-3.5 font-bold">SHA-256</th>
                  <th className="px-5 py-3.5 font-bold">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                  <th className="px-5 py-3.5 font-bold text-right">{lang === 'th' ? 'การทำงาน' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.divide}`}>
                {filteredVersions.map((item) => (
                  <tr key={item.id} className={`transition-colors ${t.tableRow}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-sm ${t.heading}`}>{item.version}</span>
                        {item.downloadUrl && (
                          <a
                            href={item.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download Link"
                            className={`${t.muted} hover:text-amber-400`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className={`px-5 py-4 font-mono text-xs ${t.text}`}>
                      <span className={`px-2.5 py-1 rounded-lg border ${t.pillMuted}`}>
                        {item.platform}
                      </span>
                    </td>
                    <td className={`px-5 py-4 font-mono text-xs ${t.muted}`} title={item.sha256Checksum}>
                      <span className={`px-2 py-0.5 rounded border ${t.subCard}`}>
                        {item.sha256Checksum.slice(0, 12)}...
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                            item.isActive
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                              : t.pillMuted
                          }`}
                        >
                          {item.isActive && <CheckCircle2 className="h-3 w-3" />}
                          <span>{item.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                        {item.isRequired && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold">
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
                          aria-label={item.isActive ? 'Deactivate' : 'Activate'}
                          onClick={() =>
                            updateMutation.mutate({
                              id: item.id,
                              patch: { isActive: !item.isActive },
                            })
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                            item.isActive
                              ? t.secondaryBtn
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                          }`}
                        >
                          {item.isActive
                            ? (lang === 'th' ? 'ปิดใช้งาน' : 'Deactivate')
                            : (lang === 'th' ? 'เปิดใช้งาน' : 'Activate')}
                        </button>
                        <button
                          type="button"
                          aria-label={item.isRequired ? 'Mark Optional' : 'Mark Required'}
                          onClick={() =>
                            updateMutation.mutate({
                              id: item.id,
                              patch: { isRequired: !item.isRequired },
                            })
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                            item.isRequired
                              ? t.secondaryBtn
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          }`}
                        >
                          {item.isRequired
                            ? (lang === 'th' ? 'ไม่บังคับ' : 'Mark Optional')
                            : (lang === 'th' ? 'ตั้งเป็นบังคับ' : 'Mark Required')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
