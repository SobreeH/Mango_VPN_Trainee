# MANGO VPN

> ระบบบริหารจัดการ WireGuard VPN ระยะไกลบนสถาปัตยกรรม Zero-Trust ตามบทบาทผู้ใช้งาน (Role-Based Access Control)

[English](README.md) | [ภาษาไทย](README.th.md)

MANGO VPN ออกแบบมาเพื่อขจัดความยุ่งยากในการตั้งค่าไฟล์คอนฟิก `.conf` ของ WireGuard สำหรับผู้ใช้ในองค์กร โดยใช้เว็บพอร์ทัลส่วนกลาง (Web Portal), RESTful API สำหรับควบคุมการทำงาน (Control Plane), และ Windows Service Agent ที่ทำงานเบื้องหลังเพื่อจัดการคีย์ Curve25519 ภายในเครื่อง และสื่อสารผ่านโปรโตคอล Chromium Private Network Access (PNA) อย่างปลอดภัย

---

## 📚 สารบัญคู่มือและเอกสาร

- **[🚀 คู่มือเริ่มต้นด่วน & ตรวจสอบความพร้อมของเครื่องมือ (QUICKSTART.th.md)](file:///e:/Trainee/Mango_VPN_Trainee/QUICKSTART.th.md)**: รายการโปรแกรมที่ต้องติดตั้ง, สคริปต์ตรวจสอบอัตโนมัติ และการจัดสรรพอร์ต
- **[🌧️ คู่มือการพัฒนาสำหรับ Rain (Junior Dev)](file:///e:/Trainee/Mango_VPN_Trainee/Rain/README.th.md)**: การพัฒนาหน้าเว็บ Portal UI และระบบ Admin CRUD
- **[⚡ คู่มือการพัฒนาสำหรับ Sobree (Senior Dev)](file:///e:/Trainee/Mango_VPN_Trainee/Sobree/README.th.md)**: การพัฒนาระบบ Management API, Go Windows Service และ Linux VPN Daemon

---

## 1. โครงสร้าง Monorepo: การแบ่งโฟลเดอร์ `Rain` และ `Sobree`

เพื่อป้องกันปัญหา Git Merge Conflicts และแบ่งขอบเขตงานอย่างชัดเจน โค้ดทั้งหมดจึงถูกแบ่งออกเป็น 2 โฟลเดอร์หลักตามผู้รับผิดชอบ:

```text
mango-vpn/
├── Rain/                          # 🌧️ [พื้นที่ทำงานของ Junior Developer: Rain]
│   ├── portal/                    # หน้าเว็บ Portal (React 19 + Vite + Tailwind CSS Dark UI)
│   │   ├── src/App.tsx            # ดีไซน์ Dark UI, ไฟสถานะ, โมดอล 2FA OTP, ปุ่มเขียว VPN CONNECT
│   │   ├── package.json           # (@mango/portal)
│   │   └── Dockerfile
│   └── admin/                     # ระบบ Admin CRUD และสคริปต์ Seed ฐานข้อมูล
│       ├── src/admin.service.ts   # ดึงข้อมูล Devices, Sessions, AuditLogs, AgentVersions
│       ├── src/admin.routes.ts    # กำหนด Endpoint ฝั่ง Fastify
│       ├── src/seed.ts            # สคริปต์สร้างข้อมูลจำลอง (admin_user, staff_user, client_user)
│       └── package.json           # (@mango/rain-admin)
│
├── Sobree/                        # ⚡ [พื้นที่ทำงานของ Senior Developer: Sobree]
│   ├── api/                       # ระบบ Control Plane Management API (Fastify)
│   │   ├── prisma/schema.prisma   # สกีมาฐานข้อมูล 8 ตารางหลัก
│   │   ├── src/modules/auth/      # ระบบล็อกอิน, OTP MFA 6 หลัก, JWT
│   │   ├── src/modules/vpn/       # ระบบจัดสรร IP (IPAM 10.13.13.0/24), จับคู่ WireGuard Peer
│   │   ├── src/server.ts          # จุดเริ่มต้น Fastify (ดึง Route ฝั่ง admin ของ Rain มาทำงานอัตโนมัติ)
│   │   └── package.json           # (@mango/api)
│   ├── agent-windows/             # เซอร์วิสบน Windows พัฒนาด้วย Go (.exe, LocalSystem)
│   │   ├── main.go                # สร้างคีย์ Curve25519, HTTP Listener (127.0.0.1:47821) รองรับ PNA
│   │   └── go.mod
│   └── vpn-daemon/                # ดิมอนฝั่งเซิร์ฟเวอร์เกตเวย์ Linux WireGuard + nftables
│       ├── main.go                # คำสั่ง 'wg set' ไดนามิก และสร้างกฎไฟร์วอลล์แยกตาม Role
│       └── go.mod
│
├── packages/
│   └── shared/                    # 🤝 [สัญญาข้อมูลและ DTOs ส่วนกลาง]
│       └── src/contracts.ts       # TypeScript Interfaces ทั้งหมด (Login, OTP, VPN, Agent)
│
├── scripts/
│   ├── mock-agent.js              # 🧪 โปรแกรมจำลอง Agent บน 127.0.0.1:47821 รองรับ PNA CORS
│   └── check-environment.ps1      # 🔍 สคริปต์ตรวจสอบความพร้อมของเครื่องมืออัตโนมัติ
├── docker-compose.yml             # คอนเทนเนอร์ Postgres 16, WireGuard Gateway, API, Portal
├── package.json                   # การตั้งค่า Workspaces หลัก
├── pnpm-workspace.yaml            # การกำหนด Workspace สำหรับ pnpm
└── tsconfig.base.json             # คอนฟิกหลักของ TypeScript Compiler
```

---

## 2. การแบ่งหน้าที่และความรับผิดชอบในทีม

| ส่วนงาน | Rain (Junior) 🌧️ | Sobree (Senior) ⚡ |
| :--- | :--- | :--- |
| **โฟลเดอร์ที่ทำงาน** | ทำงานเฉพาะในโฟลเดอร์ `Rain/` | ทำงานในโฟลเดอร์ `Sobree/` |
| **หน้าเว็บ Frontend** | `Rain/portal` (ดูแล 100%) | ช่วยรีวิวเชิงสถาปัตยกรรม |
| **Admin CRUD** | `Rain/admin` (`/devices`, `/sessions`, `/audit-logs`, `/agent-versions`) | เชื่อมต่อ Route เข้ากับ `server.ts` |
| **การใส่ข้อมูลเริ่มต้น (Seed)** | `Rain/admin/src/seed.ts` | ออกแบบ Schema โครงสร้างตาราง |
| **แกนหลัก Backend API** | เรียกใช้งาน Auth และ VPN APIs | `Sobree/api` (Prisma schema, Auth MFA, VPN IPAM) |
| **Windows Client Agent** | ใช้ `mock-agent.js` ทดสอบ UI ได้ทันที | `Sobree/agent-windows` (Go Windows service) |
| **VPN Gateway** | ไม่จำเป็นต้องแตะ | `Sobree/vpn-daemon` (Linux `wg0` + `nftables`) |
| **API Contracts** | เรียกใช้งานจาก `@mango/shared` | ออกแบบโครงสร้างใน `@mango/shared` |

---

## 3. ขั้นตอนการเชื่อมต่อ VPN (5 ขั้นตอน)

1. **ขั้นตอนที่ 1 — เข้าสู่ระบบ (Login):** ผู้ใช้กรอก Username และ Password บน Portal (`POST /api/auth/login`)
2. **ขั้นตอนที่ 2 — สร้างคำขอ MFA:** API ตรวจสอบรหัสผ่าน สร้าง OTP 6 หลัก และส่งรหัสกลับมาพร้อมเบอร์โทรที่ถูกเซนเซอร์ไว้ (`+1555****567`)
3. **ขั้นตอนที่ 3 — ยืนยันรหัส OTP:** ผู้ใช้กรอก OTP 6 หลัก (`POST /api/auth/verify-otp`)
4. **ขั้นตอนที่ 4 — ออกโทเคน JWT:** ระบบตรวจสอบความถูกต้อง ออก `accessToken` (อายุ 1 ชม.) และ `refreshToken` (อายุ 7 วัน)
5. **ขั้นตอนที่ 5 — เชื่อมต่อ VPN (VPN Connect):**
   - หน้าเว็บตรวจสอบสถานะ Agent ในเครื่องผ่าน `GET http://127.0.0.1:47821/health` (ผ่าน Chromium PNA)
   - ผู้ใช้กดปุ่มสีเขียว **VPN CONNECT**
   - เบราว์เซอร์ส่งคำสั่ง `POST http://127.0.0.1:47821/connect` พร้อมส่ง `accessToken` ไปยัง Agent ภายในเครื่อง
   - Agent สร้างคีย์คู่ Curve25519 ส่ง Public Key ไปลงทะเบียนกับ Backend `POST /api/vpn/connect`
   - Backend จัดสรร IP จาก `10.13.13.0/24`, นำ Peer เข้า WireGuard (`wg set`), สร้างกฎไฟร์วอลล์ใน `nftables` ตาม Role และส่งคอนฟิกกลับมา
   - Agent เริ่มต้นเปิดการเชื่อมต่อ WireGuard
   - หน้าเว็บ Portal อัปเดตสถานะเป็น **Connected** และแสดง IP ที่ได้รับแบบเรียลไทม์

---

## 4. คำสั่งหลักในการพัฒนา (Monorepo Scripts)

| คำสั่ง | คำอธิบายการทำงาน |
| :--- | :--- |
| `npm run dev:portal` | เริ่มรันหน้าเว็บ React + Vite ของ Rain ที่ `http://localhost:3000` |
| `npm run dev:api` | เริ่มรัน Fastify API ของ Sobree ที่ `http://localhost:4000` (ดึง Route ของ Rain มาให้อัตโนมัติ) |
| `npm run mock:agent` | รันโปรแกรมจำลอง Windows Agent บน `http://127.0.0.1:47821` (มี PNA CORS ในตัว) |
| `npm run check:env` | ตรวจสอบความพร้อมของโปรแกรมและเครื่องมือทั้งหมดในเครื่อง |
| `npm run db:generate` | สร้าง Prisma Client จากไฟล์สกีมา `Sobree/api/prisma/schema.prisma` |
| `npm run db:seed` | สั่งรันสคริปต์เพิ่มข้อมูลทดสอบของ Rain (`Rain/admin/src/seed.ts`) |
| `npm run build` | คอมไพล์โค้ดทุกส่วนในระบบเพื่อเช็ค Type error (`shared`, `rain-admin`, `api`, `portal`) |
| `npm run docker:up` | รันคอนเทนเนอร์ทั้งหมดผ่าน Docker Compose (`postgres`, `vpn-gateway`, `api`, `portal`) |

