package adapters_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"dnd-card/backend/internal/adapters"
	"dnd-card/backend/internal/adapters/fvtt"
	"dnd-card/backend/internal/character"
	"dnd-card/backend/internal/protocol"
	"dnd-card/backend/internal/storage"
	"dnd-card/backend/internal/storage/sqlite"
	"github.com/google/uuid"
)

func TestDispatchUsesConfirmedServerRevisionWithRealSQLite(t *testing.T) {
	store, e := sqlite.Open(filepath.Join(t.TempDir(), "adapter.db"))
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	u := uuid.NewString()
	if e = store.CreateUser(storage.User{ID: u, TokenHash: u}); e != nil {
		t.Fatal(e)
	}
	v, e := character.NewValidator(4 << 20)
	if e != nil {
		t.Fatal(e)
	}
	s := character.New(store, v)
	raw, e := os.ReadFile("../../examples/character.json")
	if e != nil {
		t.Fatal(e)
	}
	c, e := s.Create(u, raw)
	if e != nil {
		t.Fatal(e)
	}
	b := adapters.Binding{ID: "binding-a", CharacterID: c.ID, Provider: "fvtt", MappingVersion: 1, Origin: "adapter:fvtt:binding-a", LastRevision: 1}
	event := adapters.Event{ID: "external-event-99", Origin: "external", Revision: 99, Payload: []byte(`{"system.attributes.hp.value":12}`)}
	published := 0
	s.Publish = func(protocol.Result) { published++ }
	first, e := adapters.Dispatch(context.Background(), s, fvtt.HP{}, u, b, event)
	if e != nil || first.BaseRevision != 1 || first.Revision != 2 {
		t.Fatal(first, e)
	}
	// A connector retry must keep its original confirmed base, even after commit.
	retry, e := adapters.Dispatch(context.Background(), s, fvtt.HP{}, u, b, event)
	if e != nil || retry.OperationID != first.OperationID || retry.Revision != 2 || published != 1 {
		t.Fatal(retry, e, published)
	}
	b.LastRevision = first.Revision
	b.LastEventID = event.ID
	filtered, e := adapters.Dispatch(context.Background(), s, fvtt.HP{}, u, b, event)
	if e != nil || filtered != nil {
		t.Fatal(filtered, e)
	}
	event.ID = "external-event-100"
	event.Revision = 100
	event.Payload = []byte(`{"system.attributes.hp.value":11}`)
	next, e := adapters.Dispatch(context.Background(), s, fvtt.HP{}, u, b, event)
	if e != nil || next.BaseRevision != 2 || next.Revision != 3 {
		t.Fatal(next, e)
	}
}
