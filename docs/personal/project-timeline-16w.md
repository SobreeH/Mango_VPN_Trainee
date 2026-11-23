# แผนการปฏิบัติงานสหกิจศึกษา 16 สัปดาห์ (Project Timeline) — MANGO VPN

เอกสารนี้จัดทำขึ้นเพื่อใช้ประกอบการกรอกแบบฟอร์ม **[ent_send1.pdf](./ent_send1.pdf)** (แบบแจ้งรายละเอียดการปฏิบัติงานสหกิจศึกษา คณะวิทยาการสื่อสาร มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี) สำหรับระยะเวลา **16 สัปดาห์ (4 เดือน)** ของโครงงาน **MANGO VPN** โดยจัดสรรให้ **เดือนที่ 1 เน้นการวางแผน ศึกษาวิเคราะห์ และออกแบบระบบ** ก่อนเข้าสู่ช่วงพัฒนาและทดสอบในเดือนที่ 2–4

---

## 1. ข้อมูลสำหรับกรอกลงใน `ent_send1.pdf` (พร้อมคัดลอกใช้งาน)

### ส่วนที่ 2.3 รายละเอียดการปฏิบัติงานสหกิจศึกษา (ตารางแผนงาน 16 สัปดาห์)

สามารถคัดลอกหัวข้อในคอลัมน์ **"ลักษณะงานที่ปฏิบัติ"** และทำเครื่องหมาย `✓` (หรือระบายสี) ลงในช่องสัปดาห์ตามตารางด้านล่าง:

| ลักษณะงานที่ปฏิบัติ | เดือน 1 (ส. 1–4) | เดือน 2 (ส. 1–4) | เดือน 3 (ส. 1–4) | เดือน 4 (ส. 1–4) |
| :--- | :---: | :---: | :---: | :---: |
| 1. ปฐมนิเทศ ศึกษาความต้องการของระบบ และวิเคราะห์ขอบเขตโครงงาน | `✓ ✓ - -` | `- - - -` | `- - - -` | `- - - -` |
| 2. ศึกษาเทคโนโลยีหลัก (Zero-Trust, WireGuard, TOTP MFA, Go, React) | `- ✓ ✓ -` | `- - - -` | `- - - -` | `- - - -` |
| 3. วางแผนโครงงาน ออกแบบสถาปัตยกรรมระบบ และโฟลว์ความปลอดภัย | `- - ✓ ✓` | `- - - -` | `- - - -` | `- - - -` |
| 4. ออกแบบฐานข้อมูล (Prisma), API Contracts, UI Wireframe และเตรียมสภาพแวดล้อม | `- - ✓ ✓` | `- - - -` | `- - - -` | `- - - -` |
| 5. พัฒนา Control Plane API (Auth/TOTP MFA/JWT, IPAM, Admin CRUD) | `- - - -` | `✓ ✓ - -` | `- - - -` | `- - - -` |
| 6. พัฒนา VPN Gateway Daemon (Go: WireGuard & nftables Policy) | `- - - -` | `- ✓ ✓ -` | `- - - -` | `- - - -` |
| 7. พัฒนา Local Client Agent (Go: Loopback API, Keygen, Tunnel) และตัวจำลอง | `- - - -` | `- - ✓ ✓` | `- - - -` | `- - - -` |
| 8. พัฒนา Web Portal (React: Login/MFA, Connect UI, Admin Console) | `- - - -` | `- - - -` | `✓ ✓ ✓ -` | `- - - -` |
| 9. เชื่อมต่อระบบตัดสิทธิ์เรียลไทม์ (Revocation), Audit Logs และตรวจความปลอดภัย | `- - - -` | `- - - -` | `- - ✓ ✓` | `✓ - - -` |
| 10. ทดสอบระบบครบวงจร (Docker/E2E/UAT), จัดทำคู่มือ และสรุปรายงานสหกิจฯ | `- - - -` | `- - - -` | `- - - -` | `- ✓ ✓ ✓` |

---

### ส่วนที่ 3 รายงานการปฏิบัติงานสหกิจศึกษา

#### 3.1 หัวข้อโครงงาน (Project Title)
- **ภาษาไทย:** ระบบจัดการเครือข่ายส่วนตัวเสมือนแบบ Zero-Trust และการกำหนดสิทธิ์ตามบทบาทด้วย WireGuard (MANGO VPN)
- **ภาษาอังกฤษ:** MANGO VPN: A Zero-Trust Role-Based WireGuard Remote Access & Policy Management System

