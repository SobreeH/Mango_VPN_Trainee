#!/usr/bin/env bash
set -euo pipefail
BRIDGE="${GNS3_CLIENT_BRIDGE:-virbr-gns3}"
ACTION="${1:-}"
[[ -n "$ACTION" && $# -eq 1 ]] || { echo "Usage: sudo $0 <up|down|status>" >&2; exit 2; }
case "$ACTION" in
  up)
    ip link show dev "$BRIDGE" >/dev/null
    ip link set dev "$BRIDGE" up
    ip addr replace 192.168.50.10/24 dev "$BRIDGE"
    ip route replace 203.0.113.0/24 via 192.168.50.1 dev "$BRIDGE"
    ;;
  down)
    ip route del 203.0.113.0/24 dev "$BRIDGE" 2>/dev/null || true
    ip addr del 192.168.50.10/24 dev "$BRIDGE" 2>/dev/null || true
    ;;
  status)
    echo "Bridge: $BRIDGE"
    ip -brief addr show dev "$BRIDGE" || true
    echo "Routes:"
    ip route show 192.168.50.0/24 203.0.113.0/24 || true
    for host in 192.168.50.1 203.0.113.1; do
      if ping -c1 -W1 "$host" >/dev/null 2>&1; then echo "ping $host: ok"; else echo "ping $host: failed"; fi
    done
    ;;
  *) echo "Usage: sudo $0 <up|down|status>" >&2; exit 2 ;;
esac
