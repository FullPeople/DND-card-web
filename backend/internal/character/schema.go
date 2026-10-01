package character

import (
	"encoding/json"
	"fmt"
	"strings"

	"dnd-card/backend/internal/protocol"
	"dnd-card/backend/schemas"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

type Validator struct {
	schema   *jsonschema.Schema
	roots    map[string]bool
	MaxBytes int
}

func NewValidator(maxBytes int) (*Validator, error) {
	b, e := schemas.Files.ReadFile("character/v1.json")
	if e != nil {
		return nil, e
	}
	var raw any
	if e = json.Unmarshal(b, &raw); e != nil {
		return nil, e
	}
	c := jsonschema.NewCompiler()
	if e = c.AddResource("character.json", raw); e != nil {
		return nil, e
	}
	s, e := c.Compile("character.json")
	if e != nil {
		return nil, e
	}
	roots := map[string]bool{}
	for k := range raw.(map[string]any)["properties"].(map[string]any) {
		roots[k] = true
	}
	return &Validator{schema: s, roots: roots, MaxBytes: maxBytes}, nil
}
func bounded(v any, depth int, budget *int) error {
	*budget--
	if depth > 40 || *budget < 0 {
		return protocol.Fail("validation_error", 422, "JSON nesting or node limit exceeded")
	}
	switch x := v.(type) {
	case map[string]any:
		for k, y := range x {
			if k == "__proto__" || k == "prototype" || k == "constructor" {
				return protocol.Fail("validation_error", 422, "unsafe object key")
			}
			if e := bounded(y, depth+1, budget); e != nil {
				return e
			}
		}
	case []any:
		for _, y := range x {
			if e := bounded(y, depth+1, budget); e != nil {
				return e
			}
		}
	}
	return nil
}
func (v *Validator) Validate(d map[string]any) error {
	budget := 200000
	if e := bounded(d, 0, &budget); e != nil {
		return e
	}
	b, e := json.Marshal(d)
	if e != nil || len(b) > v.MaxBytes {
		return protocol.Fail("payload_too_large", 413, "snapshot exceeds configured byte limit")
	}
	if e = v.schema.Validate(d); e != nil {
		return protocol.Fail("validation_error", 422, "document does not satisfy Character v1 schema")
	}
	if _, e = virtual(d); e != nil {
		return e
	}
	if s, ok := d["spellSettings"].(map[string]any); ok {
		for _, raw := range s["slots"].(map[string]any) {
			r := raw.(map[string]any)
			if r["used"].(float64) > r["max"].(float64) {
				return protocol.Fail("validation_error", 422, "spell slot used exceeds max")
			}
		}
		for _, key := range []string{"prepared"} {
			if e = uniqueNonEmpty(s[key].([]any)); e != nil {
				return e
			}
		}
		if groups, ok := s["cantrips"].(map[string]any); ok {
			for _, a := range groups {
				if e = uniqueNonEmpty(a.([]any)); e != nil {
					return e
				}
			}
		}
	}
	return nil
}
func uniqueNonEmpty(a []any) error {
	seen := map[string]bool{}
	for _, v := range a {
		s := v.(string)
		if s != "" && seen[s] {
			return protocol.Fail("validation_error", 422, "duplicate occupied spell slot")
		}
		seen[s] = true
	}
	return nil
}
func (v *Validator) Paths(ops []protocol.Operation) error {
	for _, op := range ops {
		p, e := Pointer(op.Path)
		if e != nil {
			return e
		}
		if !v.roots[p[0]] {
			return protocol.Fail("invalid_path", 422, "unknown root field")
		}
	}
	return nil
}

// Migrate is the single deterministic import boundary. Unknown versions fail closed.
// V1 remains V1: only a historical no-op saving-throw expertise bug is normalized.
func (v *Validator) Migrate(raw json.RawMessage) (map[string]any, error) {
	d, e := Decode(raw)
	if e != nil {
		return nil, e
	}
	if wrapped, ok := d["character"].(map[string]any); ok && d["format"] == "dnd-card-web" {
		d = wrapped
	}
	if d["schemaVersion"] != float64(1) {
		return nil, protocol.Fail("schema_mismatch", 422, "supported document schemaVersion is 1")
	}
	if expertise, ok := d["expertise"].(map[string]any); ok {
		for _, a := range strings.Fields("str dex con int wis cha") {
			if expertise["save:"+a] == false {
				delete(expertise, "save:"+a)
			}
		}
	}
	if e = v.Validate(d); e != nil {
		return nil, e
	}
	return d, nil
}
func DocumentBytes(d map[string]any) json.RawMessage {
	b, e := json.Marshal(d)
	if e != nil {
		panic(fmt.Sprintf("validated document became invalid: %v", e))
	}
	return b
}
