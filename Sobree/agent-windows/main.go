package main

import (
	"bytes"
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	pairingTokenHeader = "X-Mango-Agent-Token"
	defaultListenAddr  = "127.0.0.1:47821"
	defaultVersion     = "2.0.0"
	defaultApiBaseURL  = "http://localhost:4000"
	tunnelIfaceName    = "mango0"
)

// TunnelConfig holds the WireGuard interface configuration applied by WireGuardRunner.
type TunnelConfig struct {
	InterfaceName   string
	PrivateKeyB64   string
	AssignedIP      string
	ServerPublicKey string
	ServerEndpoint  string
	AllowedIPs      []string
	DNS             []string
}

// WireGuardRunner abstracts local WireGuard tunnel activation/teardown (wireguard.exe / WinTun).
type WireGuardRunner interface {
	Activate(ctx context.Context, cfg TunnelConfig) error
	Deactivate(ctx context.Context, interfaceName string) error
}

type commandExecFunc func(ctx context.Context, name string, args ...string) ([]byte, error)

func defaultCommandExec(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}

func tunnelConfigPath(baseDir, interfaceName string) string {
	if strings.TrimSpace(baseDir) == "" {
		baseDir = os.TempDir()
	}
	return filepath.Join(baseDir, "mango-vpn", interfaceName+".conf")
}

func writeTunnelConfigFile(baseDir string, cfg TunnelConfig) (string, error) {
	confPath := tunnelConfigPath(baseDir, cfg.InterfaceName)
	if err := os.MkdirAll(filepath.Dir(confPath), 0o700); err != nil {
		return "", err
	}
	allowed := strings.Join(cfg.AllowedIPs, ", ")
	if allowed == "" {
		allowed = "10.13.13.0/24"
	}
	dns := strings.Join(cfg.DNS, ", ")
	content := fmt.Sprintf("[Interface]\nPrivateKey = %s\nAddress = %s/32\n", cfg.PrivateKeyB64, cfg.AssignedIP)
	if dns != "" {
		content += fmt.Sprintf("DNS = %s\n", dns)
	}
	content += fmt.Sprintf("\n[Peer]\nPublicKey = %s\nEndpoint = %s\nAllowedIPs = %s\nPersistentKeepalive = 25\n",
		cfg.ServerPublicKey, cfg.ServerEndpoint, allowed)

	if err := os.WriteFile(confPath, []byte(content), 0o600); err != nil {
		return "", err
	}
	return confPath, nil
}

type windowsWireGuardRunner struct {
	BaseDir string
	Exec    commandExecFunc
}

func (r windowsWireGuardRunner) execFn() commandExecFunc {
	if r.Exec != nil {
		return r.Exec
	}
	return defaultCommandExec
}

