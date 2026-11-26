> 🌐 **Language / ภาษา**: [🇬🇧 English](../05-troubleshooting-and-reference.md) | **🇹🇭 ภาษาไทย**

> 🏠 [สารบัญคู่มือ](../../../TUTORIAL.th.md) › [00 ภาพรวมและการเตรียมระบบ](00-overview-and-setup.md) › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 การทดสอบ](04-testing-playbook.md) · **05 การแก้ไขปัญหา** · [06 ภาคผนวก](06-appendix-local-docker-smoke-test.md)

---

# 05 · การแก้ไขปัญหา ข้อมูลอ้างอิงตัวแปรสภาพแวดล้อม และการปิดระบบ

ใช้บทนี้เมื่อขั้นตอนใดก็ตามใน Track ใดๆ ทำงานไม่ตรงกับหัวข้อ **สิ่งที่ควรเห็น** ค้นหาอาการในตารางแล้วทำตามวิธีแก้ ส่วนอ้างอิงท้ายบทรวบรวมตัวแปรสภาพแวดล้อมทั้งหมดที่คู่มือใช้ และส่วนการปิดระบบแสดงวิธีหยุดแต่ละ Track โดยไม่สูญเสียข้อมูลที่ต้องการเก็บไว้

---

## การแก้ไขปัญหา

