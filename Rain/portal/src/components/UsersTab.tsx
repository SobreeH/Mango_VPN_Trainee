import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleName, type UserDto } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { createUser, fetchUsers, updateUserStatus } from '../lib/adminApi';
import { ConfirmModal } from './ConfirmModal';

interface UsersTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

export function UsersTab({ apiBaseUrl, accessToken, auth }: UsersTabProps) {
  const queryClient = useQueryClient();
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
    onSuccess: () => {
      setUsername('');
      setEmail('');
      setPassword('');
      setRole(RoleName.CLIENT);
      void queryClient.invalidateQueries({ queryKey: ['admin-users', apiBaseUrl] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUserStatus(apiBaseUrl, accessToken, id, { isActive }, auth),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users', apiBaseUrl] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sessions', apiBaseUrl] });
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
        className="rounded-3xl border border-white/5 bg-[#1e1d1a]/80 p-6 shadow-2xl backdrop-blur-xl space-y-4"
      >
        <h3 className="text-sm font-bold text-stone-100">Create User</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-user-username" className="block text-xs font-medium text-stone-400 mb-1">
              Username
            </label>
            <input
              id="new-user-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-11 rounded-xl border border-white/10 bg-[#262420]/70 px-4 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="new-user-email" className="block text-xs font-medium text-stone-400 mb-1">
              Email
            </label>
            <input
              id="new-user-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-xl border border-white/10 bg-[#262420]/70 px-4 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="new-user-password" className="block text-xs font-medium text-stone-400">
                Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
              >
                Generate Secure
              </button>
            </div>
            <input
              id="new-user-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 rounded-xl border border-white/10 bg-[#262420]/70 px-4 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors"
            />
            <div className="mt-1 text-[11px]">
              <span
                className={
                  password.length === 0
                    ? 'text-stone-400'
                    : password.length < 12
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {password.length === 0
                  ? 'Must be at least 12 characters'
                  : password.length < 12
                  ? `Password too short (${password.length}/12 characters)`
                  : 'Password length valid (>= 12 characters)'}
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="new-user-role" className="block text-xs font-medium text-stone-400 mb-1">
              Role
            </label>
            <select
              id="new-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleName)}
              className="w-full h-11 rounded-xl border border-white/10 bg-[#262420]/70 px-4 text-xs sm:text-sm text-stone-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors cursor-pointer"
            >
              <option value={RoleName.ADMIN}>ADMIN</option>
              <option value={RoleName.STAFF}>STAFF</option>
              <option value={RoleName.CLIENT}>CLIENT</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={!isFormValid || createMutation.isPending}
          className="h-11 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-6 text-xs sm:text-sm font-bold text-stone-950 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? 'Creating...' : 'Create User'}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/5 bg-[#1e1d1a]/60 p-4">
          <div className="flex-1">
            <input
              type="text"
              aria-label="Search users"
              placeholder="Search by username or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-xs h-10 rounded-xl border border-white/10 bg-[#262420]/70 px-4 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-user-role" className="text-xs text-stone-400">
              Role:
            </label>
            <select
              id="filter-user-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | RoleName)}
              className="h-10 rounded-xl border border-white/10 bg-[#262420]/70 px-3 text-xs text-stone-100 focus:border-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value={RoleName.ADMIN}>ADMIN</option>
              <option value={RoleName.STAFF}>STAFF</option>
              <option value={RoleName.CLIENT}>CLIENT</option>
            </select>
          </div>
        </div>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-stone-400">Loading users...</p>
      ) : users.length === 0 && !listQuery.error ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/80 p-8 text-center text-sm text-stone-400">
          No users found.
        </div>
      ) : filteredUsers.length === 0 && users.length > 0 ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/80 p-8 text-center text-sm text-stone-400">
          No matching users found for "{searchTerm}".
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="overflow-x-auto rounded-3xl border border-white/5 bg-[#1e1d1a]/80 shadow-2xl backdrop-blur-xl">
          <table className="w-full text-left text-xs sm:text-sm text-stone-300">
            <thead className="border-b border-white/5 text-stone-400 text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-stone-100 text-sm tracking-tight">{u.username}</div>
                    <div className="text-stone-400 text-xs mt-0.5">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-bold">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-medium border ${
                        u.isActive
                          ? 'bg-[#162a1e]/90 border-emerald-900/40 text-emerald-400'
                          : 'bg-[#2a1719]/90 border-rose-900/40 text-rose-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.isActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400'
                        }`}
                      />
                      <span>{u.isActive ? 'Active' : 'Disabled'}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      disabled={statusMutation.isPending}
                      onClick={() => setPendingToggle({ id: u.id, username: u.username, isActive: !u.isActive })}
                      className={`rounded-xl px-5 py-1.5 text-xs font-medium border transition-colors disabled:opacity-35 disabled:cursor-not-allowed shadow-sm ${
                        u.isActive
                          ? 'border-rose-900/50 bg-[#381a1c]/80 text-rose-200 hover:bg-rose-900/60'
                          : 'border-emerald-900/50 bg-[#162a1e]/80 text-emerald-300 hover:bg-emerald-900/60'
                      }`}
                    >
                      {u.isActive ? 'Disable' : 'Enable'}
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
        title={pendingToggle?.isActive ? 'Enable User Account' : 'Disable User Account'}
        message={
          pendingToggle?.isActive ? (
            <p>
              Are you sure you want to enable account{' '}
              <strong className="text-slate-100">{pendingToggle.username}</strong>?
            </p>
          ) : (
            <p>
              Are you sure you want to disable account{' '}
              <strong className="text-slate-100">{pendingToggle?.username}</strong>? They will be
              unable to log in or establish WireGuard VPN tunnels.
            </p>
          )
        }
        confirmLabel={pendingToggle?.isActive ? 'Enable User' : 'Disable User'}
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