#### 3.2 รายละเอียดเนื้อหาของโครงงานพอสังเขป
> โครงงานนี้เป็นการพัฒนาระบบบริหารจัดการการเชื่อมต่อ VPN ระดับองค์กรภายใต้แนวคิด Zero-Trust โดยลดความยุ่งยากในการตั้งค่าไฟล์ `.conf` ด้วยตนเอง ผู้ใช้งานสามารถเข้าสู่ระบบผ่าน Web Portal ด้วยรหัสผ่านและการยืนยันตัวตนสองชั้น (TOTP MFA) จากนั้น Control Plane API จะออก Connect Ticket แบบใช้ครั้งเดียวให้ Local Client Agent สร้างคีย์ Curve25519 ในหน่วยความจำและเชื่อมต่อ WireGuard Tunnel อัตโนมัติ พร้อมด้วย VPN Gateway Daemon บน Linux สำหรับบังคับใช้นโยบายการเข้าถึงตามบทบาท (RBAC) ผ่าน `nftables` และมีหน้าจอผู้ดูแลระบบสำหรับจัดการผู้ใช้ อุปกรณ์ เซสชัน นโยบาย และบันทึกการใช้งาน (Audit Logs)

---

## 2. รายละเอียดแผนการดำเนินงานรายสัปดาห์ (Week 1 – Week 16)

### เดือนที่ 1: การวางแผน ศึกษาวิเคราะห์ และออกแบบระบบ (Planning & Design — Weeks 1–4)
- **สัปดาห์ที่ 1 — ปฐมนิเทศและวิเคราะห์ความต้องการ (Onboarding & Requirement Analysis)**
  - ปฐมนิเทศ ทำความเข้าใจกระบวนการทำงานของทีม แนวทาง Git Workflow และขอบเขตโครงงาน MANGO VPN
  - เก็บรวบรวมความต้องการ (Functional & Non-Functional Requirements) และวิเคราะห์ปัญหาการใช้ไฟล์ `.conf` แบบเดิม
- **สัปดาห์ที่ 2 — ศึกษาเทคโนโลยีและจัดทำแผนโครงงาน (Technology Research & Project Plan)**
  - ศึกษาสถาปัตยกรรม Zero-Trust, โปรโตคอล WireGuard, ไฟร์วอลล์ `nftables`, การยืนยันตัวตนแบบ TOTP MFA และเครื่องมือหลัก (Fastify, Prisma, React, Go)
  - จัดทำแผนการดำเนินงานและกำหนดเป้าหมายรายสัปดาห์ พร้อม **ส่งแบบแจ้งรายละเอียดการปฏิบัติงานสหกิจศึกษา (`ent_send1.pdf`) ภายในสัปดาห์ที่ 2**
- **สัปดาห์ที่ 3 — ออกแบบสถาปัตยกรรมและโฟลว์ความปลอดภัย (System Architecture & Security Flow)**
  - ออกแบบโครงสร้าง Monorepo (`Rain/`, `Sobree/`, `packages/shared/`) และการแบ่งหน้าที่ระหว่าง Web Portal, Control Plane API, Client Agent และ VPN Gateway Daemon
  - ออกแบบ Connection Lifecycle (Login → TOTP MFA → Rotating JWT → One-Time Connect Ticket → Loopback Agent → WireGuard/nftables) และ Threat Model เบื้องต้น
- **สัปดาห์ที่ 4 — ออกแบบฐานข้อมูล สัญญาข้อมูล UI และเตรียมสภาพแวดล้อม (Schema, Contracts, UI & Env Setup)**
  - ออกแบบ ER Diagram / Prisma Schema (`User`, `Device`, `Session`, `Policy`, `AuditLog`, `ConnectTicket`)
  - กำหนดสเปกสัญญาข้อมูลกลาง (`@mango/shared/src/contracts.ts`) และออกแบบ UI Wireframe สำหรับแต่ละบทบาท (`ADMIN`, `STAFF`, `CLIENT`)
  - ติดตั้งและตรวจสอบสภาพแวดล้อมการพัฒนา (Node.js, Go, PostgreSQL 16 / Embedded DB, Docker) เพื่อเตรียมพร้อมเริ่มพัฒนาในเดือนที่ 2

---

### เดือนที่ 2: การพัฒนา Control Plane API, Gateway Daemon และ Client Agent (Weeks 5–8)
- **สัปดาห์ที่ 5 — พัฒนาฐานข้อมูลและระบบยืนยันตัวตน (`@mango/shared`, `@mango/api`)**
  - สร้างโครงสร้างโปรเจกต์ตามแผน, รัน Prisma Migration & Seed ข้อมูลเริ่มต้น
  - พัฒนา Control Plane API พื้นฐาน, ระบบ Validate `.env`, ระบบ Login ด้วยรหัสผ่าน (`bcryptjs`), TOTP MFA และการหมุนเวียน JWT/Refresh Token พร้อม RBAC Middleware
- **สัปดาห์ที่ 6 — พัฒนา VPN IPAM, Connect Ticket และ Admin CRUD (`@mango/api`, `@mango/rain-admin`)**
  - พัฒนาระบบจัดสรร IP อัตโนมัติ (`10.13.13.0/24`), การออก One-Time Connect Ticket และ Endpoint `/connect`, `/disconnect`
  - พัฒนาปลั๊กอิน `@mango/rain-admin` สำหรับจัดการ Users, Devices, Sessions, Policies และ Agent Versions
