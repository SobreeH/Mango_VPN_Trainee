# 🚀 MANGO VPN - คู่มือเริ่มต้นด่วน & ตรวจสอบความพร้อมของเครื่องมือ

[English](QUICKSTART.md) | [ภาษาไทย](QUICKSTART.th.md)

เอกสารฉบับนี้รวบรวมรายการ **โปรแกรม, แอปพลิเคชัน, รันไทม์ และชุดเครื่องมือทั้งหมด** ที่จำเป็นต้องใช้ในการพัฒนา รัน และทดสอบระบบ MANGO VPN พร้อมคำแนะนำขั้นตอนการ **ตรวจสอบว่าเครื่องคอมพิวเตอร์ของคุณพร้อมเริ่มงานหรือยัง**

---

## 1. ตารางรายการเครื่องมือและความต้องการตามหน้าที่

| โปรแกรม / เครื่องมือ | ผู้ใช้งานที่ต้องมี | เวอร์ชันขั้นต่ำ | เวอร์ชันแนะนำ | หน้าที่ในโปรเจกต์ MANGO VPN | ลิงก์ดาวน์โหลดอย่างเป็นทางการ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js** | **ทั้งสองคน** (Rain & Sobree) | `18.0.0` | `20 LTS` หรือ `22 LTS` | ใช้รัน Management API, Web Portal, สัญญาข้อมูลส่วนกลาง และ TypeScript Compiler | [nodejs.org](https://nodejs.org/) |
| **npm** | **ทั้งสองคน** (Rain & Sobree) | `9.0.0` | `10.x` | จัดการ Monorepo Workspaces (`Rain/*`, `Sobree/*`, `packages/*`) | มาพร้อมกับ Node.js อัตโนมัติ |
| **Git** | **ทั้งสองคน** (Rain & Sobree) | `2.30.0` | เวอร์ชันล่าสุด | ควบคุมเวอร์ชันของโค้ดและการทำงานร่วมกัน | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | **Sobree** (Senior Dev) | `24.0.0` | เวอร์ชันล่าสุด | รันฐานข้อมูล PostgreSQL 16 และคอนเทนเนอร์เกตเวย์ Linux WireGuard (`NET_ADMIN`) | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Go Toolchain** | **Sobree** (Senior Dev) | `1.22.0` | `1.22+` | คอมไพล์เซอร์วิสบน Windows (`agent-windows`) และดิมอนบน Linux (`vpn-daemon`) | [go.dev](https://go.dev/dl/) |
| **WireGuard** | **Sobree** (Senior Dev) | `0.5.3` | เวอร์ชันล่าสุด | ใช้ทดสอบอินเทอร์เฟซ VPN บนเครื่อง Windows จริง | [wireguard.com](https://www.wireguard.com/install/) |
| **VS Code** *(แนะนำ)* | **ทั้งสองคน** | เวอร์ชันล่าสุด | เวอร์ชันล่าสุด | โปรแกรมแก้ไขโค้ด พร้อมส่วนขยายช่วยจัดฟอร์แมตและตรวจสอบโค้ด | [code.visualstudio.com](https://code.visualstudio.com/) |

> [!NOTE]
> **หมายเหตุสำหรับน้อง Rain (Junior Developer)**: หากคุณรับผิดชอบหน้าเว็บพอร์ทัล (`Rain/portal`) และระบบ Admin CRUD (`Rain/admin`) คุณ **ต้องการเพียงแค่ Node.js และ Git เท่านั้น!** คุณสามารถพัฒนาและทดสอบระบบทั้งหมดได้ผ่านตัวจำลอง Agent (`scripts/mock-agent.js`) โดยไม่จำเป็นต้องลง Go, Docker หรือเปิดใช้งานระบบเน็ตเวิร์ก WireGuard จริงในเครื่อง

---

## 2. สคริปต์ตรวจสอบความพร้อมของเครื่องอัตโนมัติ

เรามีสคริปต์ PowerShell ที่เขียนไว้ให้คุณตรวจสอบเครื่องได้ในคลิกเดียว:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-environment.ps1
```

หรือสั่งรันผ่าน npm:
```powershell
npm run check:env
```

### ตัวอย่างผลการตรวจสอบบนหน้าจอ:
```text
============================================================
   MANGO VPN - Development Environment Readiness Check      
============================================================

Tool           Status  RequiredFor          Requirement         DetectedVersion                     
----           ------  -----------          -----------         ---------------                     
Node.js        READY   Both (Rain & Sobree) >= 18.0.0 (LTS 20+) v20.12.1                            
npm            READY   Both (Rain & Sobree) >= 9.0.0            10.5.0                             
Git            READY   Both (Rain & Sobree) >= 2.30.0           git version 2.44.0.windows.1        
Docker CLI     READY   Sobree (Senior Dev)  >= 24.0.0           Docker version 25.0.3, build 4debf41
Docker Compose READY   Sobree (Senior Dev)  >= v2.20.0          Docker Compose version v2.24.6      
Go Toolchain   READY   Sobree (Senior Dev)  >= 1.22.0           go version go1.22.1 windows/amd64   

Role Readiness Summary:
  [READY] Rain (Junior Dev): All required tools are INSTALLED!
          Rain can immediately run: npm run mock:agent, npm run dev:portal, npm run dev:api
  [READY] Sobree (Senior Dev): All systems tools are INSTALLED!
============================================================
```

---

## 3. คำสั่งตรวจสอบเวอร์ชันด้วยตนเอง (Manual CLI Checks)

หากต้องการเปิด PowerShell หรือ Command Prompt เพื่อตรวจสอบโปรแกรมทีละตัว:

### 1. ตรวจสอบ Node.js และ npm
```powershell
node -v
npm -v
```
- **ผลลัพธ์ที่ถูกต้อง**: แสดงเวอร์ชัน `v18.x.x`, `v20.x.x` หรือ `v22.x.x`
- **หากยังไม่มี**: ให้ดาวน์โหลดและติดตั้งตัว **LTS** จาก [nodejs.org](https://nodejs.org/) (ต้องติ๊กเลือก **"Add to PATH"** ด้วย)

### 2. ตรวจสอบ Git
```powershell
git --version
```
- **ผลลัพธ์ที่ถูกต้อง**: แสดงเวอร์ชัน `git version 2.x.x`
- **หากยังไม่มี**: ดาวน์โหลดตัวติดตั้งได้จาก [git-scm.com](https://git-scm.com/)

### 3. ตรวจสอบ Docker และ Docker Compose (สำหรับ Sobree)
```powershell
docker -v
docker compose version
```
- **ผลลัพธ์ที่ถูกต้อง**: แสดงเวอร์ชัน `Docker version 24+` และ `Docker Compose version v2.+`
- **ตรวจสอบสถานะเซอร์วิส Docker**:
  ```powershell
  docker info
  ```
  หากระบบขึ้นข้อความแจ้งว่า `error during connect: ... open //./pipe/dockerDesktopLinuxEngine` แสดงว่ายังไม่ได้เปิดแอปพลิเคชัน **Docker Desktop** ให้กดเปิดโปรแกรมจาก Start Menu แล้วรอให้ไอคอนรูปปลาวาฬเปลี่ยนเป็นสีเขียว "Engine running"

### 4. ตรวจสอบภาษา Go (สำหรับ Sobree)
```powershell
go version
```
- **ผลลัพธ์ที่ถูกต้อง**: แสดงเวอร์ชัน `go version go1.22.x windows/amd64`
- **หากยังไม่มี**: ดาวน์โหลดตัวติดตั้ง `.msi` จาก [go.dev/dl](https://go.dev/dl/)

---

## 4. แผนผังการจัดสรรพอร์ตเครือข่าย (Port Allocation Map)

ตรวจสอบให้แน่ใจว่าพอร์ตเหล่านี้ไม่ถูกโปรแกรมอื่นในเครื่องของคุณแย่งใช้งาน:

| หมายเลขพอร์ต | โปรโตคอล | ส่วนประกอบของระบบ | ผู้รับผิดชอบหลัก |
| :--- | :--- | :--- | :--- |
| **3000** | TCP (HTTP) | MANGO Web Portal (Vite Dev Server) | Rain |
| **4000** | TCP (HTTP) | VPN Management API (Fastify Control Plane) | Sobree |
| **5432** | TCP (PostgreSQL) | ฐานข้อมูล PostgreSQL 16 (บนคอนเทนเนอร์) | Docker / Sobree |
| **47821** | TCP (HTTP / PNA) | Windows Client Agent (Loopback Listener ในเครื่อง) | Mock Agent / Go Service |
| **51820** | UDP (WireGuard) | เกตเวย์รับทราฟฟิก WireGuard Tunnel | Linux Server / เกตเวย์คอนเทนเนอร์ |
| **50051** | TCP (IPC fallback)| ซ็อกเก็ตสื่อสารคำสั่งของ VPN Policy Daemon | Sobree |

ตรวจสอบว่าพอร์ตใดถูกเปิดใช้งานอยู่หรือไม่บน Windows:
```powershell
# ตัวอย่าง: ตรวจสอบว่าพอร์ต 4000 มีโปรแกรมใดจองอยู่หรือไม่
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
```

---

## 5. ส่วนขยายแนะนำสำหรับ VS Code (Extensions)

หากคุณใช้โปรแกรม Visual Studio Code แนะนำให้ติดตั้ง Extension เหล่านี้เพื่อการเขียนโค้ดที่สะดวกที่สุด:

1. **Prisma** (`Prisma.prisma`): แสดงไฮไลต์สีไวยากรณ์และช่วยเติมคำอัตโนมัติในไฟล์ `Sobree/api/prisma/schema.prisma`
2. **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`): แนะนำ Class ของ Tailwind CSS ในหน้าเว็บ `Rain/portal`
3. **Go** (`golang.Go`): ระบบช่วยเหลือการเขียนและดีบักภาษา Go ในส่วนของ `Sobree/`
4. **ESLint** (`dbaeumer.vscode-eslint`): ตรวจสอบคุณภาพและรูปแบบโค้ด TypeScript
5. **GitLens** (`eamodio.gitlens`): ดูประวัติการ Commit และช่วยแก้ Merge Conflict ได้ง่ายดาย

---

## 6. ขั้นตอนการเริ่มต้นใช้งานครั้งแรก (First-Time Setup)

หลังจากตรวจสอบความพร้อมของเครื่องมือเรียบร้อยแล้ว:

### ขั้นตอนที่ 1: ติดตั้งไลบรารีและ Dependencies ทั้งหมด
รันคำสั่งที่โฟลเดอร์หลักของโปรเจกต์:
```powershell
npm install
```

### ขั้นตอนที่ 2: คอมไพล์โค้ดและสัญญาข้อมูลส่วนกลาง
```powershell
npm run build
```

### ขั้นตอนที่ 3: เริ่มต้นทำงานตามบทบาทของคุณ
- **Rain (Junior Dev)**: เปิดอ่าน [`Rain/README.th.md`](file:///e:/Trainee/Mango_VPN_Trainee/Rain/README.th.md) แล้วรัน:
  ```powershell
  npm run mock:agent   # หน้าต่างที่ 1
  npm run dev:api      # หน้าต่างที่ 2
  npm run dev:portal   # หน้าต่างที่ 3
  ```
- **Sobree (Senior Dev)**: เปิดอ่าน [`Sobree/README.th.md`](file:///e:/Trainee/Mango_VPN_Trainee/Sobree/README.th.md) แล้วรัน:
  ```powershell
  docker compose up -d postgres
  npm run db:generate
  npm run dev:api
  ```

