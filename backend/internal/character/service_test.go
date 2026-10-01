package character

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"sync"
	"testing"

	"dnd-card/backend/internal/protocol"
	"dnd-card/backend/internal/storage"
	"dnd-card/backend/internal/storage/sqlite"
	"github.com/google/uuid"
)

const fixture = `{"schemaVersion":1,"id":"legacy:original","revision":7,"name":"Synthetic","player":"","edition":"2024","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","abilities":{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10},"baseHp":20,"identity":{"gender":"","alignment":"","age":"","description":""},"selections":[],"answers":{},"reviewed":[],"profile":{"enabledSources":[],"optional":{"feats":true,"multiclass":false,"legacy":false},"exceptions":{}},"notes":"","runtime":{"hp":20,"tempHp":0,"inspiration":0,"resources":{}}}`

func setup(t *testing.T) (*Service, *storage.Store, string, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	store, e := sqlite.Open(path)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { store.Close() })
	user := uuid.NewString()
	if e = store.CreateUser(storage.User{ID: user, Name: "test", TokenHash: user, CreatedAt: now()}); e != nil {
		t.Fatal(e)
	}
	v, e := NewValidator(4 << 20)
	if e != nil {
		t.Fatal(e)
	}
	s := New(store, v)
	s.Rate = 10000
	c, e := s.Create(user, []byte(fixture))
	if e != nil {
		t.Fatal(e)
	}
	return s, store, user, c.ID
}
func operation(op, path string, value any) protocol.Operation {
	r := protocol.Operation{Op: op, Path: path}
	if value != nil {
		r.Value, _ = json.Marshal(value)
	}
	return r
}
func batch(base int64, ops ...protocol.Operation) protocol.Batch {
	return protocol.Batch{OperationID: uuid.NewString(), ClientID: uuid.NewString(), BaseRevision: base, Operations: ops}
}
func code(t *testing.T, e error, want string) {
	t.Helper()
	var p *protocol.Error
	if !errors.As(e, &p) || p.Code != want {
		t.Fatalf("wanted %s got %v", want, e)
	}
}
func TestPathOverlap(t *testing.T) {
	for _, r := range []struct {
		a, b string
		want bool
	}{{"/profile", "/profile/name", true}, {"/x", "/xy", false}, {"/x", "/x", true}, {"/selections/entities/a", "/selections/entities/b", false}, {"/a~1b", "/a/b", false}} {
		if PathOverlap(r.a, r.b) != r.want || PathOverlap(r.b, r.a) != r.want {
			t.Fatal(r)
		}
	}
	for _, p := range []string{"", "/", "x", "/x/~2", "/x//y", "/constructor"} {
		if _, e := Pointer(p); e == nil {
			t.Fatal(p)
		}
	}
}
func TestCreateSnapshotAndMigration(t *testing.T) {
	s, _, u, id := setup(t)
	c, e := s.Snapshot(u, id)
	if e != nil || c.Revision != 1 || c.SchemaVersion != 1 {
		t.Fatal(c, e)
	}
	d, _ := Decode(c.Document)
	if d["id"] != "legacy:original" || d["revision"] != float64(1) {
		t.Fatal(d)
	}
	d["expertise"] = map[string]any{"save:str": false, "arcana": true}
	first, e := s.Validator.Migrate(DocumentBytes(d))
	if e != nil {
		t.Fatal(e)
	}
	second, e := s.Validator.Migrate(DocumentBytes(first))
	if e != nil || string(DocumentBytes(first)) != string(DocumentBytes(second)) {
		t.Fatal("non deterministic migration")
	}
	d["schemaVersion"] = float64(2)
	_, e = s.Validator.Migrate(DocumentBytes(d))
	code(t, e, "schema_mismatch")
}
func TestScalarRebaseConflictAndIdempotency(t *testing.T) {
	s, _, u, id := setup(t)
	a := batch(1, operation("inc", "/runtime/hp", -5))
	r, e := s.Submit(u, id, "web", a)
	if e != nil || r.Revision != 2 {
		t.Fatal(r, e)
	}
	again, e := s.Submit(u, id, "web", a)
	if e != nil || again.Revision != 2 {
		t.Fatal(again, e)
	}
	r, e = s.Submit(u, id, "web", batch(1, operation("inc", "/runtime/hp", -3)))
	if e != nil || !r.Rebased || r.Revision != 3 {
		t.Fatal(r, e)
	}
	r, e = s.Submit(u, id, "web", batch(1, operation("set", "/abilities/str", 16)))
	if e != nil || r.Revision != 4 {
		t.Fatal(r, e)
	}
	_, e = s.Submit(u, id, "web", batch(1, operation("set", "/runtime/hp", 99)))
	code(t, e, "revision_conflict")
	a.Operations[0].Value = []byte(`-7`)
	_, e = s.Submit(u, id, "web", a)
	code(t, e, "duplicate_operation")
	c, _ := s.Snapshot(u, id)
	d, _ := Decode(c.Document)
	if d["runtime"].(map[string]any)["hp"] != float64(12) {
		t.Fatal(d)
	}
	_, e = s.Submit(u, id, "web", batch(4, operation("set", "/biography", map[string]any{"story": "a"})))
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(u, id, "web", batch(5, operation("unset", "/biography", nil)))
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(u, id, "web", batch(4, operation("set", "/biography/story", "b")))
	code(t, e, "revision_conflict")
}
func TestEntitiesAndOrder(t *testing.T) {
	s, _, u, id := setup(t)
	up := func(id, name string) protocol.Operation {
		o := operation("entity.upsert", "/quickbarActions", map[string]any{"id": id, "name": name, "attack": "", "damage": ""})
		o.EntityID = id
		return o
	}
	_, e := s.Submit(u, id, "web", batch(1, up("a", "A")))
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(u, id, "web", batch(1, up("b", "B")))
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(u, id, "web", batch(3, operation("set", "/quickbarActions/entities/a/name", "New")))
	if e != nil {
		t.Fatal(e)
	}
	before := "a"
	move := protocol.Operation{Op: "order.move", Path: "/quickbarActions", EntityID: "b", BeforeID: &before}
	_, e = s.Submit(u, id, "web", batch(4, move))
	if e != nil {
		t.Fatal(e)
	}
	c, _ := s.Snapshot(u, id)
	d, _ := Decode(c.Document)
	if d["quickbarActions"].([]any)[0].(map[string]any)["id"] != "b" {
		t.Fatal(d)
	}
	_, e = s.Submit(u, id, "web", batch(5, protocol.Operation{Op: "entity.delete", Path: "/quickbarActions", EntityID: "a"}))
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(u, id, "web", batch(5, operation("set", "/quickbarActions/entities/a/name", "bad")))
	code(t, e, "revision_conflict")
	_, e = s.Submit(u, id, "web", batch(6, operation("set", "/quickbarActions/0/name", "bad")))
	code(t, e, "invalid_path")
}
func TestRollbackPersistenceDeltaRetention(t *testing.T) {
	s, store, u, id := setup(t)
	a := batch(1, operation("inc", "/runtime/hp", -5))
	s.Retention = 1
	r, e := s.Submit(u, id, "web", a)
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(u, id, "web", batch(2, operation("set", "/abilities/str", 0)))
	code(t, e, "validation_error")
	c, _ := s.Snapshot(u, id)
	if c.Revision != 2 {
		t.Fatal(c)
	}
	delta, e := s.Delta(u, id, 1)
	if e != nil || len(delta.Operations) != 1 {
		t.Fatal(delta, e)
	}
	_, e = s.Submit(u, id, "web", batch(2, operation("set", "/name", "Changed")))
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Delta(u, id, 1)
	code(t, e, "resync_required")
	again, e := s.Submit(u, id, "web", a)
	if e != nil || again.Revision != r.Revision {
		t.Fatal(again, e)
	}
	// A real database failure after snapshot UPDATE must roll back the snapshot too.
	if e = store.DB.Exec("CREATE TRIGGER reject_log BEFORE INSERT ON character_operations BEGIN SELECT RAISE(ABORT, 'injected'); END").Error; e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(u, id, "web", batch(3, operation("inc", "/runtime/hp", -1)))
	if e == nil {
		t.Fatal("expected injected failure")
	}
	c, _ = s.Snapshot(u, id)
	if c.Revision != 3 {
		t.Fatal(c)
	}
	var dbs []struct{ File string }
	store.DB.Raw("PRAGMA database_list").Scan(&dbs)
	path := dbs[0].File
	store.Close()
	reopened, e := sqlite.Open(path)
	if e != nil {
		t.Fatal(e)
	}
	defer reopened.Close()
	s.Repo = reopened
	c, e = s.Snapshot(u, id)
	if e != nil || c.Revision != 3 {
		t.Fatal(c, e)
	}
}
func TestPermissionsAndConcurrentInc(t *testing.T) {
	s, store, u, id := setup(t)
	other := uuid.NewString()
	store.CreateUser(storage.User{ID: other, TokenHash: other})
	_, e := s.Submit(other, id, "web", batch(1, operation("inc", "/runtime/hp", -1)))
	code(t, e, "forbidden")
	if e = s.Permission(u, id, other, "viewer"); e != nil {
		t.Fatal(e)
	}
	_, e = s.Snapshot(other, id)
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(other, id, "web", batch(1, operation("inc", "/runtime/hp", -1)))
	code(t, e, "forbidden")
	s.Permission(u, id, other, "editor")
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := s.Submit(other, id, "web", batch(1, operation("inc", "/runtime/hp", -1))); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	c, e := s.Snapshot(u, id)
	d, _ := Decode(c.Document)
	if e != nil || c.Revision != 21 || d["runtime"].(map[string]any)["hp"] != float64(0) {
		t.Fatal(c, e)
	}
}

