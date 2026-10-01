package fvtt

import (
	"dnd-card/backend/internal/adapters"
	"dnd-card/backend/internal/protocol"
	"encoding/json"
)

// HP is the deliberately bounded mapping example, not a full FVTT connector.
type HP struct{}

func (HP) Provider() string { return "fvtt" }
func (HP) Inbound(_ adapters.Binding, e adapters.Event) ([]protocol.Operation, error) {
	var p map[string]json.RawMessage
	if json.Unmarshal(e.Payload, &p) != nil || p["system.attributes.hp.value"] == nil || len(p) != 1 {
		return nil, protocol.Fail("invalid_operation", 422, "FVTT mapping v1 only accepts system.attributes.hp.value")
	}
	return []protocol.Operation{{Op: "set", Path: "/runtime/hp", Value: p["system.attributes.hp.value"]}}, nil
}
func (HP) Outbound(_ adapters.Binding, r protocol.Result) (json.RawMessage, error) {
	out := map[string]any{}
	for _, op := range r.Operations {
		if op.Path != "/runtime/hp" || op.Op != "set" {
			return nil, protocol.Fail("invalid_operation", 422, "mapping needs a snapshot for non-absolute HP updates")
		}
		out["system.attributes.hp.value"] = op.Value
	}
	return json.Marshal(out)
}
