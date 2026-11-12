# 🌧️ คู่มือการพัฒนาสำหรับ Rain

[English](README.md) | [ภาษาไทย](README.th.md)

ยินดีต้อนรับครับ **Rain**! เอกสารฉบับนี้จัดทำขึ้นเพื่อให้คุณสามารถเริ่มต้นพัฒนาและทดสอบระบบในส่วนของคุณได้อย่างราบรื่น รวดเร็ว และไม่มีปัญหาติดขัดหรือชนกับโค้ดของ Sobree

---

## 1. ขอบเขตงานและความรับผิดชอบของคุณ

คุณรับผิดชอบ **ประสบการณ์การใช้งานของผู้ใช้ทั้งหมด (User Experience) และระบบจัดการแอดมิน (Admin CRUD)**:

1. **`Rain/portal/`**: เว็บพอร์ทัลแบบ Dark-mode ที่ทันสมัย (สร้างด้วย React 19 + Vite + Tailwind CSS + Lucide Icons)
2. **`Rain/admin/`**: โมดูลระบบหลังบ้าน (`@mango/rain-admin`) และสคริปต์เตรียมข้อมูลเริ่มต้นในฐานข้อมูล (`src/seed.ts`)
3. **การทดสอบผ่าน Mock Agent**: ใช้สคริปต์ `scripts/mock-agent.js` เพื่อจำลองการทำงานของ Windows Agent ทำให้คุณพัฒนา Frontend ได้โดยไม่ต้องติดตั้งภาษา Go หรือเปิดระบบเน็ตเวิร์ก WireGuard จริง

> [!NOTE]
> **หมดกังวลเรื่อง Git Merge Conflicts**: โค้ดทั้งหมดของคุณจะอยู่ในโฟลเดอร์ `Rain/` เท่านั้น ไม่จำเป็นต้องเข้าไปแก้ไขไฟล์ในโฟลเดอร์ `Sobree/` เลย เมื่อคุณปรับแก้ไฟล์ใน `Rain/admin` ระบบ API ของ Sobree จะดึงไปใช้งานโดยอัตโนมัติผ่านระบบ Workspace!

---

## 2. สิ่งที่คุณต้องติดตั้งในเครื่อง (Prerequisites)

สำหรับคุณ Rain **ต้องการเพียงแค่ Node.js เท่านั้น!** ไม่จำเป็นต้องลง Go, Docker หรือ WireGuard:

- **Node.js**: เวอร์ชัน `>= 18.0.0` (แนะนำ Node 20 LTS ขึ้นไป)
- **npm**: เวอร์ชัน `>= 9.0.0` (มาพร้อมกับ Node.js อยู่แล้ว)

ตรวจสอบความพร้อมใน Terminal ด้วยคำสั่ง:
```powershell
node -v
npm -v
```

---

## 3. ขั้นตอนการเริ่มทำงานในแต่ละวัน (เปิด 3 Terminals)

เปิดหน้าต่าง PowerShell หรือ Terminal 3 หน้าต่างที่โฟลเดอร์หลักของโปรเจกต์ (`Mango_VPN_Trainee`):

### Terminal 1: รันโปรแกรมจำลอง Windows Agent
```powershell
npm run mock:agent
```
- **ที่อยู่ URL**: `http://127.0.0.1:47821`
- **หน้าที่**: จำลองเซอร์วิสของ Agent บน Windows โดยเปิดฟีเจอร์ **Private Network Access (PNA)** ไว้อย่างถูกต้อง ทำให้หน้าเว็บในเบราว์เซอร์สามารถยิงคำสั่งมาที่เครื่องตัวเอง (127.0.0.1) ได้โดยไม่ติดปัญหา CORS

---

### Terminal 2: รันระบบ API Backend
```powershell
npm run dev:api
```
- **ที่อยู่ URL**: `http://localhost:4000`
- **หน้าที่**: เริ่มรัน Fastify API ของ Sobree ซึ่งจะดึงโมดูล CRUD ใน `Rain/admin` ของคุณมารวมให้อัตโนมัติ
- **ข้อสังเกตสำคัญ**: เมื่อคุณทดสอบล็อกอินในหน้าเว็บ รหัส OTP 6 หลักจะแสดงขึ้นมาใน Terminal นี้!

