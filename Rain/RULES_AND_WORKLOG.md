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
