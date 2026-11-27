#!/usr/bin/env python3
"""Provision the two MANGO VPN GNS3 labs using only the Python stdlib."""
from __future__ import annotations

import argparse
import base64
import json
import os
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / "deploy" / "gns3" / ".local"
SECRETS_FILE = LOCAL / "lab-secrets.json"
STOPPED_BY_DEFAULT = {"client-win11", "kali-wan", "win2025-admin", "win2022-staff"}

PROMETHEUS_YML = """global:
  scrape_interval: 15s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['10.50.30.30:9090']
  - job_name: loki
    static_configs:
      - targets: ['10.50.30.31:3100']
"""

GRAFANA_DATASOURCES_YML = """apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://10.50.30.30:9090
    isDefault: true
  - name: Loki
    type: loki
    access: proxy
    url: http://10.50.30.31:3100
"""
LOCALSTACK_IMAGE = "localstack/localstack:3.8.1"


class GNS3:
    def __init__(self, url: str, username: str, password: str):
        self.base = url.rstrip("/")
        self.token = ""
        self.token = self._request(
            "POST",
            "/access/users/authenticate",
            {"username": username, "password": password},
            auth=False,
        )["access_token"]

    def _request(self, method: str, path: str, body=None, raw: bytes | None = None, auth: bool = True, query: str = ""):
        data = raw if raw is not None else (json.dumps(body).encode("utf-8") if body is not None else None)
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if raw is not None:
            headers["Content-Type"] = "application/octet-stream"
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(self.base + path + query, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                payload = response.read()
                return json.loads(payload) if payload else None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            raise RuntimeError(f"GNS3 {method} {path}{query} failed ({exc.code}): {detail}") from exc

    def get(self, path: str, query: str = ""):
        return self._request("GET", path, query=query)

    def post(self, path: str, body=None, raw: bytes | None = None, query: str = ""):
        return self._request("POST", path, body=body, raw=raw, query=query)

    def put(self, path: str, body, query: str = ""):
        return self._request("PUT", path, body=body, query=query)

    def delete(self, path: str):
        return self._request("DELETE", path)


def controller_config():
    url = os.getenv("GNS3_URL")
    user = os.getenv("GNS3_USERNAME")
    password = os.getenv("GNS3_PASSWORD")
    if url and user and password:
        return url, user, password
    config = Path.home() / ".config/GNS3/3.1/gns3_gui.conf"
    if not config.exists():
        raise RuntimeError("Set GNS3_URL, GNS3_USERNAME and GNS3_PASSWORD or provide the GNS3 GUI config")
    try:
        data = json.loads(config.read_text())
        controller = data["Controller"]
        return (
            url or f"http://{controller.get('host', '127.0.0.1')}:{controller.get('port', 3080)}/v3",
            user or controller["username"],
            password or controller["password"],
        )
    except (ValueError, KeyError) as exc:
        raise RuntimeError("GNS3 GUI config has no usable Controller fields") from exc


def wg_keys():
    try:
        private = subprocess.check_output(["wg", "genkey"], text=True).strip()
        public = subprocess.run(["wg", "pubkey"], input=private + "\n", text=True, capture_output=True, check=True).stdout.strip()
        return private, public
    except (FileNotFoundError, subprocess.CalledProcessError):
        with tempfile.TemporaryDirectory() as directory:
            key = Path(directory) / "key.der"
            subprocess.run(["openssl", "genpkey", "-algorithm", "X25519", "-outform", "DER", "-out", str(key)], check=True, capture_output=True)
            private_raw = key.read_bytes()[-32:]
            public_der = subprocess.check_output(["openssl", "pkey", "-in", str(key), "-inform", "DER", "-pubout", "-outform", "DER"])
            public_raw = public_der[-32:]
        return base64.b64encode(private_raw).decode(), base64.b64encode(public_raw).decode()


def load_secrets():
    LOCAL.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(LOCAL, 0o700)
    data = json.loads(SECRETS_FILE.read_text()) if SECRETS_FILE.exists() else {}
    wg_private, wg_public = (data["wg_private_key"], data["wg_public_key"]) if "wg_private_key" in data and "wg_public_key" in data else wg_keys()
    defaults = {
        "postgres_password": secrets.token_urlsafe(24),
        "jwt_secret": secrets.token_urlsafe(48),
        "refresh_secret": secrets.token_urlsafe(48),
        "daemon_shared_secret": secrets.token_hex(24),
        "totp_encryption_key": secrets.token_hex(32),
        "fortigate_api_token": secrets.token_urlsafe(32),
        "cisco_api_token": secrets.token_urlsafe(32),
        "openbao_root_token": secrets.token_urlsafe(32),
        "rustfs_access_key": secrets.token_urlsafe(18),
        "rustfs_secret_key": secrets.token_urlsafe(32),
        "grafana_admin_password": secrets.token_urlsafe(20),
        "wg_private_key": wg_private,
        "wg_public_key": wg_public,
    }
    changed = False
    for k, v in defaults.items():
        if k not in data:
            data[k] = v
            changed = True
    if changed or not SECRETS_FILE.exists():
        SECRETS_FILE.write_text(json.dumps(data, indent=2) + "\n")
    os.chmod(SECRETS_FILE, 0o600)
    return data


def write_envs(s):
    def put(name, values):
        path = LOCAL / name
        path.write_text("\n".join(f"{k}={v}" for k, v in values.items()) + "\n")
        os.chmod(path, 0o600)

    put("c1.env", {
        "POSTGRES_USER": "mango",
        "POSTGRES_PASSWORD": s["postgres_password"],
        "POSTGRES_DB": "mangovpn",
        "POSTGRES_PORT": "15432",
        "DATABASE_URL": f"postgresql://mango:{s['postgres_password']}@localhost:15432/mangovpn?schema=public",
        "NODE_ENV": "production",
        "PORT": "4000",
        "API_PORT": "4000",
        "JWT_SECRET": s["jwt_secret"],
        "REFRESH_SECRET": s["refresh_secret"],
        "TOTP_ENCRYPTION_KEY": s["totp_encryption_key"],
        "DAEMON_SHARED_SECRET": s["daemon_shared_secret"],
        "WG_INTERFACE": "wg0",
        "WG_LISTEN_PORT": "51820",
        "WG_GATEWAY_CIDR": "10.13.13.1/24",
        "WG_PRIVATE_KEY": s["wg_private_key"],
        "WG_SERVER_PUBLIC_KEY": s["wg_public_key"],
        "WG_SERVER_ENDPOINT": "203.0.113.10:51820",
        "WG_DNS": "203.0.113.53",
        "CORS_ORIGIN": "https://vpn.mango.lab",
        "VITE_API_URL": "https://vpn.mango.lab",
        "VITE_AGENT_URL": "http://127.0.0.1:47821",
        "FORTIGATE_API_URL": "http://172.28.0.21:8443",
        "FORTIGATE_API_TOKEN": s["fortigate_api_token"],
        "CISCO_API_URL": "http://172.28.0.22:8443",
        "CISCO_API_TOKEN": s["cisco_api_token"],
    })
    put("c2-gateway.env", {
        "DAEMON_SHARED_SECRET": s["daemon_shared_secret"],
        "WG_PRIVATE_KEY": s["wg_private_key"],
        "WG_INTERFACE": "wg0",
        "WG_LISTEN_PORT": "51820",
        "WG_GATEWAY_CIDR": "10.13.13.1/24",
    })


DOCKER = {
    "Mango WAN Router": ("mango-gns3-router:local", "router", 2),
    "Mango VPC Router": ("mango-gns3-router:local", "router", 4),
    "Mango AWS IGW Router": ("mango-gns3-router:local", "router", 5),
    "Mango Target Node": ("mango-gns3-target:local", "guest", 1),
    "Mango Test Harness": ("mango-gns3-harness:local", "guest", 1),
    "Mango CoreDNS": ("mango-gns3-coredns:local", "guest", 1),
    "Mango WAN Probe": ("mango-gns3-probe:local", "guest", 1),
    "Mango Appliance Sim": ("mango-gns3-appliance-sim:local", "guest", 2),
    "Mango ALB Caddy": ("mango-gns3-alb-caddy:local", "guest", 1),
    "Mango ECS API": ("mango-gns3-ecs-api:local", "guest", 1),
    "Mango ECS Portal": ("mango-gns3-portal:local", "guest", 1),
    "Mango OpenBao": ("mango-gns3-openbao:local", "guest", 1),
    "Mango Prometheus": ("mango-gns3-prometheus:local", "guest", 1),
    "Mango Loki": ("mango-gns3-loki:local", "guest", 1),
    "Mango Grafana": ("mango-gns3-grafana:local", "guest", 1),
    "Mango RustFS": ("mango-gns3-rustfs:local", "guest", 1),
}
QEMU = {
    "Mango Ubuntu Control (C1)": (4096, 2, 3, "ubuntu-control-c1-seed.iso"),
    "Mango EC2 WG Gateway (C2)": (2048, 2, 2, "ec2-wg-gateway-c2-seed.iso"),
}


def upsert_templates(api: GNS3):
    existing = {x["name"]: x for x in api.get("/templates")}
    result = {}
    for name, (image, category, adapters) in DOCKER.items():
        payload = {
            "name": name,
            "template_type": "docker",
            "category": category,
            "compute_id": "local",
            "image": image,
            "adapters": adapters,
            "start_command": "",
            "environment": "",
            "console_type": "telnet",
            "aux_type": "none",
            "extra_configs": [],
        }
        result[name] = api.put(f"/templates/{existing[name]['template_id']}", payload) if name in existing else api.post("/templates", payload)
    for name, (ram, cpus, adapters, seed) in QEMU.items():
        payload = {
            "name": name,
            "template_type": "qemu",
            "category": "guest",
            "compute_id": "local",
            "qemu_path": "/usr/bin/qemu-system-x86_64",
            "platform": "x86_64",
            "linked_clone": True,
            "ram": ram,
            "cpus": cpus,
            "maxcpus": 4,
            "adapters": adapters,
            "adapter_type": "virtio-net-pci",
            "port_name_format": "eth{0}",
            "console_type": "telnet",
            "hda_disk_image": "mango-ubuntu-24.04-25g.qcow2",
            "hda_disk_interface": "virtio",
            "cdrom_image": seed,
            "cdrom_interface": "ide",
            "options": "-nographic -global virtio-net-pci.csum=off -global virtio-net-pci.gso=off -global virtio-net-pci.guest_csum=off",
        }
        result[name] = api.put(f"/templates/{existing[name]['template_id']}", payload) if name in existing else api.post("/templates", payload)
    return result


def pin_localstack_template(api: GNS3):
    """Use the community LocalStack release instead of the moving latest tag."""
    existing = next((x for x in api.get("/templates") if x["name"] == "AWS Cloud Emulator (LocalStack)"), None)
    if not existing:
        return
    symbol = existing.get("symbol")
    payload = {
        "name": existing["name"],
        "template_type": "docker",
        "category": existing.get("category", "guest"),
        "compute_id": existing.get("compute_id", "local"),
        "image": LOCALSTACK_IMAGE,
        "symbol": symbol if symbol not in (None, "", ":/symbols/docker_guest.svg") else "custom_localstack.svg",
        "default_name_format": existing.get("default_name_format") or "LocalStack-{0}",
        "adapters": existing.get("adapters", 1),
        "start_command": existing.get("start_command", ""),
        "environment": existing.get("environment", ""),
        "console_type": existing.get("console_type", "telnet"),
        "aux_type": existing.get("aux_type", "none"),
        "extra_configs": existing.get("extra_configs", []),
    }
    api.put(f"/templates/{existing['template_id']}", payload)


def interfaces(address: str, mask: str = "255.255.255.0", gateway: str | None = None, routes=()):
    lines = ["auto eth0", "iface eth0 inet static", f"    address {address}", f"    netmask {mask}"]
    if gateway:
        lines.append(f"    gateway {gateway}")
    for cidr, via in routes:
        lines.append(f"    up ip route replace {cidr} via {via} || true")
    return "\n".join(lines) + "\n"


def node_specs(lab: str, s: dict):
    specs = []

    def add(name, template, x, y, kind="docker", env="", address=None, routes=(), extra=None, command=None, gateway=None, network_text=None):
        specs.append({
            "name": name,
            "template": template,
            "kind": kind,
            "x": x,
            "y": y,
            "environment": env,
            "address": address,
            "gateway": gateway,
            "routes": routes,
            "network_text": network_text,
            "extra_configs": extra or [],
            "start_command": command,
        })

    # Shared Client LAN (192.168.50.0/24) + WAN Router + Public WAN core
    add("host-bridge", "Cloud", -700, -140, kind="cloud")
    add("client-win11", "Windows 11 Edu/Pro (Ready VM)", -700, 0, kind="qemu")
    add("test-harness", "Mango Test Harness", -700, 140, address="192.168.50.20", gateway="192.168.50.1")
    add("sw-client-lan", "Ethernet switch", -500, 0, kind="switch")
    add("wan-router", "Mango WAN Router", -300, 0, env="ROUTER_ROLE=wan")
    add("sw-public-wan", "Ethernet switch", -100, 0, kind="switch")
    add(
        "dns-wan" if lab == "c1" else "dns-route53",
        "Mango CoreDNS",
        -100,
        -220,
        address="203.0.113.53",
        gateway="203.0.113.1",
        command=f"-conf /etc/coredns/Corefile.{lab}",
    )
    add("probe-wan", "Mango WAN Probe", 60, -220, address="203.0.113.50", gateway="203.0.113.1")

    if lab == "c1":
        add("kali-wan", "Security & Pentest Desktop (Kali Linux)", -240, -220, kind="qemu")
        add("ubuntu-control", "Mango Ubuntu Control (C1)", 140, 0, kind="qemu")
        add("oob-nat", "NAT", 140, -140, kind="nat")

        sim_fortigate_net = (
            interfaces("203.0.113.21", gateway="203.0.113.1")
            + "\nauto eth1\niface eth1 inet static\n    address 172.28.0.21\n    netmask 255.255.255.0\n"
        )
        sim_cisco_net = (
            interfaces("203.0.113.22", gateway="203.0.113.1")
            + "\nauto eth1\niface eth1 inet static\n    address 172.28.0.22\n    netmask 255.255.255.0\n"
        )
        add(
            "sim-fortigate",
            "Mango Appliance Sim",
            140,
            130,
            env=f"SIM_VENDOR=FORTINET\nSIM_LISTEN=0.0.0.0:8443\nSIM_API_TOKEN={s['fortigate_api_token']}",
            network_text=sim_fortigate_net,
        )
        add(
            "sim-cisco",
            "Mango Appliance Sim",
            140,
            250,
            env=f"SIM_VENDOR=CISCO\nSIM_LISTEN=0.0.0.0:8443\nSIM_API_TOKEN={s['cisco_api_token']}",
            network_text=sim_cisco_net,
        )
        add("sw-transit", "Ethernet switch", 360, 0, kind="switch")
        add("vpc-router", "Mango VPC Router", 540, 0, env="ROUTER_ROLE=vpc")

        add("sw-admin-zone", "Ethernet switch", 740, -240, kind="switch")
        add("target-admin", "Mango Target Node", 960, -330, env="ZONE=admin")
        add("kuma-admin", "Uptime & Synthetics (Uptime Kuma)", 960, -240, address="10.99.0.20", gateway="10.99.0.1", routes=(("10.13.13.0/24", "10.99.0.1"),))
        add(
            "openbao-admin",
            "Mango OpenBao",
            960,
            -150,
            env=f"BAO_DEV_ROOT_TOKEN_ID={s['openbao_root_token']}",
            address="10.99.0.25",
            gateway="10.99.0.1",
            routes=(("10.13.13.0/24", "10.99.0.1"),),
            command="server -dev -dev-listen-address=0.0.0.0:8200",
        )
        add("win2025-admin", "Windows Server 2025 (Ready VM)", 1140, -240, kind="qemu")

        add("sw-staff-zone", "Ethernet switch", 740, 20, kind="switch")
        add("target-staff", "Mango Target Node", 960, -30, env="ZONE=staff")
        add(
            "gitea-staff",
            "Git & CI/CD Platform (Gitea)",
            960,
            60,
            env="GITEA__server__HTTP_PORT=80\nGITEA__server__ROOT_URL=http://gitea.staff.mango.lab/",
            address="10.20.0.20",
            gateway="10.20.0.1",
            routes=(("10.13.13.0/24", "10.20.0.1"),),
        )
        add("win2022-staff", "Windows Server 2022 Uni (Ready VM)", 1140, 20, kind="qemu")

        add("sw-client-zone", "Ethernet switch", 740, 260, kind="switch")
        add("target-client", "Mango Target Node", 960, 260, env="ZONE=client")
    else:
        add("aws-igw-router", "Mango AWS IGW Router", 100, 0, env="ROUTER_ROLE=aws-igw")
        add("sw-vpc-public", "Ethernet switch", 310, -220, kind="switch")
        add("alb-ingress", "Mango ALB Caddy", 500, -290, address="10.50.1.10", gateway="10.50.1.1")
        add("ec2-wg-gateway", "Mango EC2 WG Gateway (C2)", 500, -160, kind="qemu")
        add("oob-nat", "NAT", 680, -160, kind="nat")

        add("sw-vpc-private", "Ethernet switch", 310, 0, kind="switch")
        add(
            "rds-postgres",
            "PostgreSQL 16",
            520,
            -55,
            env=f"POSTGRES_USER=mango\nPOSTGRES_PASSWORD={s['postgres_password']}\nPOSTGRES_DB=mangovpn\nPGDATA=/var/lib/postgresql/data/pgdata",
            address="10.50.10.20",
            gateway="10.50.10.1",
        )
        add(
            "ecs-api",
            "Mango ECS API",
            520,
            35,
            env=(
                "NODE_ENV=production\nPORT=4000\n"
                f"DATABASE_URL=postgresql://mango:{s['postgres_password']}@10.50.10.20:5432/mangovpn?schema=public\n"
                f"JWT_SECRET={s['jwt_secret']}\nREFRESH_SECRET={s['refresh_secret']}\n"
                f"TOTP_ENCRYPTION_KEY={s['totp_encryption_key']}\nDAEMON_SHARED_SECRET={s['daemon_shared_secret']}\n"
                "VPN_DAEMON_URL=http://10.50.1.20:50051\n"
                f"WG_SERVER_PUBLIC_KEY={s['wg_public_key']}\n"
                "WG_SERVER_ENDPOINT=203.0.113.20:51820\nWG_DNS=203.0.113.53\nCORS_ORIGIN=https://vpn.mango.lab"
            ),
            address="10.50.10.11",
            gateway="10.50.10.1",
        )
        add(
            "ecs-portal",
            "Mango ECS Portal",
            520,
            125,
            env="VITE_API_URL=https://vpn.mango.lab\nVITE_AGENT_URL=http://127.0.0.1:47821",
            address="10.50.10.12",
            gateway="10.50.10.1",
        )

        add("sw-vpc-platform", "Ethernet switch", 310, 290, kind="switch")
        add("aws-localstack", "AWS Cloud Emulator (LocalStack)", 160, 440, address="10.50.30.10", gateway="10.50.30.1")
        add("aws-ecr", "Container Registry (Registry)", 310, 440, address="10.50.30.20", gateway="10.50.30.1")
        add(
            "aws-prometheus",
            "Mango Prometheus",
            460,
            440,
            address="10.50.30.30",
            gateway="10.50.30.1",
            extra=[{"target": "/etc/prometheus/prometheus.yml", "content": PROMETHEUS_YML}],
        )
        add("aws-loki", "Mango Loki", 160, 560, address="10.50.30.31", gateway="10.50.30.1")
        add(
            "aws-grafana",
            "Mango Grafana",
            310,
            560,
            env=f"GF_SECURITY_ADMIN_USER=admin\nGF_SECURITY_ADMIN_PASSWORD={s['grafana_admin_password']}",
            address="10.50.30.32",
            gateway="10.50.30.1",
            extra=[{"target": "/etc/grafana/provisioning/datasources/datasources.yml", "content": GRAFANA_DATASOURCES_YML}],
        )
        add(
            "aws-rustfs",
            "Mango RustFS",
            460,
            560,
            env=f"RUSTFS_ACCESS_KEY={s['rustfs_access_key']}\nRUSTFS_SECRET_KEY={s['rustfs_secret_key']}",
            address="10.50.30.40",
            gateway="10.50.30.1",
        )

        add("sw-transit", "Ethernet switch", 760, 0, kind="switch")
        add("vpc-router", "Mango VPC Router", 940, 0, env="ROUTER_ROLE=vpc\nENABLE_AWS_VPC_ROUTE=true")
        add("sw-admin-zone", "Ethernet switch", 1120, -140, kind="switch")
        add("sw-staff-zone", "Ethernet switch", 1120, 0, kind="switch")
        add("sw-client-zone", "Ethernet switch", 1120, 140, kind="switch")
        add("target-admin", "Mango Target Node", 1310, -140, env="ZONE=admin")
        add("target-staff", "Mango Target Node", 1310, 0, env="ZONE=staff")
        add("target-client", "Mango Target Node", 1310, 140, env="ZONE=client")
    return specs


def zone_drawings(lab: str):
    if lab == "c1":
        boxes = [
            ("Client LAN (192.168.50.0/24)", "#264653", -770, -210, 360, 440),
            ("Mock Public WAN (203.0.113.0/24)", "#2a9d8f", -320, -290, 320, 400),
            ("Control Plane & Appliance Sims (172.28.0.0/24)", "#e76f51", 40, -210, 390, 560),
            ("Admin Zone (10.99.0.0/24)", "#b5179e", 670, -390, 580, 320),
            ("Staff Zone (10.20.0.0/16)", "#4361ee", 670, -65, 580, 225),
            ("Client Zone (10.30.0.0/24)", "#4cc9f0", 670, 185, 420, 165),
        ]
    else:
        boxes = [
            ("Client LAN (192.168.50.0/24)", "#264653", -770, -210, 360, 440),
            ("Mock Internet (203.0.113.0/24)", "#2a9d8f", -220, -290, 380, 380),
            ("AWS Public Subnet (10.50.1.0/24)", "#f4a261", 230, -360, 530, 270),
            ("AWS Private App/RDS Subnet (10.50.10.0/24)", "#e76f51", 230, -85, 410, 285),
            ("AWS Platform Endpoints (10.50.30.0/24)", "#6d597a", 90, 225, 490, 420),
            ("Private Target Zones (10.99 / 10.20 / 10.30)", "#4361ee", 870, -210, 540, 450),
        ]
    return [
        (
            x,
            y,
            f'<svg width="{w}" height="{h}"><rect x="2" y="2" width="{w-4}" height="{h-4}" rx="12" fill="{color}" fill-opacity="0.06" stroke="{color}" stroke-width="2" stroke-dasharray="8 4"/><text x="16" y="28" fill="{color}" font-family="sans-serif" font-size="16" font-weight="bold">{title}</text></svg>',
        )
        for title, color, x, y, w, h in boxes
    ]


def close_other_mango_projects(api: GNS3, project_name: str):
    """Ensure only the requested Mango lab can own shared host networking."""
    for project in api.get("/projects"):
        other_name = project.get("name", "")
        if not other_name.startswith("Mango-VPN-") or other_name == project_name:
            continue
        if project.get("status") != "opened":
            continue
        try:
            api.post(f"/projects/{project['project_id']}/close")
            print(f"Closed conflicting project {other_name} ({project['project_id']})")
        except RuntimeError:
            # The controller can race with an already-closing project.
            pass


def provision_lab(api: GNS3, templates: dict, all_templates: dict, lab: str, recreate: bool, start_core: bool, secrets_data: dict):
    project_name = "Mango-VPN-TrackB-C1" if lab == "c1" else "Mango-VPN-AWS-C2"
    projects = {p["name"]: p for p in api.get("/projects")}
    if recreate or start_core:
        close_other_mango_projects(api, project_name)
    if project_name in projects and recreate:
        pid = projects[project_name]["project_id"]
        try:
            api.post(f"/projects/{pid}/close")
        except RuntimeError:
            pass
        api.delete(f"/projects/{pid}")
    project = (
        api.post("/projects", {"name": project_name, "scene_width": 2600, "scene_height": 1600})
        if project_name not in projects or recreate
        else projects[project_name]
    )
    pid = project["project_id"]
    api.post(f"/projects/{pid}/open")

    if project_name in projects and not recreate:
        nodes = {n["name"]: n for n in api.get(f"/projects/{pid}/nodes")}
        if start_core:
            for name, node in nodes.items():
                if name in STOPPED_BY_DEFAULT:
                    continue
                if node.get("status") in (2, "started") or node.get("status_label") == "started":
                    continue
                api.post(f"/projects/{pid}/nodes/{node['node_id']}/start", query="?wait=true")
                time.sleep(0.2)
            print(f"Opened existing {project_name} ({pid}) and started core nodes ({len(nodes)} nodes)")
        else:
            api.post(f"/projects/{pid}/close")
            print(f"Existing {project_name} ({pid}) unchanged and closed ({len(nodes)} nodes)")
        return

    template_ids = {**all_templates, **{k: v["template_id"] for k, v in templates.items()}}
    nodes = {}
    for spec in node_specs(lab, secrets_data):
        node = api.post(
            f"/projects/{pid}/templates/{template_ids[spec['template']]}",
            {"x": spec["x"], "y": spec["y"], "name": spec["name"], "compute_id": "local"},
        )
        nodes[spec["name"]] = node

        update_body = {"name": spec["name"], "x": spec["x"], "y": spec["y"], "z": 1}
        if spec["kind"] == "docker":
            props = {}
            if spec["environment"]:
                props["environment"] = spec["environment"]
            if spec["start_command"] is not None:
                props["start_command"] = spec["start_command"]
            if spec["extra_configs"]:
                props["extra_configs"] = spec["extra_configs"]
            if props:
                update_body["properties"] = props
        elif spec["kind"] == "cloud":
            update_body["properties"] = {
                "ports_mapping": [
                    {
                        "name": "virbr-gns3",
                        "port_number": 0,
                        "type": "tap",
                        "interface": "mango-lan0",
                        "bridge": "virbr-gns3",
                    }
                ]
            }
        elif spec["kind"] == "switch":
            update_body["properties"] = {
                "ports_mapping": [{"name": f"Ethernet{i}", "port_number": i, "type": "access", "vlan": 1} for i in range(12)]
            }

        api.put(f"/projects/{pid}/nodes/{node['node_id']}", update_body)

        if spec["network_text"] or spec["address"]:
            mask = "255.255.0.0" if spec["address"] and spec["address"].startswith("10.20.") else "255.255.255.0"
            network_text = spec["network_text"] or interfaces(spec["address"], mask, spec.get("gateway"), spec["routes"])
            api.post(f"/projects/{pid}/nodes/{node['node_id']}/files/etc/network/interfaces", raw=network_text.encode("utf-8"))

    switch_next_port: dict[str, int] = {}

    def link(a: str, aa: int, pa: int, b: str, ab: int, pb: int):
        api.post(
            f"/projects/{pid}/links",
            {
                "nodes": [
                    {"node_id": nodes[a]["node_id"], "adapter_number": aa, "port_number": pa},
                    {"node_id": nodes[b]["node_id"], "adapter_number": ab, "port_number": pb},
                ]
            },
        )

    def link_to_switch(node_name: str, adapter: int, switch_name: str):
        port = switch_next_port.get(switch_name, 0)
        switch_next_port[switch_name] = port + 1
        link(node_name, adapter, 0, switch_name, 0, port)

    # Client LAN & WAN Router
    link_to_switch("host-bridge", 0, "sw-client-lan")
    link_to_switch("client-win11", 0, "sw-client-lan")
    link_to_switch("test-harness", 0, "sw-client-lan")
    link_to_switch("wan-router", 0, "sw-client-lan")
    link_to_switch("wan-router", 1, "sw-public-wan")
    link_to_switch("dns-wan" if lab == "c1" else "dns-route53", 0, "sw-public-wan")
    link_to_switch("probe-wan", 0, "sw-public-wan")

    if lab == "c1":
        link_to_switch("kali-wan", 0, "sw-public-wan")
        link_to_switch("ubuntu-control", 0, "sw-public-wan")
        link_to_switch("sim-fortigate", 0, "sw-public-wan")
        link_to_switch("sim-cisco", 0, "sw-public-wan")

        link_to_switch("ubuntu-control", 1, "sw-transit")
        link("oob-nat", 0, 0, "ubuntu-control", 2, 0)
        link_to_switch("sim-fortigate", 1, "sw-transit")
        link_to_switch("sim-cisco", 1, "sw-transit")
        link_to_switch("vpc-router", 0, "sw-transit")

        for sw, adapter, endpoints in (
            ("sw-admin-zone", 1, ("target-admin", "kuma-admin", "openbao-admin", "win2025-admin")),
            ("sw-staff-zone", 2, ("target-staff", "gitea-staff", "win2022-staff")),
            ("sw-client-zone", 3, ("target-client",)),
        ):
            link_to_switch("vpc-router", adapter, sw)
            for ep in endpoints:
                link_to_switch(ep, 0, sw)
    else:
        link_to_switch("aws-igw-router", 0, "sw-public-wan")
        link_to_switch("aws-igw-router", 1, "sw-vpc-public")
        link_to_switch("aws-igw-router", 2, "sw-vpc-private")
        link_to_switch("aws-igw-router", 3, "sw-vpc-platform")
        link_to_switch("aws-igw-router", 4, "sw-transit")

        link_to_switch("alb-ingress", 0, "sw-vpc-public")
        link_to_switch("ec2-wg-gateway", 0, "sw-vpc-public")
        link("oob-nat", 0, 0, "ec2-wg-gateway", 1, 0)

        for n in ("rds-postgres", "ecs-api", "ecs-portal"):
            link_to_switch(n, 0, "sw-vpc-private")
        for n in ("aws-localstack", "aws-ecr", "aws-prometheus", "aws-loki", "aws-grafana", "aws-rustfs"):
            link_to_switch(n, 0, "sw-vpc-platform")

        link_to_switch("vpc-router", 0, "sw-transit")
        for adapter, sw, target in (
            (1, "sw-admin-zone", "target-admin"),
            (2, "sw-staff-zone", "target-staff"),
            (3, "sw-client-zone", "target-client"),
        ):
            link_to_switch("vpc-router", adapter, sw)
            link_to_switch(target, 0, sw)

    for x, y, svg in zone_drawings(lab):
        api.post(f"/projects/{pid}/drawings", {"x": x, "y": y, "z": 0, "svg": svg})

    if start_core:
        for name, node in nodes.items():
            if name not in STOPPED_BY_DEFAULT:
                api.post(f"/projects/{pid}/nodes/{node['node_id']}/start", query="?wait=true")
                time.sleep(0.2)
    else:
        api.post(f"/projects/{pid}/close")

    print(f"Provisioned {project_name} ({pid}): {len(nodes)} nodes")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lab", choices=("c1", "c2", "all"), required=True)
    parser.add_argument("--recreate", action="store_true")
    parser.add_argument("--start-core", action="store_true")
    args = parser.parse_args()

    url, username, password = controller_config()
    secrets_data = load_secrets()
    write_envs(secrets_data)
    api = GNS3(url, username, password)
    if args.recreate or args.start_core:
        target = {"c1": "Mango-VPN-TrackB-C1", "c2": "Mango-VPN-AWS-C2"}
        for lab in (("c1", "c2") if args.lab == "all" else (args.lab,)):
            close_other_mango_projects(api, target[lab])
    templates = upsert_templates(api)
    pin_localstack_template(api)
    all_templates = {x["name"]: x["template_id"] for x in api.get("/templates")}

    required = {
        "Cloud",
        "Ethernet switch",
        "NAT",
        "Windows 11 Edu/Pro (Ready VM)",
        "Security & Pentest Desktop (Kali Linux)",
        "Windows Server 2025 (Ready VM)",
        "Windows Server 2022 Uni (Ready VM)",
        "Uptime & Synthetics (Uptime Kuma)",
        "Git & CI/CD Platform (Gitea)",
        "PostgreSQL 16",
        "AWS Cloud Emulator (LocalStack)",
        "Container Registry (Registry)",
    }
    missing = sorted(required - all_templates.keys())
    if missing:
        raise RuntimeError(f"GNS3 templates missing: {', '.join(missing)}")

    for lab in (("c1", "c2") if args.lab == "all" else (args.lab,)):
        provision_lab(api, templates, all_templates, lab, args.recreate, args.start_core, secrets_data)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
