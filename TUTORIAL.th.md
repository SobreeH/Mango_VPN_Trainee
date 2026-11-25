> 🌐 **Language / ภาษา**: [🇬🇧 English (`TUTORIAL.md`)](TUTORIAL.md) | **🇹🇭 ภาษาไทย (`TUTORIAL.th.md`)**

# MANGO VPN v2: คู่มือสำหรับผู้เริ่มต้นบน Windows และ Linux

ยินดีต้อนรับ! คู่มือนี้จะพาคุณตั้งแต่การเตรียมเครื่อง Windows หรือ Linux ไปจนถึงการสาธิต MANGO VPN v2 ที่ใช้งานได้จริง คำสั่งจะแยกตัวอย่าง **PowerShell** และ **Bash** ตามระบบปฏิบัติการ คุณไม่จำเป็นต้องรู้จัก Docker, Prisma หรือ WireGuard มาก่อน ทำตามทีละขั้นตอน และใช้หัวข้อ **สิ่งที่ควรเห็น (What you should see)** เพื่อตรวจสอบว่าทำถูกต้องแล้วหรือยัง

> **หมายเหตุด้านความปลอดภัย:** นี่คือการตั้งค่าสำหรับการพัฒนาและการสาธิตในเครื่องเท่านั้น ไม่ใช่การนำขึ้นใช้งานจริง (Production) โปรดเก็บไฟล์ `.env` ไว้เป็นความลับ และอย่านำค่า Secret ที่สร้างขึ้นไปใช้ที่อื่น

## ยินดีต้อนรับและภาพรวมใน 60 วินาที

MANGO VPN ให้ผู้ใช้ล็อกอินด้วยรหัสผ่านและรหัสผ่านครั้งเดียว (TOTP) จากแอปยืนยันตัวตน (Authenticator) ในขั้นตอนใช้งาน **ไม่มีการดาวน์โหลดไฟล์ VPN `.conf` ด้วยตนเอง** หลังล็อกอิน Web Portal จะได้รับ **ตั๋วเชื่อมต่อแบบใช้ครั้งเดียวที่หมดอายุใน 60 วินาที** Local Agent บนเครื่อง (Go ใน `Sobree/agent-windows` ซึ่งรองรับ Windows/Linux หรือ `scripts/mock-agent.js` สำหรับเดโม) จะสุ่มสร้างคู่กุญแจ Curve25519 ในหน่วยความจำ ส่ง Public Key ให้ Control Plane API แล้วเปิด WireGuard จริงเมื่อใช้ Go Agent: Windows เรียก `wireguard.exe /installtunnelservice` โดยใช้ไฟล์ชั่วคราว `%TEMP%\mango-vpn\mango0.conf`; Linux เรียก `wg-quick up` โดยใช้ `$TMPDIR/mango-vpn/mango0.conf` (ปกติคือ `/tmp/mango-vpn/mango0.conf`) ส่วน Linux Gateway จะเพิ่ม Peer และบังคับใช้นโยบายตามบทบาทด้วย `nftables`

### ส่วนประกอบทั้ง 5 ของระบบ

```mermaid
flowchart LR
    Browser["Web Portal - เว็บพอร์ทัล (localhost:3000/3001/3002)"] -->|HTTP API| API["Control Plane API (localhost:4000)"]
    API -->|SQL| DB[("PostgreSQL 16 (localhost:15432)")]
    Browser -->|"Loopback + โทเคนจับคู่"| Agent["Local Agent (Windows/Linux Host, 127.0.0.1:47821 - mock หรือ Go)"]
    Agent -->|"แลกตั๋ว + คีย์สาธารณะ"| API
    API -->|"Bearer HTTP"| Gateway["Linux VPN Gateway Daemon (127.0.0.1:50051)"]
    Agent -->|WireGuard UDP| WG["WireGuard gateway (51820/udp mango-vpn-gateway)"]
    Gateway -->|wg + nftables| WG
```

| ส่วนประกอบ | Address / พอร์ตในเครื่อง | หน้าที่ |
|---|---|---|
| Web Portal (เว็บพอร์ทัล) | `http://localhost:3000` (หรือ `:3001` / `:3002`) | หน้าล็อกอิน การลงทะเบียน TOTP การควบคุม VPN และหน้าจัดการสำหรับผู้ดูแล (Admin Governance UI) พอร์ต `3000/3001/3002` เป็น Admin/Staff/Client ตามลำดับ |
| Control Plane API (API ควบคุมระบบ) | `http://localhost:4000` | ยืนยันตัวตนด้วยรหัสผ่านและ TOTP, ออกตั๋วเชื่อมต่อที่มีอายุสั้น, จัดสรร IP และประสานงานกับ Gateway |
| PostgreSQL 16 | `localhost:15432` (พอร์ตในคอนเทนเนอร์ `5432`) | เก็บข้อมูลผู้ใช้ เซสชัน นโยบาย อุปกรณ์ และประวัติการตรวจสอบ (Audit) รัน Track A แบบฝังตัวด้วย `npm run db:start` (ข้อมูลอยู่ที่ `.local/postgres`) หรือรันเป็นคอนเทนเนอร์ Docker ชื่อ `mango-postgres` สำหรับ Track B/C |
| Local Agent (Agent บนเครื่อง Host) | `http://127.0.0.1:47821` | `scripts/mock-agent.js` สำหรับเดโม UI หรือ Go ใน `Sobree/agent-windows` สำหรับ WireGuard จริง: Windows ใช้ `wireguard.exe /installtunnelservice` และ Linux ใช้ `wg-quick up` |
| Linux VPN Gateway Daemon (เดมอน Gateway บน Linux) | `http://127.0.0.1:50051` (HTTP); `51820/udp` (WireGuard) | ตั้งค่าอินเทอร์เฟซ `wg0` และกฎ `nftables` ตามบทบาท Track A จำลองด้วย `npm run mock:daemon` (`scripts/mock-daemon.js` ใช้สำหรับการพัฒนาเท่านั้น ไม่มีการบังคับใช้ `wg`/`nftables`) ส่วน Track B/C ใช้ Docker service ชื่อ `mango-vpn-gateway` |

### ควรใช้ Track ไหนดี?

| Track | เลือก Track นี้ถ้า… | สิ่งที่พิสูจน์ได้ | สิ่งที่ต้องเตรียม |
|---|---|---|---|
| **Track A (Rain — ผู้พัฒนา UI และ Admin, ไม่ใช้ Docker)** | คุณกำลังเรียนรู้หน้าเว็บพอร์ทัลและ Admin CRUD หรือยังไม่ต้องการตั้งค่าอุโมงค์จริงบน Windows/Linux | การล็อกอินและ MFA, API, Admin CRUD, คำขอ Peer/นโยบายไปยัง Gateway และสถานะ UI ของ Agent จำลอง ทั้ง `mock:daemon` และ `mock:agent` **ไม่** เปิดอุโมงค์จริงหรือบังคับใช้ `nftables` | Node.js, Git และแอปยืนยันตัวตน ไม่ต้องใช้ Docker ใช้ `npm run db:start`, `npm run mock:daemon` และ `npm run mock:agent` |
| **Track B (Sobree — Go Agent และอุโมงค์ WireGuard จริง)** | คุณต้องการให้ Go Agent จริงติดตั้งอุโมงค์ `mango0` บน Windows หรือ Linux | ขั้นตอนตั๋วเชื่อมต่อจริง การสร้างคีย์ Agent การเปิดอุโมงค์บน Host และการตั้งค่า Peer/นโยบายบน Gateway | Node.js, Git, Go 1.26+ สำหรับ Agent (หรือ 1.22+ สำหรับ Daemon), WireGuard ที่ตรงกับ OS และ Docker Desktop บน Windows หรือ Docker Engine บน Linux สำหรับ `postgres` + `vpn-gateway`; บน Linux เลือกรัน `vpn-daemon` แบบ Native ได้ |
| **Track C (เดโม Docker ครบชุด)** | คุณต้องการเริ่ม API, พอร์ทัล, ฐานข้อมูล และ Gateway พร้อมกันในคอนเทนเนอร์ | สแต็กสี่คอนเทนเนอร์ ส่วน Agent รันแบบ Native บน Host ที่ `127.0.0.1:47821` | Node.js, Git, Docker Desktop (Windows) หรือ Docker Engine (Linux) และแอปยืนยันตัวตน เริ่ม `mock-agent.js` หรือ Go Agent บน Host เพราะเบราว์เซอร์ต้องเข้าถึง Loopback ของ Host |

## ระยะที่ 1: ตรวจสอบว่าคอมพิวเตอร์พร้อมใช้งาน (5 นาที)

### 1.1 ติดตั้งเครื่องมือสำหรับ Track ของคุณ

| เครื่องมือ | Rain / Track A | Sobree / Track B | เหตุผลที่ต้องใช้ |
|---|---:|---:|---|
| Node.js `>=18` (แนะนำ: `20 LTS`) | จำเป็น | จำเป็น | รัน API, พอร์ทัล, การ Build และการทดสอบ |
| npm `>=9` | จำเป็น | จำเป็น | ติดตั้ง Workspace ของ Monorepo มาพร้อมกับ Node.js |
| Git `>=2.30` | จำเป็น | จำเป็น | ดาวน์โหลดและจัดการไฟล์โปรเจกต์ |
| Docker Desktop (Windows) / Docker Engine (Linux) พร้อม Docker Compose v2 | ไม่จำเป็น (ใช้ `npm run db:start` และ `npm run mock:daemon`) | จำเป็นสำหรับ Docker `postgres` + `vpn-gateway`; Linux สามารถรัน Daemon แบบ Native แทนได้ | รันฐานข้อมูลและ Linux Gateway สำหรับ Track B/C |
| Go `>=1.26` (Agent) / `>=1.22` (Daemon) | ไม่จำเป็นสำหรับ Mock Agent | Go `>=1.26` สำหรับ `Sobree/agent-windows`; Go `>=1.22` สำหรับ `Sobree/vpn-daemon` | Go Agent สร้างและเปิดอุโมงค์ ส่วน Linux Daemon จัดการ Gateway |
| WireGuard ตามระบบปฏิบัติการ | ไม่จำเป็นสำหรับ Mock Agent | Windows: WireGuard for Windows (`wireguard.exe`); Linux: `wireguard-tools` (`wg`, `wg-quick`), `iproute2`, `nftables` | ใช้เปิด/ปิดอุโมงค์จริง และจัดการกฎ Gateway |
| สิทธิ์ระบบสำหรับอุโมงค์จริง | — | Windows: PowerShell แบบ Administrator; Linux: root (`sudo -E go run .`) หรือความสามารถ `CAP_NET_ADMIN` | จำเป็นต่อการสร้างอินเทอร์เฟซและตั้งค่าเครือข่าย |

