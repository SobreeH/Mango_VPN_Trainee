# 🚀 MANGO VPN — คู่มือเริ่มต้นใช้งานด่วน & การเตรียมความพร้อมเครื่องมือ (`QUICKSTART.th.md`)

คู่มือฉบับนี้รวบรวม **เครื่องมือ, สภาพแวดล้อมการทำงาน (Runtimes) และการตั้งค่าคอนฟิก** ที่จำเป็นสำหรับการรันระบบ MANGO VPN v2 ในเครื่องของคุณ (Local Environment) พร้อมวิธีตรวจสอบความพร้อมของเครื่องก่อนเริ่มใช้งาน

> [!TIP]
> **เพิ่งเคยรันหรือทดสอบ MANGO VPN เป็นครั้งแรกใช่ไหม?** แนะนำให้อ่านคู่มือฉบับจับมือทำที่อธิบายละเอียดทุกขั้นตอน พร้อมสคริปต์สร้าง `.env` อัตโนมัติและภารกิจทดสอบทีละคลิก: **[🇹🇭 ภาษาไทย (`TUTORIAL.th.md`)](TUTORIAL.th.md)** | **[🇬🇧 English (`TUTORIAL.md`)](TUTORIAL.md)** คู่มือแบบแบ่งบทอยู่ใน [`docs/tutorial/th/`](docs/tutorial/th/00-overview-and-setup.md)

> [!IMPORTANT]
> **หากคุณใช้งาน AI ผู้ช่วย (AI Assistant)?** โปรดสั่งให้ AI ของคุณอ่าน [`AGENTS.md`](AGENTS.md) (หรือ [`AGENTS.th.md`](AGENTS.th.md)) ก่อนเริ่มต้นทำงานใดๆ เสมอ เอกสารดังกล่าวระบุขอบเขตของโปรเจกต์ กฎการทำงานร่วมกันข้ามโฟลเดอร์ (`Rain/`, `Sobree/`, `packages/shared/`) และปราการป้องกันการใส่ Mock หลอก

---

## 1. ตารางตรวจสอบเครื่องมือที่จำเป็น (Tool Matrix)

