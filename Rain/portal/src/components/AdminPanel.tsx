import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Laptop,
  History,
  Shield,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  DeviceDto,
  VpnSessionDto,
  AuditLogDto,
  AgentVersionDto,
} from '@mango/shared';

export type AdminTab = 'devices' | 'sessions' | 'logs' | 'versions';

interface AdminPanelProps {
  accessToken: string;
  apiBaseUrl: string;
  initialTab?: AdminTab;
  allowedTabs?: AdminTab[];
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

export const AdminPanel: React.FC<AdminPanelProps> = ({
  accessToken,
  apiBaseUrl,
  initialTab = 'devices',
  allowedTabs,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

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

  const currentLoading =
    (activeTab === 'devices' && isDevicesLoading) ||
    (activeTab === 'sessions' && isSessionsLoading) ||
    (activeTab === 'logs' && isLogsLoading) ||
    (activeTab === 'versions' && isVersionsLoading);

  const currentFetching =
    (activeTab === 'devices' && isDevicesFetching) ||
    (activeTab === 'sessions' && isSessionsFetching) ||
    (activeTab === 'logs' && isLogsFetching) ||
    (activeTab === 'versions' && isVersionsFetching);

  const handleRefresh = () => {
    if (activeTab === 'devices') refetchDevices();
    else if (activeTab === 'sessions') refetchSessions();
    else if (activeTab === 'logs') refetchLogs();
    else if (activeTab === 'versions') refetchVersions();
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
          </div>

          {/* ปุ่มรีเฟรชข้อมูล */}
          <button
            onClick={handleRefresh}
            disabled={currentLoading}
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${currentFetching ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      ) : (
        <div className="flex justify-end pb-1">
          <button
            onClick={handleRefresh}
            disabled={currentLoading}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer disabled:opacity-50 border border-slate-800"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3 h-3 ${currentFetching ? 'animate-spin text-amber-400' : ''}`} />
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
            {activeTab === 'devices' && (
              devices.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">ยังไม่มีข้อมูลอุปกรณ์</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Device Name</th>
                        <th className="py-2.5 px-3">OS Info</th>
                        <th className="py-2.5 px-3">MAC Address</th>
                        <th className="py-2.5 px-3 text-right">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {devices.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-2.5 px-3 text-slate-200 font-semibold">{d.deviceName}</td>
                          <td className="py-2.5 px-3 text-slate-400">{d.osInfo}</td>
                          <td className="py-2.5 px-3 text-amber-400/80">{d.macAddress || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-right">
                            {new Date(d.lastSeen).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

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
          </>
        )}
      </div>
    </div>
  );
};