Track A (Rain) **ไม่ต้องใช้ Docker เลย** `npm run db:start` รัน PostgreSQL 16 แบบฝังตัว และ `npm run mock:daemon` จำลอง API ของ Gateway Daemon ที่ `127.0.0.1:50051` ทำให้การเรียก API เรื่องนโยบายและการเพิกถอนมีปลายทาง ตัวจำลองนี้ใช้สำหรับการพัฒนาเท่านั้น ไม่ได้ตั้งค่า WireGuard หรือ `nftables` จริง Track B/C ใช้ Docker Desktop บน Windows หรือ Docker Engine บน Linux สำหรับ Gateway; Linux ยังเลือกใช้ Daemon แบบ Native ได้

### 1.2 รันการตรวจสอบความพร้อมของโปรเจกต์

เปิด PowerShell (Windows) หรือ Bash (Linux/macOS) แล้วเข้าโฟลเดอร์โปรเจกต์ ตัวอย่าง:

```powershell
cd C:\path\to\Mango_VPN_Trainee
npm run check:env
```

```bash
cd ~/path/to/Mango_VPN_Trainee
npm run check:env
```

Rain (Track A ที่ไม่ใช้ Docker) สามารถตรวจสอบเฉพาะบทบาทได้ คำสั่งนี้เหมือนกันทั้ง PowerShell และ Bash:

```sh
npm run check:env -- --role Rain
```

บน Windows ใช้สคริปต์ PowerShell ทางเลือกได้เช่นกัน: `scripts/check-environment.ps1 -Role Rain`.

**สิ่งที่ควรเห็น:** ตารางแสดงสถานะและเวอร์ชันของเครื่องมือ ตามด้วยข้อความความพร้อมสำหรับ Rain หาก Node.js และ npm พร้อมใช้งาน สคริปต์ตรวจว่าคำสั่งอยู่ใน `PATH` แต่ไม่ได้ติดตั้งเครื่องมือให้; เครื่องมือ WireGuard จะแสดงเป็นตัวเลือก เว้นแต่จะใช้โหมดอุโมงค์จริง ให้ตรวจ Go แยกต่างหาก:

```sh
go version
```

**สิ่งที่ควรเห็น:** Go `1.26` ขึ้นไปสำหรับ Agent และอย่างน้อย `1.22` สำหรับ Daemon หาก shell แจ้งว่าไม่รู้จักคำสั่ง ให้ติดตั้งเครื่องมือนั้นแล้วเปิดหน้าต่าง Terminal ใหม่เพื่อโหลด `PATH` ที่อัปเดต

### 1.3 ตรวจสอบว่า Docker ทำงานจริง (เฉพาะ Track B และ Track C)

Track A (Rain) ข้ามหัวข้อนี้ได้ และไปยังระยะที่ 2 ได้ทันที Track B/C ต้องมี Docker Engine ทำงานอยู่: ใช้ Docker Desktop บน Windows หรือ Docker Engine บน Linux

```sh
docker info
```

บน Linux หาก Docker Engine ยังไม่ทำงาน ให้เริ่มบริการก่อน แล้วตรวจสอบ:

```bash
sudo systemctl start docker
docker info
```

**สิ่งที่ควรเห็น:** รายงานยาวๆ ที่มีข้อมูลทั้ง **Client** และ **Server** หาก Windows แจ้ง `error during connect` ให้เปิด Docker Desktop และรอ **Engine running**; บน Linux ตรวจ `sudo systemctl start docker` และสถานะบริการ การมี Docker CLI อย่างเดียวไม่พอ ต้องให้ Docker Engine ทำงานอยู่

## ระยะที่ 2: ติดตั้งครั้งแรกและตั้งค่า `.env` แบบง่ายที่สุด (3 นาที)

ทำขั้นตอนเหล่านี้จากโฟลเดอร์รากของโปรเจกต์ใน PowerShell หรือ Bash

### ขั้นตอนที่ 2.1: ติดตั้งและ Build

```powershell
npm install
npm run build
```

`npm install` ติดตั้ง Dependency ของทุก npm Workspace ส่วน `npm run build` จะ Build `@mango/shared` ก่อนโดยอัตโนมัติ แล้วจึง Build Workspace อื่นที่มีสคริปต์ build

**สิ่งที่ควรเห็น:** `npm install` จบโดยไม่มีข้อผิดพลาด `npm ERR!` การ Build จบด้วยผลลัพธ์ของทุก Workspace และไม่มี TypeScript error คำเตือน (Warning) ไม่จำเป็นต้องหมายถึงความล้มเหลวเสมอไป แต่ Error และ Exit Code ที่ไม่ใช่ 0 คือความล้มเหลวจริง

### ขั้นตอนที่ 2.2: สร้าง `.env` และ Secret ที่แข็งแรง (ข้ามแพลตฟอร์ม)

API และ Docker Compose ต้องใช้ไฟล์ `.env` ที่รากโปรเจกต์ รันคำสั่งข้ามแพลตฟอร์มด้านล่างจากโฟลเดอร์รากโปรเจกต์ — ใช้งานได้เหมือนกันทั้งบน **Windows (PowerShell)** และ **Linux / macOS (Bash)** โดยไม่ต้องติดตั้งเครื่องมือเพิ่ม:

```bash
npm run env:init
```

สคริปต์ `scripts/init-env.mjs` จะคัดลอก `.env.example` แล้วเขียนไฟล์ `.env` (UTF-8 **แบบไม่มี BOM**) พร้อมค่าเหล่านี้โดยอัตโนมัติ:

- สุ่มรหัสผ่าน `POSTGRES_PASSWORD` แบบ URL-safe และนำรหัสเดียวกันไปใส่ใน `DATABASE_URL`
- สุ่มค่า Secret แบบ 32-byte Base64 แยกกันสำหรับ `JWT_SECRET`, `REFRESH_SECRET` และ `DAEMON_SHARED_SECRET`
- สุ่มคีย์ `TOTP_ENCRYPTION_KEY` ความยาว 64 ตัวอักษรฐานสิบหก (32 ไบต์)
- สุ่มคู่กุญแจ Curve25519 WireGuard สำหรับ `WG_PRIVATE_KEY` และ `WG_SERVER_PUBLIC_KEY`

**สคริปต์จะไม่เขียนทับค่า Secret เดิมหาก `.env` มีอยู่แล้ว** (และจะเติมเฉพาะ `WG_PRIVATE_KEY` / `WG_SERVER_PUBLIC_KEY` ให้หากยังว่างอยู่) หากต้องการสร้างใหม่ทั้งหมดให้ส่ง `-- --force` (`npm run env:init -- --force`) หรือส่ง `-- --wg-only` เพื่อหมุนเวียนเฉพาะคู่กุญแจ WireGuard

**สิ่งที่ควรเห็น:** เมื่อสร้างครั้งแรกจะแสดง `Created .env with fresh random secrets and WireGuard keypair (UTF-8 without BOM). Server Public Key: ...` หากไฟล์ `.env` มีค่าครบอยู่แล้ว สคริปต์จะแจ้งว่าไม่มีการเปลี่ยนแปลงไฟล์ อย่าเปิดเผยค่า Secret หรือ Commit `.env`

<details>
<summary>ทางเลือก: สร้างไฟล์และ Secret ด้วยตนเอง (PowerShell / Bash OpenSSL)</summary>

หากต้องการสร้าง `.env` ด้วยตนเอง ให้คัดลอก `.env.example` เป็น `.env`:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

จากนั้นใช้ OpenSSL (คำสั่งเดียวกันใน PowerShell และ Bash หากติดตั้ง OpenSSL) หรือสคริปต์ PowerShell/.NET ด้านล่างเพื่อสุ่มค่าแล้ววางลงใน `.env`:

```sh
openssl rand -base64 32   # สร้างแยกกันสำหรับ JWT_SECRET, REFRESH_SECRET, DAEMON_SHARED_SECRET
openssl rand -hex 32      # TOTP_ENCRYPTION_KEY (64 hex chars)
openssl rand -hex 24      # POSTGRES_PASSWORD; ใช้ค่าเดียวกันใน DATABASE_URL ด้วย
```

```powershell
function New-Secret([int]$Bytes, [switch]$Hex) {
    $data = [byte[]]::new($Bytes)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($data) } finally { $rng.Dispose() }
    if ($Hex) { return [BitConverter]::ToString($data).Replace('-', '').ToLowerInvariant() }
    return [Convert]::ToBase64String($data)
}
New-Secret 32
New-Secret 32
New-Secret 32
New-Secret 32 -Hex
New-Secret 24 -Hex
```

ผลลัพธ์ทั้งห้าคือ: JWT Secret, Refresh Secret, Daemon Secret, TOTP Key แล้ว PostgreSQL Password ตามลำดับ ใช้ PostgreSQL Password เดียวกันใน `DATABASE_URL` และสร้างคู่กุญแจ WireGuard ด้วย `npm run env:init -- --wg-only` หรือ `wg genkey` / `wg pubkey` สำหรับ Track B

</details>

