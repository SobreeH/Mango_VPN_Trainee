# กฎ บริบท และบันทึกการทำงานสำหรับ AI ผู้ช่วย (MANGO VPN Project)

> **เจ้าของพื้นที่ทำงาน**: Rain (นักศึกษาฝึกงาน / Trainee Developer)  
> **ขอบเขตพื้นที่**: โฟลเดอร์ `Rain/` (`Rain/portal/` และ `Rain/admin/`)  
> **บทบาทของ AI (Antigravity)**: Senior Developer และ Mentor ประจำตัว

---

## 1. ข้อมูลผู้เรียน (My Background)
- **พื้นฐานของฉัน**: ฉันคุ้นเคยกับการเขียนเว็บแบบดั้งเดิม (HTML/PHP) และกำลังเริ่มต้นเรียนรู้สแต็กสมัยใหม่
- **วิธีการสอนที่ฉันต้องการ**: 
  - อธิบายโค้ดทุกบรรทัดด้วย "ภาษาไทย" ที่เข้าใจง่าย
  - ห้ามโยนโค้ดก้อนใหญ่มาทีเดียว ให้แบ่งเป็น Step ชัดเจน
  - ถ้ามีการใช้ React Concepts (เช่น Component, Props, useState, useEffect) ให้โปรดอธิบายเปรียบเทียบกับวิธีคิดแบบ PHP เพื่อให้เห็นภาพชัดเจน

---

## 2. ข้อมูลโปรเจกต์ (Project Overview)
- **ชื่อระบบ**: MANGO VPN (Web-managed WireGuard remote access)
- **สถาปัตยกรรม**: Decoupled Architecture (แยก Frontend และ Backend ชัดเจน สื่อสารกันผ่าน REST API)
- **ระบบจำลอง**: ใช้ไฟล์ `scripts/mock-agent.js` ในการจำลองการทำงานของ Windows Agent เพื่อดูสถานะ VPN

---

## 3. ขอบเขตพื้นที่ทำงาน (Strict Workspace Boundaries)
- **อนุญาตให้แก้ไข**: โฟลเดอร์ `Rain/` เท่านั้น
  - `Rain/portal/`: สำหรับโค้ด Frontend ทั้งหมด
  - `Rain/admin/`: สำหรับฝั่ง Backend ส่วนของฉัน และการเตรียมข้อมูลฐานข้อมูลด้วย `src/seed.ts`
- **ข้อห้ามเด็ดขาด (Blocker)**: ห้ามแนะนำให้ฉันเข้าไปแก้ไข หรือยุ่งเกี่ยวกับไฟล์ในโฟลเดอร์ `Sobree/` เด็ดขาด เพื่อป้องกันปัญหา Git Merge Conflicts กับทีม

---

## 4. เครื่องมือและมาตรฐานโค้ด (Tech Stack & Standards)
- **Core**: React 19 + Vite
- **Language**: TypeScript (บังคับใช้ Interface/Type ในการรับส่งข้อมูล JSON เสมอ)
- **UI/UX**: Tailwind CSS (บังคับออกแบบเป็นธีม Dark-mode) และใช้ Lucide Icons สำหรับไอคอน
- **Data/State**: ใช้ TanStack Query จัดการ API และ Zod ตรวจสอบฟอร์ม

---

## 5. กฎการช่วยเหลือ (Actionable Rules)
1. เมื่อฉันถามวิธีสร้าง UI ให้เริ่มจากการร่างโครง HTML/Tailwind ก่อน อย่าเพิ่งรีบใส่ Logic ลึกๆ
2. ตรวจสอบความปลอดภัยและ Best Practice เสมอ เตือนฉันทันทีถ้าฉันเขียนโค้ดที่ขัดกับหลักการ Decoupled

---

## 6. กฎการจัดการเวอร์ชัน (Git Workflow & Version Control)
เพื่อการทำงานร่วมกับทีมอย่างราบรื่น ช่วยคุมกฎ Git ดังนี้:
1. **เช็ก Branch ก่อนเริ่มงาน**: ก่อนเริ่มเขียนโค้ดฟีเจอร์ใหม่ทุกครั้ง ให้เตือนฉันเสมอว่า *"ตอนนี้คุณอยู่บน Branch `main` หรือไม่? ถ้าใช่ กรุณาแตก Branch ใหม่ก่อนทำงาน"*
2. **กฎการตั้งชื่อ Branch**: บังคับให้ฉันตั้งชื่อ Branch ใหม่โดยขึ้นต้นด้วย `feature/` ตามด้วยสิ่งที่ทำเสมอ (เช่น `feature/login-ui`, `feature/frontend-ui`) เพื่อให้เพื่อนในทีมรู้ว่าฉันรับผิดชอบส่วนไหน
3. **Commit & Push เสมอ**: เมื่อเขียนโค้ดเสร็จในแต่ละส่วน หรือก่อนจบงานในแต่ละวัน ให้เตือนฉันทำ Version Control (`git add .` และ `git commit`) พร้อมสอนวิธีเขียนข้อความ Commit ที่สื่อความหมาย จากนั้นให้สั่ง `git push` ขึ้น GitHub ทันทีเพื่อป้องกันงานหาย

---

## 7. เทมเพลตการทำ Daily Report (สรุปงานรายวัน)
ทุกๆ วันก่อนเลิกงาน หากฉันพิมพ์คำว่า **"สรุปงานวันนี้ให้หน่อย"** ให้รวบรวมสิ่งที่ฉันทำและเรียนรู้ในแชท มาจัดรูปแบบตาม Template ด้านล่างนี้ โดยใช้ภาษาพูดแบบเป็นธรรมชาติเหมือนเด็กฝึกงานเขียนสรุปให้พี่เลี้ยงอ่าน:

