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

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode JSON: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %v", body["status"])
	}
	if body["service"] != "mango-vpn-daemon" {
		t.Fatalf("expected service mango-vpn-daemon, got %v", body["service"])
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

func TestPoliciesSyncAuthRejection(t *testing.T) {
	runner := &fakeCommandRunner{}
	mux := NewMux(DaemonConfig{
		SharedSecret: "super-secret-daemon-token-32-chars",
		Interface:    "wg0",
		Runner:       runner,
	})

	payload := []byte(`{"peers":[]}`)
	for _, tc := range []struct {
		method string
		path   string
		auth   string
	}{
		{http.MethodPost, "/policies/sync", ""},
		{http.MethodPost, "/policies/sync", "Bearer wrong-secret"},
		{http.MethodPut, "/peers/policies", ""},
		{http.MethodPut, "/peers/policies", "Bearer wrong-secret"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		if tc.auth != "" {
			req.Header.Set("Authorization", tc.auth)
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s: expected 401, got %d", tc.method, tc.path, rec.Code)
		}
	}
	if len(runner.calls) != 0 {
		t.Fatalf("expected 0 commands, got %d", len(runner.calls))
	}
}

func TestAddPeerWithPoliciesEnforcesNftablesPriorityAndDeny(t *testing.T) {
	runner := &fakeCommandRunner{}
	secret := "super-secret-daemon-token-32-chars"
	mux := NewMux(DaemonConfig{
		SharedSecret: secret,
		Interface:    "wg0",
		Runner:       runner,
	})

	pubKey := validTestPubKey()
	// Intentionally send priority 20 before priority 10 to verify ascending priority sorting,
	// and verify DENY produces "drop" (never "accept").
	body := map[string]any{
		"publicKey":  pubKey,
		"assignedIp": "10.13.13.10",
		"role":       "STAFF",
		"policies": []map[string]any{
			{
				"targetCidr": "10.0.0.0/8",
				"protocol":   "TCP",
				"portRange":  "443",
				"action":     "ALLOW",
				"priority":   20,
			},
			{
				"targetCidr": "10.99.0.0/16",
				"protocol":   "ANY",
				"portRange":  nil,
				"action":     "DENY",
				"priority":   10,
			},
		},
	}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/peers", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+secret)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	wantCalls := []recordedCmd{
		{name: "wg", args: []string{"set", "wg0", "peer", pubKey, "allowed-ips", "10.13.13.10/32"}},
		{name: "nft", args: []string{"add", "table", "inet", "mango_vpn"}},
		{name: "nft", args: []string{"add", "chain", "inet", "mango_vpn", "forward", "{", "type", "filter", "hook", "forward", "priority", "0", ";", "policy", "drop", ";", "}"}},
		{name: "nft", args: []string{"flush", "chain", "inet", "mango_vpn", "forward"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "ct", "state", "established,related", "accept"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.10", "ip", "daddr", "10.99.0.0/16", "drop"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.10", "ip", "daddr", "10.0.0.0/8", "tcp", "dport", "443", "accept"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.10", "drop"}},
	}

	if !reflect.DeepEqual(runner.calls, wantCalls) {
		t.Fatalf("unexpected command sequence:\ngot:  %+v\nwant: %+v", runner.calls, wantCalls)
	}
}

func validTestPubKeyN(seed byte) string {
	b := make([]byte, 32)
	for i := range b {
		b[i] = byte(i + 1) + seed
	}
	return base64.StdEncoding.EncodeToString(b)
}

func TestSyncPoliciesForAdminStaffAndClientRoles(t *testing.T) {
	runner := &fakeCommandRunner{}
	secret := "super-secret-daemon-token-32-chars"
	mux := NewMux(DaemonConfig{
		SharedSecret: secret,
		Interface:    "wg0",
		Runner:       runner,
	})

	syncBody := map[string]any{
		"peers": []map[string]any{
			{
				"publicKey":  validTestPubKeyN(1),
				"assignedIp": "10.13.13.2",
				"role":       "ADMIN",
				"policies": []map[string]any{
					{"targetCidr": "10.0.0.0/8", "protocol": "ANY", "portRange": nil, "action": "ALLOW", "priority": 10},
				},
			},
			{
				"publicKey":  validTestPubKeyN(2),
				"assignedIp": "10.13.13.3",
				"role":       "STAFF",
				"policies": []map[string]any{
					{"targetCidr": "10.10.0.0/16", "protocol": "UDP", "portRange": "5000-5010", "action": "ALLOW", "priority": 10},
					{"targetCidr": "10.20.0.0/16", "protocol": "ICMP", "portRange": nil, "action": "DENY", "priority": 20},
				},
			},
			{
				"publicKey":  validTestPubKeyN(3),
				"assignedIp": "10.13.13.4",
				"role":       "CLIENT",
				"policies":   []map[string]any{},
			},
		},
	}

	raw, _ := json.Marshal(syncBody)
	req := httptest.NewRequest(http.MethodPost, "/policies/sync", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+secret)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	wantCalls := []recordedCmd{
		{name: "nft", args: []string{"add", "table", "inet", "mango_vpn"}},
		{name: "nft", args: []string{"add", "chain", "inet", "mango_vpn", "forward", "{", "type", "filter", "hook", "forward", "priority", "0", ";", "policy", "drop", ";", "}"}},
		{name: "nft", args: []string{"flush", "chain", "inet", "mango_vpn", "forward"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "ct", "state", "established,related", "accept"}},
		// ADMIN peer 10.13.13.2
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.2", "ip", "daddr", "10.0.0.0/8", "accept"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.2", "drop"}},
		// STAFF peer 10.13.13.3
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.3", "ip", "daddr", "10.10.0.0/16", "udp", "dport", "5000-5010", "accept"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.3", "ip", "daddr", "10.20.0.0/16", "ip", "protocol", "icmp", "drop"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.3", "drop"}},
		// CLIENT peer 10.13.13.4 (no ALLOW rules -> deny-by-default)
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "iifname", "wg0", "ip", "saddr", "10.13.13.4", "drop"}},
	}

	if !reflect.DeepEqual(runner.calls, wantCalls) {
		t.Fatalf("unexpected nft calls:\ngot:  %+v\nwant: %+v", runner.calls, wantCalls)
	}
}