### ตัวแปรใน `.env` แต่ละตัวทำหน้าที่อะไร

| ตัวแปร | หน้าที่ |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | ตั้งค่า PostgreSQL ทั้ง **คอนเทนเนอร์ Docker** `postgres` (Track B/C) และ **PostgreSQL 16 แบบฝังตัว** ที่เริ่มด้วย `npm run db:start` (Track A ข้อมูลอยู่ที่ `.local/postgres`) เทมเพลตที่ให้มาใช้ user `mango`, database `mangovpn` และพอร์ต Host `15432` |
| `DATABASE_URL` | บอก Prisma และ API ที่รันบนเครื่อง Host ว่าจะเชื่อมต่อฐานข้อมูลอย่างไร ให้ username, รหัสผ่าน, พอร์ต และชื่อ database ตรงกับค่า PostgreSQL เสมอ |
| `JWT_SECRET`, `REFRESH_SECRET` | ใช้ลงนามและรักษาความปลอดภัยให้การเข้าถึง API และเซสชันการรีเฟรช แต่ละค่าต้องยาวอย่างน้อย 32 ตัวอักษร และต้องเป็นค่าสุ่มแยกจากกัน |
| `TOTP_ENCRYPTION_KEY` | เข้ารหัสข้อมูลความลับของ TOTP ต้องมีความยาวตรง 64 ตัวอักษรฐานสิบหก (32 ไบต์) |
| `DAEMON_SHARED_SECRET` | ข้อมูลยืนยันตัวตนแบบ Bearer ที่ API และ Gateway ใช้ร่วมกัน ต้องยาวอย่างน้อย 32 ตัวอักษร และต้องตรงกันทั้งสองบริการ |
| `NODE_ENV`, `PORT`, `API_PORT`, `CORS_ORIGIN` | โหมดการทำงานของ API, พอร์ตของ API (ค่าเริ่มต้น `4000`) และ Origin ของพอร์ทัลที่อนุญาต (ค่าเริ่มต้น `http://localhost:3000`) |
| `WG_INTERFACE`, `WG_LISTEN_PORT`, `WG_GATEWAY_CIDR`, `WG_DNS`, `WG_SERVER_ENDPOINT` | การตั้งค่าอินเทอร์เฟซและเครือข่ายของ Gateway ค่าเริ่มต้นในเครื่องได้แก่ `wg0`, UDP `51820`, `10.13.13.1/24`, DNS `1.1.1.1` และ Endpoint `127.0.0.1:51820` |
| `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY` | คู่กุญแจ WireGuard ของเซิร์ฟเวอร์ Gateway ไม่จำเป็นสำหรับการเดโม UI ของ Mock ใน Track A แต่จำเป็นสำหรับอุโมงค์ WireGuard จริงใน Track B ควรเก็บ Private Key ไว้เป็นความลับ |
| `VITE_API_URL`, `VITE_AGENT_URL`, `PORTAL_PORT` | ที่อยู่ API และ Agent ของพอร์ทัล และพอร์ต Host ของคอนเทนเนอร์พอร์ทัล ค่าในเครื่องคือ API `http://localhost:4000`, Agent `http://127.0.0.1:47821` และพอร์ตพอร์ทัล `3000` |

## ระยะที่ 3: รันโปรเจกต์ (3 Track ที่ชัดเจน)

เลือก **หนึ่ง** Track ในคู่มือนี้ ทุกคำสั่งใน Terminal ให้รันจากโฟลเดอร์รากของโปรเจกต์ เว้นแต่ขั้นตอนจะระบุให้เปลี่ยนโฟลเดอร์

### 🌧️ Track A: ขั้นตอนของ Rain (Web Portal + Admin CRUD + ตัวจำลอง Mock Agent, ไม่ใช้ Docker)

Track A ไม่ต้องใช้ Docker เลย โดยใช้เครื่องมือในเครื่องสามตัวแทน:

- **PostgreSQL 16 แบบฝังตัว** ผ่าน `npm run db:start` ทำงานที่ `127.0.0.1:15432` และเก็บข้อมูลไว้ที่ `.local/postgres`
- **ตัวจำลอง Gateway Daemon** ผ่าน `npm run mock:daemon` เป็น Simulator ของ API ของ Gateway ที่ `http://127.0.0.1:50051` ใช้สำหรับการพัฒนาเท่านั้น และจะพิมพ์ `[DEV MOCK DAEMON – no wg/nftables enforcement]`
- **Mock Local Agent** ผ่าน `npm run mock:agent` ที่ `http://127.0.0.1:47821`

`POST /api/vpn/connect`, การสร้าง Policy และการเพิกถอนอุปกรณ์/เซสชัน จะเรียก Gateway ที่ `127.0.0.1:50051` การรัน `npm run mock:daemon` ช่วยไม่ให้เจอ `502 Bad Gateway` โดยไม่ต้องใช้ Docker แต่ **ใช้สำหรับการพัฒนาเท่านั้น** มันไม่ได้ตั้งค่า WireGuard หรือ `nftables` จึงพิสูจน์ได้แค่ flow ของ API และ UI ไม่ใช่การบังคับใช้จริงบนเครือข่าย Mock Agent ก็จำลองสัญญาของ Agent แบบ Loopback และการแสดงผลที่เชื่อมต่อเช่นกัน แต่ **ไม่** ติดตั้งอุโมงค์ WireGuard และไม่ได้พิสูจน์ว่ามีทราฟฟิกเครือข่ายจริงไหลผ่าน

#### ขั้นตอน A1: เริ่ม PostgreSQL แบบฝังตัวและเตรียมฐานข้อมูล

เปิด **Terminal 1** แล้วเริ่มฐานข้อมูลแบบฝังตัว และปล่อยให้ทำงานไว้:

```powershell
npm run db:start
```

บน Linux/macOS (Bash) ใช้คำสั่งเดียวกัน:

```bash
npm run db:start
```

กด **Ctrl+C** ใน Terminal นี้เพื่อหยุด PostgreSQL อย่างถูกต้อง เมื่อหยุดแล้ว `npm run db:reset-local` จะลบ `.local/postgres` ซึ่งทำให้ข้อมูลฐานข้อมูลในเครื่องหายทั้งหมด

จากนั้นเปิด **อีกหน้าต่างหนึ่ง** (หน้าต่างสำหรับตั้งค่า) แล้วรันจากรากโปรเจกต์:

```powershell
npm run db:generate
npm run db:migrate
```

บน Linux/macOS (Bash):

```bash
npm run db:generate
npm run db:migrate
```

`db:generate` สร้าง Prisma Client จาก Schema ปัจจุบัน ส่วน `db:migrate` ใช้ Migration สำหรับการพัฒนาที่บันทึกไว้ในโปรเจกต์กับฐานข้อมูล `mangovpn`

**สิ่งที่ควรเห็น:** Terminal 1 แสดง `PostgreSQL running at 127.0.0.1:15432` และสร้างทั้ง `mangovpn` (จาก `POSTGRES_DB`) และ `mangovpn_v2_test` โดยอัตโนมัติ การ Generate และ Migrate ของ Prisma เสร็จโดยไม่มี Error

> **ฐานข้อมูลสำหรับทดสอบ (ต้องทำก่อนรัน `npm test`):** `npm test` ใช้ `mangovpn_v2_test` ให้ Migrate หนึ่งครั้งในหน้าต่างสำหรับตั้งค่า โดยแทน `<password>` ด้วย `POSTGRES_PASSWORD` จาก `.env`:
>
> ```powershell
> $env:DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
> npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
> Remove-Item Env:DATABASE_URL
> ```
>
> Bash (แทน `<password>` ด้วย `POSTGRES_PASSWORD` จาก `.env`):
>
> ```bash
> export DATABASE_URL='postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public'
> npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
> unset DATABASE_URL
> ```
>
> ใน Terminal ที่รัน `npm run dev:api` ให้ **ไม่ตั้งค่า** `DATABASE_URL` เพื่อให้ API ใช้ฐานข้อมูล `mangovpn` จาก `.env` หากตั้งไว้ ให้รัน `Remove-Item Env:DATABASE_URL` ใน PowerShell หรือ `unset DATABASE_URL` ใน Bash หรือเปิด Terminal ใหม่

#### ขั้นตอน A2: สร้างบัญชี ADMIN คนแรก (Seed)

เลือกรหัสผ่านส่วนตัวที่ยาว **อย่างน้อย 12 ตัวอักษร** ตัวอย่างด้านล่างเป็นเพียงตัวอย่าง (Placeholder) ให้แทนที่ด้วยรหัสผ่านที่คุณเลือกเอง และ **จดชื่อผู้ใช้และรหัสผ่านไว้ในที่ปลอดภัย** คำสั่ง Seed จะไม่แสดงรหัสผ่านให้เห็น

```powershell
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

บน Linux/macOS (Bash):

```bash
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

ตัวอย่างรหัสผ่านทดสอบในเครื่องที่ใช้ได้คือ `StaffTestPass#2026` แต่อย่าใช้ตัวอย่างนี้กับระบบที่เปิดให้เข้าถึงจากอินเทอร์เน็ต ต้องมีความยาวอย่างน้อย 12 ตัวอักษร Seed จะสร้างหรืออัปเดต Role `ADMIN`, `STAFF` และ `CLIENT` รวมถึงผู้ใช้ ADMIN เริ่มต้น หากต้องการอีเมลอื่น ให้กำหนด `SEED_ADMIN_EMAIL` ก่อนรัน Seed (PowerShell: `$env:SEED_ADMIN_EMAIL="you@example.test"`; Bash: `export SEED_ADMIN_EMAIL="you@example.test"`) มิฉะนั้นระบบจะใช้ `admin@mangovpn.local`

**สิ่งที่ควรเห็น:** ข้อความทำนองว่า `Seeded roles [ADMIN, STAFF, CLIENT] and ADMIN user "admin".` และ shell กลับมาที่บรรทัดคำสั่งหลังจากลบตัวแปรรหัสผ่านแล้ว

