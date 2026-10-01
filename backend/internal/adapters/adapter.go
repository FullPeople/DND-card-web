package adapters

import (
	"context"
	"encoding/json"
	"log/slog"

	"dnd-card/backend/internal/protocol"
	"github.com/google/uuid"
)

type Binding struct {
	ID, CharacterID, Provider, ExternalID, Origin, LastEventID string
	MappingVersion                                             int
	// LastRevision is the last confirmed canonical server revision, never an external sequence.
	LastRevision int64
	Config       json.RawMessage
}
type Event struct {
	ID, Origin string
	Revision   int64 // External platform version/sequence; only adapter event semantics use it.
	Payload    json.RawMessage
}

// An adapter performs pure translation. A connector owns external authentication and delivery.
type Adapter interface {
	Provider() string
	Inbound(Binding, Event) ([]protocol.Operation, error)
	Outbound(Binding, protocol.Result) (json.RawMessage, error)
}
type Pipeline interface {
	Submit(user, id, origin string, b protocol.Batch) (protocol.Result, error)
}

// Dispatch requires an authenticated service principal with character permission.
// The deterministic operationId protects against replay beyond lastEventId or log retention.
// The connector persists the original Binding.LastRevision and event payload in
// its pending dispatch before submission. Unknown outcomes retry that exact batch.
// Only after server confirmation may it persist LastRevision/LastEventID via its
// binding repository; Dispatch neither mutates bindings nor writes checkpoints.
func Dispatch(ctx context.Context, p Pipeline, a Adapter, user string, b Binding, e Event) (*protocol.Result, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if e.ID == "" || b.ID == "" || a.Provider() != b.Provider || b.MappingVersion != 1 {
		return nil, protocol.Fail("validation_error", 422, "invalid adapter binding/event")
	}
	if e.Origin == b.Origin || e.ID == b.LastEventID {
		return nil, nil
	}
	if b.LastRevision < 1 {
		return nil, protocol.Fail("validation_error", 422, "binding requires a confirmed server revision")
	}
	ops, err := a.Inbound(b, e)
	if err != nil {
		slog.Warn("adapter error", "provider", b.Provider, "bindingId", b.ID)
		return nil, err
	}
	batch := protocol.Batch{OperationID: uuid.NewSHA1(uuid.NameSpaceURL, []byte(b.ID+"\n"+e.ID)).String(), ClientID: uuid.NewSHA1(uuid.NameSpaceURL, []byte(b.ID)).String(), BaseRevision: b.LastRevision, Operations: ops}
	r, err := p.Submit(user, b.CharacterID, "adapter:"+b.Provider+":"+b.ID, batch)
	return &r, err
}
