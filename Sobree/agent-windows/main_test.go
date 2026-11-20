package main

import (
	"bytes"
	"context"
	"crypto/ecdh"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeWireGuardRunner struct {
	activated   []TunnelConfig
	deactivated int
	activateErr error
}

func (f *fakeWireGuardRunner) Activate(_ context.Context, cfg TunnelConfig) error {
	if f.activateErr != nil {
		return f.activateErr
	}
	f.activated = append(f.activated, cfg)
	return nil
}

func (f *fakeWireGuardRunner) Deactivate(_ context.Context, _ string) error {
	f.deactivated++
	return nil
}

func newFakeApiServer(status int) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/api/vpn/connect" {
			if status != http.StatusOK {
				w.WriteHeader(status)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"statusCode": status,
					"error":      "Unauthorized",
					"message":    "Connect ticket has expired",
				})
				return
			}
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sessionId":       "sess-test-1",
				"assignedIp":      "10.13.13.4",
				"serverPublicKey": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
				"serverEndpoint":  "127.0.0.1:51820",
				"allowedIps":      []string{"10.20.0.0/16"},
				"dns":             []string{"1.1.1.1"},
				"connectedAt":     "2026-11-20T02:00:00Z",
			})
			return
		}
		if r.URL.Path == "/api/vpn/disconnect" {
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success":        true,
				"sessionId":      "sess-test-1",
				"disconnectedAt": "2026-11-20T02:05:00Z",
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
}

func newTestAgentHandler() http.Handler {
	apiSrv := newFakeApiServer(http.StatusOK)
	return NewHandler(AgentConfig{
		AllowedOrigins:    []string{"http://localhost:3000", "https://portal.mango.internal"},
		PairingToken:      "test-pairing-token-32bytes-minimum",
		Version:           "2.0.0-test",
		ApiBaseURL:        apiSrv.URL,
		DeviceFingerprint: "fp-unit-test",
		Hostname:          "TEST-HOST",
		WgRunner:          &fakeWireGuardRunner{},
	})
}

func TestHealthEndpointAllowsReachabilityWithoutPairingToken(t *testing.T) {
	handler := newTestAgentHandler()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("expected exact allowed origin, got %q", got)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode JSON: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %v", body["status"])
	}
	if body["service"] != "mango-agent-windows" {
		t.Fatalf("expected service mango-agent-windows, got %v", body["service"])
	}
}

func TestStrictOriginAllowlistAndPnaPreflight(t *testing.T) {
	handler := newTestAgentHandler()

	// 1. Allowed Origin PNA preflight
	reqAllowed := httptest.NewRequest(http.MethodOptions, "/connect", nil)
	reqAllowed.Header.Set("Origin", "http://localhost:3000")
	reqAllowed.Header.Set("Access-Control-Request-Method", "POST")
	reqAllowed.Header.Set("Access-Control-Request-Private-Network", "true")
	recAllowed := httptest.NewRecorder()

	handler.ServeHTTP(recAllowed, reqAllowed)

	if recAllowed.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for allowed PNA preflight, got %d", recAllowed.Code)
	}
	if got := recAllowed.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("expected Access-Control-Allow-Origin http://localhost:3000, got %q", got)
	}
	if got := recAllowed.Header().Get("Access-Control-Allow-Private-Network"); got != "true" {
		t.Fatalf("expected Access-Control-Allow-Private-Network true, got %q", got)
	}
	if allowHeaders := recAllowed.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(allowHeaders, "X-Mango-Agent-Token") {
		t.Fatalf("expected X-Mango-Agent-Token in Access-Control-Allow-Headers, got %q", allowHeaders)
	}

	// 2. Untrusted Origin on preflight and on /status, /connect, /disconnect must be rejected with 403
	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodOptions, "/connect"},
		{http.MethodGet, "/status"},
		{http.MethodPost, "/connect"},
		{http.MethodPost, "/disconnect"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		req.Header.Set("Origin", "https://evil.example.com")
		req.Header.Set("X-Mango-Agent-Token", "test-pairing-token-32bytes-minimum")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("%s %s from untrusted origin: expected 403, got %d", tc.method, tc.path, rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("%s %s from untrusted origin must not set Access-Control-Allow-Origin, got %q", tc.method, tc.path, got)
		}
	}
}

