> 🌐 **Language / ภาษา**: [🇬🇧 English](../01-track-a-local-dev.md) | **🇹🇭 ภาษาไทย**

> 🏠 [สารบัญคู่มือ](../../../TUTORIAL.th.md) › [00 ภาพรวมและการเตรียมระบบ](00-overview-and-setup.md) › **01 Track A** › [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 การทดสอบ](04-testing-playbook.md) · [05 การแก้ไขปัญหา](05-troubleshooting-and-reference.md) · [06 ภาคผนวก](06-appendix-local-docker-smoke-test.md)

---

# 01 · Track A: เวิร์กโฟลว์ของ Rain (เว็บพอร์ทัล + Admin CRUD + Mock Agent แบบไม่ใช้ Docker)

Track A เป็นวิธีที่เร็วที่สุดในการเรียนรู้พอร์ทัล **ไม่ต้องใช้ Docker** เครื่องมือในเครื่องสามตัวทำหน้าที่แทนส่วนประกอบจริงในระบบ Production:

- **PostgreSQL 16 แบบฝังตัว** ผ่าน `npm run db:start` ฟังอยู่ที่ `127.0.0.1:15432` ข้อมูลอยู่ที่ `.local/postgres`
- **Mock VPN Gateway Daemon** ผ่าน `npm run mock:daemon` เป็นตัวจำลอง API ของ Gateway สำหรับการพัฒนาเท่านั้น ฟังอยู่ที่ `http://127.0.0.1:50051` และแสดงข้อความ `[DEV MOCK DAEMON – no wg/nftables enforcement]`
- **Mock Local Agent** ผ่าน `npm run mock:agent` ฟังอยู่ที่ `http://127.0.0.1:47821` ทำงานได้ทั้ง Windows และ Linux และตรวจจับระบบปฏิบัติการเพื่อกำหนดค่า platform

การเชื่อมต่อ การสร้างนโยบาย และการเพิกถอนอุปกรณ์หรือเซสชันจะเรียก Gateway ที่ `127.0.0.1:50051` การรัน `npm run mock:daemon` ช่วยไม่ให้เกิดการตอบกลับ `502 Bad Gateway` โดยไม่ต้องใช้ Docker แต่ก็ **พิสูจน์ได้แค่ขั้นตอนของ API และ UI ไม่ใช่การบังคับใช้ระดับเครือข่ายจริง** Mock agent จำลองสัญญา Loopback และการแสดงผลเมื่อเชื่อมต่อแล้ว แต่ **ไม่ได้ติดตั้งอุโมงค์ WireGuard และไม่ส่งทราฟฟิกจริง**

> **ข้อกำหนดเบื้องต้น:** [บทที่ 00](00-overview-and-setup.md) ต้องทำเสร็จแล้ว ได้แก่ `npm install`, `npm run build` และสร้าง `.env` ด้วย `npm run env:init`

> **วิธีอ่านคำสั่ง:** ทุกขั้นตอนจะแสดงบล็อก **Windows (PowerShell)** และบล็อก **Linux / macOS (Bash)** เมื่อคำสั่งต่างกัน ตัวแปรสภาพแวดล้อมจะถูกตั้งค่า **เฉพาะในเซสชันเทอร์มินัลนั้น** โดย PowerShell ใช้ `$env:NAME=...` และ `Remove-Item Env:NAME` ส่วน Bash ใช้ `export NAME=...` และ `unset NAME`

---

## ขั้นตอน A1: เริ่ม PostgreSQL แบบฝังตัวและเตรียมฐานข้อมูล

เปิด **Terminal 1** แล้วเริ่มฐานข้อมูลแบบฝังตัว ทิ้งไว้ให้ทำงาน:

```bash
npm run db:start
```

กด **Ctrl+C** ในเทอร์มินัลนี้เพื่อหยุด PostgreSQL อย่างถูกต้อง และรอให้หยุดสนิทก่อนจึงรัน `npm run db:reset-local` ซึ่งจะลบ `.local/postgres` และข้อมูลฐานข้อมูลในเครื่องทั้งหมด

เปิด **เทอร์มินัลตั้งค่าแยกต่างหาก** ที่รากของโปรเจกต์ แล้วรัน:

```bash
npm run db:generate
npm run db:migrate
```

