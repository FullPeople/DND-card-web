package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"dnd-card/backend/internal/api/websocket"
	"dnd-card/backend/internal/auth"
	"dnd-card/backend/internal/character"
	"dnd-card/backend/internal/config"
	"dnd-card/backend/internal/protocol"
	"dnd-card/backend/internal/storage"
	"dnd-card/backend/internal/storage/sqlite"
	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
)

type harness struct {
	server            *httptest.Server
	api               *Server
	owner, other      auth.Identity
	token, otherToken string
}

func setupHTTP(t *testing.T) *harness {
	t.Helper()
	store, e := sqlite.Open(filepath.Join(t.TempDir(), "http.db"))
	if e != nil {
		t.Fatal(e)
	}
	tokens := auth.Tokens{Store: store}
	u, token, e := tokens.Provision("owner")
	if e != nil {
		t.Fatal(e)
	}
	other, otherToken, e := tokens.Provision("other")
	if e != nil {
		t.Fatal(e)
	}
	cfg := config.Default()
	v, e := character.NewValidator(cfg.Snapshot)
	if e != nil {
		t.Fatal(e)
	}
	s := character.New(store, v)
	s.Rate = 10000
	hub := websocket.New(s, cfg)
	api := &Server{Service: s, Auth: tokens, Hub: hub, Config: cfg}
	server := httptest.NewServer(api.Router())
	t.Cleanup(func() { hub.Close(); server.Close(); store.Close() })
	return &harness{server, api, u, other, token, otherToken}
}
func (h *harness) request(t *testing.T, method, path, token string, body any, status int) map[string]any {
	t.Helper()
	var raw []byte
	if body != nil {
		raw, _ = json.Marshal(body)
	}
	req, _ := http.NewRequest(method, h.server.URL+path, bytes.NewReader(raw))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, e := http.DefaultClient.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != status {
		t.Fatalf("%s %s: %d wanted %d: %s", method, path, resp.StatusCode, status, b)
	}
	var out map[string]any
	if len(b) > 0 {
		if e = json.Unmarshal(b, &out); e != nil {
			t.Fatal(e)
		}
	}
	return out
}
func (h *harness) create(t *testing.T) string {
	b, e := os.ReadFile("../../../examples/character.json")
	if e != nil {
		t.Fatal(e)
	}
	r := h.request(t, "POST", "/api/v1/characters", h.token, map[string]any{"document": json.RawMessage(b)}, 201)
	return r["id"].(string)
}
func (h *harness) socket(t *testing.T, token string) *ws.Conn {
	t.Helper()
	header := http.Header{"Authorization": []string{"Bearer " + token}, "Origin": []string{h.api.Config.Origin}}
	c, _, e := ws.DefaultDialer.Dial("ws"+strings.TrimPrefix(h.server.URL, "http")+"/api/v1/ws", header)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { c.Close() })
	return c
}
func read(t *testing.T, c *ws.Conn) map[string]any {
	t.Helper()
	c.SetReadDeadline(time.Now().Add(5 * time.Second))
	var m map[string]any
	if e := c.ReadJSON(&m); e != nil {
		t.Fatal(e)
	}
	return m
}
func TestHTTPWebSocketLifecycle(t *testing.T) {
	h := setupHTTP(t)
	h.request(t, "GET", "/health", "", nil, 200)
	h.request(t, "GET", "/api/v1/characters", "", nil, 401)
	id := h.create(t)
	listing := h.request(t, "GET", "/api/v1/characters", h.token, nil, 200)
	if rows := listing["characters"].([]any); len(rows) != 1 || rows[0].(map[string]any)["id"] != id || rows[0].(map[string]any)["document"] != nil {
		t.Fatal("metadata listing", listing)
	}
	path := "/api/v1/characters/" + id
	h.request(t, "GET", path, h.token, nil, 200)
	h.request(t, "GET", path, h.otherToken, nil, 403)
	c := h.socket(t, h.token)
	c.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 1})
	if m := read(t, c); m["type"] != "subscribed" {
		t.Fatal(m)
	}
	forbidden := h.socket(t, h.otherToken)
	forbidden.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 1})
	if m := read(t, forbidden); m["code"] != "forbidden" {
		t.Fatal(m)
	}
	b := protocol.Batch{OperationID: uuid.NewString(), ClientID: uuid.NewString(), BaseRevision: 1, Operations: []protocol.Operation{{Op: "inc", Path: "/runtime/hp", Value: []byte(`-5`)}}}
	h.request(t, "POST", path+"/operations", h.otherToken, b, 403)
	result := h.request(t, "POST", path+"/operations", h.token, b, 200)
	if result["revision"] != float64(2) {
		t.Fatal(result)
	}
	message := read(t, c)
	if message["type"] != "character.operations" || message["revision"] != float64(2) {
		t.Fatal(message)
	}
	// Broadcast receipt implies the new snapshot is already committed.
	snap := h.request(t, "GET", path, h.token, nil, 200)
	if snap["revision"] != message["revision"] {
		t.Fatal(snap)
	}
	retry := h.request(t, "POST", path+"/operations", h.token, b, 200)
	if retry["revision"] != float64(2) {
		t.Fatal(retry)
	}
	c.Close()
	reconnect := h.socket(t, h.token)
	reconnect.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 1})
	if read(t, reconnect)["type"] != "character.operations" || read(t, reconnect)["type"] != "subscribed" {
		t.Fatal("replay handshake")
	}
	delta := h.request(t, "GET", path+"/operations?afterRevision=1", h.token, nil, 200)
	if len(delta["operations"].([]any)) != 1 {
		t.Fatal(delta)
	}
	conflict := b
	conflict.OperationID = uuid.NewString()
	conflict.Operations = []protocol.Operation{{Op: "set", Path: "/runtime/hp", Value: []byte(`99`)}}
	if r := h.request(t, "POST", path+"/operations", h.token, conflict, 409); r["code"] != "revision_conflict" {
		t.Fatal(r)
	}
	rebase := b
	rebase.OperationID = uuid.NewString()
	rebase.Operations = []protocol.Operation{{Op: "set", Path: "/name", Value: []byte(`"Other"`)}}
	if r := h.request(t, "POST", path+"/operations", h.token, rebase, 200); r["rebased"] != true {
		t.Fatal(r)
	}
	read(t, reconnect)
	h.request(t, "PUT", path+"/permissions/"+h.other.ID, h.token, map[string]any{"role": "viewer"}, 204)
	forbidden.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 3})
	if read(t, forbidden)["type"] != "subscribed" {
		t.Fatal("viewer subscribe")
	}
	h.request(t, "DELETE", path+"/permissions/"+h.other.ID, h.token, nil, 204)
	forbidden.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 3})
	if m := read(t, forbidden); m["code"] != "forbidden" {
		t.Fatal("revoked subscription accepted", m)
	}
	forbidden.WriteJSON(map[string]any{"type": "ping"})
	if m := read(t, forbidden); m["type"] != "pong" {
		t.Fatal("character revoke closed socket", m)
	}
}

