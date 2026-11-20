package main

import (
	"crypto/ecdh"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	pairingTokenHeader = "X-Mango-Agent-Token"
	defaultListenAddr  = "127.0.0.1:47821"
	defaultVersion     = "2.0.0"
)

// AgentConfig configures the loopback Windows Agent HTTP handler.
type AgentConfig struct {
	AllowedOrigins []string
	PairingToken   string
	Version        string
}

type agentState struct {
	mu             sync.RWMutex
	startedAt      time.Time
	version        string
	state          string
	privateKey     *ecdh.PrivateKey
	publicKeyB64   string
	assignedIP     *string
	serverEndpoint *string
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
			"assignedIp":     st.assignedIP,
			"serverEndpoint": st.serverEndpoint,
			"connectedSince": st.connectedSince,
			"bytesReceived":  st.bytesReceived,
			"bytesSent":      st.bytesSent,
			"lastError":      st.lastError,
		})
	}))

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
		assignedIP := st.assignedIP
		serverEndpoint := st.serverEndpoint
		connectedSince := st.connectedSince
		st.mu.Unlock()

		writeJSON(w, http.StatusOK, map[string]any{
			"success":        true,
			"message":        "Curve25519 keypair generated and Connect Ticket accepted",
			"state":          "connecting",
			"publicKey":      newPubB64,
			"assignedIp":     assignedIP,
			"serverEndpoint": serverEndpoint,
			"connectedSince": connectedSince,
		})
	}))

	mux.HandleFunc("POST /disconnect", requirePairing(func(w http.ResponseWriter, _ *http.Request) {
		st.mu.Lock()
		st.state = "disconnected"
		st.assignedIP = nil
		st.serverEndpoint = nil
		st.connectedSince = nil
		st.bytesReceived = 0
		st.bytesSent = 0
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

func generatePairingToken() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		log.Fatalf("failed to generate pairing token: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}

func main() {
	addr := os.Getenv("AGENT_LISTEN_ADDR")
	if addr == "" {
		addr = defaultListenAddr
	}

	originsEnv := os.Getenv("AGENT_ALLOWED_ORIGINS")
	if originsEnv == "" {
		originsEnv = "http://localhost:3000,http://127.0.0.1:3000"
	}
	allowedOrigins := strings.Split(originsEnv, ",")

	pairingToken := os.Getenv("AGENT_PAIRING_TOKEN")
	if pairingToken == "" {
		pairingToken = generatePairingToken()
		log.Printf("Generated ephemeral AGENT_PAIRING_TOKEN for local session")
	}

	handler := NewHandler(AgentConfig{
		AllowedOrigins: allowedOrigins,
		PairingToken:   pairingToken,
		Version:        defaultVersion,
	})

	log.Printf("MANGO Windows Agent listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
