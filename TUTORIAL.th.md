> 🌐 **Language / ภาษา**: [🇬🇧 English (`TUTORIAL.md`)](TUTORIAL.md) | **🇹🇭 ภาษาไทย (`TUTORIAL.th.md`)**

# MANGO VPN v2: คู่มือสำหรับผู้เริ่มต้น (สารบัญ)

ยินดีต้อนรับ! คู่มือนี้จะพาคุณจากการดาวน์โหลดโปรเจกต์ไปจนถึงการตั้งค่า MANGO VPN v2 ที่ใช้งานได้บน **Windows (PowerShell)** หรือ **Linux (Bash)** แบ่งเนื้อหาเป็นบทสั้นๆ เพื่อให้คุณอ่านเฉพาะส่วนที่ต้องใช้ เริ่มจากบทที่ 00 แล้วทำตาม Track ที่คุณเลือก

> **หมายเหตุด้านความปลอดภัย:** นี่คือการตั้งค่าสำหรับการพัฒนาและการสาธิตในเครื่องเท่านั้น ไม่ใช่การนำขึ้นใช้งานจริง (Production) โปรดเก็บไฟล์ `.env` ไว้เป็นความลับ และอย่านำค่า Secret ที่สร้างขึ้นไปใช้ที่อื่น

## เลือก Track ไหนดี?

| Track | เลือกตัวนี้ถ้า… | สิ่งที่พิสูจน์ได้ | สิ่งที่ต้องเตรียม |
|---|---|---|---|
| **Track A: พัฒนาในเครื่องแบบไม่ใช้ Docker** ([บทที่ 01](docs/tutorial/th/01-track-a-local-dev.md)) | คุณกำลังเรียนรู้พอร์ทัลและ Admin CRUD หรือยังไม่ต้องการตั้งค่าอุโมงค์จริง | การล็อกอินด้วย TOTP, API, Admin CRUD, คำขอ Peer และนโยบายไปยัง Gateway และหน้า UI ของ Agent จำลอง Mock daemon และ Mock agent **ไม่** เปิดอุโมงค์ WireGuard จริงหรือบังคับใช้ `nftables` | Node.js, Git และแอปยืนยันตัวตน **ไม่ต้องใช้ Docker** ใช้ได้ทั้ง Windows และ Linux |
| **Track B: ห้องแล็บคลาวด์จำลอง GNS3** ([บทที่ 02](docs/tutorial/th/02-track-b-gns3-mock-cloud.md)) | คุณต้องการ Go Agent จริง, Gateway จริง และอุโมงค์ WireGuard จริงภายในเครือข่ายคลาวด์จำลอง | ขั้นตอนตั๋วเชื่อมต่อจริง การสร้างคีย์ของ Agent การเปิดอุโมงค์จริง และการตั้งค่า Peer กับนโยบายบน Gateway ภายในโทโพโลยีคลาวด์จำลอง | GNS3 พร้อมไฟล์ที่เตรียมไว้ใน `deploy/gns3/`, Docker, Go 1.26+ และเครื่องมือ WireGuard ตามระบบปฏิบัติการของคุณ |
| **Track C1: VM คลาวด์เครื่องเดียว** ([บทที่ 03](docs/tutorial/th/03-track-c-cloud-deployment.md)) | คุณต้องการรันสแต็ก Docker ทั้งชุดบนเซิร์ฟเวอร์ Linux เครื่องเดียวที่คุณควบคุมเอง | คอนเทนเนอร์ API, พอร์ทัล, PostgreSQL และ Gateway บน Cloud VM โดยใช้ไฟล์ใน `deploy/cloud-vm/` | VM บนคลาวด์ที่ใช้ Linux, Docker พร้อม Compose v2 และโดเมนหรือ `<IP>.sslip.io` สำหรับ HTTPS (มี SSH port-forward เป็นทางเลือกสำรอง) |
| **Track C2: สแต็ก AWS แบบ Managed** ([บทที่ 03](docs/tutorial/th/03-track-c-cloud-deployment.md)) | คุณต้องการการ Deploy บน AWS แบบ Managed ที่สร้างจาก CloudFormation | สแต็กจาก `deploy/aws-managed/template.yaml`: ECS services, RDS PostgreSQL, EC2 instance สำหรับ Gateway และ Secret ใน Secrets Manager | บัญชี AWS ที่มีสิทธิ์สร้าง Stack, AWS CLI v2 และใบรับรอง ACM พร้อมโดเมนของคุณสำหรับ HTTPS (หรือ CloudFront/SSM เป็นทางเลือกสำรอง) |

Track A เป็นจุดเริ่มต้นที่เหมาะสมสำหรับเกือบทุกคน ส่วน Track B และ C ต้องตั้งค่ามากกว่าและมีค่าใช้จ่ายในการรันสูงกว่า

## สารบัญบท

| # | บท | เนื้อหา |
|---|---|---|
| 00 | [ภาพรวมและการเตรียมระบบ](docs/tutorial/th/00-overview-and-setup.md) | ภาพรวมของระบบ วงจรชีวิตการเชื่อมต่อ v2 การตรวจความพร้อม และการตั้งค่า `.env` |
| 01 | [Track A: พัฒนาในเครื่องแบบไม่ใช้ Docker](docs/tutorial/th/01-track-a-local-dev.md) | PostgreSQL แบบฝังตัว การ Seed บัญชีแอดมิน และการเปิดระบบห้าเทอร์มินัล |
| 02 | [Track B: ห้องแล็บ GNS3 จำลองคลาวด์](docs/tutorial/th/02-track-b-gns3-mock-cloud.md) | ห้องแล็บ GNS3, Go Agent จริง และอุโมงค์ WireGuard |
| 03 | [Track C: การ Deploy บนคลาวด์](docs/tutorial/th/03-track-c-cloud-deployment.md) | VM คลาวด์เครื่องเดียว (C1) และสแต็ก AWS แบบ Managed (C2) |
| 04 | [คู่มือการทดสอบแบบทีละขั้นตอน](docs/tutorial/th/04-testing-playbook.md) | ภารกิจที่ 1 ถึง 4 บนพอร์ทัล การตรวจสอบ Gateway และชุดทดสอบอัตโนมัติ |
| 05 | [การแก้ไขปัญหาและอ้างอิง](docs/tutorial/th/05-troubleshooting-and-reference.md) | ตารางอาการผิดปกติ ตารางตัวแปรสภาพแวดล้อม และการปิดระบบอย่างถูกต้องของทุก Track |
| 06 | [ภาคผนวก: Docker Smoke Test ในเครื่อง](docs/tutorial/th/06-appendix-local-docker-smoke-test.md) | สแต็ก Docker, Test target แบบเลือกใช้ และ Role Harness บน localhost |

หากคุณเพิ่งเริ่มต้น ให้อ่านตามลำดับนี้: **00 แล้ว 01 แล้ว 04** ใช้ **05** ทุกครั้งที่ผลลัพธ์ไม่ตรงกับหัวข้อ **สิ่งที่ควรเห็น**

> 🌐 ต้องการอ่านฉบับภาษาอังกฤษ? ดูที่ [`TUTORIAL.md`](TUTORIAL.md) และบทต่างๆ ใน [`docs/tutorial/`](docs/tutorial/00-overview-and-setup.md)