func TestHTTPPermissionChangesAndCharacterLocalWebSocketRevoke(t *testing.T) {
	h := setupHTTP(t)
	a, b := h.create(t), h.create(t)
	paths := map[string]string{a: "/api/v1/characters/" + a, b: "/api/v1/characters/" + b}
	for _, id := range []string{a, b} {
		h.request(t, "PUT", paths[id]+"/permissions/"+h.other.ID, h.token, map[string]any{"role": "viewer"}, 204)
	}
	c := h.socket(t, h.otherToken)
	for _, id := range []string{a, b} {
		if e := c.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 1}); e != nil {
			t.Fatal(e)
		}
		if m := read(t, c); m["type"] != "subscribed" || m["characterId"] != id {
			t.Fatal(m)
		}
	}
	post := func(id, token string, base int64, status int) {
		h.request(t, "POST", paths[id]+"/operations", token, protocol.Batch{OperationID: uuid.NewString(), ClientID: uuid.NewString(), BaseRevision: base, Operations: []protocol.Operation{{Op: "inc", Path: "/runtime/hp", Value: []byte(`1`)}}}, status)
	}
	// Both role transitions leave the established socket and subscription usable.
	h.request(t, "PUT", paths[a]+"/permissions/"+h.other.ID, h.token, map[string]any{"role": "editor"}, 204)
	post(a, h.otherToken, 1, 200)
	if m := read(t, c); m["characterId"] != a || m["revision"] != float64(2) {
		t.Fatal(m)
	}
	h.request(t, "PUT", paths[a]+"/permissions/"+h.other.ID, h.token, map[string]any{"role": "viewer"}, 204)
	post(a, h.otherToken, 2, 403)
	post(a, h.token, 2, 200)
	if m := read(t, c); m["characterId"] != a || m["revision"] != float64(3) {
		t.Fatal(m)
	}
	h.request(t, "DELETE", paths[a]+"/permissions/"+h.other.ID, h.token, nil, 204)
	h.request(t, "GET", paths[a], h.otherToken, nil, 403)
	post(a, h.otherToken, 3, 403)
	post(a, h.token, 3, 200)
	post(b, h.token, 1, 200)
	// Ordered writes and a ping barrier prove no cardA broadcast precedes cardB/pong.
	if m := read(t, c); m["type"] != "character.operations" || m["characterId"] != b || m["revision"] != float64(2) {
		t.Fatal("local revoke failed", m)
	}
	if e := c.WriteJSON(map[string]any{"type": "subscribe", "characterId": a, "lastRevision": 4}); e != nil {
		t.Fatal(e)
	}
	if m := read(t, c); m["code"] != "forbidden" || m["characterId"] != a {
		t.Fatal(m)
	}
	if e := c.WriteJSON(map[string]any{"type": "ping"}); e != nil {
		t.Fatal(e)
	}
	if m := read(t, c); m["type"] != "pong" {
		t.Fatal(m)
	}
	post(b, h.token, 2, 200)
	if m := read(t, c); m["characterId"] != b || m["revision"] != float64(3) {
		t.Fatal(m)
	}
}

