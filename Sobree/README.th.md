# ⚡ คู่มือการพัฒนาสำหรับ Sobree

[English](README.md) | [ภาษาไทย](README.th.md)

ยินดีต้อนรับครับ **Sobree**! เอกสารฉบับนี้รวบรวมรายละเอียดเชิงลึกทางด้านระบบ, สถาปัตยกรรมความปลอดภัยเน็ตเวิร์ก, และการเชื่อมต่อระดับเคอร์เนลของโปรเจกต์ MANGO VPN

---

## 1. ขอบเขตงานและความรับผิดชอบของคุณ

คุณรับผิดชอบ **วิศวกรรมระบบเครือข่าย, สถาปัตยกรรมความปลอดภัย และระบบควบคุมหลัก (Control Plane)**:

1. **`Sobree/api/`**: ระบบศูนย์กลางควบคุม Management API
   - **Prisma Schema (`prisma/schema.prisma`)**: สกีมาฐานข้อมูลเชิงสัมพันธ์ 8 ตารางหลัก พร้อม Foreign Keys, ดัชนี (Indexes) และรหัสระบุเอกลักษณ์แบบ UUID
   - **Auth Module (`src/modules/auth`)**: โฟลว์ยืนยันตัวตน 1-4, ระบบ OTP MFA 6 หลัก, แฮชรหัสผ่านด้วย bcrypt, ออกโทเคน JWT
   - **VPN Module (`src/modules/vpn`)**: จัดสรรไอพี (IPAM Subnet `10.13.13.0/24`), รับจดทะเบียน Public Key ของไคลเอนต์ และควบคุม Session
   - **Server Entrypoint (`src/server.ts`)**: การตั้งค่า Fastify, CORS และเชื่อมต่อโมดูล `@mango/rain-admin` ของ Rain เข้ามาทำงานร่วมกัน
2. **`Sobree/agent-windows/`**: โปรแกรม Windows Service ที่พัฒนาด้วยภาษา Go
   - ทำงานภายใต้ Security Context ของ `LocalSystem` ผ่านแพ็กเกจ `golang.org/x/sys/windows/svc`
   - รัน Loopback HTTP Listener ภายในเครื่องที่ `127.0.0.1:47821` พร้อมรองรับ **Chromium Private Network Access (PNA)**
   - สร้างคู่คีย์ Curve25519 ภายในหน่วยความจำ (พร้อม Clamping คีย์ตามมาตรฐาน WireGuard)
   - สั่งเปิดอินเทอร์เฟซ WireGuard ผ่านไดรเวอร์ WireGuard-NT หรือยูทิลิตี้ของระบบ
3. **`Sobree/vpn-daemon/`**: ดิมอนเกตเวย์ WireGuard บน Linux และตัวบังคับใช้นโยบายไฟร์วอลล์
   - สื่อสารผ่าน Unix Domain Socket (`/var/run/mango-vpn.sock`) หรือพอร์ต TCP
   - นำ Peer เข้าและออกผ่านคำสั่ง `wg set wg0 peer <pubkey> allowed-ips <ip>/32`
   - จัดการกฎไฟร์วอลล์แบบ Stateful บน Forward Chain ของ `nftables` ตาราง `inet mango_vpn` แยกตามสิทธิ์ของผู้ใช้งาน
4. **`packages/shared/`**: สัญญาข้อมูลกลาง (Contracts & DTOs) สำหรับทั้งระบบ

---

## 2. สิ่งที่คุณต้องติดตั้งในเครื่อง (Prerequisites)

ในฐานะ Systems & Security Developer คุณจำเป็นต้องมีชุดเครื่องมือระดับระบบอย่างครบถ้วน:

