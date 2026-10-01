package websocket

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"dnd-card/backend/internal/character"
	"dnd-card/backend/internal/config"
	"dnd-card/backend/internal/protocol"
	ws "github.com/gorilla/websocket"
)

type Hub struct {
	mu      sync.Mutex
	clients map[*client]bool
	Service *character.Service
	Config  config.Config
	queued  atomic.Int64
}
type client struct {
	conn    *ws.Conn
	user    string
	queue   []delivery // All queue access and byte accounting use sendMu.
	limit   int
	wake    chan struct{} // Notification only; deliveries remain in the controlled queue.
	done    chan struct{}
	once    sync.Once
	subs    map[string]*subscription
	sendMu  sync.Mutex
	writeMu sync.Mutex
	writing *writeFlight // Protected by sendMu; includes retired subscription tokens.
	queued  *atomic.Int64
}

type subscription struct {
	active      atomic.Bool
	characterID string // Immutable, including after replacement/unsubscribe.
}
type writeFlight struct {
	sub  *subscription
	done chan struct{}
}
type delivery struct {
	data []byte
	sub  *subscription // nil for connection-level responses
}

func New(s *character.Service, c config.Config) *Hub {
	h := &Hub{clients: map[*client]bool{}, Service: s, Config: c}
	s.Publish = h.Publish
	s.PermissionChanged = h.PermissionChanged
	s.PermissionRevoked = h.Revoke
	return h
}
func (c *client) closeLocked() {
	c.once.Do(func() {
		close(c.done)
		if c.conn != nil {
			_ = c.conn.Close()
		}
		for _, m := range c.queue {
			c.queued.Add(-int64(len(m.data)))
		}
		c.queue = nil
	})
}
func (c *client) close() { c.sendMu.Lock(); defer c.sendMu.Unlock(); c.closeLocked() }
func (c *client) send(v any) bool {
	b, e := json.Marshal(v)
	if e != nil {
		return false
	}
	return c.sendBytes(b)
}
func (c *client) sendBytes(b []byte) bool {
	return c.enqueue(delivery{data: b})
}
func (c *client) sendFor(v any, sub *subscription) bool {
	b, e := json.Marshal(v)
	return e == nil && c.enqueue(delivery{data: b, sub: sub})
}
func (c *client) enqueue(m delivery) bool {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	select {
	case <-c.done:
		return false
	default:
	}
	if m.sub != nil && !m.sub.active.Load() {
		return true
	}
	if len(c.queue) >= c.limit {
		c.closeLocked()
		return false
	}
	if c.queued.Add(int64(len(m.data))) > 64<<20 {
		c.queued.Add(-int64(len(m.data)))
		c.closeLocked()
		return false
	}
	c.queue = append(c.queue, m)
	c.notifyLocked()
	return true
}

func (c *client) notifyLocked() {
	select {
	case c.wake <- struct{}{}:
	default:
	}
}

func (c *client) take() (delivery, bool) {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	if len(c.queue) == 0 {
		return delivery{}, false
	}
	m := c.queue[0]
	copy(c.queue, c.queue[1:])
	c.queue[len(c.queue)-1] = delivery{}
	c.queue = c.queue[:len(c.queue)-1]
	c.queued.Add(-int64(len(m.data)))
	if len(c.queue) > 0 {
		c.notifyLocked()
	}
	return m, true
}

func (c *client) queueSpace() int {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	return c.limit - len(c.queue)
}

// Stable compaction under the same mutex as enqueue/take preserves all other
// tokens' FIFO order. Each removed delivery releases its bytes exactly once;
// a delivery already taken by the writer is no longer charged to the queue.
func (c *client) invalidate(sub *subscription) {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	c.invalidateLocked(sub)
}

func (c *client) invalidateLocked(sub *subscription) {
	sub.active.Store(false)
	kept := 0
	for _, m := range c.queue {
		if m.sub == sub {
			c.queued.Add(-int64(len(m.data)))
			continue
		}
		c.queue[kept] = m
		kept++
	}
	clear(c.queue[kept:])
	c.queue = c.queue[:kept]
}

func (c *client) revoke(id string, sub *subscription) <-chan struct{} {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	if sub != nil {
		c.invalidateLocked(sub)
	}
	// An earlier token may still be writing after resubscribe/unsubscribe. It
	// belongs to the same character and must also finish before DELETE returns.
	if f := c.writing; f != nil && f.sub != nil && f.sub.characterID == id {
		return f.done
	}
	return nil
}
func (h *Hub) Publish(r protocol.Result) {
	h.mu.Lock()
	defer h.mu.Unlock()
	message := struct {
		Type string `json:"type"`
		protocol.Result
	}{"character.operations", r}
	b, _ := json.Marshal(message)
	for c := range h.clients {
		if sub := c.subs[r.CharacterID]; sub != nil {
			c.enqueue(delivery{data: b, sub: sub})
		}
	}
}

// Role changes preserve read access and subscriptions. Every future HTTP/WS
// access still checks the committed permission through Service.
func (h *Hub) PermissionChanged(id, user, role string) {}

