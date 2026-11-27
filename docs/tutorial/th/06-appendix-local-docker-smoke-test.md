> 🌐 **Language / ภาษา**: [🇬🇧 English](../06-appendix-local-docker-smoke-test.md) | **🇹🇭 ภาษาไทย**

← ก่อนหน้า: [การแก้ปัญหาและข้อมูลอ้างอิง](05-troubleshooting-and-reference.md) | 📚 [สารบัญคู่มือ](../../../TUTORIAL.th.md) | ถัดไป: —

# 🧪 ภาคผนวก: การทดสอบ Docker ในเครื่อง (เครื่องเดียว)

ภาคผนวกนี้เก็บการทดสอบแบบ **เครื่องเดียว** ฉบับดั้งเดิมที่ไม่ต้องใช้ GNS3 หรือ VM บน cloud ไว้ เป็นวิธีที่เร็วที่สุดในการพิสูจน์ว่า API, Portal, ฐานข้อมูล, Gateway และ Client Agent ทำงานร่วมกันบนโน้ตบุ๊กเครื่องเดียว สำหรับห้องปฏิบัติการแบบเครือข่าย ดู [Track B: GNS3 Mock Cloud](02-track-b-gns3-mock-cloud.md) และ [Track C: การ Deploy บน Cloud](03-track-c-cloud-deployment.md)

มีสองทางเลือก เลือก**หนึ่ง**ทาง

- **ทางเลือกที่ 1** - รัน API/portal บน Host + Docker `postgres` และ `vpn-gateway` (พร้อม `docker-compose.test-targets.yml` สำหรับทดสอบบทบาท ซึ่งเป็นทางเลือกเสริม)
- **ทางเลือกที่ 2** - คอนเทนเนอร์ทั้งสี่ตัวใน Docker ผ่าน `docker compose up -d --build`

ทั้งสองแบบต้องมี `.env` ที่รากของ repository สร้างครั้งเดียวด้วย:

```bash
npm run env:init
```

คำสั่งนี้เขียน `.env` พร้อม `POSTGRES_PASSWORD`, `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET` ค่าใหม่, `TOTP_ENCRYPTION_KEY` ขนาด 64 hex และคู่กุญแจ WireGuard แบบ Curve25519 อย่าวางค่าของมันลงในแชตหรือ Commit มัน

---

## ทางเลือกที่ 1: API/Portal บน Host + Docker `postgres` & `vpn-gateway`

วิธีนี้ตรงกับโฟลว์ Track B ฉบับดั้งเดิม: มีเพียงฐานข้อมูลและ Linux Gateway เท่านั้นที่รันใน Docker ส่วน API และ Portal รันบน Host ของคุณด้วย `npm` และ Client Agent รันแบบเนทีฟบน Host ของคุณ

### 1.1 เริ่ม `postgres` และ `vpn-gateway`

```bash
docker compose up -d postgres vpn-gateway
docker compose ps
```

**สิ่งที่ควรเห็น:** `mango-postgres` และ `mango-vpn-gateway` รอจนกว่า health check ของทั้งคู่รายงาน `healthy`

หาก `WG_PRIVATE_KEY` / `WG_SERVER_PUBLIC_KEY` ว่างอยู่ ให้เติมค่า วิธีที่ใช้ได้ข้ามแพลตฟอร์ม:

```bash
npm run env:init -- --wg-only
```

หรือสร้างด้วยเครื่องมือ `wg` ของคอนเทนเนอร์ Gateway เองโดยไม่พิมพ์ Private Key:

**Windows (PowerShell):**

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

**Linux / macOS (Bash):**

```bash
wg_private=$(docker exec mango-vpn-gateway wg genkey | tr -d '\r\n')
wg_public=$(printf '%s' "$wg_private" | docker exec -i mango-vpn-gateway wg pubkey | tr -d '\r\n')
sed -i \
  -e "s|^WG_PRIVATE_KEY=.*|WG_PRIVATE_KEY=$wg_private|" \
  -e "s|^WG_SERVER_PUBLIC_KEY=.*|WG_SERVER_PUBLIC_KEY=$wg_public|" \
  .env
echo "Updated WG_PRIVATE_KEY and WG_SERVER_PUBLIC_KEY in .env (Server Public Key: $wg_public)"
```

สร้าง Gateway ใหม่เพื่อให้มันโหลด Private Key แล้วเตรียมและ Seed ฐานข้อมูล:

**Windows (PowerShell):**

```powershell
docker compose up -d vpn-gateway
npm run db:generate
npm run db:migrate
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

**Linux / macOS (Bash):**

```bash
docker compose up -d vpn-gateway
npm run db:generate
npm run db:migrate
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

**สิ่งที่ควรเห็น:** Gateway กลับมาเป็น `healthy`; การ generate และ migrate ของ Prisma เสร็จสิ้น; การ Seed รายงาน `Seeded roles [ADMIN, STAFF, CLIENT] and ADMIN user "admin".` รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษร

### 1.2 รัน API และ Portal บน Host

