// smoke exercises an independently running backend using only public protocols.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
func run() error {
	base := flag.String("url", "http://127.0.0.1:8080", "backend base URL")
	credentials := flag.String("credentials", "data/bootstrap-credentials.json", "local credentials JSON path")
	docPath := flag.String("document", "examples/character.json", "synthetic document path")
	flag.Parse()
	b, e := os.ReadFile(*credentials)
	if e != nil {
		return e
	}
	var auth struct {
		Token string `json:"token"`
	}
	if e = json.Unmarshal(b, &auth); e != nil {
		return e
	}
	doc, e := os.ReadFile(*docPath)
	if e != nil {
		return e
	}
	client := &http.Client{Timeout: 10 * time.Second}
	request := func(method, path string, body any, status int) (map[string]any, error) {
		var raw []byte
		if body != nil {
			raw, _ = json.Marshal(body)
		}
		req, _ := http.NewRequest(method, *base+path, bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer "+auth.Token)
		req.Header.Set("Content-Type", "application/json")
		r, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer r.Body.Close()
		data, err := io.ReadAll(r.Body)
		if err != nil {
			return nil, err
		}
		if r.StatusCode != status {
			return nil, fmt.Errorf("%s %s: status %d expected %d", method, path, r.StatusCode, status)
		}
		var out map[string]any
		err = json.Unmarshal(data, &out)
		return out, err
	}
	if _, e = request("GET", "/health", nil, 200); e != nil {
		return e
	}
	created, e := request("POST", "/api/v1/characters", map[string]any{"document": json.RawMessage(doc)}, 201)
	if e != nil {
		return e
	}
	id := created["id"].(string)
	path := "/api/v1/characters/" + id
	dial := func() (*websocket.Conn, error) {
		c, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(*base, "http")+"/api/v1/ws", http.Header{"Authorization": []string{"Bearer " + auth.Token}})
		return c, err
	}
	read := func(c *websocket.Conn, kind string) (map[string]any, error) {
		c.SetReadDeadline(time.Now().Add(5 * time.Second))
		var m map[string]any
		err := c.ReadJSON(&m)
		if err == nil && m["type"] != kind {
			err = fmt.Errorf("expected WS %s got %v", kind, m["type"])
		}
		return m, err
	}
	c, e := dial()
	if e != nil {
		return e
	}
	defer c.Close()
	c.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 1})
	if _, e = read(c, "subscribed"); e != nil {
		return e
	}
	batch := func(base int, op, path string, value any) map[string]any {
		return map[string]any{"operationId": uuid.NewString(), "clientId": uuid.NewString(), "baseRevision": base, "operations": []any{map[string]any{"op": op, "path": path, "value": value}}}
	}
	op := batch(1, "inc", "/runtime/hp", -5)
	result, e := request("POST", path+"/operations", op, 200)
	if e != nil || result["revision"] != float64(2) {
		return fmt.Errorf("initial operation: %v", e)
	}
	if _, e = read(c, "character.operations"); e != nil {
		return e
	}
	retry, e := request("POST", path+"/operations", op, 200)
	if e != nil || retry["revision"] != float64(2) {
		return fmt.Errorf("retry: %v", e)
	}
	r, e := request("POST", path+"/operations", batch(1, "set", "/name", "Smoke rebase"), 200)
	if e != nil || r["revision"] != float64(3) || r["rebased"] != true {
		return fmt.Errorf("rebase: %v", e)
	}
	if _, e = read(c, "character.operations"); e != nil {
		return e
	}
	r, e = request("POST", path+"/operations", batch(1, "set", "/runtime/hp", 99), 409)
	if e != nil || r["code"] != "revision_conflict" {
		return fmt.Errorf("conflict: %v", e)
	}
	c.Close()
	reconnected, e := dial()
	if e != nil {
		return e
	}
	defer reconnected.Close()
	reconnected.WriteJSON(map[string]any{"type": "subscribe", "characterId": id, "lastRevision": 2})
	if _, e = read(reconnected, "character.operations"); e != nil {
		return e
	}
	if _, e = read(reconnected, "subscribed"); e != nil {
		return e
	}
	r, e = request("GET", path+"/operations?afterRevision=2", nil, 200)
	if e != nil || len(r["operations"].([]any)) != 1 {
		return fmt.Errorf("delta: %v", e)
	}
	if _, e = request("POST", path+"/operations", batch(3, "inc", "/runtime/hp", -3), 200); e != nil {
		return e
	}
	r, e = request("GET", path+"/operations?afterRevision=1", nil, 409)
	if e != nil || r["code"] != "resync_required" {
		return fmt.Errorf("retention: run server with DND_RETENTION=2: %v", e)
	}
	snapshot, e := request("GET", path, nil, 200)
	if e != nil {
		return e
	}
	hp := snapshot["document"].(map[string]any)["runtime"].(map[string]any)["hp"]
	if hp != float64(12) || snapshot["revision"] != float64(4) {
		return fmt.Errorf("snapshot/retry applied incorrectly")
	}
	retry, e = request("POST", path+"/operations", op, 200)
	if e != nil || retry["revision"] != float64(2) {
		return fmt.Errorf("retained receipt: %v", e)
	}
	fmt.Println("PASS: health, create, snapshot, operation, revision, retry, conflict, rebase, WebSocket, reconnect, delta, retention/resync, retained receipt")
	return nil
}