| เครื่องมือ | เวอร์ชันที่แนะนำ | วัตถุประสงค์การใช้งานใน MANGO VPN |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0 LTS` | รันระบบ Management API และสคริปต์ Monorepo |
| **npm** | `>= 10.0.0` | จัดการ Monorepo Workspaces |
| **Docker & Compose** | `>= 24.0.0` (Compose v2) | รันคอนเทนเนอร์ PostgreSQL 16 และ Linux WireGuard Gateway |
| **Go Toolchain** | `>= 1.22` | คอมไพล์ Windows Service และ Linux VPN Daemon |
| **Git** | `>= 2.30.0` | จัดการการควบคุมเวอร์ชัน |

---

## 3. ขั้นตอนการทำงานประจำวัน (Daily Routine)

### ขั้นตอนที่ 1: เปิดคอนเทนเนอร์ฐานข้อมูล PostgreSQL และ WireGuard Gateway
รันคำสั่งจากโฟลเดอร์หลักของโปรเจกต์:
```powershell
docker compose up -d postgres vpn-gateway
```
ตรวจสอบสถานะว่าคอนเทนเนอร์ทำงานสมบูรณ์:
```powershell
docker compose ps
```

---

### ขั้นตอนที่ 2: จัดการ Schema ฐานข้อมูลและสร้าง Prisma Client
เมื่อมีการปรับแต่งหรือเพิ่มฟิลด์ใน `Sobree/api/prisma/schema.prisma`:
```powershell
# สร้าง Prisma Client ล่าสุด
npm run db:generate

# ส่งการเปลี่ยนแปลงไปยังฐานข้อมูล PostgreSQL
npm run db:migrate

# เติมข้อมูลผู้ใช้และ Role ตัวอย่างโดยใช้สคริปต์ของ Rain
npm run db:seed
```

---

### ขั้นตอนที่ 3: รัน Management API Backend
```powershell
npm run dev:api
```
- ทำงานบนพอร์ต `http://localhost:4000`
- ดึง Route ระบบ Admin ของ Rain (`@mango/rain-admin`) เข้ามาทำงานร่วมกันโดยอัตโนมัติ
- พิมพ์รหัส OTP Challenge ออกทางหน้าจอ Console ช่วยให้ทดสอบระบบได้ทันที

---

### ขั้นตอนที่ 4: พัฒนาและทดสอบ Windows Agent (Go)
คุณสามารถรันและดีบักโค้ด Windows Agent ได้ทันทีในโหมด Interactive Console โดยไม่ต้องติดตั้งเข้า Service Control Manager (SCM):

```powershell
cd Sobree/agent-windows
go run main.go -debug
```
- รันบน `http://127.0.0.1:47821`
- ให้บริการ `/health`, `/status`, `/connect`, และ `/disconnect`
- ส่ง Header `Access-Control-Allow-Private-Network: true` ในคำขอ `OPTIONS` เสมอ

เมื่อต้องการคอมไพล์เป็นไฟล์ `.exe` สำหรับใช้งานจริง:
```powershell
go build -o bin/mango-agent-windows.exe .
```

เมื่อต้องการติดตั้งเป็น Windows Service จริงในระบบ (เปิด PowerShell ด้วย Run as Administrator):
```powershell
sc.exe create MangoVpnAgent binPath= "E:\Trainee\Mango_VPN_Trainee\Sobree\agent-windows\bin\mango-agent-windows.exe" start= auto
sc.exe start MangoVpnAgent
```

---

### ขั้นตอนที่ 5: พัฒนาและทดสอบ Linux VPN Policy Daemon
ดิมอนทำหน้าที่ควบคุมการทำงานของ `wg0` และการฉีดกฎลง `nftables`:

```bash
cd Sobree/vpn-daemon
go run main.go
```
- บนสภาพแวดล้อม Windows ในการพัฒนา จะสลับมารับคำสั่งผ่าน TCP พอร์ต `50051` ให้อัตโนมัติ
- บนเกตเวย์ Linux (เช่น Ubuntu 24.04 Server) จะผูกเข้ากับ `/var/run/mango-vpn.sock` และเรียกใช้คำสั่ง `/usr/bin/wg` กับ `/usr/sbin/nft` โดยตรง

---

