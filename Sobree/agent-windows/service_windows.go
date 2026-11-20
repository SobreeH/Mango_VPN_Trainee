//go:build windows

package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"golang.org/x/sys/windows/svc"
)

const windowsServiceName = "MangoVpnAgent"

type mangoService struct {
	server *http.Server
}

func (m *mangoService) Execute(_ []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (bool, uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	errCh := make(chan error, 1)
	go func() {
		if err := m.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}

	for {
		select {
		case err := <-errCh:
			log.Printf("windows service server error: %v", err)
			return false, 1
		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				changes <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				changes <- svc.Status{State: svc.StopPending}
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				_ = m.server.Shutdown(ctx)
				cancel()
				return false, 0
			}
		}
	}
}

func runAgent(addr string, handler http.Handler) error {
	isService, err := svc.IsWindowsService()
	if err == nil && isService {
		return svc.Run(windowsServiceName, &mangoService{
			server: &http.Server{
				Addr:    addr,
				Handler: handler,
			},
		})
	}

	log.Printf("MANGO Windows Agent listening on %s", addr)
	return http.ListenAndServe(addr, handler)
}