func TestPairingTokenRequiredOnProtectedEndpoints(t *testing.T) {
	handler := newTestAgentHandler()

	for _, tc := range []struct {
		method string
		path   string
		token  string
	}{
		{http.MethodGet, "/status", ""},
		{http.MethodGet, "/status", "wrong-token"},
		{http.MethodPost, "/connect", ""},
		{http.MethodPost, "/connect", "wrong-token"},
		{http.MethodPost, "/disconnect", ""},
		{http.MethodPost, "/disconnect", "wrong-token"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(`{"ticket":"t1"}`))
		req.Header.Set("Origin", "http://localhost:3000")
		if tc.token != "" {
			req.Header.Set("X-Mango-Agent-Token", tc.token)
		}
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s (token=%q): expected 401, got %d", tc.method, tc.path, tc.token, rec.Code)
		}
	}
}

func TestConnectGeneratesCurve25519KeypairAndRequiresTicket(t *testing.T) {
	handler := newTestAgentHandler()

	// 1. Missing ticket -> 400
	reqMissing := httptest.NewRequest(http.MethodPost, "/connect", bytes.NewBufferString(`{}`))
	reqMissing.Header.Set("Origin", "http://localhost:3000")
	reqMissing.Header.Set("X-Mango-Agent-Token", "test-pairing-token-32bytes-minimum")
	recMissing := httptest.NewRecorder()
	handler.ServeHTTP(recMissing, reqMissing)
	if recMissing.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when ticket is missing, got %d", recMissing.Code)
	}

	// 2. Valid ticket -> 200 with valid 32-byte X25519 publicKey
	reqConnect := httptest.NewRequest(http.MethodPost, "/connect", bytes.NewBufferString(`{"ticket":"valid-one-time-ticket"}`))
	reqConnect.Header.Set("Origin", "http://localhost:3000")
	reqConnect.Header.Set("X-Mango-Agent-Token", "test-pairing-token-32bytes-minimum")
	recConnect := httptest.NewRecorder()
	handler.ServeHTTP(recConnect, reqConnect)
	if recConnect.Code != http.StatusOK {
		t.Fatalf("expected 200 on valid /connect, got %d (%s)", recConnect.Code, recConnect.Body.String())
	}

	var connectBody map[string]any
	if err := json.NewDecoder(recConnect.Body).Decode(&connectBody); err != nil {
		t.Fatalf("failed to decode /connect response: %v", err)
	}

	pubKeyB64, ok := connectBody["publicKey"].(string)
	if !ok || pubKeyB64 == "" {
		t.Fatalf("expected non-empty publicKey in /connect response, got %v", connectBody["publicKey"])
	}
	rawPub, err := base64.StdEncoding.DecodeString(pubKeyB64)
	if err != nil {
		t.Fatalf("publicKey is not valid base64: %v", err)
	}
	if len(rawPub) != 32 {
		t.Fatalf("expected 32-byte Curve25519 public key, got %d bytes", len(rawPub))
	}
	if _, err := ecdh.X25519().NewPublicKey(rawPub); err != nil {
		t.Fatalf("publicKey is not a valid X25519 public key: %v", err)
	}

	// Private key must never be returned
	if _, hasPriv := connectBody["privateKey"]; hasPriv {
		t.Fatalf("privateKey must never be exposed in HTTP response")
	}

	// 3. GET /status reflects the keypair and state
	reqStatus := httptest.NewRequest(http.MethodGet, "/status", nil)
	reqStatus.Header.Set("Origin", "http://localhost:3000")
	reqStatus.Header.Set("X-Mango-Agent-Token", "test-pairing-token-32bytes-minimum")
	recStatus := httptest.NewRecorder()
	handler.ServeHTTP(recStatus, reqStatus)
	if recStatus.Code != http.StatusOK {
		t.Fatalf("expected 200 on /status, got %d", recStatus.Code)
	}

	// 4. POST /disconnect resets state
	reqDisc := httptest.NewRequest(http.MethodPost, "/disconnect", nil)
	reqDisc.Header.Set("Origin", "http://localhost:3000")
	reqDisc.Header.Set("X-Mango-Agent-Token", "test-pairing-token-32bytes-minimum")
	recDisc := httptest.NewRecorder()
	handler.ServeHTTP(recDisc, reqDisc)
	if recDisc.Code != http.StatusOK {
		t.Fatalf("expected 200 on /disconnect, got %d", recDisc.Code)
	}
}

