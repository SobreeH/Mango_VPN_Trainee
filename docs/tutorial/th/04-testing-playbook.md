> 🌐 **Language / ภาษา**: [🇬🇧 English](../04-testing-playbook.md) | **🇹🇭 ภาษาไทย**

> 🏠 [สารบัญคู่มือ](../../../TUTORIAL.th.md) › [00 ภาพรวมและการเตรียมระบบ](00-overview-and-setup.md) › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · **04 การทดสอบ** › [05 การแก้ไขปัญหา](05-troubleshooting-and-reference.md) · [06 ภาคผนวก](06-appendix-local-docker-smoke-test.md)

---

# 04 · คู่มือการทดสอบแบบทีละขั้นตอน

บทนี้เป็นส่วนที่ต้องลงมือทำจริง ได้แก่ภารกิจที่ 1 ถึง 4 บนพอร์ทัล จากนั้นเป็นการตรวจสอบ Gateway และการตรวจสอบอัตโนมัติ ให้ทำ[บทที่ 01](01-track-a-local-dev.md) ให้เสร็จก่อนสำหรับ Track A หรือบทตั้งค่าที่ตรงกันสำหรับ Track B และ C

พอร์ทัลเริ่มต้นที่ภาษา **ไทย (`TH`)** ใช้ปุ่มสลับภาษา (`EN` / `TH`) เพื่อเปลี่ยนเป็นภาษาอังกฤษ และปุ่มสลับธีมสำหรับโหมดสว่างหรือมืด คู่มือนี้ใช้ป้ายชื่อภาษาอังกฤษตามที่ปรากฏในหน้าจอ

บน **แดชบอร์ด Admin** แถบเมนูด้านซ้ายจัดกลุ่มเมนูเป็นสามส่วนที่ยุบ/ขยายได้:

- **VPN & Live Monitoring:** **VPN Connect**, **Sessions**
- **Management:** **Users**, **Devices**, **Policies**, **Gateways**
- **Audit & System:** **Audit Logs**, **Agent Versions**

เหนือแท็บที่เปิดอยู่จะมีการ์ด KPI สี่ใบ (**Total Users**, **Devices**, **Active Sessions**, **Security Posture**) สรุปสถานะระบบ การ์ดเหล่านี้จะถูกซ่อนในแท็บ **VPN Connect** เพื่อให้หน้าจอโปร่งขึ้น

---

## 🎯 ภารกิจที่ 1: ล็อกอินครั้งแรกและตั้งค่า TOTP Authenticator

1. เปิด `http://localhost:3000` กรอกชื่อผู้ใช้ `admin` และรหัสผ่านที่ตั้งไว้ตอน seed จากนั้นคลิก **Sign In**

   **สิ่งที่ควรเห็น:** หน้าจอ **Set Up Authenticator** เมื่อล็อกอินครั้งแรก หากบัญชีนี้ลงทะเบียน TOTP ไว้แล้ว จะแสดง **Two-Factor Verification** แทน

2. เมื่อลงทะเบียนครั้งแรก ให้สแกน QR code ด้วย Google Authenticator, Microsoft Authenticator, Authy หรือแอป TOTP อื่นที่รองรับ หรือจะกรอกคีย์ Base32 ที่แสดงด้วยตนเองก็ได้ เก็บคีย์นี้เป็นความลับ เพราะใช้สร้างรหัสสำหรับล็อกอินได้

   **สิ่งที่ควรเห็น:** แอปสร้างรหัสหกหลักที่เปลี่ยนไปเรื่อยๆ สำหรับ MANGO VPN

3. กรอกรหัสปัจจุบันในช่อง **6-Digit Code** จากนั้นคลิก **Verify** หากรหัสเปลี่ยนระหว่างที่คุณกำลังพิมพ์ ให้รอรหัสถัดไปแล้วกรอกอย่างรวดเร็ว

   **สิ่งที่ควรเห็น:** แดชบอร์ด Admin แถบด้านล่างของ Sidebar แสดง `admin` และบทบาท `ADMIN` การ์ด KPI ปรากฏด้านบน และ **Audit Logs** ถูกเลือกไว้เป็นค่าเริ่มต้น

---

## 🎯 ภารกิจที่ 2: จับคู่ Agent บนเครื่องและเชื่อมต่อ VPN