| เครื่องมือ / โปรแกรม | จำเป็นสำหรับ | เวอร์ชันขั้นต่ำ | เวอร์ชันที่แนะนำ | หน้าที่ใน MANGO VPN | ลิงก์ดาวน์โหลดอย่างเป็นทางการ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js** | **ทั้งสองคน** (Rain & Sobree) | `18.0.0` | `20 LTS` หรือ `22 LTS` | รัน Control Plane API, หน้าเว็บ Web Portal (React 18 + Vite), Shared Contracts, TypeScript Compiler | [nodejs.org](https://nodejs.org/) |
| **npm** | **ทั้งสองคน** (Rain & Sobree) | `9.0.0` | `10.x` | จัดการ Monorepo Workspaces (`Rain/*`, `Sobree/*`, `packages/*`) *ใช้ npm เท่านั้น ไม่มี pnpm* | ติดตั้งมาพร้อมกับ Node.js |
| **Git** | **ทั้งสองคน** (Rain & Sobree) | `2.30.0` | ล่าสุด | ระบบควบคุมเวอร์ชันและการจัดการกิ่ง (Branching) | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop / Docker Engine** | **Sobree** (และ Rain สำหรับรัน Full-stack) | `24.0.0` | ล่าสุด | รันคอนเทนเนอร์ PostgreSQL 16 และ Linux WireGuard Gateway (`NET_ADMIN`) บน Windows ใช้ Docker Desktop ส่วนบน Linux ใช้ Docker Engine | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Go Toolchain** | **Sobree** | `1.22.0` (daemon) / `1.26.0` (agent) | ล่าสุด | คอมไพล์ Client Agent (`Sobree/agent-windows/go.mod` ต้องการ `go 1.26.0` และรันได้ทั้งบน Windows และ Linux) และ Linux VPN daemon (`Sobree/vpn-daemon/go.mod` ต้องการ `go 1.22`) | [go.dev](https://go.dev/dl/) |
| **WireGuard** | **Sobree** (เฉพาะเมื่อเปิดอุโมงค์จริง) | ล่าสุด | ล่าสุด | บน Windows: **WireGuard for Windows** ซึ่ง Agent จะสั่งรัน `wireguard.exe /installtunnelservice` บน Linux: `wireguard-tools` (`wg`, `wg-quick`), `iproute2` (`ip`) และ `nftables` (`nft`) ซึ่ง Agent ใช้เปิดอินเทอร์เฟซ `mango0` | [wireguard.com](https://www.wireguard.com/install/) |
| **VS Code** *(ทางเลือก)* | **ทั้งสองคน** | ล่าสุด | ล่าสุด | โปรแกรมเขียนโค้ด (Editor) | [code.visualstudio.com](https://code.visualstudio.com/) |

> [!NOTE]
> **สำหรับ Rain (Web Portal และ Admin, ไม่ใช้ Docker)**: คุณต้องการเพียงแค่ **Node.js และ Git** โดย**ไม่ต้องใช้ Docker, Go หรือ WireGuard** ก็รัน Web Portal, API และระบบ Admin CRUD ได้ ขั้นตอนนี้ใช้เครื่องมือในเครื่องสามตัว: `npm run db:start` รัน PostgreSQL 16 แบบฝังตัว (ข้อมูลอยู่ที่ `.local/postgres`), `npm run mock:daemon` จำลอง Gateway Daemon พอร์ต `:50051` (`[DEV MOCK DAEMON – no wg/nftables enforcement]` ใช้สำหรับการพัฒนาเท่านั้น) และ `npm run mock:agent` จำลอง Client Agent พอร์ต `:47821` (`scripts/mock-agent.js` ซึ่งจำลองการทำงานของ `Sobree/agent-windows`) หากต้องการรันระบบเต็มรูปแบบด้วย Docker ก็ยังใช้ Docker Desktop ได้

---

## 2. ตรวจสอบความพร้อมของระบบอัตโนมัติ (Automated Readiness Check)

```powershell
npm run check:env
```

```bash
npm run check:env
```

คำสั่งนี้จะรันสคริปต์ `scripts/check-environment.mjs` (ใช้เฉพาะ Node.js ไม่มี Dependencies) ทำงานเหมือนกันบน Linux, macOS และ Windows โดยจะตรวจว่ามีเครื่องมืออยู่ใน `PATH` หรือไม่ พิมพ์เวอร์ชันที่ตรวจพบเทียบกับเกณฑ์ขั้นต่ำ (Node.js, npm, Git, Docker, Docker Compose และ Go) ตรวจสถานะ Docker daemon ด้วย `docker info` และรายงานเครื่องมือ WireGuard กับ Gateway ของระบบปฏิบัติการที่ใช้ (`wireguard.exe` บน Windows; `wg`, `wg-quick`, `ip` และ `nft` บน Linux)

สำหรับการตั้งค่าของ Rain ที่ไม่ใช้ Docker ให้รันการตรวจสอบตามบทบาทแทน สคริปต์จะกำหนดให้ Docker, Docker Compose และ Go เป็น `OPTIONAL`:

```powershell
npm run check:env -- --role Rain
```

```bash
npm run check:env -- --role Rain
```

ตัวเลือกที่ใช้ได้: `--role All|Rain|Sobree` (ไม่สนตัวพิมพ์เล็ก-ใหญ่ ค่าเริ่มต้น `All`), `--strict` (ภายใต้ `All` จะถือว่าล้มเหลวหากขาดเครื่องมือฝั่ง Sobree ด้วย) และ `--help` โดยรหัสออก (Exit Code) จะเป็น `0` เมื่อเครื่องมือที่บทบาทนั้นต้องการพร้อมใช้งาน (`READY`), `1` เมื่อขาดอย่างน้อยหนึ่งตัว และ `2` เมื่ออาร์กิวเมนต์ไม่ถูกต้อง ภายใต้ `All` หากขาดเครื่องมือฝั่ง Sobree จะแสดงเพียง `[PARTIAL]` และยัง exit `0` บน Windows สามารถใช้ `scripts/check-environment.ps1 -Role Rain` ซึ่งเรียกตัวตรวจเดียวกัน

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

บน Linux ให้เริ่ม Docker Engine ด้วย `sudo systemctl start docker` หากต้องการรัน `docker` โดยไม่ต้องใช้ `sudo` ให้เพิ่มผู้ใช้ของคุณเข้าในกลุ่ม `docker` (`sudo usermod -aG docker $USER`) แล้วออกจากระบบและเข้าใหม่

```bash
docker -v
docker compose version
docker info
```

### ตรวจสอบ Go Toolchain (สำหรับ Sobree)
```powershell
go version
```
- **หากยังไม่มี (Windows)**: ให้ดาวน์โหลดตัวติดตั้ง `.msi` จาก [go.dev/dl](https://go.dev/dl/) ทั้งนี้โมดูล Agent จำเป็นต้องใช้ Go 1.26 ขึ้นไป โปรดตรวจสอบบรรทัด `go` ใน `Sobree/agent-windows/go.mod` ก่อนทำการติดตั้ง
- **หากยังไม่มี (Linux)**: ให้ติดตั้ง Go 1.26 ขึ้นไปจากไฟล์ tarball ที่ [go.dev/dl](https://go.dev/dl/) หรือจากแพ็กเกจของดิสทริบิวชันหากเวอร์ชันใหม่พอ แล้วยืนยันด้วย `go version`

```bash
go version
```

---

## 4. การตั้งค่าตัวแปรสภาพแวดล้อม (`.env`)

การตั้งค่าระบบ Backend และ Gateway ทั้งหมดจะรวมอยู่ที่ไฟล์ `.env` เพียงไฟล์เดียว ณ Root ของโปรเจกต์ โดยมีไฟล์แม่แบบคือ [`.env.example`](.env.example)

### สร้างอัตโนมัติด้วยคำสั่งเดียว (ข้ามแพลตฟอร์ม)

```powershell
npm run env:init
```

```bash
npm run env:init
```

`npm run env:init` จะรัน `scripts/init-env.mjs` ซึ่งทำงานเหมือนกันบน Windows, Linux และ macOS โดยสร้าง `.env` จาก `.env.example` พร้อมค่า Secret แบบสุ่มใหม่ (`POSTGRES_PASSWORD`, `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET`, `TOTP_ENCRYPTION_KEY`) และคู่กุญแจ X25519 ของ WireGuard (`WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY`) เขียนเป็น UTF-8 ไม่มี BOM หากมี `.env` ที่มีกุญแจ WireGuard อยู่แล้ว ระบบจะไม่แก้ไข เว้นแต่สั่ง `npm run env:init -- --force` (หรือ `npm run env:init -- --wg-only` เพื่อสร้างเฉพาะกุญแจ WireGuard ใหม่) พร้อมพิมพ์ Server Public Key ที่สร้างขึ้นและเตือนไม่ให้ Commit ไฟล์นี้

### สร้างด้วยตนเอง

```powershell
copy .env.example .env
```

```bash
cp .env.example .env
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
| **3000** | TCP (HTTP) | Web Portal (Admin, ค่าเริ่มต้น) | คอนเทนเนอร์ของ Portal หรือ Vite dev server (`Rain/portal/vite.config.ts` ล็อกพอร์ต `3000`) ทั้ง `npm run dev:portal` และ `npm run dev:portal:admin` ให้บริการ Admin Portal ที่พอร์ตนี้ |
| **3001** | TCP (HTTP) | Web Portal (Staff) | เริ่มด้วย `npm run dev:portal:staff` หรือ `npm run dev:portal:all` |
| **3002** | TCP (HTTP) | Web Portal (Client) | เริ่มด้วย `npm run dev:portal:client` หรือ `npm run dev:portal:all` |
| **4000** | TCP (HTTP) | Control Plane API (Fastify) | ควบคุมโดยตัวแปร `PORT` |
| **15432** / **5432** | TCP (PostgreSQL) | PostgreSQL 16 บน `127.0.0.1:15432` | เริ่มด้วย `npm run db:start` (แบบฝังตัว ไม่ใช้ Docker) หรือคอนเทนเนอร์ Docker `postgres` (พอร์ตในคอนเทนเนอร์ `5432` พอร์ตบนเครื่อง Host คือ `POSTGRES_PORT` ค่าเริ่มต้น `15432`) |
| **47821** | TCP (HTTP, loopback) | Client Agent (`Sobree/agent-windows`) หรือ `mock-agent.js` | ผูกติดกับที่อยู่ `127.0.0.1` เท่านั้น |
| **51820** | UDP (WireGuard) | VPN gateway | ควบคุมโดยตัวแปร `WG_LISTEN_PORT` |
| **50051** | TCP (HTTP) | VPN gateway daemon API | HTTP ยืนยันตัวตนด้วย Bearer Token ทำงานที่ `127.0.0.1:50051` เริ่มโดย `npm run mock:daemon` (ตัวจำลองสำหรับการพัฒนาเท่านั้น ไม่บังคับใช้ `wg`/`nftables`) หรือ Docker `vpn-gateway` |

วิธีตรวจสอบว่าพอร์ตนั้นๆ กำลังถูกใช้งานอยู่หรือไม่บน Windows:
```powershell
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
```

บน Linux:
```bash
ss -tlnp | grep 4000
```

---

## 6. ขั้นตอนการตั้งค่าเริ่มต้นครั้งแรก (First-Time Setup)

รันคำสั่งเหล่านี้จาก Root ของโปรเจกต์:

```powershell
# 1. ติดตั้ง Dependencies ในทุก Workspaces (ใช้ npm เท่านั้น)
npm install

# 2. คอมไพล์ Shared Contracts ก่อน แล้วจึงคอมไพล์ทุก Workspace ที่มีสคริปต์ build
npm run build

# 3. สร้างไฟล์ .env พร้อมค่า Secret และกุญแจ WireGuard ใหม่ (ดูหัวข้อที่ 4)
npm run env:init
```

บน Linux หรือ macOS (Bash) รันขั้นตอนเดิมได้เลย `npm run env:init` ใช้ได้ทุกแพลตฟอร์ม หากต้องการสร้างเองด้วยมือ ให้ใช้ `copy .env.example .env` บน Windows หรือ `cp .env.example .env` บน Linux/macOS แล้วกรอกค่า Placeholder เอง

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

# Terminal 5: เซิร์ฟเวอร์ Dev ของ Portal เลือกได้ดังนี้:
npm run dev:portal                   # Admin UI บน :3000 (ค่าเริ่มต้น)
npm run dev:portal:all               # เปิด Admin :3000, Staff :3001 และ Client :3002 พร้อมกัน
npm run dev:demo                     # ทางลัด: เปิด mock-agent พร้อมทั้ง 3 พอร์ทัลใน Terminal เดียว (ข้าม Terminal 3 ได้)
npm run dev:portal:admin             # Admin UI บน :3000
npm run dev:portal:staff             # Staff UI บน :3001
npm run dev:portal:client            # Client UI บน :3002
```

คำสั่งเหล่านี้เป็น `npm run` ธรรมดา จึงใช้ได้เหมือนกันใน Bash บน Linux และ macOS

ค่าเริ่มต้น `CORS_ORIGIN` ของ API และ Allowed Origin ของ Agent ตั้งไว้ที่ `http://localhost:3000` และ `Rain/portal/vite.config.ts` ล็อกพอร์ตของ Vite ไว้ที่ `3000` ให้โดยอัตโนมัติ ดังนั้น `npm run dev:portal` ใช้งานได้ทันทีโดยไม่ต้องใส่ Flag เพิ่ม คุณสามารถทดสอบทุกบทบาท (`ADMIN`, `STAFF`, `CLIENT`) บนลิงก์เดียว `http://localhost:3000` ได้เลย เพราะพอร์ทัลจะส่ง `X-Mango-Dev-User` และ `scripts/mock-agent.js` จะแยกสถานะ Agent และ Device Fingerprint ตามชื่อผู้ใช้ (`mock-<hash>-<username>`) ให้อัตโนมัติ (ในโหมด dev `Sobree/api` ยังรองรับ `http://localhost:3000`–`http://localhost:3002` และ `127.0.0.1` เผื่อกรณีใช้ `dev:portal:all`)

นำค่า PairingToken ที่แสดงบน Terminal ของ Mock Agent ไปวางในช่อง "Paste X-Mango-Agent-Token" บนหน้าเว็บ เพื่อให้หน้าเว็บส่ง Header `X-Mango-Agent-Token` ไปยัง Agent ได้อย่างถูกต้อง

### ขั้นตอนการทำงานสำหรับ Sobree (API, Agent และ Gateway, ต้องใช้ Docker Desktop)

```powershell
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev:api

# รัน Client Agent บน Windows (โหมด Console เว้นแต่จะเริ่มผ่าน Service Control Manager)
cd Sobree/agent-windows
go run .

# รัน Gateway daemon หากอยู่บน Windows ให้รันผ่านคอนเทนเนอร์แทน:
docker compose up -d vpn-gateway
```

```bash
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev:api

# รัน Client Agent บน Linux (ต้องใช้ root หรือ CAP_NET_ADMIN และมี wg-quick)
cd Sobree/agent-windows
sudo -E go run .

# รัน Gateway daemon บน Linux แบบ Native (ต้องใช้ root หรือ NET_ADMIN พร้อม ip, wg และ nft)
cd Sobree/vpn-daemon
sudo -E go run .
```

เซอร์วิส `vpn-gateway` จำเป็นต้องใช้สิทธิ์ `NET_ADMIN` และคำสั่ง `wg`/`nft` บน Linux เท่านั้น สำหรับการรัน Daemon แบบ Native จะทำได้เฉพาะบนเครื่อง Linux จริง

### ตัวเลือกเสริม: เป้าหมายทดสอบการบังคับใช้สิทธิ์ของ Track B

เริ่มเป้าหมายเว็บแบบคงที่และหน้า Role Harness บน localhost ขั้นตอนการตั้งค่าและเมทริกซ์สิทธิ์ที่คาดหวังอยู่ใน [`docs/tutorial/th/06-appendix-local-docker-smoke-test.md`](docs/tutorial/th/06-appendix-local-docker-smoke-test.md)

```bash
npm run docker:test-targets:up     # postgres, vpn-gateway, เป้าหมาย 3 เครื่อง, target-routes, test-harness
npm run db:seed                    # หากยังไม่เคย Seed ฐานข้อมูล
npm run db:seed:test-targets       # Seed นโยบาย Track B จำนวน 12 รายการ (ไม่สร้างผู้ใช้)
# เปิดหน้า Role Harness บนเบราว์เซอร์: http://localhost:3090
npm run docker:test-targets:down   # หยุด Test Stack เมื่อทดสอบเสร็จ
```

> [!NOTE]
> `AGENT_ALLOWED_ORIGINS` ของ Agent ต้องมี `http://localhost:3090,http://127.0.0.1:3090` สำหรับหน้า Harness และต้องสร้าง `staff01` กับ `client01` ในแท็บ **Users** ของ Admin ก่อนทดสอบ

### การรัน Docker Stack ครบชุด

[`Rain/portal/nginx.conf`](Rain/portal/nginx.conf) ให้บริการ SPA บนพอร์ต `3000` พร้อม `Cache-Control: no-store` ที่ `/env-config.js` ให้ Build และเริ่ม Stack ครบชุด ตรวจ Healthcheck ของคอนเทนเนอร์ และ Seed บัญชี `ADMIN` คนแรก:

```powershell
docker compose up -d --build   # rebuild & เริ่ม postgres, vpn-gateway, api, portal
docker compose ps              # ตรวจว่าทั้ง 4 เซอร์วิส healthy
npm run docker:logs

# Seed ฐานข้อมูล (อ่าน DATABASE_URL จาก .env ที่ Root ให้อัตโนมัติ)
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD

npm run docker:down
```

```bash
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<at-least-12-characters>"
npm run db:seed
unset SEED_ADMIN_PASSWORD

npm run docker:down
```

> [!NOTE]
> `docker-compose.yml` เปิด `vpn-gateway` UDP `51820` ออกภายนอก และผูก daemon HTTP `:50051` กับ Host loopback `127.0.0.1:50051` (`VPN_DAEMON_URL=http://vpn-gateway:50051` ภายใน `mango-net` และ `http://127.0.0.1:50051` สำหรับ `npm run dev:api` ที่รันบน Host)

---

## 7. การตรวจสอบความเรียบร้อยของระบบ (Verify the Setup)

```powershell
# 1. ตรวจ Guardrail ด้านความปลอดภัยและการห้ามใช้ Mock (ต้องรายงาน 0 violations)
node scripts/check-guardrails.mjs

# 2. คอมไพล์ TypeScript ทั้ง Monorepo (@mango/shared ก่อน)
npm run build

# 3. ชุดทดสอบ Vitest (ต้องมี DATABASE_URL ชี้ไปยังฐานข้อมูล PostgreSQL ที่ Migrate v2 แล้ว)
#    แบบไม่ใช้ Docker: รัน `npm run db:start` ค้างไว้ก่อน แล้ว Migrate ฐานข้อมูลทดสอบและรันชุดทดสอบ
$env:DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
npm test
Remove-Item Env:DATABASE_URL         # เว้นค่าไว้ไม่ให้ตั้ง เพื่อให้ `npm run dev:api` ใช้ฐานข้อมูล mangovpn จาก .env
```

```bash
export DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
npm test
unset DATABASE_URL                   # เว้นค่าไว้ไม่ให้ตั้ง เพื่อให้ `npm run dev:api` ใช้ฐานข้อมูล mangovpn จาก .env
```

แทนค่า `<password>` ด้วย `POSTGRES_PASSWORD` จาก `.env` และให้เว้น `DATABASE_URL` ไว้ว่างในเทอร์มินัลที่รัน `npm run dev:api` เพื่อให้ API ใช้ฐานข้อมูล `mangovpn` จาก `.env`

หากฐานข้อมูล `mangovpn` ในเครื่องยังคงมีตาราง/ไมเกรชัน v1 เก่าอยู่ และการทดสอบล้มเหลวเพราะหา v2 type หรือตารางไม่เจอ (เช่น `type "public.RoleName" does not exist` หรือ `table "public.connect_tickets" does not exist`) ให้รีเซ็ตกลับเป็นสคีมา v2 แล้ว Seed ใหม่:

```powershell
npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma
npm run db:seed
```

หากมีการแก้ไขโค้ดภาษา Go ให้รัน Vet และ Test ในแต่ละโมดูล:
```powershell
cd Sobree/agent-windows; go vet ./...; go test ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; cd ../..
```

```bash
(cd Sobree/agent-windows && go vet ./... && go test ./... && GOOS=windows go vet ./... && cd ../..)
(cd Sobree/vpn-daemon && go vet ./... && go test ./... && cd ../..)
```

---

## 8. ทดลองใช้งานแบบทีละขั้น (Login -> TOTP -> Connect -> Admin -> Revoke)

1. **เริ่ม Services ในเครื่อง**:
   - **โหมด UI/Admin (ไม่ใช้ Docker)**: รัน `npm run db:start` (เปิดค้างไว้), `npm run mock:daemon`, `npm run mock:agent` (คัดลอก `PairingToken` ที่พิมพ์ออกมา), `npm run dev:api` และ `npm run dev:portal` (หรือ `npm run dev:portal:all` เพื่อเปิดทั้ง 3 บทบาท)
   - **โหมดอุโมงค์จริงบน Windows**: รัน `docker compose up -d postgres vpn-gateway api` จากนั้นใน **Administrator** PowerShell ให้รัน `Sobree/agent-windows` โดยติดตั้ง **WireGuard for Windows** ไว้แล้ว:
     ```powershell
     $env:AGENT_LISTEN_ADDR="127.0.0.1:47821"
     $env:AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
     $env:AGENT_PAIRING_TOKEN="<your-chosen-local-pairing-token>"
     $env:API_URL="http://localhost:4000"
     cd Sobree/agent-windows; go run .
     ```
   - **โหมดอุโมงค์จริงบน Linux (Bash)**: รัน Agent ด้วยสิทธิ์ root (หรือ `CAP_NET_ADMIN`) โดย Agent จะเขียนไฟล์ `/tmp/mango-vpn/mango0.conf` แล้วสั่ง `wg-quick up` กับไฟล์นั้น ใช้ค่า `AGENT_*` และ `API_URL` ชุดเดียวกัน:
     ```bash
     export AGENT_LISTEN_ADDR="127.0.0.1:47821"
     export AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
     export AGENT_PAIRING_TOKEN="<your-chosen-local-pairing-token>"
     export API_URL="http://localhost:4000"
     cd Sobree/agent-windows && sudo -E go run .
     ```
2. **เข้าสู่ระบบ (`http://localhost:3000`)**: ใส่ Username/Password ของ `ADMIN` ที่ Seed ไว้ (`POST /api/auth/login`)
3. **ยืนยันตัวตนด้วย TOTP MFA**: ในการล็อกอินครั้งแรก (`MFA_SETUP_REQUIRED`) ให้สแกน QR Code (`otpauthUri`) ด้วยแอป Authenticator แล้วกรอกรหัส 6 หลัก (`POST /api/auth/verify-otp`)
4. **จับคู่ Agent ในเครื่อง**: วางค่า `PairingToken` ในช่อง pairing-token ของ Portal (`X-Mango-Agent-Token`)
5. **เชื่อมต่อ VPN**: เปิดแท็บ **VPN Connect** ใน Sidebar แล้วกด **Connect VPN** -> Portal ขอตั๋วใช้ครั้งเดียว 60 วินาที (`POST /api/vpn/ticket`) -> Agent สร้างคู่กุญแจ Curve25519 ในหน่วยความจำ -> `POST /api/vpn/connect` จัดสรรหมายเลข IP ในช่วง `10.13.13.0/24` และตั้งค่า `wg0` + `nftables` -> การ์ด `AgentStatusCard` แสดงสถานะ **Connected** *(หมายเหตุ: `POST /api/vpn/connect` ต้องเข้าถึง `vpn-gateway` ได้ที่ `VPN_DAEMON_URL` มิฉะนั้นจะทำเครื่องหมายเซสชันเป็นตัดการเชื่อมต่อและคืนค่า `502`)*
6. **ทดสอบ Admin Console และการเพิกถอนแบบเรียลไทม์**: ลองใช้งาน **Users**, **Devices**, **Sessions** (รวมถึง **Terminate All Active**), **Policies**, **Gateways**, **Audit Logs** และ **Agent Versions** จากนั้นกด **Revoke Device** หรือ **Disconnect Session** และยืนยันว่า Peer ถูกถอดออกทันที (ในพอร์ทัล `STAFF` ลองเปิดแท็บ **Help** เพื่อดู/ดาวน์โหลดตัวติดตั้ง Agent จาก `GET /api/vpn/agent-versions`)

---

## 9. คู่มือแก้ไขปัญหาและดีบัก (Debugging & Troubleshooting Cheat Sheet)

| อาการ | สาเหตุ | วิธีแก้ / คำสั่ง |
| :--- | :--- | :--- |
| API เริ่มทำงานไม่ได้ | ค่า Secret ใน `.env` หายหรือสั้นเกินไป (`Sobree/api/src/config.ts`) | ตรวจสอบให้ `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET` ยาว `>= 32` ตัวอักษร และ `TOTP_ENCRYPTION_KEY` เป็นเลข hex 64 ตัวอักษร |
| `RoleName` หรือ `connect_tickets` ไม่มีอยู่ | ฐานข้อมูล `mangovpn` ในเครื่องยังเป็นสคีมา/ไมเกรชัน v1 | รัน `npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma` แล้ว `npm run db:seed` |
| `403 FORBIDDEN_ORIGIN` จาก Agent | Portal ทำงานบน Origin ที่ไม่อยู่ใน `AGENT_ALLOWED_ORIGINS` (ค่าเริ่มต้น `http://localhost:3000`–`http://localhost:3002`) | รัน `npm run dev:portal` (Admin `:3000`) หรือ `npm run dev:portal:all` (Admin `:3000`, Staff `:3001`, Client `:3002`) หรือเพิ่ม Origin นั้นเข้าใน `AGENT_ALLOWED_ORIGINS` และ `CORS_ORIGIN` |
| `401 Unauthorized` จาก Agent | `X-Mango-Agent-Token` หายหรือไม่ตรงกัน | วาง `PairingToken` จาก `npm run mock:agent` หรือกำหนด `$env:AGENT_PAIRING_TOKEN` (PowerShell) / `export AGENT_PAIRING_TOKEN=...` (Bash) ให้ชัดเจนก่อนรัน `go run .` (Go Agent จะไม่พิมพ์ Token ชั่วคราวออกมา) |
| `426` (`AGENT_VERSION_OUTDATED` / `INACTIVE`) | เวอร์ชัน Agent สำหรับแพลตฟอร์มนั้นถูกบล็อกหรือล้าสมัยใน `agent_versions` | เปิดใช้งานหรืออัปเดตเวอร์ชัน `2.0.0` สำหรับแพลตฟอร์มที่ Agent รายงาน: `windows-x64` บน Windows หรือ `linux-x64` บน Linux (ดู `AGENT_PLATFORM`) ในแท็บ **Agent Versions** ของ Portal |
| `502` ตอน Connect / Policy Sync / Revoke | `api` เข้าถึง `vpn-gateway` ไม่ได้ หรือ `DAEMON_SHARED_SECRET` ไม่ตรงกัน | แบบไม่ใช้ Docker (Track A): ยืนยันว่า `npm run mock:daemon` ทำงานที่ `127.0.0.1:50051` และ `DAEMON_SHARED_SECRET` ยาวอย่างน้อย 32 ตัวอักษร แบบ Docker: ตรวจ `docker compose ps vpn-gateway`, `docker compose logs vpn-gateway` และ `VPN_DAEMON_URL` |

**การตรวจสอบแบบสด (PowerShell; มีคำสั่งเทียบเท่าแบบ Bash ด้านล่าง)**:
```powershell
# ตรวจ Peer ของ WireGuard และ Chain นโยบาย nftables ภายใน vpn-gateway
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn

# ตรวจ Endpoint ของ Client Agent / mock-agent บน Loopback
Invoke-RestMethod http://127.0.0.1:47821/health
Invoke-RestMethod http://127.0.0.1:47821/status -Headers @{ "X-Mango-Agent-Token" = "<your-token>" }
Get-Content "$env:TEMP\mango-vpn\mango0.conf"
```

```bash
# การตรวจสอบเดียวกันบน Linux
ss -tlnp | grep 4000
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn
curl -s http://127.0.0.1:47821/health
curl -s -H "X-Mango-Agent-Token: <your-token>" http://127.0.0.1:47821/status
cat /tmp/mango-vpn/mango0.conf
```

---

## 10. เช็กลิสต์ก่อนปล่อยงาน & การติดตั้งบน Cloud (Pre-Ship & Cloud Deployment Checklist)

1. **ความพร้อมของ Repo ก่อนปล่อยงาน**:
   - อุปสรรคใน Local dev/Docker/CI (`Rain/portal/nginx.conf`, `docker-entrypoint.sh` แบบ LF, Go `1.26` + `prisma migrate deploy` + `windows-agent-tests` ใน `.github/workflows/ci.yml` และ Alias env `AGENT_*` / `MANGO_AGENT_*`) ได้รับการแก้ไขแล้ว ส่วนงาน Hardening/Rollout ที่เหลือติดตามใน GitHub Issues `#19`, `#20` และ `#21`
2. **ติดตั้ง Linux Gateway & Control Plane (AWS EC2 — Profile B ใน `.env.example`)**:
   - เปิด **UDP `51820`** (WireGuard) และ **HTTPS `443`** (Reverse proxy/ALB -> Portal `:3000` และ API `:4000`); ปิดพอร์ต `15432` ใน EC2 Security Group (`:50051` ผูกกับ `127.0.0.1` บน Host และอยู่ภายใน `mango-net`)
   - ตั้งค่า `NODE_ENV=production`, Secrets ที่แข็งแรง, `WG_SERVER_ENDPOINT=<AWS_PUBLIC_IP_OR_DNS>:51820`, `CORS_ORIGIN=https://vpn.example.com` และ `VITE_API_URL=https://api.vpn.example.com` แล้วรัน `docker compose up -d --build` และ `npm run db:seed`
3. **Build & แจกจ่าย Client Agent (`Sobree/agent-windows`, Windows หรือ Linux)**:
   - Build Binary (`$env:GOOS="windows"; $env:GOARCH="amd64"; go build -trimpath -ldflags="-s -w" -o mango-agent-windows.exe .`) และบันทึกค่า SHA-256 (`Get-FileHash`)
   - Linux / macOS (Bash): `GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o mango-agent-linux-x64 .` และ `GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o mango-agent-windows-x64.exe .` แล้วใช้ `sha256sum` กับแต่ละไฟล์
   - ลงทะเบียนแต่ละ Release ใน Admin **Agent Versions** (`platform`: `windows-x64` หรือ `linux-x64`) และตั้งค่า Env ฝั่ง Client (`AGENT_LISTEN_ADDR`, `AGENT_ALLOWED_ORIGINS`, `AGENT_PAIRING_TOKEN`, `API_URL`)
