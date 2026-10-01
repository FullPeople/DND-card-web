package websocket

import (
	"bufio"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"dnd-card/backend/internal/character"
	"dnd-card/backend/internal/config"
	"dnd-card/backend/internal/protocol"
	"dnd-card/backend/internal/storage"
	"dnd-card/backend/internal/storage/sqlite"
	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
)

// Block a real WebSocket's next network write with a channel, without sleeps or
// relying on socket buffer size. The handshake completes before arming it.
type gatedConn struct {
	net.Conn
	armed   atomic.Bool
	entered chan struct{}
	release chan struct{}
	once    sync.Once
	endOnce sync.Once
}

func (c *gatedConn) Write(b []byte) (int, error) {
	if c.armed.Load() {
		c.once.Do(func() { close(c.entered) })
		<-c.release
	}
	return c.Conn.Write(b)
}
func (c *gatedConn) unblock() { c.endOnce.Do(func() { close(c.release) }) }

type gatedHijacker struct {
	http.ResponseWriter
	gate *gatedConn
}

func (w gatedHijacker) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	conn, rw, err := w.ResponseWriter.(http.Hijacker).Hijack()
	w.gate.Conn = conn
	return w.gate, rw, err
}

func socketPair(t *testing.T) (*ws.Conn, *ws.Conn, *gatedConn) {
	t.Helper()
	gate := &gatedConn{entered: make(chan struct{}), release: make(chan struct{})}
	ready := make(chan *ws.Conn, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		up := ws.Upgrader{}
		conn, err := up.Upgrade(gatedHijacker{w, gate}, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		ready <- conn
	}))
	reader, _, err := ws.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		server.Close()
		t.Fatal(err)
	}
	var writer *ws.Conn
	select {
	case writer = <-ready:
	case <-time.After(5 * time.Second):
		t.Fatal("WebSocket handshake did not finish")
	}
	t.Cleanup(func() {
		gate.unblock()
		writer.Close()
		reader.Close()
		server.Close()
	})
	return writer, reader, gate
}

func activeSubscription(id string) *subscription {
	sub := &subscription{characterID: id}
	sub.active.Store(true)
	return sub
}

func testClient(h *Hub, size int) *client {
	return &client{user: "user", limit: size, wake: make(chan struct{}, 1), done: make(chan struct{}), subs: map[string]*subscription{}, queued: &h.queued}
}

func waitSignal(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		t.Fatal("concurrent operation did not finish")
	}
}

func waitInvalidated(t *testing.T, sub *subscription) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for sub.active.Load() {
		if time.Now().After(deadline) {
			t.Fatal("revoke did not invalidate the token")
		}
		runtime.Gosched()
	}
}