func TestConnectRedeemsTicketWithApiAndActivatesTunnel(t *testing.T) {
	var connectPayload map[string]any
	var disconnectPayload map[string]any

	apiSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/vpn/connect":
			_ = json.NewDecoder(r.Body).Decode(&connectPayload)
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sessionId":       "sess-42",
				"assignedIp":      "10.13.13.7",
				"serverPublicKey": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
				"serverEndpoint":  "vpn.mango.internal:51820",
				"allowedIps":      []string{"10.20.0.0/16", "10.30.0.0/16"},
				"dns":             []string{"1.1.1.1"},
				"connectedAt":     "2026-11-20T02:00:00Z",
			})
		case "/api/vpn/disconnect":
			_ = json.NewDecoder(r.Body).Decode(&disconnectPayload)
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success":        true,
				"sessionId":      "sess-42",
				"disconnectedAt": "2026-11-20T02:05:00Z",
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer apiSrv.Close()

	wgRunner := &fakeWireGuardRunner{}
	handler := NewHandler(AgentConfig{
		AllowedOrigins:    []string{"http://localhost:3000"},
		PairingToken:      "test-pairing-token-32bytes-minimum",
		Version:           "2.0.0-test",
		ApiBaseURL:        apiSrv.URL,
		DeviceFingerprint: "fp-win11-42",
		Hostname:          "WIN11-42",
		WgRunner:          wgRunner,
	})

	req := httptest.NewRequest(http.MethodPost, "/connect", bytes.NewBufferString(`{"ticket":"ticket-42"}`))
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-Mango-Agent-Token", "test-pairing-token-32bytes-minimum")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	if connectPayload["ticket"] != "ticket-42" ||
		connectPayload["deviceFingerprint"] != "fp-win11-42" ||
		connectPayload["hostname"] != "WIN11-42" ||
		connectPayload["agentVersion"] != "2.0.0-test" {
		t.Fatalf("unexpected /api/vpn/connect payload: %+v", connectPayload)
	}

	if len(wgRunner.activated) != 1 || wgRunner.activated[0].AssignedIP != "10.13.13.7" {
		t.Fatalf("expected WireGuardRunner.Activate with 10.13.13.7, got %+v", wgRunner.activated)
	}

	var resp map[string]any
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	if resp["state"] != "connected" || resp["assignedIp"] != "10.13.13.7" || resp["sessionId"] != "sess-42" {
		t.Fatalf("unexpected /connect response: %+v", resp)
	}

	// Disconnect
	discReq := httptest.NewRequest(http.MethodPost, "/disconnect", nil)
	discReq.Header.Set("Origin", "http://localhost:3000")
	discReq.Header.Set("X-Mango-Agent-Token", "test-pairing-token-32bytes-minimum")
	discRec := httptest.NewRecorder()
	handler.ServeHTTP(discRec, discReq)

	if discRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on disconnect, got %d: %s", discRec.Code, discRec.Body.String())
	}
	if wgRunner.deactivated != 1 {
		t.Fatalf("expected WireGuardRunner.Deactivate once, got %d", wgRunner.deactivated)
	}
	if disconnectPayload["sessionId"] != "sess-42" {
		t.Fatalf("expected sessionId sess-42 in /api/vpn/disconnect, got %+v", disconnectPayload)
	}
}

func TestConnectSurfacesApiFailureHonestly(t *testing.T) {
	apiSrv := newFakeApiServer(http.StatusUnauthorized)
	defer apiSrv.Close()

	wgRunner := &fakeWireGuardRunner{}
	handler := NewHandler(AgentConfig{
		AllowedOrigins:    []string{"http://localhost:3000"},
		PairingToken:      "test-pairing-token-32bytes-minimum",
		Version:           "2.0.0-test",
		ApiBaseURL:        apiSrv.URL,
		DeviceFingerprint: "fp-err",
		Hostname:          "ERR-HOST",
		WgRunner:          wgRunner,
	})

	req := httptest.NewRequest(http.MethodPost, "/connect", bytes.NewBufferString(`{"ticket":"expired-ticket"}`))
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-Mango-Agent-Token", "test-pairing-token-32bytes-minimum")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when API rejects ticket, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(wgRunner.activated) != 0 {
		t.Fatalf("expected no tunnel activation on API failure")
	}
}

func TestGetenvFirstPrefersPrimaryAndFallsBackToAlias(t *testing.T) {
	t.Setenv("AGENT_LISTEN_ADDR", "")
	t.Setenv("MANGO_AGENT_ADDR", "127.0.0.1:49999")
	if got := getenvFirst("AGENT_LISTEN_ADDR", "MANGO_AGENT_ADDR"); got != "127.0.0.1:49999" {
		t.Fatalf("expected fallback MANGO_AGENT_ADDR, got %q", got)
	}

	t.Setenv("AGENT_LISTEN_ADDR", "127.0.0.1:47821")
	if got := getenvFirst("AGENT_LISTEN_ADDR", "MANGO_AGENT_ADDR"); got != "127.0.0.1:47821" {
		t.Fatalf("expected primary AGENT_LISTEN_ADDR to win, got %q", got)
	}
}