func TestDeltaReplayAndCommitNotification(t *testing.T) {
	s, _, u, id := setup(t)
	start, _ := s.Snapshot(u, id)
	notifications := 0
	s.Publish = func(r protocol.Result) {
		notifications++
		snapshot, e := s.Snapshot(u, id)
		if e != nil || snapshot.Revision != r.Revision {
			t.Errorf("broadcast before commit: %v", e)
		}
	}
	for _, b := range []protocol.Batch{batch(1, operation("inc", "/runtime/hp", -2)), batch(2, operation("set", "/identity/gender", "test")), batch(3, operation("set", "/biography", map[string]any{"story": "test"})), batch(4, operation("unset", "/biography", nil))} {
		if _, e := s.Submit(u, id, "web", b); e != nil {
			t.Fatal(e)
		}
	}
	_, e := s.Submit(u, id, "web", batch(5, operation("unset", "/abilities", nil)))
	code(t, e, "validation_error")
	if notifications != 4 {
		t.Fatal(notifications)
	}
	d, _ := Decode(start.Document)
	delta, e := s.Delta(u, id, 1)
	if e != nil {
		t.Fatal(e)
	}
	for _, r := range delta.Operations {
		d, _, e = Apply(d, r.Operations)
		if e != nil {
			t.Fatal(e)
		}
		d["revision"] = float64(r.Revision)
		d["updatedAt"] = r.UpdatedAt
	}
	snapshot, _ := s.Snapshot(u, id)
	if string(DocumentBytes(d)) != string(snapshot.Document) {
		t.Fatal("delta did not reproduce snapshot")
	}
}
func TestOperationValidationAndRollback(t *testing.T) {
	for _, test := range []struct {
		op   protocol.Operation
		code string
	}{
		{operation("set", "/schemaVersion", 2), "invalid_path"},
		{operation("set", "/abilities/str", "bad"), "validation_error"},
		{operation("inc", "/name", 1), "invalid_operation"},
		{operation("set", "/missing/value", 1), "invalid_path"},
		{operation("set", "/answers/x/0", "id"), "invalid_path"},
		{operation("set", "/runtime/__proto__", map[string]any{}), "invalid_path"},
		{operation("unknown", "/name", 1), "invalid_operation"},
	} {
		t.Run(test.op.Op+test.op.Path, func(t *testing.T) {
			s, _, u, id := setup(t)
			_, e := s.Submit(u, id, "web", batch(1, operation("inc", "/runtime/hp", -2), test.op))
			code(t, e, test.code)
			c, _ := s.Snapshot(u, id)
			if c.Revision != 1 {
				t.Fatal("partial commit")
			}
		})
	}
}
func TestConcurrentSameIDAndNumericEntityIDs(t *testing.T) {
	s, _, u, id := setup(t)
	b := batch(1, operation("inc", "/runtime/hp", -5))
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, e := s.Submit(u, id, "web", b)
			if e != nil || r.Revision != 2 {
				t.Error(r, e)
			}
		}()
	}
	wg.Wait()
	c, _ := s.Snapshot(u, id)
	if c.Revision != 2 {
		t.Fatal(c.Revision)
	}
	up := operation("entity.upsert", "/runtime/resources", map[string]any{"current": 2, "max": 3})
	up.EntityID = "resource/a~b"
	_, e := s.Submit(u, id, "web", batch(2, up))
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Submit(u, id, "web", batch(3, operation("inc", "/runtime/resources/resource~1a~0b/current", -1)))
	if e != nil {
		t.Fatal(e)
	}
}