func readFrame(t *testing.T, conn *ws.Conn) []byte {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, raw, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func assertOpen(t *testing.T, c *client) {
	t.Helper()
	select {
	case <-c.done:
		t.Fatal("unrelated subscription's connection closed")
	default:
	}
}

func TestRevokeReclaimsFullQueue(t *testing.T) {
	h := &Hub{clients: map[*client]bool{}}
	c := testClient(h, 2)
	a, b := activeSubscription("a"), activeSubscription("b")
	c.subs["a"], c.subs["b"] = a, b
	h.clients[c] = true
	writer, reader, _ := socketPair(t)
	c.conn = writer
	h.Publish(protocol.Result{CharacterID: "a", Revision: 2})
	h.Publish(protocol.Result{CharacterID: "a", Revision: 3})
	if c.queueSpace() != 0 || h.queued.Load() <= 0 {
		t.Fatal("A did not fill the small queue")
	}
	h.Revoke("a", "user")
	if c.queueSpace() != 2 || h.queued.Load() != 0 {
		t.Fatal("revoked deliveries still consume capacity", h.queued.Load())
	}
	h.Publish(protocol.Result{CharacterID: "b", Revision: 2})
	assertOpen(t, c)
	if c.queueSpace() != 1 {
		t.Fatal("B was not enqueued")
	}
	// A new token cannot revive an old delivery already held by a writer.
	c.subs["a"] = activeSubscription("a")
	if !c.writeDelivery(delivery{data: []byte(`stale A`), sub: a}) {
		t.Fatal("stale token closed the connection")
	}
	if !c.sendBytes([]byte(`barrier`)) {
		t.Fatal("barrier enqueue failed")
	}
	finished := make(chan struct{})
	go func() { defer close(finished); c.write() }()
	var result struct {
		protocol.Result
	}
	if err := json.Unmarshal(readFrame(t, reader), &result); err != nil || result.CharacterID != "b" || result.Revision != 2 {
		t.Fatal("expected only B delivery", result, err)
	}
	if raw := readFrame(t, reader); string(raw) != "barrier" {
		t.Fatalf("stale A was written: %s", raw)
	}
	c.close()
	waitSignal(t, finished)
	if h.queued.Load() != 0 {
		t.Fatal("queue bytes leaked", h.queued.Load())
	}
}

func TestRevokeCompactionPreservesFIFOAndBytes(t *testing.T) {
	h := &Hub{clients: map[*client]bool{}}
	c := testClient(h, 8)
	a, b, other := activeSubscription("a"), activeSubscription("b"), activeSubscription("c")
	c.subs["a"], c.subs["b"], c.subs["c"] = a, b, other
	h.clients[c] = true
	for _, m := range []delivery{{[]byte("a1"), a}, {[]byte("bbb"), b}, {[]byte("a2"), a}, {[]byte("cccc"), other}, {[]byte("reply"), nil}} {
		if !c.enqueue(m) {
			t.Fatal("initial enqueue failed")
		}
	}
	h.Revoke("a", "user")
	if h.queued.Load() != 12 {
		t.Fatal("wrong compacted byte count", h.queued.Load())
	}
	if !c.enqueue(delivery{[]byte("old"), a}) || h.queued.Load() != 12 {
		t.Fatal("inactive enqueue consumed capacity")
	}
	for _, want := range []string{"bbb", "cccc", "reply"} {
		m, ok := c.take()
		if !ok || string(m.data) != want {
			t.Fatal("other deliveries lost or reordered", m, want)
		}
	}
	c.close()
	c.close()
	h.Revoke("a", "user")
	if h.queued.Load() != 0 {
		t.Fatal("double release or byte leak", h.queued.Load())
	}
}

func TestConcurrentPublishRevokeAndWriter(t *testing.T) {
	const count = 100
	h := &Hub{clients: map[*client]bool{}}
	c := testClient(h, 2*count+1)
	a, b := activeSubscription("a"), activeSubscription("b")
	c.subs["a"], c.subs["b"] = a, b
	h.clients[c] = true
	writer, reader, _ := socketPair(t)
	c.conn = writer
	start, revoked, finished := make(chan struct{}), make(chan struct{}), make(chan struct{})
	go func() { defer close(finished); c.write() }()
	var publishers sync.WaitGroup
	for _, id := range []string{"a", "b"} {
		publishers.Add(1)
		go func() {
			defer publishers.Done()
			<-start
			for revision := int64(2); revision < count+2; revision++ {
				h.Publish(protocol.Result{CharacterID: id, Revision: revision})
			}
		}()
	}
	go func() { <-start; h.Revoke("a", "user"); close(revoked) }()
	close(start)
	publishers.Wait()
	waitSignal(t, revoked)
	assertOpen(t, c)
	if !c.sendBytes([]byte(`barrier`)) {
		t.Fatal("barrier enqueue failed")
	}
	nextB := int64(2)
	lastA := int64(1)
	for {
		raw := readFrame(t, reader)
		if string(raw) == "barrier" {
			break
		}
		var r protocol.Result
		if err := json.Unmarshal(raw, &r); err != nil {
			t.Fatal(err)
		}
		switch r.CharacterID {
		case "a": // Only frames started before revoke may already be on the wire.
			if r.Revision <= lastA {
				t.Fatal("duplicate/reordered A", r)
			}
			lastA = r.Revision
		case "b":
			if r.Revision != nextB {
				t.Fatal("missing/duplicate/reordered B", r, nextB)
			}
			nextB++
		default:
			t.Fatal("unexpected character", r)
		}
	}
	if nextB != count+2 {
		t.Fatal("B deliveries lost", nextB)
	}
	h.Publish(protocol.Result{CharacterID: "a", Revision: count + 2})
	c.sendBytes([]byte(`after revoke`))
	if string(readFrame(t, reader)) != "after revoke" {
		t.Fatal("A started writing after revoke returned")
	}
	c.close()
	waitSignal(t, finished)
	if h.queued.Load() != 0 {
		t.Fatal("queue bytes leaked", h.queued.Load())
	}
}

func TestRevokeBarrierIgnoresOtherCharacterWrite(t *testing.T) {
	h := &Hub{clients: map[*client]bool{}}
	c := testClient(h, 2)
	c.subs["a"], c.subs["b"] = activeSubscription("a"), activeSubscription("b")
	h.clients[c] = true
	writer, reader, gate := socketPair(t)
	c.conn = writer
	gate.armed.Store(true)
	finished := make(chan struct{})
	go func() { defer close(finished); c.writeDelivery(delivery{[]byte("B frame"), c.subs["b"]}) }()
	waitSignal(t, gate.entered)
	revoked := make(chan struct{})
	go func() { h.Revoke("a", "user"); close(revoked) }()
	waitSignal(t, revoked)
	assertOpen(t, c)
	gate.unblock()
	waitSignal(t, finished)
	if string(readFrame(t, reader)) != "B frame" {
		t.Fatal("B frame lost")
	}
	c.close()
}

func TestRevokeBarrierWaitsForRetiredCharacterWrite(t *testing.T) {
	for _, replace := range []bool{false, true} {
		t.Run(map[bool]string{false: "unsubscribe", true: "resubscribe"}[replace], func(t *testing.T) {
			h := &Hub{clients: map[*client]bool{}}
			c := testClient(h, 2)
			a := activeSubscription("a")
			c.subs["a"] = a
			h.clients[c] = true
			writer, reader, gate := socketPair(t)
			c.conn = writer
			gate.armed.Store(true)
			finished := make(chan struct{})
			go func() { defer close(finished); c.writeDelivery(delivery{[]byte("started A"), a}) }()
			waitSignal(t, gate.entered)
			h.mu.Lock()
			c.invalidate(a)
			delete(c.subs, "a")
			if replace {
				c.subs["a"] = activeSubscription("a")
			}
			// Capture the exact flight: Revoke must wait even if its token has
			// already been removed from the subscription registry.
			barrier := c.revoke("a", c.subs["a"])
			h.mu.Unlock()
			if barrier == nil {
				t.Fatal("retired write missing from revoke barrier")
			}
			select {
			case <-barrier:
				t.Fatal("barrier completed before the A write")
			default:
			}
			revoked := make(chan struct{})
			go func() { h.Revoke("a", "user"); close(revoked) }()
			gate.unblock()
			waitSignal(t, finished)
			waitSignal(t, revoked)
			waitSignal(t, barrier)
			if string(readFrame(t, reader)) != "started A" {
				t.Fatal("already-started write lost")
			}
			c.close()
		})
	}
}

func TestSlowRevokedWriterDoesNotBlockOtherCharacterService(t *testing.T) {
	store, err := sqlite.Open(filepath.Join(t.TempDir(), "barrier.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	owner, user := uuid.NewString(), "user"
	for _, id := range []string{owner, user} {
		if err := store.CreateUser(storage.User{ID: id, Name: "synthetic", TokenHash: id, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}); err != nil {
			t.Fatal(err)
		}
	}
	validator, err := character.NewValidator(4 << 20)
	if err != nil {
		t.Fatal(err)
	}
	s := character.New(store, validator)
	raw, err := os.ReadFile("../../../examples/character.json")
	if err != nil {
		t.Fatal(err)
	}
	a, err := s.Create(owner, raw)
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.Create(owner, raw)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Permission(owner, a.ID, user, "editor"); err != nil {
		t.Fatal(err)
	}
	h := New(s, config.Config{})
	c := testClient(h, 4)
	token := activeSubscription(a.ID)
	c.subs[a.ID] = token
	h.clients[c] = true
	writer, reader, gate := socketPair(t)
	c.conn = writer
	gate.armed.Store(true)
	writeFinished := make(chan struct{})
	go func() { defer close(writeFinished); c.writeDelivery(delivery{[]byte("started A"), token}) }()
	waitSignal(t, gate.entered)
	revoked := make(chan struct{})
	go func() {
		defer close(revoked)
		if err := s.Permission(owner, a.ID, user, ""); err != nil {
			t.Error(err)
		}
	}()
	waitInvalidated(t, token) // DB commit and barrier registration are now reached.
	select {
	case <-revoked:
		t.Fatal("DELETE returned before old A frame completed")
	default:
	}
	other := make(chan struct{})
	go func() {
		defer close(other)
		batch := protocol.Batch{OperationID: uuid.NewString(), ClientID: uuid.NewString(), BaseRevision: 1, Operations: []protocol.Operation{{Op: "inc", Path: "/runtime/hp", Value: json.RawMessage(`1`)}}}
		if _, err := s.Submit(owner, b.ID, "web", batch); err != nil {
			t.Error(err)
		}
		if err := s.Synchronize(owner, b.ID, 1, func(d protocol.Delta) error {
			if d.CurrentRevision != 2 || len(d.Operations) != 1 {
				t.Error("B did not advance", d)
			}
			return nil
		}); err != nil {
			t.Error(err)
		}
		if _, err := s.Create(owner, raw); err != nil {
			t.Error(err)
		}
	}()
	waitSignal(t, other)
	gate.unblock()
	waitSignal(t, writeFinished)
	waitSignal(t, revoked)
	if _, err := s.Snapshot(user, a.ID); err == nil {
		t.Fatal("revoked permission still readable")
	}
	if string(readFrame(t, reader)) != "started A" {
		t.Fatal("already-started write lost")
	}
	// After DELETE returns, an old token cannot start another network write.
	if !c.writeDelivery(delivery{[]byte("stale A"), token}) || !c.writeDelivery(delivery{data: []byte("barrier")}) {
		t.Fatal("connection closed")
	}
	if string(readFrame(t, reader)) != "barrier" {
		t.Fatal("old A token wrote after DELETE returned")
	}
	c.close()
	if h.queued.Load() != 0 {
		t.Fatal("queue bytes leaked", h.queued.Load())
	}
}
