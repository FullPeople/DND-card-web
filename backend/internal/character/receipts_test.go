package character

import (
	"testing"
	"time"

	"dnd-card/backend/internal/protocol"
	"dnd-card/backend/internal/storage"
	"dnd-card/backend/internal/storage/sqlite"
)

func TestReceiptCleanupPreservesRetryWindowAndRejectsExpiredReplay(t *testing.T) {
	s, store, u, id := setup(t)
	s.Retention = 1
	s.ReceiptRetention = 1 // effective minimum is 10x log retention
	s.ReceiptAge = 90 * 24 * time.Hour
	s.ReceiptCleanupBatch = 1
	expired := batch(1, operation("inc", "/runtime/hp", 1))
	protected := batch(2, operation("inc", "/runtime/hp", 1))
	secondExpired := batch(3, operation("inc", "/runtime/hp", 1))
	for _, request := range []protocol.Batch{expired, protected, secondExpired} {
		if _, e := s.Submit(u, id, "web", request); e != nil {
			t.Fatal(e)
		}
	}
	old := time.Now().Add(-100 * 24 * time.Hour).UTC().Format(time.RFC3339Nano)
	if e := store.DB.Model(&storage.Receipt{}).Where("operation_id IN ?", []string{expired.OperationID, secondExpired.OperationID}).Update("created_at", old).Error; e != nil {
		t.Fatal(e)
	}
	// Both old receipts remain despite log pruning, until the larger revision window ends.
	if r, e := s.Submit(u, id, "web", expired); e != nil || r.Revision != 2 {
		t.Fatal(r, e)
	}
	for base := int64(4); base <= 11; base++ {
		if _, e := s.Submit(u, id, "web", batch(base, operation("inc", "/runtime/hp", 1))); e != nil {
			t.Fatal(e)
		}
	}
	var count int64
	if e := store.DB.Model(&storage.Receipt{}).Where("operation_id = ?", expired.OperationID).Count(&count).Error; e != nil || count != 0 {
		t.Fatal("expired receipt not cleaned", count, e)
	}
	if r, e := s.Submit(u, id, "web", protected); e != nil || r.Revision != 3 {
		t.Fatal("receipt within time window lost", r, e)
	}
	_, e := s.Submit(u, id, "web", expired)
	code(t, e, "resync_required")
	// More successful commits clean subsequent expired rows in bounded batches.
	for base := int64(12); base <= 13; base++ {
		if _, e = s.Submit(u, id, "web", batch(base, operation("inc", "/runtime/hp", 1))); e != nil {
			t.Fatal(e)
		}
	}
	_, e = s.Submit(u, id, "web", secondExpired)
	code(t, e, "resync_required")
	snapshot, e := s.Snapshot(u, id)
	if e != nil || snapshot.Revision != 14 {
		t.Fatal("expired retry reapplied", snapshot, e)
	}
	// Reopen after cleanup: surviving receipts still return the original result.
	var dbs []struct{ File string }
	if e = store.DB.Raw("PRAGMA database_list").Scan(&dbs).Error; e != nil {
		t.Fatal(e)
	}
	if e = store.Close(); e != nil {
		t.Fatal(e)
	}
	reopened, e := sqlite.Open(dbs[0].File)
	if e != nil {
		t.Fatal(e)
	}
	defer reopened.Close()
	s.Repo = reopened
	published := 0
	s.Publish = func(_ protocol.Result) { published++ }
	if r, e := s.Submit(u, id, "web", protected); e != nil || r.Revision != 3 || published != 0 {
		t.Fatal(r, e, published)
	}
	_, e = s.Submit(u, id, "web", expired)
	code(t, e, "resync_required")
}

func TestReceiptCleanupBatchBound(t *testing.T) {
	s, store, u, id := setup(t)
	for base := int64(1); base <= 3; base++ {
		if _, e := s.Submit(u, id, "web", batch(base, operation("inc", "/runtime/hp", 1))); e != nil {
			t.Fatal(e)
		}
	}
	old := time.Now().Add(-100 * 24 * time.Hour).UTC().Format(time.RFC3339Nano)
	if e := store.DB.Model(&storage.Receipt{}).Where("character_id = ?", id).Update("created_at", old).Error; e != nil {
		t.Fatal(e)
	}
	if e := store.Write(func(tx storage.Tx) error {
		if e := tx.Prune(id, 4); e != nil {
			return e
		}
		return tx.PruneReceipts(id, now(), 4, 1)
	}); e != nil {
		t.Fatal(e)
	}
	var n int64
	if e := store.DB.Model(&storage.Receipt{}).Where("character_id = ?", id).Count(&n).Error; e != nil || n != 2 {
		t.Fatal("cleanup batch exceeded", n, e)
	}
}

func TestReceiptCleanupProtectsExistingLogAndRollsBack(t *testing.T) {
	s, store, u, id := setup(t)
	b := batch(1, operation("inc", "/runtime/hp", 1))
	if _, e := s.Submit(u, id, "web", b); e != nil {
		t.Fatal(e)
	}
	old := time.Now().Add(-100 * 24 * time.Hour).UTC().Format(time.RFC3339Nano)
	if e := store.DB.Model(&storage.Receipt{}).Where("operation_id = ?", b.OperationID).Update("created_at", old).Error; e != nil {
		t.Fatal(e)
	}
	if e := store.Write(func(tx storage.Tx) error { return tx.PruneReceipts(id, now(), 9999, 100) }); e != nil {
		t.Fatal(e)
	}
	if r, e := s.Submit(u, id, "web", b); e != nil || r.Revision != 2 {
		t.Fatal("log-backed receipt deleted", r, e)
	}
	if e := store.DB.Exec("CREATE TRIGGER reject_receipt_cleanup BEFORE DELETE ON operation_receipts BEGIN SELECT RAISE(ABORT,'cleanup failure'); END").Error; e != nil {
		t.Fatal(e)
	}
	s.Retention = 1
	s.ReceiptRetention = 10
	for base := int64(2); base <= 10; base++ {
		if _, e := s.Submit(u, id, "web", batch(base, operation("inc", "/runtime/hp", 1))); e != nil {
			t.Fatal(e)
		}
	}
	if _, e := s.Submit(u, id, "web", batch(11, operation("inc", "/runtime/hp", 1))); e == nil {
		t.Fatal("expected cleanup failure")
	}
	c, e := s.Snapshot(u, id)
	if e != nil || c.Revision != 11 {
		t.Fatal("cleanup failure partially committed", c, e)
	}
	if r, e := s.Submit(u, id, "web", b); e != nil || r.Revision != 2 {
		t.Fatal("rollback lost receipt", r, e)
	}
}