| อาการ | ความหมายโดยทั่วไป | สิ่งที่ควรทำ |
|---|---|---|
| `502 Bad Gateway` ระหว่าง Connect, การสร้างหรือ sync นโยบาย หรือการเพิกถอน | API เข้าถึง gateway daemon ไม่ได้ หรือ daemon secret ไม่ตรงกัน | **Track A:** ตรวจว่า `npm run mock:daemon` ทำงานอยู่และฟังที่ `http://127.0.0.1:50051` และ `DAEMON_SHARED_SECRET` ใน `.env` ยาวอย่างน้อย 32 ตัวอักษร (ตัวจำลองจะไม่เริ่มทำงานหากไม่ผ่าน) **Track B และ C:** รัน `docker compose ps vpn-gateway` และรอจนขึ้น `healthy` รวมถึงตรวจว่า `DAEMON_SHARED_SECRET` ใน `.env` ที่รากตรงกับการตั้งค่าของ Compose และ API หากรัน `Sobree/vpn-daemon` แบบ Native บน Linux ให้หยุดคอนเทนเนอร์ `vpn-gateway` ของ Docker เพื่อให้พอร์ต `50051` ว่าง API ที่รันบน Host ใช้ `http://127.0.0.1:50051` ส่วนคอนเทนเนอร์ API ใช้ `http://vpn-gateway:50051` |
| Agent ตอบ `401 Unauthorized` / `INVALID_PAIRING_TOKEN` | โทเคนหายไป พิมพ์ผิด หรือเปลี่ยนไปหลัง Agent รีสตาร์ต | คัดลอก `PairingToken:` ล่าสุดจาก mock หรือใช้ค่า `AGENT_PAIRING_TOKEN` ที่คุณตั้งไว้ก่อนเริ่ม Go agent แล้วจับคู่ใหม่ |
| `403 FORBIDDEN_ORIGIN` | Origin ของเบราว์เซอร์ของพอร์ทัลไม่อยู่ใน allow-list ของ Agent | เปิดพอร์ทัลที่ `http://localhost:3000` (หรือ `http://127.0.0.1:3000`) สำหรับ Go agent ให้ตั้ง `AGENT_ALLOWED_ORIGINS` ให้มี Origin ที่ตรงทุกตัวอักษร แล้วรีสตาร์ต Agent ห้ามใช้ Wildcard Origin |
| `426 AGENT_VERSION_OUTDATED` หรือ `AGENT_VERSION_INACTIVE` | เวอร์ชันที่กำหนดให้ต้องใช้ใหม่กว่า Agent หรือเวอร์ชันนี้ถูก Deactivate ไปแล้ว | ใน **Agent Versions** ให้เปลี่ยนเวอร์ชันที่กำหนดให้เป็น optional ด้วย **Mark Optional** หรือเปิดใช้เวอร์ชันที่ถูกต้อง อย่า Deactivate เวอร์ชันที่กำลังทดสอบ |
| เวอร์ชัน Agent ถูกปฏิเสธสำหรับ platform ของคุณ | ค่า **Platform** ใน **Agent Versions** ไม่ตรงกับ OS ของ Host | เผยแพร่ด้วย `windows-x64` บน Windows หรือ `linux-x64` บน Linux หรือกำหนด `AGENT_PLATFORM` ให้ชัดเจนทั้ง mock และ Go agent |
| `Device has been revoked` (HTTP `403`) | Agent กำลังเชื่อมต่อใหม่ด้วย device fingerprint ที่ถูกเพิกถอนถาวรแล้ว | ใช้ fingerprint ใหม่ที่ยังไม่ได้ใช้สำหรับตัวตนอุปกรณ์ใหม่ **PowerShell:** `$env:AGENT_DEVICE_FINGERPRINT="mock-device-02"` แล้วรัน `npm run mock:agent` **Bash:** `export AGENT_DEVICE_FINGERPRINT="mock-device-02"` แล้วรัน `npm run mock:agent` จับคู่ใหม่ด้วยโทเคนที่เพิ่งพิมพ์ออกมา |
| รายการ Devices แสดงคำต่อท้าย `-<username>` | การแยก fingerprint ของผู้ใช้แต่ละคนใน mock agent ทำงานตามที่ออกแบบไว้ | เป็นพฤติกรรมที่คาดไว้เมื่อคุณทดสอบหลายบัญชีบน `http://localhost:3000` หากต้องการรีเซ็ต ให้ตั้ง `AGENT_DEVICE_FINGERPRINT` เป็นค่าฐานใหม่ (PowerShell `$env:...` หรือ Bash `export ...`) แล้วรีสตาร์ต mock |
| `RoleName` ไม่มีอยู่ หรือไม่พบตาราง `connect_tickets` | ฐานข้อมูลยังเป็น schema v1 หรือ migration เก่า การรีเซ็ตจะลบข้อมูลฐานข้อมูลในเครื่อง | หากคุณลบฐานข้อมูลในเครื่องได้อย่างปลอดภัย ให้รัน `npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma` แล้วรัน `npm run db:seed` พร้อมตัวแปรแอดมิน การรีเซ็ตนี้ทำลายข้อมูลฐานข้อมูลในเครื่องทั้งหมด |
| `Connect ticket has expired` (HTTP `401`) | ตั๋วใช้ได้ครั้งเดียวและมีอายุ 60 วินาที คุณรอนานเกินไป หรือตั๋วถูกใช้ไปแล้ว | คลิก **Connect VPN** อีกครั้งเพื่อขอตั๋วใหม่ |
| `docker info` แจ้ง `error during connect` (Windows) หรือ `Cannot connect to the Docker daemon` (Linux) (Track B และ C) | Engine ของ Docker Desktop หยุดทำงานหรือกำลังเริ่มต้น (Windows) หรือบริการ Docker Engine ไม่ทำงาน (Linux) | **Windows:** เปิด **Docker Desktop** รอจนแถบสถานะขึ้น **Engine running** แล้วลองใหม่ **Linux:** รัน `sudo systemctl start docker` หากพบ `permission denied` ให้รัน `sudo usermod -aG docker "$USER"` ออกจากระบบแล้วล็อกอินใหม่ จากนั้นลอง `docker info` อีกครั้ง |
| ไม่พบ `wireguard.exe` หรือ `wireguard.exe install failed` (Windows) | ยังไม่ได้ติดตั้ง WireGuard for Windows ไม่อยู่บน `PATH` หรือไม่ได้เริ่ม Agent จากหน้าต่างที่มีสิทธิ์ระดับ Administrator | ติดตั้ง WireGuard for Windows เปิด **Administrator PowerShell** ใหม่แล้วรัน `go run .` อีกครั้ง อ่าน error ที่แน่นอนซึ่ง Agent แสดง |
| `wg-quick up failed` หรือ `wg-quick: command not found` (Linux) | ยังไม่ได้ติดตั้ง `wireguard-tools` หรือ Agent ไม่ได้รันเป็น root | ติดตั้ง `wireguard-tools`, `iproute2` และ `nftables` (ดู[บทที่ 00](00-overview-and-setup.md) หัวข้อ 3.1) รัน Agent ด้วย `sudo -E go run .` หาก `sudo` แจ้ง `go: command not found` ให้ใช้ path เต็มของ Go (`sudo -E "$(command -v go)" run .`) เพราะ `sudo` อาจรีเซ็ต `PATH` |
| `wg-quick` แจ้ง `resolvconf: command not found` (Linux) | ไฟล์คอนฟิกที่สร้างมีบรรทัด `DNS =` และ `wg-quick` ต้องใช้ตัวจัดการ DNS เพื่อนำค่าไปใช้ | ติดตั้งตัวจัดการ DNS เช่น `openresolv` (`sudo apt install -y openresolv`) หรือใช้ `systemd-resolved` แล้วลองใหม่ |
| `mango0` หรือ `wg show mango0` ไม่แสดงอินเทอร์เฟซหรือไม่มี handshake (Track B) | Agent จริงอาจไม่มีสิทธิ์ระดับสูง ขาดเครื่องมือ WireGuard หรือ public key หรือ endpoint ของ Gateway ไม่ถูกต้อง | **Windows:** รัน Go ใน Administrator PowerShell ติดตั้ง WireGuard for Windows และตรวจว่า `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY` และ `WG_SERVER_ENDPOINT` สอดคล้องกัน **Linux:** รันด้วย `sudo -E` ตรวจด้วย `sudo wg show mango0` และยืนยันว่า UDP `51820` เข้าถึงได้ อ่าน error ที่แน่นอนของ Go agent ในเทอร์มินัลของมัน |
| พอร์ทัลที่ `http://` ระยะไกลเข้าถึง Agent ไม่ได้ | Private Network Access ของเบราว์เซอร์บล็อกหน้าที่ไม่ได้อยู่ในเครื่องจากการเรียก `127.0.0.1:47821` | ใช้ `http://localhost:3000` สำหรับงานในเครื่อง เชื่อถือใบรับรอง Internal CA ของ Caddy สำหรับ `https://vpn.mango.lab` ใน[บทที่ 02](02-track-b-gns3-mock-cloud.md) หรือให้บริการ Track C ผ่าน HTTPS (`<IP>.sslip.io` / โดเมนกำหนดเอง / ACM / SSH tunnel) ตาม[บทที่ 03](03-track-c-cloud-deployment.md) |
| ไคลเอนต์ GNS3 ข้าม VPN หรือเข้าถึงเป้าหมายได้ก่อนเชื่อมต่อ (Track B) | WAN router มี static route สำหรับ `10.13.13.0/24` หรือ `10.99/10.20/10.30` โดยไม่ตั้งใจ | รัน `deploy/gns3/setup-wan-router.sh` ใหม่ แล้วยืนยันด้วย `ip route` บน WAN router ว่ารู้จักเพียง `192.168.50.0/24` และ `203.0.113.0/24` |
| เป้าหมาย GNS3 timeout แม้ WireGuard เชื่อมต่อแล้ว (Track B) | ไม่มี return route บน VPC Private Router หรือ Ubuntu control-plane VM หรือ `forward` ของ `nft` ทิ้งทราฟฟิก | ยืนยัน `10.13.13.0/24 via 172.28.0.2` บน Private Router (`setup-private-router.sh`), `10.99/10.20/10.30 via 172.28.0.1` บน Ubuntu VM และตรวจ `nft list table inet mango_vpn` ภายใน `vpn-gateway` |
| Caddy ออกใบรับรอง Let's Encrypt บน `sslip.io` หรือโดเมนกำหนดเองไม่สำเร็จ (Track C1) | พอร์ต `80` หรือ `443` ถูกบล็อกใน Security Group ของคลาวด์ หรือ DNS ชี้ไปยัง IP ผิด | อนุญาต TCP ขาเข้า `80` และ `443` ใน Security Group ของ VM ยืนยันว่า `MANGO_DOMAIN` resolve ไปยัง IP สาธารณะของ VM หรือใช้ SSH tunnel + fallback พอร์ต `:80` ตามที่ระบุใน `deploy/cloud-vm/Caddyfile` |
| สแต็ก AWS แบบ Managed ไม่สามารถเริ่ม API task หรือ Gateway ทิ้งทราฟฟิกที่ส่งต่อ (Track C2) | `TotpEncryptionSecret` ยังเป็นค่า placeholder, `ApiDesiredCount` ถูกตั้งเป็น `1` ก่อนที่จะ push image ECR หรือ `SourceDestCheck` ยังเปิดอยู่ | กรอก `TotpEncryptionSecret` (`openssl rand -hex 32`) และ `WireGuardKeySecret` ก่อน push image ECR ทั้ง 3 รายการ แล้วจึงตั้ง `ApiDesiredCount=1` และ `PortalDesiredCount=1` ตั้งค่า `SourceDestCheck: false` บน `WireGuardGatewayInstance` และ `VpnReturnRoute` (`10.13.13.0/24`) ใน `PrivateRouteTable` |
| Agent แสดง `Agent Unreachable` | ไม่มี process ของ Agent ฟังอยู่บนพอร์ต loopback | เริ่ม `npm run mock:agent` หรือ Go agent แล้วตรวจว่ามีการ log `127.0.0.1:47821` หยุดโปรเซสอื่นที่ใช้พอร์ตนั้น: `lsof -i :47821` บน Linux, `netstat -ano \| findstr 47821` บน Windows |
| API ล้มเหลวตอนเริ่มทำงานด้วย error ว่าตัวแปรที่จำเป็นหายไป | ไม่มีไฟล์ `.env` หรือ Secret ที่จำเป็นไม่ถูกต้อง | ตรวจว่า `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET` และ `DAEMON_SHARED_SECRET` ถูกตั้งค่า Secret สามตัวต้องยาวอย่างน้อย 32 ตัวอักษรแต่ละตัว และ `TOTP_ENCRYPTION_KEY` ต้องเป็นเลขฐานสิบหก 64 ตัวพอดี |

