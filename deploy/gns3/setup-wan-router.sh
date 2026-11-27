#!/bin/sh
set -eu

LAN_IFACE=${LAN_IFACE:-eth0}
WAN_IFACE=${WAN_IFACE:-eth1}
ENABLE_NAT=${ENABLE_NAT:-false}

ip addr replace 192.168.50.1/24 dev "$LAN_IFACE"
ip addr replace 203.0.113.1/24 dev "$WAN_IFACE"
sysctl -w net.ipv4.ip_forward=1 >/dev/null

# Deliberately do NOT add routes for 10.13.13.0/24 or 10.99/10.20/10.30 here.
# A WAN/Internet router only routes between public/client segments; private VPC
# traffic must enter the WireGuard tunnel addressed to 203.0.113.10:51820/udp.

if [ "$ENABLE_NAT" = "true" ]; then
  iptables -t nat -C POSTROUTING -o "$WAN_IFACE" -j MASQUERADE 2>/dev/null || \
    iptables -t nat -A POSTROUTING -o "$WAN_IFACE" -j MASQUERADE
fi

ip -br addr
ip route
