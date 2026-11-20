//go:build !windows

package main

import (
	"log"
	"net/http"
)

func runAgent(addr string, handler http.Handler) error {
	log.Printf("MANGO Windows Agent listening on %s", addr)
	return http.ListenAndServe(addr, handler)
}
