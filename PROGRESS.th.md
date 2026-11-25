# MANGO VPN v2 — รายงานความคืบหน้าโครงการและรายการงานที่ต้องทำต่อ

> **ตรวจสอบล่าสุด**: 2026-11-20  
> **สาขาที่ทำงาน (Active Branch)**: `fix/sobree-dev-test-audit-readiness` (แตกแขนงจาก `origin/main` หลังจาก PR #17)  
> **Epic หลักที่ติดตาม**: GitHub Issue `#5` (`MANGO VPN v2: Complete Zero-Trust WireGuard Rebuild`) — ปิด Ticket `#6`–`#13` แล้ว; ติดตามงาน Hardening และ Rollout ต่อใน `#19`, `#20`, `#21`

---

## 1. ภาพรวมสถานะโครงการ (Project Status Overview)

MANGO VPN v2 (`0.2.0`) คือ **ระบบ Zero-Trust Remote Access และบริหารจัดการนโยบายความปลอดภัยบน WireGuard แบบแบ่งตามบทบาท (RBAC)**  
ตั๋วพัฒนาระบบทั้ง 8 รายการ (`#6`–`#13`) ภายใต้ Epic `#5` เสร็จสมบูรณ์และถูก Merge เข้าสู่ `main` ทั้งหมดแล้ว พร้อมทั้งผ่านการ Audit ความพร้อมในการทดสอบและพัฒนาบนเครื่อง (`fix/sobree-dev-test-audit-readiness`) ซึ่งแก้ไขปัญหา Blocker บน Docker, CI, การโหลดค่า Environment และ Portal UI เรียบร้อยแล้ว

โครงสร้างโปรเจกต์ Monorepo ทั้งหมดสามารถ Build ได้อย่างสมบูรณ์แบบ, ผ่านการทดสอบ Vitest ครบทั้ง 70 ชุด (ทั้งบนฐานข้อมูลทดสอบ `mangovpn_v2_test` และฐานข้อมูลหลัก `mangovpn`), ผ่านการทดสอบ Go Unit Test ทั้ง 17 ชุดบน `Sobree/agent-windows` และ `Sobree/vpn-daemon`, และสามารถรันแบบ End-to-End ผ่านคอนเทนเนอร์ของ Docker Compose ทั้ง 4 ตัวได้อย่างสมบูรณ์ (`postgres`, `vpn-gateway`, `api`, `portal`)

### ตารางสรุปผลการตรวจสอบอัตโนมัติ (Automated Verification Snapshot - 2026-11-20)

| รายการตรวจสอบ | คำสั่งที่ใช้ | ขอบเขต / เป้าหมาย | ผลลัพธ์ |
| :--- | :--- | :--- | :--- |
| ความปลอดภัย & กฎป้องกัน Mock (Anti-Mock Guardrails) | `node scripts/check-guardrails.mjs` | `Rain/`, `Sobree/`, `packages/`, `docker-compose.yml` | ✅ **ผ่าน (PASS)** (ไม่พบข้อผิดพลาด `0` violations) |
| TypeScript Monorepo Build | `npm run build` | `@mango/shared`, `@mango/rain-admin`, `@mango/portal`, `@mango/api` | ✅ **ผ่าน (PASS)** (ครบทั้ง `4/4` workspaces) |
| Monorepo Test Suite (ฐานข้อมูลทดสอบ) | `npm test` | `DATABASE_URL=.../mangovpn_v2_test` | ✅ **ผ่าน (PASS)** (ครบ `70/70` tests: admin `3`, portal `27`, api `40`) |
| Monorepo Test Suite (ฐานข้อมูลในเครื่อง) | `npm test` | `DATABASE_URL=.../mangovpn` | ✅ **ผ่าน (PASS)** (ครบ `70/70` tests: admin `3`, portal `27`, api `40`) |
| ตรวจสอบ Go บน Windows Agent | `cd Sobree/agent-windows && go vet ./... && go test -v ./... && go build ./...` | `github.com/mango-vpn/agent-windows` | ✅ **ผ่าน (PASS)** (`8/8` tests) |
| ตรวจสอบ Go บน VPN Daemon | `cd Sobree/vpn-daemon && go vet ./... && go test -v ./... && go build ./...` | `github.com/mango-vpn/vpn-daemon` | ✅ **ผ่าน (PASS)** (`9/9` tests) |
| รัน Full Stack บน Docker Compose | `docker compose up -d --build && docker compose ps` | `mango-postgres`, `mango-vpn-gateway`, `mango-api`, `mango-portal` | ✅ **ผ่าน (PASS)** (คอนเทนเนอร์สถานะ `healthy` ครบทั้ง `4/4` ตัว; ยืนยันผลทดสอบ HTTP + Auth แล้ว) |

---

## 2. ไมล์สโตนที่เสร็จสิ้นแล้ว (Epic #5 — ตั๋ว #6 ถึง #13)

| Issue | หัวข้อ | สถานะ | ไฟล์ / แพ็กเกจหลัก | ขอบเขตงานที่ส่งมอบแล้ว |
| :--- | :--- | :--- | :--- | :--- |
| **#5** | MANGO VPN v2: รื้อสร้างสถาปัตยกรรม Zero-Trust WireGuard ใหม่ทั้งหมด | ✅ เสร็จสิ้น & ปิดแล้ว | ทั่วทั้ง Monorepo | สถาปัตยกรรม Zero-Trust v2 เต็มรูปแบบ แทนที่โค้ดจำลอง (Mock), ฟังก์ชันดัมมี่ (Stub) และรหัสผ่าน Hardcoded จากเวอร์ชันเดิม (v1) |
| **#6** | 1. สร้างกิ่งใหม่ ล้างพื้นที่ทำงาน และวางโครงร่าง Monorepo เริ่มต้น | ✅ เสร็จสิ้น & รวมเข้า main แล้ว | `packages/shared/src/contracts.ts`, `Sobree/api/prisma/schema.prisma`, `scripts/check-guardrails.mjs` | สัญญา API และ DTO กลาง (`@mango/shared`), Prisma Schema สำหรับ PostgreSQL (11 Models), และระบบสคริปต์ตรวจจับ Secret / Mock อัตโนมัติ |
| **#7** | 2. ล็อกอินด้วยรหัสผ่าน, ลงทะเบียน/ยืนยัน 2FA (TOTP) และระบบ JWT Session แบบหมุนเวียน | ✅ เสร็จสิ้น & รวมเข้า main แล้ว | `Sobree/api/src/modules/auth/`, `Sobree/api/src/config.ts`, `Sobree/api/src/middleware/auth.ts` | ล็อกอินด้วยรหัสผ่าน, ลงทะเบียน/ยืนยัน TOTP ด้วยการเข้ารหัส AES-256-GCM (`totp.ts`), HS256 JWT พร้อม Refresh Token แบบหมุนเวียนและระบบยกเลิกสิทธิ์เมื่อพบการใช้ซ้ำ (Family Revocation), Rate Limiting ผ่านฐานข้อมูล, และการตรวจสอบความถูกต้องของ `.env` ตั้งแต่เริ่มทำงาน |
| **#8** | 3. ระบบความปลอดภัย Loopback ของ Windows Agent, Connect Ticket แบบใช้ครั้งเดียว และอัปเดต Mock Agent | ✅ เสร็จสิ้น & รวมเข้า main แล้ว | `Sobree/api/src/modules/vpn/vpn.routes.ts`, `Sobree/agent-windows/main.go`, `scripts/mock-agent.js` | Connect Ticket แบบใช้ครั้งเดียว อายุ 60 วินาที (`POST /api/vpn/ticket`), Local Loopback API บน Windows Agent (`127.0.0.1:47821`) พร้อมจำกัด Origin, รองรับส่วนหัว Chromium PNA, ตรวจสอบ `X-Mango-Agent-Token`, และปรับปรุง `mock-agent.js` ให้ตรงกัน |
| **#9** | 4. ระบบเชื่อมต่อและตัดการเชื่อมต่อ VPN แบบ End-to-end (แลกตั๋ว, จัดสรร IP, ตั้งค่า WireGuard, อัปเดตสถานะหน้าเว็บ) | ✅ เสร็จสิ้น & รวมเข้า main แล้ว | `Sobree/api/src/modules/vpn/vpn.routes.ts`, `Sobree/agent-windows/main.go`, `Rain/portal/src/components/AgentStatusCard.tsx` | แลกรับตั๋วเชื่อมต่อ (`POST /api/vpn/connect`, `POST /api/vpn/disconnect`), สร้างคีย์ Curve25519 บนหน่วยความจำ (In-memory), จัดสรร IP ด้วย PostgreSQL Advisory Lock (`10.13.13.0/24`), ตรวจสอบ Agent Version และลายนิ้วมืออุปกรณ์ (Device Fingerprint), เปิดอุโมงค์ด้วย `wireguard.exe` (`mango0`), และ UI แสดงสถานะหน้าเว็บ |
| **#10** | 5. นโยบาย Zero-Trust ตามบทบาท (ALLOW/DENY, บังคับใช้ผ่าน nftables, ระบบจัดการนโยบายของ Admin) | ✅ เสร็จสิ้น & รวมเข้า main แล้ว | `Sobree/vpn-daemon/main.go`, `Rain/admin/src/policies.ts`, `Rain/portal/src/components/PoliciesTab.tsx` | กฎ `nftables` บนตาราง `inet mango_vpn forward` แบบ Deny-by-default (`ALLOW`/`DENY`), Endpoint จัดการนโยบาย (Admin CRUD), และคำสั่งซิงก์นโยบายลง Gateway ทันที (`POST /policies/sync`) |
| **#11** | 6. ระบบจัดการผู้ใช้, อุปกรณ์, บังคับตัดเซสชันสด และยกเลิกสิทธิ์แบบเรียลไทม์ | ✅ เสร็จสิ้น & รวมเข้า main แล้ว | `Rain/admin/src/users.ts`, `devices.ts`, `sessions.ts`, `revocation.ts` | ฟังก์ชัน Admin CRUD จัดการ Users, Devices และ Sessions โดยจะสั่งปลดการเชื่อมต่อที่ Daemon ก่อน จึงค่อยอัปเดตสถานะในฐานข้อมูล |
| **#12** | 7. บันทึกประวัติการใช้งาน (Audit Logs) และระบบลงทะเบียนเวอร์ชัน Agent | ✅ เสร็จสิ้น & รวมเข้า main แล้ว | `Rain/admin/src/index.ts`, `audit.ts`, `agent-versions.ts`, `Rain/portal/src/components/*Tab.tsx` | ระบบ Audit Logs พร้อมตัวกรองและการแบ่งหน้า, ระบบลงทะเบียนเวอร์ชัน Agent, และแท็บควบคุมของ Admin บนหน้าเว็บทั้ง 6 แท็บ (`UsersTab`, `DevicesTab`, `SessionsTab`, `PoliciesTab`, `AuditLogsTab`, `AgentVersionsTab`) พร้อมการจัดการสถานะข้อมูลว่าง/ผิดพลาดอย่างตรงไปตรงมาโดยไม่มี Mock ซ่อนอยู่ |
| **#13** | 8. ตรวจสอบการติดตั้งและใช้งานจริงด้วย Docker Compose และสภาพแวดล้อม AWS/Windows VM | ✅ เสร็จสิ้น & รวมเข้า main แล้ว | `docker-compose.yml`, `.env.example`, `Sobree/api/Dockerfile`, `Sobree/vpn-daemon/Dockerfile`, `Rain/portal/Dockerfile`, `Rain/portal/docker-entrypoint.sh` | Dockerfile แบบ Multi-stage, การเชื่อมโยง Compose (กำหนดสิทธิ์ `NET_ADMIN` เท่านั้น ไม่ใช้ `SYS_MODULE`), ระบบส่งค่าคอนฟิกไปหน้าบ้านตอนรันไทม์ (`window.__MANGO_ENV__`), และการแยก Profile ใน `.env.example` ระหว่างใช้งานในเครื่องกับบน AWS |

---

## 3. ตารางความพร้อมของแต่ละคอมโพเนนต์ (Component Readiness Matrix)

| คอมโพเนนต์ | ที่อยู่โฟลเดอร์ | สถานะ Build / Test | ความพร้อมในการรันและ Deploy |
| :--- | :--- | :--- | :--- |
| **สัญญาและไทป์กลาง (Shared Contracts)** | `packages/shared` (`@mango/shared`) | ✅ คอมไพล์ผ่าน (`tsc`) | พร้อมใช้งาน (เสร็จสิ้น DTO `DeletePolicyResponse` และการเข้ารหัส ID แบบ URL-encoded) |
| **Control Plane API** | `Sobree/api` (`@mango/api`) | ✅ คอมไพล์ผ่าน & ผ่านการทดสอบ `40/40` ข้อ (เทียบกับ `mangovpn` และ `mangovpn_v2_test`) | โหลด root `.env` อัตโนมัติ, เคลียร์คีย์อุปกรณ์เก่าเมื่อเชื่อมต่อใหม่; รอ Hardening ระบบ Auth ใน Issue `#19` |
| **ปลั๊กอิน Admin CRUD** | `Rain/admin` (`@mango/rain-admin`) | ✅ คอมไพล์ผ่าน & ผ่านการทดสอบ Seed `3/3` ข้อ | ติดตั้งเข้ากับ `/api` ใน `Sobree/api/src/app.ts` เรียบร้อย; ไฟล์ `seed.ts` โหลด root `.env` อัตโนมัติ |
| **Web Portal UI** | `Rain/portal` (`@mango/portal`) | ✅ คอมไพล์ผ่าน (`tsc && vite build`) & ผ่านการทดสอบ `27/27` ข้อ | พร้อมใช้งาน (เพิ่ม `nginx.conf`, ตั้งค่า line ending แบบ LF บน `docker-entrypoint.sh`, ล็อกพอร์ต `:3000`, แก้ไขการแสดงผล Error/Empty state และแก้ปัญหา `priority: 0`) |
| **Windows Agent** | `Sobree/agent-windows` | ✅ ผ่าน `go vet` & ผ่านการทดสอบ `8/8` ข้อ (Go `1.26.0`) | รองรับตัวแปร `AGENT_*` และ `MANGO_AGENT_*`; การทดสอบเปิดอุโมงค์จริงด้วย `wireguard.exe` ติดตามใน Issue `#21` |
| **Linux VPN Daemon** | `Sobree/vpn-daemon` | ✅ ผ่าน `go vet` & ผ่านการทดสอบ `9/9` ข้อ (Go `1.22`) | บรรจุเป็นคอนเทนเนอร์เรียบร้อย (`mango-vpn-gateway` สถานะ healthy รองรับ `wg0` + `nftables`); รอปรับปรุง Concurrency ใน Issue `#20` |
| **โปรแกรมจำลอง Agent (Loopback)** | `scripts/mock-agent.js` | ✅ ผ่าน Guardrail; ซิงก์ตรงกับสัญญา v2 Agent | พร้อมใช้ทดสอบหน้าบ้านในเครื่อง (`npm run mock:agent`) |
| **Docker & ระบบ CI** | `docker-compose.yml`, `.github/workflows/ci.yml` | ✅ คอนเทนเนอร์ Compose ทั้ง 4 ตัวทำงานปกติ (Healthy); CI ตั้งค่า Go `1.26`, `prisma migrate deploy`, และ `windows-agent-tests` แล้ว | เปิดพอร์ต Loopback `127.0.0.1:50051` สำหรับการพัฒนา API บนเครื่องโฮสต์ |

---

## 4. สิ่งที่ต้องทำต่อไป (Action Items)

### ลำดับความสำคัญสูง — ความพร้อมในการพัฒนา / ทดสอบ / CI (แก้ไขเสร็จสิ้นแล้ว)

- [x] **1. เพิ่ม `Rain/portal/nginx.conf` และแก้ไข Line Ending ใน `docker-entrypoint.sh` (ปลดบล็อก Docker)**
  - เพิ่มไฟล์ [`Rain/portal/nginx.conf`](Rain/portal/nginx.conf) รับการเชื่อมต่อที่พอร์ต `:3000` พร้อมกำหนด SPA Fallback (`try_files $uri $uri/ /index.html;`) และตั้งค่า `Cache-Control: no-store` ให้กับไฟล์ `/env-config.js`
  - แปลงรหัสขึ้นบรรทัดใหม่ของ [`Rain/portal/docker-entrypoint.sh`](Rain/portal/docker-entrypoint.sh) จาก CRLF เป็น LF และกำหนดค่าไว้ใน [`.gitattributes`](.gitattributes) (`*.sh text eol=lf`)

- [x] **2. ปรับเวอร์ชัน Go, คำสั่ง Prisma Deploy และการทดสอบบน Windows ใน `.github/workflows/ci.yml`**
  - ปรับค่า `go-version` จาก `'1.23'` เป็น `'1.26'`, เพิ่มคำสั่ง `npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma` ก่อนรัน `npm test`, และเพิ่ม Job `windows-agent-tests` บนสภาพแวดล้อม `windows-latest`

- [x] **3. จัดเตรียม `.env` ในเครื่อง, เพิ่มระบบโหลด root `.env` อัตโนมัติ และรีเซ็ตฐานข้อมูล `mangovpn` สู่เวอร์ชัน v2**
  - สร้างไฟล์ root `.env` (อยู่นอก Git) พร้อมคีย์ความปลอดภัยและการเข้ารหัส Curve25519, สั่งรีเซ็ตโครงสร้างฐานข้อมูล `mangovpn` ให้ตรงตาม Migration v2 และรัน Seed บัญชี `admin`
  - ปรับปรุง [`Sobree/api/src/server.ts`](Sobree/api/src/server.ts) และ [`Rain/admin/src/seed.ts`](Rain/admin/src/seed.ts) ให้ค้นหาและโหลดไฟล์ `.env` ที่โฟลเดอร์ Root อัตโนมัติเมื่อสั่งรันผ่านคำสั่งของ Workspace
  - กำหนดพอร์ต `3000` ใน [`Rain/portal/vite.config.ts`](Rain/portal/vite.config.ts), แก้ไขข้อผิดพลาดการแสดงผล Empty state เมื่อมี Error ใน 5 แท็บของ Admin และการแปลงค่า `priority: 0` ใน [`PoliciesTab.tsx`](Rain/portal/src/components/PoliciesTab.tsx), ปรับชื่อตัวแปรสภาพแวดล้อมใน `Sobree/agent-windows/main.go` / `scripts/mock-agent.js` / `.env.example` ให้ตรงกัน และเคลียร์คีย์ชั่วคราวเก่าเมื่อมีการเชื่อมต่อใหม่ใน `Sobree/api/src/modules/vpn/vpn.routes.ts`

- [x] **4. รันและทดสอบคอนเทนเนอร์ Docker Compose ทั้ง 4 ตัวแบบ End-to-end**
  - ผูกพอร์ต `127.0.0.1:${DAEMON_PORT:-50051}:50051` สำหรับ `vpn-gateway` ในไฟล์ [`docker-compose.yml`](docker-compose.yml) เพื่อให้คำสั่ง `npm run dev:api` บนเครื่องโฮสต์สามารถเชื่อมต่อกับ Daemon ในคอนเทนเนอร์ได้
  - ตรวจสอบคำสั่ง `docker compose up -d --build` พบสถานะ `healthy` ครบทั้ง 4 เซอร์วิส (`mango-postgres`, `mango-vpn-gateway`, `mango-api`, `mango-portal`) และทดสอบการเรียกใช้งานจริงบน `/health`, `/env-config.js`, `wg show`, `nft list table inet mango_vpn` และ `POST /api/auth/login` ผ่านทั้งหมด

### งานที่รอดำเนินการ — การเพิ่มความปลอดภัยสำหรับ Production และการ Deploy บน Cloud/Windows

- [ ] **5. เสริมความปลอดภัยขั้นสูงสำหรับ Production และการ Deploy บนสภาพแวดล้อมจริง (ติดตามใน GitHub Issues)**
  - **Issue `#19`** (`ready-for-agent`): ตรวจจับการใช้ Refresh Token ซ้ำแบบ Atomic ภายใต้ `prisma.$transaction`, เพิ่มระบบยืนยันตัวตนใน `POST /api/vpn/disconnect`, เชื่อมต่อระบบบันทึก Audit Log เข้ากับ Route ของ Auth (`recordAuthAuditEvent`), และบังคับกำหนดค่า `WG_SERVER_PUBLIC_KEY` เมื่อรันบน Production (ส่วน DTO `DeletePolicyResponse` และ URL-encoded ID เสร็จเรียบร้อยแล้วใน `Rain/` และ `@mango/shared`)
  - **Issue `#20`** (`ready-for-agent`): จัดคิวคำสั่ง `applyNftables` แบบเรียงตามลำดับ (Serialize) ใน `Sobree/vpn-daemon/main.go`, ตรวจสอบความถูกต้องของ `WG_PRIVATE_KEY` ตั้งแต่เริ่มเปิดระบบ, เพิ่ม Go Unit Test ครอบคลุม Concurrency และการ Rollback เมื่อเกิดข้อผิดพลาด, และเพิ่มการเปรียบเทียบ Semantic Version ใน `scripts/check-environment.ps1`
  - **Issue `#21`** (`ready-for-human`): ทดสอบการเปิด/ปิดอุโมงค์ VPN `mango0` จริงด้วย `wireguard.exe` บนเครื่อง Windows จริงที่ได้สิทธิ์ Admin, เตรียมเครื่อง AWS EC2 Linux สำหรับ Profile B พร้อมตั้งค่า TLS Reverse Proxy (พอร์ต `:443` ชี้ไปที่ `:3000`/`:4000`, บล็อกการเข้าถึงพอร์ต `:15432` จากภายนอก), และอัปโหลดไฟล์ติดตั้ง Windows Agent ที่มี Digital Signature เข้าสู่ระบบผ่านแท็บ **Agent Versions** ของ Admin

### ลำดับความสำคัญต่ำ — การดูแลความเรียบร้อยของ Git (Housekeeping)

- [ ] **6. ลบกิ่งเก่าที่ไม่ได้ใช้งานทั้งในเครื่องและบน Remote**
  - ลบกิ่งในเครื่องที่ถูก Merge ไปแล้ว (`chore/post-reset-cleanup`, `docs/v2-walkthrough-and-progress`) และจัดการลบกิ่งเก่าบน Remote ที่ไม่ได้ใช้แล้วหลังปรึกษากับ Rain และ Sobree

---

## 5. สรุปคำสั่งสำหรับตรวจสอบระบบ (Verification Commands Cheat Sheet)

```powershell
# 1. ตรวจสอบความปลอดภัยและกฎป้องกัน Mock
node scripts/check-guardrails.mjs

# 2. Build โครงสร้าง TypeScript Monorepo ทั้งหมด (@mango/shared จะถูก build ก่อนเสมอ)
npm run build

# 3. รัน Unit Test ทั้งหมดของ Monorepo (ต้องมีฐานข้อมูล PostgreSQL ที่ Migrate ตาม Schema v2 แล้ว)
$env:DATABASE_URL="postgresql://mango:mangosecret@localhost:15432/mangovpn_v2_test?schema=public"
npm test
Remove-Item Env:DATABASE_URL

# 4. ตรวจสอบโค้ดโมดูลภาษา Go ทั้งหมด
cd Sobree/agent-windows; go vet ./...; go test ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; cd ../..
```

---

## 6. คู่มือการทดสอบ รัน และ Deploy ระบบภายในเครื่องอย่างละเอียด (Comprehensive Walkthrough)

> **ขอบเขต**: ยืนยันความถูกต้องเทียบกับสาขา `fix/sobree-dev-test-audit-readiness` เมื่อวันที่ 2026-11-20

### บันทึกสถาปัตยกรรมสำคัญที่ผ่านการตรวจสอบแล้ว

- **สตริง Platform ของ Agent คือ `windows-x64`:** ในไฟล์ `Sobree/api/src/modules/vpn/vpn.routes.ts` จะเรียกฟังก์ชัน `assertAgentVersionAllowed(prisma, agentVersion, 'windows-x64')` ดังนั้นเวลาลงทะเบียนเวอร์ชัน Agent บนหน้า Admin จะต้องระบุ `platform: windows-x64` (ห้ามใช้ `windows-amd64`) ไม่เช่นนั้นเงื่อนไขการตรวจสอบเวอร์ชันจะไม่ทำงานเมื่อมีการเชื่อมต่อจริง
- **พฤติกรรมการตรวจสอบเวอร์ชันของ Agent (Version Gate):** `Rain/admin/src/agent-versions.ts` จะปฏิเสธเวอร์ชันที่ไม่ตรงตามมาตรฐาน Semver (`400 AGENT_VERSION_INVALID`), ปฏิเสธเวอร์ชันที่ถูกปิดการใช้งาน (`426 AGENT_VERSION_INACTIVE`), และปฏิเสธเวอร์ชันที่ต่ำกว่าเวอร์ชันบังคับอัปเดตสูงสุด (`426 AGENT_VERSION_OUTDATED`) หากไม่มีการกำหนดเวอร์ชันบังคับสำหรับ Platform นั้น ระบบจะอนุญาตให้ผ่านได้
- **การเชื่อมต่อกับ VPN Daemon:** Endpoint `/api/vpn/connect` จะเรียกใช้ `vpnDaemon.addPeer` ก่อนส่งข้อมูลตอบกลับเสมอ หากล้มเหลวจะบันทึกสถานะเซสชันว่า Disconnected (`502`) ทันที สำหรับการระงับสิทธิ์ (Revoke), ตัดการเชื่อมต่อ (Disconnect) และปิดการใช้งาน จะส่งคำสั่งไปยัง Daemon ก่อนเสมอ หาก Daemon ตอบกลับว่าล้มเหลว ข้อมูลในฐานข้อมูลจะไม่เปลี่ยนแปลง ไฟล์ `docker-compose.yml` จะผูกพอร์ต `127.0.0.1:50051:50051` เพื่อให้ `npm run dev:api` ที่รันบนเครื่องสามารถเรียกไปที่ `http://127.0.0.1:50051` ได้ ในขณะที่ API ในคอนเทนเนอร์จะเรียกไปที่ `http://vpn-gateway:50051`
- **การรัน Seed ข้อมูลต้องทำจากเครื่องโฮสต์ (ห้ามทำในคอนเทนเนอร์ API):** ขั้นตอนการ Build รันไทม์ของ `Sobree/api/Dockerfile` จะคัดลอกเฉพาะโฟลเดอร์ `Rain/admin/dist` เข้าไป ไม่ได้คัดลอก `Rain/admin/src` ดังนั้นให้รันคำสั่ง `npm run db:seed` จากเครื่องโฮสต์ ซึ่งไฟล์ `seed.ts` จะอ่านไฟล์ root `.env` ให้อัตโนมัติ
- **การเปิดพอร์ตใน Docker Compose:** ไฟล์ `docker-compose.yml` จะเปิดพอร์ต `15432` (Postgres), `4000` (API) และ `3000` (Portal) บน Interface ของเครื่องโฮสต์ และเปิด `127.0.0.1:50051` สำหรับ Daemon ทั้งนี้บน Production ต้องบล็อกพอร์ต `15432` ในระดับ Security Group และนำพอร์ต `:3000`/`:4000` ไปวางไว้หลัง TLS Reverse Proxy เสมอ (ตามแผน Issue `#21`)

### แผนผังพอร์ตการทำงาน (Port Map ที่ผ่านการทดสอบแล้ว)

| พอร์ต | คอมโพเนนต์ | พื้นที่การเข้าถึงได้ |
| :--- | :--- | :--- |
| `3000` | Web Portal (`npm run dev:portal` หรือคอนเทนเนอร์ `mango-portal`) | เครื่องโฮสต์ |
| `4000` | Control Plane API (`PORT`/`API_PORT`) | เครื่องโฮสต์ |
| `15432` | PostgreSQL (`POSTGRES_PORT`) แมปเข้ากับพอร์ต `5432` ภายในคอนเทนเนอร์ | เครื่องโฮสต์ |
| `47821` | Windows Agent หรือ `scripts/mock-agent.js` | เฉพาะ `127.0.0.1` (Local Loopback) |
| `51820/udp` | WireGuard VPN Service (`WG_LISTEN_PORT`) | เครื่องโฮสต์และอินเทอร์เน็ต (เมื่อเปิดพอร์ต) |
| `50051` | VPN Gateway Daemon HTTP API | วงเครือข่าย `mango-net` + Loopback ในเครื่อง `127.0.0.1:50051` |

---

### 6.1 สิ่งที่ต้องเตรียม & ความพร้อมของสภาพแวดล้อม (Prerequisites)

1. **ตรวจสอบความพร้อมของเครื่องมือ (`npm run check:env`):**  
   โปรแกรมจะตรวจสอบ `Node.js >= 18`, `npm >= 9`, `Git >= 2.30`, `Docker >= 24`, `Docker Compose >= v2.20` และ `Go` (`1.26.0` สำหรับ `agent-windows`, `1.22` สำหรับ `vpn-daemon`)
2. **ติดตั้ง Dependencies และ Build ระบบเริ่มต้น:**
   ```powershell
   npm install
   npm run build
   ```
3. **สร้างไฟล์ `.env` จากตัวอย่างและตั้งค่าคีย์ความปลอดภัย:**
   ```powershell
   copy .env.example .env
   openssl rand -base64 32   # สุ่มค่าที่ไม่ซ้ำกันสำหรับ JWT_SECRET, REFRESH_SECRET, DAEMON_SHARED_SECRET
   openssl rand -hex 32      # สุ่ม 64 ตัวอักษรฐาน 16 สำหรับ TOTP_ENCRYPTION_KEY
   ```
   กำหนดค่า `POSTGRES_PASSWORD`, `DATABASE_URL` และคู่คีย์ WireGuard (`WG_PRIVATE_KEY` และ `WG_SERVER_PUBLIC_KEY`)

---

### 6.2 การตั้งค่าฐานข้อมูล, Migration และการสร้างข้อมูล Admin (Seed)

1. **เริ่มรัน PostgreSQL:**
   ```powershell
   docker compose up -d postgres
   docker compose ps postgres
   ```
2. **รันคำสั่ง Migration (หรือล้างฐานข้อมูลเดิมของ v1):**
   ```powershell
   npm run db:generate
   npm run db:migrate
   # หากต้องการอัปเกรดและล้าง Schema เก่าของ v1:
   # npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma
   ```
3. **สร้างบทบาท (`ADMIN`, `STAFF`, `CLIENT`) และบัญชี `ADMIN` เริ่มต้น:**
   ```powershell
   $env:SEED_ADMIN_USERNAME="admin"
   $env:SEED_ADMIN_PASSWORD="<รหัสผ่านอย่างน้อย 12 ตัวอักษร>"
   npm run db:seed
   Remove-Item Env:SEED_ADMIN_PASSWORD
   ```

---

### 6.3 การรัน Automated Tests และ Guardrails

```powershell
# 1. ตรวจสอบความปลอดภัยและกฎป้องกัน Mock (ต้องผ่าน 0 violations)
node scripts/check-guardrails.mjs

# 2. Build TypeScript Monorepo เต็มรูปแบบ (@mango/shared จะถูก build ก่อน)
npm run build

# 3. รัน Vitest ครบทุกชุด (70 tests: admin 3, portal 27, api 40)
$env:DATABASE_URL="postgresql://mango:<password>@localhost:15432/mangovpn_v2_test?schema=public"
npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
npm test
Remove-Item Env:DATABASE_URL

# 4. ตรวจสอบโค้ด Go (vet, test และ build)
cd Sobree/agent-windows; go vet ./...; go test ./...; go build ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; cd ../..
```

---

### 6.4 การรันบนเครื่องเพื่อพัฒนา (มี 2 รูปแบบ)

#### รูปแบบที่ A: พัฒนา Portal & Admin ด้วย `mock-agent.js` (สำหรับเรน 🌧️)

*(หากมีคอนเทนเนอร์ Docker `api` หรือ `portal` กำลังรันอยู่และแย่งพอร์ต `3000`/`4000` ให้สั่งหยุดด้วย `docker compose stop api portal` ก่อน)*

1. **Terminal 1 — รันโปรแกรมจำลอง Windows Agent (`127.0.0.1:47821`):**  
   รันคำสั่ง `npm run mock:agent` (คัดลอกค่า `PairingToken` ที่แสดงขึ้นมาไว้ใช้งาน)
2. **Terminal 2 — รัน Control Plane API (`:4000`):**  
   รันคำสั่ง `npm run dev:api` (ระบบจะโหลดไฟล์ `.env` ที่ root ให้อัตโนมัติ; และอาจเปิด `docker compose up -d vpn-gateway` ทิ้งไว้เพื่อให้ทดสอบเรียก `/api/vpn/connect` ไปยัง `127.0.0.1:50051` ได้)
3. **Terminal 3 — รัน Web Portal (`:3000`):**  
   รันคำสั่ง `npm run dev:portal` (ล็อกพอร์ต `:3000` ไว้ใน `Rain/portal/vite.config.ts`)

#### รูปแบบที่ B: พัฒนาระบบเต็มรูปแบบด้วย Go Windows Agent & Linux Gateway (สำหรับโซบรี ⚡)

```powershell
# 1. รันคอนเทนเนอร์ Database และ Gateway (จะเปิดพอร์ต 127.0.0.1:50051 ให้ API บนโฮสต์เรียกใช้)
docker compose up -d postgres vpn-gateway

# 2. รัน Control Plane API บนโฮสต์ (:4000)
npm run dev:api

# 3. รัน Windows Agent (เปิด PowerShell ด้วยสิทธิ์ Administrator และต้องติดตั้ง WireGuard for Windows แล้ว)
cd Sobree/agent-windows
$env:AGENT_LISTEN_ADDR="127.0.0.1:47821"
$env:AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
$env:AGENT_PAIRING_TOKEN="<กำหนดโทเคนสำหรับจับคู่ในเครื่อง>"
$env:API_URL="http://localhost:4000"
go run .
```

---

### 6.5 การรัน Full-Stack ทั้งหมดผ่าน Docker Compose

```powershell
docker compose up -d --build
docker compose ps
```

คอนเทนเนอร์ทั้ง 4 เซอร์วิส (`mango-postgres`, `mango-vpn-gateway`, `mango-api`, `mango-portal`) จะต้องมีสถานะเป็น `healthy` โดยที่ `mango-api` จะรันคำสั่ง `prisma migrate deploy` อัตโนมัติตอนบูต และ `mango-portal` จะสร้างไฟล์ `/usr/share/nginx/html/env-config.js` ตอนเริ่มทำงานผ่านสคริปต์ `40-mango-env.sh` สำหรับการ Seed ข้อมูลให้รันจากเครื่องโฮสต์ด้วยคำสั่ง `npm run db:seed`

---

### 6.6 เช็กลิสต์ก่อนปล่อยสู่ Production บน Cloud (Pre-Release Checklist)

1. **ดำเนินการปรับปรุงความปลอดภัยตามตั๋วคงค้าง (`#19`, `#20`):** เพิ่มการตรวจจับการใช้ Refresh Token ซ้ำ, ตรวจสอบสิทธิ์ในคำสั่งตัดการเชื่อมต่อ `/api/vpn/disconnect`, บันทึกประวัติการล็อกอินใน Audit Log, จัดลำดับการทำงานของ `applyNftables` ให้เป็นระเบียบ และเพิ่มการทดสอบ Concurrency ของ Go
2. **เตรียมเครื่อง Server AWS EC2 Linux (Profile B ตาม Issue `#21`):** เปิดพอร์ต UDP `51820` สำหรับ WireGuard และ HTTPS `443` ผ่าน Reverse Proxy หรือ ALB (`vpn.example.com` ชี้ไปที่ `:3000`, `api.vpn.example.com` ชี้ไปที่ `:4000`), บล็อกพอร์ต `15432` จากโลกภายนอกทั้งหมด, และตั้งค่าความลับในไฟล์ Production `.env` พร้อมระบุ `WG_SERVER_ENDPOINT`
3. **Build, ลงทะเบียน และปล่อย Windows Agent Service (`#21`):** Build ไฟล์ `mango-agent-windows.exe`, ตรวจสอบและบันทึกค่าแฮชด้วย `Get-FileHash -Algorithm SHA256`, นำไปลงทะเบียนเป็นแพลตฟอร์ม `windows-x64` ในแท็บ **Agent Versions** ของหน้า Admin, และทดสอบการเปิด/ปิดอุโมงค์ `mango0` จริง พร้อมตรวจสอบความถูกต้องผ่านคำสั่ง `wg show` และ `nft list table inet mango_vpn`