1. คลิก **VPN Connect** ในแถบเมนูด้านซ้าย ภายใต้ **VPN & Live Monitoring** ในการ์ด Agent ให้ตรวจว่า Agent เข้าถึงได้ สำหรับ mock ควรแสดง **Agent Reachable (Unpaired)** และเวอร์ชัน `v2.0.0` วาง `PairingToken` ที่คัดลอกมา (หรือโทเคนที่คุณเลือกไว้สำหรับ Go agent) ลงในช่อง **Agent Pairing Token** (placeholder คือ **Paste X-Mango-Agent-Token**) แล้วคลิก **Pair Agent**

   **สิ่งที่ควรเห็น:** **Agent Paired & Ready**, `Tunnel State: disconnected`, ตัวเลือก **VPN Provider** (ค่าเริ่มต้น `WireGuard (Default)` พร้อมปุ่มรีเฟรชเพื่อโหลด Gateway ที่ลงทะเบียนไว้) และปุ่ม **Connect VPN** หากการจับคู่ล้มเหลว ให้ตรวจว่าโทเคนตรงกับ Agent ที่กำลังทำงานทุกตัวอักษร

2. คลิก **Connect VPN** พอร์ทัลจะขอตั๋วใช้ครั้งเดียวที่ใช้ได้ 60 วินาที Agent จะสร้างคู่กุญแจ Curve25519 ใหม่ในหน่วยความจำ แล้วส่งตั๋วและ public key ไปยัง API API จะจัดสรร IP ว่างตัวแรก (โดยปกติคือ `10.13.13.2`) และขอให้ Gateway เพิ่ม Peer พร้อมนโยบายตามบทบาท เมื่อใช้ Go agent Agent จะเปิด WireGuard ต่อ ส่วน mock จำลองเพียงสถานะของ Agent

   **สิ่งที่ควรเห็น (เดโม mock):** การ์ดเปลี่ยนเป็นสีเขียวแสดงว่า **connected** พร้อมมุมมอง **Network Topology** แบบสามขั้น, **Assigned VPN IP** (`10.13.13.2`), **Active Role** (`ADMIN`), **Protocol Status** (`WireGuard`), ตัวนับ **Data Usage** แบบเรียลไทม์, **Permitted Networks** (คลิก **Technical Details** เพื่อดู `Curve25519 Key` และ `Protocol`) และปุ่ม **Disconnect**

   สำหรับอุโมงค์จริง (Track B และ C) คุณควรเห็นอินเทอร์เฟซ `mango0` บนเครื่อง Host ได้แก่ บริการอุโมงค์ WireGuard บน Windows หรือคำสั่ง `wg show mango0` บน Linux สถานะและตัวนับที่แสดงโดย mock **ไม่ใช่หลักฐานว่ามีทราฟฟิก WireGuard จริง**

---

## 🎯 ภารกิจที่ 3: ทดสอบทุกแท็บของ Admin Governance

Audit Logs ถูกเลือกไว้เป็นค่าเริ่มต้น ให้ทำงานตามลำดับแท็บด้านล่าง เพื่อสร้างข้อมูลก่อนแล้วค่อยตรวจประวัติการตรวจสอบในตอนท้าย

### 1. Users

1. คลิก **Users** ภายใต้ **Create User** กรอกชื่อผู้ใช้ `staff01`, อีเมล `staff01@mangovpn.local`, รหัสผ่าน `StaffTestPass#2026` และบทบาท `STAFF` จากนั้นคลิก **Create User**
2. สร้างผู้ใช้อีกคน: ชื่อผู้ใช้ `client01`, อีเมล `client01@mangovpn.local`, รหัสผ่าน `ClientTestPass#2026`, บทบาท `CLIENT` แล้วคลิก **Create User**
3. ค้นหา `client01` ในรายการ คลิก **Disable** รอจนสถานะเปลี่ยนเป็น `Disabled` จากนั้นคลิก **Enable**

**สิ่งที่ควรเห็น:** ผู้ใช้ทั้งสองปรากฏพร้อมบทบาทที่เลือก `client01` เปลี่ยนจาก `Active` เป็น `Disabled` แล้วกลับเป็น `Active` รหัสผ่านที่แอดมินสร้างต้องมีความยาวอย่างน้อย 12 ตัวอักษร

### 2. Policies