func (r windowsWireGuardRunner) Activate(ctx context.Context, cfg TunnelConfig) error {
	confPath, err := writeTunnelConfigFile(r.BaseDir, cfg)
	if err != nil {
		return err
	}
	out, err := r.execFn()(ctx, "wireguard.exe", "/installtunnelservice", confPath)
	if err != nil {
		_ = os.Remove(confPath)
		return fmt.Errorf("wireguard.exe install failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (r windowsWireGuardRunner) Deactivate(ctx context.Context, interfaceName string) error {
	confPath := tunnelConfigPath(r.BaseDir, interfaceName)
	out, err := r.execFn()(ctx, "wireguard.exe", "/uninstalltunnelservice", interfaceName)
	_ = os.Remove(confPath)
	if err != nil {
		return fmt.Errorf("wireguard.exe uninstall failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

type linuxWireGuardRunner struct {
	BaseDir string
	Exec    commandExecFunc
}

func (r linuxWireGuardRunner) execFn() commandExecFunc {
	if r.Exec != nil {
		return r.Exec
	}
	return defaultCommandExec
}

func (r linuxWireGuardRunner) Activate(ctx context.Context, cfg TunnelConfig) error {
	confPath, err := writeTunnelConfigFile(r.BaseDir, cfg)
	if err != nil {
		return err
	}
	out, err := r.execFn()(ctx, "wg-quick", "up", confPath)
	if err != nil {
		_ = os.Remove(confPath)
		return fmt.Errorf("wg-quick up failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (r linuxWireGuardRunner) Deactivate(ctx context.Context, interfaceName string) error {
	confPath := tunnelConfigPath(r.BaseDir, interfaceName)
	target := interfaceName
	if _, statErr := os.Stat(confPath); statErr == nil {
		target = confPath
	}
	out, err := r.execFn()(ctx, "wg-quick", "down", target)
	_ = os.Remove(confPath)
	if err != nil {
		return fmt.Errorf("wg-quick down failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func defaultWireGuardRunnerForOS(goos string) WireGuardRunner {
	if goos == "linux" {
		return linuxWireGuardRunner{}
	}
	return windowsWireGuardRunner{}
}

func defaultPlatform(goos, goarch string) string {
	arch := goarch
	switch goarch {
	case "amd64":
		arch = "x64"
	case "arm64":
		arch = "arm64"
	}
	return goos + "-" + arch
}

// AgentConfig configures the loopback Windows Agent HTTP handler.
type AgentConfig struct {
	AllowedOrigins    []string
	PairingToken      string
	Version           string
	ApiBaseURL        string
	DeviceFingerprint string
	Hostname          string
	Platform          string
	HTTPClient        *http.Client
	WgRunner          WireGuardRunner
}

type agentState struct {
	mu             sync.RWMutex
	startedAt      time.Time
	version        string
	state          string
	privateKey     *ecdh.PrivateKey
	publicKeyB64   string
	sessionID      *string
	assignedIP     *string
	serverEndpoint *string
	allowedIPs     []string
	connectedSince *string
	bytesReceived  int64
	bytesSent      int64
	lastError      *string
}

type apiErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type apiErrorResponse struct {
	Success bool         `json:"success"`
	Error   apiErrorBody `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, apiErrorResponse{
		Success: false,
		Error: apiErrorBody{
			Code:    code,
			Message: message,
		},
	})
}

func isOriginAllowed(origin string, allowed []string) bool {
	for _, item := range allowed {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" && trimmed != "*" && trimmed == origin {
			return true
		}
	}
	return false
}

func setAllowedCorsAndPnaHeaders(w http.ResponseWriter, r *http.Request, origin string) {
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Mango-Agent-Token, Access-Control-Request-Private-Network")
	if r.Method == http.MethodOptions || strings.EqualFold(r.Header.Get("Access-Control-Request-Private-Network"), "true") {
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
	}
}

func generateCurve25519Keypair() (*ecdh.PrivateKey, string, error) {
	priv, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		return nil, "", err
	}
	pubB64 := base64.StdEncoding.EncodeToString(priv.PublicKey().Bytes())
	return priv, pubB64, nil
}

// NewHandler creates the loopback HTTP handler enforcing strict Origin allowlisting,
// Chromium PNA preflight headers, and local pairing token authentication.
func NewHandler(cfg AgentConfig) http.Handler {
	version := cfg.Version
	if version == "" {
		version = defaultVersion
	}
	apiBaseURL := strings.TrimRight(strings.TrimSpace(cfg.ApiBaseURL), "/")
	if apiBaseURL == "" {
		apiBaseURL = defaultApiBaseURL
	}
	platform := strings.TrimSpace(cfg.Platform)
	if platform == "" {
		platform = defaultPlatform(runtime.GOOS, runtime.GOARCH)
	}
	hostname := strings.TrimSpace(cfg.Hostname)
	if hostname == "" {
		h, err := os.Hostname()
		if err == nil && h != "" {
			hostname = h
		} else if runtime.GOOS == "linux" {
			hostname = "LINUX-CLIENT"
		} else {
			hostname = "WINDOWS-CLIENT"
		}
	}
	fingerprint := strings.TrimSpace(cfg.DeviceFingerprint)
	if fingerprint == "" {
		sum := sha256.Sum256([]byte(hostname + ":" + version))
		prefix := "win-"
		if strings.HasPrefix(platform, "linux") {
			prefix = "lnx-"
		}
		fingerprint = prefix + hex.EncodeToString(sum[:12])
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}
	wgRunner := cfg.WgRunner
	if wgRunner == nil {
		wgRunner = defaultWireGuardRunnerForOS(runtime.GOOS)
	}

	priv, pubB64, err := generateCurve25519Keypair()
	if err != nil {
		log.Fatalf("failed to generate Curve25519 keypair: %v", err)
	}

	st := &agentState{
		startedAt:    time.Now().UTC(),
		version:      version,
		state:        "disconnected",
		privateKey:   priv,
		publicKeyB64: pubB64,
		allowedIPs:   []string{},
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		st.mu.RLock()
		uptime := int64(time.Since(st.startedAt).Seconds())
		tunnelActive := st.state == "connected"
		ver := st.version
		st.mu.RUnlock()

		writeJSON(w, http.StatusOK, map[string]any{
			"status":        "ok",
			"service":       "mango-agent-windows",
			"version":       ver,
			"uptimeSeconds": uptime,
			"tunnelActive":  tunnelActive,
		})
	})

	requirePairing := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			provided := r.Header.Get(pairingTokenHeader)
			if cfg.PairingToken == "" || provided == "" ||
				subtle.ConstantTimeCompare([]byte(provided), []byte(cfg.PairingToken)) != 1 {
				writeError(w, http.StatusUnauthorized, "INVALID_PAIRING_TOKEN", "Missing or invalid pairing token")
				return
			}
			next(w, r)
		}
	}

	mux.HandleFunc("GET /status", requirePairing(func(w http.ResponseWriter, _ *http.Request) {
		st.mu.RLock()
		defer st.mu.RUnlock()

		writeJSON(w, http.StatusOK, map[string]any{
			"state":          st.state,
			"version":        st.version,
			"publicKey":      st.publicKeyB64,
			"sessionId":      st.sessionID,
			"assignedIp":     st.assignedIP,
			"serverEndpoint": st.serverEndpoint,
			"allowedIps":     st.allowedIPs,
			"connectedSince": st.connectedSince,
			"bytesReceived":  st.bytesReceived,
			"bytesSent":      st.bytesSent,
			"lastError":      st.lastError,
		})
	}))

	notifyApiDisconnect := func(ctx context.Context, sessionID *string, pubKey string) {
		payload := map[string]any{
			"publicKey":         pubKey,
			"deviceFingerprint": fingerprint,
		}
		if sessionID != nil && *sessionID != "" {
			payload["sessionId"] = *sessionID
		}
		body, _ := json.Marshal(payload)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBaseURL+"/api/vpn/disconnect", bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := httpClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
		}
	}

	mux.HandleFunc("POST /connect", requirePairing(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Ticket string `json:"ticket"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
			return
		}
		ticket := strings.TrimSpace(req.Ticket)
		if ticket == "" {
			writeError(w, http.StatusBadRequest, "MISSING_TICKET", "Connect ticket is required")
			return
		}

		newPriv, newPubB64, err := generateCurve25519Keypair()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "KEYGEN_FAILED", "Failed to generate Curve25519 keypair")
			return
		}

		st.mu.Lock()
		st.privateKey = newPriv
		st.publicKeyB64 = newPubB64
		st.state = "connecting"
		st.lastError = nil
		st.mu.Unlock()

		apiPayload, _ := json.Marshal(map[string]string{
			"ticket":            ticket,
			"publicKey":         newPubB64,
			"deviceFingerprint": fingerprint,
			"hostname":          hostname,
			"agentVersion":      version,
			"platform":          platform,
		})
		apiReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, apiBaseURL+"/api/vpn/connect", bytes.NewReader(apiPayload))
		if err != nil {
			errMsg := err.Error()
			st.mu.Lock()
			st.state = "error"
			st.lastError = &errMsg
			st.mu.Unlock()
			writeError(w, http.StatusInternalServerError, "CONNECT_REQUEST_FAILED", errMsg)
			return
		}
		apiReq.Header.Set("Content-Type", "application/json")

		apiResp, err := httpClient.Do(apiReq)
		if err != nil {
			errMsg := fmt.Sprintf("Failed to reach control plane API: %v", err)
			st.mu.Lock()
			st.state = "error"
			st.lastError = &errMsg
			st.mu.Unlock()
			writeError(w, http.StatusBadGateway, "API_UNREACHABLE", errMsg)
			return
		}
		defer apiResp.Body.Close()

		if apiResp.StatusCode < 200 || apiResp.StatusCode >= 300 {
			var errBody struct {
				Message string `json:"message"`
			}
			_ = json.NewDecoder(apiResp.Body).Decode(&errBody)
			errMsg := errBody.Message
			if errMsg == "" {
				errMsg = fmt.Sprintf("Control plane API returned HTTP %d", apiResp.StatusCode)
			}
			st.mu.Lock()
			st.state = "error"
			st.lastError = &errMsg
			st.mu.Unlock()
			writeError(w, apiResp.StatusCode, "API_CONNECT_REJECTED", errMsg)
			return
		}

		var connectData struct {
			SessionID       string   `json:"sessionId"`
			AssignedIP      string   `json:"assignedIp"`
			ServerPublicKey string   `json:"serverPublicKey"`
			ServerEndpoint  string   `json:"serverEndpoint"`
			AllowedIPs      []string `json:"allowedIps"`
			DNS             []string `json:"dns"`
			ConnectedAt     string   `json:"connectedAt"`
		}
		if err := json.NewDecoder(apiResp.Body).Decode(&connectData); err != nil {
			errMsg := "Invalid response from control plane API"
			st.mu.Lock()
			st.state = "error"
			st.lastError = &errMsg
			st.mu.Unlock()
			writeError(w, http.StatusBadGateway, "INVALID_API_RESPONSE", errMsg)
			return
		}

		privB64 := base64.StdEncoding.EncodeToString(newPriv.Bytes())
		if err := wgRunner.Activate(r.Context(), TunnelConfig{
			InterfaceName:   tunnelIfaceName,
			PrivateKeyB64:   privB64,
			AssignedIP:      connectData.AssignedIP,
			ServerPublicKey: connectData.ServerPublicKey,
			ServerEndpoint:  connectData.ServerEndpoint,
			AllowedIPs:      connectData.AllowedIPs,
			DNS:             connectData.DNS,
		}); err != nil {
			errMsg := err.Error()
			sessID := connectData.SessionID
			notifyApiDisconnect(r.Context(), &sessID, newPubB64)
			st.mu.Lock()
			st.state = "error"
			st.lastError = &errMsg
			st.mu.Unlock()
			writeError(w, http.StatusInternalServerError, "WIREGUARD_ACTIVATE_FAILED", errMsg)
			return
		}

		sessID := connectData.SessionID
		assignedIP := connectData.AssignedIP
		endpoint := connectData.ServerEndpoint
		connectedSince := connectData.ConnectedAt
		if connectedSince == "" {
			connectedSince = time.Now().UTC().Format(time.RFC3339)
		}

		st.mu.Lock()
		st.state = "connected"
		st.sessionID = &sessID
		st.assignedIP = &assignedIP
		st.serverEndpoint = &endpoint
		st.allowedIPs = connectData.AllowedIPs
		st.connectedSince = &connectedSince
		st.lastError = nil
		st.mu.Unlock()

		writeJSON(w, http.StatusOK, map[string]any{
			"success":        true,
			"message":        "WireGuard tunnel connected",
			"state":          "connected",
			"publicKey":      newPubB64,
			"sessionId":      sessID,
			"assignedIp":     assignedIP,
			"serverEndpoint": endpoint,
			"allowedIps":     connectData.AllowedIPs,
			"connectedSince": connectedSince,
		})
	}))

	mux.HandleFunc("POST /disconnect", requirePairing(func(w http.ResponseWriter, r *http.Request) {
		st.mu.RLock()
		sessID := st.sessionID
		pubKey := st.publicKeyB64
		wasConnected := st.state == "connected"
		st.mu.RUnlock()

		if wasConnected {
			if err := wgRunner.Deactivate(r.Context(), tunnelIfaceName); err != nil {
				errMsg := err.Error()
				st.mu.Lock()
				st.lastError = &errMsg
				st.mu.Unlock()
				writeError(w, http.StatusInternalServerError, "WIREGUARD_DEACTIVATE_FAILED", errMsg)
				return
			}
			notifyApiDisconnect(r.Context(), sessID, pubKey)
		}

		st.mu.Lock()
		st.state = "disconnected"
		st.sessionID = nil
		st.assignedIP = nil
		st.serverEndpoint = nil
		st.allowedIPs = []string{}
		st.connectedSince = nil
		st.bytesReceived = 0
		st.bytesSent = 0
		st.lastError = nil
		st.mu.Unlock()

		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "WireGuard tunnel disconnected",
			"state":   "disconnected",
		})
	}))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !isOriginAllowed(origin, cfg.AllowedOrigins) {
				writeError(w, http.StatusForbidden, "FORBIDDEN_ORIGIN", "Origin is not in the agent allowlist")
				return
			}
			setAllowedCorsAndPnaHeaders(w, r, origin)
		}

		if r.Method == http.MethodOptions {
			if origin == "" {
				writeError(w, http.StatusForbidden, "FORBIDDEN_ORIGIN", "Origin header is required for preflight")
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}

		mux.ServeHTTP(w, r)
	})
}

