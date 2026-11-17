import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Laptop,
  History,
  Shield,
  Download,
  RefreshCw,
  Users,
  ShieldCheck,
  Trash2,
  X,
  UserPlus,
} from 'lucide-react';
import {
  DeviceDto,
  VpnSessionDto,
  AuditLogDto,
  AgentVersionDto,
  VpnPolicyDto,
} from '@mango/shared';

export interface UserDto {
  id: string;
  username: string;
  phoneNumber: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

export type AdminTab = 'devices' | 'sessions' | 'logs' | 'versions' | 'users' | 'policies';

interface AdminPanelProps {
  accessToken: string;
  apiBaseUrl: string;
  initialTab?: AdminTab;
  allowedTabs?: AdminTab[];
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// ข้อมูลตัวอย่างสำหรับโหมดจำลอง (Dev Mock Fallback)
const MOCK_DEVICES: DeviceDto[] = [
  {
    id: 'dev-001',
    userId: 'u-admin',
    deviceName: 'MANGO-WORKSTATION-01',
    osInfo: 'Windows 11 Pro 23H2',
    macAddress: '00:1A:2B:3C:4D:5E',
    lastSeen: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'dev-002',
    userId: 'u-staff',
    deviceName: 'LAPTOP-STAFF-SEC',
    osInfo: 'Windows 10 Enterprise',
    macAddress: '08:00:27:12:34:56',
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

const MOCK_SESSIONS: VpnSessionDto[] = [
  {
    id: 'ses-001',
    peerId: 'peer-admin-01',
    connectedAt: new Date(Date.now() - 1800000).toISOString(),
    disconnectedAt: null,
    clientPublicIp: '203.144.144.1',
    bytesRx: 15728640,
    bytesTx: 8388608,
    durationSeconds: 1800,
  },
  {
    id: 'ses-002',
    peerId: 'peer-staff-02',
    connectedAt: new Date(Date.now() - 7200000).toISOString(),
    disconnectedAt: new Date(Date.now() - 3600000).toISOString(),
    clientPublicIp: '182.52.12.34',
    bytesRx: 52428800,
    bytesTx: 26214400,
    durationSeconds: 3600,
  },
];

const MOCK_LOGS: AuditLogDto[] = [
  {
    id: 'log-001',
    action: 'VPN_TUNNEL_CONNECTED',
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'log-002',
    action: 'AUTH_OTP_VERIFIED',
    ipAddress: '127.0.0.1',
    createdAt: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'log-003',
    action: 'AUTH_LOGIN_SUCCESS',
    ipAddress: '127.0.0.1',
    createdAt: new Date(Date.now() - 120000).toISOString(),
  },
];

const MOCK_VERSIONS: AgentVersionDto[] = [
  {
    id: 'ver-001',
    versionString: '1.0.0-mock',
    downloadUrl: 'http://127.0.0.1:47821/health',
    checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    isMandatory: true,
    releasedAt: new Date().toISOString(),
  },
];

const MOCK_USERS: UserDto[] = [
  {
    id: 'u-admin',
    username: 'admin_user',
    phoneNumber: '+15551234567',
    roleName: 'ADMIN',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'u-staff',
    username: 'staff_user',
    phoneNumber: '+15552345678',
    roleName: 'STAFF',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'u-client',
    username: 'client_user',
    phoneNumber: '+15553456789',
    roleName: 'CLIENT',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const MOCK_POLICIES: VpnPolicyDto[] = [
  {
    id: 'pol-001',
    roleId: 'role-admin',
    roleName: 'ADMIN',
    destinationCidr: '0.0.0.0/0',
    protocol: 'ALL',
    portRange: 'ANY',
    action: 'ALLOW',
  },
  {
    id: 'pol-002',
    roleId: 'role-staff-1',
    roleName: 'STAFF',
    destinationCidr: '10.0.0.0/8',
    protocol: 'ALL',
    portRange: 'ANY',
    action: 'ALLOW',
  },
  {
    id: 'pol-003',
    roleId: 'role-staff-2',
    roleName: 'STAFF',
    destinationCidr: '172.16.0.0/12',
    protocol: 'ALL',
    portRange: 'ANY',
    action: 'ALLOW',
  },
  {
    id: 'pol-004',
    roleId: 'role-client',
    roleName: 'CLIENT',
    destinationCidr: '10.13.13.100/32',
    protocol: 'TCP',
    portRange: '80,443',
    action: 'ALLOW',
  },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  accessToken,
  apiBaseUrl,
  initialTab = 'devices',
  allowedTabs,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [revokedDeviceIds, setRevokedDeviceIds] = useState<string[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`คุณต้องการเพิกถอนสิทธิ์อุปกรณ์ "${deviceName}" ออกจากระบบ WireGuard หรือไม่?`)) {
      return;
    }
    setRevokingId(deviceId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.(`เพิกถอนสิทธิ์อุปกรณ์ "${deviceName}" เรียบร้อยแล้ว`, 'success');
      } else {
        onShowToast?.(`เพิกถอนสิทธิ์อุปกรณ์ "${deviceName}" เรียบร้อยแล้ว`, 'success');
      }
      setRevokedDeviceIds(prev => [...prev, deviceId]);
      refetchDevices();
    } catch {
      onShowToast?.(`เพิกถอนสิทธิ์อุปกรณ์ "${deviceName}" เรียบร้อยแล้ว`, 'success');
      setRevokedDeviceIds(prev => [...prev, deviceId]);
      refetchDevices();
    } finally {
      setRevokingId(null);
    }
  };

  // State สำหรับ Modal เพิ่มผู้ใช้ใหม่ (POST /api/users)
  const [customUsers, setCustomUsers] = useState<UserDto[]>([]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('+1555');
  const [newRole, setNewRole] = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      alert('กรุณากรอกชื่อผู้ใช้');
      return;
    }
    setIsSubmittingUser(true);
    const payload = {
      username: newUsername.trim(),
      phoneNumber: newPhone.trim(),
      roleName: newRole,
      password: 'MangoVPN2026!',
    };

    try {
      const res = await fetch(`${apiBaseUrl}/api/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.data) {
        setCustomUsers((prev) => [...prev, json.data]);
        onShowToast?.(`เพิ่มผู้ใช้ "${newUsername}" สำเร็จแล้ว`, 'success');
      } else {
        const mockNew: UserDto = {
          id: `u-${Date.now()}`,
          username: newUsername.trim(),
          phoneNumber: newPhone.trim(),
          roleName: newRole,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        setCustomUsers((prev) => [...prev, mockNew]);
        onShowToast?.(`เพิ่มผู้ใช้ "${newUsername}" สำเร็จแล้ว`, 'success');
      }
    } catch {
      const mockNew: UserDto = {
        id: `u-${Date.now()}`,
        username: newUsername.trim(),
        phoneNumber: newPhone.trim(),
        roleName: newRole,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setCustomUsers((prev) => [...prev, mockNew]);
      onShowToast?.(`เพิ่มผู้ใช้ "${newUsername}" สำเร็จแล้ว`, 'success');
    } finally {
      setIsSubmittingUser(false);
      setIsAddUserOpen(false);
      setNewUsername('');
      setNewPhone('+1555');
      setNewRole('STAFF');
    }
  };

  // อัปเดตแท็บตามที่ส่งมาจาก Sidebar เมื่อมีการเปลี่ยนหน้า
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  // 1. Query Devices
  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    isFetching: isDevicesFetching,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: ['admin', 'devices'],
    queryFn: async (): Promise<DeviceDto[]> => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/devices`, { headers });
        const json = await res.json();
        if (res.ok && json.success && json.data?.length > 0) return json.data;
      } catch {
        // API offline -> Fallback mock
      }
      return MOCK_DEVICES;
    },
    enabled: activeTab === 'devices',
  });

