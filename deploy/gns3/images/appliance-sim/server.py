#!/usr/bin/env python3
"""Control-plane-only REST simulator for the GNS3 appliance lab."""
import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit


def read_config():
    vendor = os.environ.get("SIM_VENDOR", "").strip().upper()
    if vendor not in {"FORTINET", "CISCO"}:
        raise SystemExit("SIM_VENDOR must be FORTINET or CISCO")
    token = os.environ.get("SIM_API_TOKEN", "")
    if len(token) < 16:
        raise SystemExit("SIM_API_TOKEN must be set and at least 16 characters")
    listen = os.environ.get("SIM_LISTEN", "0.0.0.0:8443")
    host, separator, port_text = listen.rpartition(":")
    if not separator or not host or not port_text.isdigit():
        raise SystemExit("SIM_LISTEN must be host:port")
    return vendor, token, host, int(port_text)


class State:
    def __init__(self, vendor):
        self.vendor = vendor
        self.lock = threading.Lock()
        self.peers = {}
        self.policies = {}
        self.recent_requests = []

    def record(self, method, path, authorized):
        with self.lock:
            self.recent_requests.append({"method": method, "path": path,
                                         "authorized": authorized,
                                         "authorization": "[REDACTED]"})
            del self.recent_requests[:-50]

    def snapshot(self):
        with self.lock:
            return {"vendor": self.vendor, "peerCount": len(self.peers),
                    "peers": self.peers.copy(), "policies": self.policies.copy(),
                    "recentRequests": list(self.recent_requests)}


def json_bytes(value):
    return json.dumps(value, separators=(",", ":")).encode("utf-8")


def peer_identity(payload):
    return str(payload.get("peerIdentity") or payload.get("name") or "").strip()


class Handler(BaseHTTPRequestHandler):
    server_version = "MangoLabRestSimulator/1.0"

    def _write(self, status, body):
        raw = json_bytes(body)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _payload(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return {}

    def _authorized(self):
        supplied = self.headers.get("Authorization", "")
        prefix = "Bearer "
        ok = supplied.startswith(prefix) and hmac.compare_digest(supplied[len(prefix):], self.server.token)
        self.server.state.record(self.command, self.path, ok)
        if not ok:
            self._write(401, {"error": "unauthorized"})
        return ok

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            self.server.state.record(self.command, path, False)
            self._write(200, {"status": "ok", "vendor": self.server.vendor,
                              "mode": "control-plane-rest-simulator"})
            return
        if not self._authorized():
            return
        if path == "/debug/state":
            self._write(200, self.server.state.snapshot())
            return
        self._write(404, {"error": "not found"})

    def do_POST(self):
        if not self._authorized():
            return
        path = urlsplit(self.path).path
        payload = self._payload()
        expected = "/api/v2/cmdb/user/local" if self.server.vendor == "FORTINET" else "/api/vpn/sessions"
        if path == expected:
            identity = peer_identity(payload)
            if not identity:
                self._write(400, {"error": "peerIdentity or name is required"})
                return
            with self.server.state.lock:
                self.server.state.peers[identity] = payload
            self._write(200, {"status": "ok", "peerIdentity": identity})
            return
        if self.server.vendor == "FORTINET" and path == "/api/v2/monitor/vpn/ssl/select":
            identity = peer_identity(payload)
            with self.server.state.lock:
                self.server.state.peers.pop(identity, None)
            self._write(200, {"status": "ok", "peerIdentity": identity})
            return
        self._write(404, {"error": "not found"})

    def do_DELETE(self):
        if not self._authorized():
            return
        path = urlsplit(self.path).path
        prefix = "/api/vpn/sessions/"
        if self.server.vendor == "CISCO" and path.startswith(prefix):
            identity = unquote(path[len(prefix):])
            with self.server.state.lock:
                self.server.state.peers.pop(identity, None)
            self._write(200, {"status": "ok", "peerIdentity": identity})
            return
        self._write(404, {"error": "not found"})

    def do_PUT(self):
        if not self._authorized():
            return
        path = urlsplit(self.path).path
        expected = "/api/v2/cmdb/firewall/policy" if self.server.vendor == "FORTINET" else "/api/access/acl"
        if path == expected:
            payload = self._payload()
            with self.server.state.lock:
                self.server.state.policies = payload
            self._write(200, {"status": "ok"})
            return
        self._write(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        return


def main():
    vendor, token, host, port = read_config()
    server = ThreadingHTTPServer((host, port), Handler)
    server.vendor = vendor
    server.token = token
    server.state = State(vendor)
    print("[LAB REST SIMULATOR - CONTROL PLANE ONLY - NOT A REAL APPLIANCE DATA PLANE]", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