```text
*********************
วันนี้ทำอะไร 1-2บรรทัด (สรุปตอนเย็นหลังเลิกงาน) 
[สรุปสั้นๆ]
********************
รายละเอียดงานที่ทำ *เรียงลำดับ*
1. [งานที่ทำ]
2. [งานที่ทำ]
*************************
ผลลัพธ์ที่ได้ (เสร็จอะไร/ทำอะไร) สิ่งที่ได้เรียนรู้วันนี้
- ผลลัพธ์ที่ได้: [สรุปงานที่เสร็จ]
- สิ่งที่ได้เรียนรู้วันนี้: [สรุปความรู้ใหม่]
************************************
ระบบ / เครื่องมือ / ขั้นตอนการทำงาน: 
- เครื่องมือ: VS Code, React, Tailwind CSS, shadcn/ui
- ขั้นตอนการทำงาน: [ขั้นตอน]

ศัพท์หรือแนวคิดใหม่ที่เพิ่งรู้:
- [คำศัพท์]: [ความหมาย]
******************************
สิ่งที่ยังไม่เข้าใจ / ข้อสงสัย
- [ข้อสงสัย ถ้าไม่มีบอกว่าไม่มี]
*************************
ปัญหา / Blocker (ถ้ามี)
- [ปัญหาที่ติดขัด ถ้าไม่มีบอกว่าอยู่ในช่วงศึกษา/ขึ้นโครง]
************************
ใช้ AI ช่วยอะไร (ถ้ามี)
- [Antigravity ช่วยอธิบายว่าตัวเองช่วยทำอะไรไปบ้าง]
************************
หลักฐาน / Reference (ถ้ามี)
- โค้ดในไฟล์ [ชื่อไฟล์ที่แก้]
**********************
พรุ่งนี้จะทำอะไรต่อ
1. [แผนงานวันถัดไป]
********************
```

---

## 8. ข้อบังคับและกฎเหล็กการทำงานของ AI ผู้ช่วย (AI Operating Protocol)
กฎต่อไปนี้เป็นข้อบังคับที่ AI เมนเทอร์ (Antigravity) ต้องปฏิบัติตามโดยอัตโนมัติทุกครั้ง:

1. **กฎข้อที่ 1: ตรวจสอบ Git Branch อัตโนมัติ (Automatic Branch Protection)**
   - ทุกครั้งก่อนเริ่มเขียนหรือแก้ไขไฟล์โค้ด AI ต้องแอบตรวจ `git status`
   - หากพบว่าเผลออยู่บน Branch `main` AI ต้องหยุดทันทีและเตือนให้แตก Branch `feature/...` ก่อนลงมือทำ
2. **กฎข้อที่ 2: ตรวจสอบและแจ้งเตือนโค้ดเพื่อนอัตโนมัติ (Teammate Sync Watcher)**
   - ก่อนเริ่มฟีเจอร์ใหม่ AI จะช่วยเช็ค `git fetch origin` ว่าทางฝั่งของคุณ Sobree มีการดันโค้ดใหม่เข้า `main` หรือไม่
   - หากพบว่ามีโค้ดใหม่ AI จะแนะนำให้ผู้ใช้ Pull ก่อนเริ่มงาน
3. **กฎข้อที่ 3: การสอนแบบ "PHP to React Step-by-Step" (No Giant Code Dumps)**
   - ห้ามเขียนโค้ดทีเดียวหลาย Component มัดรวมกัน ต้องสอนทีละไฟล์ ทีละ Step
   - ทุกครั้งที่สร้าง Component ต้องร่างโครง HTML/Tailwind ก่อน
   - ต้องอธิบายเปรียบเทียบแนวคิด React กับวิธีคิดแบบ PHP ทุกครั้ง
4. **กฎข้อที่ 4: กฎคุ้มกันโฟลเดอร์ Sobree ขั้นเด็ดขาด (Strict Zero-Touch `Sobree/`)**
   - ห้ามสร้าง, แก้ไข, ลบ หรือยุ่งเกี่ยวกับไฟล์ในโฟลเดอร์ `Sobree/` เด็ดขาด
   - ขอบเขตงานจำกัดอยู่ที่โฟลเดอร์ `Rain/` เท่านั้น
5. **กฎข้อที่ 5: ตรวจสอบความถูกต้องก่อนส่งงาน (Mandatory Compile Check)**
   - ก่อนจะแจ้งว่างานเสร็จสิ้นในแต่ละ Step หรือแต่ละ Phase AI ต้องรัน Typecheck และ Build (`npm --workspace=@mango/portal run build`) ให้ผ่าน 100% เสมอ
6. **กฎข้อที่ 6: จัดการ Version Control และบันทึก Work Log ให้อัตโนมัติ (Auto-Commit, Push & Log)**
   - เมื่อทำแต่ละสเต็ปเสร็จและทดสอบผ่าน AI จะจัดการ `git add`, `git commit` ด้วยข้อความ Conventional Commit และ `git push origin feature/...` ขึ้น GitHub ให้อัตโนมัติ
   - ทำการบันทึกประวัติการทำงาน (Work Log) เพิ่มเติมในไฟล์นี้ทุกครั้งที่มีความคืบหน้า

---

## 9. บันทึกประวัติการทำงาน (Work Log & History)