func TestSyncPoliciesRejectsInvalidRule(t *testing.T) {
	runner := &fakeCommandRunner{}
	secret := "super-secret-daemon-token-32-chars"
	mux := NewMux(DaemonConfig{
		SharedSecret: secret,
		Interface:    "wg0",
		Runner:       runner,
	})

	badBody := map[string]any{
		"peers": []map[string]any{
			{
				"publicKey":  validTestPubKey(),
				"assignedIp": "10.13.13.2",
				"role":       "STAFF",
				"policies": []map[string]any{
					{"targetCidr": "not-a-cidr", "protocol": "TCP", "portRange": "443", "action": "ALLOW", "priority": 10},
				},
			},
		},
	}
	raw, _ := json.Marshal(badBody)
	req := httptest.NewRequest(http.MethodPut, "/peers/policies", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+secret)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid CIDR, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(runner.calls) != 0 {
		t.Fatalf("expected 0 commands on invalid policy, got %d", len(runner.calls))
	}
}

type gatewayInitRunner struct {
	calls        []recordedCmd
	linkMissing  bool
}

func (g *gatewayInitRunner) Run(_ context.Context, name string, args ...string) ([]byte, error) {
	g.calls = append(g.calls, recordedCmd{name: name, args: args})
	if g.linkMissing && name == "ip" && len(args) >= 2 && args[0] == "link" && args[1] == "show" {
		return []byte("Device \"wg0\" does not exist."), errors.New("exit status 1")
	}
	return []byte{}, nil
}

func TestInitGatewayCreatesInterfaceAndNftables(t *testing.T) {
	runner := &gatewayInitRunner{linkMissing: true}
	err := InitGateway(context.Background(), GatewayConfig{
		Interface:   "wg0",
		GatewayCIDR: "10.13.13.1/24",
		ListenPort:  51820,
		Runner:      runner,
	})
	if err != nil {
		t.Fatalf("InitGateway failed: %v", err)
	}

	wantCalls := []recordedCmd{
		{name: "ip", args: []string{"link", "show", "dev", "wg0"}},
		{name: "ip", args: []string{"link", "add", "dev", "wg0", "type", "wireguard"}},
		{name: "ip", args: []string{"addr", "replace", "10.13.13.1/24", "dev", "wg0"}},
		{name: "wg", args: []string{"set", "wg0", "listen-port", "51820"}},
		{name: "ip", args: []string{"link", "set", "up", "dev", "wg0"}},
		{name: "nft", args: []string{"add", "table", "inet", "mango_vpn"}},
		{name: "nft", args: []string{"add", "chain", "inet", "mango_vpn", "forward", "{", "type", "filter", "hook", "forward", "priority", "0", ";", "policy", "drop", ";", "}"}},
		{name: "nft", args: []string{"flush", "chain", "inet", "mango_vpn", "forward"}},
		{name: "nft", args: []string{"add", "rule", "inet", "mango_vpn", "forward", "ct", "state", "established,related", "accept"}},
	}

	if !reflect.DeepEqual(runner.calls, wantCalls) {
		t.Fatalf("unexpected command sequence:\ngot:  %+v\nwant: %+v", runner.calls, wantCalls)
	}
}

