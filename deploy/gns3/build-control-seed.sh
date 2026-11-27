#!/usr/bin/env bash
set -euo pipefail

for tool in xorriso qemu-img ssh-keygen; do
  command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }
done

QEMU_DIR="${HOME}/GNS3/images/QEMU"
SOURCE="${QEMU_DIR}/ubuntu-24.04-cloudimg-amd64.qcow2"
DISK="${QEMU_DIR}/mango-ubuntu-24.04-25g.qcow2"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.local"
KEY="${LOCAL_DIR}/lab_ed25519"
[[ -f "$SOURCE" ]] || { echo "Missing $SOURCE" >&2; exit 1; }

mkdir -p "$LOCAL_DIR" "$QEMU_DIR"
chmod 700 "$LOCAL_DIR"
if [[ ! -f "$KEY" ]]; then
  ssh-keygen -t ed25519 -N '' -f "$KEY" -C mango-gns3-lab >/dev/null
  chmod 600 "$KEY"
fi
if [[ ! -f "$DISK" ]]; then
  cp --reflink=auto "$SOURCE" "$DISK"
  qemu-img resize "$DISK" 25G
fi

PUB="$(cat "${KEY}.pub")"

make_seed() {
  local iso="$1" hostname="$2" bootcmd_netplan="$3" extra_packages="$4" extra_files="${5:-}"
  local work
  work="$(mktemp -d)"

  cat >"$work/user-data" <<EOF
#cloud-config
hostname: ${hostname}
manage_etc_hosts: true
users:
  - name: lab
    groups: [sudo, docker]
    sudo: ALL=(ALL) NOPASSWD:ALL
    lock_passwd: true
    shell: /bin/bash
    ssh_authorized_keys:
      - ${PUB}
ssh_pwauth: false
bootcmd:
  - |
$(printf '%s\n' "$bootcmd_netplan" | sed 's/^/    /')
package_update: true
packages:
  - ca-certificates
  - curl
  - jq
  - wireguard-tools
  - nftables
  - tcpdump
  - docker.io
  - docker-compose-v2
${extra_packages}
write_files:
  - path: /etc/sysctl.d/99-mango-vpn.conf
    content: |
      net.ipv4.ip_forward=1
      net.ipv4.conf.all.src_valid_mark=1
  - path: /usr/local/bin/mango-apply-vpn-return-route.sh
    permissions: '0755'
    content: |
      #!/bin/sh
      set -eu
      if ip route show 172.29.0.0/24 | grep -q .; then
        ip route replace 10.13.13.0/24 via 172.29.0.10
      fi
  - path: /etc/systemd/system/mango-vpn-return-route.service
    content: |
      [Unit]
      Description=MANGO VPN Docker bridge return route
      [Service]
      Type=oneshot
      ExecStart=/usr/local/bin/mango-apply-vpn-return-route.sh
  - path: /etc/systemd/system/mango-vpn-return-route.timer
    content: |
      [Unit]
      Description=Refresh MANGO VPN Docker bridge return route
      [Timer]
      OnBootSec=10s
      OnUnitActiveSec=10s
      [Install]
      WantedBy=timers.target
${extra_files}
runcmd:
  - [sysctl, --system]
  - [systemctl, daemon-reload]
  - [systemctl, enable, --now, mango-vpn-return-route.timer]
EOF

  printf '%s\n' "instance-id: ${hostname}" "local-hostname: ${hostname}" >"$work/meta-data"
  cat >"$work/network-config" <<'EOF'
version: 2
ethernets:
  all-nics:
    match:
      name: "e*"
    dhcp4: true
    optional: true
EOF

  xorriso -as mkisofs -output "$QEMU_DIR/$iso" -volid cidata -joliet -rock \
    "$work/user-data" "$work/meta-data" "$work/network-config" >/dev/null
  rm -rf "$work"
}

C1_BOOTCMD='set -eu
nics=$(for d in /sys/class/net/*; do
  [ -e "$d/device" ] || continue
  name=${d##*/}
  bus=$(basename "$(readlink -f "$d/device")")
  printf "%s %s\n" "$bus" "$name"
