package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func NewMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "mango-agent-windows",
		})
	})
	return mux
}

func main() {
	addr := os.Getenv("AGENT_LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:47821"
	}

	log.Printf("MANGO Windows Agent skeleton listening on %s", addr)
	if err := http.ListenAndServe(addr, NewMux()); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