`db:generate` สร้าง Prisma client จาก schema ปัจจุบัน ส่วน `db:migrate` ใช้ migration สำหรับการพัฒนาที่ commit ไว้กับฐานข้อมูล `mangovpn`

**สิ่งที่ควรเห็น:** Terminal 1 แสดง `PostgreSQL running at 127.0.0.1:15432` และสร้างทั้ง `mangovpn` (จาก `POSTGRES_DB`) และ `mangovpn_v2_test` ขั้นตอน generate และ migrate ของ Prisma ในเทอร์มินัลตั้งค่าเสร็จโดยไม่มี error

> **ฐานข้อมูลสำหรับทดสอบ (จำเป็นก่อนรัน `npm test`):** `npm test` ใช้ `mangovpn_v2_test` ให้ migrate ฐานข้อมูลนี้หนึ่งครั้งในเทอร์มินัลตั้งค่า โดยแทนที่ `<password>` ด้วย `POSTGRES_PASSWORD` จาก `.env`
>
> **Windows (PowerShell):**
>
> ```powershell
> $env:DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
> npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
> Remove-Item Env:DATABASE_URL
> ```
>
> **Linux / macOS (Bash):**
>
> ```bash
> export DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
> npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
> unset DATABASE_URL
> ```
>
> ให้ `DATABASE_URL` **ไม่ถูกตั้งค่า** ในเทอร์มินัลที่รัน `npm run dev:api` เพื่อให้ API ใช้ฐานข้อมูล `mangovpn` จาก `.env` หากคุณ export ค่าไว้ในเทอร์มินัลนี้ ให้รัน `Remove-Item Env:DATABASE_URL` (PowerShell) หรือ `unset DATABASE_URL` (Bash) หรือเปิดเทอร์มินัลใหม่

---

## ขั้นตอน A2: Seed บัญชี ADMIN แรกของคุณ

เลือกรหัสผ่านส่วนตัวที่มีความยาว **อย่างน้อย 12 ตัวอักษร** ค่าด้านล่างเป็นเพียงตัวอย่าง ให้แทนที่ด้วยรหัสผ่านของคุณเอง และ **จดชื่อผู้ใช้กับรหัสผ่านเก็บไว้ในที่ปลอดภัย** คำสั่ง seed จะไม่แสดงรหัสผ่าน

**Windows (PowerShell):**

```powershell
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

**Linux / macOS (Bash):**

```bash
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

คำสั่ง seed จะสร้างหรืออัปเดตบทบาท `ADMIN`, `STAFF` และ `CLIENT` พร้อมผู้ใช้ ADMIN เริ่มต้น หากต้องการใช้อีเมลสำหรับล็อกอินอื่น ให้ตั้งค่า `SEED_ADMIN_EMAIL` ในลักษณะเดียวกันก่อนรัน seed มิฉะนั้นอีเมลจะเป็น `admin@mangovpn.local`

**สิ่งที่ควรเห็น:** ข้อความคล้ายกับ `Seeded roles [ADMIN, STAFF, CLIENT] and ADMIN user "admin".` และ prompt กลับมาหลังจากลบตัวแปรรหัสผ่านแล้ว

---

## ขั้นตอน A3: เปิดห้าเทอร์มินัล

เปิดทั้งห้าเทอร์มินัลค้างไว้ขณะใช้งานพอร์ทัล เปิดแต่ละเทอร์มินัลที่รากของโปรเจกต์

**Terminal 1: PostgreSQL 16 แบบฝังตัว** (ทำงานอยู่แล้วจากขั้นตอน A1) ให้เปิดหน้าต่าง `npm run db:start` ไว้ อย่าปิดขณะที่ API หรือการทดสอบกำลังใช้ฐานข้อมูล

**Terminal 2: Mock VPN gateway daemon (สำหรับการพัฒนาเท่านั้น)**

```bash
npm run mock:daemon
```

**สิ่งที่ควรเห็น:** `[DEV MOCK DAEMON – no wg/nftables enforcement]` จากนั้น `This simulator does not program WireGuard or nftables.` และ `Listening on http://127.0.0.1:50051` ตัวจำลองจะอ่าน `DAEMON_SHARED_SECRET` จาก `.env` และจะไม่เริ่มทำงานหากค่านี้ไม่มีอยู่หรือสั้นกว่า 32 ตัวอักษร ข้อมูล Peer และนโยบายเก็บไว้ในหน่วยความจำเท่านั้น

