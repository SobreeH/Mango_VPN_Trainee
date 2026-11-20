package main

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"os/exec"
	"strings"
)

// CommandRunner abstracts OS-level command execution (wg, nft) for testing.
type CommandRunner interface {
	Run(ctx context.Context, name string, args ...string) ([]byte, error)
}

type execCommandRunner struct{}

func (execCommandRunner) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}

// DaemonConfig configures the Linux VPN Daemon HTTP/RPC server.
type DaemonConfig struct {
	SharedSecret string
	Interface    string
	Runner       CommandRunner
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"success": false,
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

func validateWireGuardKey(key string) (string, error) {
	trimmed := strings.TrimSpace(key)
	raw, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil || len(raw) != 32 {
		return "", fmt.Errorf("publicKey must be a valid 32-byte base64 WireGuard key")
	}
	return trimmed, nil
}

func normalizePeerIP(rawIP string) (string, error) {
	trimmed := strings.TrimSpace(rawIP)
	if strings.Contains(trimmed, "/") {
		prefix, err := netip.ParsePrefix(trimmed)
		if err != nil || !prefix.Addr().Is4() || prefix.Bits() != 32 {
			return "", fmt.Errorf("assignedIp must be a valid IPv4 address or /32 CIDR")
		}
		return prefix.String(), nil
	}
	addr, err := netip.ParseAddr(trimmed)
	if err != nil || !addr.Is4() {
		return "", fmt.Errorf("assignedIp must be a valid IPv4 address")
	}
	return addr.String() + "/32", nil
}

func NewMux(cfg DaemonConfig) *http.ServeMux {
	iface := strings.TrimSpace(cfg.Interface)
	if iface == "" {
		iface = "wg0"
	}
	runner := cfg.Runner
	if runner == nil {
		runner = execCommandRunner{}
	}

	requireAuth := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if cfg.SharedSecret == "" {
				writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Daemon shared secret is not configured")
				return
			}
			authHeader := r.Header.Get("Authorization")
			const prefix = "Bearer "
			if !strings.HasPrefix(authHeader, prefix) {
				writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing Bearer authorization token")
				return
			}
			provided := strings.TrimPrefix(authHeader, prefix)
			if subtle.ConstantTimeCompare([]byte(provided), []byte(cfg.SharedSecret)) != 1 {
				writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid daemon authorization token")
				return
			}
			next(w, r)
		}
	}

	removePeer := func(w http.ResponseWriter, r *http.Request, rawKey string) {
		pubKey, err := validateWireGuardKey(rawKey)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_PUBLIC_KEY", err.Error())
			return
		}
		out, err := runner.Run(r.Context(), "wg", "set", iface, "peer", pubKey, "remove")
		if err != nil {
			writeError(w, http.StatusInternalServerError, "WG_COMMAND_FAILED", fmt.Sprintf("wg remove failed: %v (%s)", err, strings.TrimSpace(string(out))))
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"success":   true,
			"publicKey": pubKey,
		})
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"service": "mango-vpn-daemon",
		})
	})

	mux.HandleFunc("POST /peers", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PublicKey  string `json:"publicKey"`
			AssignedIP string `json:"assignedIp"`
			Role       string `json:"role,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
			return
		}
		pubKey, err := validateWireGuardKey(req.PublicKey)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_PUBLIC_KEY", err.Error())
			return
		}
		allowedIP, err := normalizePeerIP(req.AssignedIP)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_IP", err.Error())
			return
		}

		out, err := runner.Run(r.Context(), "wg", "set", iface, "peer", pubKey, "allowed-ips", allowedIP)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "WG_COMMAND_FAILED", fmt.Sprintf("wg set failed: %v (%s)", err, strings.TrimSpace(string(out))))
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"success":    true,
			"publicKey":  pubKey,
			"assignedIp": allowedIP,
		})
	}))

	mux.HandleFunc("POST /peers/remove", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PublicKey string `json:"publicKey"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
			return
		}
		removePeer(w, r, req.PublicKey)
	}))

	mux.HandleFunc("DELETE /peers/{publicKey...}", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		raw := r.PathValue("publicKey")
		decoded, err := url.PathUnescape(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_PUBLIC_KEY", "Malformed public key encoding")
			return
		}
		removePeer(w, r, decoded)
	}))

	return mux
}

func main() {
	addr := os.Getenv("DAEMON_LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:50051"
	}

	secret := strings.TrimSpace(os.Getenv("DAEMON_SHARED_SECRET"))
	if len(secret) < 32 {
		log.Fatal("DAEMON_SHARED_SECRET must be set and at least 32 characters")
	}

	iface := os.Getenv("WG_INTERFACE")
	if iface == "" {
		iface = "wg0"
	}

	mux := NewMux(DaemonConfig{
		SharedSecret: secret,
		Interface:    iface,
		Runner:       execCommandRunner{},
	})

	log.Printf("MANGO VPN Daemon listening on %s (interface=%s)", addr, iface)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