func TestWebSocketSubscribeRacesHTTPCommitWithoutLostRevisions(t *testing.T) {
	h := setupHTTP(t)
	id := h.create(t)
	path := "/api/v1/characters/" + id + "/operations"
	c := h.socket(t, h.token)
	var wg sync.WaitGroup
	start := make(chan struct{})
	wg.Add(1)
	go func() {
		defer wg.Done()
		<-start
		for i := 0; i < 20; i++ {
			b := protocol.Batch{OperationID: uuid.NewString(), ClientID: uuid.NewString(), BaseRevision: 1, Operations: []protocol.Operation{{Op: "inc", Path: "/runtime/hp", Value: []byte(`1`)}}}
			// Do not use Fatal in a goroutine; report failures back to the test.
			raw, _ := json.Marshal(b)
			req, _ := http.NewRequest("POST", h.server.URL+path, bytes.NewReader(raw))
			req.Header.Set("Authorization", "Bearer "+h.token)
			resp, e := http.DefaultClient.Do(req)
			if e != nil {
				t.Error(e)
				return
			}
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode != 200 {
				t.Errorf("commit failed: %d %s", resp.StatusCode, body)
				return
			}
		}
	}()
	close(start)
	if e := c.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 1}); e != nil {
		t.Fatal(e)
	}
	var revisions []int64
	subscribed := false
	for len(revisions) < 20 || !subscribed {
		m := read(t, c)
		switch m["type"] {
		case "character.operations":
			rev := int64(m["revision"].(float64))
			revisions = append(revisions, rev)
			if rev != int64(len(revisions))+1 {
				t.Fatal("lost or duplicate revision", revisions)
			}
		case "subscribed":
			if subscribed || int64(m["revision"].(float64)) != int64(len(revisions))+1 {
				t.Fatal("incorrect replay barrier", m, revisions)
			}
			subscribed = true
		default:
			t.Fatal(m)
		}
	}
	wg.Wait()
}
func TestResyncLimitsAndSession(t *testing.T) {
	h := setupHTTP(t)
	h.api.Service.Retention = 1
	id := h.create(t)
	path := "/api/v1/characters/" + id
	for i := int64(1); i <= 2; i++ {
		h.request(t, "POST", path+"/operations", h.token, protocol.Batch{OperationID: uuid.NewString(), ClientID: uuid.NewString(), BaseRevision: i, Operations: []protocol.Operation{{Op: "inc", Path: "/runtime/hp", Value: []byte(`1`)}}}, 200)
	}
	r := h.request(t, "GET", path+"/operations?afterRevision=1", h.token, nil, 409)
	if r["code"] != "resync_required" {
		t.Fatal(r)
	}
	c := h.socket(t, h.token)
	c.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 1})
	if read(t, c)["type"] != "resync_required" {
		t.Fatal("expected resync")
	}
	c.WriteJSON(map[string]any{"type": "ping"})
	if read(t, c)["type"] != "pong" {
		t.Fatal("pong")
	}
	req, _ := http.NewRequest("POST", h.server.URL+"/api/v1/session", nil)
	req.Header.Set("Authorization", "Bearer "+h.token)
	resp, e := http.DefaultClient.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	resp.Body.Close()
	cookies := resp.Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly {
		t.Fatal(cookies)
	}
	req, _ = http.NewRequest("GET", h.server.URL+"/api/v1/me", nil)
	req.AddCookie(cookies[0])
	resp, e = http.DefaultClient.Do(req)
	if e != nil || resp.StatusCode != 200 {
		t.Fatal(resp, e)
	}
	resp.Body.Close()
	bad := map[string]any{"operationId": uuid.NewString(), "clientId": uuid.NewString(), "baseRevision": 3, "operations": []any{map[string]any{"op": "set", "path": "/revision", "value": 12}}}
	if r = h.request(t, "POST", path+"/operations", h.token, bad, 422); r["code"] != "invalid_path" {
		t.Fatal(r)
	}
	oversized := map[string]any{"document": strings.Repeat("x", h.api.Config.Payload+1)}
	if r = h.request(t, "POST", "/api/v1/characters", h.token, oversized, 413); r["code"] != "payload_too_large" {
		t.Fatal(r)
	}
}