1. คลิก **Policies** ภายใต้ **Create Zero-Trust Policy** สร้าง Policy 1:

   | ฟิลด์ | ค่า |
   |---|---|
   | Policy Name | `Allow Internal Web` |
   | Role | `STAFF` |
   | Target CIDR | `10.20.0.0/16` |
   | Protocol | `TCP` |
   | Port Range (TCP/UDP) | `443` |
   | Action | `ALLOW` |
   | Priority | `100` |

   คลิก **Create Policy**

2. สร้าง Policy 2:

   | ฟิลด์ | ค่า |
   |---|---|
   | Policy Name | `Block Admin Subnet` |
   | Role | `CLIENT` |
   | Target CIDR | `10.99.0.0/24` |
   | Protocol | `ANY` |
   | Port Range (TCP/UDP) | เว้นว่างไว้ |
   | Action | `DENY` |
   | Priority | `50` |

   คลิก **Create Policy** ช่วง Port ใช้ได้เฉพาะกับ TCP หรือ UDP จึงให้เว้นว่างไว้เมื่อเลือก `ANY`

**สิ่งที่ควรเห็น:** นโยบายทั้งสองปรากฏพร้อม Role, CIDR, Action, Protocol และ Priority ที่ถูกต้อง ลองใช้กล่อง **Search** และตัวกรอง **Role** กับ **Action** ได้ด้วย ตัวเลือกเพิ่มเติม: สร้างนโยบายทดลองแล้วคลิกปุ่ม **Delete** ของนโยบายนั้น และยืนยันว่านโยบายหายไปโดยไม่มี error

### 3. Gateways

คลิก **Gateways** ภายใต้ **Management**

**สิ่งที่ควรเห็น:** `Primary WireGuard Gateway` ที่มาพร้อมระบบ (`WIREGUARD`, `10.13.13.0/24`, `API_MANAGED`, `Default`) ตัวเลือกเพิ่มเติม: ลงทะเบียน Gateway เพิ่มเติม (`WIREGUARD`, `FORTINET` หรือ `CISCO`), กรองตาม provider หรือค้นหาด้วยคำ, เปิดหรือปิดการใช้งาน หรือลบ Gateway ทดสอบ

### 4. Agent Versions

1. คลิก **Agent Versions** ภายใต้ **Publish Agent Version** กรอกค่าดังนี้:

   | ฟิลด์ | ค่า |
   |---|---|
   | Version | `2.0.0` |
   | Platform | `windows-x64` บน Windows หรือ `linux-x64` บน Linux (ต้องตรงกับ OS ของไคลเอนต์) |
   | Download URL | `https://downloads.mango.local/mango-agent-2.0.0.exe` |
   | SHA-256 Checksum | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

   **Platform ต้องตรงกับ OS ของไคลเอนต์** ทั้ง `Sobree/agent-windows` และ `scripts/mock-agent.js` จะตรวจจับ OS ของเครื่อง (`windows-x64` บน Windows, `linux-x64` บน Linux) เว้นแต่คุณจะตั้ง `AGENT_PLATFORM` เวอร์ชันที่เผยแพร่สำหรับ platform ที่ไม่ตรงจะไม่ถูกจับคู่ หากใช้ Linux ให้ใช้ `linux-x64` พร้อม URL และ checksum ที่สอดคล้องกัน

2. ตรวจ **Minimum required version** จากนั้นคลิก **Publish Version**

   **สิ่งที่ควรเห็น:** เวอร์ชัน `2.0.0` ปรากฏเป็น Active และ Required URL นี้เป็นค่าตัวอย่างสำหรับการลงทะเบียน ไม่ใช่ที่อยู่สำหรับดาวน์โหลดจริง

3. **การทดสอบการบังคับใช้ (ระวัง):** หากยังเชื่อมต่ออยู่ให้ตัด VPN ก่อน เผยแพร่เวอร์ชัน `2.1.0` สำหรับ platform ของคุณพร้อม URL ที่ถูกต้องและ checksum แบบ 64 เลขฐานสิบหก แล้วเลือก **Minimum required version** จากนั้นคลิก **Connect VPN** บนการ์ด Agent อีกครั้ง

   **สิ่งที่ควรเห็น:** API ปฏิเสธเวอร์ชัน `2.0.0` ของ Agent พร้อม HTTP `426` และรหัส `AGENT_VERSION_OUTDATED` ใน **Agent Versions** คลิก **Mark Optional** ที่ `2.1.0` แล้ว Agent `2.0.0` จะเชื่อมต่อได้อีกครั้ง หรือคลิก **Deactivate** ที่ record `2.1.0` ก็จะบล็อกเวอร์ชันนั้นโดยเฉพาะ อย่า Deactivate `2.0.0` โดยไม่ตั้งใจ

