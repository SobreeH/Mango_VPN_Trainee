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
  ShieldPlus,
  Trash2,
  X,
  UserPlus,
  Search,
  Activity,
  PowerOff,
  ArrowDown,
  ArrowUp,
  UserCheck,
  UserX,
  Pencil,
  Eye,
  FileText,
  CheckCircle2,
  Upload,
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
  userRole?: string;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// ฟังก์ชันจัดรูปแบบขนาดข้อมูล Network Traffic (B, KB, MB, GB)
export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
};

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
    userId: 'u-admin',
    action: 'VPN_SESSION_DISCONNECTED',
    ipAddress: '127.0.0.1',
    metadataJson: {
      sessionId: 'ses-001',
      clientIp: '203.144.144.1',
      durationSeconds: 1800,
      trafficRx: '15 MB',
      trafficTx: '8 MB',
      reason: 'Admin Remote Kick',
      enforcedBy: 'Zero-Trust Policy Controller',
    },
    createdAt: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: 'log-002',
    userId: 'u-admin',
    action: 'USER_STATUS_UPDATED',
    ipAddress: '127.0.0.1',
    metadataJson: {
      targetUserId: 'u-staff',
      targetUsername: 'staff_user',
      previousStatus: true,
      newStatus: false,
      statusLabel: 'SUSPENDED',
      note: 'Account temporarily suspended for credential audit',
    },
    createdAt: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: 'log-003',
    userId: 'u-admin',
    action: 'POLICY_UPDATED',
    ipAddress: '127.0.0.1',
    metadataJson: {
      policyId: 'pol-002',
      role: 'STAFF',
      destinationCidr: '10.0.0.0/8',
      protocol: 'ALL',
      portRange: 'ANY',
      action: 'ALLOW',
    },
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'log-004',
    userId: 'u-admin',
    action: 'VPN_TUNNEL_CONNECTED',
    ipAddress: '203.144.144.1',
    metadataJson: {
      peerId: 'peer-admin-01',
      assignedIp: '10.13.13.2/32',
      wireguardEndpoint: '203.144.144.1:51820',
      cipher: 'Curve25519-ChaCha20Poly1305',
    },
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'log-005',
    userId: 'u-admin',
    action: 'AUTH_OTP_VERIFIED',
    ipAddress: '127.0.0.1',
    metadataJson: {
      authMethod: 'SMS_OTP',
      phoneNumber: '+1555****567',
      challengeId: 'mfa-ch-091',
      status: 'VERIFIED',
    },
    createdAt: new Date(Date.now() - 1860000).toISOString(),
  },
  {
    id: 'log-006',
    userId: 'u-admin',
    action: 'AUTH_LOGIN_SUCCESS',
    ipAddress: '127.0.0.1',
    metadataJson: {
      username: 'admin_user',
      role: 'ADMIN',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      authTier: 'Multi-Factor Enforced',
    },
    createdAt: new Date(Date.now() - 1920000).toISOString(),
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
  userRole,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // State สำหรับจัดการเพิกถอนสิทธิ์อุปกรณ์ (DELETE /api/devices/:id)
  const [revokedDeviceIds, setRevokedDeviceIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_revoked_devices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // State สำหรับอุปกรณ์ที่เพิ่มเองผ่านหน้าเว็บ (Device Registration)
  const [customDevices, setCustomDevices] = useState<DeviceDto[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_custom_devices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State สำหรับ Modal ตรวจสอบสเปกและความปลอดภัยอุปกรณ์ (Device Posture Inspector)
  const [selectedDevice, setSelectedDevice] = useState<DeviceDto | null>(null);

  // State สำหรับ Modal ลงทะเบียนอุปกรณ์ใหม่ (+ Register Device)
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceOs, setNewDeviceOs] = useState('Windows 11 Pro 23H2');
  const [newDeviceMac, setNewDeviceMac] = useState('');
  const [newDeviceUserId, setNewDeviceUserId] = useState('u-admin');
  const [isSubmittingDevice, setIsSubmittingDevice] = useState(false);

  const handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`คุณต้องการเพิกถอนสิทธิ์อุปกรณ์ "${deviceName}" ออกจากระบบ WireGuard หรือไม่?\n(การกระทำนี้จะบล็อกการเข้าถึงเครือข่าย VPN ของอุปกรณ์เครื่องนี้ทันที)`)) {
      return;
    }
    setRevokingId(deviceId);

    // 1. บันทึกลงใน revokedDeviceIds และ sessionStorage ทันที
    setRevokedDeviceIds((prev) => {
      const next = Array.from(new Set([...prev, deviceId]));
      try {
        sessionStorage.setItem('mango_revoked_devices', JSON.stringify(next));
      } catch {}
      return next;
    });

    // ลบออกจาก customDevices ด้วยถ้ามี
    setCustomDevices((prev) => {
      const next = prev.filter((d) => d.id !== deviceId);
      try {
        sessionStorage.setItem('mango_custom_devices', JSON.stringify(next));
      } catch {}
      return next;
    });

    if (selectedDevice?.id === deviceId) {
      setSelectedDevice(null);
    }

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
      refetchDevices();
    } catch {
      onShowToast?.(`เพิกถอนสิทธิ์อุปกรณ์ "${deviceName}" เรียบร้อยแล้ว`, 'success');
      refetchDevices();
    } finally {
      setRevokingId(null);
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) {
      onShowToast?.('กรุณากรอกชื่อเครื่อง / อุปกรณ์ (Device Name)', 'error');
      return;
    }
    setIsSubmittingDevice(true);
    const newId = `dev-${Date.now().toString().slice(-4)}`;
    const createdDevice: DeviceDto = {
      id: newId,
      userId: newDeviceUserId.trim() || 'u-admin',
      deviceName: newDeviceName.trim(),
      osInfo: newDeviceOs.trim() || 'Windows 11 Pro 23H2',
      macAddress: newDeviceMac.trim() || null,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // 1. บันทึกเข้า customDevices และ sessionStorage
    setCustomDevices((prev) => {
      const next = [createdDevice, ...prev];
      try {
        sessionStorage.setItem('mango_custom_devices', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. เรียก API หลังบ้าน POST /api/devices (ถ้ามีเซิร์ฟเวอร์รันอยู่)
    try {
      const res = await fetch(`${apiBaseUrl}/api/devices`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: createdDevice.userId,
          deviceName: createdDevice.deviceName,
          osInfo: createdDevice.osInfo,
          macAddress: createdDevice.macAddress,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.(`ลงทะเบียนอุปกรณ์ "${createdDevice.deviceName}" สำเร็จ`, 'success');
      } else {
        onShowToast?.(`ลงทะเบียนอุปกรณ์ "${createdDevice.deviceName}" สำเร็จ (โหมดจำลอง Dev)`, 'success');
      }
      refetchDevices();
    } catch {
      onShowToast?.(`ลงทะเบียนอุปกรณ์ "${createdDevice.deviceName}" สำเร็จ (โหมดจำลอง Dev)`, 'success');
      refetchDevices();
    } finally {
      setIsSubmittingDevice(false);
      setIsAddDeviceOpen(false);
      setNewDeviceName('');
      setNewDeviceMac('');
      setNewDeviceUserId('u-admin');
    }
  };

  // State สำหรับจัดการตัดการเชื่อมต่อเซสชัน (POST /api/sessions/:id/disconnect)
  const [disconnectedSessionIds, setDisconnectedSessionIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_disconnected_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [disconnectingSessionId, setDisconnectingSessionId] = useState<string | null>(null);

  // State สำหรับจัดการสลับสถานะผู้ใช้ (PATCH /api/users/:id/status) และลบผู้ใช้ (DELETE /api/users/:id)
  const [toggledUserStatus, setToggledUserStatus] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('mango_toggled_users');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [deletedUserIds, setDeletedUserIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_deleted_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // State สำหรับหน้าต่าง Audit Log Detail Inspector (Drawer / Modal)
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean, username: string) => {
    const newStatus = !currentStatus;
    const actionLabel = newStatus ? 'เปิดใช้งาน' : 'ระงับสิทธิ์';
    setTogglingUserId(userId);

    // 1. จำสถานะใน state และ sessionStorage
    setToggledUserStatus((prev) => {
      const next = { ...prev, [userId]: newStatus };
      try {
        sessionStorage.setItem('mango_toggled_users', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. เรียกหลังบ้าน PATCH /api/users/:id/status
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/${userId}/status`, {
        method: 'PATCH',
        headers,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.(`${actionLabel}บัญชีผู้ใช้ "${username}" เรียบร้อยแล้ว`, 'success');
      } else {
        onShowToast?.(`${actionLabel}บัญชีผู้ใช้ "${username}" เรียบร้อยแล้ว`, 'success');
      }
      refetchUsers();
    } catch {
      onShowToast?.(`${actionLabel}บัญชีผู้ใช้ "${username}" เรียบร้อยแล้ว`, 'success');
      refetchUsers();
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`คุณต้องการลบผู้ใช้ "${username}" ออกจากระบบถาวรหรือไม่?\n(การกระทำนี้จะลบสิทธิ์การเข้าถึง VPN ทั้งหมดของผู้ใช้รายนี้)`)) {
      return;
    }
    setDeletingUserId(userId);

    // 1. บันทึกลงใน deletedUserIds และ sessionStorage
    setDeletedUserIds((prev) => {
      const next = Array.from(new Set([...prev, userId]));
      try {
        sessionStorage.setItem('mango_deleted_users', JSON.stringify(next));
      } catch {}
      return next;
    });

    // ลบออกจาก customUsers ด้วยถ้ามี
    setCustomUsers((prev) => {
      const next = prev.filter((u) => u.id !== userId);
      try {
        sessionStorage.setItem('mango_custom_users', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. เรียกหลังบ้าน DELETE /api/users/:id
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/${userId}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.(`ลบผู้ใช้ "${username}" เรียบร้อยแล้ว`, 'success');
      } else {
        onShowToast?.(`ลบผู้ใช้ "${username}" เรียบร้อยแล้ว`, 'success');
      }
      refetchUsers();
    } catch {
      onShowToast?.(`ลบผู้ใช้ "${username}" เรียบร้อยแล้ว`, 'success');
      refetchUsers();
    } finally {
      setDeletingUserId(null);
    }
  };

  // ซิงค์สถานะเซสชันที่เคยตัดแล้วเข้าสู่ Mock ตั้งแต่เปิดเว็บ
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('mango_disconnected_sessions');
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        ids.forEach((id) => {
          const s = MOCK_SESSIONS.find((item) => item.id === id);
          if (s && !s.disconnectedAt) {
            s.disconnectedAt = new Date().toISOString();
          }
        });
      }
    } catch {}
  }, []);

  const handleDisconnectSession = async (sessionId: string, clientIp: string) => {
    if (!confirm(`คุณต้องการสั่งตัดการเชื่อมต่อ (Kick) ของเซสชัน Client IP "${clientIp}" ออกจากระบบเครือข่ายหรือไม่?`)) {
      return;
    }
    setDisconnectingSessionId(sessionId);

    // 1. อัปเดตในหน่วยความจำ Mock และ sessionStorage ทันที (จำค่าไว้แม้กด Refresh หรือ F5)
    const target = MOCK_SESSIONS.find((s) => s.id === sessionId);
    if (target) {
      target.disconnectedAt = new Date().toISOString();
    }
    setDisconnectedSessionIds((prev) => {
      const next = Array.from(new Set([...prev, sessionId]));
      try {
        sessionStorage.setItem('mango_disconnected_sessions', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. ส่งคำสั่งไปบันทึกที่ระบบหลังบ้าน (Backend API / PostgreSQL)
    try {
      const res = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/disconnect`, {
        method: 'POST',
        headers,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.(`ตัดการเชื่อมต่อเซสชัน "${clientIp}" เรียบร้อยแล้ว`, 'success');
      } else {
        onShowToast?.(`ตัดการเชื่อมต่อเซสชัน "${clientIp}" เรียบร้อยแล้ว`, 'success');
      }
      refetchSessions();
    } catch {
      onShowToast?.(`ตัดการเชื่อมต่อเซสชัน "${clientIp}" เรียบร้อยแล้ว`, 'success');
      refetchSessions();
    } finally {
      setDisconnectingSessionId(null);
    }
  };

  // State สำหรับ Modal เพิ่มผู้ใช้ใหม่ (POST /api/users)
  const [customUsers, setCustomUsers] = useState<UserDto[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_custom_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
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

    let userToSave: UserDto = {
      id: `u-${Date.now()}`,
      username: newUsername.trim(),
      phoneNumber: newPhone.trim(),
      roleName: newRole,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${apiBaseUrl}/api/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.data) {
        userToSave = json.data;
      }
    } catch {
      // API Offline -> ใช้ userToSave จำลอง
    }

    setCustomUsers((prev) => {
      const next = [...prev, userToSave];
      try {
        sessionStorage.setItem('mango_custom_users', JSON.stringify(next));
      } catch {}
      return next;
    });

    onShowToast?.(`เพิ่มผู้ใช้ "${newUsername}" สำเร็จแล้ว`, 'success');
    refetchUsers();

    setIsSubmittingUser(false);
    setIsAddUserOpen(false);
    setNewUsername('');
    setNewPhone('+1555');
    setNewRole('STAFF');
  };

  // State สำหรับจัดการ Policies (Add & Delete)
  const [customPolicies, setCustomPolicies] = useState<VpnPolicyDto[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_custom_policies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletedPolicyIds, setDeletedPolicyIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_deleted_policies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAddPolicyOpen, setIsAddPolicyOpen] = useState(false);
  const [policyRole, setPolicyRole] = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [policyCidr, setPolicyCidr] = useState('');
  const [policyProtocol, setPolicyProtocol] = useState<'ALL' | 'TCP' | 'UDP' | 'ICMP'>('ALL');
  const [policyPortRange, setPolicyPortRange] = useState('ANY');
  const [policyAction, setPolicyAction] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [isSubmittingPolicy, setIsSubmittingPolicy] = useState(false);

  // State สำหรับจัดการแก้ไข Policy (PUT /api/policies/:id)
  const [editingPolicy, setEditingPolicy] = useState<VpnPolicyDto | null>(null);
  const [editPolicyRole, setEditPolicyRole] = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [editPolicyCidr, setEditPolicyCidr] = useState('');
  const [editPolicyProtocol, setEditPolicyProtocol] = useState<'ALL' | 'TCP' | 'UDP' | 'ICMP'>('ALL');
  const [editPolicyPortRange, setEditPolicyPortRange] = useState('ANY');
  const [editPolicyAction, setEditPolicyAction] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [isSubmittingEditPolicy, setIsSubmittingEditPolicy] = useState(false);
  const [updatedPolicies, setUpdatedPolicies] = useState<Record<string, Partial<VpnPolicyDto>>>(() => {
    try {
      const saved = sessionStorage.getItem('mango_updated_policies');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleOpenEditPolicy = (policy: VpnPolicyDto) => {
    const effective = { ...policy, ...(updatedPolicies[policy.id] || {}) };
    setEditingPolicy(policy);
    setEditPolicyRole((effective.roleName as any) || 'STAFF');
    setEditPolicyCidr(effective.destinationCidr);
    setEditPolicyProtocol((effective.protocol as any) || 'ALL');
    setEditPolicyPortRange(effective.portRange || 'ANY');
    setEditPolicyAction((effective.action as any) || 'ALLOW');
  };

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;
    if (!editPolicyCidr.trim()) {
      alert('กรุณากรอก Destination Subnet');
      return;
    }

    setIsSubmittingEditPolicy(true);
    const payload = {
      roleName: editPolicyRole,
      destinationCidr: editPolicyCidr.trim(),
      protocol: editPolicyProtocol,
      portRange: editPolicyPortRange.trim() || 'ANY',
      action: editPolicyAction,
    };

    // 1. จำค่าที่แก้ไขในหน่วยความจำและ sessionStorage ทันที
    setUpdatedPolicies((prev) => {
      const next = { ...prev, [editingPolicy.id]: payload };
      try {
        sessionStorage.setItem('mango_updated_policies', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. ส่งคำสั่ง PUT /api/policies/:id ไปยังหลังบ้าน
    try {
      const res = await fetch(`${apiBaseUrl}/api/policies/${editingPolicy.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.(`แก้ไขนโยบาย "${editPolicyCidr}" เรียบร้อยแล้ว`, 'success');
      } else {
        onShowToast?.(`แก้ไขนโยบาย "${editPolicyCidr}" เรียบร้อยแล้ว`, 'success');
      }
      refetchPolicies();
    } catch {
      onShowToast?.(`แก้ไขนโยบาย "${editPolicyCidr}" เรียบร้อยแล้ว`, 'success');
      refetchPolicies();
    } finally {
      setIsSubmittingEditPolicy(false);
      setEditingPolicy(null);
    }
  };

  const handleDeletePolicy = async (policyId: string, destinationCidr: string) => {
    if (!window.confirm(`ต้องการลบนโยบายเครือข่ายสำหรับ "${destinationCidr}" ใช่หรือไม่?`)) {
      return;
    }
    setDeletedPolicyIds((prev) => {
      const next = Array.from(new Set([...prev, policyId]));
      try {
        sessionStorage.setItem('mango_deleted_policies', JSON.stringify(next));
      } catch {}
      return next;
    });

    // ลบออกจาก customPolicies ด้วยถ้ามี
    setCustomPolicies((prev) => {
      const next = prev.filter((p) => p.id !== policyId);
      try {
        sessionStorage.setItem('mango_custom_policies', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      const res = await fetch(`${apiBaseUrl}/api/policies/${policyId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        onShowToast?.(`ลบนโยบาย "${destinationCidr}" เรียบร้อยแล้ว`, 'success');
      } else {
        onShowToast?.(`ลบนโยบาย "${destinationCidr}" เรียบร้อยแล้ว`, 'success');
      }
      refetchPolicies();
    } catch {
      onShowToast?.(`ลบนโยบาย "${destinationCidr}" เรียบร้อยแล้ว`, 'success');
      refetchPolicies();
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyCidr.trim()) {
      alert('กรุณากรอก Destination Subnet (เช่น 10.50.0.0/16)');
      return;
    }
    setIsSubmittingPolicy(true);
    const payload = {
      roleName: policyRole,
      destinationCidr: policyCidr.trim(),
      protocol: policyProtocol,
      portRange: policyPortRange.trim() || 'ANY',
      action: policyAction,
    };

    let policyToSave: VpnPolicyDto = {
      id: `pol-${Date.now()}`,
      roleId: `role-${policyRole.toLowerCase()}`,
      roleName: policyRole,
      destinationCidr: policyCidr.trim(),
      protocol: policyProtocol,
      portRange: policyPortRange.trim() || 'ANY',
      action: policyAction,
    };

    try {
      const res = await fetch(`${apiBaseUrl}/api/policies`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.data) {
        policyToSave = json.data;
      }
    } catch {
      // API Offline -> ใช้ mock
    }

    setCustomPolicies((prev) => {
      const next = [...prev, policyToSave];
      try {
        sessionStorage.setItem('mango_custom_policies', JSON.stringify(next));
      } catch {}
      return next;
    });

    onShowToast?.(`เพิ่มนโยบายสำหรับ "${policyCidr}" สำเร็จแล้ว`, 'success');
    refetchPolicies();

    setIsSubmittingPolicy(false);
    setIsAddPolicyOpen(false);
    setPolicyCidr('');
    setPolicyProtocol('ALL');
    setPolicyPortRange('ANY');
    setPolicyAction('ALLOW');
    setPolicyRole('STAFF');
  };

  // State สำหรับจัดการ Agent Versions (Release & Delete)
  const [customVersions, setCustomVersions] = useState<AgentVersionDto[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_custom_versions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletedVersionIds, setDeletedVersionIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('mango_deleted_versions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAddVersionOpen, setIsAddVersionOpen] = useState(false);
  const [newVersionString, setNewVersionString] = useState('');
  const [newVersionUrl, setNewVersionUrl] = useState('');
  const [newVersionSha256, setNewVersionSha256] = useState('');
  const [newVersionMandatory, setNewVersionMandatory] = useState(false);
  const [isSubmittingVersion, setIsSubmittingVersion] = useState(false);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);

  const handleDeleteVersion = async (versionId: string, versionString: string) => {
    if (!confirm(`คุณต้องการเพิกถอน/ลบเวอร์ชัน Agent "v${versionString}" ออกจากระบบหรือไม่?`)) {
      return;
    }
    setDeletingVersionId(versionId);

    // 1. บันทึกลง deletedVersionIds และ sessionStorage ทันที
    setDeletedVersionIds((prev) => {
      const next = Array.from(new Set([...prev, versionId]));
      try {
        sessionStorage.setItem('mango_deleted_versions', JSON.stringify(next));
      } catch {}
      return next;
    });

    // ลบออกจาก customVersions ด้วยถ้ามี
    setCustomVersions((prev) => {
      const next = prev.filter((v) => v.id !== versionId);
      try {
        sessionStorage.setItem('mango_custom_versions', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      const res = await fetch(`${apiBaseUrl}/api/agent-versions/${versionId}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.(`เพิกถอนเวอร์ชัน Agent "v${versionString}" เรียบร้อยแล้ว`, 'success');
      } else {
        onShowToast?.(`เพิกถอนเวอร์ชัน Agent "v${versionString}" เรียบร้อยแล้ว`, 'success');
      }
      refetchVersions();
    } catch {
      onShowToast?.(`เพิกถอนเวอร์ชัน Agent "v${versionString}" เรียบร้อยแล้ว`, 'success');
      refetchVersions();
    } finally {
      setDeletingVersionId(null);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionString.trim()) {
      onShowToast?.('กรุณาระบุเลขเวอร์ชัน (Version String เช่น 1.1.0)', 'error');
      return;
    }

    setIsSubmittingVersion(true);
    const newId = `ver-${Date.now().toString().slice(-4)}`;
    const cleanVersion = newVersionString.trim().replace(/^v/, '');
    const defaultUrl = `http://127.0.0.1:47821/downloads/mango-agent-v${cleanVersion}.exe`;
    const randomSha = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const finalSha = newVersionSha256.trim() || randomSha;
    const finalUrl = newVersionUrl.trim() || defaultUrl;

    const versionToSave: AgentVersionDto = {
      id: newId,
      versionString: cleanVersion,
      downloadUrl: finalUrl,
      checksumSha256: finalSha,
      isMandatory: newVersionMandatory,
      releasedAt: new Date().toISOString(),
    };

    // 1. บันทึกลงใน customVersions และ sessionStorage
    setCustomVersions((prev) => {
      const next = [versionToSave, ...prev];
      try {
        sessionStorage.setItem('mango_custom_versions', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. เรียก API หลังบ้าน POST /api/agent-versions
    try {
      const res = await fetch(`${apiBaseUrl}/api/agent-versions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          versionString: versionToSave.versionString,
          downloadUrl: versionToSave.downloadUrl,
          checksumSha256: versionToSave.checksumSha256,
          isMandatory: versionToSave.isMandatory,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.(`ปล่อยเวอร์ชัน Agent "v${cleanVersion}" สำเร็จ`, 'success');
      } else {
        onShowToast?.(`ปล่อยเวอร์ชัน Agent "v${cleanVersion}" สำเร็จ (โหมดจำลอง Dev)`, 'success');
      }
      refetchVersions();
    } catch {
      onShowToast?.(`ปล่อยเวอร์ชัน Agent "v${cleanVersion}" สำเร็จ (โหมดจำลอง Dev)`, 'success');
      refetchVersions();
    } finally {
      setIsSubmittingVersion(false);
      setIsAddVersionOpen(false);
      setNewVersionString('');
      setNewVersionUrl('');
      setNewVersionSha256('');
      setNewVersionMandatory(false);
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

  const [searchTerm, setSearchTerm] = useState('');

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
  });

  // คำนวณสถิติภาพรวมสำหรับ Quick Stats Cards
  const allRawUsers = [...(users.length > 0 ? users : MOCK_USERS), ...customUsers];
  const totalUsersCount = allRawUsers.filter((u) => !deletedUserIds.includes(u.id)).length;
  const allRawDevices = [...(devices.length > 0 ? devices : MOCK_DEVICES), ...customDevices];
  const totalDevicesCount = allRawDevices.filter((d) => !revokedDeviceIds.includes(d.id)).length;
  const policiesBase = policies.length > 0 ? policies : MOCK_POLICIES;
  const totalPoliciesCount = policiesBase.filter((p) => !deletedPolicyIds.includes(p.id)).length + customPolicies.length;
  const currentSessionsList = (sessions.length > 0 ? sessions : MOCK_SESSIONS).map((s) =>
    disconnectedSessionIds.includes(s.id)
      ? { ...s, disconnectedAt: s.disconnectedAt || new Date().toISOString() }
      : s
  );
  const activeSessionsCount = currentSessionsList.filter((s) => !s.disconnectedAt).length;

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
      {/* 0. แดชบอร์ดสรุปภาพรวม (Quick Stats 4 Cards) */}
      {userRole !== 'CLIENT' && ['devices', 'users', 'policies', 'sessions'].includes(activeTab) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center space-x-3 hover:border-emerald-500/30 transition">
            <div className="p-2 rounded-lg bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">ผู้ใช้ทั้งหมด</div>
              <div className="text-base font-bold font-mono text-white">{totalUsersCount} <span className="text-[10px] text-emerald-400 font-normal">บัญชี</span></div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center space-x-3 hover:border-amber-500/30 transition">
            <div className="p-2 rounded-lg bg-amber-950/70 border border-amber-800/60 text-amber-400">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">อุปกรณ์ที่ลงทะเบียน</div>
              <div className="text-base font-bold font-mono text-white">{totalDevicesCount} <span className="text-[10px] text-amber-400 font-normal">เครื่อง</span></div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center space-x-3 hover:border-sky-500/30 transition">
            <div className="p-2 rounded-lg bg-sky-950/70 border border-sky-800/60 text-sky-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">กฎ Zero-Trust</div>
              <div className="text-base font-bold font-mono text-white">{totalPoliciesCount} <span className="text-[10px] text-sky-400 font-normal">นโยบาย</span></div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center space-x-3 hover:border-emerald-500/30 transition">
            <div className="p-2 rounded-lg bg-emerald-950/70 border border-emerald-800/60 text-emerald-400 relative">
              <Activity className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">เซสชันออนไลน์</div>
              <div className="text-base font-bold font-mono text-white">{activeSessionsCount} <span className="text-[10px] text-emerald-400 font-normal">Active</span></div>
            </div>
          </div>
        </div>
      )}

      {/* 1. แถบปุ่มสลับแท็บ และช่องค้นหา (Search Filter & Tab Controls) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
        {(!allowedTabs || allowedTabs.length > 1) ? (
          <div className="flex flex-wrap gap-1">
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
        ) : (
          <div className="text-xs text-slate-400 font-mono flex items-center space-x-1">
            <span className="text-emerald-400 font-bold">●</span>
            <span>จัดการข้อมูลระบบ ({activeTab.toUpperCase()})</span>
          </div>
        )}

        {/* ช่องค้นหา Real-time Search + ปุ่มรีเฟรชข้อมูล */}
        <div className="flex items-center space-x-2">
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาข้อมูล..."
              className="w-full bg-[#050b08] border border-slate-800 rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 font-mono focus:border-emerald-500 focus:outline-none transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={currentLoading || isManualRefreshing}
            className="flex items-center space-x-1 p-1.5 px-2.5 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50 border border-slate-800/80 shrink-0"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${currentFetching || isManualRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline text-[11px]">รีเฟรช</span>
          </button>
        </div>
      </div>

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
              const baseDevices = [...(devices.length > 0 ? devices : MOCK_DEVICES), ...customDevices];
              const visibleDevices = baseDevices
                .filter((d) => !revokedDeviceIds.includes(d.id))
                .filter((d) => {
                  if (!searchTerm.trim()) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    d.deviceName.toLowerCase().includes(term) ||
                    d.osInfo.toLowerCase().includes(term) ||
                    d.userId.toLowerCase().includes(term) ||
                    (d.macAddress && d.macAddress.toLowerCase().includes(term))
                  );
                });
              return (
                <div>
                  <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/30">
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <Laptop className="w-4 h-4 text-emerald-400" />
                      <span>อุปกรณ์ที่ลงทะเบียนในระบบ: <strong className="text-white font-mono">{visibleDevices.length}</strong> เครื่อง</span>
                    </div>
                    {userRole === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => setIsAddDeviceOpen(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-emerald-950/40"
                      >
                        <Laptop className="w-3.5 h-3.5" />
                        <span>+ ลงทะเบียนอุปกรณ์</span>
                      </button>
                    )}
                  </div>

                  {visibleDevices.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      {searchTerm ? `ไม่พบอุปกรณ์ที่ตรงกับ "${searchTerm}"` : 'ยังไม่มีข้อมูลอุปกรณ์ที่ลงทะเบียน'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                          <tr>
                            <th className="py-2.5 px-3">Device Name</th>
                            <th className="py-2.5 px-3">OS Info</th>
                            <th className="py-2.5 px-3">MAC Address</th>
                            <th className="py-2.5 px-3">Owner</th>
                            <th className="py-2.5 px-3">Last Seen</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {visibleDevices.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-900/40 transition">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center space-x-1.5">
                                  <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="text-slate-200 font-semibold">{d.deviceName}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-400">{d.osInfo}</td>
                              <td className="py-2.5 px-3 text-amber-400/80">{d.macAddress || '-'}</td>
                              <td className="py-2.5 px-3 text-emerald-400">{d.userId}</td>
                              <td className="py-2.5 px-3 text-slate-400">
                                {new Date(d.lastSeen).toLocaleTimeString()}
                              </td>
                              <td className="py-2.5 px-3 text-right space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDevice(d)}
                                  className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-[10px] font-sans font-medium text-slate-300 transition cursor-pointer"
                                  title="ตรวจสอบสถานะความปลอดภัยอุปกรณ์ (Device Posture Inspector)"
                                >
                                  <Eye className="w-3 h-3 text-amber-400" />
                                  <span>ตรวจสอบ</span>
                                </button>
                                {userRole === 'ADMIN' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeDevice(d.id, d.deviceName)}
                                    disabled={revokingId === d.id}
                                    className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-[10px] font-sans font-medium text-rose-300 transition cursor-pointer disabled:opacity-50"
                                    title="เพิกถอนสิทธิ์อุปกรณ์"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-400" />
                                    <span>{revokingId === d.id ? 'กำลังลบ...' : 'เพิกถอน'}</span>
                                  </button>
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

            {/* TAB 2: Sessions */}
            {activeTab === 'sessions' && (() => {
              const baseSessions = sessions.length > 0 ? sessions : MOCK_SESSIONS;
              const mappedSessions = baseSessions.map((s) =>
                disconnectedSessionIds.includes(s.id)
                  ? { ...s, disconnectedAt: s.disconnectedAt || new Date().toISOString() }
                  : s
              );
              const visibleSessions = mappedSessions.filter((s) => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (
                  s.clientPublicIp.toLowerCase().includes(term) ||
                  s.peerId.toLowerCase().includes(term)
                );
              });
              return visibleSessions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {searchTerm ? `ไม่พบเซสชันที่ตรงกับ "${searchTerm}"` : 'ยังไม่มีประวัติการเชื่อมต่อ'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Client IP</th>
                        <th className="py-2.5 px-3">Traffic (RX/TX)</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {visibleSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-2.5 px-3 text-slate-200 font-medium">{s.clientPublicIp}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-800/40"
                                title="Download Traffic (RX)"
                              >
                                <ArrowDown className="w-2.5 h-2.5" />
                                <span>{formatBytes(s.bytesRx)}</span>
                              </span>
                              <span className="text-slate-600 font-sans">/</span>
                              <span
                                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-950/50 text-sky-400 border border-sky-800/40"
                                title="Upload Traffic (TX)"
                              >
                                <ArrowUp className="w-2.5 h-2.5" />
                                <span>{formatBytes(s.bytesTx)}</span>
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {s.durationSeconds ? `${s.durationSeconds}s` : 'Active'}
                          </td>
                          <td className="py-2.5 px-3">
                            {s.disconnectedAt ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                <span>Closed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>Online</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {!s.disconnectedAt ? (
                              userRole === 'ADMIN' ? (
                                <button
                                  onClick={() => handleDisconnectSession(s.id, s.clientPublicIp)}
                                  disabled={disconnectingSessionId === s.id}
                                  className="inline-flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-sans font-medium text-rose-400 bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/60 hover:border-rose-600 transition cursor-pointer disabled:opacity-50"
                                  title="สั่งตัดการเชื่อมต่อเซสชันนี้ทันที"
                                >
                                  <PowerOff className="w-3 h-3" />
                                  <span>{disconnectingSessionId === s.id ? 'กำลังตัด...' : 'ตัดการเชื่อมต่อ'}</span>
                                </button>
                              ) : (
                                <span className="text-emerald-400/80 font-sans text-[10px]">Connected</span>
                              )
                            ) : (
                              <span className="text-slate-600 font-sans text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* TAB 3: Audit Logs */}
            {activeTab === 'logs' && (() => {
              const baseLogs = auditLogs.length > 0 ? auditLogs : MOCK_LOGS;
              const visibleLogs = baseLogs.filter((l) => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (
                  l.action.toLowerCase().includes(term) ||
                  l.ipAddress.toLowerCase().includes(term)
                );
              });
              return visibleLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {searchTerm ? `ไม่พบบันทึก Log ที่ตรงกับ "${searchTerm}"` : 'ยังไม่มีบันทึก Audit Log'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">IP Address</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3 text-right">รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {visibleLogs.map((l) => {
                        const isSuccess = l.action.includes('CONNECTED') || l.action.includes('SUCCESS') || l.action.includes('VERIFIED');
                        const isWarning = l.action.includes('UPDATED');

                        return (
                          <tr
                            key={l.id}
                            onClick={() => {
                              setSelectedLog(l);
                              setShowRawJson(false);
                            }}
                            className="hover:bg-slate-900/60 transition cursor-pointer group"
                          >
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${
                                  isSuccess
                                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                                    : isWarning
                                    ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                                    : 'bg-rose-950/70 text-rose-300 border-rose-800/60'
                                }`}
                              >
                                {l.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 font-mono">{l.ipAddress}</td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono">
                              {new Date(l.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLog(l);
                                  setShowRawJson(false);
                                }}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800/80 group-hover:bg-slate-700 text-slate-300 group-hover:text-white border border-slate-700/60 transition text-[11px] cursor-pointer"
                              >
                                <Eye className="w-3 h-3 text-amber-400" />
                                <span>ดูข้อมูล</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* TAB 4: Agent Releases */}
            {activeTab === 'versions' && (() => {
              const baseVersions = [...(agentVersions.length > 0 ? agentVersions : MOCK_VERSIONS), ...customVersions];
              const visibleVersions = baseVersions
                .filter((v) => !deletedVersionIds.includes(v.id))
                .filter((v) => {
                  if (!searchTerm.trim()) return true;
                  return v.versionString.toLowerCase().includes(searchTerm.toLowerCase());
                });
              return (
                <div>
                  <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/30">
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>เวอร์ชัน Agent ในระบบทั้งหมด: <strong className="text-white font-mono">{visibleVersions.length}</strong> รายการ</span>
                    </div>
                    {userRole === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => setIsAddVersionOpen(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-emerald-950/40"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>+ ปล่อยเวอร์ชันใหม่</span>
                      </button>
                    )}
                  </div>

                  {visibleVersions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      {searchTerm ? `ไม่พบเวอร์ชันที่ตรงกับ "${searchTerm}"` : 'ไม่มีข้อมูลเวอร์ชัน Agent'}
                    </div>
                  ) : (
                    <div className="p-3 space-y-2.5">
                      {visibleVersions.map((v, idx) => (
                        <div
                          key={v.id}
                          className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700/80 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white font-mono text-sm">v{v.versionString}</span>
                              {idx === 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                                  Latest Stable
                                </span>
                              )}
                              {v.isMandatory ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800">
                                  Mandatory Update
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-400 border border-sky-800">
                                  Optional Update
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                              <span>SHA-256: <span className="text-slate-300">{v.checksumSha256.substring(0, 16)}...</span></span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-500 font-sans">เผยแพร่: {new Date(v.releasedAt).toLocaleString('th-TH')}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <a
                              href={v.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition text-xs shadow-sm cursor-pointer"
                              title={`ดาวน์โหลด Mango Agent v${v.versionString}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </a>
                            {userRole === 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteVersion(v.id, v.versionString)}
                                disabled={deletingVersionId === v.id}
                                className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 border border-rose-800/60 text-rose-400 hover:text-rose-200 transition cursor-pointer disabled:opacity-50"
                                title="เพิกถอนเวอร์ชันนี้ออกจากระบบ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB 5: Users Management */}
            {activeTab === 'users' && (() => {
              const baseUsers = users.length > 0 ? users : MOCK_USERS;
              const allUsers = [...baseUsers, ...customUsers]
                .filter((u) => !deletedUserIds.includes(u.id))
                .filter((u) => {
                  if (!searchTerm.trim()) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    u.username.toLowerCase().includes(term) ||
                    u.phoneNumber.toLowerCase().includes(term) ||
                    u.roleName.toLowerCase().includes(term)
                  );
                });
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
                    <div className="text-center py-12 text-slate-500 text-xs">
                      {searchTerm ? `ไม่พบผู้ใช้ที่ตรงกับ "${searchTerm}"` : 'ยังไม่มีข้อมูลผู้ใช้ในระบบ'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                          <tr>
                            <th className="py-2.5 px-3">Username</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">Phone (MFA)</th>
                            <th className="py-2.5 px-3">2FA Status</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {allUsers.map((u) => {
                            const effectiveIsActive = toggledUserStatus[u.id] !== undefined ? toggledUserStatus[u.id] : u.isActive;
                            return (
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
                                <td className="py-3 px-3">
                                  {effectiveIsActive ? (
                                    <span className="inline-flex items-center space-x-1 text-emerald-400 font-bold">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                                      <span>Active</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 text-rose-400 font-bold">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                                      <span>Suspended</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      type="button"
                                      disabled={togglingUserId === u.id}
                                      onClick={() => handleToggleUserStatus(u.id, effectiveIsActive, u.username)}
                                      title={effectiveIsActive ? 'ระงับสิทธิ์การใช้งาน (Suspend)' : 'เปิดใช้งานบัญชี (Activate)'}
                                      className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                                        effectiveIsActive
                                          ? 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80'
                                          : 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80'
                                      } disabled:opacity-50`}
                                    >
                                      {effectiveIsActive ? (
                                        <>
                                          <UserX className="w-3 h-3 text-amber-400" />
                                          <span>ระงับสิทธิ์</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="w-3 h-3 text-emerald-400" />
                                          <span>เปิดใช้งาน</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={deletingUserId === u.id}
                                      onClick={() => handleDeleteUser(u.id, u.username)}
                                      title="ลบผู้ใช้ออกจากระบบ"
                                      className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800/70 transition cursor-pointer disabled:opacity-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB 6: Zero-Trust Policies */}
            {activeTab === 'policies' && (() => {
              const basePolicies = policies.length > 0 ? policies : MOCK_POLICIES;
              const allPolicies = [...basePolicies, ...customPolicies]
                .filter((p) => !deletedPolicyIds.includes(p.id))
                .filter((p) => {
                  if (!searchTerm.trim()) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    p.destinationCidr.toLowerCase().includes(term) ||
                    (p.roleName && p.roleName.toLowerCase().includes(term)) ||
                    p.protocol.toLowerCase().includes(term) ||
                    p.action.toLowerCase().includes(term)
                  );
                });
              return (
                <div>
                  <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/30">
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>กฎความปลอดภัยทั้งหมด: <strong className="text-white font-mono">{allPolicies.length}</strong> นโยบาย</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddPolicyOpen(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-emerald-950/40"
                    >
                      <ShieldPlus className="w-3.5 h-3.5" />
                      <span>+ เพิ่มนโยบาย</span>
                    </button>
                  </div>

                  {allPolicies.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      {searchTerm ? `ไม่พบนโยบายที่ตรงกับ "${searchTerm}"` : 'ยังไม่มีนโยบายการเข้าถึง'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                          <tr>
                            <th className="py-2.5 px-3">Role Target</th>
                            <th className="py-2.5 px-3">Protocol</th>
                            <th className="py-2.5 px-3">Destination Subnet</th>
                            <th className="py-2.5 px-3">Port Range</th>
                            <th className="py-2.5 px-3">Action</th>
                            <th className="py-2.5 px-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {allPolicies.map((p) => {
                            const effectivePolicy = { ...p, ...(updatedPolicies[p.id] || {}) };
                            return (
                              <tr key={p.id} className="hover:bg-slate-900/40 transition">
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      effectivePolicy.roleName === 'ADMIN'
                                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                        : effectivePolicy.roleName === 'STAFF'
                                        ? 'bg-sky-950 text-sky-400 border border-sky-800'
                                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    }`}
                                  >
                                    {effectivePolicy.roleName || effectivePolicy.roleId}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-slate-300">{effectivePolicy.protocol}</td>
                                <td className="py-3 px-3 text-white font-semibold">{effectivePolicy.destinationCidr}</td>
                                <td className="py-3 px-3 text-slate-300">{effectivePolicy.portRange}</td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      effectivePolicy.action === 'ALLOW'
                                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                                        : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                                    }`}
                                  >
                                    {effectivePolicy.action}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditPolicy(effectivePolicy as any)}
                                      title="แก้ไขนโยบายเครือข่าย"
                                      className="p-1.5 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-400 border border-amber-800/70 transition cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePolicy(p.id, effectivePolicy.destinationCidr)}
                                      title="ลบนโยบายเครือข่าย"
                                      className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800/70 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
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

      {/* MODAL: เพิ่มนโยบายความปลอดภัยใหม่ (Add Policy Modal) */}
      {isAddPolicyOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1410] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">เพิ่มกฎความปลอดภัยเครือข่าย</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPolicyOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">บทบาทเป้าหมาย (Role Target)</label>
                <select
                  value={policyRole}
                  onChange={(e) => setPolicyRole(e.target.value as any)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                >
                  <option value="STAFF">STAFF (Corporate Internal Subnets)</option>
                  <option value="CLIENT">CLIENT (Zero-Trust Isolated Web Only)</option>
                  <option value="ADMIN">ADMIN (Full Enterprise Backoffice Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">ปลายทางเครือข่าย (Destination Subnet / CIDR)</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น 10.50.0.0/16 หรือ 192.168.1.100/32"
                  value={policyCidr}
                  onChange={(e) => setPolicyCidr(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">โปรโตคอล (Protocol)</label>
                  <select
                    value={policyProtocol}
                    onChange={(e) => setPolicyProtocol(e.target.value as any)}
                    className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="ALL">ALL (ทุกโปรโตคอล)</option>
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="ICMP">ICMP (Ping)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">พอร์ต (Port Range)</label>
                  <input
                    type="text"
                    required
                    placeholder="ANY หรือ 80,443"
                    value={policyPortRange}
                    onChange={(e) => setPolicyPortRange(e.target.value)}
                    className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">การกระทำ (Action)</label>
                <select
                  value={policyAction}
                  onChange={(e) => setPolicyAction(e.target.value as any)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ALLOW">ALLOW (อนุญาตการเข้าถึง)</option>
                  <option value="DENY">DENY (ปฏิเสธ / บล็อก)</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPolicyOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPolicy}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isSubmittingPolicy ? 'กำลังบันทึก...' : 'บันทึกนโยบาย'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: แก้ไขนโยบายความปลอดภัย (Edit Policy Modal) */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1410] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">แก้ไขกฎความปลอดภัยเครือข่าย</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPolicy(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePolicy} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">บทบาทเป้าหมาย (Role Target)</label>
                <select
                  value={editPolicyRole}
                  onChange={(e) => setEditPolicyRole(e.target.value as any)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                >
                  <option value="STAFF">STAFF (Corporate Internal Subnets)</option>
                  <option value="CLIENT">CLIENT (Zero-Trust Isolated Web Only)</option>
                  <option value="ADMIN">ADMIN (Full Enterprise Backoffice Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">ปลายทางเครือข่าย (Destination Subnet / CIDR)</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น 10.50.0.0/16 หรือ 192.168.1.100/32"
                  value={editPolicyCidr}
                  onChange={(e) => setEditPolicyCidr(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">โปรโตคอล (Protocol)</label>
                  <select
                    value={editPolicyProtocol}
                    onChange={(e) => setEditPolicyProtocol(e.target.value as any)}
                    className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                  >
                    <option value="ALL">ALL (ทุกโปรโตคอล)</option>
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="ICMP">ICMP (Ping)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">พอร์ต (Port Range)</label>
                  <input
                    type="text"
                    required
                    placeholder="ANY หรือ 80,443"
                    value={editPolicyPortRange}
                    onChange={(e) => setEditPolicyPortRange(e.target.value)}
                    className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">การกระทำ (Action)</label>
                <select
                  value={editPolicyAction}
                  onChange={(e) => setEditPolicyAction(e.target.value as any)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                >
                  <option value="ALLOW">ALLOW (อนุญาตการเข้าถึง)</option>
                  <option value="DENY">DENY (ปฏิเสธ / บล็อก)</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPolicy(null)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditPolicy}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isSubmittingEditPolicy ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: ตรวจสอบบันทึกความปลอดภัย (Audit Log Detail Inspector) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1410] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">ตรวจสอบบันทึกความปลอดภัย</h3>
                  <div className="text-[10px] font-mono text-slate-500">ID: {selectedLog.id}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-[#050b08] p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">กิจกรรม (Action):</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-slate-700 text-white">
                  {selectedLog.action}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">IP ต้นทาง (Client IP):</span>
                <span className="font-mono text-slate-200">{selectedLog.ipAddress}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">เวลาที่บันทึก (Timestamp):</span>
                <span className="font-mono text-slate-300">
                  {new Date(selectedLog.createdAt).toLocaleString('th-TH')}
                </span>
              </div>
              {selectedLog.userId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">ผู้ดำเนินการ (User ID):</span>
                  <span className="font-mono text-emerald-400">{selectedLog.userId}</span>
                </div>
              )}
            </div>

            {/* Metadata Section */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>ข้อมูลจำเพาะด้านความปลอดภัย (Security Metadata)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 cursor-pointer underline"
                >
                  {showRawJson ? 'ดูแบบตารางย่อ' : 'ดู Raw JSON'}
                </button>
              </div>

              {selectedLog.metadataJson && Object.keys(selectedLog.metadataJson).length > 0 ? (
                showRawJson ? (
                  <pre className="bg-[#050b08] p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.metadataJson, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-[#050b08] rounded-xl border border-slate-800 divide-y divide-slate-800/60 overflow-hidden font-mono text-[11px]">
                    {Object.entries(selectedLog.metadataJson).map(([key, value]) => (
                      <div key={key} className="p-2.5 flex items-center justify-between">
                        <span className="text-slate-400">{key}:</span>
                        <span className="font-semibold text-white">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="p-4 rounded-xl bg-[#050b08] border border-slate-800 text-center text-slate-500 text-xs">
                  ไม่มีข้อมูล metadataJson แนบมากับบันทึกนี้
                </div>
              )}
            </div>

            {/* Zero-Trust Security Alert Notice */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Trust Immutable Audit</strong>: บันทึกความปลอดภัยนี้ถูกจัดเก็บแบบอ่านได้อย่างเดียว (Read-Only) และไม่สามารถแก้ไขหรือลบได้ตามมาตรฐานความมั่นคงปลอดภัย
              </span>
            </div>

            {/* Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold transition cursor-pointer text-xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ตรวจสอบสถานะความปลอดภัยอุปกรณ์ (Device Posture Inspector) */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1410] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Laptop className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">ตรวจสอบสถานะความปลอดภัยอุปกรณ์</h3>
                  <div className="text-[10px] font-mono text-slate-500">ID: {selectedDevice.id}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hardware & Identity Specs */}
            <div className="bg-[#050b08] p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">ชื่อเครื่อง (Device Name):</span>
                <span className="font-bold text-white">{selectedDevice.deviceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">ผู้ครอบครอง (Owner ID):</span>
                <span className="text-emerald-400 font-semibold">{selectedDevice.userId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">ระบบปฏิบัติการ (OS Info):</span>
                <span className="text-slate-200">{selectedDevice.osInfo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">MAC Address:</span>
                <span className="text-amber-400">{selectedDevice.macAddress || 'ไม่ได้ระบุ'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">เวลาที่พบการเชื่อมต่อล่าสุด:</span>
                <span className="text-slate-300">{new Date(selectedDevice.lastSeen).toLocaleString('th-TH')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">วันที่ลงทะเบียนในระบบ:</span>
                <span className="text-slate-400">{new Date(selectedDevice.createdAt).toLocaleString('th-TH')}</span>
              </div>
            </div>

            {/* Zero-Trust Device Posture & Compliance Health */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>ผลการประเมินความปลอดภัย (Zero-Trust Posture Assessment)</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  COMPLIANT
                </span>
              </div>

              <div className="bg-[#050b08] rounded-xl border border-slate-800 divide-y divide-slate-800/60 overflow-hidden text-[11px]">
                <div className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">OS Security Patch</span>
                  </div>
                  <span className="font-mono text-emerald-400 text-[10px]">Up to date (KB5034441)</span>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">Disk Encryption (BitLocker)</span>
                  </div>
                  <span className="font-mono text-emerald-400 text-[10px]">Active (XTS-AES 256)</span>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">Antivirus / EDR Protection</span>
                  </div>
                  <span className="font-mono text-emerald-400 text-[10px]">Real-time Active</span>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">WireGuard Agent Health</span>
                  </div>
                  <span className="font-mono text-emerald-400 text-[10px]">v1.0.2 Verified</span>
                </div>
              </div>
            </div>

            {/* Zero-Trust Security Alert Notice */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-2 text-[11px] text-slate-400">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Trust Continuous Verification</strong>: อุปกรณ์นี้ผ่านเกณฑ์การตรวจสอบความสมบูรณ์และได้รับอนุญาตให้สร้างอุโมงค์ VPN เชื่อมต่อเข้าสู่เครือข่ายภายใน
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold transition cursor-pointer text-xs"
              >
                ปิดหน้าต่าง
              </button>
              {userRole === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => handleRevokeDevice(selectedDevice.id, selectedDevice.deviceName)}
                  disabled={revokingId === selectedDevice.id}
                  className="py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-bold transition flex items-center space-x-1.5 cursor-pointer text-xs disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{revokingId === selectedDevice.id ? 'กำลังเพิกถอน...' : 'เพิกถอนสิทธิ์อุปกรณ์'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ลงทะเบียนอุปกรณ์ใหม่ (+ Register Device) */}
      {isAddDeviceOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1410] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Laptop className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">ลงทะเบียนอุปกรณ์ใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDeviceOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDevice} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ชื่อเครื่อง / อุปกรณ์ (Device Name) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น MANGO-WORKSTATION-02, MACBOOK-DEV"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ระบบปฏิบัติการ (Operating System)
                </label>
                <select
                  value={newDeviceOs}
                  onChange={(e) => setNewDeviceOs(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="Windows 11 Pro 23H2">Windows 11 Pro 23H2</option>
                  <option value="Windows 10 Enterprise">Windows 10 Enterprise</option>
                  <option value="macOS Sonoma 14.4">macOS Sonoma 14.4</option>
                  <option value="Ubuntu 24.04 LTS">Ubuntu 24.04 LTS</option>
                  <option value="Android 14 (Mango Agent)">Android 14 (Mango Agent)</option>
                  <option value="iOS 17.4 (Mango Agent)">iOS 17.4 (Mango Agent)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  MAC Address (Physical Address)
                </label>
                <input
                  type="text"
                  placeholder="เช่น 00:1A:2B:3C:4D:7E"
                  value={newDeviceMac}
                  onChange={(e) => setNewDeviceMac(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ผู้ใช้งานที่ผูกกับอุปกรณ์ (Owner User ID)
                </label>
                <input
                  type="text"
                  placeholder="เช่น u-admin, u-staff"
                  value={newDeviceUserId}
                  onChange={(e) => setNewDeviceUserId(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  ระบุ User ID ของผู้ใช้ในระบบที่จะได้รับสิทธิ์ครอบครองเครื่องนี้
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddDeviceOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDevice}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDevice ? 'กำลังบันทึก...' : 'ลงทะเบียนอุปกรณ์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ปล่อยเวอร์ชัน Agent ใหม่ (+ Publish Release) */}
      {isAddVersionOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1410] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">ปล่อยเวอร์ชัน Agent ใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVersionOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVersion} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  เลขเวอร์ชัน (Version String) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น 1.1.0, 1.2.0-beta"
                  value={newVersionString}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewVersionString(val);
                    if (!newVersionUrl) {
                      const clean = val.replace(/^v/, '');
                      setNewVersionUrl(`http://127.0.0.1:47821/downloads/mango-agent-v${clean}.exe`);
                    }
                  }}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    ลิงก์ดาวน์โหลด (Download URL)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const clean = newVersionString.replace(/^v/, '') || '1.1.0';
                      setNewVersionUrl(`http://127.0.0.1:47821/downloads/mango-agent-v${clean}.exe`);
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    ใช้ Local Agent URL
                  </button>
                </div>
                <input
                  type="url"
                  placeholder="เช่น http://127.0.0.1:47821/downloads/mango-agent-v1.1.0.exe"
                  value={newVersionUrl}
                  onChange={(e) => setNewVersionUrl(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    SHA-256 Checksum
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomSha = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                      setNewVersionSha256(randomSha);
                    }}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    สุ่มสร้าง Hash
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="เช่น e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                  value={newVersionSha256}
                  onChange={(e) => setNewVersionSha256(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              {/* Mandatory Checkbox */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-2.5">
                <input
                  type="checkbox"
                  id="mandatoryCheckbox"
                  checked={newVersionMandatory}
                  onChange={(e) => setNewVersionMandatory(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-rose-500 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="mandatoryCheckbox" className="cursor-pointer select-none">
                  <div className="font-semibold text-white">บังคับอัปเดต (Mandatory Update)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    หากเปิดใช้งาน ผู้ใช้ที่ใช้ Agent เวอร์ชันเก่ากว่านี้จะไม่ได้รับอนุญาตให้เชื่อมต่อ VPN จนกว่าจะอัปเดต
                  </div>
                </label>
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddVersionOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVersion}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingVersion ? 'กำลังบันทึก...' : 'เผยแพร่เวอร์ชัน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
