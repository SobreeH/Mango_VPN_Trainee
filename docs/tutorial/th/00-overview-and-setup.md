> 🌐 **Language / ภาษา**: [🇬🇧 English](../00-overview-and-setup.md) | **🇹🇭 ภาษาไทย**

> 🏠 [สารบัญคู่มือ](../../../TUTORIAL.th.md) › **00 ภาพรวมและการเตรียมระบบ** › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 การทดสอบ](04-testing-playbook.md) · [05 การแก้ไขปัญหา](05-troubleshooting-and-reference.md) · [06 ภาคผนวก](06-appendix-local-docker-smoke-test.md)

---

# 00 · ภาพรวมและการเตรียมระบบ

ยินดีต้อนรับ! บทนี้อธิบายว่า MANGO VPN ทำงานอย่างไร การเชื่อมต่อผ่านระบบแต่ละส่วนอย่างไร และเตรียมคอมพิวเตอร์ของคุณให้พร้อม ทุกบทต่อไปจะสมมติว่าคุณทำสองระยะในบทนี้เสร็จแล้ว

> **วิธีอ่านคำสั่ง:** ทุกขั้นตอนที่ต้องใช้ Shell จะแสดงบล็อก **Windows (PowerShell)** และบล็อก **Linux / macOS (Bash)** ให้ใช้บล็อกที่ตรงกับระบบปฏิบัติการของคุณ คำสั่งที่ไม่มีป้ายระบุแพลตฟอร์ม (เช่น `npm run ...`) ใช้ได้เหมือนกันทั้งสองระบบ

> **หมายเหตุด้านความปลอดภัย:** นี่คือการตั้งค่าสำหรับการพัฒนาและการสาธิตในเครื่องเท่านั้น ไม่ใช่การนำขึ้นใช้งานจริง (Production) โปรดเก็บไฟล์ `.env` ไว้เป็นความลับ และอย่านำค่า Secret ที่สร้างขึ้นไปใช้ที่อื่น

## 1. ภาพรวมใน 60 วินาที

MANGO VPN ให้ผู้ใช้ล็อกอินด้วยรหัสผ่านและรหัส TOTP (Time-based One-Time Password) จากแอปยืนยันตัวตน ผู้ใช้ไม่ต้องดาวน์โหลดไฟล์ VPN `.conf` เลย หลังล็อกอิน พอร์ทัลจะได้รับ **ตั๋วเชื่อมต่อ (connect ticket) แบบใช้ครั้งเดียวที่หมดอายุภายใน 60 วินาที** จากนั้น **Client agent** บนเครื่องของผู้ใช้ (Windows หรือ Linux) ที่ฟังอยู่ที่ `127.0.0.1:47821` จะสร้างคู่กุญแจ Curve25519 ใหม่ในหน่วยความจำ ส่ง Public key ไปยัง Control Plane API และเปิดใช้งาน WireGuard Gateway จะเพิ่ม Peer นั้นและบังคับใช้นโยบายตามบทบาทของผู้ใช้ด้วย `nftables`

Client agent มีสองรูปแบบ:

- **`Sobree/agent-windows`** (Go): Agent จริง บน **Windows** จะรัน `wireguard.exe /installtunnelservice` บน **Linux** จะรัน `wg-quick up`
- **`scripts/mock-agent.js`** (Node.js): ตัวจำลองสัญญา Loopback เดียวกันสำหรับงาน UI ไม่ติดตั้งอุโมงค์บน OS ใดทั้งสิ้น

### 1.1 ส่วนประกอบของระบบ

```mermaid
flowchart LR
    Browser["เว็บพอร์ทัล (localhost:3000)"] -->|HTTP API| API["Control Plane API (localhost:4000)"]
    API -->|SQL| DB[("PostgreSQL 16 (localhost:15432)")]
    Browser -->|Loopback + โทเคนจับคู่| Agent["Agent บนเครื่อง (127.0.0.1:47821)"]
    Agent -->|แลกตั๋ว + คีย์สาธารณะ| API
    API -->|Bearer HTTP| Gateway["Gateway Daemon (127.0.0.1:50051)"]
    Agent -->|WireGuard UDP| WG["WireGuard gateway (51820/udp)"]
    Gateway -->|wg + nftables| WG
```