### 5. Devices

คลิก **Devices**

**สิ่งที่ควรเห็น:** แถบสรุป (**Total**, **Active**, **Revoked**), ช่องค้นหาและตัวกรองสถานะ, **Refresh** และ **Export CSV** เครื่องที่คุณเชื่อมต่ออยู่จะปรากฏพร้อมไอคอน OS, hostname, device fingerprint, ผู้ใช้ `admin`, เวลาที่พบล่าสุด และสถานะ `ACTIVE` คลิก **Inspect** เพื่อดูรายละเอียดอุปกรณ์ fingerprint ของ mock สร้างจาก hostname เว้นแต่คุณจะตั้ง `AGENT_DEVICE_FINGERPRINT`

### 6. Sessions

คลิก **Sessions**

**สิ่งที่ควรเห็น:** เซสชัน `ACTIVE` แบบเรียลไทม์ของ `admin` โดยทั่วไปจะมี IP ที่จัดสรรเป็น `10.13.13.2` หน้านี้มีปุ่มสลับ **Auto 5s** สำหรับรีเฟรชอัตโนมัติ, **Refresh**, **Export CSV**, ช่องค้นหาและตัวกรองสถานะ (`ALL`, `ACTIVE`, `DISCONNECTED`, `EXPIRED`), การกระทำ **Disconnect** ในแต่ละแถว และปุ่มฉุกเฉิน **Terminate All Active**

### 7. Audit Logs

คลิก **Audit Logs** ให้มองหาเหตุการณ์ด้านความปลอดภัยจากการกระทำข้างต้น เช่น `VPN_TICKET_ISSUED`, `VPN_CONNECTED`, `USER_CREATED`, `POLICY_CREATED` และเหตุการณ์การสร้างเวอร์ชัน Agent (API แสดงเป็น `agent_version.create`) ลองใช้ **Action filter**, **Target type filter** และช่อง **Search** ตัวอย่างเช่น ค้นหา `admin` หรือกรองด้วย `USER_CREATED`

**สิ่งที่ควรเห็น:** เหตุการณ์ล่าสุดในตารางที่มีการประทับเวลา คลิก **Inspect** เพื่อเปิด payload ของ audit ของเหตุการณ์นั้น และคลิก **Close** เพื่อปิด หากไม่มีผลลัพธ์ จะแสดงตรงไปตรงมาว่า `No audit logs found.`

---

## 🎯 ภารกิจที่ 4: การเพิกถอนแบบเรียลไทม์และ RBAC สำหรับผู้ใช้ที่ไม่ใช่แอดมิน (ล็อกอินด้วย `STAFF`)

คุณทดสอบทุกบทบาทผ่าน URL พอร์ทัลเดียว (`http://localhost:3000`) ได้โดยออกจากระบบแล้วล็อกอินใหม่ ในโหมดพัฒนาพอร์ทัลจะส่ง `X-Mango-Dev-User` และ `scripts/mock-agent.js` จะแยกสถานะ Agent และ device fingerprint ของผู้ใช้แต่ละคน (`-<username>`)

1. ในฐานะ `admin` คลิก **Sessions** แล้วคลิก **Disconnect** ที่เซสชันที่ใช้งานอยู่

   **สิ่งที่ควรเห็น:** เซสชันเปลี่ยนเป็น `DISCONNECTED` และ Gateway ลบ Peer ของเซสชันนั้น สำหรับ mock การ์ดในเครื่องอาจยังแสดงสถานะเดิมจนกว่าคุณจะคลิก **Disconnect VPN** หรือรีสตาร์ต mock การตัดการเชื่อมต่อโดยแอดมินจะลบ Peer ฝั่งเซิร์ฟเวอร์ แต่จะไม่ส่งการเปลี่ยนแปลงสถานะเข้าไปใน process ของ Agent