เปิดสองเทอร์มินัลที่รากของ repository:

```bash
npm run dev:api      # เทอร์มินัล A
npm run dev:portal   # เทอร์มินัล B
```

**สิ่งที่ควรเห็น:** API บันทึกว่ากำลังรับฟังที่ `:4000`; Vite พิมพ์ `http://localhost:3000/` เปิดทั้งสองค้างไว้

### 1.3 รัน Client Agent แบบเนทีฟบน Host

Portal เรียก `127.0.0.1:47821` ดังนั้น Agent ต้องรันบน Host ของคุณ ไม่ใช่ใน Docker เลือกหนึ่ง:

- **Mock (ไม่มีอุโมงค์จริง):** `npm run mock:agent` มันพิมพ์กล่องเริ่มต้นพร้อม `PairingToken:` คัดลอกโทเคนนั้น
- **Go agent จริง:** ดูขั้นตอน B5 ของคู่มือหลัก บน Windows ใช้ Administrator PowerShell; บน Linux ใช้ `sudo -E "$(command -v go)" run .`

**สิ่งที่ควรเห็น:** ไม่กล่องของ mock พร้อม `PairingToken:` หรือ log `listening on 127.0.0.1:47821` ของ Go agent

### 1.4 ทางเลือกเสริม - พิสูจน์การบังคับใช้ตามบทบาทด้วย target harness ในเครื่อง

วิธีนี้ใช้โหนดเป้าหมายแบบ static สามตัวเดียวกับ Track B แต่บนเครื่องเดียว

1. Seed นโยบาย Track B:

   ```bash
   npm run db:seed:test-targets
   ```

   **สิ่งที่ควรเห็น:** `Seeded 12 Track B VPN policies.` ตัว Seeder จะ upsert ตามบทบาทและชื่อ; มันอัปเดตแถวของ Mission 3 ที่ชื่อ `Allow Internal Web` (STAFF) และ `Block Admin Subnet` (CLIENT) แทนที่จะสร้างซ้ำ และตั้ง `Allow Internal Web` เป็น priority `101`

2. เริ่ม test stack:

   ```bash
   npm run docker:test-targets:up
   ```

   คำสั่งนี้รัน `docker compose -f docker-compose.yml -f docker-compose.test-targets.yml` พร้อม `postgres vpn-gateway target-routes target-admin target-staff target-client test-harness` ให้รันอีกครั้งหลังรีสตาร์ต `vpn-gateway` เพราะ `target-routes` รันเพียงครั้งเดียว (`restart: "no"`)

3. ตรวจสอบว่า `AGENT_ALLOWED_ORIGINS` ของ Agent รวม origin ของ harness (`http://localhost:3090,http://127.0.0.1:3090`) หากคุณเปลี่ยน allowlist ให้รีสตาร์ต Agent

4. เปิด `http://localhost:3090` และใช้หน้าสำหรับบทบาทที่คุณกำลังทดสอบ (`/admin.html`, `/staff.html` หรือ `/client.html`) harness ถูกเผยแพร่เฉพาะบน `127.0.0.1:${TEST_HARNESS_PORT:-3090}`

   ป้อน URL ของ Agent (ค่าเริ่มต้น `http://127.0.0.1:47821`) วางโทเคนจับคู่ คลิก **Save** แล้วคลิก **Check /health** และ **Get /status**