done | sort | awk "{print \$2}")
set -- $nics
nic0=${1:-eth0}
nic1=${2:-eth1}
nic2=${3:-eth2}
cat >/etc/netplan/60-mango-lab.yaml <<NET
network:
  version: 2
  ethernets:
    ${nic0}:
      addresses: [203.0.113.10/24]
      optional: true
      routes:
        - to: 192.168.50.0/24
          via: 203.0.113.1
    ${nic1}:
      addresses: [172.28.0.2/24]
      optional: true
      routes:
        - to: 10.99.0.0/24
          via: 172.28.0.1
        - to: 10.20.0.0/16
          via: 172.28.0.1
        - to: 10.30.0.0/24
          via: 172.28.0.1
    ${nic2}:
      dhcp4: true
      optional: true
      dhcp4-overrides:
        route-metric: 200
NET
rm -f /etc/netplan/50-cloud-init.yaml
chmod 600 /etc/netplan/60-mango-lab.yaml
netplan apply || true'

C1_PKGS='  - git
  - nodejs
  - npm'

make_seed ubuntu-control-c1-seed.iso ubuntu-control "$C1_BOOTCMD" "$C1_PKGS"

C2_BOOTCMD='set -eu
nics=$(for d in /sys/class/net/*; do
  [ -e "$d/device" ] || continue
  name=${d##*/}
  bus=$(basename "$(readlink -f "$d/device")")
  printf "%s %s\n" "$bus" "$name"
done | sort | awk "{print \$2}")
set -- $nics
nic0=${1:-eth0}
nic1=${2:-eth1}
cat >/etc/netplan/60-mango-lab.yaml <<NET
network:
  version: 2
  ethernets:
    ${nic0}:
      addresses: [10.50.1.20/24]
      optional: true
      routes:
        - to: 10.50.0.0/16
          via: 10.50.1.1
        - to: 10.99.0.0/24
          via: 10.50.1.1
        - to: 10.20.0.0/16
          via: 10.50.1.1
        - to: 10.30.0.0/24
          via: 10.50.1.1
        - to: 192.168.50.0/24
          via: 10.50.1.1
    ${nic1}:
      dhcp4: true
      optional: true
      dhcp4-overrides:
        route-metric: 200
NET
rm -f /etc/netplan/50-cloud-init.yaml
chmod 600 /etc/netplan/60-mango-lab.yaml
netplan apply || true'

C2_COMPOSE_FILE="$(mktemp)"
cat >"$C2_COMPOSE_FILE" <<'YAML'
services:
  vpn-gateway:
    image: mango-gns3-gateway:local
    restart: unless-stopped
    env_file: /opt/mango-gateway/.env
    ports:
      - "51820:51820/udp"
      - "10.50.1.20:50051:50051"
    cap_add: [NET_ADMIN]
    sysctls:
      net.ipv4.ip_forward: "1"
      net.ipv4.conf.all.src_valid_mark: "1"
    entrypoint: ["/bin/sh", "-c"]
    command: >-
      set -eu;
      nft list table inet mango_vpn >/dev/null 2>&1 || nft add table inet mango_vpn;
      nft list chain inet mango_vpn forward >/dev/null 2>&1 || nft add chain inet mango_vpn forward '{ type filter hook forward priority 0 ; policy drop ; }';
      exec /usr/local/bin/vpn-daemon
    networks:
      mango-gateway:
        ipv4_address: 172.29.0.10
networks:
  mango-gateway:
    driver: bridge
    ipam:
      config:
        - subnet: 172.29.0.0/24
YAML

C2_EXTRA="  - path: /opt/mango-gateway/docker-compose.yml
    directory: /opt/mango-gateway
    content: |
$(sed 's/^/      /' "$C2_COMPOSE_FILE")"

make_seed ec2-wg-gateway-c2-seed.iso ec2-wg-gateway "$C2_BOOTCMD" "" "$C2_EXTRA"
rm -f "$C2_COMPOSE_FILE"

echo "Created $DISK and both seed ISOs in $QEMU_DIR"
