package character

import "sync"

// sequencing holds one gate per active character, including all waiters.
// The table mutex protects references only; unrelated gates run concurrently.
type sequencing struct {
	mu    sync.Mutex
	gates map[string]*gate
}

type gate struct {
	mu   sync.Mutex
	refs int
}

func (s *sequencing) lock(id string) func() {
	s.mu.Lock()
	if s.gates == nil {
		s.gates = make(map[string]*gate)
	}
	g := s.gates[id]
	if g == nil {
		g = &gate{}
		s.gates[id] = g
	}
	g.refs++
	s.mu.Unlock()
	g.mu.Lock()
	return func() {
		g.mu.Unlock()
		s.mu.Lock()
		g.refs--
		if g.refs == 0 {
			delete(s.gates, id)
		}
		s.mu.Unlock()
	}
}