func TestFortinetAndCiscoDriversProvisionSyncAndRemovePeers(t *testing.T) {
	var fortinetCalls []string
	fortinetSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fortinetCalls = append(fortinetCalls, r.Method+" "+r.URL.Path)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success"}`))
	}))
	defer fortinetSrv.Close()

	var ciscoCalls []string
	ciscoSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ciscoCalls = append(ciscoCalls, r.Method+" "+r.URL.Path)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer ciscoSrv.Close()

	secret := "super-secret-daemon-token-32-chars"
	wgRunner := &fakeCommandRunner{}
	mux := NewMux(DaemonConfig{
		SharedSecret:   secret,
		Interface:      "wg0",
		Runner:         wgRunner,
		FortiGateURL:   fortinetSrv.URL,
		FortiGateToken: "fg-token",
		CiscoURL:       ciscoSrv.URL,
		CiscoToken:     "cisco-token",
	})

	// 1. Add Fortinet peer with policy
	fgBody, _ := json.Marshal(map[string]any{
		"providerType": "FORTINET",
		"gatewayId":    "gw-fg-1",
		"peerIdentity": "fortinet-alice-123",
		"assignedIp":   "10.40.0.10",
		"role":         "STAFF",
		"policies": []map[string]any{
			{"targetCidr": "10.20.0.0/16", "protocol": "TCP", "portRange": "443", "action": "ALLOW", "priority": 10},
		},
	})
	fgReq := httptest.NewRequest(http.MethodPost, "/peers", bytes.NewReader(fgBody))
	fgReq.Header.Set("Content-Type", "application/json")
	fgReq.Header.Set("Authorization", "Bearer "+secret)
	fgRec := httptest.NewRecorder()
	mux.ServeHTTP(fgRec, fgReq)
	if fgRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on Fortinet add, got %d: %s", fgRec.Code, fgRec.Body.String())
	}
	if len(wgRunner.calls) != 0 {
		t.Fatalf("expected 0 wg/nft calls for FORTINET provider, got %d", len(wgRunner.calls))
	}
	if !reflect.DeepEqual(fortinetCalls, []string{"POST /api/v2/cmdb/user/local", "PUT /api/v2/cmdb/firewall/policy"}) {
		t.Fatalf("unexpected FortiGate API calls: %+v", fortinetCalls)
	}

	// 2. Add Cisco peer
	csBody, _ := json.Marshal(map[string]any{
		"providerType": "CISCO",
		"gatewayId":    "gw-cs-1",
		"peerIdentity": "cisco-bob-456",
		"assignedIp":   "10.50.0.12",
		"role":         "CLIENT",
		"policies":     []map[string]any{},
	})
	csReq := httptest.NewRequest(http.MethodPost, "/peers", bytes.NewReader(csBody))
	csReq.Header.Set("Content-Type", "application/json")
	csReq.Header.Set("Authorization", "Bearer "+secret)
	csRec := httptest.NewRecorder()
	mux.ServeHTTP(csRec, csReq)
	if csRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on Cisco add, got %d: %s", csRec.Code, csRec.Body.String())
	}
	if !reflect.DeepEqual(ciscoCalls, []string{"POST /api/vpn/sessions", "PUT /api/access/acl"}) {
		t.Fatalf("unexpected Cisco API calls: %+v", ciscoCalls)
	}

	// 3. Remove Fortinet & Cisco peers
	remFgBody, _ := json.Marshal(map[string]string{"providerType": "FORTINET", "peerIdentity": "fortinet-alice-123"})
	remFgReq := httptest.NewRequest(http.MethodPost, "/peers/remove", bytes.NewReader(remFgBody))
	remFgReq.Header.Set("Content-Type", "application/json")
	remFgReq.Header.Set("Authorization", "Bearer "+secret)
	remFgRec := httptest.NewRecorder()
	mux.ServeHTTP(remFgRec, remFgReq)
	if remFgRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on Fortinet remove, got %d: %s", remFgRec.Code, remFgRec.Body.String())
	}

	remCsReq := httptest.NewRequest(http.MethodDelete, "/peers/cisco-bob-456?providerType=CISCO", nil)
	remCsReq.Header.Set("Authorization", "Bearer "+secret)
	remCsRec := httptest.NewRecorder()
	mux.ServeHTTP(remCsRec, remCsReq)
	if remCsRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on Cisco DELETE, got %d: %s", remCsRec.Code, remCsRec.Body.String())
	}
	if ciscoCalls[len(ciscoCalls)-1] != "DELETE /api/vpn/sessions/cisco-bob-456" {
		t.Fatalf("expected Cisco DELETE /api/vpn/sessions/cisco-bob-456, got %+v", ciscoCalls)
	}

	// 4. Reject unknown provider
	badReq := httptest.NewRequest(http.MethodPost, "/peers", bytes.NewBufferString(`{"providerType":"OPENCONNECT_MAGIC","publicKey":"abc","assignedIp":"10.13.13.5"}`))
	badReq.Header.Set("Content-Type", "application/json")
	badReq.Header.Set("Authorization", "Bearer "+secret)
	badRec := httptest.NewRecorder()
	mux.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unsupported providerType, got %d", badRec.Code)
	}
}