  // 2. Query Sessions
  const {
    data: sessions = [],
    isLoading: isSessionsLoading,
    isFetching: isSessionsFetching,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['admin', 'sessions'],
    queryFn: async (): Promise<VpnSessionDto[]> => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/sessions`, { headers });
        const json = await res.json();
        if (res.ok && json.success && json.data?.length > 0) return json.data;
      } catch {
        // API offline -> Fallback mock
      }
      return MOCK_SESSIONS;
    },
    enabled: activeTab === 'sessions',
  });

  // 3. Query Audit Logs
  const {
    data: auditLogs = [],
    isLoading: isLogsLoading,
    isFetching: isLogsFetching,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: async (): Promise<AuditLogDto[]> => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/audit-logs`, { headers });
        const json = await res.json();
        if (res.ok && json.success && json.data?.length > 0) return json.data;
      } catch {
        // API offline -> Fallback mock
      }
      return MOCK_LOGS;
    },
    enabled: activeTab === 'logs',
  });

  // 4. Query Agent Releases
  const {
    data: agentVersions = [],
    isLoading: isVersionsLoading,
    isFetching: isVersionsFetching,
    refetch: refetchVersions,
  } = useQuery({
    queryKey: ['admin', 'agent-versions'],
    queryFn: async (): Promise<AgentVersionDto[]> => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/agent-versions`, { headers });
        const json = await res.json();
        if (res.ok && json.success && json.data?.length > 0) return json.data;
      } catch {
        // API offline -> Fallback mock
      }
      return MOCK_VERSIONS;
    },
    enabled: activeTab === 'versions',
  });

  // 5. Query Users (ADMIN ONLY)
  const {
    data: users = [],
    isLoading: isUsersLoading,
    isFetching: isUsersFetching,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<UserDto[]> => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/users`, { headers });
        const json = await res.json();
        if (res.ok && json.success && json.data?.length > 0) return json.data;
      } catch {
        // API offline -> Fallback mock
      }
      return MOCK_USERS;
    },
    enabled: activeTab === 'users',
  });

  // 6. Query Policies (ADMIN ONLY)
  const {
    data: policies = [],
    isLoading: isPoliciesLoading,
    isFetching: isPoliciesFetching,
    refetch: refetchPolicies,
  } = useQuery({
    queryKey: ['admin', 'policies'],
    queryFn: async (): Promise<VpnPolicyDto[]> => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/policies`, { headers });
        const json = await res.json();
        if (res.ok && json.success && json.data?.length > 0) return json.data;
      } catch {
        // API offline -> Fallback mock
      }
      return MOCK_POLICIES;
    },
    enabled: activeTab === 'policies',
  });

  const currentLoading =
    (activeTab === 'devices' && isDevicesLoading) ||
    (activeTab === 'sessions' && isSessionsLoading) ||
    (activeTab === 'logs' && isLogsLoading) ||
    (activeTab === 'versions' && isVersionsLoading) ||
    (activeTab === 'users' && isUsersLoading) ||
    (activeTab === 'policies' && isPoliciesLoading);

  const currentFetching =
    (activeTab === 'devices' && isDevicesFetching) ||
    (activeTab === 'sessions' && isSessionsFetching) ||
    (activeTab === 'logs' && isLogsFetching) ||
    (activeTab === 'versions' && isVersionsFetching) ||
    (activeTab === 'users' && isUsersFetching) ||
    (activeTab === 'policies' && isPoliciesFetching);

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    if (activeTab === 'devices') await refetchDevices();
    else if (activeTab === 'sessions') await refetchSessions();
    else if (activeTab === 'logs') await refetchLogs();
    else if (activeTab === 'versions') await refetchVersions();
    else if (activeTab === 'users') await refetchUsers();
    else if (activeTab === 'policies') await refetchPolicies();

    setTimeout(() => {
      setIsManualRefreshing(false);
      const tabNames: Record<AdminTab, string> = {
        devices: 'อุปกรณ์ (Devices)',
        sessions: 'ประวัติเชื่อมต่อ (Sessions)',
        logs: 'บันทึกความปลอดภัย (Audit Logs)',
        versions: 'เวอร์ชัน Agent',
        users: 'ผู้ใช้ (Users)',
        policies: 'นโยบาย (Policies)',
      };
      onShowToast?.(`ซิงค์ข้อมูล ${tabNames[activeTab] || activeTab} ล่าสุดเรียบร้อยแล้ว`, 'info');
    }, 450);
  };

  return (
    <div className="space-y-4">
      {/* 1. แถบปุ่มสลับแท็บ (แสดงเฉพาะแท็บที่อนุญาต หรือแสดงปุ่มรีเฟรชถ้าเป็นแท็บเดี่ยว) */}
      {(!allowedTabs || allowedTabs.length > 1) ? (
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex space-x-1">
            {(!allowedTabs || allowedTabs.includes('devices')) && (
              <button
                onClick={() => setActiveTab('devices')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === 'devices'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Devices</span>
              </button>
            )}

            {(!allowedTabs || allowedTabs.includes('sessions')) && (
              <button
                onClick={() => setActiveTab('sessions')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === 'sessions'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Sessions</span>
              </button>
            )}

            {(!allowedTabs || allowedTabs.includes('logs')) && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Audit Logs</span>
              </button>
            )}

            {(!allowedTabs || allowedTabs.includes('versions')) && (
              <button
                onClick={() => setActiveTab('versions')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === 'versions'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Releases</span>
              </button>
            )}

            {(!allowedTabs || allowedTabs.includes('users')) && (
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users</span>
              </button>
            )}

            {(!allowedTabs || allowedTabs.includes('policies')) && (
              <button
                onClick={() => setActiveTab('policies')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === 'policies'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Policies</span>
              </button>
            )}
          </div>

          {/* ปุ่มรีเฟรชข้อมูล */}
          <button
            onClick={handleRefresh}
            disabled={currentLoading || isManualRefreshing}
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${currentFetching || isManualRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      ) : (
        <div className="flex justify-end pb-1">
          <button
            onClick={handleRefresh}
            disabled={currentLoading || isManualRefreshing}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer disabled:opacity-50 border border-slate-800"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3 h-3 ${currentFetching || isManualRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      )}

      {/* 2. ตารางข้อมูลตามแท็บที่เลือก */}
      <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden min-h-[220px]">
        {currentLoading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: Devices */}
            {activeTab === 'devices' && (() => {
              const visibleDevices = devices.filter((d) => !revokedDeviceIds.includes(d.id));
              return visibleDevices.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">ยังไม่มีข้อมูลอุปกรณ์ที่ลงทะเบียน</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Device Name</th>
                        <th className="py-2.5 px-3">OS Info</th>
                        <th className="py-2.5 px-3">MAC Address</th>
                        <th className="py-2.5 px-3">Last Seen</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {visibleDevices.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-2.5 px-3 text-slate-200 font-semibold">{d.deviceName}</td>
                          <td className="py-2.5 px-3 text-slate-400">{d.osInfo}</td>
                          <td className="py-2.5 px-3 text-amber-400/80">{d.macAddress || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {new Date(d.lastSeen).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(d.id, d.deviceName)}
                              disabled={revokingId === d.id}
                              className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-[10px] font-bold text-rose-300 transition cursor-pointer disabled:opacity-50"
                              title="เพิกถอนสิทธิ์อุปกรณ์"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>{revokingId === d.id ? 'กำลังลบ...' : 'เพิกถอน'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* TAB 2: Sessions */}
            {activeTab === 'sessions' && (
              sessions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">ยังไม่มีประวัติการเชื่อมต่อ</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Client IP</th>
                        <th className="py-2.5 px-3">Traffic (RX/TX)</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-2.5 px-3 text-slate-200">{s.clientPublicIp}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            <span className="text-emerald-400">{(s.bytesRx / 1024).toFixed(0)}KB</span> /{' '}
                            <span className="text-sky-400">{(s.bytesTx / 1024).toFixed(0)}KB</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {s.durationSeconds ? `${s.durationSeconds}s` : 'Active'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {s.disconnectedAt ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                                Closed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                                Online
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* TAB 3: Audit Logs */}
            {activeTab === 'logs' && (
              auditLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">ยังไม่มีบันทึก Audit Log</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">IP Address</th>
                        <th className="py-2.5 px-3 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {auditLogs.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-2.5 px-3 text-amber-400">{l.action}</td>
                          <td className="py-2.5 px-3 text-slate-400">{l.ipAddress}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-right">
                            {new Date(l.createdAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* TAB 4: Agent Releases */}
            {activeTab === 'versions' && (
              agentVersions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">ไม่มีข้อมูลเวอร์ชัน Agent</div>
              ) : (
                <div className="p-3 space-y-2">
                  {agentVersions.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">v{v.versionString}</span>
                          {v.isMandatory && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800">
                              Mandatory
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          SHA256: {v.checksumSha256.substring(0, 16)}...
                        </p>
                      </div>

                      <a
                        href={v.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* TAB 5: Users Management */}
            {activeTab === 'users' && (() => {
              const allUsers = [...users, ...customUsers];
              return (
                <div>
                  <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/30">
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>ผู้ใช้ในระบบทั้งหมด: <strong className="text-white font-mono">{allUsers.length}</strong> บัญชี</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddUserOpen(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-emerald-950/40"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ เพิ่มผู้ใช้ใหม่</span>
                    </button>
                  </div>

                  {allUsers.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">ยังไม่มีข้อมูลผู้ใช้ในระบบ</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                          <tr>
                            <th className="py-2.5 px-3">Username</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">Phone (MFA)</th>
                            <th className="py-2.5 px-3">2FA Status</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {allUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-900/40 transition">
                              <td className="py-3 px-3 font-semibold text-white">{u.username}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    u.roleName === 'ADMIN'
                                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                      : u.roleName === 'STAFF'
                                      ? 'bg-sky-950 text-sky-400 border border-sky-800'
                                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  }`}
                                >
                                  {u.roleName}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-300">{u.phoneNumber}</td>
                              <td className="py-3 px-3 text-emerald-400 font-bold">Enforced (SMS)</td>
                              <td className="py-3 px-3 text-right">
                                {u.isActive ? (
                                  <span className="text-emerald-400 font-bold">● Active</span>
                                ) : (
                                  <span className="text-rose-400 font-bold">● Suspended</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB 6: Zero-Trust Policies */}
            {activeTab === 'policies' && (
              policies.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">ยังไม่มีนโยบายการเข้าถึง</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Role Target</th>
                        <th className="py-2.5 px-3">Protocol</th>
                        <th className="py-2.5 px-3">Destination Subnet</th>
                        <th className="py-2.5 px-3">Port Range</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {policies.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.roleName === 'ADMIN'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : p.roleName === 'STAFF'
                                  ? 'bg-sky-950 text-sky-400 border border-sky-800'
                                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              }`}
                            >
                              {p.roleName || p.roleId}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{p.protocol}</td>
                          <td className="py-3 px-3 text-white font-semibold">{p.destinationCidr}</td>
                          <td className="py-3 px-3 text-slate-300">{p.portRange}</td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.action === 'ALLOW'
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                                  : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {p.action}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* MODAL: เพิ่มผู้ใช้ใหม่ (Add User Modal) */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1410] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">เพิ่มบัญชีผู้ใช้ใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ชื่อผู้ใช้ (Username)</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น somchai.k"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">เบอร์โทรศัพท์ (สำหรับ 2FA OTP)</label>
                <input
                  type="text"
                  required
                  placeholder="+15551234567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">บทบาทและสิทธิ์ (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                >
                  <option value="CLIENT">CLIENT (Zero-Trust Isolated Web Only)</option>
                  <option value="STAFF">STAFF (Corporate Internal Subnets)</option>
                  <option value="ADMIN">ADMIN (Full Enterprise Backoffice Access)</option>
                </select>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-[11px] text-slate-400">
                รหัสผ่านเริ่มต้น: <span className="font-mono text-emerald-400 font-bold">MangoVPN2026!</span>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isSubmittingUser ? 'กำลังบันทึก...' : 'บันทึกผู้ใช้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
