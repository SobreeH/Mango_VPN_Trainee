# 🚀 MANGO VPN — คู่มือเริ่มต้นใช้งานด่วน & การเตรียมความพร้อมเครื่องมือ (`QUICKSTART.th.md`)

คู่มือฉบับนี้รวบรวม **เครื่องมือ, สภาพแวดล้อมการทำงาน (Runtimes) และการตั้งค่าคอนฟิก** ที่จำเป็นสำหรับการรันระบบ MANGO VPN v2 ในเครื่องของคุณ (Local Environment) พร้อมวิธีตรวจสอบความพร้อมของเครื่องก่อนเริ่มใช้งาน

> [!TIP]
> **เพิ่งเคยรันหรือทดสอบ MANGO VPN เป็นครั้งแรกใช่ไหม?** แนะนำให้อ่านคู่มือฉบับจับมือทำที่อธิบายละเอียดทุกขั้นตอน พร้อมสคริปต์สร้าง `.env` อัตโนมัติและภารกิจทดสอบทีละคลิก: **[🇹🇭 ภาษาไทย (`TUTORIAL.th.md`)](TUTORIAL.th.md)** | **[🇬🇧 English (`TUTORIAL.md`)](TUTORIAL.md)**

> [!IMPORTANT]
> **หากคุณใช้งาน AI ผู้ช่วย (AI Assistant)?** โปรดสั่งให้ AI ของคุณอ่าน [`AGENTS.md`](AGENTS.md) (หรือ [`AGENTS.th.md`](AGENTS.th.md)) ก่อนเริ่มต้นทำงานใดๆ เสมอ เอกสารดังกล่าวระบุขอบเขตของโปรเจกต์ กฎการทำงานร่วมกันข้ามโฟลเดอร์ (`Rain/`, `Sobree/`, `packages/shared/`) และปราการป้องกันการใส่ Mock หลอก

---

## 1. ตารางตรวจสอบเครื่องมือที่จำเป็น (Tool Matrix)