2. **การเพิกถอนอุปกรณ์มีผลถาวรสำหรับ fingerprint นั้น** การคลิก **Revoke** ในแท็บ **Devices** จะไม่ให้ fingerprint นั้นเชื่อมต่อใหม่ได้ ให้เก็บอุปกรณ์สาธิตหลักของคุณไว้โดยไม่เพิกถอน เว้นแต่คุณต้องการทดสอบโดยเฉพาะ หากต้องการใช้ตัวตน mock ใหม่แทน ให้หยุด mock ด้วย `Ctrl+C` ตั้งค่า fingerprint ใหม่แล้วรันอีกครั้ง:

   **Windows (PowerShell):**

   ```powershell
   $env:AGENT_DEVICE_FINGERPRINT="mock-device-02"
   npm run mock:agent
   ```

   **Linux / macOS (Bash):**

   ```bash
   export AGENT_DEVICE_FINGERPRINT="mock-device-02"
   npm run mock:agent
   ```

   **สิ่งที่ควรเห็น:** กล่องข้อความเริ่มต้นใหม่ที่มี `PairingToken:` ใหม่ ให้จับคู่ด้วยโทเคนนั้น หากคุณเคยเพิกถอน `mock-device-02` ไว้ ให้เลือก fingerprint อื่นที่ยังไม่ได้ใช้ ล้างตัวแปรภายหลังด้วย `Remove-Item Env:AGENT_DEVICE_FINGERPRINT` (PowerShell) หรือ `unset AGENT_DEVICE_FINGERPRINT` (Bash)

   **การแยก fingerprint ของผู้ใช้แต่ละคน (mock agent):** `scripts/mock-agent.js` สร้าง fingerprint จากค่าพื้นฐาน (`AGENT_DEVICE_FINGERPRINT` หรือแฮชของ hostname) และ **ต่อท้าย `-<username>`** เมื่อพอร์ทัลส่ง `X-Mango-Dev-User` ดังนั้น `admin`, `staff01` และ `client01` แต่ละคนจึงมีสถานะ Agent และตัวตนอุปกรณ์ของตัวเอง Go agent **จะไม่เพิ่ม suffix นี้** เมื่อใช้ Go agent ให้ตั้ง `AGENT_DEVICE_FINGERPRINT` ต่างกันสำหรับแต่ละผู้ใช้แทน (ดูขั้นตอนที่ 4)

3. ก่อนสลับผู้ใช้ ให้ตัดการเชื่อมต่อ Agent ในเครื่องหากยังแสดงว่าเชื่อมต่ออยู่ จากนั้นคลิก **Log Out** แล้วล็อกอินเป็น `staff01` ด้วยรหัส `StaffTestPass#2026` การล็อกอินครั้งแรกของ `staff01` จะลงทะเบียน TOTP ของตัวเอง ให้สแกน QR code (หรือกรอกคีย์ Base32) พิมพ์ **6-Digit Code** ปัจจุบันแล้วคลิก **Verify**

   **สิ่งที่ควรเห็น:** แดชบอร์ดของ Staff แสดง `staff01 · STAFF` พร้อมสามแท็บ ได้แก่ **Connection**, **Profile & Security** และ **Help** ผู้ใช้ Staff จะไม่เห็นแท็บ **Admin Governance** คลิก **Help** เพื่อยืนยันว่าการ์ด **Download MANGO Agent Installer** โหลดรายการเวอร์ชัน Agent ที่ใช้งานอยู่จาก `GET /api/vpn/agent-versions` รวมถึงเวอร์ชัน `2.0.0` จากภารกิจที่ 3 พร้อมปุ่มคัดลอก SHA-256 และลิงก์ดาวน์โหลด หากคุณล็อกอินเป็น `client01` จะเห็น **CLIENT PORTAL** ที่เน้นเฉพาะการ์ดการเชื่อมต่อ VPN