func TestIncDoesNotHideEarlierSet(t *testing.T) {
	d, _ := Decode([]byte(fixture))
	incoming := []protocol.Operation{operation("inc", "/runtime/hp", -1)}
	past := []protocol.Operation{operation("set", "/runtime/hp", 30), operation("inc", "/runtime/hp", -2)}
	if len(Conflicts(d, incoming, past)) != 1 {
		t.Fatal("set/inc history incorrectly commuted")
	}
	if len(Conflicts(d, incoming, past[1:])) != 0 {
		t.Fatal("inc/inc did not commute")
	}
}

func TestRevisionBoundsAndSchemaRollback(t *testing.T) {
	s, _, u, id := setup(t)
	delta, e := s.Delta(u, id, 1)
	if e != nil || len(delta.Operations) != 0 {
		t.Fatal(delta, e)
	}
	_, e = s.Delta(u, id, 0)
	code(t, e, "revision_conflict")
	_, e = s.Submit(u, id, "web", batch(2, operation("inc", "/runtime/hp", 1)))
	code(t, e, "revision_conflict")
	up := operation("entity.upsert", "/runtime/resources", map[string]any{"current": 1, "max": 1})
	up.EntityID = "pool"
	_, e = s.Submit(u, id, "web", batch(1, up, operation("inc", "/runtime/resources/pool/current", -2)))
	code(t, e, "validation_error")
	snapshot, _ := s.Snapshot(u, id)
	if snapshot.Revision != 1 {
		t.Fatal("invalid resource partially committed")
	}
}