#### ขั้นตอน A3: เปิด Terminal ห้าหน้าต่าง

ให้เปิดทั้งห้า Terminal ไว้ระหว่างใช้งานพอร์ทัล โดยเริ่มแต่ละหน้าต่างจากโฟลเดอร์รากโปรเจกต์

**Terminal 1 — PostgreSQL 16 แบบฝังตัว (เริ่มจากขั้นตอน A1 แล้ว)**

ปล่อยหน้าต่าง `npm run db:start` ไว้ อย่าปิดระหว่างที่ API หรือการทดสอบยังใช้ฐานข้อมูลอยู่

**Terminal 2 — ตัวจำลอง Gateway Daemon (เฉพาะการพัฒนา)**

```powershell
npm run mock:daemon
```

บน Linux/macOS ใช้ `npm run mock:daemon` เหมือนกัน

**สิ่งที่ควรเห็น:** `[DEV MOCK DAEMON – no wg/nftables enforcement]` ตามด้วย `This simulator does not program WireGuard or nftables.` และ `Listening on http://127.0.0.1:50051` ตัวจำลองอ่าน `DAEMON_SHARED_SECRET` จาก `.env` และจะไม่เริ่มทำงานหากค่านี้ไม่มีอยู่หรือสั้นกว่า 32 ตัวอักษร ข้อมูล Peer และ Policy เก็บไว้ในหน่วยความจำเท่านั้น

**Terminal 3 — Agent จำลองบนเครื่อง (Mock Local Agent)**

```powershell
npm run mock:agent
```

บน Linux/macOS ใช้ `npm run mock:agent` เหมือนกัน

**สิ่งที่ควรเห็น:** กล่องข้อความเริ่มต้นหัวข้อ `MANGO VPN - Local Windows Agent Simulator (v2)` พร้อม address `http://127.0.0.1:47821` ให้หาบรรทัด `PairingToken:` แล้วคัดลอกค่า Token ทั้งหมด ปล่อย Terminal นี้ทำงานต่อไป Mock จะสร้าง Token ใหม่ทุกครั้งที่เริ่มทำงาน เว้นแต่คุณจะกำหนดค่าเองไว้ ตัว Mock ตรวจจับ OS และสถาปัตยกรรมเพื่อกำหนด Platform โดยอัตโนมัติ

**Terminal 4 — Control Plane API**

```powershell
npm run dev:api
```

บน Linux/macOS ใช้ `npm run dev:api` เหมือนกัน

**สิ่งที่ควรเห็น:** Log ของ Fastify แจ้งว่ากำลัง Listen ที่ `:4000` (มักเป็น `http://127.0.0.1:4000`) ปล่อยให้ทำงานไว้ หาก Secret หายไปหรือไม่ถูกต้อง หรือฐานข้อมูลเข้าถึงไม่ได้ API จะเริ่มทำงานไม่สำเร็จ ให้ตรวจสอบ `.env` และสถานะของคอนเทนเนอร์

**Terminal 5 — Web Portal**

```powershell
npm run dev:portal
```

คำสั่งนี้เปิด Portal เดียวที่ `:3000` หากต้องการทดสอบทั้งสามบทบาทพร้อมกัน ให้ใช้ `npm run dev:portal:all` ซึ่งรัน `scripts/start-all-portals.mjs` เปิด Admin `:3000`, Staff `:3001` และ Client `:3002` ใน Terminal เดียว

**สิ่งที่ควรเห็น:** Vite แสดง `http://localhost:3000/` (หรือแสดง URL ของทั้งสามพอร์ตเมื่อใช้ `dev:portal:all`) เปิด URL ที่ต้องการในเบราว์เซอร์

### ⚡ Track B: ขั้นตอนของ Sobree (Control Plane + Go Agent จริง + อุโมงค์ WireGuard)

Track B ใช้ Go Agent ตัวจริงได้ทั้ง Windows และ Linux. Windows ต้องติดตั้ง WireGuard for Windows; Agent เรียก `wireguard.exe /installtunnelservice` และต้องรันจาก **Administrator PowerShell** โดยเขียนไฟล์ชั่วคราว `%TEMP%\mango-vpn\mango0.conf`. Linux ต้องติดตั้ง `wireguard-tools` (`wg`, `wg-quick`), `iproute2` และ `nftables`; Agent เรียก `wg-quick up` โดยใช้ `$TMPDIR/mango-vpn/mango0.conf` (ปกติ `/tmp/mango-vpn/mango0.conf`) และต้องใช้ root (`sudo -E go run .`) หรือมี `CAP_NET_ADMIN` สำหรับ Gateway เลือก Docker Desktop/Engine ที่รัน `postgres` + `vpn-gateway` หรือรัน `Sobree/vpn-daemon` แบบ Native บน Linux

#### ขั้นตอน B1: เริ่ม PostgreSQL และ Gateway แล้วตั้งค่าคู่กุญแจของ Gateway

```sh
docker compose up -d postgres vpn-gateway
docker compose ps
```

**สิ่งที่ควรเห็น:** `mango-postgres` และ `mango-vpn-gateway` กำลังทำงานอยู่ รอจนกว่า Health Check จะขึ้น `healthy` ก่อนดำเนินการต่อ

หากคุณสร้าง `.env` ด้วย `npm run env:init` แล้ว ระบบจะเติมค่า `WG_PRIVATE_KEY` และ `WG_SERVER_PUBLIC_KEY` ให้เรียบร้อยแล้ว หากต้องการสร้างหรือหมุนเวียนคู่กุญแจใหม่ (ทั้งบน Windows และ Linux) ให้รัน:

```bash
npm run env:init -- --wg-only
```

หรือสร้างคู่กุญแจผ่านคำสั่ง `wg` ภายในคอนเทนเนอร์ Gateway แล้วบันทึกลง `.env` โดยตรง (ไม่แสดง Private Key บนหน้าจอ):

```powershell
$wgPrivate = (docker exec mango-vpn-gateway wg genkey).Trim()
$wgPublic = ($wgPrivate | docker exec -i mango-vpn-gateway wg pubkey).Trim()
$envPath = Join-Path (Get-Location) '.env'
$envText = [System.IO.File]::ReadAllText($envPath)
$envText = [regex]::Replace($envText, '(?m)^WG_PRIVATE_KEY=.*$', "WG_PRIVATE_KEY=$wgPrivate")
$envText = [regex]::Replace($envText, '(?m)^WG_SERVER_PUBLIC_KEY=.*$', "WG_SERVER_PUBLIC_KEY=$wgPublic")
[System.IO.File]::WriteAllText($envPath, $envText, [System.Text.UTF8Encoding]::new($false))
Write-Host "Updated WG_PRIVATE_KEY and WG_SERVER_PUBLIC_KEY in .env (Server Public Key: $wgPublic)"
```

```bash
wg_private=$(docker exec mango-vpn-gateway wg genkey | tr -d '\r\n')
wg_public=$(printf '%s' "$wg_private" | docker exec -i mango-vpn-gateway wg pubkey | tr -d '\r\n')
sed -i \
  -e "s|^WG_PRIVATE_KEY=.*|WG_PRIVATE_KEY=$wg_private|" \
  -e "s|^WG_SERVER_PUBLIC_KEY=.*|WG_SERVER_PUBLIC_KEY=$wg_public|" \
  .env
echo "Updated WG_PRIVATE_KEY and WG_SERVER_PUBLIC_KEY in .env (Server Public Key: $wg_public)"
```

หลังเปลี่ยนคีย์ ตรวจว่า `WG_PRIVATE_KEY` กับ Public Key ที่ตรงกันใน `.env` ถูกบันทึกแล้ว ก่อนสร้าง Gateway container ใหม่เพื่อโหลดค่า:

```sh
docker compose up -d --force-recreate vpn-gateway
npm run db:generate
npm run db:migrate
```

ตั้งค่า Seed โดยใช้ Password ส่วนตัวที่มีอย่างน้อย 12 ตัวอักษร:

```powershell
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

```bash
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

ใช้รหัสผ่านเดียวกันกับที่คุณตั้งใจจะกรอกในเบราว์เซอร์ และจดไว้ในที่ปลอดภัย รหัสผ่านต้องมีความยาวอย่างน้อย 12 ตัวอักษร หากคุณเคย Seed ADMIN คนเดิมไปแล้ว การรัน Seed อีกครั้งจะอัปเดตบัญชีนั้นให้ใช้ข้อมูลล็อกอินที่คุณระบุ

**สิ่งที่ควรเห็น:** Gateway กลับมาเป็น `healthy` คำสั่ง Prisma ทำงานสำเร็จ และ Seed รายงาน Role ทั้งสามและผู้ใช้ ADMIN

#### ขั้นตอน B2: เริ่ม API และพอร์ทัล

เปิด Terminal สองหน้าต่างแยกกันที่รากโปรเจกต์ ในหน้าต่างแรกให้รัน (เหมือนกันทั้ง PowerShell และ Bash):

```sh
npm run dev:api
```

ในหน้าต่างที่สองให้รัน:

```sh
npm run dev:portal
```

**สิ่งที่ควรเห็น:** API แจ้งว่ากำลัง Listen ที่ `:4000` และ Vite แสดง `http://localhost:3000/` ปล่อยทั้งสอง Terminal ไว้

#### ขั้นตอน B3: เริ่ม Go Agent ตัวจริงบน Host

เปิด Terminal แยกต่างหาก แล้วตั้งค่าที่อยู่ Agent, รายการ Origin ที่อนุญาต, Pairing Token และ API URL (เปลี่ยน Token ตัวอย่างเป็นค่าของคุณเองได้):

```powershell
$env:AGENT_LISTEN_ADDR="127.0.0.1:47821"
$env:AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002"
$env:AGENT_PAIRING_TOKEN="my-local-dev-pairing-token-01"
$env:API_URL="http://localhost:4000"
cd Sobree/agent-windows
go run .
```