## 4. สถาปัตยกรรมความปลอดภัย Zero-Trust (Security Architecture)

### A. การจัดการคีย์บนฝั่งไคลเอนต์ (Curve25519)
ผู้ใช้งานและหน้าเว็บ **ไม่มีสิทธิ์และไม่ต้องสัมผัสไฟล์ `.conf` หรือ Private Key เลย** ตัว Agent บนเครื่องของผู้ใช้จะสร้างคีย์ภายในหน่วยความจำ:
```go
// การคำนวณสเกลาร์ 32 ไบต์
curve25519.ScalarBaseMult(&pub, &priv)
```
- Private Key จะถูกเก็บรักษาไว้เฉพาะในหน่วยความจำของ Process `LocalSystem`
- ส่งเฉพาะ Base64 Public Key ไปยังเซิร์ฟเวอร์ในขั้นตอน `POST /api/vpn/connect`

### B. การตัดตอนและแยกแยะทราฟฟิกด้วย `nftables` บน Forward Chain
นโยบายเริ่มต้นบน Forward Chain คือ **DROP ทั้งหมด (Zero-Trust Isolation)**:
```nftables
table inet mango_vpn {
    chain forward {
        type filter hook forward priority 0; policy drop;
        ct state established,related accept
    }
}
```
เมื่อผู้ใช้ล็อกอินสำเร็จ ดิมอนจะฉีดกฎอนุญาตเฉพาะเจาะจงตามสิทธิ์ (Role) เท่านั้น:
- **`CLIENT`**: โดนจำกัดเส้นทางเข้าถึงได้เฉพาะ IP ปลายทางแบบ `/32` บนพอร์ต 80/443 เท่านั้น
- **`STAFF`**: อนุญาตให้เข้าถึงเน็ตเวิร์กภายในองค์กรได้ (RFC1918: `10.0.0.0/8`, `172.16.0.0/12`)
- **`ADMIN`**: ได้รับสิทธิ์ Forwarding ได้ทุกเส้นทาง (`0.0.0.0/0`)

---

## 5. ข้อตกลงการประสานงานกับ Rain (Collaboration Contract)

1. **โมดูล Admin ของ Rain**:
   - Rain พัฒนาไฟล์ใน `Rain/admin/src/admin.service.ts` และ `admin.routes.ts`
   - โค้ด API ของคุณจะดึงผ่าน Dependency `@mango/rain-admin` มาลงทะเบียนใน `Sobree/api/src/server.ts`
   - **จะไม่มีการเกิด Merge Conflict** เพราะ Rain ไม่จำเป็นต้องแก้ไฟล์ใน `Sobree/api` เลย
2. **การแก้ไขสัญญา API (Contracts)**:
   - หากต้องการเพิ่มหรือแก้ข้อมูลใน Request/Response ให้แก้ไขที่ [`packages/shared/src/contracts.ts`](file:///e:/Trainee/Mango_VPN_Trainee/packages/shared/src/contracts.ts) จากนั้นรัน `npm --workspace=@mango/shared run build` แล้วแจ้ง Rain
3. **การปรับเปลี่ยน Agent Simulator**:
   - หากปรับแก้พฤติกรรมการตอบกลับของ Windows Agent ให้ช่วยอัปเดตไฟล์ [`scripts/mock-agent.js`](file:///e:/Trainee/Mango_VPN_Trainee/scripts/mock-agent.js) ด้วย เพื่อให้หน้าเว็บจำลองของ Rain ทำงานตรงกันเสมอ

---

## 6. การทดสอบความสมบูรณ์ทั้งโปรเจกต์ (Full Build)

ก่อน Commit โค้ดส่งขึ้น Git ให้รันคำสั่งเพื่อตรวจสอบการคอมไพล์ทั้งระบบ:
```powershell
npm run build
```
คำสั่งนี้จะทำการ Typecheck และ Build ทั้ง 4 แพ็กเกจ ได้แก่ `@mango/shared`, `@mango/rain-admin`, `@mango/api`, และ `@mango/portal`