---

## ข้อมูลอ้างอิงตัวแปรสภาพแวดล้อม

ค่าทั้งหมดมาจาก `.env` ที่รากของโปรเจกต์ (สร้างด้วย `npm run env:init`) เว้นแต่แถวจะระบุไว้เป็นอย่างอื่น ตั้งค่าหรือ export ตัวแปรเฉพาะในเทอร์มินัลที่ต้องการใช้งานเท่านั้น

### ฐานข้อมูลและ API

| ตัวแปร | ค่าเริ่มต้นหรือตัวอย่าง | ถูกใช้โดย |
|---|---|---|
| `POSTGRES_USER` | `mango` | PostgreSQL แบบฝังตัว, Docker `postgres` |
| `POSTGRES_PASSWORD` | สร้างอัตโนมัติ | PostgreSQL แบบฝังตัว, Docker `postgres` |
| `POSTGRES_DB` | `mangovpn` | PostgreSQL แบบฝังตัว, Docker `postgres` |
| `POSTGRES_PORT` | `15432` (พอร์ต Host สำหรับ `5432` ของคอนเทนเนอร์) | Compose |
| `DATABASE_URL` | `postgresql://mango:<password>@localhost:15432/mangovpn?schema=public` | Prisma, API ที่รันบน Host ถ้าใช้ `.env` ให้ปล่อยไว้ไม่ตั้งค่าในเทอร์มินัลที่รัน `dev:api` |
| `JWT_SECRET`, `REFRESH_SECRET` | สร้างอัตโนมัติ ยาวอย่างน้อย 32 ตัวอักษร | API |
| `TOTP_ENCRYPTION_KEY` | สร้างอัตโนมัติ เลขฐานสิบหกพอดี 64 ตัว | API |
| `DAEMON_SHARED_SECRET` | สร้างอัตโนมัติ ยาวอย่างน้อย 32 ตัวอักษร | API, gateway daemon, mock daemon |
| `NODE_ENV`, `PORT`, `API_PORT` | พอร์ต API `4000` | API |
| `CORS_ORIGIN` | `http://localhost:3000` | API |

