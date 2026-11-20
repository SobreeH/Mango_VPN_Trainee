import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleName, type UserDto } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { createUser, fetchUsers, updateUserStatus } from '../lib/adminApi';

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
          username,
          email,
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const users: UserDto[] = listQuery.data?.items ?? [];
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
            <label htmlFor="new-user-password" className="block text-xs text-slate-400 mb-1">
              Password
            </label>
            <input
              id="new-user-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
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
          disabled={createMutation.isPending}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
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

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading users...</p>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          No users found.
        </div>
      ) : (
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
              {users.map((u) => (
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
                      onClick={() => statusMutation.mutate({ id: u.id, isActive: !u.isActive })}
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
      )}
    </section>
  );
}