| ส่วนประกอบ | Address / พอร์ตในเครื่อง | หน้าที่ |
|---|---|---|
| เว็บพอร์ทัล (Web Portal) | `http://localhost:3000` | หน้าล็อกอิน การลงทะเบียน TOTP การควบคุม VPN และหน้าจัดการระบบ Admin |
| Control Plane API | `http://localhost:4000` | ยืนยันตัวตนด้วยรหัสผ่าน/TOTP, ออกตั๋วเชื่อมต่ออายุสั้น, จัดสรร IP และประสานงานกับ Gateway |
| PostgreSQL 16 | `localhost:15432` (พอร์ตในคอนเทนเนอร์ `5432`) | เก็บข้อมูลผู้ใช้ เซสชัน นโยบาย อุปกรณ์ และประวัติการตรวจสอบ Track A รันแบบฝังตัวด้วย `npm run db:start` (ข้อมูลอยู่ที่ `.local/postgres`) ส่วน Track B และ C รันเป็นคอนเทนเนอร์ Docker ชื่อ `mango-postgres` |
| Local client agent | `http://127.0.0.1:47821` | `scripts/mock-agent.js` สำหรับเดโม UI หรือ Go `Sobree/agent-windows` สำหรับอุโมงค์ WireGuard จริง |
| Gateway Daemon | `http://127.0.0.1:50051` (HTTP); `51820/udp` (WireGuard) | ตั้งค่า `wg0` และกฎ `nftables` ตามบทบาท Track A จำลองด้วย `npm run mock:daemon` (สำหรับการพัฒนาเท่านั้น ไม่มีการบังคับใช้ `wg` หรือ `nftables`) Track B และ C รันเป็นบริการ Docker ชื่อ `mango-vpn-gateway` |

### 1.2 วงจรชีวิตการเชื่อมต่อ v2

การเชื่อมต่อผ่านหกระยะ ผังแบบ Flowchart แสดงจุดตัดสินใจ ส่วนลำดับการทำงาน (Sequence) แสดงข้อความตามลำดับเวลา

```mermaid
flowchart TD
    A["1. ล็อกอินด้วยรหัสผ่าน"] --> B{"ลงทะเบียน TOTP แล้วหรือยัง?"}
    B -->|ยัง| C["MFA_SETUP_REQUIRED: สแกน QR แล้วยืนยันรหัส"]
    B -->|แล้ว| D["กรอกรหัส 6 หลัก"]
    C --> E["2. Session JWT แบบ access + refresh ที่หมุนเวียน"]
    D --> E
    E --> F["3. พอร์ทัลขอตั๋วเชื่อมต่อแบบใช้ครั้งเดียว อายุ 60 วินาที"]
    F --> G["4. Agent สร้างคู่กุญแจ Curve25519 ในหน่วยความจำ"]
    G --> H["5. API ตรวจสอบบทบาท จัดสรร IP และตั้งค่า Peer กับนโยบายบน Gateway"]
    H --> I{"ประเภทของ Agent"}
    I -->|Go agent| J["6a. Agent เปิด WireGuard (wireguard.exe หรือ wg-quick)"]
    I -->|mock-agent.js| K["6b. Mock จำลองเฉพาะสถานะที่เชื่อมต่อแล้ว"]
```