### การ Seed (ตั้งค่าต่อคำสั่ง แล้วค่อยยกเลิก)

| ตัวแปร | วัตถุประสงค์ |
|---|---|
| `SEED_ADMIN_USERNAME` | ชื่อผู้ใช้ของบัญชี ADMIN คนแรก (`admin` ในคู่มือนี้) |
| `SEED_ADMIN_PASSWORD` | รหัสผ่าน อย่างน้อย 12 ตัวอักษร จะไม่ถูกแสดงออกมา |
| `SEED_ADMIN_EMAIL` | ไม่บังคับ ค่าเริ่มต้นคือ `<username>@mangovpn.local` |

### Gateway และ WireGuard

| ตัวแปร | ค่าเริ่มต้นหรือตัวอย่าง | ถูกใช้โดย |
|---|---|---|
| `WG_INTERFACE` | `wg0` | Gateway |
| `WG_LISTEN_PORT` | `51820` (UDP) | Gateway |
| `WG_GATEWAY_CIDR` | `10.13.13.1/24` | Gateway |
| `WG_DNS` | `1.1.1.1` | คอนฟิกฝั่งไคลเอนต์ |
| `WG_SERVER_ENDPOINT` | `127.0.0.1:51820` | API (ส่งให้ Agent) |
| `WG_PRIVATE_KEY` | สร้างอัตโนมัติ | เฉพาะ Gateway เก็บเป็นความลับ |
| `WG_SERVER_PUBLIC_KEY` | สร้างอัตโนมัติ | API และ Agent |
| `VPN_DAEMON_URL` | `http://127.0.0.1:50051` (API ที่รันบน Host) | API |

