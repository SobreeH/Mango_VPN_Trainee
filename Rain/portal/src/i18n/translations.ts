export type Language = 'th' | 'en';

export interface Translations {
  common: {
    backToConnect: string;
    cancel: string;
    refresh: string;
    refreshTitle: string;
    searchPlaceholder: string;
    clearSearch: string;
    loadingData: string;
    gatewayOnline: string;
    gatewayStandby: string;
    languageLabel: string;
    notificationsAria: string;
    dismissNotification: string;
  };
  validation: {
    usernameRequired: string;
    usernameMax: string;
    usernameRegex: string;
    passwordRequired: string;
    passwordMin: string;
    otpLength: string;
    otpDigits: string;
  };
  login: {
    title: string;
    stepSubtitle: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    passwordLabel: string;
    showPassword: string;
    hidePassword: string;
    passwordHint: string;
    submit: string;
    agentNotInstalled: string;
    downloadAgent: string;
    downloadAgentAlert: string;
    contactAdmin: string;
    contactAdminAlert: string;
    demoAccountsTitle: string;
    demoAccountsHint: string;
  };
  otp: {
    backTitle: string;
    step: string;
    title: string;
    sentTo: string;
    incompleteError: string;
    expiresInPrefix: string;
    expiresInSuffix: string;
    resendOtp: string;
    resendCooldown: string;
    submit: string;
    expiredBack: string;
  };
  sidebar: {
    nav: {
      connect: string;
      history: string;
      devices: string;
      users: string;
      policies: string;
      audit_logs: string;
      agent: string;
    };
    signOut: string;
  };
  pages: {
    historyClientTitle: string;
    historyClientSubtitle: string;
    historyAdminTitle: string;
    historyAdminSubtitle: string;
    devicesTitle: string;
    devicesSubtitle: string;
    usersTitle: string;
    usersSubtitle: string;
    policiesTitle: string;
    policiesSubtitle: string;
    auditLogsTitle: string;
    auditLogsSubtitle: string;
    agentTitle: string;
    agentSubtitle: string;
  };
  toasts: {
    otpSent: string;
    devMockOtp: string;
    smsOtpReceived: string;
    invalidOtpCode: string;
    otpResentSuccess: string;
    invalidCredentials: string;
    loginSuccessWelcome: string;
    loginSuccessAs: string;
    otpFailed: string;
    agentNotFound: string;
    vpnConnected: string;
    vpnConnectError: string;
    vpnDisconnected: string;
    vpnDisconnectError: string;
    signedOut: string;
    ipCopied: string;
    ipCopyError: string;
  };
  dashboard: {
    connected: string;
    disconnected: string;
    darkMode: string;
    greeting: string;
    yourDevice: string;
    privateNetwork: string;
    disconnect: string;
    connecting: string;
    connectVpn: string;
    notAssigned: string;
    copyIpTitle: string;
    duration: string;
    allowedNetworks: string;
    allNetworks: string;
    accessRestricted: string;
    accessCorporate: string;
    accessFull: string;
    roleClientLabel: string;
    roleStaffLabel: string;
    roleAdminLabel: string;
  };
  admin: {
    stats: {
      totalUsers: string;
      usersUnit: string;
      registeredDevices: string;
      devicesUnit: string;
      zeroTrustRules: string;
      policiesUnit: string;
      activeSessions: string;
      activeUnit: string;
    };
    tabs: {
      devices: string;
      sessions: string;
      logs: string;
      versions: string;
      users: string;
      policies: string;
    };
    managingSystem: string;
    syncSuccess: string;
    devices: {
      revokeConfirm: string;
      revokeSuccess: string;
      emptySearch: string;
      empty: string;
      colName: string;
      colOs: string;
      colMac: string;
      colLastSeen: string;
      colAction: string;
      revokeTitle: string;
      revoking: string;
      revoke: string;
    };
    sessions: {
      emptySearch: string;
      empty: string;
      colClientIp: string;
      colTraffic: string;
      colDuration: string;
      colStatus: string;
      active: string;
      closed: string;
      online: string;
    };
    logs: {
      emptySearch: string;
      empty: string;
      colAction: string;
      colIp: string;
      colTimestamp: string;
    };
    versions: {
      emptySearch: string;
      empty: string;
      mandatory: string;
      download: string;
    };
    users: {
      totalCountPrefix: string;
      totalCountSuffix: string;
      addButton: string;
      emptySearch: string;
      empty: string;
      colUsername: string;
      colRole: string;
      colPhone: string;
      col2fa: string;
      colStatus: string;
      enforcedSms: string;
      activeStatus: string;
      suspendedStatus: string;
      usernameRequiredAlert: string;
      createSuccess: string;
    };
    policies: {
      totalCountPrefix: string;
      totalCountSuffix: string;
      addButton: string;
      emptySearch: string;
      empty: string;
      colRoleTarget: string;
      colProtocol: string;
      colDestination: string;
      colPortRange: string;
      colAction: string;
      colManage: string;
      deleteConfirm: string;
      deleteSuccess: string;
      deleteTitle: string;
      cidrRequiredAlert: string;
      createSuccess: string;
    };
    addUserModal: {
      title: string;
      usernameLabel: string;
      usernamePlaceholder: string;
      phoneLabel: string;
      roleLabel: string;
      defaultPasswordLabel: string;
      saving: string;
      save: string;
    };
    addPolicyModal: {
      title: string;
      roleLabel: string;
      cidrLabel: string;
      cidrPlaceholder: string;
      protocolLabel: string;
      protocolAll: string;
      portLabel: string;
      portPlaceholder: string;
      actionLabel: string;
      actionAllow: string;
      actionDeny: string;
      saving: string;
      save: string;
    };
  };
}

