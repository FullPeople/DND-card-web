package character

import (
	"encoding/json"
	"math"
	"sort"
	"strings"

	"dnd-card/backend/internal/protocol"
)

// Only these legacy arrays are identity-bearing collections. Other arrays are atomic values.
var Collections = map[string]bool{"selections": true, "quickbarCopies": true, "quickbarActions": true, "adjustments": true, "rulePacks": true}
var protected = map[string]bool{"id": true, "schemaVersion": true, "revision": true, "createdAt": true, "updatedAt": true}

func escape(s string) string { return strings.ReplaceAll(strings.ReplaceAll(s, "~", "~0"), "/", "~1") }
func Pointer(path string) ([]string, error) {
	if len(path) < 2 || len(path) > 4096 || path[0] != '/' {
		return nil, protocol.Fail("invalid_path", 422, "path must be a non-root JSON pointer, at most 4096 bytes")
	}
	parts := strings.Split(path[1:], "/")
	if len(parts) > 32 {
		return nil, protocol.Fail("invalid_path", 422, "path too deep")
	}
	for i, p := range parts {
		for n := 0; n < len(p); n++ {
			if p[n] == '~' {
				if n+1 >= len(p) || (p[n+1] != '0' && p[n+1] != '1') {
					return nil, protocol.Fail("invalid_path", 422, "invalid pointer escape")
				}
				n++
			}
		}
		parts[i] = strings.ReplaceAll(strings.ReplaceAll(p, "~1", "/"), "~0", "~")
		if parts[i] == "" || parts[i] == "__proto__" || parts[i] == "prototype" || parts[i] == "constructor" {
			return nil, protocol.Fail("invalid_path", 422, "unsafe or empty path segment")
		}
	}
	return parts, nil
}
func PathOverlap(a, b string) bool {
	return a == b || strings.HasPrefix(a, b+"/") || strings.HasPrefix(b, a+"/")
}
func Decode(raw []byte) (map[string]any, error) {
	var d map[string]any
	err := json.Unmarshal(raw, &d)
	if err != nil || d == nil {
		return nil, protocol.Fail("validation_error", 422, "document must be an object")
	}
	return d, nil
}
func virtual(d map[string]any) (map[string]any, error) {
	b, _ := json.Marshal(d)
	v, _ := Decode(b)
	for k := range Collections {
		if rows, ok := v[k].([]any); ok {
			entities := map[string]any{}
			order := []any{}
			for _, row := range rows {
				m, ok := row.(map[string]any)
				if !ok {
					return nil, protocol.Fail("validation_error", 422, "entity must be object")
				}
				id, ok := m["id"].(string)
				if !ok || id == "" || entities[id] != nil {
					return nil, protocol.Fail("validation_error", 422, "missing or duplicate entity id")
				}
				entities[id] = m
				order = append(order, id)
			}
			v[k] = map[string]any{"entities": entities, "order": order}
		}
	}
	return v, nil
}
func materialize(v map[string]any) map[string]any {
	for k := range Collections {
		if c, ok := v[k].(map[string]any); ok {
			rows := []any{}
			for _, id := range c["order"].([]any) {
				rows = append(rows, c["entities"].(map[string]any)[id.(string)])
			}
			v[k] = rows
		}
	}
	return v
}
func lookup(v map[string]any, parts []string) (any, bool) {
	var cur any = v
	for _, p := range parts {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil, false
		}
		cur, ok = m[p]
		if !ok {
			return nil, false
		}
	}
	return cur, true
}
func parent(v map[string]any, parts []string) (map[string]any, error) {
	x, ok := lookup(v, parts[:len(parts)-1])
	m, yes := x.(map[string]any)
	if !ok || !yes {
		return nil, protocol.Fail("invalid_path", 422, "parent must exist and be an object; array indexes are forbidden")
	}
	return m, nil
}
func allowed(parts []string) error {
	if protected[parts[0]] {
		return protocol.Fail("invalid_path", 422, "server-managed metadata is immutable")
	}
	if Collections[parts[0]] && (len(parts) < 4 || parts[1] != "entities" || parts[3] == "id") {
		return protocol.Fail("invalid_path", 422, "use entity operations, or /collection/entities/id/field")
	}
	return nil
}
func Apply(d map[string]any, ops []protocol.Operation) (map[string]any, []string, error) {
	v, err := virtual(d)
	if err != nil {
		return nil, nil, err
	}
	touched := map[string]bool{}
	for _, op := range ops {
		parts, e := Pointer(op.Path)
		if e != nil {
			return nil, nil, e
		}
		var value any
		if len(op.Value) > 0 {
			if e = json.Unmarshal(op.Value, &value); e != nil {
				return nil, nil, protocol.Fail("invalid_operation", 422, "invalid value")
			}
		}
		if op.Op == "entity.upsert" || op.Op == "entity.delete" || op.Op == "order.move" {
			if op.EntityID == "" || len(op.EntityID) > 2000 {
				return nil, nil, protocol.Fail("invalid_operation", 422, "entityId required")
			}
			if _, e = Pointer("/" + escape(op.EntityID)); e != nil {
				return nil, nil, e
			}
			isRows := len(parts) == 1 && Collections[parts[0]]
			isMap := op.Path == "/runtime/resources"
			if !isRows && !isMap {
				return nil, nil, protocol.Fail("invalid_path", 422, "unregistered entity collection")
			}
			if isRows && v[parts[0]] == nil {
				if op.Op == "entity.delete" {
					touched[op.Path+"/entities/"+escape(op.EntityID)] = true
					continue
				}
				v[parts[0]] = map[string]any{"entities": map[string]any{}, "order": []any{}}
			}
			var entities map[string]any
			var c map[string]any
			if isRows {
				c = v[parts[0]].(map[string]any)
				entities = c["entities"].(map[string]any)
			} else {
				r, ok := lookup(v, parts)
				entities, _ = r.(map[string]any)
				if !ok || entities == nil {
					return nil, nil, protocol.Fail("invalid_path", 422, "resource collection missing")
				}
			}
			switch op.Op {
			case "entity.upsert":
				m, ok := value.(map[string]any)
				if !ok || isRows && m["id"] != op.EntityID {
					return nil, nil, protocol.Fail("invalid_operation", 422, "full entity object required with matching id")
				}
				if isRows && entities[op.EntityID] == nil {
					c["order"] = append(c["order"].([]any), op.EntityID)
				}
				entities[op.EntityID] = value
			case "entity.delete":
				delete(entities, op.EntityID)
				if isRows {
					order := []any{}
					for _, id := range c["order"].([]any) {
						if id != op.EntityID {
							order = append(order, id)
						}
					}
					c["order"] = order
				}
			case "order.move":
				if !isRows || entities[op.EntityID] == nil {
					return nil, nil, protocol.Fail("invalid_operation", 422, "move requires existing array entity")
				}
				if op.BeforeID != nil && (*op.BeforeID == op.EntityID || entities[*op.BeforeID] == nil) {
					return nil, nil, protocol.Fail("invalid_operation", 422, "invalid beforeId")
				}
				order := []any{}
				for _, id := range c["order"].([]any) {
					if id == op.EntityID {
						continue
					}
					if op.BeforeID != nil && id == *op.BeforeID {
						order = append(order, op.EntityID)
					}
					order = append(order, id)
				}
				if op.BeforeID == nil {
					order = append(order, op.EntityID)
				}
				c["order"] = order
			}
			p := op.Path + "/" + escape(op.EntityID)
			if isRows {
				p = op.Path + "/entities/" + escape(op.EntityID)
			}
			touched[p] = true
			if op.Op == "order.move" {
				touched[op.Path+"/order"] = true
				if op.BeforeID != nil {
					touched[op.Path+"/entities/"+escape(*op.BeforeID)] = true
				}
			}
			continue
		}
		if e = allowed(parts); e != nil {
			return nil, nil, e
		}
		m, e := parent(v, parts)
		if e != nil {
			return nil, nil, e
		}
		key := parts[len(parts)-1]
		switch op.Op {
		case "set":
			if len(op.Value) == 0 {
				return nil, nil, protocol.Fail("invalid_operation", 422, "set requires value")
			}
			m[key] = value
		case "unset":
			delete(m, key)
		case "inc":
			a, ok := m[key].(float64)
			b, yes := value.(float64)
			if !ok || !yes || math.IsInf(a+b, 0) || math.Abs(a+b) > 9007199254740991 {
				return nil, nil, protocol.Fail("invalid_operation", 422, "inc needs existing safe finite numeric field and numeric value")
			}
			m[key] = a + b
		default:
			return nil, nil, protocol.Fail("invalid_operation", 422, "unknown operation")
		}
		touched[op.Path] = true
	}
	paths := []string{}
	for p := range touched {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	return materialize(v), paths, nil
}
func operationPaths(op protocol.Operation) []string {
	p := op.Path
	if op.Op == "entity.upsert" || op.Op == "entity.delete" || op.Op == "order.move" {
		if Collections[strings.TrimPrefix(p, "/")] {
			p += "/entities"
		}
		p += "/" + escape(op.EntityID)
	}
	r := []string{p}
	if op.Op == "order.move" {
		r = append(r, op.Path+"/order")
		if op.BeforeID != nil {
			r = append(r, op.Path+"/entities/"+escape(*op.BeforeID))
		}
	}
	return r
}
func Conflicts(d map[string]any, incoming, history []protocol.Operation) []protocol.Conflict {
	v, _ := virtual(d)
	out := []protocol.Conflict{}
	seen := map[string]bool{}
	// Collapse repeated history paths before comparing; retain whether every write
	// to that exact path was an increment. A prior set must never be hidden by inc.
	serverPaths := map[string]bool{}
	for _, b := range history {
		for _, p := range operationPaths(b) {
			inc := b.Op == "inc" && p == b.Path
			old, exists := serverPaths[p]
			serverPaths[p] = inc && (!exists || old)
		}
	}
	for _, a := range incoming {
		for _, p := range operationPaths(a) {
			for q, onlyInc := range serverPaths {
				if a.Op == "inc" && a.Path == q && onlyInc {
					continue
				}
				if !PathOverlap(p, q) || seen[p] {
					continue
				}
				seen[p] = true
				parts, _ := Pointer(p)
				val, exists := lookup(v, parts)
				var client any
				_ = json.Unmarshal(a.Value, &client)
				if a.Op == "order.move" {
					client = map[string]any{"entityId": a.EntityID, "beforeId": a.BeforeID}
				}
				out = append(out, protocol.Conflict{Path: p, ServerValue: val, ServerExists: exists, ClientValue: client})
			}
		}
	}
	return out
}
func ValidateBatch(b protocol.Batch, max int) error {
	if b.BaseRevision < 1 || b.BaseRevision > 9007199254740991 || len(b.Operations) == 0 || len(b.Operations) > max {
		return protocol.Fail("validation_error", 422, "invalid revision or batch size")
	}
	for _, op := range b.Operations {
		if _, e := Pointer(op.Path); e != nil {
			return e
		}
		switch op.Op {
		case "set", "inc":
			if len(op.Value) == 0 || op.EntityID != "" || op.BeforeID != nil {
				return protocol.Fail("invalid_operation", 422, "invalid scalar operation fields")
			}
		case "unset":
			if len(op.Value) > 0 || op.EntityID != "" || op.BeforeID != nil {
				return protocol.Fail("invalid_operation", 422, "unset only takes path")
			}
		case "entity.upsert":
			if len(op.Value) == 0 || op.BeforeID != nil {
				return protocol.Fail("invalid_operation", 422, "upsert requires value")
			}
		case "entity.delete":
			if len(op.Value) > 0 || op.BeforeID != nil {
				return protocol.Fail("invalid_operation", 422, "delete only takes entityId")
			}
		case "order.move":
			if len(op.Value) > 0 {
				return protocol.Fail("invalid_operation", 422, "move does not take value")
			}
		default:
			return protocol.Fail("invalid_operation", 422, "unknown operation")
		}
	}
	return nil
}