### พอร์ทัล

| ตัวแปร | ค่าเริ่มต้น | ถูกใช้โดย |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | พอร์ทัล |
| `VITE_AGENT_URL` | `http://127.0.0.1:47821` | พอร์ทัล |
| `PORTAL_PORT` | `3000` | พอร์ต Host ของพอร์ทัลใน Compose |

### Agent บนเครื่อง

ตัวแปรเหล่านี้ถูกอ่านโดย Go agent (`Sobree/agent-windows`) และในบางกรณีโดย `scripts/mock-agent.js` ตามที่ระบุ

| ตัวแปร | ตัวอย่าง | วัตถุประสงค์ |
|---|---|---|
| `AGENT_LISTEN_ADDR` | `127.0.0.1:47821` | Address แบบ Loopback ที่ Agent รับฟัง |
| `AGENT_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,http://localhost:3090,http://127.0.0.1:3090` | Origin ของเบราว์เซอร์ที่คั่นด้วยคอมมา ห้ามใช้ Wildcard |
| `AGENT_PAIRING_TOKEN` | ข้อความส่วนตัวใดก็ได้ | โทเคนจับคู่ หากไม่ตั้งค่า Go agent จะสร้างให้ตอนเริ่มทำงาน |
| `API_URL` | `http://localhost:4000` | Control Plane API ที่ Agent เรียกใช้ |
| `AGENT_DEVICE_FINGERPRINT` | `mock-device-02` | แทนที่ตัวตนอุปกรณ์ Mock จะเพิ่ม `-<username>` เมื่อพอร์ทัลส่ง dev-user hint |
| `AGENT_PLATFORM` | `windows-x64` หรือ `linux-x64` | แทนที่การตรวจจับ OS อัตโนมัติสำหรับ Agent ทั้งสองแบบ |

### ทดสอบ (ภาคผนวก Track B)

| ตัวแปร | วัตถุประสงค์ |
|---|---|
| `TEST_HARNESS_PORT` | พอร์ตของ Role Harness บน localhost (ค่าเริ่มต้น `3090`) ดู[บทที่ 06](06-appendix-local-docker-smoke-test.md) |

---

## การปิดระบบอย่างถูกต้อง

หยุดส่วนต่างๆ ตามลำดับนี้: โปรเซสที่ทำงานอยู่ด้านหน้าก่อน จากนั้นคอนเทนเนอร์หรือ Stack บนคลาวด์ กด Ctrl+C ในแต่ละเทอร์มินัลเพื่อหยุดโปรเซสนั้น

### Track A

1. ในทุกเทอร์มินัลที่รัน `npm run mock:agent`, `npm run mock:daemon`, `npm run dev:api` หรือ `npm run dev:portal` ให้กด **Ctrl+C** หนึ่งครั้ง
2. ในเทอร์มินัลที่รัน `npm run db:start` ให้กด **Ctrl+C** เป็นลำดับสุดท้าย ซึ่งจะหยุด PostgreSQL แบบฝังตัว
3. รัน `npm run db:reset-local` **เฉพาะเมื่อ**คุณต้องการลบข้อมูลในเครื่องทั้งหมด คำสั่งจะลบ `.local/postgres` จึงควรรันหลังจาก PostgreSQL หยุดแล้วเท่านั้น