export const translations: Record<Language, Translations> = {
  th: {
    common: {
      backToConnect: '← กลับหน้าเชื่อมต่อ VPN',
      cancel: 'ยกเลิก',
      refresh: 'รีเฟรช',
      refreshTitle: 'รีเฟรชข้อมูล',
      searchPlaceholder: 'ค้นหาข้อมูล...',
      clearSearch: 'ล้างคำค้นหา',
      loadingData: 'กำลังโหลดข้อมูล...',
      gatewayOnline: 'Gateway API Online',
      gatewayStandby: 'Gateway Standby (Dev Mock)',
      languageLabel: 'ภาษา',
      notificationsAria: 'การแจ้งเตือน',
      dismissNotification: 'ปิดการแจ้งเตือน',
    },
    validation: {
      usernameRequired: 'กรุณากรอก Username',
      usernameMax: 'Username ต้องไม่เกิน 50 ตัวอักษร',
      usernameRegex: 'Username ต้องประกอบด้วยตัวอักษร, ตัวเลข, _ หรือ - เท่านั้น',
      passwordRequired: 'กรุณากรอกรหัสผ่าน',
      passwordMin: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      otpLength: 'รหัส OTP ต้องมีความยาว 6 หลักพอดี',
      otpDigits: 'รหัส OTP ต้องเป็นตัวเลขเท่านั้น',
    },
    login: {
      title: 'เข้าสู่ระบบ VPN',
      stepSubtitle: 'ขั้นตอนที่ 1 จาก 3 · กรอกข้อมูลเพื่อเข้าใช้งาน',
      usernameLabel: 'ชื่อผู้ใช้',
      usernamePlaceholder: 'เช่น somchai.k',
      passwordLabel: 'รหัสผ่าน',
      showPassword: 'แสดง',
      hidePassword: 'ซ่อน',
      passwordHint: 'อย่างน้อย 8 ตัวอักษร',
      submit: 'เข้าสู่ระบบ',
      agentNotInstalled: 'ยังไม่ได้ติดตั้ง Agent? ',
      downloadAgent: 'ดาวน์โหลด',
      downloadAgentAlert: 'ดาวน์โหลด Agent: กรุณารัน npm run mock:agent บนเครื่องของคุณ',
      contactAdmin: 'ติดต่อ Admin',
      contactAdminAlert: 'ติดต่อ Admin: admin@mangovpn.internal',
      demoAccountsTitle: 'ข้อมูลบัญชีทดสอบสำหรับนักพัฒนา (Developer Demo)',
      demoAccountsHint: 'คลิกเพื่อเลือกบัญชีสำหรับทดสอบระบบ',
    },
    otp: {
      backTitle: 'ย้อนกลับ',
      step: 'ขั้นตอนที่ 2 จาก 3',
      title: 'ยืนยันตัวตน',
      sentTo: 'ส่งรหัส 6 หลักไปที่',
      incompleteError: 'กรุณากรอกรหัส OTP ให้ครบ 6 หลัก',
      expiresInPrefix: 'รหัสหมดอายุใน',
      expiresInSuffix: 'นาที',
      resendOtp: 'ขอรหัสใหม่',
      resendCooldown: 'ขอรหัสใหม่ได้ใน {seconds} วินาที',
      submit: 'ยืนยัน',
      expiredBack: 'รหัสหมดอายุ? เข้าสู่ระบบใหม่',
    },
    sidebar: {
      nav: {
        connect: 'เชื่อมต่อ',
        history: 'ประวัติ',
        devices: 'อุปกรณ์',
        users: 'ผู้ใช้',
        policies: 'นโยบาย',
        audit_logs: 'Audit Logs',
        agent: 'Agent',
      },
      signOut: 'ออกจากระบบ',
    },
    pages: {
      historyClientTitle: 'ประวัติการเชื่อมต่อ VPN (VPN Sessions)',
      historyClientSubtitle: 'ตรวจสอบประวัติวันเวลาและปริมาณการเชื่อมต่อ WireGuard ของคุณ',
      historyAdminTitle: 'ประวัติการใช้งานระบบ (Sessions & Audit Logs)',
      historyAdminSubtitle: 'ตรวจสอบประวัติการเชื่อมต่อ VPN และบันทึกกิจกรรมความปลอดภัย',
      devicesTitle: 'อุปกรณ์ที่ลงทะเบียน (Registered Devices)',
      devicesSubtitle: 'รายชื่อเครื่องคอมพิวเตอร์และอุปกรณ์ที่ได้รับอนุญาตในระบบ',
      usersTitle: 'รายชื่อผู้ใช้ในระบบ (User Management)',
      usersSubtitle: 'บริหารจัดการบัญชีผู้ใช้ บทบาท และการยืนยันตัวตน 2FA',
      policiesTitle: 'นโยบายความปลอดภัยเครือข่าย (Zero-Trust Access Policies)',
      policiesSubtitle: 'กำหนดขอบเขตและกฎระเบียบการเข้าถึง Subnet สำหรับแต่ละบทบาท (Least-Privilege)',
      auditLogsTitle: 'บันทึกกิจกรรมความปลอดภัย (Audit Logs)',
      auditLogsSubtitle: 'ประวัติการตรวจสอบย้อนหลังด้านความมั่นคงปลอดภัยสารสนเทศ',
      agentTitle: 'ไคลเอนต์เอเจนต์ (Agent Versions & Releases)',
      agentSubtitle: 'ดาวน์โหลดและตรวจสอบเวอร์ชันของ Mango Windows Agent',
    },
    toasts: {
      otpSent: 'ส่งรหัสยืนยัน OTP ไปที่ {phone}',
      devMockOtp: 'โหมดจำลอง (Dev Mode): ใช้ OTP เลข 123456 ได้เลยครับ',
      smsOtpReceived: '💬 [SMS Gateway] รหัส OTP สำหรับ MANGO VPN คือ: {otp} (หมดอายุใน 5 นาที)',
      invalidOtpCode: 'รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบรหัสจาก SMS และลองใหม่อีกครั้ง',
      otpResentSuccess: 'ส่งรหัส OTP ชุดใหม่ไปยังเบอร์มือถือของคุณแล้ว',
      invalidCredentials: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ลองใช้: admin_user / MangoVPN2026!)',
      loginSuccessWelcome: 'เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ {username} ({role})',
      loginSuccessAs: 'เข้าสู่ระบบสำเร็จในฐานะ {username} ({role})',
      otpFailed: 'การยืนยันรหัส OTP ล้มเหลว',
      agentNotFound: 'ไม่พบเซอร์วิส Agent บนเครื่อง 127.0.0.1:47821 (กรุณารัน: npm run mock:agent)',
      vpnConnected: 'เชื่อมต่อ WireGuard Tunnel เรียบร้อยแล้ว!',
      vpnConnectError: 'เกิดข้อผิดพลาดในการเชื่อมต่อ VPN',
      vpnDisconnected: 'ตัดการเชื่อมต่อ WireGuard VPN เรียบร้อยแล้ว',
      vpnDisconnectError: 'ไม่สามารถตัดการเชื่อมต่อได้อย่างสมบูรณ์',
      signedOut: 'ออกจากระบบเรียบร้อยแล้ว',
      ipCopied: 'คัดลอก VPN IP ({ip}) เรียบร้อยแล้ว',
      ipCopyError: 'ไม่สามารถคัดลอก IP ได้',
    },
    dashboard: {
      connected: 'เชื่อมต่อแล้ว',
      disconnected: 'ยังไม่เชื่อมต่อ',
      darkMode: 'โหมดมืด',
      greeting: 'สวัสดี, {username}',
      yourDevice: 'เครื่องของคุณ',
      privateNetwork: 'Private Network',
      disconnect: 'ตัดการเชื่อมต่อ',
      connecting: 'กำลังเชื่อมต่อ...',
      connectVpn: 'เชื่อมต่อ VPN',
      notAssigned: 'Not Assigned',
      copyIpTitle: 'คัดลอก IP',
      duration: 'เวลาเชื่อมต่อ',
      allowedNetworks: 'เครือข่ายที่เข้าถึงได้',
      allNetworks: '0.0.0.0/0 (ทุกเครือข่าย)',
      accessRestricted: 'เข้าถึงเฉพาะ Web Portal ภายใน (Restricted)',
      accessCorporate: 'เข้าถึง Internal Subnets ของออฟฟิศ (Corporate)',
      accessFull: 'เข้าถึงทุกโครงสร้างเครือข่าย (Full Access)',
      roleClientLabel: 'CLIENT · RESTRICTED',
      roleStaffLabel: 'STAFF · CORPORATE SUBNET',
      roleAdminLabel: 'ADMIN · FULL INFRASTRUCTURE',
    },
    admin: {
      stats: {
        totalUsers: 'ผู้ใช้ทั้งหมด',
        usersUnit: 'บัญชี',
        registeredDevices: 'อุปกรณ์ที่ลงทะเบียน',
        devicesUnit: 'เครื่อง',
        zeroTrustRules: 'กฎ Zero-Trust',
        policiesUnit: 'นโยบาย',
        activeSessions: 'เซสชันออนไลน์',
        activeUnit: 'Active',
      },
      tabs: {
        devices: 'อุปกรณ์ (Devices)',
        sessions: 'ประวัติเชื่อมต่อ (Sessions)',
        logs: 'บันทึกความปลอดภัย (Audit Logs)',
        versions: 'เวอร์ชัน Agent',
        users: 'ผู้ใช้ (Users)',
        policies: 'นโยบาย (Policies)',
      },
      managingSystem: 'จัดการข้อมูลระบบ ({tab})',
      syncSuccess: 'ซิงค์ข้อมูล {tab} ล่าสุดเรียบร้อยแล้ว',
      devices: {
        revokeConfirm: 'คุณต้องการเพิกถอนสิทธิ์อุปกรณ์ "{name}" ออกจากระบบ WireGuard หรือไม่?',
        revokeSuccess: 'เพิกถอนสิทธิ์อุปกรณ์ "{name}" เรียบร้อยแล้ว',
        emptySearch: 'ไม่พบอุปกรณ์ที่ตรงกับ "{term}"',
        empty: 'ยังไม่มีข้อมูลอุปกรณ์ที่ลงทะเบียน',
        colName: 'Device Name',
        colOs: 'OS Info',
        colMac: 'MAC Address',
        colLastSeen: 'Last Seen',
        colAction: 'Action',
        revokeTitle: 'เพิกถอนสิทธิ์อุปกรณ์',
        revoking: 'กำลังลบ...',
        revoke: 'เพิกถอน',
      },
      sessions: {
        emptySearch: 'ไม่พบเซสชันที่ตรงกับ "{term}"',
        empty: 'ยังไม่มีประวัติการเชื่อมต่อ',
        colClientIp: 'Client IP',
        colTraffic: 'Traffic (RX/TX)',
        colDuration: 'Duration',
        colStatus: 'Status',
        active: 'Active',
        closed: 'Closed',
        online: 'Online',
      },
      logs: {
        emptySearch: 'ไม่พบบันทึก Log ที่ตรงกับ "{term}"',
        empty: 'ยังไม่มีบันทึก Audit Log',
        colAction: 'Action',
        colIp: 'IP Address',
        colTimestamp: 'Timestamp',
      },
      versions: {
        emptySearch: 'ไม่พบเวอร์ชันที่ตรงกับ "{term}"',
        empty: 'ไม่มีข้อมูลเวอร์ชัน Agent',
        mandatory: 'Mandatory',
        download: 'Download',
      },
      users: {
        totalCountPrefix: 'ผู้ใช้ในระบบทั้งหมด:',
        totalCountSuffix: 'บัญชี',
        addButton: '+ เพิ่มผู้ใช้ใหม่',
        emptySearch: 'ไม่พบผู้ใช้ที่ตรงกับ "{term}"',
        empty: 'ยังไม่มีข้อมูลผู้ใช้ในระบบ',
        colUsername: 'Username',
        colRole: 'Role',
        colPhone: 'Phone (MFA)',
        col2fa: '2FA Status',
        colStatus: 'Status',
        enforcedSms: 'Enforced (SMS)',
        activeStatus: '● Active',
        suspendedStatus: '● Suspended',
        usernameRequiredAlert: 'กรุณากรอกชื่อผู้ใช้',
        createSuccess: 'เพิ่มผู้ใช้ "{username}" สำเร็จแล้ว',
      },
      policies: {
        totalCountPrefix: 'กฎความปลอดภัยทั้งหมด:',
        totalCountSuffix: 'นโยบาย',
        addButton: '+ เพิ่มนโยบาย',
        emptySearch: 'ไม่พบนโยบายที่ตรงกับ "{term}"',
        empty: 'ยังไม่มีนโยบายการเข้าถึง',
        colRoleTarget: 'Role Target',
        colProtocol: 'Protocol',
        colDestination: 'Destination Subnet',
        colPortRange: 'Port Range',
        colAction: 'Action',
        colManage: 'จัดการ',
        deleteConfirm: 'ต้องการลบนโยบายเครือข่ายสำหรับ "{cidr}" ใช่หรือไม่?',
        deleteSuccess: 'ลบนโยบาย "{cidr}" เรียบร้อยแล้ว',
        deleteTitle: 'ลบนโยบายเครือข่าย',
        cidrRequiredAlert: 'กรุณากรอก Destination Subnet (เช่น 10.50.0.0/16)',
        createSuccess: 'เพิ่มนโยบายสำหรับ "{cidr}" สำเร็จแล้ว',
      },
      addUserModal: {
        title: 'เพิ่มบัญชีผู้ใช้ใหม่',
        usernameLabel: 'ชื่อผู้ใช้ (Username)',
        usernamePlaceholder: 'เช่น somchai.k',
        phoneLabel: 'เบอร์โทรศัพท์ (สำหรับ 2FA OTP)',
        roleLabel: 'บทบาทและสิทธิ์ (Role)',
        defaultPasswordLabel: 'รหัสผ่านเริ่มต้น:',
        saving: 'กำลังบันทึก...',
        save: 'บันทึกผู้ใช้',
      },
      addPolicyModal: {
        title: 'เพิ่มกฎความปลอดภัยเครือข่าย',
        roleLabel: 'บทบาทเป้าหมาย (Role Target)',
        cidrLabel: 'ปลายทางเครือข่าย (Destination Subnet / CIDR)',
        cidrPlaceholder: 'เช่น 10.50.0.0/16 หรือ 192.168.1.100/32',
        protocolLabel: 'โปรโตคอล (Protocol)',
        protocolAll: 'ALL (ทุกโปรโตคอล)',
        portLabel: 'พอร์ต (Port Range)',
        portPlaceholder: 'ANY หรือ 80,443',
        actionLabel: 'การกระทำ (Action)',
        actionAllow: 'ALLOW (อนุญาตการเข้าถึง)',
        actionDeny: 'DENY (ปฏิเสธ / บล็อก)',
        saving: 'กำลังบันทึก...',
        save: 'บันทึกนโยบาย',
      },
    },
  },
  en: {
    common: {
      backToConnect: '← Back to VPN Connect',
      cancel: 'Cancel',
      refresh: 'Refresh',
      refreshTitle: 'Refresh data',
      searchPlaceholder: 'Search...',
      clearSearch: 'Clear search',
      loadingData: 'Loading data...',
      gatewayOnline: 'Gateway API Online',
      gatewayStandby: 'Gateway Standby (Dev Mock)',
      languageLabel: 'Language',
      notificationsAria: 'Notifications',
      dismissNotification: 'Dismiss notification',
    },
    validation: {
      usernameRequired: 'Please enter a username',
      usernameMax: 'Username must be at most 50 characters',
      usernameRegex: 'Username may only contain letters, numbers, _, ., or -',
      passwordRequired: 'Please enter a password',
      passwordMin: 'Password must be at least 6 characters',
      otpLength: 'OTP code must be exactly 6 digits',
      otpDigits: 'OTP code must contain only digits',
    },
    login: {
      title: 'VPN Sign In',
      stepSubtitle: 'Step 1 of 3 · Enter your credentials',
      usernameLabel: 'Username',
      usernamePlaceholder: 'e.g. somchai.k',
      passwordLabel: 'Password',
      showPassword: 'Show',
      hidePassword: 'Hide',
      passwordHint: 'At least 8 characters',
      submit: 'Sign In',
      agentNotInstalled: 'Agent not installed? ',
      downloadAgent: 'Download',
      downloadAgentAlert: 'Download Agent: Please run npm run mock:agent on your machine',
      contactAdmin: 'Contact Admin',
      contactAdminAlert: 'Contact Admin: admin@mangovpn.internal',
      demoAccountsTitle: 'Developer Demo Accounts',
      demoAccountsHint: 'Click to auto-fill test credentials',
    },
    otp: {
      backTitle: 'Back',
      step: 'Step 2 of 3',
      title: 'Verify Identity',
      sentTo: '6-digit code sent to',
      incompleteError: 'Please enter all 6 digits of the OTP',
      expiresInPrefix: 'Code expires in',
      expiresInSuffix: 'min',
      resendOtp: 'Resend Code',
      resendCooldown: 'Resend in {seconds}s',
      submit: 'Verify',
      expiredBack: 'Code expired? Sign in again',
    },
    sidebar: {
      nav: {
        connect: 'Connect',
        history: 'History',
        devices: 'Devices',
        users: 'Users',
        policies: 'Policies',
        audit_logs: 'Audit Logs',
        agent: 'Agent',
      },
      signOut: 'Sign Out',
    },
    pages: {
      historyClientTitle: 'VPN Connection History (VPN Sessions)',
      historyClientSubtitle: 'Review your WireGuard connection timestamps and data transfer',
      historyAdminTitle: 'System History (Sessions & Audit Logs)',
      historyAdminSubtitle: 'Review VPN connection sessions and security audit logs',
      devicesTitle: 'Registered Devices',
      devicesSubtitle: 'Authorized workstations and devices registered in the system',
      usersTitle: 'User Management',
      usersSubtitle: 'Manage user accounts, roles, and 2FA enforcement',
      policiesTitle: 'Zero-Trust Access Policies',
      policiesSubtitle: 'Define least-privilege subnet access rules for each role',
      auditLogsTitle: 'Audit Logs',
      auditLogsSubtitle: 'Information security audit trail and activity history',
      agentTitle: 'Agent Versions & Releases',
      agentSubtitle: 'Download and inspect Mango Windows Agent releases',
    },
    toasts: {
      otpSent: 'OTP verification code sent to {phone}',
      devMockOtp: 'Dev Mock Mode: You can use OTP 123456',
      smsOtpReceived: '💬 [SMS Gateway] Your MANGO VPN OTP is: {otp} (expires in 5 mins)',
      invalidOtpCode: 'Invalid OTP code. Please check your SMS and try again.',
      otpResentSuccess: 'A new OTP code has been sent to your phone.',
      invalidCredentials: 'Invalid username or password (try: admin_user / MangoVPN2026!)',
      loginSuccessWelcome: 'Signed in successfully. Welcome {username} ({role})',
      loginSuccessAs: 'Signed in as {username} ({role})',
      otpFailed: 'OTP verification failed',
      agentNotFound: 'Agent service not found at 127.0.0.1:47821 (please run: npm run mock:agent)',
      vpnConnected: 'WireGuard Tunnel connected!',
      vpnConnectError: 'Failed to connect to VPN',
      vpnDisconnected: 'WireGuard VPN disconnected',
      vpnDisconnectError: 'Could not disconnect cleanly',
      signedOut: 'Signed out successfully',
      ipCopied: 'Copied VPN IP ({ip}) to clipboard',
      ipCopyError: 'Failed to copy IP',
    },
    dashboard: {
      connected: 'Connected',
      disconnected: 'Disconnected',
      darkMode: 'Dark Mode',
      greeting: 'Hello, {username}',
      yourDevice: 'Your Device',
      privateNetwork: 'Private Network',
      disconnect: 'Disconnect',
      connecting: 'Connecting...',
      connectVpn: 'Connect VPN',
      notAssigned: 'Not Assigned',
      copyIpTitle: 'Copy IP',
      duration: 'Duration',
      allowedNetworks: 'Allowed Networks',
      allNetworks: '0.0.0.0/0 (All Networks)',
      accessRestricted: 'Internal Web Portal only (Restricted)',
      accessCorporate: 'Internal Office Subnets (Corporate)',
      accessFull: 'Full Infrastructure Access (Full Access)',
      roleClientLabel: 'CLIENT · RESTRICTED',
      roleStaffLabel: 'STAFF · CORPORATE SUBNET',
      roleAdminLabel: 'ADMIN · FULL INFRASTRUCTURE',
    },
    admin: {
      stats: {
        totalUsers: 'Total Users',
        usersUnit: 'accounts',
        registeredDevices: 'Registered Devices',
        devicesUnit: 'devices',
        zeroTrustRules: 'Zero-Trust Rules',
        policiesUnit: 'policies',
        activeSessions: 'Online Sessions',
        activeUnit: 'Active',
      },
      tabs: {
        devices: 'Devices',
        sessions: 'Sessions',
        logs: 'Audit Logs',
        versions: 'Agent Releases',
        users: 'Users',
        policies: 'Policies',
      },
      managingSystem: 'Managing ({tab})',
      syncSuccess: 'Synced latest {tab} data',
      devices: {
        revokeConfirm: 'Are you sure you want to revoke WireGuard access for "{name}"?',
        revokeSuccess: 'Revoked access for device "{name}"',
        emptySearch: 'No devices matching "{term}"',
        empty: 'No registered devices found',
        colName: 'Device Name',
        colOs: 'OS Info',
        colMac: 'MAC Address',
        colLastSeen: 'Last Seen',
        colAction: 'Action',
        revokeTitle: 'Revoke device access',
        revoking: 'Revoking...',
        revoke: 'Revoke',
      },
      sessions: {
        emptySearch: 'No sessions matching "{term}"',
        empty: 'No connection history found',
        colClientIp: 'Client IP',
        colTraffic: 'Traffic (RX/TX)',
        colDuration: 'Duration',
        colStatus: 'Status',
        active: 'Active',
        closed: 'Closed',
        online: 'Online',
      },
      logs: {
        emptySearch: 'No audit logs matching "{term}"',
        empty: 'No audit logs found',
        colAction: 'Action',
        colIp: 'IP Address',
        colTimestamp: 'Timestamp',
      },
      versions: {
        emptySearch: 'No versions matching "{term}"',
        empty: 'No agent versions found',
        mandatory: 'Mandatory',
        download: 'Download',
      },
      users: {
        totalCountPrefix: 'Total users:',
        totalCountSuffix: 'accounts',
        addButton: '+ Add User',
        emptySearch: 'No users matching "{term}"',
        empty: 'No users found',
        colUsername: 'Username',
        colRole: 'Role',
        colPhone: 'Phone (MFA)',
        col2fa: '2FA Status',
        colStatus: 'Status',
        enforcedSms: 'Enforced (SMS)',
        activeStatus: '● Active',
        suspendedStatus: '● Suspended',
        usernameRequiredAlert: 'Please enter a username',
        createSuccess: 'User "{username}" created successfully',
      },
      policies: {
        totalCountPrefix: 'Total security rules:',
        totalCountSuffix: 'policies',
        addButton: '+ Add Policy',
        emptySearch: 'No policies matching "{term}"',
        empty: 'No access policies found',
        colRoleTarget: 'Role Target',
        colProtocol: 'Protocol',
        colDestination: 'Destination Subnet',
        colPortRange: 'Port Range',
        colAction: 'Action',
        colManage: 'Manage',
        deleteConfirm: 'Delete network policy for "{cidr}"?',
        deleteSuccess: 'Deleted policy "{cidr}"',
        deleteTitle: 'Delete network policy',
        cidrRequiredAlert: 'Please enter a Destination Subnet (e.g. 10.50.0.0/16)',
        createSuccess: 'Policy for "{cidr}" created successfully',
      },
      addUserModal: {
        title: 'Add New User',
        usernameLabel: 'Username',
        usernamePlaceholder: 'e.g. somchai.k',
        phoneLabel: 'Phone Number (for 2FA OTP)',
        roleLabel: 'Role & Permissions',
        defaultPasswordLabel: 'Default password:',
        saving: 'Saving...',
        save: 'Save User',
      },
      addPolicyModal: {
        title: 'Add Network Security Policy',
        roleLabel: 'Role Target',
        cidrLabel: 'Destination Subnet / CIDR',
        cidrPlaceholder: 'e.g. 10.50.0.0/16 or 192.168.1.100/32',
        protocolLabel: 'Protocol',
        protocolAll: 'ALL (All Protocols)',
        portLabel: 'Port Range',
        portPlaceholder: 'ANY or 80,443',
        actionLabel: 'Action',
        actionAllow: 'ALLOW (Permit access)',
        actionDeny: 'DENY (Block access)',
        saving: 'Saving...',
        save: 'Save Policy',
      },
    },
  },
};

export function formatMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}
