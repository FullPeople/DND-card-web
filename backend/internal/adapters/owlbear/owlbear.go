package owlbear

import (
	"dnd-card/backend/internal/adapters"
	"dnd-card/backend/internal/protocol"
	"encoding/json"
)

type HP struct{}

func (HP) Provider() string { return "owlbear" }
func (HP) Inbound(_ adapters.Binding, e adapters.Event) ([]protocol.Operation, error) {
	var p map[string]json.RawMessage
	if json.Unmarshal(e.Payload, &p) != nil || p["health"] == nil || len(p) != 1 {
		return nil, protocol.Fail("invalid_operation", 422, "Owlbear mapping v1 only accepts health")
	}
	return []protocol.Operation{{Op: "set", Path: "/runtime/hp", Value: p["health"]}}, nil
}
func (HP) Outbound(_ adapters.Binding, r protocol.Result) (json.RawMessage, error) {
	out := map[string]any{}
	for _, op := range r.Operations {
		if op.Path != "/runtime/hp" || op.Op != "set" {
			return nil, protocol.Fail("invalid_operation", 422, "mapping needs a snapshot for non-absolute HP updates")
		}
		out["health"] = op.Value
	}
	return json.Marshal(out)
}
