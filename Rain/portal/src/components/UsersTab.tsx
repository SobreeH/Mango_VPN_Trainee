import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { RoleName, type UserDto } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { createUser, fetchUsers, updateUserStatus } from '../lib/adminApi';
import { downloadCsv } from '../lib/csv';
import { getThemeClasses, type UiLang } from '../lib/theme';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

interface UsersTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
  lang?: UiLang;
  isDark?: boolean;
}

function exportUsersToCsv(usersToExport: UserDto[]) {
  const headers = ['User ID', 'Username', 'Email', 'Role', 'Status', 'MFA Enabled', 'Created At'];
  const rows = usersToExport.map((u) => [
    u.id,
    u.username,
    u.email,
    u.role,
    u.isActive ? 'ACTIVE' : 'DISABLED',
    u.totpEnabled ? 'YES' : 'NO',
    u.createdAt ? new Date(u.createdAt).toISOString() : '',
  ]);
  downloadCsv(`mango-vpn-users-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function UsersTab({ apiBaseUrl, accessToken, auth, lang = 'th', isDark = true }: UsersTabProps) {
  const t = getThemeClasses(isDark);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleName>(RoleName.CLIENT);

  // Search & Role Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | RoleName>('ALL');

  // Confirmation modal state
  const [pendingToggle, setPendingToggle] = useState<{ id: string; username: string; isActive: boolean } | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-users', apiBaseUrl],
    queryFn: () => fetchUsers(apiBaseUrl, accessToken, auth),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createUser(
        apiBaseUrl,
        accessToken,
        {
          username: username.trim(),
          email: email.trim(),
          password,
          role,
        },
        auth,
      ),
    onSuccess: (newUser) => {
      showToast({
        type: 'success',
        title: 'User Created',
        message: `User ${newUser.username} (${newUser.role}) was provisioned successfully.`,
      });
      setUsername('');
      setEmail('');
      setPassword('');
      setRole(RoleName.CLIENT);
      void queryClient.invalidateQueries({ queryKey: ['admin-users', apiBaseUrl] });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: err instanceof Error ? err.message : 'Failed to create user',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUserStatus(apiBaseUrl, accessToken, id, { isActive }, auth),
    onSuccess: (updated) => {
      showToast({
        type: updated.isActive ? 'success' : 'warning',
        title: 'User Status Updated',
        message: `Account for ${updated.username} is now ${updated.isActive ? 'Active' : 'Disabled'}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-users', apiBaseUrl] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sessions', apiBaseUrl] });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Status Update Failed',
        message: err instanceof Error ? err.message : 'Failed to update user status',
      });
    },
  });

  const isPasswordValid = password.length >= 12;
  const isFormValid = username.trim().length > 0 && email.trim().length > 0 && isPasswordValid;

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    const array = new Uint32Array(16);
    crypto.getRandomValues(array);
    const randomPass = Array.from(array, (x) => chars[x % chars.length]).join('');
    setPassword(randomPass);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isFormValid) return;
    createMutation.mutate();
  };

  const users: UserDto[] = listQuery.data?.items ?? [];

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeError = listQuery.error ?? createMutation.error ?? statusMutation.error ?? null;

  return (
    <section aria-label="Users" className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className={`rounded-3xl border p-6 space-y-4 ${t.card}`}
      >
        <h3 className={`text-sm font-bold ${t.heading}`}>
          {lang === 'th' ? 'สร้างบัญชีผู้ใช้ใหม่' : 'Create User'}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-user-username" className={`block text-xs font-medium mb-1 ${t.muted}`}>
              {lang === 'th' ? 'ชื่อผู้ใช้ (Username)' : 'Username'}
            </label>
            <input
              id="new-user-username"
              aria-label="Username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full h-11 rounded-xl border px-4 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${t.input}`}
            />
          </div>
          <div>
            <label htmlFor="new-user-email" className={`block text-xs font-medium mb-1 ${t.muted}`}>
              {lang === 'th' ? 'อีเมล (Email)' : 'Email'}
            </label>
            <input
              id="new-user-email"
              aria-label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full h-11 rounded-xl border px-4 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${t.input}`}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="new-user-password" className={`block text-xs font-medium ${t.muted}`}>
                {lang === 'th' ? 'รหัสผ่าน (Password)' : 'Password'}
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] text-amber-500 hover:text-emerald-400 underline font-medium"
              >
                {lang === 'th' ? 'สุ่มรหัสผ่านปลอดภัย' : 'Generate Secure'}
              </button>
            </div>
            <input
              id="new-user-password"
              aria-label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full h-11 rounded-xl border px-4 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${t.input}`}
            />
            <div className="mt-1 text-[11px]">
              <span
                className={
                  password.length === 0
                    ? t.muted
                    : password.length < 12
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }
              >
                {password.length === 0
                  ? (lang === 'th' ? 'ต้องมีความยาวอย่างน้อย 12 ตัวอักษร' : 'Must be at least 12 characters')
                  : password.length < 12
                  ? (lang === 'th' ? `รหัสผ่านสั้นเกินไป (${password.length}/12 ตัว)` : `Password too short (${password.length}/12 characters)`)
                  : (lang === 'th' ? 'ความยาวรหัสผ่านปลอดภัย (>= 12 ตัว)' : 'Password length valid (>= 12 characters)')}
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="new-user-role" className={`block text-xs font-medium mb-1 ${t.muted}`}>
              {lang === 'th' ? 'บทบาท (Role)' : 'Role'}
            </label>
            <select
              id="new-user-role"
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleName)}
              className={`w-full h-11 rounded-xl border px-4 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors cursor-pointer ${t.input}`}
            >
              <option value={RoleName.ADMIN}>ADMIN</option>
              <option value={RoleName.STAFF}>STAFF</option>
              <option value={RoleName.CLIENT}>CLIENT</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          aria-label="Create User"
          disabled={!isFormValid || createMutation.isPending}
          className="h-11 rounded-xl bg-[#059669] hover:bg-[#047857] px-6 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending
            ? (lang === 'th' ? 'กำลังสร้าง...' : 'Creating...')
            : (lang === 'th' ? 'สร้างบัญชีผู้ใช้' : 'Create User')}
        </button>
      </form>

      {activeError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/40 bg-red-950/50 p-4 text-xs sm:text-sm text-red-200"
        >
          {activeError instanceof Error ? activeError.message : 'User request failed'}
        </div>
      )}

      {/* Search & Filter Bar */}
      {users.length > 0 && (
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border p-4 ${t.card}`}>
          <div className="flex-1">
            <input
              type="text"
              aria-label="Search users"
              placeholder={lang === 'th' ? 'ค้นหาชื่อผู้ใช้หรืออีเมล...' : 'Search by username or email...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full sm:max-w-xs h-10 rounded-xl border px-4 text-xs focus:outline-none transition-colors ${t.input}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="filter-user-role" className={`text-xs ${t.muted}`}>
              Role:
            </label>
            <select
              id="filter-user-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | RoleName)}
              className={`h-10 rounded-xl border px-3 text-xs focus:outline-none cursor-pointer ${t.input}`}
            >
              <option value="ALL">{lang === 'th' ? 'ทุกบทบาท' : 'All Roles'}</option>
              <option value={RoleName.ADMIN}>ADMIN</option>
              <option value={RoleName.STAFF}>STAFF</option>
              <option value={RoleName.CLIENT}>CLIENT</option>
            </select>
            <button
              type="button"
              aria-label="Export Users CSV"
              onClick={() => {
                exportUsersToCsv(filteredUsers);
                showToast({
                  type: 'success',
                  title: 'Users Exported',
                  message: `Exported ${filteredUsers.length} user records to CSV.`,
                });
              }}
              disabled={filteredUsers.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      )}

      {listQuery.isLoading ? (
        <p className={`text-sm ${t.muted}`}>{lang === 'th' ? 'กำลังโหลดข้อมูลผู้ใช้...' : 'Loading users...'}</p>
      ) : users.length === 0 && !listQuery.error ? (
        <div className={`rounded-3xl border p-8 text-center text-sm ${t.card} ${t.muted}`}>
          {lang === 'th' ? 'ไม่พบบัญชีผู้ใช้ในระบบ' : 'No users found.'}
          {lang === 'th' && <span className="sr-only">No users found.</span>}
        </div>
      ) : filteredUsers.length === 0 && users.length > 0 ? (
        <div className={`rounded-3xl border p-8 text-center text-sm ${t.card} ${t.muted}`}>
          {lang === 'th' ? `ไม่พบผู้ใช้ที่ตรงกับ "${searchTerm}"` : `No matching users found for "${searchTerm}".`}
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className={`overflow-x-auto rounded-3xl border ${t.card}`}>
          <table className={`w-full text-left text-xs sm:text-sm ${t.text}`}>
            <thead className={`text-xs font-semibold ${t.tableHead}`}>
              <tr>
                <th className="px-6 py-4">{lang === 'th' ? 'ชื่อผู้ใช้' : 'Username'}</th>
                <th className="px-6 py-4">{lang === 'th' ? 'บทบาท' : 'Role'}</th>
                <th className="px-6 py-4">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                <th className="px-6 py-4 text-right">{lang === 'th' ? 'การทำงาน' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divide}`}>
              {filteredUsers.map((u) => (
                <tr key={u.id} className={`transition-colors ${t.tableRow}`}>
                  <td className="px-6 py-4">
                    <div className={`font-bold text-sm tracking-tight ${t.heading}`}>{u.username}</div>
                    <div className={`text-xs mt-0.5 ${t.muted}`}>{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-bold">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-medium border ${
                        u.isActive
                          ? isDark
                            ? 'bg-[#162a1e]/90 border-emerald-900/40 text-emerald-400'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : isDark
                            ? 'bg-[#2a1719]/90 border-rose-900/40 text-rose-400'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.isActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400'
                        }`}
                      />
                      <span>
                        {u.isActive
                          ? (lang === 'th' ? 'ใช้งานอยู่' : 'Active')
                          : (lang === 'th' ? 'ระงับบัญชี' : 'Disabled')}
                      </span>
                      {lang === 'th' && (
                        <span className="sr-only">{u.isActive ? 'Active' : 'Disabled'}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      aria-label={u.isActive ? 'Disable' : 'Enable'}
                      disabled={statusMutation.isPending}
                      onClick={() => setPendingToggle({ id: u.id, username: u.username, isActive: !u.isActive })}
                      className={`rounded-xl px-5 py-1.5 text-xs font-medium border transition-colors disabled:opacity-35 disabled:cursor-not-allowed shadow-sm ${
                        u.isActive
                          ? 'border-rose-900/50 bg-[#381a1c]/80 text-rose-200 hover:bg-rose-900/60'
                          : 'border-emerald-900/50 bg-[#162a1e]/80 text-emerald-300 hover:bg-emerald-900/60'
                      }`}
                    >
                      {u.isActive
                        ? (lang === 'th' ? 'ระงับสิทธิ์' : 'Disable')
                        : (lang === 'th' ? 'เปิดใช้งาน' : 'Enable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Confirmation Modal for Suspend/Activate */}
      <ConfirmModal
        isOpen={pendingToggle !== null}
        isDark={isDark}
        title={pendingToggle?.isActive ? 'Enable User Account' : 'Disable User Account'}
        message={
          pendingToggle?.isActive ? (
            <p>
              Are you sure you want to enable account{' '}
              <strong className={t.heading}>{pendingToggle.username}</strong>?
            </p>
          ) : (
            <p>
              Are you sure you want to disable account{' '}
              <strong className={t.heading}>{pendingToggle?.username}</strong>? They will be
              unable to log in or establish WireGuard VPN tunnels.
            </p>
          )
        }
        confirmLabel={pendingToggle?.isActive ? 'Enable User' : 'Disable User'}
        cancelLabel={lang === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmVariant={pendingToggle?.isActive ? 'primary' : 'danger'}
        isLoading={statusMutation.isPending}
        onConfirm={() => {
          if (pendingToggle) {
            statusMutation.mutate(
              { id: pendingToggle.id, isActive: pendingToggle.isActive },
              { onSettled: () => setPendingToggle(null) },
            );
          }
        }}
        onCancel={() => setPendingToggle(null)}
      />
    </section>
  );
}
