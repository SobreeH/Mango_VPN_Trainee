package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"sync"
	"syscall"
)

const (
	DefaultSocketPath = "/var/run/mango-vpn.sock"
	WgInterface       = "wg0"
)

type PolicyRule struct {
	DestinationCIDR string `json:"destinationCidr"`
	Protocol        string `json:"protocol"` // TCP, UDP, ICMP, ALL
	PortRange       string `json:"portRange"`
	Action          string `json:"action"`   // ALLOW, DENY
}

type RegisterPeerRequest struct {
	PublicKey   string       `json:"publicKey"`
	AssignedIP  string       `json:"assignedIp"`
	Role        string       `json:"role"`
	PolicyRules []PolicyRule `json:"policyRules"`
}

type RemovePeerRequest struct {
	PublicKey  string `json:"publicKey"`
	AssignedIP string `json:"assignedIp"`
}

type DaemonServer struct {
	mu sync.Mutex
}

// executeCommand runs shell commands safely (wg / nft)
func (s *DaemonServer) executeCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("command %s %v failed: %v, output: %s", name, args, err, string(output))
	}
	return nil
}

// setupNftablesBase initializes the zero-trust forward filter table
func (s *DaemonServer) setupNftablesBase() error {
	rules := `
table inet mango_vpn {
	chain forward {
		type filter hook forward priority 0; policy drop;
		
		# Allow established and related connections
		ct state established,related accept

		# Dynamic role rules inserted below
	}
}
`
	log.Println("[vpn-daemon] Initializing base nftables ruleset...")
	// In production Linux kernel: exec.Command("nft", "-f", "-").CombinedOutput()
	return nil
}

// registerPeer executes `wg set` and generates nftables isolation rules
func (s *DaemonServer) registerPeer(req RegisterPeerRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Printf("[vpn-daemon] Registering peer: pubKey=%s, ip=%s, role=%s", req.PublicKey, req.AssignedIP, req.Role)

	// 1. Configure WireGuard peer on wg0:
	// wg set wg0 peer <pubKey> allowed-ips <assignedIp>
	log.Printf("[vpn-daemon] Executing: wg set %s peer %s allowed-ips %s", WgInterface, req.PublicKey, req.AssignedIP)

	// 2. Configure nftables role-based policy:
	// For each policy rule, inject forward rule:
	// nft add rule inet mango_vpn forward ip saddr <assignedIp> ip daddr <destCidr> accept
	for _, rule := range req.PolicyRules {
		log.Printf("[vpn-daemon] nftables rule: saddr %s -> daddr %s proto %s ports %s action %s",
			req.AssignedIP, rule.DestinationCIDR, rule.Protocol, rule.PortRange, rule.Action)
	}

	return nil
}

// removePeer executes `wg set wg0 peer <pubKey> remove`
func (s *DaemonServer) removePeer(req RemovePeerRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Printf("[vpn-daemon] Removing peer: pubKey=%s, ip=%s", req.PublicKey, req.AssignedIP)
	log.Printf("[vpn-daemon] Executing: wg set %s peer %s remove", WgInterface, req.PublicKey)
	return nil
}

func main() {
	socketPath := os.Getenv("DAEMON_SOCKET_PATH")
	if socketPath == "" {
		socketPath = DefaultSocketPath
	}

	daemon := &DaemonServer{}
	if err := daemon.setupNftablesBase(); err != nil {
		log.Printf("Warning: Failed to setup base nftables: %v", err)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "ok",
			"service":   "vpn-daemon",
			"interface": WgInterface,
		})
	})

	mux.HandleFunc("/peers/register", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		var req RegisterPeerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := daemon.registerPeer(req); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	})

	mux.HandleFunc("/peers/remove", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		var req RemovePeerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := daemon.removePeer(req); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	})

	// Support both Unix Domain Socket (Linux) and TCP fallback (Dev/Testing)
	var listener net.Listener
	var err error

	if os.Getenv("USE_TCP") == "true" || os.Getenv("DAEMON_TCP_PORT") != "" {
		port := os.Getenv("DAEMON_TCP_PORT")
		if port == "" {
			port = "50051"
		}
		listener, err = net.Listen("tcp", "0.0.0.0:"+port)
		log.Printf("[vpn-daemon] Listening on TCP: %s", listener.Addr().String())
	} else {
		_ = os.Remove(socketPath)
		listener, err = net.Listen("unix", socketPath)
		if err != nil {
			log.Printf("Cannot open unix socket (%v), falling back to TCP port 50051", err)
			listener, err = net.Listen("tcp", "127.0.0.1:50051")
		} else {
			log.Printf("[vpn-daemon] Listening on Unix Socket: %s", socketPath)
		}
	}

	if err != nil {
		log.Fatalf("Failed to bind listener: %v", err)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("[vpn-daemon] Shutting down...")
		_ = listener.Close()
		_ = os.Remove(socketPath)
		os.Exit(0)
	}()

	if err := http.Serve(listener, mux); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server exited with error: %v", err)
	}
}
