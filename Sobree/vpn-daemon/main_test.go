package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"testing"
)

type recordedCmd struct {
	name string
	args []string
}

type fakeCommandRunner struct {
	calls []recordedCmd
	err   error
}

func (f *fakeCommandRunner) Run(_ context.Context, name string, args ...string) ([]byte, error) {
	f.calls = append(f.calls, recordedCmd{name: name, args: args})
	if f.err != nil {
		return []byte(f.err.Error()), f.err
	}
	return []byte{}, nil
}

func validTestPubKey() string {
	b := make([]byte, 32)
	for i := range b {
		b[i] = byte(i + 1)
	}
	return base64.StdEncoding.EncodeToString(b)
}

func TestHealthEndpoint(t *testing.T) {
	mux := NewMux(DaemonConfig{
		SharedSecret: "test-daemon-secret-32-chars-minimum",
		Interface:    "wg0",
		Runner:       &fakeCommandRunner{},
	})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode JSON: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %q", body["status"])
	}
	if body["service"] != "mango-vpn-daemon" {
		t.Fatalf("expected service mango-vpn-daemon, got %q", body["service"])
	}
}

func TestPeersAuthRejection(t *testing.T) {
	runner := &fakeCommandRunner{}
	mux := NewMux(DaemonConfig{
		SharedSecret: "super-secret-daemon-token-32-chars",
		Interface:    "wg0",
		Runner:       runner,
	})

	pubKey := validTestPubKey()
	payload, _ := json.Marshal(map[string]string{
		"publicKey":  pubKey,
		"assignedIp": "10.13.13.2",
	})

	cases := []struct {
		name   string
		method string
		path   string
		auth   string
	}{
		{"missing auth on add", http.MethodPost, "/peers", ""},
		{"wrong bearer on add", http.MethodPost, "/peers", "Bearer wrong-secret"},
		{"missing auth on remove", http.MethodPost, "/peers/remove", ""},
		{"wrong bearer on delete", http.MethodDelete, "/peers/" + url.PathEscape(pubKey), "Bearer wrong"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			if tc.auth != "" {
				req.Header.Set("Authorization", tc.auth)
			}
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
			}
		})
	}

	if len(runner.calls) != 0 {
		t.Fatalf("expected no wg commands on unauthorized requests, got %d", len(runner.calls))
	}
}

func TestAddAndRemovePeerExecutesWgSet(t *testing.T) {
	runner := &fakeCommandRunner{}
	secret := "super-secret-daemon-token-32-chars"
	mux := NewMux(DaemonConfig{
		SharedSecret: secret,
		Interface:    "wg0",
		Runner:       runner,
	})

	pubKey := validTestPubKey()

	// Add peer
	addBody, _ := json.Marshal(map[string]string{
		"publicKey":  pubKey,
		"assignedIp": "10.13.13.5",
	})
	addReq := httptest.NewRequest(http.MethodPost, "/peers", bytes.NewReader(addBody))
	addReq.Header.Set("Content-Type", "application/json")
	addReq.Header.Set("Authorization", "Bearer "+secret)
	addRec := httptest.NewRecorder()
	mux.ServeHTTP(addRec, addReq)

	if addRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on add peer, got %d: %s", addRec.Code, addRec.Body.String())
	}

	wantAdd := recordedCmd{
		name: "wg",
		args: []string{"set", "wg0", "peer", pubKey, "allowed-ips", "10.13.13.5/32"},
	}
	if len(runner.calls) != 1 || !reflect.DeepEqual(runner.calls[0], wantAdd) {
		t.Fatalf("expected wg call %+v, got %+v", wantAdd, runner.calls)
	}

	// Remove peer via POST /peers/remove
	remBody, _ := json.Marshal(map[string]string{
		"publicKey": pubKey,
	})
	remReq := httptest.NewRequest(http.MethodPost, "/peers/remove", bytes.NewReader(remBody))
	remReq.Header.Set("Content-Type", "application/json")
	remReq.Header.Set("Authorization", "Bearer "+secret)
	remRec := httptest.NewRecorder()
	mux.ServeHTTP(remRec, remReq)

	if remRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on remove peer, got %d: %s", remRec.Code, remRec.Body.String())
	}

	wantRemove := recordedCmd{
		name: "wg",
		args: []string{"set", "wg0", "peer", pubKey, "remove"},
	}
	if len(runner.calls) != 2 || !reflect.DeepEqual(runner.calls[1], wantRemove) {
		t.Fatalf("expected wg call %+v, got %+v", wantRemove, runner.calls)
	}

	// Remove peer via DELETE /peers/{publicKey}
	delReq := httptest.NewRequest(http.MethodDelete, "/peers/"+url.PathEscape(pubKey), nil)
	delReq.Header.Set("Authorization", "Bearer "+secret)
	delRec := httptest.NewRecorder()
	mux.ServeHTTP(delRec, delReq)

	if delRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on DELETE peer, got %d: %s", delRec.Code, delRec.Body.String())
	}
	if len(runner.calls) != 3 || !reflect.DeepEqual(runner.calls[2], wantRemove) {
		t.Fatalf("expected wg call %+v, got %+v", wantRemove, runner.calls)
	}
}

func TestAddPeerSurfacesWgFailure(t *testing.T) {
	runner := &fakeCommandRunner{err: errors.New("wg: Operation not permitted")}
	secret := "super-secret-daemon-token-32-chars"
	mux := NewMux(DaemonConfig{
		SharedSecret: secret,
		Interface:    "wg0",
		Runner:       runner,
	})

	addBody, _ := json.Marshal(map[string]string{
		"publicKey":  validTestPubKey(),
		"assignedIp": "10.13.13.9",
	})
	req := httptest.NewRequest(http.MethodPost, "/peers", bytes.NewReader(addBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+secret)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 when wg fails, got %d: %s", rec.Code, rec.Body.String())
	}
}