5. เชื่อมต่ออุโมงค์ในฐานะผู้ใช้ของบทบาทนั้น แล้วคลิก **Probe All 3 VPN Targets** แต่ละแถวจะแสดง **REACHABLE**/**BLOCKED**/**TIMEOUT** พร้อม **PASS**/**MISMATCH** การทดสอบที่หมดเวลาหลัง 3.5 วินาทีจะถูกรายงานเป็น `TIMEOUT` หน้า index จะแสดง `N/A (overview)` และไม่ตรวจสอบบทบาทใด

**ตารางการเข้าถึงที่คาดหวัง:**

| บทบาทที่เชื่อมต่อ | `10.99.0.10` (admin) | `10.20.0.10` (staff) | `10.30.0.10` (client) |
| --- | --- | --- | --- |
| ADMIN | ALLOW | ALLOW | ALLOW |
| STAFF | DENY | ALLOW | ALLOW |
| CLIENT | DENY | DENY | ALLOW |

**การตรวจสอบ HTTPS ด้วยมือ:** harness ทดสอบเฉพาะ HTTP หากต้องการตรวจสอบ HTTPS ให้เชื่อมต่ออุโมงค์แล้วรัน:

```bash
curl -k https://10.20.0.10/health.json
```

ใช้ `-k` เพราะใบรับรองของโหนดเป้าหมายแต่ละตัวเป็น self-signed โดยตั้ง `CN` เป็น IP เป้าหมาย

> [!NOTE]
> test stack **ไม่**หยุดด้วย `docker compose down` ธรรมดา เพราะคำสั่งนั้นไม่รวม `docker-compose.test-targets.yml` ให้หยุดด้วย `npm run docker:test-targets:down`

---

## ทางเลือกที่ 2: สแตก Docker Compose แบบ 4 คอนเทนเนอร์เต็มรูปแบบ

วิธีนี้ตรงกับเดโมคำสั่งเดียวฉบับดั้งเดิม: PostgreSQL, Gateway, API และ Portal ทั้งหมดอยู่ใน Docker เบราว์เซอร์ยังต้องมี Client Agent รันแบบเนทีฟบน Host ของคุณที่ `127.0.0.1:47821` ทำงานเหมือนกันบน Windows และ Linux

### 2.1 Build และเริ่มคอนเทนเนอร์

```bash
docker compose up -d --build
docker compose ps
```

อิมเมจ API รัน `prisma migrate deploy` โดยอัตโนมัติเมื่อคอนเทนเนอร์เริ่มทำงาน (`npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma && node Sobree/api/dist/server.js`)

**สิ่งที่ควรเห็น:** `postgres`, `vpn-gateway`, `api` และ `portal` ทำงานอยู่ทั้งหมด `postgres` และ `vpn-gateway` รายงาน `healthy`; `api` และ `portal` อาจแสดง `Up` โดยไม่มีป้าย health แยกต่างหาก Portal ถูกเผยแพร่ที่ `http://localhost:3000` และ API ที่ `http://localhost:4000`

### 2.2 Generate Prisma client หากจำเป็น และ Seed ADMIN

รันคำสั่งเหล่านี้บน Host ของคุณจากรากของ repository `.env` ที่รากให้ค่า `DATABASE_URL` ของ Host (`localhost:15432`)

**Windows (PowerShell):**

```powershell
npm run db:generate
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

**Linux / macOS (Bash):**

```bash
npm run db:generate
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

**สิ่งที่ควรเห็น:** การ generate ของ Prisma สำเร็จและการ Seed รายงานบทบาทและผู้ใช้ ADMIN เริ่มต้น

ทางเลือกเสริม - เพิ่มนโยบาย Track B สำหรับตารางการบังคับใช้ตามบทบาท:

```bash
npm run db:seed:test-targets
```

### 2.3 รัน Agent แบบเนทีฟบน Host

ในเทอร์มินัล Host ใหม่ รันหนึ่งใน:

- `npm run mock:agent` (ไม่มีอุโมงค์จริง; ทำงานบน Windows และ Linux) หรือ
- Go agent จาก Track B ขั้นตอน B5 (อุโมงค์จริง; Administrator PowerShell บน Windows, `sudo -E "$(command -v go)" run .` บน Linux)

**สิ่งที่ควรเห็น:** กล่องเริ่มต้นของ mock พร้อม `PairingToken:` ในกรณีแรก หรือ log การรับฟังของ Go ในกรณีที่สอง Portal อยู่ที่ `http://localhost:3000`

### 2.4 ตรวจสอบ Docker Gateway (ขณะเชื่อมต่อ)

Gateway รันใน Docker ดังนั้นคำสั่งจึงเหมือนกันบนทั้งสอง OS:

```bash
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn
```

**สิ่งที่ควรเห็น:** `wg show` แสดงอินเทอร์เฟซ `wg0` พอร์ตที่รับฟัง และ Peer พร้อม Public Key และ allowed IP ของมัน คำสั่ง `nft` พิมพ์ตาราง `inet mango_vpn` และกฎการ Forward ของมัน

---

## การปิดระบบอย่างสะอาด

หยุดโปรเซสบน Host ก่อน (**Ctrl+C** ในแต่ละเทอร์มินัลที่รัน `npm run dev:api`, `npm run dev:portal`, `npm run mock:agent` หรือ `go run .`) หากอุโมงค์ Go เชื่อมต่ออยู่ ให้คลิก **Disconnect** ก่อน

จากนั้นหยุด Docker

- **หากคุณใช้ test-targets stack (ทางเลือกที่ 1, ขั้นตอน 1.4):**

  ```bash
  npm run docker:test-targets:down
  ```

  **สิ่งที่ควรเห็น:** Compose ลบ `postgres`, `vpn-gateway`, โหนดเป้าหมายทั้งสาม, `target-routes` และ `test-harness` Volume แบบมีชื่อยังคงอยู่

- **มิฉะนั้น (ทางเลือกที่ 1 แบบพื้นฐาน หรือทางเลือกที่ 2):**

  ```bash
  docker compose down
  ```

  **สิ่งที่ควรเห็น:** คอนเทนเนอร์หยุดและถูกลบออก Volume ข้อมูล PostgreSQL แบบมีชื่อยังคงอยู่ ดังนั้น `docker compose up` ครั้งถัดไปจะใช้มันซ้ำ **อย่า**เพิ่ม `-v` เว้นแต่คุณต้องการลบข้อมูลฐานข้อมูลที่จัดเก็บไว้โดยเจตนา

---

← ก่อนหน้า: [การแก้ปัญหาและข้อมูลอ้างอิง](05-troubleshooting-and-reference.md) | 📚 [สารบัญคู่มือ](../../../TUTORIAL.th.md) | ถัดไป: —