บน **Windows** ให้ใช้ Administrator PowerShell สำหรับอุโมงค์จริง ส่วน **Linux (Bash)** ให้ติดตั้ง `wireguard-tools`, `iproute2`, `nftables` แล้วใช้:

```bash
export AGENT_LISTEN_ADDR="127.0.0.1:47821"
export AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002"
export AGENT_PAIRING_TOKEN="my-local-dev-pairing-token-01"
export API_URL="http://localhost:4000"
cd Sobree/agent-windows && sudo -E go run .
```

บน Linux Agent จะใช้ `wg-quick` กับไฟล์ `$TMPDIR/mango-vpn/mango0.conf` (หากไม่ได้กำหนด `TMPDIR` โดยทั่วไปคือ `/tmp/mango-vpn/mango0.conf`). อนึ่ง Linux สามารถรัน Gateway Daemon แบบ Native แทน `vpn-gateway` container ได้ เมื่อติดตั้ง `wireguard-tools`, `iproute2`, `nftables` และตั้งค่าคู่กุญแจ/Secret ใน `.env` แล้ว เปิด Terminal จากรากโปรเจกต์และโหลด environment ก่อนสั่งรัน:

```bash
set -a
. ./.env
set +a
(cd Sobree/vpn-daemon && sudo -E go run .)
```

API ที่รันบน Host จะเรียก Daemon ที่ `http://127.0.0.1:50051` ตามค่าเริ่มต้น ทั้งสองบริการต้องใช้ `DAEMON_SHARED_SECRET` เดียวกัน

Go Agent ตั้งใจ **ไม่** แสดง Pairing Token ออกทาง stdout การตั้งค่า `$env:AGENT_PAIRING_TOKEN` ด้วยตัวเองทำให้คุณรู้ค่าที่จะวางในเบราว์เซอร์ หากคุณไม่ตั้งค่านี้ Agent อาจแจ้งว่าสร้าง Ephemeral Token ขึ้นมาให้ แต่ข้อความนั้นจะไม่เปิดเผยค่า Token


### 🐳 Track C: Docker Stack ครบชุดด้วยคำสั่งเดียว (คอนเทนเนอร์ 4 ตัว)

Track C ใช้ Docker Desktop บน Windows หรือ Docker Engine บน Linux เพื่อรัน `postgres`, `vpn-gateway`, `api` และ `portal` ส่วน Agent รันแบบ Native บน Host (Windows/Linux) ที่ `127.0.0.1:47821` เพื่อให้เบราว์เซอร์เข้าถึง Loopback ได้

#### ขั้นตอน C1: Build และเริ่มคอนเทนเนอร์

```powershell
docker compose up -d --build
docker compose ps
```

```bash
docker compose up -d --build
docker compose ps
```

Dockerfile ของ API จะรัน `prisma migrate deploy` ให้โดยอัตโนมัติเมื่อคอนเทนเนอร์ API เริ่มทำงาน

**สิ่งที่ควรเห็น:** บริการทั้งสี่ (`postgres`, `vpn-gateway`, `api` และ `portal`) แสดงสถานะกำลังทำงาน (up/running) PostgreSQL และ Gateway มี Health Check และควรขึ้น `healthy` ส่วน API และพอร์ทัลอาจขึ้นเป็น `Up` โดยไม่มีป้ายสถานะ Health แยก พอร์ทัลเผยแพร่ที่ `http://localhost:3000` และ API ที่ `http://localhost:4000`

#### ขั้นตอน C2: Generate Prisma Client หากจำเป็น และ Seed ADMIN

รันคำสั่งเหล่านี้บนเครื่อง Host จากโฟลเดอร์รากโปรเจกต์ ต้องรัน `npm run db:generate` ก่อนคำสั่ง Prisma ฝั่ง Host หากยังไม่เคย Generate Client ค่า `DATABASE_URL` ของ Host มาจาก `.env` ที่รากโปรเจกต์

```powershell
npm run db:generate
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

```bash
npm run db:generate
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

**สิ่งที่ควรเห็น:** การ Generate Prisma สำเร็จ และ Seed รายงาน Role และผู้ใช้ ADMIN เริ่มต้น ใช้รหัสผ่านที่คุณเลือก และจดไว้ให้ปลอดภัย รหัสผ่านต้องมีความยาวอย่างน้อย 12 ตัวอักษร

#### ขั้นตอน C3: รัน Agent โดยตรงบน Host

เปิด Terminal ใหม่บน Host แล้วรัน `npm run mock:agent` (ไม่มีอุโมงค์จริง) หรือทำตามขั้นตอน B3 เพื่อเริ่ม Go Agent (อุโมงค์จริง) Agent ต้องรันบน Host เดียวกับเบราว์เซอร์เพื่อให้เข้าถึง `127.0.0.1:47821` ได้

**สิ่งที่ควรเห็น:** กรณีแรกคือกล่องข้อความของ Mock และบรรทัด `PairingToken:` ส่วนกรณีที่สองคือ Log ของ Go ที่แจ้งว่า Listen อยู่ พอร์ทัลพร้อมใช้งานที่ `http://localhost:3000`

## ระยะที่ 4: คู่มือทดสอบแบบโต้ตอบทีละขั้นตอน ("ต้องทำอะไรบ้างเพื่อทดสอบ")

พอร์ทัลรองรับภาษาไทย/อังกฤษ (TH/EN) และธีม Dark/Light โดยเปลี่ยนได้จากหน้าเว็บ ในหน้า Admin การ์ด Agent อยู่ในแผง VPN แบบพับเก็บได้ ให้เปิดแผง VPN หากยังไม่เห็นการ์ด

### 🎯 ภารกิจที่ 1: ล็อกอินครั้งแรกและตั้งค่า TOTP Authenticator

1. เปิด `http://localhost:3000` ในเบราว์เซอร์ กรอก username `admin` และรหัสผ่านที่ตั้งไว้ตอน Seed จากนั้นคลิกปุ่ม **Sign In** (เข้าสู่ระบบ)

   **สิ่งที่ควรเห็น:** หน้าจอ **Set Up Authenticator** (ตั้งค่าแอปยืนยันตัวตน) เมื่อล็อกอินครั้งแรก หากบัญชีนั้นลงทะเบียน TOTP ไว้แล้ว จะแสดง **Two-Factor Verification** (การยืนยันสองขั้นตอน) แทน

2. ในการลงทะเบียนครั้งแรก ให้ใช้ QR Code กับ Google Authenticator, Microsoft Authenticator, Authy หรือแอป TOTP อื่นที่เข้ากันได้ หรือจะกรอกคีย์ Base32 ที่แสดงอยู่ลงในแอปด้วยตนเองก็ได้ เก็บคีย์นี้เป็นความลับ เพราะมันสร้างรหัสสำหรับล็อกอินได้

   **สิ่งที่ควรเห็น:** แอปยืนยันตัวตนสร้างรหัสหกหลักที่เปลี่ยนไปเรื่อยๆ สำหรับ MANGO VPN

3. กรอกรหัสปัจจุบันในช่อง **6-Digit Code** (รหัส 6 หลัก) แล้วคลิกปุ่ม **Verify** (ยืนยัน) หากรหัสเปลี่ยนระหว่างที่คุณพิมพ์ ให้รอรหัสถัดไปแล้วกรอกอย่างรวดเร็ว

    **สิ่งที่ควรเห็น:** แดชบอร์ดหลังล็อกอิน แสดง **Signed in as** (ลงชื่อเข้าใช้เป็น) ชื่อผู้ใช้ `admin`, ป้าย `ADMIN` และคอนโซล **Admin Governance** ที่มีหกแท็บ โดยค่าเริ่มต้นจะเลือก **Audit Logs** การ์ด Agent อยู่ในแผง VPN แบบพับเก็บได้

### 🎯 ภารกิจที่ 2: จับคู่ Agent บนเครื่องและเชื่อมต่อ VPN

1. ในการ์ด **Windows Agent** ให้ตรวจสอบว่าเข้าถึง Agent ได้ สำหรับ Mock ควรแสดง **Agent Reachable (Unpaired)** (เข้าถึง Agent ได้ แต่ยังไม่จับคู่) และแสดงเวอร์ชัน `v2.0.0` วาง `PairingToken` ของ Mock ที่คัดลอกไว้ (หรือ Token ของ Go Agent ที่คุณเลือก) ลงในช่อง **Agent Pairing Token** ซึ่งเป็นช่องที่มี Placeholder ว่า **Paste X-Mango-Agent-Token** จากนั้นคลิกปุ่ม **Pair Agent** (จับคู่ Agent)

   **สิ่งที่ควรเห็น:** **Agent Paired & Ready** (จับคู่แล้วและพร้อมใช้งาน), `Tunnel State: disconnected` (สถานะอุโมงค์: ยังไม่เชื่อมต่อ) และปุ่ม **Connect VPN** (เชื่อมต่อ VPN) หากจับคู่ไม่สำเร็จ ให้ตรวจสอบว่า Token ตรงกับ Agent ที่กำลังทำงานอยู่ทุกตัวอักษร

