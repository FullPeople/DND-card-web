package websocket

import (
	"dnd-card/backend/internal/protocol"
	"testing"
)

func TestSlowClientDoesNotBlockOthers(t *testing.T) {
	h := &Hub{clients: map[*client]bool{}}
	makeClient := func(size int) *client {
		sub := &subscription{}
		sub.active.Store(true)
		return &client{limit: size, wake: make(chan struct{}, 1), done: make(chan struct{}), subs: map[string]*subscription{"card": sub}, queued: &h.queued}
	}
	slow, fast := makeClient(1), makeClient(8)
	h.clients[slow] = true
	h.clients[fast] = true
	if !slow.sendBytes([]byte(`occupied`)) {
		t.Fatal("initial enqueue")
	}
	h.Publish(protocol.Result{CharacterID: "card", Revision: 2})
	select {
	case <-slow.done:
	default:
		t.Fatal("slow client not closed")
	}
	if _, ok := fast.take(); !ok {
		t.Fatal("fast client blocked")
	}
	fast.close()
	if h.queued.Load() != 0 {
		t.Fatal("queue bytes leaked", h.queued.Load())
	}
}

func TestRevokeInvalidatesQueuedCharacterOnly(t *testing.T) {
	h := &Hub{clients: map[*client]bool{}}
	a, b := &subscription{}, &subscription{}
	a.active.Store(true)
	b.active.Store(true)
	c := &client{user: "user", limit: 8, wake: make(chan struct{}, 1), done: make(chan struct{}), subs: map[string]*subscription{"a": a, "b": b}, queued: &h.queued}
	h.clients[c] = true
	h.Publish(protocol.Result{CharacterID: "a", Revision: 2})
	queuedA, ok := c.take()
	if !ok {
		t.Fatal("initial delivery missing")
	}
	h.PermissionChanged("a", "user", "editor")
	if !a.active.Load() || c.subs["a"] != a {
		t.Fatal("role change revoked subscription")
	}
	h.Revoke("a", "user")
	if a.active.Load() || c.subs["a"] != nil || c.subs["b"] != b {
		t.Fatal("revoke affected other subscriptions")
	}
	select {
	case <-c.done:
		t.Fatal("connection closed")
	default:
	}
	// A new subscription must not revive old queued messages.
	next := &subscription{}
	next.active.Store(true)
	c.subs["a"] = next
	if !c.writeDelivery(queuedA) {
		t.Fatal("invalidated delivery closed socket")
	}
	// nil conn deliberately panics if the stale delivery attempts network I/O.
	h.Revoke("a", "user")
	h.Publish(protocol.Result{CharacterID: "a", Revision: 3})
	h.Publish(protocol.Result{CharacterID: "b", Revision: 2})
	if c.queueSpace() != 7 {
		t.Fatal("revoked character broadcast queued", c.queueSpace())
	}
	m, ok := c.take()
	if !ok || m.sub != b {
		t.Fatal("remaining character subscription lost")
	}
	c.close()
	if h.queued.Load() != 0 {
		t.Fatal("queue accounting leaked")
	}
}