```mermaid
sequenceDiagram
    autonumber
    participant P as พอร์ทัล (เบราว์เซอร์)
    participant A as Agent บนเครื่อง (127.0.0.1:47821)
    participant API as Control Plane API (:4000)
    participant GW as Gateway daemon (:50051)
    P->>API: POST /api/auth/login แล้วตามด้วย /api/auth/verify-otp
    API-->>P: Session access + refresh (JWT หมุนเวียน)
    P->>API: POST /api/vpn/ticket (ต้องยืนยันตัวตนแล้ว)
    API-->>P: ตั๋วใช้ครั้งเดียว หมดอายุใน 60 วินาที
    P->>A: POST /connect พร้อมโทเคนจับคู่และตั๋ว
    A->>A: สร้างคู่กุญแจ Curve25519 (ในหน่วยความจำ)
    A->>API: POST /api/vpn/connect (ticket, publicKey, deviceFingerprint, hostname, agentVersion, platform)
    API->>GW: เพิ่ม Peer และนโยบายตามบทบาท (Bearer DAEMON_SHARED_SECRET)
    GW-->>API: ยอมรับ Peer และนโยบายแล้ว
    API-->>A: IP ที่จัดสรร, Public key ของ gateway และ endpoint
    A->>A: เปิดใช้งานอุโมงค์ (เฉพาะ Go agent)
    A-->>P: สถานะเชื่อมต่อแล้ว
```

กฎสำคัญที่วงจรชีวิตนี้บังคับใช้:

- ตั๋วเชื่อมต่อใช้ได้ **ครั้งเดียว** และต้องใช้ภายใน **60 วินาที** ตั๋วที่หมดอายุจะถูกปฏิเสธด้วย `401` พร้อมข้อความ `Connect ticket has expired`
- แต่ละบทบาทได้รับเฉพาะนโยบายที่กำหนดให้บทบาทนั้น การเชื่อมต่อจะอ่านนโยบายที่เปิดใช้งานสำหรับบทบาทของผู้ใช้ เรียงตาม priority จากน้อยไปมาก
- อุปกรณ์ที่ถูกเพิกถอน (revoked) จะเชื่อมต่อใหม่ไม่ได้อีก การเพิกถอนมีผลถาวรสำหรับ fingerprint นั้น

### 1.3 ทำไม `supportsDevUserHint` จึงสำคัญ

พอร์ทัลใช้ URL เดียว (`http://localhost:3000`) สำหรับทุกบทบาท ในโหมดพัฒนา พอร์ทัลต้องบอก Mock agent ว่าใครเป็นผู้ล็อกอินอยู่ เพื่อให้ผู้ใช้แต่ละคนมีสถานะ Agent แยกกัน

- Mock agent จะส่ง `supportsDevUserHint: true` ในผลลัพธ์ของ `GET /health`
- คอมโพเนนต์ `AgentStatusCard` ของพอร์ทัลจะส่งเฮดเดอร์ `X-Mango-Dev-User` **เฉพาะเมื่อ** Agent รายงาน `supportsDevUserHint: true` สำหรับ Go agent จริงจะไม่มีการส่งเฮดเดอร์นี้เลย
- Mock agent จะต่อท้าย `-<username>` ไปที่ device fingerprint ทำให้ `admin`, `staff01` และ `client01` มีตัวตนอุปกรณ์เป็นของตัวเอง
- Allow-list ของ CORS ใน Go agent สำหรับการใช้งานจริงไม่มี `X-Mango-Dev-User` และ Go agent จะไม่เพิ่ม suffix นี้ หากต้องการทดสอบหลายผู้ใช้กับ Go agent ให้ตั้ง `AGENT_DEVICE_FINGERPRINT` ต่างกันสำหรับแต่ละผู้ใช้

### 1.4 ทำไม HTTPS จึงสำคัญสำหรับพอร์ทัลระยะไกล