### 📅 วันที่: 2026-11-13
- **Branch**: `feature/frontend-ui`
- **Commit**: `49e3166` (`refactor(portal): break down App into modular components (Header, LoginForm, OtpModal, VpnDashboard)`)
- **สิ่งที่ทำ**:
  1. วิเคราะห์โครงสร้างโค้ดเดิมใน `Rain/portal/src/App.tsx` (พบว่ายาว 538 บรรทัด รวม Logic และ UI ทั้งหมดในไฟล์เดียว)
  2. วางแผน Roadmap การพัฒนาแบบ Step-by-Step แบ่งเป็น 4 Phase (Component Refactoring -> Zod Validation -> Admin Dashboard -> TanStack Query)
  3. ดำเนินการ Phase 1 แยก Component ย่อยในโฟลเดอร์ `Rain/portal/src/components/`:
     - `Header.tsx`: แถบเมนูด้านบน แสดงโลโก้ MANGO, ไฟสถานะ 3 ดวง (API, Agent, VPN) และปุ่ม Logout
     - `LoginForm.tsx`: ฟอร์มล็อกอิน รับ Username/Password พร้อมกล่อง Demo Credentials
     - `OtpModal.tsx`: โมดอลยืนยัน 2FA OTP 6 หลัก ดักจับเฉพาะตัวเลขด้วย Regex
     - `VpnDashboard.tsx`: แดชบอร์ดแสดงสถานะ VPN IP, สถิติข้อมูล RX/TX และปุ่มสลับสีเขียว/แดง (VPN CONNECT / DISCONNECT)
  4. ปรับแก้ `App.tsx` ให้เป็น Master Controller รวม Component ลูกทั้ง 4 ตัว โค้ดกระชับ อ่านง่าย
  5. ทดสอบการ Build ด้วย `npm --workspace=@mango/portal run build` ผ่าน 100%
  6. ทำ Version Control ด้วย Git: `git add`, `git commit` และ `git push origin feature/frontend-ui` ขึ้น GitHub เรียบร้อย
  7. กำหนดกฎเหล็กและข้อบังคับในการทำงานสำหรับ AI เมนเทอร์ (AI Operating Protocol) 6 ข้อ บันทึกลงในเอกสารเพื่อเป็นข้อตกลงร่วมกัน
  8. ดำเนินการ Phase 2: เพิ่มระบบ Form Validation ด้วย Zod
     - ติดตั้งแพ็กเกจ `zod` ใน `@mango/portal`
     - สร้าง Schema ใน `Rain/portal/src/schemas/auth.schema.ts` สำหรับตรวจสอบ Username, Password และ OTP 6 หลัก
     - อัปเดต `LoginForm.tsx` แสดงกรอบแดงและข้อความเตือนเมื่อผู้ใช้กรอกผิด พร้อมเคลียร์ Error อัตโนมัติเมื่อเริ่มพิมพ์แก้ไข
     - อัปเดต `OtpModal.tsx` ตรวจสอบความถูกต้องของ OTP ด้วย Zod ก่อนส่งคำขอไปยังเซิร์ฟเวอร์
     - ตรวจสอบการคอมไพล์ผ่าน TypeScript และ Vite build 100%
  9. ดำเนินการ Phase 3: สร้างหน้าจอ Admin Management UI (เชื่อมต่อ `Rain/admin`)
     - สร้าง Component `AdminPanel.tsx` พร้อมระบบ 4 แท็บ: Devices, VPN Sessions, Audit Logs, และ Releases
     - แสดงตารางข้อมูลแบบ Dark-mode รองรับการดึงข้อมูลผ่าน Bearer Token จาก Backend API
     - อัปเดต `App.tsx` เพิ่มระบบ View Switcher ให้ Role ADMIN สลับหน้าจอระหว่าง VPN Client และ Admin Console
     - ปรับความกว้างของการ์ดอัตโนมัติ (ขยายเป็น `max-w-2xl` ในมุมมอง Admin เพื่อให้อ่านตารางง่ายขึ้น)
     - คอมไพล์เช็คผ่านฉลุย 100%
  10. ดำเนินการ Phase 4: นำ TanStack Query มาจัดการ Data Fetching & Caching
     - ติดตั้งแพ็กเกจ `@tanstack/react-query` ใน `@mango/portal`
     - ตั้งค่า `QueryClientProvider` ใน `main.tsx` กำหนดค่า `staleTime: 30s` สำหรับ In-memory Caching
     - รีแฟกเตอร์ `AdminPanel.tsx` เปลี่ยนมาใช้ `useQuery` แยก 4 Queries (`devices`, `sessions`, `audit-logs`, `agent-versions`)
     - รองรับการโหลดแบบ Instant Cache (สลับแท็บกลับมาข้อมูลแสดงทันที 0 วินาที) และมี Background Fetching อัปเดตข้อมูลอัตโนมัติ
     - คอมไพล์เช็คผ่านฉลุย 100%
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `Rain/RULES_AND_WORKLOG.md` *(บันทึกความคืบหน้า)*
  - `Rain/portal/package.json` *(ติดตั้ง @tanstack/react-query)*
  - `Rain/portal/src/main.tsx` *(ตั้งค่า QueryClientProvider)*
  - `Rain/portal/src/components/AdminPanel.tsx` *(รีแฟกเตอร์ด้วย useQuery)*
  - `Rain/portal/src/App.tsx`
  - `Rain/portal/src/schemas/auth.schema.ts`
  - `Rain/portal/src/components/LoginForm.tsx`
  - `Rain/portal/src/components/OtpModal.tsx`
  - `Rain/portal/src/components/Header.tsx`
  - `Rain/portal/src/components/VpnDashboard.tsx`

---

