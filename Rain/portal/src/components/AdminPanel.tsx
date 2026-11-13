import React, { useState, useEffect } from 'react';
import {
  Laptop,
  History,
  Shield,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  DeviceDto,
  VpnSessionDto,
  AuditLogDto,
  AgentVersionDto,
} from '@mango/shared';

// =========================================================================
// 1. กำหนด Props Interface
// =========================================================================
interface AdminPanelProps {
  accessToken: string; // Token สำหรับส่งไปยืนยันสิทธิ์ใน Header
  apiBaseUrl: string;  // เช่น http://localhost:4000
}

type AdminTab = 'devices' | 'sessions' | 'logs' | 'versions';

// =========================================================================
// 2. Component AdminPanel: แผงควบคุมระบบหลังบ้านสำหรับ Role ADMIN
// =========================================================================
export const AdminPanel: React.FC<AdminPanelProps> = ({ accessToken, apiBaseUrl }) => {
  // แท็บที่กำลังเลือกอยู่ (เริ่มต้นที่ 'devices')
  const [activeTab, setActiveTab] = useState<AdminTab>('devices');

  // ข้อมูลจาก API แต่ละ Endpoint
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [sessions, setSessions] = useState<VpnSessionDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([]);
  const [agentVersions, setAgentVersions] = useState<AgentVersionDto[]>([]);

  // สถานะการโหลดและข้อผิดพลาด
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ฟังก์ชันดึงข้อมูลตามแท็บที่ผู้ใช้เปิดดู
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    try {
      if (activeTab === 'devices') {
        const res = await fetch(`${apiBaseUrl}/api/devices`, { headers });
        const json = await res.json();
        if (res.ok && json.success) setDevices(json.data || []);
      } else if (activeTab === 'sessions') {
        const res = await fetch(`${apiBaseUrl}/api/sessions`, { headers });
        const json = await res.json();
        if (res.ok && json.success) setSessions(json.data || []);
      } else if (activeTab === 'logs') {
        const res = await fetch(`${apiBaseUrl}/api/audit-logs`, { headers });
        const json = await res.json();
        if (res.ok && json.success) setAuditLogs(json.data || []);
      } else if (activeTab === 'versions') {
        const res = await fetch(`${apiBaseUrl}/api/agent-versions`, { headers });
        const json = await res.json();
        if (res.ok && json.success) setAgentVersions(json.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถดึงข้อมูลจาก API ได้');
    } finally {
      setLoading(false);
    }
  };

  // เรียก fetchData ทุกครั้งที่สลับแท็บ
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  return (
    <div className="space-y-4">
      {/* 1. แถบปุ่มสลับแท็บ (Tab Navigation) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex space-x-1">
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
        </div>

        {/* ปุ่มรีเฟรชข้อมูล */}
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50"
          title="รีเฟรชข้อมูล"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* 2. แสดง Error ถ้ามี */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. ตารางข้อมูลตามแท็บที่เลือก */}
      <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden min-h-[220px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: รายการอุปกรณ์ (Devices) */}
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

            {/* TAB 2: ประวัติ VPN Sessions */}
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

            {/* TAB 3: บันทึกความปลอดภัย (Audit Logs) */}
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

            {/* TAB 4: ข้อมูลเวอร์ชันโปรแกรม Agent (Releases) */}
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