func (h *Hub) Revoke(id, user string) {
	h.mu.Lock()
	var affected []<-chan struct{}
	for c := range h.clients {
		if c.user == user {
			if done := c.revoke(id, c.subs[id]); done != nil {
				affected = append(affected, done)
			}
			delete(c.subs, id)
		}
	}
	h.mu.Unlock()
	// Queued messages carry the old subscription token and are discarded even
	// after a later grant/resubscribe. Finish any already-started network write
	// before returning; never hold the Hub registry lock while waiting for I/O.
	for _, done := range affected {
		<-done
	}
}
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		c.close()
	}
}
func (h *Hub) Serve(w http.ResponseWriter, r *http.Request, user string) {
	h.mu.Lock()
	if len(h.clients) >= h.Config.Connections {
		h.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(429)
		_ = json.NewEncoder(w).Encode(protocol.Fail("rate_limited", 429, "WebSocket connection limit reached"))
		return
	}
	up := ws.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024, CheckOrigin: func(r *http.Request) bool {
		return r.Header.Get("Origin") == "" || r.Header.Get("Origin") == h.Config.Origin
	}}
	conn, e := up.Upgrade(w, r, nil)
	if e != nil {
		h.mu.Unlock()
		return
	}
	c := &client{conn: conn, user: user, limit: h.Config.Queue, wake: make(chan struct{}, 1), done: make(chan struct{}), subs: map[string]*subscription{}, queued: &h.queued}
	h.clients[c] = true
	h.mu.Unlock()
	slog.Info("WebSocket connect", "userId", user)
	defer func() {
		c.close()
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
		slog.Info("WebSocket disconnect", "userId", user)
	}()
	go c.write()
	conn.SetReadLimit(int64(h.Config.WSMessage))
	_ = conn.SetReadDeadline(time.Now().Add(75 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(75 * time.Second)) })
	window := time.Now()
	count := 0
	for {
		_, raw, e := conn.ReadMessage()
		if e != nil {
			return
		}
		if time.Since(window) >= time.Second {
			window = time.Now()
			count = 0
		}
		count++
		if count > h.Config.ConnectionRate {
			c.close()
			return
		}
		var m struct {
			Type         string `json:"type"`
			CharacterID  string `json:"characterId"`
			LastRevision int64  `json:"lastRevision"`
		}
		if e = json.Unmarshal(raw, &m); e != nil {
			c.send(map[string]any{"type": "error", "code": "validation_error", "message": "invalid JSON message"})
			continue
		}
		switch m.Type {
		case "ping":
			c.send(map[string]any{"type": "pong"})
		case "unsubscribe":
			h.mu.Lock()
			if sub := c.subs[m.CharacterID]; sub != nil {
				c.invalidate(sub)
			}
			delete(c.subs, m.CharacterID)
			h.mu.Unlock()
			c.send(map[string]any{"type": "unsubscribed", "characterId": m.CharacterID})
		case "subscribe":
			e = h.Service.Synchronize(user, m.CharacterID, m.LastRevision, func(delta protocol.Delta) error {
				h.mu.Lock()
				defer h.mu.Unlock()
				if c.subs[m.CharacterID] == nil && len(c.subs) >= h.Config.Subscriptions {
					return protocol.Fail("rate_limited", 429, "subscription limit reached")
				}
				// Bound replay queue. HTTP delta is the fallback for larger histories.
				if old := c.subs[m.CharacterID]; old != nil {
					c.invalidate(old)
				}
				if len(delta.Operations)+1 > c.queueSpace() {
					return protocol.Fail("resync_required", 409, "use HTTP delta or snapshot before subscribing")
				}
				sub := &subscription{characterID: m.CharacterID}
				sub.active.Store(true)
				for _, op := range delta.Operations {
					c.sendFor(struct {
						Type string `json:"type"`
						protocol.Result
					}{"character.operations", op}, sub)
				}
				c.sendFor(map[string]any{"type": "subscribed", "characterId": m.CharacterID, "revision": delta.CurrentRevision}, sub)
				c.subs[m.CharacterID] = sub
				return nil
			})
			if e != nil {
				var p *protocol.Error
				if !errors.As(e, &p) {
					p = protocol.Fail("internal_error", 500, "subscription failed")
				}
				h.mu.Lock()
				if sub := c.subs[m.CharacterID]; sub != nil {
					c.invalidate(sub)
				}
				delete(c.subs, m.CharacterID)
				h.mu.Unlock()
				kind := "error"
				if p.Code == "resync_required" {
					kind = p.Code
					slog.Info("resync", "characterId", m.CharacterID)
				}
				c.send(struct {
					Type        string `json:"type"`
					CharacterID string `json:"characterId"`
					*protocol.Error
				}{kind, m.CharacterID, p})
			}
		default:
			c.send(map[string]any{"type": "error", "code": "invalid_operation", "message": "unknown WebSocket message; submit mutations through HTTP"})
		}
	}
}
func (c *client) write() {
	tick := time.NewTicker(25 * time.Second)
	defer tick.Stop()
	defer c.close()
	for {
		select {
		case <-c.done:
			return
		case <-c.wake:
			b, ok := c.take()
			if ok && !c.writeDelivery(b) {
				return
			}
		case <-tick.C:
			if c.conn.WriteControl(ws.PingMessage, nil, time.Now().Add(10*time.Second)) != nil {
				return
			}
		}
	}
}

func (c *client) writeDelivery(m delivery) bool {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	c.sendMu.Lock()
	if m.sub != nil && !m.sub.active.Load() {
		c.sendMu.Unlock()
		return true
	}
	f := &writeFlight{sub: m.sub, done: make(chan struct{})}
	c.writing = f
	c.sendMu.Unlock()
	defer func() {
		c.sendMu.Lock()
		c.writing = nil
		close(f.done)
		c.sendMu.Unlock()
	}()
	_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return c.conn.WriteMessage(ws.TextMessage, m.data) == nil
}