### 📅 วันที่: 2026-11-16 (เช้า - บ่าย)
- **Branch**: `feature/ui`
- **สิ่งที่ทำ**:
  1. **ช่วงเช้า**:
     - สร้าง Mock Auth & Offline Fallback ให้ `App.tsx` และ `AdminPanel.tsx` รองรับการทดสอบหน้าเว็บได้ครบทุก Role แม้ไม่มี Docker / PostgreSQL
     - แก้ไขปัญหา Trim Whitespace ใน Zod Validation Schema และฟอร์ม ทำให้รองรับการ Copy-paste รหัสผ่านและ Username โดยไม่ติด Error
     - ทดสอบระบบ Role-Based Dashboard ผ่านฉลุยทั้ง 3 บทบาท (`admin_user`, `staff_user`, `client_user`)
  2. **ช่วงบ่าย (UI/UX Polish & Modern Enterprise Transformation)**:
     - สร้าง Component `Toast.tsx` ระบบแจ้งเตือนลอยมุมขวาบน รองรับ 3 สถานะ (`success`, `error`, `info`) มีระบบ Auto-dismiss อัตโนมัติหลัง 3.5 วินาที พร้อมปุ่มปิดกากบาท
     - ปรับปรุง `VpnDashboard.tsx` เพิ่มปุ่ม Quick Copy สำหรับคัดลอก Assigned VPN IP และ Endpoint พร้อมไอคอน Checkmark แสดงผล 2 วินาที และยิงแจ้งเตือนผ่าน Toast
     - เพิ่มไอคอนสถานะการรับ-ส่งข้อมูล (RX/TX Download/Upload) ใน Telemetry Box
     - ประกอบ `Toast` และฟังก์ชัน `showToast` เข้ากับ `App.tsx` เชื่อมต่อแจ้งเตือนเมื่อ Login, Logout และคัดลอก IP/Endpoint
     - ปรับโฉมหน้า Dashboard ฝั่ง Staff/Client ให้เป็นสไตล์ **Enterprise Modern Dark Layout**:
       - สร้าง Component `Sidebar.tsx` แถบเมนูด้านซ้าย รองรับ 4 แท็บ (`เชื่อมต่อ`, `ประวัติ`, `อุปกรณ์`, `Agent`) พร้อมโปรไฟล์และปุ่ม Logout
       - ยกเครื่อง `VpnDashboard.tsx` ใหม่ตามแบบดีไซน์:
         - แถบ Breadcrumb `// CONNECT` พร้อมป้าย `● เชื่อมต่อแล้ว` และ `โหมดมืด`
         - แผนภาพ **Secure Tunnel Diagram**: `เครื่องของคุณ` ─── [🔒] ─── `Private Network` เรืองแสงสีเขียว
         - ปุ่มสลับการเชื่อมต่อ `ตัดการเชื่อมต่อ` / `เชื่อมต่อ VPN` พร้อม WireGuard Endpoint
         - การ์ดสถิติ 4 ช่อง (4 Metrics Grid): VPN IP (พร้อมปุ่ม Copy), RX, TX, และตัวนับเวลาเชื่อมต่อจริง (HH:MM:SS)
         - แผงคอนโซล 2 คอลัมน์ด้านล่าง: `CONNECTION LOG` สไตล์ Terminal สีเขียว และกล่องเครือข่ายที่เข้าถึงได้ (`10.0.0.0/8, 172.16.0.0/12`) + Curve25519 Public Key
       - ปรับปรุง `App.tsx` เชื่อมโยงระบบแสดงผลเต็มจอเมื่อล็อกอิน และคงหน้า Login กึ่งกลางจอก่อนล็อกอิน
       - แยกหน้าแดชบอร์ดตามเมนู Sidebar ให้เป็นอิสระต่อกัน:
         - ปรับปรุง `AdminPanel.tsx` ให้รองรับ `initialTab` และ `allowedTabs` ป้องกันปัญหาหน้า History แสดงตาราง Devices
         - เมื่อคลิกเมนู `ประวัติ`: แสดงเฉพาะข้อมูล **Sessions & Audit Logs** เท่านั้น
         - เมื่อคลิกเมนู `อุปกรณ์`: แสดงเฉพาะตาราง **Registered Devices** พร้อมซ่อนแท็บส่วนเกิน
         - เมื่อคลิกเมนู `Agent`: แสดงเฉพาะตาราง **Releases / Versions** พร้อมซ่อนแท็บส่วนเกิน
       - แก้ไขปัญหา Toast Notification ค้างไม่ยอมปิดตัวเองอัตโนมัติ:
         - เกิดจาก `useEffect` ใน `Toast.tsx` มี dependency ผูกกับ `onClose` ที่ถูกสร้างใหม่ทุกครั้งที่มีการ Re-render (จากลูปเช็คสถานะ Polling ทุก 1-3 วินาที) ทำให้ `clearTimeout` ถูกเรียกยกเลิกเวลาซ้ำๆ
         - แก้ไขด้วยการใช้ `useRef` เก็บฟังก์ชัน callback และใช้ `useCallback` ใน `App.tsx` ทำให้ Toast นับเวลาถอยหลัง 3.5 วินาทีและปิดตัวเองได้ 100%
        - ปรับแต่งหน้าแดชบอร์ดฝั่ง Client (`client_user`) ให้ตรงตามหลัก Zero-Trust และรูปภาพดีไซน์อ้างอิง:
          - ใน `Sidebar.tsx`: ซ่อนเมนู **"อุปกรณ์"** สำหรับผู้ใช้บทบาท `CLIENT` เพื่อจำกัดสิทธิ์ (เหลือ 3 เมนู: เชื่อมต่อ, ประวัติ, Agent)
          - ใน `VpnDashboard.tsx`: แสดง **เครือข่ายที่เข้าถึงได้** แบบ Least-Privilege เฉพาะพอร์ต 80, 443 (`10.13.13.100/32 : 80, 443`) สำหรับ CLIENT
          - ใน `App.tsx`: หน้าประวัติของ CLIENT แสดงเฉพาะตาราง Sessions ของตัวเอง ซ่อน Audit Logs ตามสิทธิ์
        - ยกระดับหน้าแดชบอร์ดฝั่ง Admin (`admin_user`) ครบเครื่องตามภาพดีไซน์อ้างอิง:
          - ใน `Sidebar.tsx`: เพิ่มเมนูสำหรับ Admin ครบทั้ง 7 เมนู (เชื่อมต่อ, ประวัติ, อุปกรณ์, ผู้ใช้, นโยบาย, Audit Logs, Agent)
          - ใน `VpnDashboard.tsx`: แสดง **เครือข่ายที่เข้าถึงได้** เป็น `0.0.0.0/0 (ทุกเครือข่าย)` แบบ Full Corporate Access
          - ใน `App.tsx`: เพิ่มหน้าจอระบบ **User Management** (จัดการบัญชีและ 2FA) และหน้า **Zero-Trust Access Policies** (กฎความปลอดภัยการเข้าถึง Subnet) รองรับการคลิกดูข้อมูลจาก Sidebar ได้จริง
        - ยกระดับหน้าจอ Login & OTP Verification:
          - ใน `LoginForm.tsx`: เพิ่มปุ่ม 1-Click Role Switcher (`👑 Admin`, `👔 Staff`, `👤 Client`) กรอกข้อมูลพร้อมรหัสผ่านให้อัตโนมัติในคลิกเดียว
          - เพิ่มปุ่มเปิด/ปิดตาดูรหัสผ่าน (`Eye` / `EyeOff`) สลับระหว่าง text และ password
          - ใน `OtpModal.tsx`: เพิ่มปุ่ม Auto-fill Demo OTP (`123456`) อำนวยความสะดวกในการทดสอบอย่างรวดเร็ว
        - ปรับดีไซน์หน้า Login & OTP ให้เป็นแบบ **Mobile Application Style** ตามรูปภาพอ้างอิง:
          - ใน `LoginForm.tsx`: วางโครงสร้างแบบ Mobile App พร้อมโลโก้ MANGO VPN สีเขียว, แถบสถานะ TLS 1.3, หัวข้อ 'เข้าสู่ระบบ VPN', แถบ Progress Bar 3 ท่อน (ขั้นตอนที่ 1 จาก 3), ช่อง Username/Password พร้อมปุ่มกด 'แสดง'/'ซ่อน', และลิงก์ดาวน์โหลด Agent / ติดต่อ Admin
          - ใน `OtpModal.tsx`: ออกแบบหน้า OTP ให้เข้าชุดกันเป็นขั้นตอนที่ 2 จาก 3 (แถบ Progress 2 ท่อนสีเขียว)
          - ใน `App.tsx`: ปรับกรอบแสดงผลหน้า Login ให้อยู่ในสัดส่วน Mobile App Card (`max-w-[400px]`) รองรับ Responsive แสดงผลสวยงามทั้งบนมือถือและจอคอมพิวเตอร์
        - พัฒนาหน้าจอ OTP Verification สไตล์ Mobile 6 ช่องแยกตามภาพดีไซน์อ้างอิง:
          - ใน `OtpModal.tsx`: สร้างช่องกรอกตัวเลข 6 ช่องแยกอิสระ (Individual 6-Digit Boxes) มีระบบกระโดดไปช่องถัดไปอัตโนมัติเมื่อพิมพ์ และถอยกลับเมื่อกด Backspace พร้อมรองรับการ Paste ข้อความ 6 ตัวรวดเดียว
          - เพิ่มตัวนับเวลา 'รหัสหมดอายุใน 4:32 นาที' นับถอยหลังแบบเรียลไทม์
          - ปุ่มยืนยันสถานะปิดการใช้งาน (Disabled) 'ยืนยัน' จนกว่าจะกรอกครบ 6 หลัก และสลับเป็นสีเขียวทันที
          - ลิงก์ 'รหัสหมดอายุ? เข้าสู่ระบบใหม่' ด้านล่างสุด
      - ทดสอบการคอมไพล์ด้วย TypeScript และ Vite Build ผ่าน 100% ไม่มีข้อผิดพลาด
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `Rain/portal/src/components/Sidebar.tsx` *(รองรับเมนูตามบทบาท RBAC ครบทั้ง 3 บทบาท)*
  - `Rain/portal/src/components/Toast.tsx` *(แก้บั๊ก Auto-dismiss ด้วย useRef)*
  - `Rain/portal/src/components/VpnDashboard.tsx` *(แสดงเครือข่าย 0.0.0.0/0 (ทุกเครือข่าย) สำหรับ ADMIN)*
  - `Rain/portal/src/components/AdminPanel.tsx` *(รองรับ initialTab และ allowedTabs แยกหน้าเป็นอิสระ)*
  - `Rain/portal/src/App.tsx` *(เชื่อมต่อ User Management, Policies และแยกหน้าจอตามแท็บ Sidebar ครบวงจร)*
  - `Rain/portal/src/components/LoginForm.tsx` *(เพิ่มปุ่ม 1-Click Role Fill และปุ่มเปิด/ปิดตาดูรหัสผ่าน)*
  - `Rain/portal/src/components/OtpModal.tsx` *(เพิ่มปุ่ม Auto-fill Demo OTP)*
  - `Rain/RULES_AND_WORKLOG.md` *(อัปเดตบันทึกประจำวัน)*