func TestHTTPReceiptWindowCleanupAndExpiredRetry(t *testing.T) {
	h := setupHTTP(t)
	s := h.api.Service
	s.Retention = 1
	s.ReceiptRetention = 10
	id := h.create(t)
	path := "/api/v1/characters/" + id
	original := protocol.Batch{OperationID: uuid.NewString(), ClientID: uuid.NewString(), BaseRevision: 1, Operations: []protocol.Operation{{Op: "inc", Path: "/runtime/hp", Value: []byte(`1`)}}}
	h.request(t, "POST", path+"/operations", h.token, original, 200)
	store := s.Repo.(*storage.Store)
	old := time.Now().Add(-100 * 24 * time.Hour).UTC().Format(time.RFC3339Nano)
	if e := store.DB.Model(&storage.Receipt{}).Where("operation_id = ?", original.OperationID).Update("created_at", old).Error; e != nil {
		t.Fatal(e)
	}
	// Age alone cannot expire the original receipt within the revision window.
	if r := h.request(t, "POST", path+"/operations", h.token, original, 200); r["revision"] != float64(2) {
		t.Fatal(r)
	}
	for base := int64(2); base <= 11; base++ {
		b := original
		b.OperationID = uuid.NewString()
		b.BaseRevision = base
		h.request(t, "POST", path+"/operations", h.token, b, 200)
	}
	if r := h.request(t, "POST", path+"/operations", h.token, original, 409); r["code"] != "resync_required" {
		t.Fatal(r)
	}
	if r := h.request(t, "GET", path, h.token, nil, 200); r["revision"] != float64(12) {
		t.Fatal("expired request reapplied", r)
	}
}