4. กับ **mock agent** ผู้ใช้ `staff01` จะได้ fingerprint suffix ของตัวเอง (`-staff01`) อยู่แล้ว และโทเคนจับคู่จะถูกเก็บไว้ใน `localStorage` คุณอาจต้องคลิก **Connect VPN** เท่านั้น หรือจับคู่ใหม่หากคุณรีสตาร์ต mock หากต้องการทดสอบด้วย fingerprint ที่กำหนดเองแทน (หรือกับ **Go agent** ที่ไม่เพิ่ม suffix) ให้ตั้ง `AGENT_DEVICE_FINGERPRINT` ก่อนรีสตาร์ต Agent:

   **Windows (PowerShell):**

   ```powershell
   $env:AGENT_DEVICE_FINGERPRINT="mock-device-staff01"
   npm run mock:agent
   ```

   **Linux / macOS (Bash):**

   ```bash
   export AGENT_DEVICE_FINGERPRINT="mock-device-staff01"
   npm run mock:agent
   ```

   วางโทเคนที่เพิ่งพิมพ์ออกมาใหม่ คลิก **Pair Agent** แล้วคลิก **Connect VPN** กับ **Go agent** ให้ตั้ง `AGENT_DEVICE_FINGERPRINT` ในลักษณะเดียวกันก่อนรัน `go run .` (`$env:...` ใน PowerShell ที่รันแบบ Administrator หรือ `export` ก่อนรัน `sudo -E go run .`)

   **สิ่งที่ควรเห็น:** `staff01` เชื่อมต่อในบทบาท `STAFF` เนื่องจากภารกิจที่ 3 สร้างนโยบาย `ALLOW` สำหรับ `STAFF` ไว้แล้ว **Permitted Networks** จึงมี `10.20.0.0/16` อาจมีเครือข่ายที่อนุญาตอื่นเพิ่มเติมขึ้นอยู่กับข้อมูลนโยบาย แท็บ Admin Governance ยังคงซ่อนอยู่ และ fingerprint ต้องต่างจากที่ใช้กับ `admin`

---

## ระยะที่ 5: การตรวจสอบ Gateway และการตรวจสอบอัตโนมัติ

### 5.1 ตรวจสอบ Docker Gateway ขณะที่มี Peer ลงทะเบียนอยู่ (เฉพาะ Track B และ C)

ข้ามหัวข้อนี้สำหรับ Track A `npm run mock:daemon` ทำงานบน Host ของคุณและไม่มีอินเทอร์เฟซ `wg0` หรือตาราง nftables `mango_vpn`

เมื่อมีเซสชันเชื่อมต่ออยู่ใน Track B หรือ C ให้รันคำสั่งเหล่านี้จากเทอร์มินัลใดก็ได้ Gateway ทำงานอยู่ใน Docker จึงใช้คำสั่งเดียวกันทั้งบน Windows และ Linux:

```bash
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn
```

**สิ่งที่ควรเห็น:** `wg show` แสดงอินเทอร์เฟซ `wg0`, พอร์ตที่รับฟัง และ Peer พร้อม public key และ allowed IPs ส่วนคำสั่ง `nft` จะแสดงตาราง `inet mango_vpn` และกฎการส่งต่อ คำสั่งเหล่านี้แสดงการตั้งค่าของ Gateway เท่านั้น เซสชัน mock ยังไม่ได้สร้างอุโมงค์ฝั่งไคลเอนต์จริง และไม่ได้พิสูจน์ว่ามีทราฟฟิกไหลผ่าน

บน Linux ที่ใช้อุโมงค์ Go จริง คุณสามารถตรวจสอบฝั่งไคลเอนต์ด้วย `sudo wg show mango0` ได้ ส่วนบน Windows ให้ใช้แอป WireGuard for Windows เพื่อดูอุโมงค์ `mango0`

### 5.2 ทดสอบ Agent ในเครื่อง

แทนที่ `<your-pairing-token>` ด้วยโทเคนที่ mock แสดงให้ หรือค่าที่คุณตั้งไว้สำหรับ Go agent โทเคนที่ผิดหรือเก่าจะได้ `401`

**Windows (PowerShell):**

```powershell
Invoke-RestMethod http://127.0.0.1:47821/health
Invoke-RestMethod http://127.0.0.1:47821/status -Headers @{ "X-Mango-Agent-Token" = "<your-pairing-token>" }
```

**Linux / macOS (Bash):**

```bash
curl -s http://127.0.0.1:47821/health
curl -s http://127.0.0.1:47821/status -H "X-Mango-Agent-Token: <your-pairing-token>"
```

**สิ่งที่ควรเห็น:** `/health` ส่งคืน `status` (`ok`), `service`, `version`, `uptimeSeconds` และค่า boolean `tunnelActive` ผลลัพธ์ `/health` ของ mock ยังมี `supportsDevUserHint: true` ซึ่ง Go agent ไม่ได้ส่ง `/status` ส่งคืนสถานะของ Agent, เวอร์ชัน และเมื่อเชื่อมต่อแล้วจะมี IP ที่จัดสรร, endpoint, allowed IPs รวมถึง `bytesReceived` และ `bytesSent` ตัวนับไบต์ของ mock เป็นค่าจำลอง ส่วน Go agent จะแสดงตามการทำงานจริงของ agent ซึ่งอาจยังเป็นศูนย์อยู่