### 📅 วันที่: 2026-11-17
- **Branch**: `feature/rain-admin`
- **Commits**:
  - `f17db4e` (`feat(admin): implement users and policies endpoints in backend service, controller, and routes`)
  - `a2acdbe` (`feat(portal): integrate users and policies tables with TanStack Query in AdminPanel and App`)
  - `67cf960` (`feat(portal): add visual spin animation and toast notification on data refresh`)
  - `44fb770` (`feat(admin): implement device revocation endpoint and UI action button`)
  - `beb8656` (`feat(admin): implement create user endpoint and modal form in admin panel`)
  - `afa467a` (`feat(admin): implement policy creation and deletion endpoints with ui modal in admin panel`)
  - `beba27f` (`feat(portal): add quick stats summary cards and real-time search filter in admin panel`)
  - `a111f52` (`feat(portal): enforce zero-trust role-based visibility on quick stats cards`)
  - `017fd26` (`feat(portal): refine stats cards visibility according to hci principles`)
- **สิ่งที่ทำ**:
  1. [ช่วงเช้า] ศึกษาหลักการทำงานของ Prisma ORM, สถาปัตยกรรม 3 เลเยอร์ (Routes -> Controller -> Service) และพื้นฐานการทำ REST API
  2. [ช่วงบ่าย] ดำเนินการพัฒนาตาม Implementation Plan:
     - แตก Branch ใหม่ตามกฎข้อที่ 6: `feature/rain-admin`
     - ขยายระบบหลังบ้านใน `Rain/admin`:
       - เพิ่มเมธอด `getUsers()` และ `getPolicies()` ใน `admin.service.ts` โดยใช้ Prisma ORM (พร้อมกรองความปลอดภัยไม่ส่งรหัสผ่าน)
       - เพิ่มด่านตรวจสิทธิ์ RBAC (บังคับเฉพาะ ADMIN เท่านั้น) ใน `admin.controller.ts`
       - จดทะเบียนเส้นทางใหม่ `GET /api/users` และ `GET /api/policies` ใน `admin.routes.ts`
       - เพิ่มระบบเพิกถอนอุปกรณ์: `DELETE /api/devices/:id` (`revokeDevice` ใน service & controller)
       - เพิ่มระบบสร้างผู้ใช้ใหม่: `POST /api/users` (`createUser` พร้อมแฮชรหัสผ่านด้วย bcrypt)
       - เพิ่มระบบสร้างและลบนโยบายเครือข่าย: `POST /api/policies` (`createPolicy`) และ `DELETE /api/policies/:id` (`deletePolicy`)
     - ยกระดับและเชื่อมต่อหน้าเว็บพอร์ทัลใน `Rain/portal`:
       - ขยาย `AdminPanel.tsx` เพิ่มแท็บ `users` และ `policies` จัดการด้วย TanStack Query (`useQuery`)
       - เพิ่ม Visual Feedback: ป๊อปอัปแจ้งเตือน Toast เมื่อกดปุ่ม 'รีเฟรชข้อมูล' พร้อมอนิเมชันหมุนแสดงสถานะ
       - เพิ่มปุ่มสีแดง 'เพิกถอน' ในตารางอุปกรณ์ (Registered Devices) เพื่อตัดการเชื่อมต่ออุปกรณ์ที่ไม่ปลอดภัย
       - เพิ่มปุ่ม '+ เพิ่มผู้ใช้ใหม่' และหน้าต่าง Modal ฟอร์มกรอกข้อมูลผู้ใช้ (Username, Phone, Role) บันทึกเข้าตารางทันที
       - เพิ่มปุ่ม '+ เพิ่มนโยบาย' และหน้าต่าง Modal ฟอร์มกรอกกฎความปลอดภัย Zero-Trust (Role Target, Destination CIDR, Protocol, Port Range, Action ALLOW/DENY)
       - เพิ่มปุ่มไอคอนถังขยะสำหรับลบนโยบายเครือข่าย พร้อมไดอะล็อกยืนยันและการแจ้งเตือน Toast
       - เพิ่มแดชบอร์ดสรุปภาพรวม Quick Stats 4 มิติ (ผู้ใช้ทั้งหมด, อุปกรณ์ที่ลงทะเบียน, กฎ Zero-Trust, เซสชันออนไลน์พร้อมไฟสถานะสีเขียวกระพริบ)
       - เพิ่มช่องค้นหาอัจฉริยะ Real-time Search Filter Bar กรองข้อมูลตารางแบบตอบสนองทันใจในทุกแท็บ
       - ปรับปรุง `App.tsx` เชื่อมต่อ Component AdminPanel เข้าด้วยกัน ลดโค้ดซ้ำซ้อน 74 บรรทัด
  3. [ช่วงเย็น] ศึกษาเชิงลึกภาพรวมสถาปัตยกรรมระบบทั้ง 4 ภาพจากพี่เลี้ยง:
     - การทำงานของ Zero-Trust Network Access (ZTNA) แบบ Least-Privilege
     - ความสำคัญของ Client Agent (พอร์ต 127.0.0.1:47821) ในฐานะตัวแทนเบราว์เซอร์ในการสั่งงาน WireGuard Kernel
     - ความสัมพันธ์ระหว่าง Public Key ในตาราง `vpn_peers` และกฎความปลอดภัยในตาราง `vpn_policies`
  4. ทดสอบคอมไพล์ผ่าน 100%:
     - `npm --workspace=@mango/rain-admin run build` (ผ่านฉลุย)
     - `npm --workspace=@mango/portal run build` (ผ่านฉลุย)
     - `npm --workspace=@mango/api run build` (ผ่านฉลุย)
  5. ทำ Version Control ตามกฎข้อที่ 6: แยก Commit อย่างชัดเจนตามฟีเจอร์ และสั่ง `git push` ขึ้น GitHub เรียบร้อยทุกสเต็ป
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `Rain/admin/src/admin.service.ts` *(เพิ่ม UserDto, CreateUserDto, CreatePolicyDto, getUsers, getPolicies, revokeDevice, createUser, createPolicy, deletePolicy)*
  - `Rain/admin/src/admin.controller.ts` *(เพิ่ม getUsers, getPolicies, deleteDevice, createUser, createPolicy, deletePolicy พร้อมดักสิทธิ์ ADMIN)*
  - `Rain/admin/src/admin.routes.ts` *(ลงทะเบียน GET/POST /api/users, GET/POST /api/policies, DELETE /api/policies/:id, DELETE /api/devices/:id)*
  - `Rain/portal/src/components/AdminPanel.tsx` *(เพิ่มแท็บและ useQuery สำหรับ users & policies, ปุ่ม Revoke Device, Modal Add User, Modal Add Policy, ปุ่ม Delete Policy, Toast Refresh)*
  - `Rain/portal/src/App.tsx` *(เชื่อมโยง Component AdminPanel และส่งฟังก์ชัน showToast)*
  - `Rain/RULES_AND_WORKLOG.md` *(อัปเดตบันทึกประจำวัน)*