---

### Terminal 3: รันหน้าเว็บ Portal UI
```powershell
npm run dev:portal
```
- **ที่อยู่ URL**: `http://localhost:3000`
- **หน้าที่**: เปิด Vite Dev Server พร้อมฟีเจอร์ Hot Module Replacement (แก้โค้ดแล้วหน้าเว็บรีเฟรชให้ทันที)

---

## 4. โครงสร้างและการทำงานของหน้าเว็บ (`Rain/portal`)

ไฟล์เริ่มต้นหลักอยู่ที่ [`Rain/portal/src/App.tsx`](file:///e:/Trainee/Mango_VPN_Trainee/Rain/portal/src/App.tsx)

### A. ไฟสถานะระบบ (Status Indicator Pills)
บริเวณมุมขวาบนของหน้าเว็บ:
1. **Portal Online**: ตรวจสอบสถานะไปยัง `GET http://localhost:4000/health` หากเปิด API ไว้จะเป็นสีเขียว
2. **Agent Status**: ยิงตรวจสอบ `GET http://127.0.0.1:47821/health` ทุกๆ 3 วินาที
   - แสดง **Installed (1.0.0-mock)** เมื่อรัน `npm run mock:agent`
   - แสดง **Not Detected** หากไม่ได้เปิดตัวจำลอง Agent ไว้
3. **Connection**: แสดงสถานะการเชื่อมต่อ ได้แก่ `Disconnected`, `Connecting` (มีอนิเมชันกะพริบ) และ `Connected` (สีเขียว)

### B. การเชื่อมต่อ 5 ขั้นตอน (Connection Flow)
1. **เข้าสู่ระบบ (Sign In)**: ผู้ใช้กรอก Username และ Password
   - บัญชีทดสอบที่มีในระบบ:
     - แอดมิน: `admin_user` / `MangoVPN2026!`
     - พนักงาน: `staff_user` / `MangoVPN2026!`
     - ลูกค้า: `client_user` / `MangoVPN2026!`
2. **สร้างคำขอ MFA**: หน้าเว็บยิงไปที่ `POST /api/auth/login` เซิร์ฟเวอร์จะตอบกลับมาพร้อม `challengeId` และเบอร์โทรที่เซนเซอร์ไว้ (เช่น `+1555****567`)
3. **กรอก OTP**: โมดอลยืนยันตัวตนจะแสดงขึ้นมา ผู้ใช้กรอก OTP 6 หลัก (ดูเลขได้จาก Terminal 2) แล้วส่งไปที่ `POST /api/auth/verify-otp`
4. **ออกโทเคน**: ระบบส่ง `accessToken` กลับมา
5. **เชื่อมต่อ VPN**: ผู้ใช้กดปุ่มสีเขียวขนาดใหญ่ **VPN CONNECT**:
   - หน้าเว็บจะยิงคำสั่งตรงไปที่ Agent ภายในเครื่อง `POST http://127.0.0.1:47821/connect`
   - Agent จำลองจะทำการเชื่อมต่อและจ่าย IP กลับมา (เช่น `10.13.13.45/32`)
   - หน้าเว็บจะเปลี่ยนสถานะเป็น **Connected** พร้อมแสดงปริมาณข้อมูลเข้า/ออก (RX/TX) แบบเรียลไทม์ และแสดงปุ่ม **DISCONNECT VPN**

---

## 5. การพัฒนาและปรับแต่ง Admin CRUD (`Rain/admin`)

โค้ดระบบจัดการแอดมินของคุณจะอยู่ใน [`Rain/admin/src/`](file:///e:/Trainee/Mango_VPN_Trainee/Rain/admin/src/):

| ไฟล์ | หน้าที่การทำงาน |
| --- | --- |
| `admin.service.ts` | ฟังก์ชันดึงข้อมูลจากฐานข้อมูลผ่าน Prisma (Devices, Sessions, Logs, Versions) |
| `admin.controller.ts` | ตรวจสอบข้อมูลคำขอและจัดรูปแบบคำตอบส่งกลับ |
| `admin.routes.ts` | กำหนดเส้นทาง URL บน Fastify (`/api/devices`, `/api/sessions`, ฯลฯ) |
| `seed.ts` | สคริปต์ใส่ข้อมูลเริ่มต้นลงฐานข้อมูล (ผู้ใช้งาน, สิทธิ์ และนโยบายไฟร์วอลล์) |

### Endpoints ที่คุณเป็นเจ้าของ:
- `GET /api/devices`: รายการอุปกรณ์ที่ลงทะเบียนไว้
- `GET /api/sessions`: ประวัติและระยะเวลาการเชื่อมต่อของผู้ใช้
- `GET /api/audit-logs`: บันทึกประวัติความปลอดภัยในระบบ (ดูได้เฉพาะ Role แอดมิน)
- `GET /api/agent-versions`: ข้อมูลเวอร์ชันล่าสุดของโปรแกรมติดตั้งบน Windows

### การรันใส่ข้อมูลทดสอบ (Seed Database):
เมื่อเปิด PostgreSQL ฐานข้อมูลแล้ว สามารถรันคำสั่งนี้เพื่อใส่ข้อมูลเริ่มต้น:
```powershell
npm run db:seed
```

---

## 6. การตรวจสอบความถูกต้องและคอมไพล์โค้ด (Typecheck & Build)

ก่อนนำโค้ดส่งต่อหรือทำ Pull Request ให้ตรวจสอบว่าโค้ดคอมไพล์ผ่าน 100% ไม่มีข้อผิดพลาด:

```powershell
# คอมไพล์เช็คโค้ดฝั่ง admin ของคุณ
npm --workspace=@mango/rain-admin run build

# คอมไพล์และบิลด์หน้าเว็บ portal ของคุณ
npm --workspace=@mango/portal run build

# หรือสั่งบิลด์ทั้ง Monorepo พร้อมกัน
npm run build
```

---

## 7. คำถามที่พบบ่อย & การแก้ไขปัญหาเบื้องต้น (FAQs)

### ถาม: หน้าเว็บขึ้นว่า "Agent: Not Detected" เกิดจากอะไร?
> **วิธีแก้**: คุณยังไม่ได้เปิดตัวจำลอง Agent ให้เปิด Terminal ใหม่แล้วสั่งรัน `npm run mock:agent`

### ถาม: เบราว์เซอร์ฟ้องบล็อกการเชื่อมต่อไปยัง `127.0.0.1:47821`?
> **วิธีแก้**: เบราว์เซอร์ตระกูล Chromium มีระบบความปลอดภัย **Private Network Access (PNA)** ซึ่งตัว `mock-agent.js` ได้ใส่ Header `Access-Control-Allow-Private-Network: true` รองรับไว้แล้ว ตรวจสอบให้แน่ใจว่าเปิดใช้งาน `npm run mock:agent` และเข้าหน้าเว็บผ่าน `http://localhost:3000`

### ถาม: จะดูรหัส OTP 6 หลักได้จากที่ไหน?
> **วิธีแก้**: ดูใน Terminal 2 ที่รัน `npm run dev:api` อยู่ ระบบจะพิมพ์รหัสออกมาดังนี้:
> ```text
> ==================================================
> [AUTH MFA] 6-Digit OTP:  >>>>> 482910 <<<<<
> ==================================================
> ```

---

ขอให้สนุกกับการพัฒนาครับ Rain! หากติดปัญหาเรื่องโครงสร้างข้อมูล สามารถดูสัญญา API ได้ที่ [`packages/shared/src/contracts.ts`](file:///e:/Trainee/Mango_VPN_Trainee/packages/shared/src/contracts.ts) หรือปรึกษา Sobree ได้ตลอดครับ