### 5.3 รันการตรวจสอบอัตโนมัติ

รันตัวตรวจสอบกฎการใช้งาน (guardrail) จากรากของโปรเจกต์:

```bash
node scripts/check-guardrails.mjs
```

**สิ่งที่ควรเห็น:** `Guardrail check passed (0 violations).`

Build โมโนรีโป TypeScript:

```bash
npm run build
```

**สิ่งที่ควรเห็น:** Build ของ shared contracts และ Workspace ที่เกี่ยวข้องสำเร็จ โดยไม่มี TypeScript error

ก่อนรันการทดสอบ ให้ยืนยันว่า `DATABASE_URL` ใน `.env` มีอยู่ อย่าวางค่านี้ลงในบันทึกสาธารณะหรือแชต

**Windows (PowerShell):**

```powershell
if ($env:DATABASE_URL) { 'DATABASE_URL is set in this PowerShell session.' } else { 'DATABASE_URL is not exported in this PowerShell session; npm scripts load the root .env where configured. Check .env and the database if tests cannot connect.' }
npm test
```

**Linux / macOS (Bash):**

```bash
if [ -n "${DATABASE_URL:-}" ]; then echo 'DATABASE_URL is set in this shell.'; else echo 'DATABASE_URL is not exported in this shell; npm scripts load the root .env where configured. Check .env and the database if tests cannot connect.'; fi
npm test
```

ชุดทดสอบ Vitest รันครอบคลุม Workspace ของ API, Admin และ Portal ต้องให้ PostgreSQL ทำงานอยู่และฐานข้อมูลมี schema v2 ปัจจุบัน สำหรับ Track A หมายถึง Instance แบบฝังตัวจาก `npm run db:start` (ปล่อยให้ทำงานต่อไป) และ `mangovpn_v2_test` ที่ migrate แล้วตามขั้นตอน A1 หากการทดสอบใดต้องการ `DATABASE_URL` ที่ export ไว้ ให้ตั้งค่า URL เดียวกันจาก `.env` ในเทอร์มินัลนี้ แล้วรัน `npm test` อีกครั้ง

**สิ่งที่ควรเห็น:** ชุดทดสอบรายงานว่าผ่าน หากการทดสอบล้มเหลวเพราะเข้าถึง PostgreSQL ไม่ได้หรือ schema เก่า ให้ใช้[บทที่ 05](05-troubleshooting-and-reference.md) ก่อนจะสรุปว่าเป็นข้อบกพร่องของโค้ด

สำหรับโมดูล Go ให้รันการตรวจสอบเหล่านี้จากรากของโปรเจกต์

**Windows (PowerShell):**

```powershell
Push-Location Sobree/agent-windows
go vet ./...
go test ./...
Pop-Location

Push-Location Sobree/vpn-daemon
go vet ./...
go test ./...
Pop-Location
```

**Linux / macOS (Bash):** เครื่องหมายวงเล็บจะรันแต่ละคำสั่ง `cd` ใน subshell เพื่อให้เชลล์ของคุณยังอยู่ที่รากของโปรเจกต์

```bash
(cd Sobree/agent-windows && go vet ./... && go test ./... && GOOS=windows go vet ./...)
(cd Sobree/vpn-daemon && go vet ./... && go test ./...)
```

**สิ่งที่ควรเห็น:** `go vet` และ `go test` ทำงานจนจบโดยไม่มี error ในแต่ละโมดูล ใน PowerShell ให้จับคู่ `Push-Location` กับ `Pop-Location` เสมอ เพื่อให้เชลล์กลับไปที่รากของโปรเจกต์ บรรทัด `GOOS=windows go vet` ใน Bash ใช้ตรวจว่า Agent คอมไพล์สำหรับ Windows ได้ด้วย

---

**ถัดไป:** [05 การแก้ไขปัญหาและอ้างอิง](05-troubleshooting-and-reference.md) →

> 🏠 [สารบัญคู่มือ](../../../TUTORIAL.th.md) › [00 ภาพรวมและการเตรียมระบบ](00-overview-and-setup.md) › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · **04 การทดสอบ** › [05 การแก้ไขปัญหา](05-troubleshooting-and-reference.md) · [06 ภาคผนวก](06-appendix-local-docker-smoke-test.md)