**Terminal 3: Mock local agent**

```bash
npm run mock:agent
```

**สิ่งที่ควรเห็น:** กล่องข้อความเริ่มต้นที่มีหัวข้อ `MANGO VPN - Local Windows Agent Simulator (v2)` พร้อม address `http://127.0.0.1:47821` ให้หาบรรทัด `PairingToken:` แล้วคัดลอกค่าทั้งหมด ปล่อยเทอร์มินัลนี้ทำงานต่อไป Mock จะสร้าง token ใหม่ทุกครั้งที่เริ่มทำงาน เว้นแต่คุณจะกำหนดค่าเอง ชื่อกล่องข้อความเป็นชื่อเดิมที่ยังคงอยู่ ตัวจำลองนี้ทำงานบน Linux ได้เช่นกัน และค่า platform จะเป็นไปตาม OS ของคุณ (`linux-x64` บน Linux, `windows-x64` บน Windows)

**Terminal 4: Control Plane API**

```bash
npm run dev:api
```

**สิ่งที่ควรเห็น:** Log ของ Fastify แจ้งว่ากำลัง listen ที่ `:4000` (มักเป็น `http://127.0.0.1:4000`) ปล่อยให้ทำงานต่อไป หาก Secret หายไปหรือไม่ถูกต้อง หรือฐานข้อมูลเข้าถึงไม่ได้ API จะเริ่มทำงานไม่สำเร็จ ให้ตรวจสอบ `.env` และฐานข้อมูล

**Terminal 5: เว็บพอร์ทัล**

```bash
npm run dev:portal
```

**สิ่งที่ควรเห็น:** Vite แสดง `http://localhost:3000/` ให้เปิดที่อยู่นั้นในเบราว์เซอร์ ทุกบทบาท (`ADMIN`, `STAFF`, `CLIENT`) ล็อกอินผ่าน URL พอร์ทัลเดียวกันนี้

### ทางลัด: `npm run dev:demo`

`npm run dev:demo` เริ่ม mock agent และพอร์ทัลแยกตามบทบาทอีกสามพอร์ต ได้แก่ Admin ที่ `:3000`, Staff ที่ `:3001` (`somchai_staff`) และ Client ที่ `:3002` (`wansob_test`) ส่วน `npm run dev:portal:all` เริ่มพอร์ทัลสามตัวเดียวกันโดยไม่มี agent ทั้งสองคำสั่งไม่ได้เริ่ม API หรือ Gateway daemon ให้รัน `npm run db:start`, `npm run mock:daemon` และ `npm run dev:api` ควบคู่กันไป

---

## สิ่งที่ควรเปิดทำงานอยู่

| เทอร์มินัล | คำสั่ง | Address |
|---|---|---|
| 1 | `npm run db:start` | `127.0.0.1:15432` |
| 2 | `npm run mock:daemon` | `http://127.0.0.1:50051` |
| 3 | `npm run mock:agent` | `http://127.0.0.1:47821` |
| 4 | `npm run dev:api` | `http://localhost:4000` |
| 5 | `npm run dev:portal` | `http://localhost:3000` |

**สิ่งที่ควรเห็นก่อนไปต่อ:** การล็อกอินที่ `http://localhost:3000` ด้วยรหัสผ่านแอดมินจากขั้นตอน A2 ทำงานได้ จากนั้นไปต่อที่[บทที่ 04](04-testing-playbook.md) เพื่อทำภารกิจที่ 1 ถึง 4

---

**ถัดไป:** [04 คู่มือการทดสอบแบบทีละขั้นตอน](04-testing-playbook.md) → (ภารกิจที่ 1 ถึง 4 และชุดทดสอบอัตโนมัติ)

> 🏠 [สารบัญคู่มือ](../../../TUTORIAL.th.md) › [00 ภาพรวมและการเตรียมระบบ](00-overview-and-setup.md) › **01 Track A** › [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 การทดสอบ](04-testing-playbook.md) · [05 การแก้ไขปัญหา](05-troubleshooting-and-reference.md) · [06 ภาคผนวก](06-appendix-local-docker-smoke-test.md)
