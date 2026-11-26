#!/bin/sh
set -eu

TRANSIT_IFACE=${TRANSIT_IFACE:-eth0}
ADMIN_IFACE=${ADMIN_IFACE:-eth1}
STAFF_IFACE=${STAFF_IFACE:-eth2}
CLIENT_IFACE=${CLIENT_IFACE:-eth3}

ip addr replace 172.28.0.1/24 dev "$TRANSIT_IFACE"
ip addr replace 10.99.0.1/24 dev "$ADMIN_IFACE"
ip addr replace 10.20.0.1/16 dev "$STAFF_IFACE"
ip addr replace 10.30.0.1/24 dev "$CLIENT_IFACE"
sysctl -w net.ipv4.ip_forward=1 >/dev/null

# Return traffic for the WireGuard subnet goes to the Ubuntu control-plane VM.
# Do not add a route to 192.168.50.0/24: the private zones are intentionally
# isolated from the client LAN.
ip route replace 10.13.13.0/24 via 172.28.0.2 dev "$TRANSIT_IFACE"

ip -br addr
ip route