func getenvFirst(keys ...string) string {
	for _, key := range keys {
		if val := strings.TrimSpace(os.Getenv(key)); val != "" {
			return val
		}
	}
	return ""
}

func generatePairingToken() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		log.Fatalf("failed to generate pairing token: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}

func main() {
	addr := getenvFirst("AGENT_LISTEN_ADDR", "MANGO_AGENT_ADDR")
	if addr == "" {
		addr = defaultListenAddr
	}

	originsEnv := getenvFirst("AGENT_ALLOWED_ORIGINS", "MANGO_AGENT_ALLOWED_ORIGINS")
	if originsEnv == "" {
		originsEnv = "http://localhost:3000,http://127.0.0.1:3000"
	}
	allowedOrigins := strings.Split(originsEnv, ",")

	pairingToken := getenvFirst("AGENT_PAIRING_TOKEN", "MANGO_AGENT_PAIRING_TOKEN")
	if pairingToken == "" {
		pairingToken = generatePairingToken()
		log.Printf("Generated ephemeral AGENT_PAIRING_TOKEN for local session")
	}

	apiBaseURL := getenvFirst("API_URL", "MANGO_API_URL")
	if apiBaseURL == "" {
		apiBaseURL = defaultApiBaseURL
	}

	hostname := getenvFirst("AGENT_HOSTNAME")
	fingerprint := getenvFirst("AGENT_DEVICE_FINGERPRINT")
	platform := getenvFirst("AGENT_PLATFORM", "MANGO_AGENT_PLATFORM")

	handler := NewHandler(AgentConfig{
		AllowedOrigins:    allowedOrigins,
		PairingToken:      pairingToken,
		Version:           defaultVersion,
		ApiBaseURL:        apiBaseURL,
		Hostname:          hostname,
		DeviceFingerprint: fingerprint,
		Platform:          platform,
	})

	if err := runAgent(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
