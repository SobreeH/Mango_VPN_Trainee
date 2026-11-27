#!/bin/sh
set -eu

role=${ROUTER_ROLE:-}
case "$role" in
  wan) expected=2 ;;
  vpc) expected=4 ;;
  aws-igw) expected=5 ;;
  *) echo "ROUTER_ROLE must be wan, vpc, or aws-igw" >&2; exit 2 ;;
esac

has_iface() {
  awk -F: -v name="$1" '{ gsub(/^[[:space:]]+|[[:space:]]+$/, "", $1); if ($1 == name) found=1 } END { exit(found ? 0 : 1) }' /proc/net/dev
}

deadline=$(( $(date +%s) + 20 ))
iface=0
while [ "$iface" -lt "$expected" ]; do
  if ! has_iface "eth$iface"; then
    [ "$(date +%s)" -lt "$deadline" ] || { echo "timed out waiting for eth$iface" >&2; exit 1; }
    sleep 1
    continue
  fi
  ip link set up dev "eth$iface"
  iface=$((iface + 1))
done

sysctl -w net.ipv4.ip_forward=1 >/dev/null

install_wan_firewall() {
  nft delete table inet sg_wan 2>/dev/null || true
  nft -f - <<'NFT'
table inet sg_wan {
  chain forward {
    type filter hook forward priority 0; policy drop;
    ct state established,related accept
    ip protocol icmp accept
    iifname "eth0" oifname "eth1" ip daddr 203.0.113.53 udp dport 53 accept
    iifname "eth0" oifname "eth1" ip daddr 203.0.113.53 tcp dport 53 accept
    iifname "eth0" oifname "eth1" ip saddr 192.168.50.10 ip daddr 203.0.113.10 tcp dport 22 accept
    ip daddr 203.0.113.10 tcp dport { 80, 443 } accept
    ip daddr 203.0.113.10 udp dport 51820 accept
    ip daddr 203.0.113.20 udp dport 51820 accept
    ip daddr { 203.0.113.21, 203.0.113.22 } tcp dport { 443, 8443 } accept
  }
}
NFT
}

install_aws_firewall() {
  nft delete table ip aws_nat 2>/dev/null || true
  nft delete table inet aws_sg 2>/dev/null || true
  nft -f - <<'NFT'
table ip aws_nat {
  chain prerouting {
    type nat hook prerouting priority -100;
    iifname "eth0" ip daddr 203.0.113.10 tcp dport { 80, 443 } dnat to 10.50.1.10
    iifname "eth0" ip daddr 203.0.113.20 udp dport 51820 dnat to 10.50.1.20
  }
  chain postrouting {
    type nat hook postrouting priority 100;
    oifname "eth0" ip saddr 10.50.1.10 snat to 203.0.113.10
    oifname "eth0" ip saddr 10.50.1.20 snat to 203.0.113.20
    oifname "eth0" ip saddr 10.50.0.0/16 snat to 203.0.113.2
  }
}
table inet aws_sg {
  chain forward {
    type filter hook forward priority 0; policy drop;
    ct state established,related accept
    iifname "eth0" ip daddr 10.50.1.10 tcp dport { 80, 443 } accept
    iifname "eth0" ip daddr 10.50.1.20 udp dport 51820 accept
    ip saddr 10.50.1.10 ip daddr 10.50.10.11 tcp dport 4000 accept
    ip saddr 10.50.1.10 ip daddr 10.50.10.12 tcp dport 3000 accept
    ip saddr 10.50.10.11 ip daddr 10.50.10.20 tcp dport 5432 accept
    ip saddr 10.50.10.11 ip daddr 10.50.1.20 tcp dport 50051 accept
    ip saddr 10.50.0.0/16 ip daddr 10.50.30.0/24 accept
    ip saddr 10.50.0.0/16 oifname "eth0" ip daddr 203.0.113.53 udp dport 53 accept
    ip saddr 10.50.0.0/16 oifname "eth0" ip daddr 203.0.113.53 tcp dport 53 accept
    iifname "eth1" ip saddr 10.13.13.0/24 ip daddr { 10.99.0.0/24, 10.20.0.0/16, 10.30.0.0/24, 10.50.30.0/24 } accept
    iifname != "eth0" ip protocol icmp accept
  }
}
NFT
}

case "$role" in
  wan)
    ip addr replace 192.168.50.1/24 dev eth0
    ip addr replace 203.0.113.1/24 dev eth1
    # No routes to private VPN or VPC ranges belong on the WAN router.
    install_wan_firewall
    ;;
  vpc)
    ip addr replace 172.28.0.1/24 dev eth0
    ip addr replace 10.99.0.1/24 dev eth1
    ip addr replace 10.20.0.1/16 dev eth2
    ip addr replace 10.30.0.1/24 dev eth3
    ip route replace 10.13.13.0/24 via 172.28.0.2 dev eth0
    if [ "${ENABLE_AWS_VPC_ROUTE:-false}" = "true" ]; then
      ip route replace 10.50.0.0/16 via 172.28.0.2 dev eth0
    fi
    # Deliberately no route to 192.168.50.0/24.
    ;;
  aws-igw)
    ip addr replace 203.0.113.2/24 dev eth0
    ip addr add 203.0.113.10/24 dev eth0 2>/dev/null || true
    ip addr add 203.0.113.20/24 dev eth0 2>/dev/null || true
    ip addr replace 10.50.1.1/24 dev eth1
    ip addr replace 10.50.10.1/24 dev eth2
    ip addr replace 10.50.30.1/24 dev eth3
    ip addr replace 172.28.0.2/24 dev eth4
    ip route replace 192.168.50.0/24 via 203.0.113.1 dev eth0
    ip route replace default via 203.0.113.1 dev eth0
    ip route replace 10.99.0.0/24 via 172.28.0.1 dev eth4
    ip route replace 10.20.0.0/16 via 172.28.0.1 dev eth4
    ip route replace 10.30.0.0/24 via 172.28.0.1 dev eth4
    ip route replace 10.13.13.0/24 via 10.50.1.20 dev eth1
    install_aws_firewall
    ;;
esac

trap 'exit 0' INT TERM
while :; do sleep 3600 & wait $!; done