- **สัปดาห์ที่ 7 — พัฒนา Linux VPN Gateway Daemon (`Sobree/vpn-daemon`)**
  - พัฒนา Go Daemon รับคำสั่ง HTTP แบบ Bearer-authenticated (`:50051`)
  - เชื่อมต่อคำสั่ง `wg set` สำหรับเพิ่ม/ลบ Peer และ `nft` (`nftables`) สำหรับบังคับใช้นโยบาย `ALLOW`/`DENY` ตามบทบาท
- **สัปดาห์ที่ 8 — พัฒนา Local Client Agent (`Sobree/agent-windows`) และตัวจำลอง**
  - พัฒนา Go Service บน Loopback `127.0.0.1:47821` รองรับ Chromium Private Network Access (PNA), Origin Allowlist, การสร้างคีย์ Curve25519 ในหน่วยความจำ และเปิด WireGuard Tunnel (`wireguard.exe` / `wg-quick`)
  - อัปเดตตัวจำลองสำหรับพัฒนา (`scripts/mock-agent.js`, `scripts/mock-daemon.js`) และทดสอบเชื่อมต่อระหว่าง API, Daemon และ Agent

---

### เดือนที่ 3: การพัฒนา Web Portal, ระบบผู้ดูแล และการเชื่อมโยงแบบเรียลไทม์ (Weeks 9–12)
- **สัปดาห์ที่ 9 — พัฒนา Web Portal หน้า Login & TOTP MFA (`@mango/portal`)**
  - พัฒนาหน้าจอเข้าสู่ระบบและการลงทะเบียน/ยืนยันรหัส TOTP MFA ด้วย React 18, Vite, Tailwind CSS และ Zod
- **สัปดาห์ที่ 10 — พัฒนา Role-Based Dashboard และหน้าจอเชื่อมต่อ VPN**
  - พัฒนา Dashboard แยกตามสิทธิ์ (`ADMIN`, `STAFF`, `CLIENT`)
  - พัฒนา `AgentStatusCard` และปุ่ม Connect/Disconnect ที่สื่อสารกับ Local Client Agent โดยไม่ต้องจัดการไฟล์ `.conf`
- **สัปดาห์ที่ 11 — พัฒนา Admin Management Console**
  - พัฒนาแท็บจัดการ Users, Devices, Active/Historical Sessions, Zero-Trust Policies, Audit Logs และ Agent Versions เชื่อมต่อ API จริงผ่าน TanStack Query
- **สัปดาห์ที่ 12 — เชื่อมต่อระบบตัดสิทธิ์เรียลไทม์ (Revocation) และ Audit Logging**
  - เชื่อมต่อคำสั่งเพิกถอนอุปกรณ์ (`revoke`) และตัดการเชื่อมต่อ (`disconnect`) ให้สั่งลบ Peer ออกจาก VPN Daemon ทันที
  - ตรวจสอบความครบถ้วนของ Audit Logs ในทุกกิจกรรมสำคัญของผู้ดูแลระบบ

---

### เดือนที่ 4: ความปลอดภัย การทดสอบครบวงจร Deployment และสรุปรายงาน (Weeks 13–16)
- **สัปดาห์ที่ 13 — ตรวจสอบและยกระดับความปลอดภัย (Security Hardening & Guardrails)**
  - ตรวจสอบ Rate-limiting, CORS, Origin Allowlist, RBAC และความถูกต้องของ Validation
  - รันสคริปต์ตรวจสอบความปลอดภัย (`scripts/check-guardrails.mjs`) และแก้ไขจุดบกพร่องที่พบ
- **สัปดาห์ที่ 14 — ทดสอบการติดตั้งผ่าน Docker และ Integration Testing**
  - ทดสอบรันระบบเต็มรูปแบบผ่าน Docker Compose (`postgres`, `vpn-gateway`, `api`, `portal`)
  - รัน `npm run build`, `go vet ./...`, `go build ./...` และแก้ไขบั๊กจากการทำงานร่วมกันทุกส่วน
- **สัปดาห์ที่ 15 — User Acceptance Testing (UAT) และจัดทำเอกสาร**
  - ทดสอบการใช้งานจริงตามสถานการณ์ (End-to-End Missions) ทั้งฝั่งผู้ใช้ทั่วไปและผู้ดูแลระบบ
  - ปรับปรุงคู่มือติดตั้งและใช้งาน (`README.md`, `QUICKSTART.md`, `TUTORIAL.md`) ให้สมบูรณ์
- **สัปดาห์ที่ 16 — ส่งมอบงาน นำเสนอ และส่งรายงานสหกิจศึกษา**
  - ตรวจสอบความเสถียรขั้นสุดท้ายและส่งมอบงานให้ทีม/สถานประกอบการ
  - จัดทำรูปเล่มรายงานสหกิจศึกษาฉบับสมบูรณ์และนำเสนอผลการปฏิบัติงานต่ออาจารย์ที่ปรึกษา
