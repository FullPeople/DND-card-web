package adapters_test

import (
	"context"
	"dnd-card/backend/internal/adapters"
	"dnd-card/backend/internal/adapters/fvtt"
	"dnd-card/backend/internal/adapters/owlbear"
	"dnd-card/backend/internal/protocol"
	"testing"
)

type sink struct{ batches []protocol.Batch }

func (s *sink) Submit(_, _, _ string, b protocol.Batch) (protocol.Result, error) {
	s.batches = append(s.batches, b)
	return protocol.Result{OperationID: b.OperationID}, nil
}
func TestAdapterBoundaryAndEventIdentity(t *testing.T) {
	for _, a := range []adapters.Adapter{fvtt.HP{}, owlbear.HP{}} {
		b := adapters.Binding{ID: "binding", Provider: a.Provider(), MappingVersion: 1, Origin: "server", LastRevision: 17}
		payload := []byte(`{"health":12}`)
		if a.Provider() == "fvtt" {
			payload = []byte(`{"system.attributes.hp.value":12}`)
		}
		e := adapters.Event{ID: "event", Origin: "external", Revision: 2, Payload: payload}
		s := &sink{}
		one, err := adapters.Dispatch(context.Background(), s, a, "user", b, e)
		if err != nil {
			t.Fatal(err)
		}
		two, err := adapters.Dispatch(context.Background(), s, a, "user", b, e)
		if err != nil || one.OperationID != two.OperationID {
			t.Fatal("unstable event identity")
		}
		e.Origin = "server"
		r, err := adapters.Dispatch(context.Background(), s, a, "user", b, e)
		if err != nil || r != nil || len(s.batches) != 2 {
			t.Fatal("echo not filtered")
		}
		if s.batches[0].Operations[0].Path != "/runtime/hp" {
			t.Fatal(s.batches)
		}
		if s.batches[0].BaseRevision != 17 || s.batches[1].BaseRevision != 17 {
			t.Fatal("external revision entered canonical revision space", s.batches)
		}
		e.Origin = "external"
		b.LastEventID = e.ID
		if r, err = adapters.Dispatch(context.Background(), s, a, "user", b, e); err != nil || r != nil || len(s.batches) != 2 {
			t.Fatal("last event not filtered", r, err)
		}
		b.LastEventID = ""
		b.LastRevision = 0
		if _, err = adapters.Dispatch(context.Background(), s, a, "user", b, e); err == nil || len(s.batches) != 2 {
			t.Fatal("unconfirmed binding dispatched", err)
		}
	}
}
