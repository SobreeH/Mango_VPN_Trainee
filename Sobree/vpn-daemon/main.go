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
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
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

// GatewayConfig configures WireGuard interface and nftables startup initialization.
type GatewayConfig struct {
	Interface   string
	GatewayCIDR string
	ListenPort  int
	PrivateKey  string
	Runner      CommandRunner
}

// InitGateway ensures the WireGuard interface and inet mango_vpn nftables table exist.
func InitGateway(ctx context.Context, cfg GatewayConfig) error {
	iface := strings.TrimSpace(cfg.Interface)
	if iface == "" {
		iface = "wg0"
	}
	cidr := strings.TrimSpace(cfg.GatewayCIDR)
	if cidr == "" {
		cidr = "10.13.13.1/24"
	}
	port := cfg.ListenPort
	if port <= 0 || port > 65535 {
		port = 51820
	}
	runner := cfg.Runner
	if runner == nil {
		runner = execCommandRunner{}
	}

	if _, err := runner.Run(ctx, "ip", "link", "show", "dev", iface); err != nil {
		if out, addErr := runner.Run(ctx, "ip", "link", "add", "dev", iface, "type", "wireguard"); addErr != nil {
			return fmt.Errorf("ip link add failed: %v (%s)", addErr, strings.TrimSpace(string(out)))
		}
	}

	if out, err := runner.Run(ctx, "ip", "addr", "replace", cidr, "dev", iface); err != nil {
		return fmt.Errorf("ip addr replace failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}

	wgArgs := []string{"set", iface, "listen-port", strconv.Itoa(port)}
	if privKey := strings.TrimSpace(cfg.PrivateKey); privKey != "" {
		tmpFile, err := os.CreateTemp("", "mango-wg-key-*")
		if err != nil {
			return fmt.Errorf("create temp key file: %w", err)
		}
		tmpPath := tmpFile.Name()
		defer os.Remove(tmpPath)

		if err := tmpFile.Chmod(0o600); err != nil {
			_ = tmpFile.Close()
			return fmt.Errorf("chmod temp key file: %w", err)
		}
		if _, err := tmpFile.WriteString(privKey + "\n"); err != nil {
			_ = tmpFile.Close()
			return fmt.Errorf("write temp key file: %w", err)
		}
		if err := tmpFile.Close(); err != nil {
			return fmt.Errorf("close temp key file: %w", err)
		}
		wgArgs = append(wgArgs, "private-key", tmpPath)
	}

	if out, err := runner.Run(ctx, "wg", wgArgs...); err != nil {
		return fmt.Errorf("wg set failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}

	if out, err := runner.Run(ctx, "ip", "link", "set", "up", "dev", iface); err != nil {
		return fmt.Errorf("ip link set up failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}

	return applyNftables(ctx, runner, iface, nil)
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

// PolicyRule represents a role-based firewall rule enforced via nftables.
type PolicyRule struct {
	TargetCidr string  `json:"targetCidr"`
	Protocol   string  `json:"protocol"`
	PortRange  *string `json:"portRange"`
	Action     string  `json:"action"`
	Priority   int     `json:"priority"`
}

type peerPolicyEntry struct {
	PublicKey  string
	AssignedIP string
	Role       string
	Policies   []PolicyRule
}

func validatePortRange(raw *string, protocol string) (*string, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*raw)
	if protocol != "TCP" && protocol != "UDP" {
		return nil, fmt.Errorf("portRange is only supported for TCP or UDP protocols")
	}
	parts := strings.Split(trimmed, "-")
	if len(parts) > 2 {
		return nil, fmt.Errorf("portRange must be a single port or start-end range")
	}
	parsePort := func(s string) (int, error) {
		p, err := strconv.Atoi(strings.TrimSpace(s))
		if err != nil || p < 1 || p > 65535 {
			return 0, fmt.Errorf("port %q must be between 1 and 65535", s)
		}
		return p, nil
	}
	start, err := parsePort(parts[0])
	if err != nil {
		return nil, err
	}
	if len(parts) == 2 {
		end, err := parsePort(parts[1])
		if err != nil {
			return nil, err
		}
		if start > end {
			return nil, fmt.Errorf("portRange start must be <= end")
		}
		normalized := fmt.Sprintf("%d-%d", start, end)
		return &normalized, nil
	}
	normalized := strconv.Itoa(start)
	return &normalized, nil
}

func validatePolicyRules(rules []PolicyRule) ([]PolicyRule, error) {
	out := make([]PolicyRule, 0, len(rules))
	for _, r := range rules {
		prefix, err := netip.ParsePrefix(strings.TrimSpace(r.TargetCidr))
		if err != nil || !prefix.Addr().Is4() {
			return nil, fmt.Errorf("invalid targetCidr %q: must be a valid IPv4 CIDR", r.TargetCidr)
		}
		proto := strings.ToUpper(strings.TrimSpace(r.Protocol))
		switch proto {
		case "ANY", "TCP", "UDP", "ICMP":
		default:
			return nil, fmt.Errorf("invalid protocol %q: must be ANY, TCP, UDP, or ICMP", r.Protocol)
		}
		action := strings.ToUpper(strings.TrimSpace(r.Action))
		if action != "ALLOW" && action != "DENY" {
			return nil, fmt.Errorf("invalid action %q: must be ALLOW or DENY", r.Action)
		}
		portRange, err := validatePortRange(r.PortRange, proto)
		if err != nil {
			return nil, err
		}
		out = append(out, PolicyRule{
			TargetCidr: prefix.String(),
			Protocol:   proto,
			PortRange:  portRange,
			Action:     action,
			Priority:   r.Priority,
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].Priority < out[j].Priority
	})
	return out, nil
}

func applyNftables(ctx context.Context, runner CommandRunner, iface string, peers []peerPolicyEntry) error {
	cmds := [][]string{
		{"add", "table", "inet", "mango_vpn"},
		{"add", "chain", "inet", "mango_vpn", "forward", "{", "type", "filter", "hook", "forward", "priority", "0", ";", "policy", "drop", ";", "}"},
		{"flush", "chain", "inet", "mango_vpn", "forward"},
		{"add", "rule", "inet", "mango_vpn", "forward", "ct", "state", "established,related", "accept"},
	}

	sortedPeers := append([]peerPolicyEntry(nil), peers...)
	sort.SliceStable(sortedPeers, func(i, j int) bool {
		return sortedPeers[i].AssignedIP < sortedPeers[j].AssignedIP
	})

	for _, peer := range sortedPeers {
		peerIP := strings.TrimSuffix(peer.AssignedIP, "/32")
		for _, rule := range peer.Policies {
			verdict := "drop"
			if rule.Action == "ALLOW" {
				verdict = "accept"
			}
			args := []string{
				"add", "rule", "inet", "mango_vpn", "forward",
				"iifname", iface, "ip", "saddr", peerIP, "ip", "daddr", rule.TargetCidr,
			}
			switch rule.Protocol {
			case "TCP":
				if rule.PortRange != nil {
					args = append(args, "tcp", "dport", *rule.PortRange)
				} else {
					args = append(args, "ip", "protocol", "tcp")
				}
			case "UDP":
				if rule.PortRange != nil {
					args = append(args, "udp", "dport", *rule.PortRange)
				} else {
					args = append(args, "ip", "protocol", "udp")
				}
			case "ICMP":
				args = append(args, "ip", "protocol", "icmp")
			}
			args = append(args, verdict)
			cmds = append(cmds, args)
		}
		// Explicit per-peer default drop after all role rules.
		cmds = append(cmds, []string{
			"add", "rule", "inet", "mango_vpn", "forward",
			"iifname", iface, "ip", "saddr", peerIP, "drop",
		})
	}

	for _, args := range cmds {
		if out, err := runner.Run(ctx, "nft", args...); err != nil {
			return fmt.Errorf("nft %s failed: %v (%s)", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
		}
	}
	return nil
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

	var mu sync.RWMutex
	peerPolicies := make(map[string]peerPolicyEntry)
	nftActive := false

	snapshotPeersLocked := func() []peerPolicyEntry {
		list := make([]peerPolicyEntry, 0, len(peerPolicies))
		for _, entry := range peerPolicies {
			list = append(list, entry)
		}
		return list
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

		mu.Lock()
		delete(peerPolicies, pubKey)
		shouldSyncNft := nftActive
		peersSnapshot := snapshotPeersLocked()
		mu.Unlock()

		if shouldSyncNft {
			if err := applyNftables(r.Context(), runner, iface, peersSnapshot); err != nil {
				writeError(w, http.StatusInternalServerError, "NFT_COMMAND_FAILED", err.Error())
				return
			}
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
			PublicKey  string       `json:"publicKey"`
			AssignedIP string       `json:"assignedIp"`
			Role       string       `json:"role,omitempty"`
			Policies   []PolicyRule `json:"policies,omitempty"`
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

		var validatedPolicies []PolicyRule
		if req.Policies != nil {
			validatedPolicies, err = validatePolicyRules(req.Policies)
			if err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_POLICY", err.Error())
				return
			}
		}

		out, err := runner.Run(r.Context(), "wg", "set", iface, "peer", pubKey, "allowed-ips", allowedIP)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "WG_COMMAND_FAILED", fmt.Sprintf("wg set failed: %v (%s)", err, strings.TrimSpace(string(out))))
			return
		}

		if req.Policies != nil {
			mu.Lock()
			peerPolicies[pubKey] = peerPolicyEntry{
				PublicKey:  pubKey,
				AssignedIP: allowedIP,
				Role:       strings.TrimSpace(req.Role),
				Policies:   validatedPolicies,
			}
			nftActive = true
			peersSnapshot := snapshotPeersLocked()
			mu.Unlock()

			if err := applyNftables(r.Context(), runner, iface, peersSnapshot); err != nil {
				writeError(w, http.StatusInternalServerError, "NFT_COMMAND_FAILED", err.Error())
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"success":    true,
			"publicKey":  pubKey,
			"assignedIp": allowedIP,
		})
	}))

	syncPoliciesHandler := requireAuth(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Peers []struct {
				PublicKey  string       `json:"publicKey"`
				AssignedIP string       `json:"assignedIp"`
				Role       string       `json:"role"`
				Policies   []PolicyRule `json:"policies"`
			} `json:"peers"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
			return
		}

		nextMap := make(map[string]peerPolicyEntry, len(req.Peers))
		for _, p := range req.Peers {
			pubKey, err := validateWireGuardKey(p.PublicKey)
			if err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_PUBLIC_KEY", err.Error())
				return
			}
			allowedIP, err := normalizePeerIP(p.AssignedIP)
			if err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_IP", err.Error())
				return
			}
			validatedRules, err := validatePolicyRules(p.Policies)
			if err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_POLICY", err.Error())
				return
			}
			nextMap[pubKey] = peerPolicyEntry{
				PublicKey:  pubKey,
				AssignedIP: allowedIP,
				Role:       strings.TrimSpace(p.Role),
				Policies:   validatedRules,
			}
		}

		mu.Lock()
		peerPolicies = nextMap
		nftActive = true
		peersSnapshot := snapshotPeersLocked()
		mu.Unlock()

		if err := applyNftables(r.Context(), runner, iface, peersSnapshot); err != nil {
			writeError(w, http.StatusInternalServerError, "NFT_COMMAND_FAILED", err.Error())
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"peers":   len(peersSnapshot),
		})
	})

	mux.HandleFunc("POST /policies/sync", syncPoliciesHandler)
	mux.HandleFunc("PUT /peers/policies", syncPoliciesHandler)

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

	listenPort := 51820
	if rawPort := strings.TrimSpace(os.Getenv("WG_LISTEN_PORT")); rawPort != "" {
		p, err := strconv.Atoi(rawPort)
		if err != nil || p <= 0 || p > 65535 {
			log.Fatalf("WG_LISTEN_PORT must be a valid port (1-65535): %q", rawPort)
		}
		listenPort = p
	}

	gatewayCIDR := strings.TrimSpace(os.Getenv("WG_GATEWAY_CIDR"))
	if gatewayCIDR == "" {
		gatewayCIDR = "10.13.13.1/24"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	err := InitGateway(ctx, GatewayConfig{
		Interface:   iface,
		GatewayCIDR: gatewayCIDR,
		ListenPort:  listenPort,
		PrivateKey:  os.Getenv("WG_PRIVATE_KEY"),
		Runner:      execCommandRunner{},
	})
	cancel()
	if err != nil {
		log.Fatalf("gateway init failed: %v", err)
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
