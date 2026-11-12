package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"golang.org/x/crypto/curve25519"
	"golang.org/x/sys/windows/svc"
)

const (
	ServiceName = "MangoVpnAgent"
	ServiceDesc = "MANGO VPN Client Background Service"
	ListenAddr  = "127.0.0.1:47821"
	Version     = "1.0.0-dev"
)

// In-memory state tracking
type TunnelState struct {
	sync.RWMutex
	State          string    `json:"state"` // disconnected, connecting, connected, error
	AssignedIP     string    `json:"assignedIp,omitempty"`
	ServerEndpoint string    `json:"serverEndpoint,omitempty"`
	PublicKey      string    `json:"publicKey,omitempty"`
	PrivateKey     string    `json:"-"`
	ConnectedSince time.Time `json:"connectedSince,omitempty"`
	BytesReceived  uint64    `json:"bytesReceived"`
	BytesSent      uint64    `json:"bytesSent"`
	LastError      string    `json:"lastError,omitempty"`
}

var currentTunnel = &TunnelState{
	State: "disconnected",
}

var startTime = time.Now()

// GenerateCurve25519Keypair generates standard WireGuard private & public keys
func GenerateCurve25519Keypair() (privateKeyBase64, publicKeyBase64 string, err error) {
	var priv [32]byte
	if _, err := rand.Read(priv[:]); err != nil {
		return "", "", err
	}
	// Clamp private key per Curve25519 / WireGuard spec
	priv[0] &= 248
	priv[31] &= 127
	priv[31] |= 64

	var pub [32]byte
	curve25519.ScalarBaseMult(&pub, &priv)

	return base64.StdEncoding.EncodeToString(priv[:]), base64.StdEncoding.EncodeToString(pub[:]), nil
}

// Private Network Access (PNA) & CORS middleware
func withPNA(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// CRITICAL: Chromium Private Network Access (PNA) header
		w.Header().Set("Access-Control-Allow-Private-Network", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next(w, r)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	currentTunnel.RLock()
	active := currentTunnel.State == "connected"
	currentTunnel.RUnlock()

	resp := map[string]interface{}{
		"status":        "ok",
		"service":       ServiceName,
		"version":       Version,
		"uptimeSeconds": int(time.Since(startTime).Seconds()),
		"tunnelActive":  active,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	currentTunnel.RLock()
	defer currentTunnel.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(currentTunnel)
}

func handleConnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AccessToken string `json:"accessToken"`
		BackendURL  string `json:"backendUrl"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.AccessToken == "" {
		http.Error(w, `{"error": "accessToken is required"}`, http.StatusBadRequest)
		return
	}

	currentTunnel.Lock()
	currentTunnel.State = "connecting"
	if currentTunnel.PrivateKey == "" {
		priv, pub, err := GenerateCurve25519Keypair()
		if err != nil {
			currentTunnel.State = "error"
			currentTunnel.LastError = err.Error()
			currentTunnel.Unlock()
			http.Error(w, `{"error": "Failed to generate WireGuard keypair"}`, http.StatusInternalServerError)
			return
		}
		currentTunnel.PrivateKey = priv
		currentTunnel.PublicKey = pub
	}
	currentTunnel.Unlock()

	// In real production: Send POST to backend /api/vpn/connect with PublicKey
	// and invoke wireguard-nt or wireguard.exe /installtunnelservice
	log.Printf("[Agent] Establishing WireGuard tunnel with Public Key: %s", currentTunnel.PublicKey)

	time.Sleep(300 * time.Millisecond) // Simulate handshake

	currentTunnel.Lock()
	currentTunnel.State = "connected"
	currentTunnel.AssignedIP = "10.13.13.45/32"
	currentTunnel.ServerEndpoint = "127.0.0.1:51820"
	currentTunnel.ConnectedSince = time.Now()
	currentTunnel.LastError = ""
	currentTunnel.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"message":    "WireGuard tunnel established",
		"state":      "connected",
		"assignedIp": "10.13.13.45/32",
	})
}

func handleDisconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	currentTunnel.Lock()
	currentTunnel.State = "disconnected"
	currentTunnel.AssignedIP = ""
	currentTunnel.Unlock()

	log.Println("[Agent] WireGuard tunnel teardown completed")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "WireGuard tunnel disconnected",
		"state":   "disconnected",
	})
}

func startHTTPServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", withPNA(handleHealth))
	mux.HandleFunc("/status", withPNA(handleStatus))
	mux.HandleFunc("/connect", withPNA(handleConnect))
	mux.HandleFunc("/disconnect", withPNA(handleDisconnect))

	server := &http.Server{
		Addr:         ListenAddr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	log.Printf("[%s] Loopback HTTP API listening on http://%s", ServiceName, ListenAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP server failed: %v", err)
	}
}

// Windows Service implementation
type mangoService struct{}

func (m *mangoService) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (ssec bool, errno uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	go startHTTPServer()

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}

	for req := range r {
		switch req.Cmd {
		case svc.Interrogate:
			changes <- req.CurrentStatus
		case svc.Stop, svc.Shutdown:
			changes <- svc.Status{State: svc.StopPending}
			return
		default:
			log.Printf("Unexpected control request #%d", req.Cmd)
		}
	}
	return
}

func main() {
	debugFlag := flag.Bool("debug", false, "Run in interactive console mode instead of Windows Service")
	flag.Parse()

	isService, err := svc.IsWindowsService()
	if err != nil {
		log.Fatalf("Failed to detect service context: %v", err)
	}

	if *debugFlag || !isService {
		fmt.Printf("Starting %s in standalone debug mode...\n", ServiceName)
		startHTTPServer()
		return
	}

	if err := svc.Run(ServiceName, &mangoService{}); err != nil {
		log.Fatalf("%s service failed to run: %v", ServiceName, err)
	}
}