| เครื่องมือ / โปรแกรม | จำเป็นสำหรับ | เวอร์ชันขั้นต่ำ | เวอร์ชันที่แนะนำ | หน้าที่ใน MANGO VPN | ลิงก์ดาวน์โหลดอย่างเป็นทางการ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js** | **ทั้งสองคน** (Rain & Sobree) | `18.0.0` | `20 LTS` หรือ `22 LTS` | รัน Control Plane API, หน้าเว็บ Web Portal (React 18 + Vite), Shared Contracts, TypeScript Compiler | [nodejs.org](https://nodejs.org/) |
| **npm** | **ทั้งสองคน** (Rain & Sobree) | `9.0.0` | `10.x` | จัดการ Monorepo Workspaces (`Rain/*`, `Sobree/*`, `packages/*`) *ใช้ npm เท่านั้น ไม่มี pnpm* | ติดตั้งมาพร้อมกับ Node.js |
| **Git** | **ทั้งสองคน** (Rain & Sobree) | `2.30.0` | ล่าสุด | ระบบควบคุมเวอร์ชันและการจัดการกิ่ง (Branching) | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | **Sobree** (และ Rain สำหรับรัน Full-stack) | `24.0.0` | ล่าสุด | รันคอนเทนเนอร์ PostgreSQL 16 และ Linux WireGuard Gateway (`NET_ADMIN`) | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Go Toolchain** | **Sobree** | `1.22.0` (daemon) / `1.26.0` (agent) | ล่าสุด | คอมไพล์ Windows Agent (`Sobree/agent-windows/go.mod` ต้องการ `go 1.26.0`) และ Linux VPN daemon (`Sobree/vpn-daemon/go.mod` ต้องการ `go 1.22`) | [go.dev](https://go.dev/dl/) |
| **WireGuard for Windows** | **Sobree** | ล่าสุด | ล่าสุด | ตัวโปรแกรม Agent ต้องสั่งรัน `wireguard.exe /installtunnelservice` เพื่อสร้างอินเทอร์เฟซ `mango0` | [wireguard.com](https://www.wireguard.com/install/) |
| **VS Code** *(ทางเลือก)* | **ทั้งสองคน** | ล่าสุด | ล่าสุด | โปรแกรมเขียนโค้ด (Editor) | [code.visualstudio.com](https://code.visualstudio.com/) |

> [!NOTE]
> **สำหรับ Rain (Web Portal และ Admin, ไม่ใช้ Docker)**: คุณต้องการเพียงแค่ **Node.js และ Git** โดย**ไม่ต้องใช้ Docker, Go หรือ WireGuard** ก็รัน Web Portal, API และระบบ Admin CRUD ได้ ขั้นตอนนี้ใช้เครื่องมือในเครื่องสามตัว: `npm run db:start` รัน PostgreSQL 16 แบบฝังตัว (ข้อมูลอยู่ที่ `.local/postgres`), `npm run mock:daemon` จำลอง Gateway Daemon พอร์ต `:50051` (`[DEV MOCK DAEMON – no wg/nftables enforcement]` ใช้สำหรับการพัฒนาเท่านั้น) และ `npm run mock:agent` จำลอง Windows Agent พอร์ต `:47821` (`scripts/mock-agent.js`) หากต้องการรันระบบเต็มรูปแบบด้วย Docker ก็ยังใช้ Docker Desktop ได้

---

## 2. ตรวจสอบความพร้อมของระบบอัตโนมัติ (Automated Readiness Check)

```powershell
npm run check:env
```

คำสั่งนี้จะรันสคริปต์ `scripts/check-environment.ps1` ซึ่งจะรายงานว่า Node.js, npm, Git, Docker, Docker Compose และ Go ได้รับการติดตั้งในเครื่องแล้วหรือไม่ และมีเวอร์ชันตรงตามเกณฑ์ขั้นต่ำหรือไม่

สำหรับการตั้งค่าของ Rain ที่ไม่ใช้ Docker ให้รันการตรวจสอบตามบทบาทแทน สคริปต์จะกำหนดให้ Docker, Docker Compose, Docker Desktop และ Go เป็น `OPTIONAL`:

```powershell
npm run check:env -- -Role Rain
```

---

## 3. คำสั่งตรวจสอบความพร้อมด้วยตนเองผ่าน CLI

### ตรวจสอบ Node.js และ npm
```powershell
node -v
npm -v
```
- **ผลลัพธ์ที่คาดหวัง**: `v18.x`, `v20.x`, หรือ `v22.x` และ npm เวอร์ชัน `9.x` ขึ้นไป
- **หากยังไม่มี**: ให้ดาวน์โหลดเวอร์ชัน **LTS** จาก [nodejs.org](https://nodejs.org/) และอย่าลืมติ๊กเลือก **"Add to PATH"**

### ตรวจสอบ Git
```powershell
git --version
```

### ตรวจสอบ Docker และ Docker Compose (สำหรับ Sobree)
```powershell
docker -v
docker compose version
docker info
```
หากคำสั่ง `docker info` แจ้งเตือนว่า `error during connect` ให้เปิดโปรแกรม **Docker Desktop** ขึ้นมาแล้วรอจนกระทั่ง Engine เริ่มทำงานสมบูรณ์

### ตรวจสอบ Go Toolchain (สำหรับ Sobree)
```powershell
go version
```
- **หากยังไม่มี**: ให้ดาวน์โหลดตัวติดตั้ง `.msi` บน Windows จาก [go.dev/dl](https://go.dev/dl/) ทั้งนี้โมดูล Agent จำเป็นต้องใช้ Go 1.26 ขึ้นไป โปรดตรวจสอบบรรทัด `go` ใน `Sobree/agent-windows/go.mod` ก่อนทำการติดตั้ง

---

## 4. การตั้งค่าตัวแปรสภาพแวดล้อม (`.env`)

การตั้งค่าระบบ Backend และ Gateway ทั้งหมดจะรวมอยู่ที่ไฟล์ `.env` เพียงไฟล์เดียว ณ Root ของโปรเจกต์ โดยมีไฟล์แม่แบบคือ [`.env.example`](.env.example)

```powershell
copy .env.example .env
```

จากนั้นให้เปลี่ยนค่า Placeholder ทั้งหมดก่อนที่จะเริ่มรันระบบ:

| ตัวแปร (Variable) | ส่วนที่ใช้งาน | คำอธิบายและข้อกำหนด |
| :--- | :--- | :--- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Docker Compose `postgres` **และ** `npm run db:start` (PostgreSQL 16 แบบฝังตัว ข้อมูลอยู่ที่ `.local/postgres`) | พอร์ตบนเครื่อง Host/Loopback ค่าเริ่มต้นคือ `15432` `npm run db:start` จะสร้างทั้ง `POSTGRES_DB` และ `mangovpn_v2_test` ให้อัตโนมัติ |
| `DATABASE_URL` | API และ Prisma CLI บนเครื่อง Host | ต้องชี้ไปยังฐานข้อมูลและพอร์ตเดียวกันกับข้างต้น |
| `JWT_SECRET`, `REFRESH_SECRET` | API | บังคับต้องมี ความยาวอย่างน้อย 32 ตัวอักษร (ระบบ API จะปฏิเสธการเริ่มทำงานทันทีหากไม่มีหรือสั้นเกินไป) |
| `TOTP_ENCRYPTION_KEY` | API | บังคับต้องมี และต้องเป็นเลขฐานสิบหก (Hex) ความยาวตรง 64 ตัวอักษรพอดี |
| `DAEMON_SHARED_SECRET` | API และ VPN daemon | บังคับต้องมี ความยาวอย่างน้อย 32 ตัวอักษร (API จะส่งค่านี้ไปเป็น Bearer Token) |
| `PORT` / `API_PORT` | API | ค่าเริ่มต้นคือ `4000` |
| `CORS_ORIGIN` | API | ค่าเริ่มต้นคือ `http://localhost:3000` |
| `WG_INTERFACE`, `WG_LISTEN_PORT`, `WG_GATEWAY_CIDR`, `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY`, `WG_DNS`, `WG_SERVER_ENDPOINT` | VPN gateway | `WG_SERVER_ENDPOINT` คือที่อยู่ IP/Port ที่ Client ต่อเข้ามา (เช่น `127.0.0.1:51820` สำหรับในเครื่อง) |
| `VITE_API_URL`, `VITE_AGENT_URL` | Portal | ใช้โดย Docker entrypoint และตอน Vite build (ดูรายละเอียดด้านล่าง) |
| `PORTAL_PORT` | Portal container | ค่าเริ่มต้นคือ `3000` |

สามารถสุ่มสร้างค่า Secret ได้ด้วยคำสั่ง:
```powershell
openssl rand -base64 32   # สำหรับ JWT_SECRET, REFRESH_SECRET, DAEMON_SHARED_SECRET
openssl rand -hex 32      # สำหรับ TOTP_ENCRYPTION_KEY (จะได้ 64 hex characters)
```

### การตั้งค่า Runtime สำหรับหน้าเว็บ Web Portal

หน้าเว็บ Portal จะอ่านค่า URL ของ API และ Agent ในขณะทำงานจริง (Runtime) จาก `window.__MANGO_ENV__`:
- `Rain/portal/index.html` จะโหลด `/env-config.js` ก่อนชุดโค้ดของแอป
- ในโหมด Local Vite Dev จะใช้ไฟล์แม่แบบที่ [`Rain/portal/public/env-config.js`](Rain/portal/public/env-config.js)
- เมื่อรันในคอนเทนเนอร์ สคริปต์ [`Rain/portal/docker-entrypoint.sh`](Rain/portal/docker-entrypoint.sh) จะเขียนทับ `/usr/share/nginx/html/env-config.js` จากค่า `VITE_API_URL` และ `VITE_AGENT_URL` ทุกครั้งที่คอนเทนเนอร์เริ่มทำงาน ทำให้การเปลี่ยนค่าเหล่านี้ไม่จำเป็นต้อง Build Image ใหม่

### การสร้างบัญชีผู้ดูแลระบบคนแรก (Seed Admin)

สคริปต์ Seeder จะสร้างบัญชีผู้ใช้ระดับ ADMIN คนแรก โดยจำเป็นต้องมีตัวแปรเหล่านี้ใน Environment (ไม่ได้ระบุไว้ใน `.env.example` เพื่อความปลอดภัย):
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD` (ความยาวอย่างน้อย 12 ตัวอักษร)
- `SEED_ADMIN_EMAIL` (ไม่บังคับ)

*ห้ามใส่รหัสผ่านเริ่มต้นแบบฮาร์ดโค้ดไว้ในซอร์สโค้ดหรือใน `.env.example` โดยเด็ดขาด*

---

## 5. แผนผังพอร์ตที่ใช้งาน (Port Map)

| พอร์ต | โปรโตคอล | คอมโพเนนต์ | หมายเหตุ |
| :--- | :--- | :--- | :--- |
| **3000** | TCP (HTTP) | Web Portal | คอนเทนเนอร์ของ Portal หรือเมื่อรัน Vite dev ในเครื่อง ให้ระบุ `--port 3000` |
| **4000** | TCP (HTTP) | Control Plane API (Fastify) | ควบคุมโดยตัวแปร `PORT` |
| **15432** / **5432** | TCP (PostgreSQL) | PostgreSQL 16 บน `127.0.0.1:15432` | เริ่มด้วย `npm run db:start` (แบบฝังตัว ไม่ใช้ Docker) หรือคอนเทนเนอร์ Docker `postgres` (พอร์ตในคอนเทนเนอร์ `5432` พอร์ตบนเครื่อง Host คือ `POSTGRES_PORT` ค่าเริ่มต้น `15432`) |
| **47821** | TCP (HTTP, loopback) | Windows Agent หรือ `mock-agent.js` | ผูกติดกับที่อยู่ `127.0.0.1` เท่านั้น |
| **51820** | UDP (WireGuard) | VPN gateway | ควบคุมโดยตัวแปร `WG_LISTEN_PORT` |
| **50051** | TCP (HTTP) | VPN gateway daemon API | HTTP ยืนยันตัวตนด้วย Bearer Token ทำงานที่ `127.0.0.1:50051` เริ่มโดย `npm run mock:daemon` (ตัวจำลองสำหรับการพัฒนาเท่านั้น ไม่บังคับใช้ `wg`/`nftables`) หรือ Docker `vpn-gateway` |

วิธีตรวจสอบว่าพอร์ตนั้นๆ กำลังถูกใช้งานอยู่หรือไม่บน Windows:
```powershell
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
```

---

## 6. ขั้นตอนการตั้งค่าเริ่มต้นครั้งแรก (First-Time Setup)

รันคำสั่งเหล่านี้จาก Root ของโปรเจกต์:

```powershell
# 1. ติดตั้ง Dependencies ในทุก Workspaces (ใช้ npm เท่านั้น)
npm install

# 2. คอมไพล์ Shared Contracts ก่อน แล้วจึงคอมไพล์ทุก Workspace ที่มีสคริปต์ build
npm run build

# 3. สร้างไฟล์ .env จากไฟล์แม่แบบ แล้วกรอกค่า Secret ให้ครบถ้วน (ดูหัวข้อที่ 4)
copy .env.example .env
```

### ขั้นตอนการทำงานสำหรับ Rain (Portal และ Admin, ไม่ใช้ Docker)

Rain **ไม่ต้องใช้ Docker** รันคำสั่งเหล่านี้จาก Root ของโปรเจกต์ แยกตาม Terminal:

```powershell
# Terminal 1: PostgreSQL 16 แบบฝังตัวบน 127.0.0.1:15432 (สร้าง POSTGRES_DB และ mangovpn_v2_test ให้ ข้อมูลอยู่ที่ .local/postgres)
npm run db:start                     # กด Ctrl+C เพื่อหยุดอย่างถูกต้อง และรัน npm run db:reset-local เฉพาะหลังหยุดแล้วเท่านั้น

# Terminal ตั้งค่า (ขณะที่ Terminal 1 ยังทำงานอยู่)
npm run db:generate
npm run db:migrate
npm run db:seed                      # ต้องกำหนดตัวแปร SEED_ADMIN_* ใน Environment ก่อน

# Terminal 2: ตัวจำลอง Gateway Daemon บน 127.0.0.1:50051 (ไม่บังคับใช้ wg/nftables)
npm run mock:daemon

# Terminal 3: Mock Windows Agent (จะแสดง PairingToken เมื่อเริ่มทำงาน)
npm run mock:agent

# Terminal 4: API บนพอร์ต :4000
npm run dev:api

# Terminal 5: เซิร์ฟเวอร์ Dev ของ Portal บนพอร์ต :3000
npm run dev:portal
```

ค่าเริ่มต้น `CORS_ORIGIN` ของ API และ Allowed Origin ของ Agent ตั้งไว้ที่ `http://localhost:3000` และ `Rain/portal/vite.config.ts` ล็อกพอร์ตของ Vite ไว้ที่ `3000` ให้โดยอัตโนมัติ ดังนั้น `npm run dev:portal` ใช้งานได้ทันทีโดยไม่ต้องใส่ Flag เพิ่ม

นำค่า PairingToken ที่แสดงบน Terminal ของ Mock Agent ไปวางในช่อง "Paste X-Mango-Agent-Token" บนหน้าเว็บ เพื่อให้หน้าเว็บส่ง Header `X-Mango-Agent-Token` ไปยัง Agent ได้อย่างถูกต้อง

### ขั้นตอนการทำงานสำหรับ Sobree (API, Agent และ Gateway, ต้องใช้ Docker Desktop)

```powershell
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev:api

# รัน Windows Agent (โหมด Console เว้นแต่จะเริ่มผ่าน Service Control Manager)
cd Sobree/agent-windows
go run .

# รัน Gateway daemon หากอยู่บน Windows ให้รันผ่านคอนเทนเนอร์แทน:
docker compose up -d vpn-gateway
```

เซอร์วิส `vpn-gateway` จำเป็นต้องใช้สิทธิ์ `NET_ADMIN` และคำสั่ง `wg`/`nft` บน Linux เท่านั้น สำหรับการรัน Daemon แบบ Native จะทำได้เฉพาะบนเครื่อง Linux จริง

### การรัน Docker Stack ครบชุด

```powershell
npm run docker:up        # รัน postgres, vpn-gateway, api, portal
npm run docker:logs      # ดู Log
npm run docker:down      # สั่งปิดระบบ
```

---

## 7. การตรวจสอบความเรียบร้อยของระบบ (Verify the Setup)

```powershell
npm run build
node scripts/check-guardrails.mjs

# ทดสอบแบบไม่ใช้ Docker: ต้องรัน npm run db:start ค้างไว้ก่อน แล้ว Migrate ฐานข้อมูลทดสอบ
$env:DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
npm test
Remove-Item Env:DATABASE_URL
```

แทนค่า `<password>` ด้วย `POSTGRES_PASSWORD` จาก `.env` และให้เว้น `DATABASE_URL` ไว้ว่างในเทอร์มินัลที่รัน `npm run dev:api` เพื่อให้ API ใช้ฐานข้อมูล `mangovpn` จาก `.env`

หากมีการแก้ไขโค้ดภาษา Go ให้รัน Vet และ Test ในแต่ละโมดูล:
```powershell
cd Sobree/agent-windows; go vet ./...; go test ./...
cd ../vpn-daemon; go vet ./...; go test ./...
```