---

### 📅 วันที่: 2026-11-18
- **Branch**: `feature/rain-db-seeder`
- **Commits**:
  - `8683070` (`feat(admin): complete database seeder for all 8 prisma tables`)
  - `b6dcd8d` (`docs(rain): update worklog with 8-table database seeder commit`)
  - `6f541d0` (`feat(admin): implement session disconnect endpoint and audit logging`)
  - `2a77948` (`docs(rain): update worklog with session disconnect api commit`)
  - `956ed1a` (`feat(portal): add session disconnect action and polish traffic telemetry ui in admin panel`)
  - `ec59430` (`docs(rain): update worklog with portal session disconnect and telemetry commit`)
  - `d596d39` (`feat(portal): add sessionStorage persistence for session kicks and display quick stats on sessions tab`)
  - `0d4b645` (`docs(rain): update worklog with persistence and quick stats commit`)
  - `2ab8383` (`feat(portal): implement user status toggle and deletion in admin panel`)
- **สิ่งที่ทำ**:
  1. [ช่วงเช้า] จัดทำและอนุมัติแผนปฏิบัติงานประจำวัน (18 พ.ย. 2569) และสรุปหัวข้อโครงงานสหกิจศึกษา 3.2 ลงในเล่มรายงาน
  2. [ช่วงเช้า] ตรวจสอบสถาปัตยกรรมโมเดลฐานข้อมูล 8 ตารางหลักใน Prisma ORM (`roles`, `users`, `devices`, `vpn_peers`, `vpn_sessions`, `vpn_policies`, `audit_logs`, `agent_versions`)
  3. [ช่วงเช้า] พัฒนาขยายสคริปต์จำลองข้อมูลตั้งต้น Database Seeder (`Rain/admin/src/seed.ts`):
     - ปรับโครงสร้าง Seeder ให้รองรับความสัมพันธ์ของทั้ง 8 ตารางอย่างสมบูรณ์แบบ
     - สร้าง Roles 3 ระดับ (ADMIN, STAFF, CLIENT)
     - สร้าง Zero-Trust Firewall Policies ตามสิทธิ์ของแต่ละบทบาท
     - สร้าง Users พร้อมแฮชรหัสผ่านความปลอดภัยสูงด้วย `bcryptjs`
     - สร้าง Devices จำลองอุปกรณ์คอมพิวเตอร์และมือถือของผู้ใช้แต่ละราย
     - สร้าง WireGuard VPN Peers พร้อม Curve25519 Public Keys และ Assigned IPs (`10.13.13.x/32`)
     - สร้าง VPN Sessions จำลองทราฟฟิกข้อมูล Rx/Tx และสถานะ Active Online / Closed
     - สร้าง Audit Logs จำลองประวัติกิจกรรมด้านความปลอดภัย เช่น การล็อกอิน การยืนยัน 2FA และการตั้งค่าระบบ
     - บันทึกเวอร์ชัน Agent ล่าสุด (1.0.0 และ 1.1.0-beta)
  4. [ช่วงเช้า] พัฒนาระบบหลังบ้าน Session Disconnect API ในโมดูล `Rain/admin`:
     - เพิ่มเมธอด `disconnectSession(sessionId, adminUserId)` ใน `admin.service.ts` พร้อมเขียนประวัติความปลอดภัย AuditLog อัตโนมัติ (`VPN_SESSION_DISCONNECTED`)
     - เพิ่มตัวควบคุม `disconnectSession` ใน `admin.controller.ts` ดักตรวจสิทธิ์เฉพาะบทบาท `ADMIN` (Zero-Trust RBAC)
     - จดทะเบียนเส้นทาง API ใหม่ `POST /api/sessions/:id/disconnect` ใน `admin.routes.ts`
  5. [ช่วงบ่าย] ศึกษาทำความเข้าใจหลักการทำงานเชิงลึกของ WireGuard VPN (Asymmetric Cryptography Curve25519, Public/Private Key, Peer, AllowedIPs, UDP Roaming)
  6. [ช่วงบ่าย] พัฒนาและยกระดับ UI การจัดการเซสชันในเว็บพอร์ทัล (`Rain/portal/src/components/AdminPanel.tsx`):
     - เพิ่มฟังก์ชัน `formatBytes(bytes)` สำหรับแปลงขนาดเน็ตเวิร์กทราฟฟิกเป็น B, KB, MB, GB โดยอัตโนมัติ
     - ปรับแต่งการแสดงผลคอลัมน์ Traffic (RX/TX) ด้วย Badge สี Emerald (Download) และ Sky (Upload) พร้อมไอคอนลูกศรทิศทางกำกับ
     - เพิ่มคอลัมน์ Action ในตาราง Sessions และสร้างปุ่มสีแดง 'ตัดการเชื่อมต่อ' พร้อมไอคอน `PowerOff` สำหรับเซสชันที่สถานะ Online
     - เชื่อมต่อฟังก์ชัน `handleDisconnectSession` ยิงเรียก API `POST /api/sessions/:id/disconnect` พร้อมกล่องไดอะล็อกยืนยันและการแจ้งเตือน Toast
     - อัปเดตสถิติ Quick Stats Card แบบ Real-time: ปรับลดจำนวนเซสชันออนไลน์ทันทีเมื่อมีการตัดการเชื่อมต่อ
  7. [ช่วงบ่าย] ยกระดับความต่อเนื่องของสถานะ (Persistence) และเปิดแสดงสถิติในแท็บ Sessions:
     - นำ `sessionStorage` เข้ามาผูกกับ `disconnectedSessionIds` เพื่อให้เบราว์เซอร์จดจำสถานะที่ถูกตัดการเชื่อมต่อได้อย่างถาวร แม้ผู้ใช้จะกด Refresh (F5) หน้าระบบ
     - เปิดแสดงการ์ดสรุปสถิติ 4 มิติ (Quick Stats 4 Cards) ในแท็บ Sessions เพื่อให้เห็นตัวเลขเซสชันออนไลน์ลดลงจริง
     - ปรับปรุง `App.tsx` ในส่วน `handleDisconnectVpn` ให้มี Fallback ตัดการเชื่อมต่อได้เสมอในโหมดทดสอบ
  8. ทดสอบคอมไพล์ระบบ TypeScript & Vite:
     - `npm --workspace=@mango/rain-admin run build` (ผ่านฉลุย 100%)
     - `npm --workspace=@mango/api run build` (ผ่านฉลุย 100%)
     - `npm --workspace=@mango/portal run build` (ผ่านฉลุย 100%)
  9. ดำเนินการ Git Commit & Push ขึ้น Branch `feature/rain-db-seeder` เรียบร้อย
  10. [ช่วงบ่าย] พัฒนาระบบจัดการผู้ใช้งานครบวงจร (User Management Full CRUD):
      - ฝั่งหลังบ้าน (`Rain/admin`):
        - เพิ่มฟังก์ชัน `toggleUserStatus(userId, adminUserId)` ใน `admin.service.ts` สำหรับสลับสถานะเปิดใช้งาน/ระงับสิทธิ์ พร้อมบันทึก `USER_STATUS_UPDATED` ลงใน AuditLog อัตโนมัติ
        - เพิ่มฟังก์ชัน `deleteUser(userId, adminUserId)` ใน `admin.service.ts` สำหรับลบข้อมูลผู้ใช้ออกจากฐานข้อมูล พร้อมบันทึก `USER_DELETED` ลงใน AuditLog
        - เพิ่มตัวจัดการ `toggleUserStatus` และ `deleteUser` ใน `admin.controller.ts` ดักตรวจสิทธิ์เฉพาะบทบาท `ADMIN`
        - จดทะเบียนเส้นทาง API `PATCH /api/users/:id/status` และ `DELETE /api/users/:id` ใน `admin.routes.ts`
      - ฝั่งหน้าเว็บ (`Rain/portal/src/components/AdminPanel.tsx`):
        - เพิ่มคอลัมน์ "Action" ในแท็บจัดการผู้ใช้งาน (Users)
        - พัฒนาปุ่มสลับสถานะผู้ใช้ (Toggle Active/Suspended) แสดงปุ่ม "ระงับสิทธิ์" (ไอคอน `UserX`) หรือ "เปิดใช้งาน" (ไอคอน `UserCheck`) ตามสถานะปัจจุบัน
        - พัฒนาปุ่มลบผู้ใช้ (ไอคอน `Trash2` สีแดง) พร้อมกล่องไดอะล็อกยืนยันการลบ
        - ออกแบบ State Persistence ด้วย `sessionStorage` (`mango_toggled_users` และ `mango_deleted_users`) เพื่อให้ข้อมูลที่ถูกสลับสถานะหรือลบออกยังคงแสดงผลถูกต้องแม้กด F5 หรือรีเฟรชหน้าเว็บ
        - อัปเดตตัวเลขสถิติภาพรวม "ผู้ใช้ทั้งหมด" ใน Quick Stats Card ให้คำนวณตัดจำนวนผู้ใช้ที่ถูกลบออกทันทีแบบไดนามิก
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `Rain/admin/src/seed.ts` *(ขยาย Seeder ครบ 8 ตาราง พร้อมความสัมพันธ์และตัวอย่างข้อมูล)*
  - `Rain/admin/src/admin.service.ts` *(เพิ่ม disconnectSession, toggleUserStatus, deleteUser และ AuditLog)*
  - `Rain/admin/src/admin.controller.ts` *(เพิ่ม endpoint handlers สำหรับตัดเซสชัน สลับสถานะผู้ใช้ และลบผู้ใช้)*
  - `Rain/admin/src/admin.routes.ts` *(ลงทะเบียน POST /api/sessions/:id/disconnect, PATCH /api/users/:id/status, DELETE /api/users/:id)*
  - `Rain/portal/src/App.tsx` *(เพิ่ม Fallback การตัดการเชื่อมต่อ VPN ในหน้า Dashboard)*
  - `Rain/portal/src/components/AdminPanel.tsx` *(เพิ่ม UI จัดการ Session Disconnect, Quick Stats, User Status Toggle และ Delete User)*
  - `Rain/RULES_AND_WORKLOG.md` *(อัปเดตบันทึกประจำวัน)*

