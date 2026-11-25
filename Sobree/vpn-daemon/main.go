package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
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

const (
	ProviderWireGuard = "WIREGUARD"
	ProviderFortinet  = "FORTINET"
	ProviderCisco     = "CISCO"
)

// CommandRunner abstracts OS-level command execution (wg, nft) for testing.
type CommandRunner interface {
	Run(ctx context.Context, name string, args ...string) ([]byte, error)
}

type execCommandRunner struct{}

func (execCommandRunner) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}

// DaemonConfig configures the VPN Daemon HTTP/RPC server and provider drivers.
type DaemonConfig struct {
	SharedSecret   string
	Interface      string
	Runner         CommandRunner
	FortiGateURL   string
	FortiGateToken string
	CiscoURL       string
	CiscoToken     string
	HTTPClient     *http.Client
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

func normalizeProviderType(raw string) (string, error) {
	trimmed := strings.ToUpper(strings.TrimSpace(raw))
	if trimmed == "" {
		return ProviderWireGuard, nil
	}
	switch trimmed {
	case ProviderWireGuard, ProviderFortinet, ProviderCisco:
		return trimmed, nil
	default:
		return "", fmt.Errorf("unsupported providerType %q: must be WIREGUARD, FORTINET, or CISCO", raw)
	}
}

func validateWireGuardKey(key string) (string, error) {
	trimmed := strings.TrimSpace(key)
	raw, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil || len(raw) != 32 {
		return "", fmt.Errorf("publicKey must be a valid 32-byte base64 WireGuard key")
	}
	return trimmed, nil
}

func validatePeerIdentity(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if len(trimmed) < 3 || len(trimmed) > 128 {
		return "", fmt.Errorf("peerIdentity must be between 3 and 128 characters")
	}
	for _, r := range trimmed {
		isValid := (r >= 'a' && r <= 'z') ||
			(r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') ||
			r == '.' || r == '_' || r == ':' || r == '-'
		if !isValid {
			return "", fmt.Errorf("peerIdentity contains unsupported characters")
		}
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

// PolicyRule represents a role-based firewall rule enforced via provider drivers.
type PolicyRule struct {
	TargetCidr string  `json:"targetCidr"`
	Protocol   string  `json:"protocol"`
	PortRange  *string `json:"portRange"`
	Action     string  `json:"action"`
	Priority   int     `json:"priority"`
}

type peerPolicyEntry struct {
	ProviderType string
	GatewayID    string
	PublicKey    string
	PeerIdentity string
	AssignedIP   string
	Role         string
	Policies     []PolicyRule
}

// AddPeerRequest holds validated input for provisioning a peer on a ProviderDriver.
type AddPeerRequest struct {
	ProviderType    string
	GatewayID       string
	GatewayEndpoint string
	PeerIdentity    string
	AssignedIP      string
	Role            string
	Policies        []PolicyRule
	HasPolicies     bool
}

// RemovePeerRequest holds validated input for tearing down a peer on a ProviderDriver.
type RemovePeerRequest struct {
	ProviderType    string
	GatewayID       string
	GatewayEndpoint string
	PeerIdentity    string
}

// ProviderDriver abstracts VPN gateway peer and policy enforcement across vendors.
type ProviderDriver interface {
	AddPeer(ctx context.Context, req AddPeerRequest) (code string, err error)
	RemovePeer(ctx context.Context, req RemovePeerRequest) (code string, err error)
	SyncPolicies(ctx context.Context, peers []peerPolicyEntry) (code string, err error)
	HasPeer(peerIdentity string) bool
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

type wireGuardNftDriver struct {
	iface        string
	runner       CommandRunner
	mu           sync.RWMutex
	peerPolicies map[string]peerPolicyEntry
	nftActive    bool
}

func newWireGuardNftDriver(iface string, runner CommandRunner) *wireGuardNftDriver {
	return &wireGuardNftDriver{
		iface:        iface,
		runner:       runner,
		peerPolicies: make(map[string]peerPolicyEntry),
	}
}

func (d *wireGuardNftDriver) snapshotPeersLocked() []peerPolicyEntry {
	list := make([]peerPolicyEntry, 0, len(d.peerPolicies))
	for _, entry := range d.peerPolicies {
		list = append(list, entry)
	}
	return list
}

func (d *wireGuardNftDriver) HasPeer(peerIdentity string) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	_, ok := d.peerPolicies[peerIdentity]
	return ok
}

func (d *wireGuardNftDriver) AddPeer(ctx context.Context, req AddPeerRequest) (string, error) {
	out, err := d.runner.Run(ctx, "wg", "set", d.iface, "peer", req.PeerIdentity, "allowed-ips", req.AssignedIP)
	if err != nil {
		return "WG_COMMAND_FAILED", fmt.Errorf("wg set failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}

	if req.HasPolicies {
		d.mu.Lock()
		d.peerPolicies[req.PeerIdentity] = peerPolicyEntry{
			ProviderType: ProviderWireGuard,
			GatewayID:    req.GatewayID,
			PublicKey:    req.PeerIdentity,
			PeerIdentity: req.PeerIdentity,
			AssignedIP:   req.AssignedIP,
			Role:         req.Role,
			Policies:     req.Policies,
		}
		d.nftActive = true
		peersSnapshot := d.snapshotPeersLocked()
		d.mu.Unlock()

		if err := applyNftables(ctx, d.runner, d.iface, peersSnapshot); err != nil {
			return "NFT_COMMAND_FAILED", err
		}
	}
	return "", nil
}

func (d *wireGuardNftDriver) RemovePeer(ctx context.Context, req RemovePeerRequest) (string, error) {
	out, err := d.runner.Run(ctx, "wg", "set", d.iface, "peer", req.PeerIdentity, "remove")
	if err != nil {
		return "WG_COMMAND_FAILED", fmt.Errorf("wg remove failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}

	d.mu.Lock()
	delete(d.peerPolicies, req.PeerIdentity)
	shouldSyncNft := d.nftActive
	peersSnapshot := d.snapshotPeersLocked()
	d.mu.Unlock()

	if shouldSyncNft {
		if err := applyNftables(ctx, d.runner, d.iface, peersSnapshot); err != nil {
			return "NFT_COMMAND_FAILED", err
		}
	}
	return "", nil
}

func (d *wireGuardNftDriver) SyncPolicies(ctx context.Context, peers []peerPolicyEntry) (string, error) {
	nextMap := make(map[string]peerPolicyEntry, len(peers))
	for _, p := range peers {
		nextMap[p.PeerIdentity] = p
	}

	d.mu.Lock()
	d.peerPolicies = nextMap
	d.nftActive = true
	peersSnapshot := d.snapshotPeersLocked()
	d.mu.Unlock()

	if err := applyNftables(ctx, d.runner, d.iface, peersSnapshot); err != nil {
		return "NFT_COMMAND_FAILED", err
	}
	return "", nil
}

type applianceEndpoints struct {
	addPeerMethod    string
	addPeerPath      string
	removePeerMethod string
	removePeerPath   func(peerIdentity string) string
	syncMethod       string
	syncPath         string
	errorCodePrefix  string
}

type applianceRestDriver struct {
	provider   string
	baseURL    string
	apiToken   string
	httpClient *http.Client
	endpoints  applianceEndpoints
	mu         sync.RWMutex
	peers      map[string]peerPolicyEntry
}

func newFortiGateDriver(baseURL, token string, client *http.Client) *applianceRestDriver {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &applianceRestDriver{
		provider:   ProviderFortinet,
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		apiToken:   strings.TrimSpace(token),
		httpClient: client,
		endpoints: applianceEndpoints{
			addPeerMethod:    http.MethodPost,
			addPeerPath:      "/api/v2/cmdb/user/local",
			removePeerMethod: http.MethodPost,
			removePeerPath:   func(_ string) string { return "/api/v2/monitor/vpn/ssl/select" },
			syncMethod:       http.MethodPut,
			syncPath:         "/api/v2/cmdb/firewall/policy",
			errorCodePrefix:  "FORTIGATE",
		},
		peers: make(map[string]peerPolicyEntry),
	}
}

func newCiscoDriver(baseURL, token string, client *http.Client) *applianceRestDriver {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &applianceRestDriver{
		provider:   ProviderCisco,
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		apiToken:   strings.TrimSpace(token),
		httpClient: client,
		endpoints: applianceEndpoints{
			addPeerMethod:    http.MethodPost,
			addPeerPath:      "/api/vpn/sessions",
			removePeerMethod: http.MethodDelete,
			removePeerPath: func(peerIdentity string) string {
				return "/api/vpn/sessions/" + url.PathEscape(peerIdentity)
			},
			syncMethod:      http.MethodPut,
			syncPath:        "/api/access/acl",
			errorCodePrefix: "CISCO",
		},
		peers: make(map[string]peerPolicyEntry),
	}
}

func (d *applianceRestDriver) HasPeer(peerIdentity string) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	_, ok := d.peers[peerIdentity]
	return ok
}

func (d *applianceRestDriver) callAppliance(ctx context.Context, method, path string, payload any) error {
	if d.baseURL == "" {
		return nil
	}
	var bodyReader io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, d.baseURL+path, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if d.apiToken != "" {
		req.Header.Set("Authorization", "Bearer "+d.apiToken)
	}
	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msgBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("%s API %s %s returned HTTP %d: %s", d.provider, method, path, resp.StatusCode, strings.TrimSpace(string(msgBytes)))
	}
	return nil
}

func (d *applianceRestDriver) AddPeer(ctx context.Context, req AddPeerRequest) (string, error) {
	if err := d.callAppliance(ctx, d.endpoints.addPeerMethod, d.endpoints.addPeerPath, map[string]any{
		"name":         req.PeerIdentity,
		"peerIdentity": req.PeerIdentity,
		"assignedIp":   strings.TrimSuffix(req.AssignedIP, "/32"),
		"role":         req.Role,
		"gatewayId":    req.GatewayID,
		"policies":     req.Policies,
	}); err != nil {
		return d.endpoints.errorCodePrefix + "_API_FAILED", err
	}

	entry := peerPolicyEntry{
		ProviderType: d.provider,
		GatewayID:    req.GatewayID,
		PublicKey:    req.PeerIdentity,
		PeerIdentity: req.PeerIdentity,
		AssignedIP:   req.AssignedIP,
		Role:         req.Role,
		Policies:     req.Policies,
	}

	d.mu.Lock()
	d.peers[req.PeerIdentity] = entry
	snapshot := make([]peerPolicyEntry, 0, len(d.peers))
	for _, p := range d.peers {
		snapshot = append(snapshot, p)
	}
	d.mu.Unlock()

	if req.HasPolicies && d.baseURL != "" {
		if err := d.callAppliance(ctx, d.endpoints.syncMethod, d.endpoints.syncPath, map[string]any{"peers": snapshot}); err != nil {
			return d.endpoints.errorCodePrefix + "_POLICY_FAILED", err
		}
	}
	return "", nil
}

func (d *applianceRestDriver) RemovePeer(ctx context.Context, req RemovePeerRequest) (string, error) {
	var payload any
	if d.endpoints.removePeerMethod == http.MethodPost {
		payload = map[string]any{
			"peerIdentity": req.PeerIdentity,
			"gatewayId":    req.GatewayID,
		}
	}
	if err := d.callAppliance(ctx, d.endpoints.removePeerMethod, d.endpoints.removePeerPath(req.PeerIdentity), payload); err != nil {
		return d.endpoints.errorCodePrefix + "_API_FAILED", err
	}

	d.mu.Lock()
	delete(d.peers, req.PeerIdentity)
	d.mu.Unlock()
	return "", nil
}

func (d *applianceRestDriver) SyncPolicies(ctx context.Context, peers []peerPolicyEntry) (string, error) {
	if err := d.callAppliance(ctx, d.endpoints.syncMethod, d.endpoints.syncPath, map[string]any{"peers": peers}); err != nil {
		return d.endpoints.errorCodePrefix + "_POLICY_FAILED", err
	}

	next := make(map[string]peerPolicyEntry, len(peers))
	for _, p := range peers {
		next[p.PeerIdentity] = p
	}
	d.mu.Lock()
	d.peers = next
	d.mu.Unlock()
	return "", nil
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

	drivers := map[string]ProviderDriver{
		ProviderWireGuard: newWireGuardNftDriver(iface, runner),
		ProviderFortinet:  newFortiGateDriver(cfg.FortiGateURL, cfg.FortiGateToken, cfg.HTTPClient),
		ProviderCisco:     newCiscoDriver(cfg.CiscoURL, cfg.CiscoToken, cfg.HTTPClient),
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

	resolvePeerID := func(provider, publicKey, peerIdentity string) (string, string, error) {
		raw := strings.TrimSpace(peerIdentity)
		if raw == "" {
			raw = strings.TrimSpace(publicKey)
		}
		if provider == ProviderWireGuard {
			key, err := validateWireGuardKey(raw)
			if err != nil {
				return "", "INVALID_PUBLIC_KEY", err
			}
			return key, "", nil
		}
		id, err := validatePeerIdentity(raw)
		if err != nil {
			return "", "INVALID_PEER_IDENTITY", err
		}
		return id, "", nil
	}

	removePeer := func(w http.ResponseWriter, r *http.Request, rawProvider, gatewayID, gatewayEndpoint, rawKey, rawIdentity string) {
		provider, err := normalizeProviderType(rawProvider)
		if err != nil {
			writeError(w, http.StatusBadRequest, "UNSUPPORTED_PROVIDER", err.Error())
			return
		}

		// When providerType is omitted on removal, detect active Fortinet/Cisco peers before requiring WireGuard base64 key format.
		candidate := strings.TrimSpace(rawIdentity)
		if candidate == "" {
			candidate = strings.TrimSpace(rawKey)
		}
		if strings.TrimSpace(rawProvider) == "" && candidate != "" {
			for _, candidateProvider := range []string{ProviderFortinet, ProviderCisco} {
				if drivers[candidateProvider].HasPeer(candidate) {
					provider = candidateProvider
					break
				}
			}
		}

		peerID, errCode, err := resolvePeerID(provider, rawKey, rawIdentity)
		if err != nil {
			writeError(w, http.StatusBadRequest, errCode, err.Error())
			return
		}

		driver := drivers[provider]
		if failCode, err := driver.RemovePeer(r.Context(), RemovePeerRequest{
			ProviderType:    provider,
			GatewayID:       strings.TrimSpace(gatewayID),
			GatewayEndpoint: strings.TrimSpace(gatewayEndpoint),
			PeerIdentity:    peerID,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, failCode, err.Error())
			return
		}

		resp := map[string]any{
			"success":   true,
			"publicKey": peerID,
		}
		if provider != ProviderWireGuard || strings.TrimSpace(rawIdentity) != "" {
			resp["providerType"] = provider
			resp["peerIdentity"] = peerID
		}
		writeJSON(w, http.StatusOK, resp)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":    "ok",
			"service":   "mango-vpn-daemon",
			"providers": []string{ProviderWireGuard, ProviderFortinet, ProviderCisco},
		})
	})

	mux.HandleFunc("POST /peers", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ProviderType    string       `json:"providerType,omitempty"`
			GatewayID       string       `json:"gatewayId,omitempty"`
			GatewayEndpoint string       `json:"gatewayEndpoint,omitempty"`
			PublicKey       string       `json:"publicKey"`
			PeerIdentity    string       `json:"peerIdentity,omitempty"`
			AssignedIP      string       `json:"assignedIp"`
			Role            string       `json:"role,omitempty"`
			Policies        []PolicyRule `json:"policies,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
			return
		}

		provider, err := normalizeProviderType(req.ProviderType)
		if err != nil {
			writeError(w, http.StatusBadRequest, "UNSUPPORTED_PROVIDER", err.Error())
			return
		}
		peerID, errCode, err := resolvePeerID(provider, req.PublicKey, req.PeerIdentity)
		if err != nil {
			writeError(w, http.StatusBadRequest, errCode, err.Error())
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

		driver := drivers[provider]
		if failCode, err := driver.AddPeer(r.Context(), AddPeerRequest{
			ProviderType:    provider,
			GatewayID:       strings.TrimSpace(req.GatewayID),
			GatewayEndpoint: strings.TrimSpace(req.GatewayEndpoint),
			PeerIdentity:    peerID,
			AssignedIP:      allowedIP,
			Role:            strings.TrimSpace(req.Role),
			Policies:        validatedPolicies,
			HasPolicies:     req.Policies != nil,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, failCode, err.Error())
			return
		}

		resp := map[string]any{
			"success":    true,
			"publicKey":  peerID,
			"assignedIp": allowedIP,
		}
		if provider != ProviderWireGuard || strings.TrimSpace(req.PeerIdentity) != "" {
			resp["providerType"] = provider
			resp["peerIdentity"] = peerID
		}
		writeJSON(w, http.StatusOK, resp)
	}))

	syncPoliciesHandler := requireAuth(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Peers []struct {
				ProviderType string       `json:"providerType,omitempty"`
				GatewayID    string       `json:"gatewayId,omitempty"`
				PublicKey    string       `json:"publicKey"`
				PeerIdentity string       `json:"peerIdentity,omitempty"`
				AssignedIP   string       `json:"assignedIp"`
				Role         string       `json:"role"`
				Policies     []PolicyRule `json:"policies"`
			} `json:"peers"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
			return
		}

		grouped := map[string][]peerPolicyEntry{
			ProviderWireGuard: {},
			ProviderFortinet:  {},
			ProviderCisco:     {},
		}

		for _, p := range req.Peers {
			provider, err := normalizeProviderType(p.ProviderType)
			if err != nil {
				writeError(w, http.StatusBadRequest, "UNSUPPORTED_PROVIDER", err.Error())
				return
			}
			peerID, errCode, err := resolvePeerID(provider, p.PublicKey, p.PeerIdentity)
			if err != nil {
				writeError(w, http.StatusBadRequest, errCode, err.Error())
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
			grouped[provider] = append(grouped[provider], peerPolicyEntry{
				ProviderType: provider,
				GatewayID:    strings.TrimSpace(p.GatewayID),
				PublicKey:    peerID,
				PeerIdentity: peerID,
				AssignedIP:   allowedIP,
				Role:         strings.TrimSpace(p.Role),
				Policies:     validatedRules,
			})
		}

		if failCode, err := drivers[ProviderWireGuard].SyncPolicies(r.Context(), grouped[ProviderWireGuard]); err != nil {
			writeError(w, http.StatusInternalServerError, failCode, err.Error())
			return
		}
		for _, provider := range []string{ProviderFortinet, ProviderCisco} {
			if len(grouped[provider]) > 0 {
				if failCode, err := drivers[provider].SyncPolicies(r.Context(), grouped[provider]); err != nil {
					writeError(w, http.StatusInternalServerError, failCode, err.Error())
					return
				}
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"peers":   len(req.Peers),
		})
	})

	mux.HandleFunc("POST /policies/sync", syncPoliciesHandler)
	mux.HandleFunc("PUT /peers/policies", syncPoliciesHandler)

	mux.HandleFunc("POST /peers/remove", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ProviderType    string `json:"providerType,omitempty"`
			GatewayID       string `json:"gatewayId,omitempty"`
			GatewayEndpoint string `json:"gatewayEndpoint,omitempty"`
			PublicKey       string `json:"publicKey"`
			PeerIdentity    string `json:"peerIdentity,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
			return
		}
		removePeer(w, r, req.ProviderType, req.GatewayID, req.GatewayEndpoint, req.PublicKey, req.PeerIdentity)
	}))

	mux.HandleFunc("DELETE /peers/{publicKey...}", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		raw := r.PathValue("publicKey")
		decoded, err := url.PathUnescape(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_PUBLIC_KEY", "Malformed public key encoding")
			return
		}
		provider := r.URL.Query().Get("providerType")
		gatewayID := r.URL.Query().Get("gatewayId")
		removePeer(w, r, provider, gatewayID, "", decoded, decoded)
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
		SharedSecret:   secret,
		Interface:      iface,
		Runner:         execCommandRunner{},
		FortiGateURL:   os.Getenv("FORTIGATE_API_URL"),
		FortiGateToken: os.Getenv("FORTIGATE_API_TOKEN"),
		CiscoURL:       os.Getenv("CISCO_API_URL"),
		CiscoToken:     os.Getenv("CISCO_API_TOKEN"),
	})

	log.Printf("MANGO VPN Daemon listening on %s (interface=%s, providers=WIREGUARD,FORTINET,CISCO)", addr, iface)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