**สิ่งที่ควรเห็น:** โปรเซสแต่ละตัวหยุดและ prompt กลับมา Track A ไม่มีบริการ Docker ที่ต้องหยุด

### Track B (GNS3)

ทำตามขั้นตอนการปิดระบบใน[บทที่ 02](02-track-b-gns3-mock-cloud.md) โดยทั่วไปให้คลิก **Disconnect** ในพอร์ทัลก่อนหยุด Go agent เพื่อให้ API และ Gateway ลบ Peer ออกอย่างถูกต้อง

### Track C1 (VM คลาวด์เครื่องเดียว)

จากรากของโปรเจกต์บน VM ให้หยุดและลบคอนเทนเนอร์ โดยคงฐานข้อมูล Volume ไว้:

```bash
docker compose -f deploy/cloud-vm/docker-compose.cloud.yml --env-file .env.cloud down
```

หากคุณเริ่ม overlay `deploy/cloud-vm/docker-compose.cloud-targets.yml` ให้เพิ่ม `-f deploy/cloud-vm/docker-compose.cloud-targets.yml` ด้วย อย่าเพิ่ม `-v` เว้นแต่คุณต้องการลบ Volume ของ PostgreSQL อย่างตั้งใจ

**สิ่งที่ควรเห็น:** Compose รายงานว่าคอนเทนเนอร์หยุดและถูกลบแล้ว Named volume ของ PostgreSQL ยังคงอยู่

### Track C2 (สแต็ก AWS แบบ Managed)

ลบ CloudFormation Stack ก่อน แล้วจึงลบ ECR repository ที่ถูกเก็บไว้ ตามที่ระบุใน [`deploy/aws-managed/README.md`](../../../deploy/aws-managed/README.md#7-teardown):

```bash
aws cloudformation delete-stack --stack-name mango-vpn-managed
aws cloudformation wait stack-delete-complete --stack-name mango-vpn-managed
```

RDS instance ที่มีสถานะ, ECR repository และ CloudWatch log group ใช้ `DeletionPolicy: Retain` หรือ `Snapshot` จึงยังคงอยู่หลังลบ Stack ให้ลบเฉพาะเมื่อคุณตรวจสอบแล้วว่าไม่ต้องการข้อมูลเหล่านั้นอีก README ระบุคำสั่ง `aws ecr delete-repository --force` สำหรับ repository ที่ถูกเก็บไว้

**สิ่งที่ควรเห็น:** Stack ไปถึงสถานะ `DELETE_COMPLETE` ทรัพยากรที่ถูกเก็บไว้ยังคงอยู่จนกว่าคุณจะลบเอง

### ภาคผนวก: Docker Smoke Test ในเครื่อง

หยุดสแต็ก Docker ด้วยสคริปต์ที่ตรงกัน อย่าใช้ `docker compose down` ธรรมดากับสแต็ก test-target เพราะคำสั่งนั้นไม่รวม `docker-compose.test-targets.yml`:

```bash
npm run docker:test-targets:down
```

สำหรับสแต็กปกติ ให้รัน `docker compose down` จากรากของโปรเจกต์ Named volume จะถูกเก็บไว้ อย่ารัน `docker compose down -v` เว้นแต่คุณตั้งใจจะลบข้อมูลฐานข้อมูลที่จัดเก็บไว้

**สิ่งที่ควรเห็น:** Compose ลบคอนเทนเนอร์ออก Named volume ยังคงอยู่

---

**กลับไป:** [สารบัญคู่มือ](../../../TUTORIAL.th.md) · **เริ่มใหม่:** [00 ภาพรวมและการเตรียมระบบ](00-overview-and-setup.md)

> 🏠 [สารบัญคู่มือ](../../../TUTORIAL.th.md) › [00 ภาพรวมและการเตรียมระบบ](00-overview-and-setup.md) › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 การทดสอบ](04-testing-playbook.md) · **05 การแก้ไขปัญหา** · [06 ภาคผนวก](06-appendix-local-docker-smoke-test.md)