2. คลิกปุ่ม **Connect VPN** เบื้องหลัง พอร์ทัลจะขอตั๋วแบบใช้ครั้งเดียวที่มีอายุ 60 วินาที Agent จะสร้างคู่กุญแจ Curve25519 ใหม่ในหน่วยความจำ และส่งตั๋วพร้อมคีย์สาธารณะให้ API API จะจัดสรร IP ที่ว่างตัวแรก (ปกติคือ `10.13.13.2`) จากนั้นขอให้ `vpn-gateway` เพิ่ม Peer และเพิ่มกฎ `nftables` ตามนโยบาย Role สำหรับ Go Agent มันจะเปิดใช้งาน WireGuard ต่อ ส่วน Mock จะจำลองสถานะของ Agent เท่านั้นและไม่ได้เปิดอุโมงค์ใดๆ

   **สิ่งที่ควรเห็น:** สำหรับเดโม Mock การ์ดจะแสดงสถานะ **connected** เป็นสีเขียว พร้อม `Connected Role: ADMIN`, `Assigned VPN IP: 10.13.13.2`, `Gateway Endpoint: 127.0.0.1:51820`, `Permitted Networks` (ปกติคือ `10.13.13.0/24` หากไม่มีนโยบาย ALLOW สำหรับ ADMIN), `Curve25519 Key` และปุ่ม **Disconnect VPN** (ตัดการเชื่อมต่อ VPN) สำหรับ Track B คุณควรเห็นอุโมงค์ `mango0` จริง: WireGuard for Windows บน Windows หรืออินเทอร์เฟซ `mango0` บน Linux สถานะและตัวนับของ Mock ไม่ใช่หลักฐานว่ามีทราฟฟิก WireGuard จริง

### 🎯 ภารกิจที่ 3: ทดสอบทุกแท็บของ Admin Governance (ครบทั้งหกแท็บ)

ลำดับแท็บของ Admin Governance คือ **Audit Logs**, **Agent Versions**, **Users**, **Devices**, **Sessions**, **Policies** เนื่องจาก **Audit Logs** ถูกเลือกเป็นค่าเริ่มต้น ให้ทำตามลำดับที่มีหมายเลขด้านล่างเพื่อสร้างข้อมูลก่อน แล้วค่อยตรวจสอบประวัติการตรวจสอบในตอนท้าย

#### 1. Users (ผู้ใช้)

1. คลิก **Users** ภายใต้ **Create User** (สร้างผู้ใช้) ให้กรอก username `staff01`, email `staff01@mangovpn.local`, password `StaffTestPass#2026` และ Role `STAFF` จากนั้นคลิก **Create User**
2. สร้างผู้ใช้อีกคนด้วย username `client01`, email `client01@mangovpn.local`, password `ClientTestPass#2026` และ Role `CLIENT` จากนั้นคลิก **Create User**
3. ค้นหา `client01` ในรายการ คลิก **Disable** (ปิดใช้งาน) รอจนสถานะเปลี่ยนเป็น `Disabled` แล้วคลิก **Enable** (เปิดใช้งาน)

**สิ่งที่ควรเห็น:** ผู้ใช้ทั้งสองปรากฏในรายการพร้อม Role ที่เลือกไว้ สถานะของ `client01` เปลี่ยนจาก `Active` เป็น `Disabled` แล้วกลับเป็น `Active` รหัสผ่านที่แอดมินสร้างต้องมีความยาวอย่างน้อย 12 ตัวอักษร

#### 2. Policies (นโยบาย)

1. คลิก **Policies** ภายใต้ **Create Zero-Trust Policy** (สร้างนโยบาย Zero-Trust) สร้าง Policy 1 ด้วยค่าดังนี้:

   | Field (ช่อง) | ค่า |
   |---|---|
   | Policy Name | `Allow Internal Web` |
   | Role | `STAFF` |
   | Target CIDR | `10.20.0.0/16` |
   | Protocol | `TCP` |
   | Port Range (TCP/UDP) | `443` |
   | Action | `ALLOW` |
   | Priority | `100` |

   คลิกปุ่ม **Create Policy** (สร้างนโยบาย)

2. สร้าง Policy 2 ด้วยค่าดังนี้:

   | Field (ช่อง) | ค่า |
   |---|---|
   | Policy Name | `Block Admin Subnet` |
   | Role | `CLIENT` |
   | Target CIDR | `10.99.0.0/24` |
   | Protocol | `ANY` |
   | Port Range (TCP/UDP) | เว้นว่างไว้ |
   | Action | `DENY` |
   | Priority | `50` |

   คลิก **Create Policy** ช่วงพอร์ตรองรับเฉพาะ TCP หรือ UDP ดังนั้นเมื่อเลือก `ANY` ให้เว้นว่างไว้

**สิ่งที่ควรเห็น:** นโยบายทั้งสองปรากฏในรายการพร้อม Role, CIDR, Action, Protocol และ Priority ที่ถูกต้อง ตัวเลือกเพิ่มเติม: สร้างนโยบายทดลองที่ใช้แล้วทิ้ง แล้วคลิกปุ่ม **Delete** (ลบ) ของมัน ยืนยันว่ามันหายไปโดยไม่มี Error

#### 3. Agent Versions (เวอร์ชันของ Agent)

1. คลิก **Agent Versions** ภายใต้ **Publish Agent Version** (เผยแพร่เวอร์ชัน Agent) ให้กรอก:

   | Field (ช่อง) | ค่า |
   |---|---|
   | Version | `2.0.0` |
   | Platform | `windows-x64` บน Windows หรือ `linux-x64` บน Linux |
   | Download URL | `https://downloads.mango.local/mango-agent-2.0.0` |
   | SHA-256 Checksum | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

2. ทำเครื่องหมายที่ช่อง **Minimum required version** (เวอร์ชันขั้นต่ำที่ต้องใช้) แล้วคลิกปุ่ม **Publish Version** (เผยแพร่เวอร์ชัน)

   **สิ่งที่ควรเห็น:** เวอร์ชัน `2.0.0` ปรากฏเป็น Active และ Required URL ที่ใช้เป็นค่าตัวอย่างสำหรับการลงทะเบียน ไม่ใช่ตำแหน่งดาวน์โหลดจริง

3. **การทดสอบการบังคับใช้เวอร์ชัน (ควรระวัง, ไม่จำเป็น):** ตัดการเชื่อมต่อ VPN หากกำลังเชื่อมต่ออยู่ เผยแพร่เวอร์ชัน `2.1.0` สำหรับ Platform ของ OS ที่ใช้อยู่ (`windows-x64` หรือ `linux-x64`) พร้อม URL ที่ใช้ได้และ Checksum แบบ 64 ตัวอักษร Hex แล้วทำเครื่องหมาย **Minimum required version** จากนั้นคลิก **Connect VPN** บนการ์ด Agent อีกครั้ง

   **สิ่งที่ควรเห็น:** API จะปฏิเสธ Agent เวอร์ชัน `2.0.0` ด้วย HTTP `426` และ `AGENT_VERSION_OUTDATED` ใน Agent Versions ให้คลิก **Mark Optional** ที่เวอร์ชัน `2.1.0` (ปุ่มนี้ปรากฏเมื่อเวอร์ชันนั้นเป็น Required) หรือ Deactivate เรคคอร์ด `2.1.0` ระวังอย่าปิดใช้งาน `2.0.0` โดยไม่ตั้งใจ Go Agent และ `mock-agent.js` ตรวจจับ OS/สถาปัตยกรรมเพื่อกำหนด Platform โดยอัตโนมัติ เว้นแต่ตั้ง `AGENT_PLATFORM` เอง

#### 4. Devices (อุปกรณ์)

คลิก **Devices**

**สิ่งที่ควรเห็น:** เครื่องที่เชื่อมต่ออยู่ของคุณปรากฏพร้อมชื่อโฮสต์ (Hostname), ลายนิ้วมืออุปกรณ์ (Device Fingerprint), ผู้ใช้ `admin` และสถานะ `ACTIVE` ลายนิ้วมือของ Mock สร้างจากชื่อโฮสต์ เว้นแต่คุณจะตั้งค่า `AGENT_DEVICE_FINGERPRINT`

#### 5. Sessions (เซสชัน)

คลิก **Sessions**

**สิ่งที่ควรเห็น:** เซสชันแบบสด `ACTIVE` ของ `admin` โดย IP ที่กำหนดปกติคือ `10.13.13.2` ตารางยังแสดงชื่อโฮสต์ของอุปกรณ์และมีการดำเนินการ **Disconnect** (ตัดการเชื่อมต่อ)

#### 6. Audit Logs (ประวัติการตรวจสอบ)

คลิก **Audit Logs** มองหาเหตุการณ์ด้านความปลอดภัยจากการกระทำข้างต้น เช่น `VPN_TICKET_ISSUED`, `VPN_CONNECTED`, `USER_CREATED`, `POLICY_CREATED` และเหตุการณ์การสร้างเวอร์ชัน Agent (ซึ่ง API แสดงเป็น `agent_version.create`) ลองใช้กล่อง **Action filter** (ตัวกรองการกระทำ), **Target type filter** (ตัวกรองประเภทเป้าหมาย) และ **Search** (ค้นหา) เช่น ค้นหา `admin` หรือกรองด้วย `USER_CREATED`

**สิ่งที่ควรเห็น:** เหตุการณ์ล่าสุดในตารางที่มีเวลากำกับ คลิก **Inspect** (ตรวจสอบ) ที่เหตุการณ์เพื่อเปิดข้อมูล Audit Payload ใช้ **Close** (ปิด) เพื่อปิดข้อมูลนั้น หากไม่มีผลลัพธ์ ระบบจะแสดงตามจริงว่า `No audit logs found.`

### 🎯 ภารกิจที่ 4: ทดสอบการเพิกถอนแบบเรียลไทม์และ RBAC ของผู้ที่ไม่ใช่แอดมิน (ล็อกอินเป็น `STAFF`)

หากรัน `npm run dev:portal:all` พอร์ทัลจะอยู่ที่ `:3000` (Admin), `:3001` (Staff) และ `:3002` (Client) `scripts/mock-agent.js` จะต่อท้าย Device Fingerprint ด้วย `-<port>` ตามพอร์ตของ Origin ที่เริ่มการเชื่อมต่อโดยอัตโนมัติ จึงแยกอุปกรณ์ของแต่ละพอร์ทัลออกจากกัน หากต้องการกำหนด Fingerprint เอง ให้ตั้ง `AGENT_DEVICE_FINGERPRINT` ก่อนเริ่ม Mock:

```powershell
$env:AGENT_DEVICE_FINGERPRINT="mock-device-staff01"
npm run mock:agent
```

