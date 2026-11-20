//go:build windows

package main

import (
	"net/http"
	"testing"
	"time"

	"golang.org/x/sys/windows/svc"
)

func TestMangoServiceExecuteTransitionsAndStopsCleanly(t *testing.T) {
	service := &mangoService{
		server: &http.Server{
			Addr:    "127.0.0.1:0",
			Handler: http.NewServeMux(),
		},
	}

	reqCh := make(chan svc.ChangeRequest, 2)
	statusCh := make(chan svc.Status, 8)
	doneCh := make(chan struct {
		svcSpecificEC bool
		exitCode      uint32
	}, 1)

	go func() {
		s, code := service.Execute(nil, reqCh, statusCh)
		doneCh <- struct {
			svcSpecificEC bool
			exitCode      uint32
		}{s, code}
	}()

	// Expect StartPending then Running
	first := <-statusCh
	if first.State != svc.StartPending {
		t.Fatalf("expected StartPending, got %v", first.State)
	}
	second := <-statusCh
	if second.State != svc.Running {
		t.Fatalf("expected Running, got %v", second.State)
	}

	// Send Stop and expect StopPending + clean exit
	reqCh <- svc.ChangeRequest{Cmd: svc.Stop}

	third := <-statusCh
	if third.State != svc.StopPending {
		t.Fatalf("expected StopPending, got %v", third.State)
	}

	select {
	case res := <-doneCh:
		if res.svcSpecificEC || res.exitCode != 0 {
			t.Fatalf("expected clean exit (false, 0), got (%v, %d)", res.svcSpecificEC, res.exitCode)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for service Execute to return")
	}
}
