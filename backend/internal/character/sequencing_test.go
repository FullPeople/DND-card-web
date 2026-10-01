package character

import (
	"sync"
	"testing"
	"time"

	"dnd-card/backend/internal/protocol"
)

func await(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		t.Fatal("unrelated character was blocked by service sequencing")
	}
}

func TestDifferentCharactersProgressDuringCommitPublish(t *testing.T) {
	s, _, u, a := setup(t)
	b, err := s.Create(u, []byte(fixture))
	if err != nil {
		t.Fatal(err)
	}
	entered, release, finished := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	s.Publish = func(r protocol.Result) {
		if r.CharacterID == a && r.Revision == 2 {
			close(entered)
			<-release
		}
	}
	go func() {
		defer close(finished)
		if _, e := s.Submit(u, a, "web", batch(1, operation("inc", "/runtime/hp", 1))); e != nil {
			t.Error(e)
		}
	}()
	await(t, entered)
	other := make(chan struct{})
	go func() {
		defer close(other)
		if _, e := s.Submit(u, b.ID, "web", batch(1, operation("inc", "/runtime/hp", 1))); e != nil {
			t.Error(e)
		}
		if e := s.Synchronize(u, b.ID, 1, func(d protocol.Delta) error {
			if d.CurrentRevision != 2 || len(d.Operations) != 1 {
				t.Error(d)
			}
			return nil
		}); e != nil {
			t.Error(e)
		}
		if _, e := s.Create(u, []byte(fixture)); e != nil {
			t.Error(e)
		}
		if e := s.Permission(u, b.ID, u, "viewer"); e == nil {
			t.Error("owner permission changed")
		}
	}()
	await(t, other)
	// The same character cannot publish revision 3 before revision 2 finishes.
	same := make(chan struct{})
	go func() {
		defer close(same)
		if _, e := s.Submit(u, a, "web", batch(1, operation("inc", "/runtime/hp", 1))); e != nil {
			t.Error(e)
		}
	}()
	select {
	case <-same:
		t.Fatal("same character bypassed commit/publish gate")
	case <-time.After(50 * time.Millisecond):
	}
	unblock()
	await(t, finished)
	await(t, same)
	s.sequence.mu.Lock()
	defer s.sequence.mu.Unlock()
	if len(s.sequence.gates) != 0 {
		t.Fatal("idle character gates leaked", len(s.sequence.gates))
	}
}

func TestSubscribeReplayAndConcurrentCommitsHaveNoGap(t *testing.T) {
	s, _, u, id := setup(t)
	if _, e := s.Submit(u, id, "web", batch(1, operation("inc", "/runtime/hp", 1))); e != nil {
		t.Fatal(e)
	}
	entered, release, subscribed := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	var mu sync.Mutex
	var revisions []int64
	live := false
	s.Publish = func(r protocol.Result) {
		mu.Lock()
		defer mu.Unlock()
		if live {
			revisions = append(revisions, r.Revision)
		}
	}
	go func() {
		defer close(subscribed)
		if e := s.Synchronize(u, id, 1, func(d protocol.Delta) error {
			close(entered)
			<-release
			mu.Lock()
			defer mu.Unlock()
			for _, r := range d.Operations {
				revisions = append(revisions, r.Revision)
			}
			live = true
			return nil
		}); e != nil {
			t.Error(e)
		}
	}()
	await(t, entered)
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, e := s.Submit(u, id, "web", batch(1, operation("inc", "/runtime/hp", 1))); e != nil {
				t.Error(e)
			}
		}()
	}
	unblock()
	await(t, subscribed)
	wg.Wait()
	if len(revisions) != 21 {
		t.Fatal("lost replay/live result", revisions)
	}
	for i, rev := range revisions {
		if rev != int64(i)+2 {
			t.Fatal("out of order", revisions)
		}
	}
	if len(s.sequence.gates) != 0 {
		t.Fatal("waiter gates leaked")
	}
}
