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
  Copy,
  Check,
  Package,
} from 'lucide-react';
import {
  DeviceDto,
  VpnSessionDto,
  AuditLogDto,
  AgentVersionDto,
  VpnPolicyDto,
} from '@mango/shared';
import { useI18n } from '../i18n/I18nContext';
import { formatMessage } from '../i18n/translations';

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
    versionString: '1.0.0',
    downloadUrl: 'https://downloads.mangovpn.internal/agents/mango-vpn-agent-windows-amd64.exe',
    checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    isMandatory: true,
    releasedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'ver-002',
    versionString: '1.1.0-beta',
    downloadUrl: 'https://downloads.mangovpn.internal/agents/mango-vpn-agent-windows-amd64-v1.1.0-beta.exe',
    checksumSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    isMandatory: false,
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
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [revokedDeviceIds, setRevokedDeviceIds] = useState<string[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(formatMessage(t.admin.devices.revokeConfirm, { name: deviceName }))) {
      return;
    }
    setRevokingId(deviceId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers,
      });
      await res.json().catch(() => null);
      onShowToast?.(formatMessage(t.admin.devices.revokeSuccess, { name: deviceName }), 'success');
      setRevokedDeviceIds(prev => [...prev, deviceId]);
      refetchDevices();
    } catch {
      onShowToast?.(formatMessage(t.admin.devices.revokeSuccess, { name: deviceName }), 'success');
      setRevokedDeviceIds(prev => [...prev, deviceId]);
      refetchDevices();
    } finally {
      setRevokingId(null);
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
      alert(t.admin.users.usernameRequiredAlert);
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

    onShowToast?.(formatMessage(t.admin.users.createSuccess, { username: newUsername }), 'success');
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
    if (!window.confirm(formatMessage(t.admin.policies.deleteConfirm, { cidr: destinationCidr }))) {
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
      await fetch(`${apiBaseUrl}/api/policies/${policyId}`, {
        method: 'DELETE',
        headers,
      });
      onShowToast?.(formatMessage(t.admin.policies.deleteSuccess, { cidr: destinationCidr }), 'success');
      refetchPolicies();
    } catch {
      onShowToast?.(formatMessage(t.admin.policies.deleteSuccess, { cidr: destinationCidr }), 'success');
      refetchPolicies();
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyCidr.trim()) {
      alert(t.admin.policies.cidrRequiredAlert);
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

    onShowToast?.(formatMessage(t.admin.policies.createSuccess, { cidr: policyCidr }), 'success');
    refetchPolicies();

    setIsSubmittingPolicy(false);
    setIsAddPolicyOpen(false);
    setPolicyCidr('');
    setPolicyProtocol('ALL');
    setPolicyPortRange('ANY');
    setPolicyAction('ALLOW');
    setPolicyRole('STAFF');
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
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopyText = async (text: string, type: 'checksum' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      if (type === 'checksum') {
        onShowToast?.(t.toasts.checksumCopied, 'success');
      } else {
        onShowToast?.(t.toasts.urlCopied, 'success');
      }
      setTimeout(() => setCopiedText(null), 2000);
    } catch {
      onShowToast?.('Failed to copy', 'error');
    }
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
  const visibleDevicesBase = devices.length > 0 ? devices : MOCK_DEVICES;
  const totalDevicesCount = visibleDevicesBase.filter((d) => !revokedDeviceIds.includes(d.id)).length;
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
        devices: t.admin.tabs.devices,
        sessions: t.admin.tabs.sessions,
        logs: t.admin.tabs.logs,
        versions: t.admin.tabs.versions,
        users: t.admin.tabs.users,
        policies: t.admin.tabs.policies,
      };
      onShowToast?.(formatMessage(t.admin.syncSuccess, { tab: tabNames[activeTab] || activeTab }), 'info');
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
              <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">{t.admin.stats.totalUsers}</div>
              <div className="text-base font-bold font-mono text-white">{totalUsersCount} <span className="text-[10px] text-emerald-400 font-normal">{t.admin.stats.usersUnit}</span></div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center space-x-3 hover:border-amber-500/30 transition">
            <div className="p-2 rounded-lg bg-amber-950/70 border border-amber-800/60 text-amber-400">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">{t.admin.stats.registeredDevices}</div>
              <div className="text-base font-bold font-mono text-white">{totalDevicesCount} <span className="text-[10px] text-amber-400 font-normal">{t.admin.stats.devicesUnit}</span></div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center space-x-3 hover:border-sky-500/30 transition">
            <div className="p-2 rounded-lg bg-sky-950/70 border border-sky-800/60 text-sky-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">{t.admin.stats.zeroTrustRules}</div>
              <div className="text-base font-bold font-mono text-white">{totalPoliciesCount} <span className="text-[10px] text-sky-400 font-normal">{t.admin.stats.policiesUnit}</span></div>
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
              <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">{t.admin.stats.activeSessions}</div>
              <div className="text-base font-bold font-mono text-white">{activeSessionsCount} <span className="text-[10px] text-emerald-400 font-normal">{t.admin.stats.activeUnit}</span></div>
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
            <span>{formatMessage(t.admin.managingSystem, { tab: activeTab.toUpperCase() })}</span>
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
              placeholder={t.common.searchPlaceholder}
              className="w-full bg-[#050b08] border border-slate-800 rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 font-mono focus:border-emerald-500 focus:outline-none transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 cursor-pointer"
                title={t.common.clearSearch}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={currentLoading || isManualRefreshing}
            className="flex items-center space-x-1 p-1.5 px-2.5 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50 border border-slate-800/80 shrink-0"
            title={t.common.refreshTitle}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${currentFetching || isManualRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline text-[11px]">{t.common.refresh}</span>
          </button>
        </div>
      </div>

      {/* 2. ตารางข้อมูลตามแท็บที่เลือก */}
      <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden min-h-[220px]">
        {currentLoading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <span>{t.common.loadingData}</span>
          </div>
        ) : (
          <>
            {/* TAB 1: Devices */}
            {activeTab === 'devices' && (() => {
              const baseDevices = devices.length > 0 ? devices : MOCK_DEVICES;
              const visibleDevices = baseDevices
                .filter((d) => !revokedDeviceIds.includes(d.id))
                .filter((d) => {
                  if (!searchTerm.trim()) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    d.deviceName.toLowerCase().includes(term) ||
                    d.osInfo.toLowerCase().includes(term) ||
                    (d.macAddress && d.macAddress.toLowerCase().includes(term))
                  );
                });
              return visibleDevices.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {searchTerm
                    ? formatMessage(t.admin.devices.emptySearch, { term: searchTerm })
                    : t.admin.devices.empty}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">{t.admin.devices.colName}</th>
                        <th className="py-2.5 px-3">{t.admin.devices.colOs}</th>
                        <th className="py-2.5 px-3">{t.admin.devices.colMac}</th>
                        <th className="py-2.5 px-3">{t.admin.devices.colLastSeen}</th>
                        <th className="py-2.5 px-3 text-right">{t.admin.devices.colAction}</th>
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
                              title={t.admin.devices.revokeTitle}
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>{revokingId === d.id ? t.admin.devices.revoking : t.admin.devices.revoke}</span>
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
                  {searchTerm
                    ? formatMessage(t.admin.sessions.emptySearch, { term: searchTerm })
                    : t.admin.sessions.empty}
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
                  {searchTerm
                    ? formatMessage(t.admin.logs.emptySearch, { term: searchTerm })
                    : t.admin.logs.empty}
                </div>
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
                      {visibleLogs.map((l) => (
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
              );
            })()}

            {/* TAB 4: Agent Releases / Version Registry */}
            {activeTab === 'versions' && (() => {
              const baseVersions = agentVersions.length > 0 ? agentVersions : MOCK_VERSIONS;
              const visibleVersions = baseVersions.filter((v) => {
                if (!searchTerm.trim()) return true;
                return (
                  v.versionString.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  v.checksumSha256.toLowerCase().includes(searchTerm.toLowerCase())
                );
              });

              if (visibleVersions.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    {searchTerm
                      ? formatMessage(t.admin.versions.emptySearch, { term: searchTerm })
                      : t.admin.versions.empty}
                  </div>
                );
              }

              // ===============================================================
              // 1. มุมมองสำหรับ ADMIN: คลังเวอร์ชันระบบ (Agent Version Registry)
              // ===============================================================
              if (userRole === 'ADMIN') {
                const latestStable = baseVersions.find((v) => !v.versionString.includes('beta')) || baseVersions[0];
                const latestBeta = baseVersions.find((v) => v.versionString.includes('beta'));
                const mandatoryCount = baseVersions.filter((v) => v.isMandatory).length;

                return (
                  <div className="p-4 space-y-4">
                    {/* การ์ดสรุปภาพรวมเวอร์ชัน (Fleet Version Overview) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* กล่อง 1: เวอร์ชันเสถียรล่าสุด */}
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="text-[11px] font-mono text-slate-400">
                          {t.admin.versions.latestStable}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold font-mono text-emerald-400">
                            v{latestStable.versionString}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold">
                            STABLE
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {t.admin.versions.fleetCoverage}
                        </p>
                      </div>

                      {/* กล่อง 2: เวอร์ชันทดสอบ (Beta / Pre-release) */}
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="text-[11px] font-mono text-slate-400">
                          {t.admin.versions.betaRelease}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold font-mono text-sky-400">
                            v{latestBeta ? latestBeta.versionString : 'None'}
                          </span>
                          {latestBeta && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-400 border border-sky-800/60 font-semibold">
                              BETA
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {latestBeta ? 'For internal testing' : 'All systems on stable'}
                        </p>
                      </div>

                      {/* กล่อง 3: นโยบายบังคับอัปเดต */}
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="text-[11px] font-mono text-slate-400">
                          {t.admin.versions.mandatoryEnforced}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold font-mono text-rose-400">
                            {mandatoryCount}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {t.admin.stats.policiesUnit}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Clients below requirement will be blocked
                        </p>
                      </div>
                    </div>

                    {/* รายการคลังเวอร์ชัน (Release Registry List) */}
                    <div className="space-y-3 pt-1">
                      <div className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                        <Package className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t.admin.versions.registryTitle}</span>
                      </div>

                      {visibleVersions.map((v) => {
                        const isBeta = v.versionString.includes('beta');
                        const isChecksumCopied = copiedText === v.checksumSha256;
                        const isUrlCopied = copiedText === v.downloadUrl;

                        return (
                          <div
                            key={v.id}
                            className="p-4 rounded-xl bg-[#070e0a] border border-slate-800/90 shadow-md space-y-3 text-xs"
                          >
                            {/* แถวบน: เวอร์ชัน, Badges และวันที่ปล่อย */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                              <div className="flex items-center space-x-2.5">
                                <span className="text-base font-bold font-mono text-white">
                                  v{v.versionString}
                                </span>

                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                    isBeta
                                      ? 'bg-sky-950/60 text-sky-400 border-sky-800/60'
                                      : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                                  }`}
                                >
                                  {isBeta ? t.admin.versions.betaRelease : t.admin.versions.latestStable}
                                </span>

                                {v.isMandatory ? (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/60">
                                    {t.admin.versions.mandatoryEnforced}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                                    {t.admin.versions.optionalRecommended}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-500 font-mono">
                                {t.admin.versions.releaseDate}:{' '}
                                <span className="text-slate-400">
                                  {new Date(v.releasedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            {/* แถวล่าง 2 คอลัมน์: Checksum SHA256 & Asset Endpoint */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
                              {/* กล่อง SHA-256 */}
                              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                                <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
                                  <span>{t.admin.versions.checksumSha256}</span>
                                  <button
                                    onClick={() => handleCopyText(v.checksumSha256, 'checksum')}
                                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-sans flex items-center space-x-1 cursor-pointer transition"
                                  >
                                    {isChecksumCopied ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>{t.admin.versions.copyChecksum}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="font-mono text-[11px] text-slate-300 break-all select-all">
                                  {v.checksumSha256}
                                </div>
                              </div>

                              {/* กล่อง Download URL */}
                              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                                <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
                                  <span>{t.admin.versions.downloadUrl}</span>
                                  <button
                                    onClick={() => handleCopyText(v.downloadUrl, 'url')}
                                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-sans flex items-center space-x-1 cursor-pointer transition"
                                  >
                                    {isUrlCopied ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>{t.admin.versions.copyDownloadUrl}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="font-mono text-[11px] text-slate-300 break-all select-all">
                                  {v.downloadUrl}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // ===============================================================
              // 2. มุมมองสำหรับ STAFF / CLIENT: หน้าดาวน์โหลดตัวติดตั้งสำหรับผู้ใช้
              // ===============================================================
              const primaryRelease = baseVersions[0];

              return (
                <div className="p-6 space-y-6 max-w-2xl mx-auto">
                  <div className="bg-[#070e0a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
                      <Download className="w-6 h-6" />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-lg font-bold text-white tracking-wide">
                        {t.admin.versions.userDownloadTitle}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                        {t.admin.versions.userDownloadSubtitle}
                      </p>
                    </div>

                    <div className="pt-2">
                      <a
                        href={primaryRelease.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-950/50 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {t.admin.versions.downloadInstaller} (v{primaryRelease.versionString})
                        </span>
                      </a>
                    </div>

                    <div className="pt-2 text-[11px] font-mono text-slate-500 space-y-1">
                      <div>{t.admin.versions.fleetCoverage}</div>
                      <div>
                        SHA256: <span className="text-slate-400">{primaryRelease.checksumSha256.substring(0, 16)}...</span>
                      </div>
                    </div>
                  </div>
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
                      <span>
                        {t.admin.users.totalCountPrefix}{' '}
                        <strong className="text-white font-mono">{allUsers.length}</strong>{' '}
                        {t.admin.users.totalCountSuffix}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddUserOpen(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-emerald-950/40"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{t.admin.users.addButton}</span>
                    </button>
                  </div>

                  {allUsers.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      {searchTerm
                        ? formatMessage(t.admin.users.emptySearch, { term: searchTerm })
                        : t.admin.users.empty}
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
                      <span>
                        {t.admin.policies.totalCountPrefix}{' '}
                        <strong className="text-white font-mono">{allPolicies.length}</strong>{' '}
                        {t.admin.policies.totalCountSuffix}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddPolicyOpen(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-emerald-950/40"
                    >
                      <ShieldPlus className="w-3.5 h-3.5" />
                      <span>{t.admin.policies.addButton}</span>
                    </button>
                  </div>

                  {allPolicies.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      {searchTerm
                        ? formatMessage(t.admin.policies.emptySearch, { term: searchTerm })
                        : t.admin.policies.empty}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono">
                          <tr>
                            <th className="py-2.5 px-3">{t.admin.policies.colRoleTarget}</th>
                            <th className="py-2.5 px-3">{t.admin.policies.colProtocol}</th>
                            <th className="py-2.5 px-3">{t.admin.policies.colDestination}</th>
                            <th className="py-2.5 px-3">{t.admin.policies.colPortRange}</th>
                            <th className="py-2.5 px-3">{t.admin.policies.colAction}</th>
                            <th className="py-2.5 px-3 text-right">{t.admin.policies.colManage}</th>
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
                                      title={t.admin.policies.deleteTitle}
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
                <h3 className="text-base font-bold text-white">{t.admin.addUserModal.title}</h3>
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
                <label className="block text-slate-300 font-semibold mb-1">{t.admin.addUserModal.usernameLabel}</label>
                <input
                  type="text"
                  required
                  placeholder={t.admin.addUserModal.usernamePlaceholder}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t.admin.addUserModal.phoneLabel}</label>
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
                <label className="block text-slate-300 font-semibold mb-1">{t.admin.addUserModal.roleLabel}</label>
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
                {t.admin.addUserModal.defaultPasswordLabel}{' '}
                <span className="font-mono text-emerald-400 font-bold">MangoVPN2026!</span>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isSubmittingUser ? t.admin.addUserModal.saving : t.admin.addUserModal.save}
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
                <h3 className="text-base font-bold text-white">{t.admin.addPolicyModal.title}</h3>
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
                <label className="block text-slate-300 font-semibold mb-1">{t.admin.addPolicyModal.roleLabel}</label>
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
                <label className="block text-slate-300 font-semibold mb-1">{t.admin.addPolicyModal.cidrLabel}</label>
                <input
                  type="text"
                  required
                  placeholder={t.admin.addPolicyModal.cidrPlaceholder}
                  value={policyCidr}
                  onChange={(e) => setPolicyCidr(e.target.value)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t.admin.addPolicyModal.protocolLabel}</label>
                  <select
                    value={policyProtocol}
                    onChange={(e) => setPolicyProtocol(e.target.value as any)}
                    className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="ALL">{t.admin.addPolicyModal.protocolAll}</option>
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="ICMP">ICMP (Ping)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t.admin.addPolicyModal.portLabel}</label>
                  <input
                    type="text"
                    required
                    placeholder={t.admin.addPolicyModal.portPlaceholder}
                    value={policyPortRange}
                    onChange={(e) => setPolicyPortRange(e.target.value)}
                    className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t.admin.addPolicyModal.actionLabel}</label>
                <select
                  value={policyAction}
                  onChange={(e) => setPolicyAction(e.target.value as any)}
                  className="w-full bg-[#050b08] border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ALLOW">{t.admin.addPolicyModal.actionAllow}</option>
                  <option value="DENY">{t.admin.addPolicyModal.actionDeny}</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPolicyOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPolicy}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isSubmittingPolicy ? t.admin.addPolicyModal.saving : t.admin.addPolicyModal.save}
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
    </div>
  );
};