เบราว์เซอร์ใช้กฎ **Private Network Access (PNA)** หน้าเว็บที่โหลดจาก Origin สาธารณะหรือระยะไกลจะไม่สามารถเรียก `127.0.0.1` ได้โดยไม่ผ่านขั้นตอนการขออนุญาต Agent ตอบคำขอ PNA preflight ได้ แต่หน้า `http://` ที่ให้บริการจากชื่อโฮสต์ระยะไกลยังถูกบล็อกไม่ให้เข้าถึง Agent แบบ Loopback นี่คือเหตุผลที่งานในเครื่องใช้ `http://localhost:3000` (ซึ่งเบราว์เซอร์ถือว่าเป็นในเครื่อง) [บทที่ 02](02-track-b-gns3-mock-cloud.md) ใช้ใบรับรอง Internal CA ของ Caddy (`https://vpn.mango.lab`) และ[บทที่ 03](03-track-c-cloud-deployment.md) อธิบายการใช้ HTTPS ผ่าน `<IP>.sslip.io`, โดเมนกำหนดเอง, ACM หรือการ Port-forward ผ่าน SSH/SSM

## 2. ควรเลือก Track ไหนดี?

ตารางเลือก Track ฉบับเต็มอยู่ที่ [สารบัญคู่มือ](../../../TUTORIAL.th.md#เลือก-track-ไหนดี) โดยสรุปคือ:

- **Track A** (บท [01](01-track-a-local-dev.md)): ไม่ใช้ Docker เหมาะที่สุดสำหรับการเรียนรู้พอร์ทัลและ Admin CRUD
- **Track B** (บท [02](02-track-b-gns3-mock-cloud.md)): ห้องแล็บ GNS3 จำลองคลาวด์ พร้อม Gateway จริงและอุโมงค์ WireGuard จริง
- **Track C** (บท [03](03-track-c-cloud-deployment.md)): VM คลาวด์เครื่องเดียว (C1) หรือสแต็ก AWS แบบ Managed (C2)

## 3. ระยะที่ 1: ตรวจสอบว่าคอมพิวเตอร์พร้อมใช้งาน

### 3.1 ติดตั้งเครื่องมือสำหรับ Track ของคุณ

| เครื่องมือ | Track A | Track B และ C | เหตุผลที่ต้องใช้ |
|---|---|---|---|
| Node.js `>=18` (แนะนำ `20 LTS`) | จำเป็น | จำเป็น | รัน API, พอร์ทัล, การ Build, ตัวจำลอง และชุดทดสอบ |
| npm `>=9` | จำเป็น | จำเป็น | ติดตั้ง Workspace ของ Monorepo มาพร้อมกับ Node.js |
| Git `>=2.30` | จำเป็น | จำเป็น | ดาวน์โหลดและจัดการไฟล์โปรเจกต์ |
| Docker Desktop (Windows) หรือ Docker Engine + Compose v2 (Linux) | ไม่จำเป็น | จำเป็น | รัน PostgreSQL และ Gateway บน Linux |
| Go `>=1.26` (`Sobree/agent-windows`); Go `1.22` (`Sobree/vpn-daemon`) | ไม่จำเป็นสำหรับ Mock agent | จำเป็นสำหรับ Go agent | โมดูล Go agent ต้องใช้ Go 1.26 ส่วนโมดูล Linux daemon ระบุ Go 1.22 |
| WireGuard: WireGuard for Windows (`wireguard.exe`); หรือ `wireguard-tools` (`wg`, `wg-quick`), `iproute2` และ `nftables` (`nft`) บน Linux | ไม่จำเป็น | จำเป็นสำหรับอุโมงค์จริง | ให้คำสั่งอุโมงค์ที่ Go agent ใช้เปิด `mango0` |

ตัวอย่างการติดตั้งแพ็กเกจบน Linux (Debian/Ubuntu; ใช้เทียบเท่าของ Distribution ที่คุณใช้):

```bash
sudo apt update
sudo apt install -y wireguard-tools iproute2 nftables openssl
```

**Track A ไม่ต้องใช้ Docker** ใช้ PostgreSQL แบบฝังตัว (`npm run db:start`) และตัวจำลอง Gateway สำหรับการพัฒนา (`npm run mock:daemon`) ซึ่งทั้งสองไม่ได้ตั้งค่า WireGuard หรือ `nftables`

### 3.2 เปิดเทอร์มินัลในโฟลเดอร์โปรเจกต์

เปิด **PowerShell** (Windows) หรือ **Terminal** (Linux/macOS) แล้วเข้าไปยังโฟลเดอร์ของโปรเจกต์ แทนที่ตัวอย่างด้วยตำแหน่งที่คุณดาวน์โหลดโปรเจกต์ไว้:

**Windows (PowerShell):**

```powershell
cd <path-to>\Mango_VPN_Trainee
```

**Linux / macOS (Bash):**

```bash
cd <path-to>/Mango_VPN_Trainee
```

### 3.3 รันการตรวจสอบความพร้อม

รันคำสั่งเดียวกันได้บนทั้งสองระบบ:

```bash
npm run check:env
```

Track A ควรรันการตรวจสอบเฉพาะบทบาทแทน โดยสคริปต์จะทำเครื่องหมาย Docker CLI, Docker Compose, Docker Desktop/Engine และ Go เป็น `OPTIONAL`:

```bash
npm run check:env -- --role Rain
```

บน Windows ก็ใช้ `npm run check:env -- -Role Rain` ได้เช่นกัน

**สิ่งที่ควรเห็น:** ตารางแสดงสถานะและเวอร์ชันของเครื่องมือ ตามด้วยสรุปความพร้อมเมื่อ Node.js, npm และ Git พร้อมใช้งาน บน Linux สคริปต์จะตรวจ `wg`, `wg-quick`, `ip` และ `nft` ส่วนบน Windows จะตรวจ `wireguard.exe` สคริปต์ตรวจเพียงว่าคำสั่งอยู่บน `PATH` หรือไม่ ไม่ได้ติดตั้งเครื่องมือให้ และไม่ได้ตรวจความถูกต้องของการตั้งค่า WireGuard

หากคุณจะใช้ Agent จริง ให้ตรวจ Go แยกต่างหาก:

```bash
go version
```

**สิ่งที่ควรเห็น:** `go1.26` หรือใหม่กว่า หาก shell แจ้งว่าไม่รู้จักคำสั่ง ให้ติดตั้งเครื่องมือแล้วเปิดเทอร์มินัลใหม่ เพื่อให้ `PATH` ที่อัปเดตถูกโหลด

### 3.4 ตรวจสอบว่า Docker ทำงานอยู่ (เฉพาะ Track B และ C)

ข้ามหัวข้อนี้สำหรับ Track A

- **Windows:** เปิด **Docker Desktop** แล้วรอจนแถบสถานะด้านซ้ายล่างขึ้นว่า **Engine running**
- **Linux (Docker Engine):** เริ่มบริการ และเพิ่มผู้ใช้เข้ากลุ่ม `docker` หากพบข้อผิดพลาดเรื่องสิทธิ์ (ต้องออกจากระบบแล้วล็อกอินใหม่หลังจากนั้น):

  ```bash
  sudo systemctl start docker
  sudo usermod -aG docker "$USER"
  ```

จากนั้นรันการตรวจสอบเดียวกันบนทั้งสองระบบ:

```bash
docker info
```

**สิ่งที่ควรเห็น:** รายงานยาวที่มีทั้งส่วน **Client** และ **Server** ข้อความ `error during connect` (Windows) หรือ `Cannot connect to the Docker daemon` (Linux) หมายความว่า Engine ยังไม่ทำงาน การมีเพียง Docker CLI ไม่เพียงพอ

## 4. ระยะที่ 2: ติดตั้งครั้งแรกและตั้งค่า `.env`

รันขั้นตอนเหล่านี้จากรากของโปรเจกต์

### 4.1 ติดตั้งและ Build

```bash
npm install
npm run build
```

`npm install` ติดตั้ง Dependency ของทุก npm Workspace ส่วน `npm run build` จะ Build `@mango/shared` ก่อน แล้วจึง Build Workspace อื่นที่มีสคริปต์ build

**สิ่งที่ควรเห็น:** `npm install` จบโดยไม่มี `npm ERR!` ส่วน build จบพร้อมผลลัพธ์ของ Workspace ที่เกี่ยวข้องและไม่มี TypeScript error คำเตือนไม่จำเป็นต้องหมายถึงความล้มเหลวเสมอไป แต่ error และ exit code ที่ไม่ใช่ 0 คือความล้มเหลวจริง

### 4.2 สร้าง `.env` พร้อม Secret ที่แข็งแรง

API และ Docker Compose ต้องใช้ไฟล์ `.env` ที่รากของโปรเจกต์ รันตัวสร้างข้ามแพลตฟอร์มด้านล่าง ซึ่งทำงานเหมือนกันทั้งบน **Windows (PowerShell)** และ **Linux / macOS (Bash)**:

```bash
npm run env:init
```

`scripts/init-env.mjs` จะเริ่มจาก `.env.example` แล้วเขียน `.env` (UTF-8 **แบบไม่มี BOM**, file mode `0600`) ซึ่งประกอบด้วย:

- `POSTGRES_PASSWORD` แบบ URL-safe สุ่มขึ้นมา โดยใส่รหัสผ่านเดียวกันลงใน `DATABASE_URL` ด้วย
- `JWT_SECRET`, `REFRESH_SECRET` และ `DAEMON_SHARED_SECRET` เป็นค่า Base64 ขนาด 32 ไบต์ที่แยกจากกัน
- `TOTP_ENCRYPTION_KEY` เป็นเลขฐานสิบหก 64 ตัว (32 ไบต์)
- คู่กุญแจ WireGuard Curve25519 สำหรับ `WG_PRIVATE_KEY` และ `WG_SERVER_PUBLIC_KEY`

หาก `.env` มีอยู่แล้ว สคริปต์ **จะไม่เขียนทับ Secret ที่มีค่าอยู่** แต่จะเติมค่า `WG_PRIVATE_KEY` หรือ `WG_SERVER_PUBLIC_KEY` ที่ยังว่างอยู่ให้ ตัวเลือกที่รองรับ:

| ตัวเลือก | ผลลัพธ์ |
|---|---|
| `--force` | สร้างค่าทั้งหมดใหม่ |
| `--wg-only` | หมุนเวียนเฉพาะคู่กุญแจ WireGuard |
| `--output <path>` | เขียนไปยังไฟล์อื่นแทน `.env` |

**สิ่งที่ควรเห็น:** หากเป็นการตั้งค่าครั้งแรก จะแสดง `Created .env with fresh random secrets and WireGuard keypair (UTF-8 without BOM). Server Public Key: ...` หากค่าใน `.env` ครบทุกค่าอยู่แล้ว สคริปต์จะรายงานว่าไม่ได้แก้ไขไฟล์ อย่าวางค่า Secret ลงในแชตหรือ Commit ไฟล์ `.env`

<details>
<summary>ทางเลือก: สร้าง `.env` ด้วยตนเองในเชลล์ (ไม่บังคับ)</summary>

หากไม่ต้องการใช้ `npm run env:init` ให้สร้าง `.env` โดยตรง รันบล็อกของระบบปฏิบัติการของคุณจากรากของโปรเจกต์

**Windows (PowerShell):** ใช้ตัวสร้างเลขสุ่มเชิงเข้ารหัสของ .NET และเขียนไฟล์ UTF-8 **แบบไม่มี BOM** ไม่ต้องใช้ `openssl`

```powershell
if (Test-Path -LiteralPath .env) {
    Write-Host ".env already exists; leaving it unchanged."
} else {
    $template = [System.IO.File]::ReadAllText((Join-Path (Get-Location) '.env.example'))

    function New-CryptoRandomBytes([int]$Count) {
        $bytes = New-Object byte[] $Count
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $rng.GetBytes($bytes)
        } finally {
            $rng.Dispose()
        }
        return ,$bytes
    }

    function New-Base64Secret([int]$Count) {
        $bytes = New-CryptoRandomBytes $Count
        return [Convert]::ToBase64String($bytes)
    }

    function New-UrlSafePassword([int]$Count) {
        $bytes = New-CryptoRandomBytes $Count
        return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    }

    $dbPassword = New-UrlSafePassword 24
    $jwtSecret = New-Base64Secret 32
    $refreshSecret = New-Base64Secret 32
    $daemonSecret = New-Base64Secret 32
    $totpBytes = New-CryptoRandomBytes 32
    $totpKey = [BitConverter]::ToString($totpBytes).Replace('-', '').ToLowerInvariant()

    $template = [regex]::Replace($template, '(?m)^POSTGRES_PASSWORD=.*$', "POSTGRES_PASSWORD=$dbPassword")
    $template = [regex]::Replace($template, '(?m)^DATABASE_URL=.*$', "DATABASE_URL=postgresql://mango:$dbPassword@localhost:15432/mangovpn?schema=public")
    $template = [regex]::Replace($template, '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$jwtSecret")
    $template = [regex]::Replace($template, '(?m)^REFRESH_SECRET=.*$', "REFRESH_SECRET=$refreshSecret")
    $template = [regex]::Replace($template, '(?m)^DAEMON_SHARED_SECRET=.*$', "DAEMON_SHARED_SECRET=$daemonSecret")
    $template = [regex]::Replace($template, '(?m)^TOTP_ENCRYPTION_KEY=.*$', "TOTP_ENCRYPTION_KEY=$totpKey")

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $template, $utf8NoBom)
    Write-Host "Created .env with fresh random secrets (UTF-8 without BOM). Keep it private."
}
```

**Linux / macOS (Bash):** ใช้ `openssl` และเขียนไฟล์ UTF-8 ธรรมดา

```bash
if [ -e .env ]; then
  echo ".env already exists; leaving it unchanged."
else
  db_pw=$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=\n')
  jwt=$(openssl rand -base64 32 | tr -d '\n')
  refresh=$(openssl rand -base64 32 | tr -d '\n')
  daemon=$(openssl rand -base64 32 | tr -d '\n')
  totp=$(openssl rand -hex 32)

  cp .env.example .env
  sed -i \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$db_pw|" \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://mango:$db_pw@localhost:15432/mangovpn?schema=public|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$jwt|" \
    -e "s|^REFRESH_SECRET=.*|REFRESH_SECRET=$refresh|" \
    -e "s|^DAEMON_SHARED_SECRET=.*|DAEMON_SHARED_SECRET=$daemon|" \
    -e "s|^TOTP_ENCRYPTION_KEY=.*|TOTP_ENCRYPTION_KEY=$totp|" \
    .env
  echo "Created .env with fresh random secrets. Keep it private."
fi
```

หากต้องการกรอก `.env` ด้วยตนเอง ให้คัดลอก `.env.example` เป็น `.env` แล้วแทนที่ค่าแต่ละตัวด้วยผลลัพธ์จากคำสั่งเหล่านี้:

| คีย์ใน `.env` | ข้อกำหนด | Windows (PowerShell) | Linux / macOS (Bash) |
|---|---|---|---|
| `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET` | ≥ 32 ตัวอักษร แยกจากกันแต่ละตัว | `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)` | `openssl rand -base64 32` |
| `TOTP_ENCRYPTION_KEY` | เลขฐานสิบหกพอดี 64 ตัว | `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [BitConverter]::ToString($b).Replace('-', '').ToLowerInvariant()` | `openssl rand -hex 32` |

อย่าใช้ `Get-Random` สำหรับ Secret และให้ชื่อผู้ใช้ รหัสผ่าน พอร์ต และฐานข้อมูลใน `DATABASE_URL` ตรงกับค่า `POSTGRES_*` เสมอ

</details>

### 4.3 ตัวแปรใน `.env` แต่ละตัวทำหน้าที่อะไร

| ตัวแปร | หน้าที่ |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | ตั้งค่า PostgreSQL ทั้งสำหรับ Instance แบบฝังตัว (Track A) และคอนเทนเนอร์ Docker `postgres` (Track B และ C) เทมเพลตใช้ผู้ใช้ `mango`, ฐานข้อมูล `mangovpn` และพอร์ต Host `15432` |
| `DATABASE_URL` | บอก Prisma และ API ที่รันบน Host ว่าจะเชื่อมต่ออย่างไร ให้ชื่อผู้ใช้ รหัสผ่าน พอร์ต และฐานข้อมูลตรงกับค่า PostgreSQL |
| `JWT_SECRET`, `REFRESH_SECRET` | ใช้ลงนามเซสชันสำหรับการเข้าถึง API และการรีเฟรช แต่ละค่าต้องมีอย่างน้อย 32 ตัวอักษร |
| `TOTP_ENCRYPTION_KEY` | เข้ารหัสข้อมูลความลับของ TOTP ต้องเป็นเลขฐานสิบหก 64 ตัวพอดี |
| `DAEMON_SHARED_SECRET` | โทเคน Bearer ที่ใช้ร่วมกันระหว่าง API และ Gateway ยาวอย่างน้อย 32 ตัวอักษร และต้องตรงกันในทั้งสองบริการ |
| `NODE_ENV`, `PORT`, `API_PORT`, `CORS_ORIGIN` | สภาพแวดล้อมการทำงานของ API, พอร์ตของ API (ค่าเริ่มต้น `4000`) และ Origin ของพอร์ทัลที่อนุญาต (ค่าเริ่มต้น `http://localhost:3000`) |
| `WG_INTERFACE`, `WG_LISTEN_PORT`, `WG_GATEWAY_CIDR`, `WG_DNS`, `WG_SERVER_ENDPOINT` | การตั้งค่าอินเทอร์เฟซและเครือข่ายของ Gateway ค่าเริ่มต้นในเครื่อง: `wg0`, UDP `51820`, `10.13.13.1/24`, DNS `1.1.1.1` และ endpoint `127.0.0.1:51820` |
| `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY` | คู่กุญแจ WireGuard ของ Gateway ไม่จำเป็นสำหรับแบบฝึก Mock ของ Track A แต่จำเป็นสำหรับอุโมงค์จริงใน Track B และ C ต้องเก็บ Private key ไว้เป็นความลับ |
| `VITE_API_URL`, `VITE_AGENT_URL`, `PORTAL_PORT` | ที่อยู่ของ API และ Agent ที่พอร์ทัลใช้ และพอร์ต Host ของพอร์ทัลใน Docker ค่าเริ่มต้นในเครื่อง: API `http://localhost:4000`, Agent `http://127.0.0.1:47821`, พอร์ทัล `3000` |

ข้อมูลอ้างอิงฉบับเต็มอยู่ใน[บทที่ 05](05-troubleshooting-and-reference.md) ในหัวข้อตัวแปรสภาพแวดล้อม

**สิ่งที่ควรเห็นก่อนไปต่อ:** `npm install` และ `npm run build` สำเร็จ มีไฟล์ `.env` และ `npm run check:env` แสดงว่าเครื่องมือที่จำเป็นพร้อมใช้งาน

---

**ถัดไป:** [01 Track A: พัฒนาในเครื่องแบบไม่ใช้ Docker](01-track-a-local-dev.md) →

> 🏠 [สารบัญคู่มือ](../../../TUTORIAL.th.md) › **00 ภาพรวมและการเตรียมระบบ** › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 การทดสอบ](04-testing-playbook.md) · [05 การแก้ไขปัญหา](05-troubleshooting-and-reference.md) · [06 ภาคผนวก](06-appendix-local-docker-smoke-test.md)
