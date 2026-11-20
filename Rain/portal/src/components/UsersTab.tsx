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
        className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-100">Create User</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-user-username" className="block text-xs text-slate-400 mb-1">
              Username
            </label>
            <input
              id="new-user-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="new-user-email" className="block text-xs text-slate-400 mb-1">
              Email
            </label>
            <input
              id="new-user-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="new-user-password" className="block text-xs text-slate-400">
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <div className="mt-1 text-[11px]">
              <span
                className={
                  password.length === 0
                    ? 'text-slate-400'
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
            <label htmlFor="new-user-role" className="block text-xs text-slate-400 mb-1">
              Role
            </label>
            <select
              id="new-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleName)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
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
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? 'Creating...' : 'Create User'}
        </button>
      </form>

      {activeError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200"
        >
          {activeError instanceof Error ? activeError.message : 'User request failed'}
        </div>
      )}

      {/* Search & Filter Bar */}
      {users.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="flex-1">
            <input
              type="text"
              aria-label="Search users"
              placeholder="Search by username or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-user-role" className="text-xs text-slate-400">
              Role:
            </label>
            <select
              id="filter-user-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | RoleName)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
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
        <p className="text-sm text-slate-400">Loading users...</p>
      ) : users.length === 0 && !listQuery.error ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          No users found.
        </div>
      ) : filteredUsers.length === 0 && users.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          No matching users found for "{searchTerm}".
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{u.username}</div>
                    <div className="text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 font-mono">{u.role}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        u.isActive
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-red-500/15 text-red-300'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={statusMutation.isPending}
                      onClick={() => setPendingToggle({ id: u.id, username: u.username, isActive: !u.isActive })}
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
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