```bash
export AGENT_DEVICE_FINGERPRINT="mock-device-staff01"
npm run mock:agent
```

ตัวแปรที่กำหนดเองจะแทน Fingerprint ตั้งต้น ส่วน suffix พอร์ตจะยังช่วยแยกการเชื่อมต่อแต่ละพอร์ต

1. ในฐานะ `admin` คลิก **Sessions** แล้วคลิก **Disconnect** ที่เซสชันที่ใช้งานอยู่

   **สิ่งที่ควรเห็น:** เซสชันเปลี่ยนเป็น `DISCONNECTED` และ Gateway ลบ Peer ของมัน สำหรับ Mock การ์ดในเครื่องอาจยังแสดงสถานะเชื่อมต่ออยู่จนกว่าคุณจะคลิก **Disconnect VPN** หรือรีสตาร์ท Mock การตัดการเชื่อมต่อโดยแอดมินจะลบ Peer ฝั่งเซิร์ฟเวอร์ แต่จะไม่ส่งการเปลี่ยนสถานะไปยังโปรเซสของ Agent จากระยะไกล

2. **การเพิกถอนอุปกรณ์เป็นการถาวรสำหรับลายนิ้วมือนั้น** การคลิก **Revoke** (เพิกถอน) ใน **Devices** จะเพิกถอนลายนิ้วมือ ทำให้อุปกรณ์นั้นเชื่อมต่อกลับมาไม่ได้ คุณจะทดสอบก็ได้ แต่ควรเก็บอุปกรณ์เดโมหลักไว้ให้ใช้งานได้จะปลอดภัยกว่า หากต้องการใช้ลายนิ้วมือ Mock ใหม่ ให้หยุด Mock ด้วย `Ctrl+C` จากนั้นในหน้าต่างของ Mock รัน:

   ```powershell
   $env:AGENT_DEVICE_FINGERPRINT="mock-device-02"
   npm run mock:agent
   ```

   Bash:

   ```bash
   export AGENT_DEVICE_FINGERPRINT="mock-device-02"
   npm run mock:agent
   ```

   **สิ่งที่ควรเห็น:** กล่องข้อความเริ่มต้นของ Mock ใหม่พร้อม `PairingToken:` ใหม่ ให้จับคู่ด้วย Token ใหม่นั้น ลายนิ้วมือใหม่คือตัวตนของอุปกรณ์ที่แยกต่างหาก หากก่อนหน้านี้คุณเพิกถอน `mock-device-02` ไปแล้ว ให้เลือกลายนิ้วมือที่ยังไม่เคยใช้งานตัวอื่น

3. ก่อนสลับผู้ใช้ ให้ตัดการเชื่อมต่อ Agent บนเครื่องหากยังแสดงว่าเชื่อมต่ออยู่ คลิก **Log Out** (ออกจากระบบ) จากนั้นล็อกอินเป็น `staff01` ด้วยรหัสผ่าน `StaffTestPass#2026` การล็อกอินครั้งแรกของ `staff01` จะต้องลงทะเบียน TOTP ของตนเอง: สแกน QR Code (หรือกรอก Base32 Key) พิมพ์ **6-Digit Code** ปัจจุบัน แล้วคลิก **Verify**

   **สิ่งที่ควรเห็น:** แดชบอร์ดแสดง `staff01` และป้าย `STAFF` ผู้ใช้ Staff จะไม่เห็นหกแท็บของ **Admin Governance**

4. จับคู่ Agent บนเครื่องอีกครั้งด้วย Token ปัจจุบัน สำหรับพอร์ทัลพอร์ตต่างกัน Mock จะแยก Fingerprint ด้วย suffix พอร์ตให้อัตโนมัติ; หากต้องการระบุตัวตน Agent เอง ให้หยุด Mock แล้วตั้ง `$env:AGENT_DEVICE_FINGERPRINT="mock-device-staff01"` ใน PowerShell หรือ `export AGENT_DEVICE_FINGERPRINT="mock-device-staff01"` ใน Bash ก่อนเริ่ม `npm run mock:agent` ใหม่ วาง Token ปัจจุบัน แล้วคลิก **Pair Agent** และ **Connect VPN**

   **สิ่งที่ควรเห็น:** `staff01` เชื่อมต่อในฐานะ `STAFF` เนื่องจากภารกิจที่ 3 สร้างนโยบาย `ALLOW` ให้ `STAFF` ไว้ **Permitted Networks** จึงรวม `10.20.0.0/16` และอาจรวมเครือข่ายที่อนุญาตอื่นตาม Policy แท็บ Admin Governance ยังคงซ่อนอยู่ สำหรับ Track B Go Agent ให้ใช้ Fingerprint ที่ไม่เคยถูกผูกกับผู้ใช้อื่น โดยตั้ง `AGENT_DEVICE_FINGERPRINT` ใน PowerShell หรือ Bash ก่อนรัน Agent หากจำเป็น

## ระยะที่ 5: ตรวจสอบ Gateway แบบสดและทดสอบอัตโนมัติด้วย CLI

### 5.1 ตรวจสอบ Gateway ของ Docker ขณะที่มี Peer ลงทะเบียนอยู่ (เฉพาะ Track B และ Track C)

Track A ใช้ `npm run mock:daemon` ที่รันบนเครื่อง Host จึงไม่มีอินเทอร์เฟซ `wg0` หรือตาราง nftables `mango_vpn` ให้ข้ามหัวข้อนี้สำหรับ Track A

เมื่อมีเซสชันเชื่อมต่ออยู่ รันคำสั่งเหล่านี้จาก PowerShell หรือ Bash (คำสั่งเหมือนกัน):

```powershell
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn
```

**สิ่งที่ควรเห็น:** `wg show` แสดงอินเทอร์เฟซ `wg0`, พอร์ตที่ Listen และ Peer พร้อม Public Key และ Allowed IPs คำสั่ง `nft` แสดงตาราง `inet mango_vpn` และกฎการส่งต่อแพ็กเก็ต คำสั่งเหล่านี้แสดงการตั้งค่าของ Gateway เท่านั้น เซสชัน Mock ยังไม่ได้สร้างอุโมงค์ไคลเอนต์จริง และไม่ได้พิสูจน์ว่ามีทราฟฟิกไหลผ่าน

### 5.2 ทดสอบ Agent บนเครื่อง

```powershell
Invoke-RestMethod http://127.0.0.1:47821/health
Invoke-RestMethod http://127.0.0.1:47821/status -Headers @{ "X-Mango-Agent-Token" = "<your-pairing-token>" }
```

Linux/macOS (Bash) ใช้ `curl`:

```bash
curl http://127.0.0.1:47821/health
curl -H 'X-Mango-Agent-Token: <your-pairing-token>' http://127.0.0.1:47821/status
```

แทนที่ `<your-pairing-token>` ด้วย Token ปัจจุบันที่ Mock แสดง หรือ Token ที่ตั้งไว้ชัดเจนสำหรับ Go Agent

**สิ่งที่ควรเห็น:** `/health` ส่งค่า status `ok`, ชื่อบริการ, เวอร์ชัน และค่าบูลีนว่าอุโมงค์ทำงานอยู่หรือไม่ ส่วน `/status` ส่งสถานะของ Agent, เวอร์ชัน, IP/Endpoint ที่กำหนดเมื่อเชื่อมต่ออยู่, Allowed IPs และตัวนับ `bytesReceived` / `bytesSent` ตัวนับไบต์ของ Mock เป็นค่าจำลอง ส่วนของ Go Agent จะรายงานตามการทำงานปัจจุบันของ Agent และอาจยังเป็นศูนย์หากตัวนับไม่ได้ถูกอัปเดต Token ที่ผิดหรือหมดอายุจะได้ `401`

### 5.3 รันการตรวจสอบอัตโนมัติ

รันตัวสแกน Guardrail จากโฟลเดอร์รากโปรเจกต์:

```powershell
node scripts/check-guardrails.mjs
npm run build
```

Linux/macOS (Bash) ใช้คำสั่งเดียวกัน:

```bash
node scripts/check-guardrails.mjs
npm run build
```

**สิ่งที่ควรเห็น:** `Guardrail check passed (0 violations).` และการ Build สำเร็จสำหรับ Shared Contracts กับ Workspace ที่เกี่ยวข้อง โดยมี TypeScript build error เป็นศูนย์

ก่อนรันการทดสอบ ให้ยืนยันว่ามี `DATABASE_URL` ในไฟล์ `.env` ในเครื่อง อย่าวางค่าของมันลงในล็อกสาธารณะหรือแชต:

```powershell
if ($env:DATABASE_URL) { 'DATABASE_URL is set in this PowerShell session.' } else { 'DATABASE_URL is not exported in this PowerShell session; npm scripts load the root .env where configured. Check .env and the database if tests cannot connect.' }
npm test
```

Linux/macOS (Bash):

```bash
if [ -n "${DATABASE_URL:-}" ]; then echo 'DATABASE_URL is set in this shell.'; else echo 'DATABASE_URL is not exported in this shell; check .env and the database if tests cannot connect.'; fi
npm test
```

ชุดทดสอบ Vitest จะรันข้าม Workspace ของ API, Admin และ Portal ต้องให้ PostgreSQL ทำงานอยู่ และฐานข้อมูลต้องมี Schema ของ v2 ปัจจุบัน สำหรับ Track A PostgreSQL คือตัวที่ฝังมากับ `npm run db:start` (ต้องรันค้างไว้) และ `mangovpn_v2_test` ต้องถูก Migrate ตามขั้นตอน A1 แล้ว หากการทดสอบต้องการ `DATABASE_URL` ที่ Export ไว้ ให้ตั้งเป็น URL เดียวกับใน `.env` สำหรับ shell นี้แล้วรัน `npm test` อีกครั้ง

**สิ่งที่ควรเห็น:** ชุดทดสอบรายงานว่าการทดสอบผ่าน หากการทดสอบล้มเหลวเพราะเข้าถึง PostgreSQL ไม่ได้หรือ Schema เก่า ให้ดูหัวข้อการแก้ปัญหาด้านล่างก่อนสรุปว่าเป็นข้อบกพร่องของโค้ด

สำหรับโมดูล Go ของ Sobree ให้รันการตรวจสอบเหล่านี้จากโฟลเดอร์รากโปรเจกต์:

```powershell
Push-Location Sobree/agent-windows
go vet ./...
go test ./...
go build ./...
Pop-Location

Push-Location Sobree/vpn-daemon
go vet ./...
go test ./...
go build ./...
Pop-Location
```

Linux/macOS (Bash):

```bash
(cd Sobree/agent-windows && go vet ./... && go test ./... && go build ./... && GOOS=windows go build ./...)
(cd Sobree/vpn-daemon && go vet ./... && go test ./... && go build ./...)
```

**สิ่งที่ควรเห็น:** `go vet`, `go test` และ `go build` ทำงานจนจบโดยไม่มี Error ในแต่ละโมดูล ส่วน Bash ยังตรวจ Cross-Compile Go Agent สำหรับ Windows ด้วย `GOOS=windows` ใน PowerShell ให้จับคู่ `Push-Location` / `Pop-Location` เสมอเพื่อกลับมายังรากโปรเจกต์

## ระยะที่ 6: การแก้ปัญหาเบื้องต้นและการปิดระบบอย่างถูกต้อง

### การแก้ปัญหาเบื้องต้น

| อาการ | ความหมายส่วนใหญ่ | สิ่งที่ควรทำ |
|---|---|---|
| `502 Bad Gateway` ระหว่าง Connect, การสร้าง/ซิงก์ Policy หรือการเพิกถอน | API เข้าถึง Gateway Daemon ไม่ได้ หรือ Secret ของ Daemon ไม่ตรงกัน | **Track A:** ตรวจสอบว่า `npm run mock:daemon` ทำงานอยู่และ Listen ที่ `http://127.0.0.1:50051` และ `DAEMON_SHARED_SECRET` ใน `.env` ยาวอย่างน้อย 32 ตัวอักษร (ตัวจำลองจะไม่เริ่มทำงานหากสั้นกว่านั้น) **Track B/C:** รัน `docker compose ps vpn-gateway` แล้วรอให้ขึ้น `healthy` และตรวจว่า `DAEMON_SHARED_SECRET` ใน `.env` ที่รากตรงกับการตั้งค่าของ Compose/API API ที่รันบน Host ใช้ `http://127.0.0.1:50051` ส่วน API ในคอนเทนเนอร์ใช้ `http://vpn-gateway:50051` |
| Agent แจ้ง `401 Unauthorized` / `INVALID_PAIRING_TOKEN` | Token หายไป พิมพ์ผิด หรือเปลี่ยนไปตอน Agent รีสตาร์ท | คัดลอก `PairingToken:` ล่าสุดของ Mock หรือใช้ค่า `AGENT_PAIRING_TOKEN` ที่ตั้งไว้ก่อนเริ่ม Go ให้จับคู่ใหม่ |
| `403 FORBIDDEN_ORIGIN` | Origin ของเบราว์เซอร์ของพอร์ทัลไม่อยู่ในรายการที่ Agent บนเครื่องอนุญาต | เปิดพอร์ทัลที่ `http://localhost:3000` หรือใช้ Origin `http://127.0.0.1:3000` ที่ตั้งค่าไว้ สำหรับ Go ให้ตั้ง `AGENT_ALLOWED_ORIGINS` ให้มี Origin ที่ตรงทุกตัวอักษร แล้วรีสตาร์ท Agent ห้ามใช้ Wildcard Origin |
| `426 AGENT_VERSION_OUTDATED` หรือ `AGENT_VERSION_INACTIVE` | เวอร์ชันที่กำหนดให้ต้องใช้ใหม่กว่า Agent หรือเวอร์ชันนี้ถูกปิดใช้งานไปแล้ว | ใน **Agent Versions** ให้ทำให้เวอร์ชันที่บังคับเป็นตัวเลือกด้วย **Mark Optional** หรือเปิดใช้งานเวอร์ชันที่ถูกต้อง อย่า Deactivate เวอร์ชันที่กำลังทดสอบอยู่ |
| `Device has been revoked` | Agent พยายามเชื่อมต่อใหม่ด้วยลายนิ้วมืออุปกรณ์ที่ถูกเพิกถอนถาวรแล้ว | ใช้ลายนิ้วมือใหม่ที่ยังไม่เคยใช้สำหรับอุปกรณ์ใหม่ สำหรับ Mock Agent ให้ตั้ง `$env:AGENT_DEVICE_FINGERPRINT="mock-device-02"` (หรือค่าอื่นที่ยังไม่เคยใช้) ก่อน `npm run mock:agent` รีสตาร์ท แล้วจับคู่ด้วย Token ใหม่ |
| `RoleName` does not exist หรือไม่พบตาราง `connect_tickets` | ฐานข้อมูลยังเป็น Schema ของ v1 หรือ Migration เก่า การรีเซ็ตจะลบข้อมูลในฐานข้อมูลในเครื่อง | หากคุณลบข้อมูลในฐานข้อมูลในเครื่องได้อย่างปลอดภัย ให้รัน `npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma` จากนั้นรัน `npm run db:seed` พร้อมตัวแปรสภาพแวดล้อมของ ADMIN การรีเซ็ตนี้จะทำลายข้อมูลในฐานข้อมูลในเครื่องทั้งหมด |
| `docker info` แจ้ง `error during connect` (เฉพาะ Track B/C) | Docker Engine หยุดทำงานหรือยังเริ่มไม่เสร็จ | Windows: เปิด **Docker Desktop** และรอ **Engine running**; Linux: ใช้ `sudo systemctl start docker` แล้วตรวจ `docker info` อีกครั้ง |
| API ล้มเหลวตอนเริ่มทำงานพร้อมข้อความว่าตัวแปรจำเป็นหายไป | ไม่มีไฟล์ `.env` หรือ Secret ที่จำเป็นไม่ถูกต้อง | ตรวจสอบว่าตั้งค่า `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET` และ `DAEMON_SHARED_SECRET` แล้ว Secret สามตัวต้องยาวอย่างน้อยคนละ 32 ตัวอักษร ส่วน `TOTP_ENCRYPTION_KEY` ต้องยาวตรง 64 ตัวอักษรฐานสิบหก |
| Agent แสดง `Agent Unreachable` | ไม่มีโปรเซสของ Agent กำลัง Listen บนพอร์ต Loopback | เริ่ม `npm run mock:agent` หรือ Go Agent และตรวจว่า Log แสดง `127.0.0.1:47821` หยุดโปรเซสอื่นที่ใช้พอร์ตนั้นอยู่ |
| `mango0` ไม่เริ่มทำงานใน Track B | Agent ไม่มีสิทธิ์หรือเครื่องมือ WireGuard ของ OS หายไป หรือคีย์/Endpoint ไม่ตรงกัน | Windows: รัน Go ใน Administrator PowerShell และติดตั้ง WireGuard for Windows (`wireguard.exe`). Linux: ติดตั้ง `wireguard-tools` (`wg`, `wg-quick`), `iproute2`, `nftables` และรันด้วย root (`sudo -E go run .`) หรือ `CAP_NET_ADMIN`; Agent ใช้ `wg-quick` กับ `/tmp/mango-vpn/mango0.conf` ตามค่าเริ่มต้น ตรวจ `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY` และ `WG_SERVER_ENDPOINT` แล้วอ่าน Error เต็มใน Terminal |

### การปิดระบบอย่างถูกต้อง

1. ในแต่ละ Terminal ที่รัน `npm run mock:agent`, `npm run mock:daemon`, `npm run dev:api`, `npm run dev:portal`, `go run .` หรือ `npm run db:start` ให้กด **Ctrl+C** หนึ่งครั้ง หากอุโมงค์ Go ยังทำงานอยู่ ให้คลิก **Disconnect VPN** ก่อนเมื่อทำได้ เพื่อให้ API และ Gateway ลบ Peer ออกอย่างเรียบร้อย Ctrl+C ใน `db:start` จะหยุด PostgreSQL แบบฝังตัว หากต้องการลบข้อมูลในเครื่อง ให้รัน `npm run db:reset-local` หลังจากหยุดแล้วเท่านั้น เพราะคำสั่งนี้จะลบ `.local/postgres`

    **สิ่งที่ควรเห็น:** โปรเซสที่ทำงานอยู่หน้าจอจะหยุด และ PowerShell/Bash กลับมาที่บรรทัดคำสั่ง สำหรับ Track B บริการ/อุโมงค์ WireGuard ควรถูกปิดเมื่อ Agent ตัดการเชื่อมต่อสำเร็จ

2. เฉพาะ Track B และ Track C: หยุดบริการ Docker จากโฟลเดอร์รากโปรเจกต์ Track A ไม่มีบริการ Docker ให้หยุด:

    ```powershell
    docker compose down
    ```

    Bash ใช้คำสั่งเดียวกัน:

    ```bash
    docker compose down
    ```

   **สิ่งที่ควรเห็น:** Compose แจ้งว่าคอนเทนเนอร์ถูกหยุดและลบแล้ว Named Volume ของข้อมูล PostgreSQL จะยังคงอยู่ ดังนั้นการรัน `docker compose up` ครั้งถัดไปจะใช้ฐานข้อมูลในเครื่องเดิมได้ อย่ารัน `docker compose down -v` เว้นแต่คุณตั้งใจจะลบข้อมูลฐานข้อมูลที่เก็บไว้

คุณได้ผ่านขั้นตอนของ MANGO VPN v2 ตั้งแต่การติดตั้ง การจัดการสิทธิ์ การจับคู่ Agent การตรวจสอบ Gateway ไปจนถึงการปิดระบบแล้ว ทำได้ดีมาก!
