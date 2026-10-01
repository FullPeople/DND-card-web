package character

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"dnd-card/backend/internal/protocol"
	"dnd-card/backend/internal/storage"
	"github.com/google/uuid"
)

type Service struct {
	Repo                storage.Repository
	Validator           *Validator
	Retention           int64
	ReceiptAge          time.Duration
	ReceiptRetention    int64
	ReceiptCleanupBatch int
	MaxOperations       int
	MaxPayload          int
	Rate                int
	sequence            sequencing
	rateMu              sync.Mutex
	rates               map[string]rate
	Publish             func(protocol.Result)
	PermissionChanged   func(characterID, userID, role string)
	PermissionRevoked   func(characterID, userID string)
}
type rate struct {
	at time.Time
	n  int
}

func New(repo storage.Repository, v *Validator) *Service {
	return &Service{Repo: repo, Validator: v, Retention: 1000, ReceiptAge: 90 * 24 * time.Hour, ReceiptRetention: 10000, ReceiptCleanupBatch: 100, MaxOperations: 128, MaxPayload: 4 << 20, Rate: 30, rates: map[string]rate{}}
}
func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }
func access(tx storage.Tx, id, user string, write, owner bool) (storage.Character, error) {
	c, e := tx.Character(id)
	if errors.Is(e, storage.ErrNotFound) {
		return c, protocol.Fail("not_found", 404, "character not found")
	}
	if e != nil {
		return c, e
	}
	role, e := tx.Role(id, user)
	if errors.Is(e, storage.ErrNotFound) {
		return c, protocol.Fail("forbidden", 403, "no character permission")
	}
	if e != nil {
		return c, e
	}
	if owner && role != "owner" || write && role == "viewer" {
		return c, protocol.Fail("forbidden", 403, "insufficient character permission")
	}
	return c, nil
}
func (s *Service) Create(user string, raw json.RawMessage) (protocol.Snapshot, error) {
	d, e := s.Validator.Migrate(raw)
	if e != nil {
		return protocol.Snapshot{}, e
	}
	stamp := now()
	d["revision"] = float64(1)
	d["updatedAt"] = stamp
	c := storage.Character{ID: uuid.NewString(), OwnerID: user, System: "dnd5e", SchemaVersion: 1, Revision: 1, DocumentJSON: string(DocumentBytes(d)), CreatedAt: stamp, UpdatedAt: stamp}
	e = s.Repo.Write(func(tx storage.Tx) error {
		if err := tx.Create(c); err != nil {
			return err
		}
		return tx.SetPermission(storage.Permission{CharacterID: c.ID, UserID: user, Role: "owner"})
	})
	return c.Snapshot(), e
}
func (s *Service) Snapshot(user, id string) (out protocol.Snapshot, e error) {
	e = s.Repo.Read(func(tx storage.Tx) error {
		c, err := access(tx, id, user, false, false)
		if err == nil {
			out = c.Snapshot()
		}
		return err
	})
	return
}
func (s *Service) List(user string, limit, offset int) (out []protocol.Snapshot, e error) {
	out = []protocol.Snapshot{}
	e = s.Repo.Read(func(tx storage.Tx) error {
		rows, err := tx.List(user, limit, offset)
		for _, c := range rows {
			snap := c.Snapshot()
			snap.Document = nil
			out = append(out, snap)
		}
		return err
	})
	return
}
func history(tx storage.Tx, c storage.Character, after int64) ([]storage.Operation, error) {
	if after < 1 || after > c.Revision {
		return nil, &protocol.Error{Code: "revision_conflict", Status: 409, Message: "revision outside server range", CurrentRevision: c.Revision, BaseRevision: after}
	}
	rows, e := tx.Operations(c.ID, after)
	if errors.Is(e, storage.ErrHistoryTooLarge) {
		return nil, &protocol.Error{Code: "resync_required", Status: 409, Message: "delta exceeds replay budget; load snapshot", CurrentRevision: c.Revision, BaseRevision: after}
	}
	if e != nil {
		return nil, e
	}
	if int64(len(rows)) != c.Revision-after {
		return nil, &protocol.Error{Code: "resync_required", Status: 409, Message: "operation history is no longer contiguous", CurrentRevision: c.Revision, BaseRevision: after}
	}
	for i, r := range rows {
		if r.Revision != after+int64(i)+1 {
			return nil, protocol.Fail("resync_required", 409, "operation history gap")
		}
	}
	return rows, nil
}
func (s *Service) Delta(user, id string, after int64) (out protocol.Delta, e error) {
	out = protocol.Delta{CharacterID: id, Operations: []protocol.Result{}}
	e = s.Repo.Read(func(tx storage.Tx) error {
		c, err := access(tx, id, user, false, false)
		if err != nil {
			return err
		}
		out.CurrentRevision = c.Revision
		rows, err := history(tx, c, after)
		if err != nil {
			return err
		}
		for _, row := range rows {
			var r protocol.Result
			if err = json.Unmarshal([]byte(row.ResultJSON), &r); err != nil {
				return err
			}
			out.Operations = append(out.Operations, r)
		}
		return nil
	})
	return
}

// Synchronize holds the same sequencing gate as commit+publish, closing subscribe/replay races.
func (s *Service) Synchronize(user, id string, after int64, ready func(protocol.Delta) error) error {
	unlock := s.sequence.lock(id)
	defer unlock()
	delta, e := s.Delta(user, id, after)
	if e != nil {
		return e
	}
	return ready(delta)
}
func (s *Service) Submit(user, id, origin string, b protocol.Batch) (result protocol.Result, e error) {
	if _, e = uuid.Parse(b.OperationID); e != nil {
		return result, protocol.Fail("validation_error", 422, "operationId must be UUID")
	}
	if _, e = uuid.Parse(b.ClientID); e != nil {
		return result, protocol.Fail("validation_error", 422, "clientId must be UUID")
	}
	if e = ValidateBatch(b, s.MaxOperations); e != nil {
		return
	}
	if e = s.Validator.Paths(b.Operations); e != nil {
		return
	}
	raw, _ := json.Marshal(b)
	if len(raw) > s.MaxPayload {
		return result, protocol.Fail("payload_too_large", 413, "operation batch exceeds configured byte limit")
	}
	fingerprint := fmt.Sprintf("%x", sha256.Sum256(append([]byte(origin+"\n"), raw...)))
	unlock := s.sequence.lock(id)
	defer unlock()
	duplicate := false
	e = s.Repo.Write(func(tx storage.Tx) error {
		c, err := access(tx, id, user, true, false)
		if err != nil {
			return err
		}
		r, err := tx.Receipt(b.OperationID)
		if err == nil {
			if r.CharacterID != id || r.ActorUserID != user || r.RequestHash != fingerprint {
				return protocol.Fail("duplicate_operation", 409, "operationId was used for a different request")
			}
			duplicate = true
			return json.Unmarshal([]byte(r.ResultJSON), &result)
		}
		if !errors.Is(err, storage.ErrNotFound) {
			return err
		}
		if !s.allow(id) {
			return protocol.Fail("rate_limited", 429, "character operation rate exceeded")
		}
		rows, err := history(tx, c, b.BaseRevision)
		if err != nil {
			return err
		}
		d, err := Decode([]byte(c.DocumentJSON))
		if err != nil {
			return err
		}
		past := []protocol.Operation{}
		for _, row := range rows {
			var ops []protocol.Operation
			if err = json.Unmarshal([]byte(row.OperationsJSON), &ops); err != nil {
				return err
			}
			past = append(past, ops...)
		}
		if conflicts := Conflicts(d, b.Operations, past); len(conflicts) > 0 {
			return &protocol.Error{Code: "revision_conflict", Status: 409, Message: "overlapping concurrent operations", CurrentRevision: c.Revision, BaseRevision: b.BaseRevision, Conflicts: conflicts}
		}
		next, paths, err := Apply(d, b.Operations)
		if err != nil {
			return err
		}
		if c.Revision >= 9007199254740991 {
			return protocol.Fail("revision_conflict", 409, "revision exhausted")
		}
		old := c.Revision
		c.Revision++
		c.UpdatedAt = now()
		next["revision"] = float64(c.Revision)
		next["updatedAt"] = c.UpdatedAt
		if err = s.Validator.Validate(next); err != nil {
			return err
		}
		c.DocumentJSON = string(DocumentBytes(next))
		if err = tx.Save(c, old); err != nil {
			return err
		}
		result = protocol.Result{CharacterID: id, Revision: c.Revision, BaseRevision: b.BaseRevision, OperationID: b.OperationID, ClientID: b.ClientID, Origin: origin, Operations: b.Operations, TouchedPaths: paths, UpdatedAt: c.UpdatedAt, Rebased: b.BaseRevision != old}
		resultJSON, _ := json.Marshal(result)
		opsJSON, _ := json.Marshal(b.Operations)
		pathsJSON, _ := json.Marshal(paths)
		if err = tx.Append(storage.Operation{OperationID: b.OperationID, CharacterID: id, Revision: c.Revision, BaseRevision: b.BaseRevision, ClientID: b.ClientID, ActorUserID: user, Origin: origin, OperationsJSON: string(opsJSON), TouchedPathsJSON: string(pathsJSON), ResultJSON: string(resultJSON), CreatedAt: c.UpdatedAt}, storage.Receipt{OperationID: b.OperationID, CharacterID: id, ActorUserID: user, RequestHash: fingerprint, ResultJSON: string(resultJSON), CreatedAt: c.UpdatedAt}); err != nil {
			return err
		}
		if err = tx.Prune(id, c.Revision-s.Retention); err != nil {
			return err
		}
		// Never expire receipts still within either the time or revision window.
		// Keeping at least 10x the log window makes original expired retries
		// require resync rather than reapplying a previously committed operation.
		if s.ReceiptAge <= 0 || s.ReceiptCleanupBatch <= 0 {
			return nil
		}
		keep := max(s.ReceiptRetention, 10*s.Retention)
		return tx.PruneReceipts(id, time.Now().Add(-s.ReceiptAge).UTC().Format(time.RFC3339Nano), c.Revision-keep, s.ReceiptCleanupBatch)
	})
	if e == nil {
		if !duplicate && s.Publish != nil {
			s.Publish(result)
		}
		slog.Info("character operation", "characterId", id, "operationId", b.OperationID, "revision", result.Revision, "duplicate", duplicate)
	} else {
		var api *protocol.Error
		if errors.As(e, &api) {
			slog.Info("operation rejected", "code", api.Code, "characterId", id, "operationId", b.OperationID)
		} else {
			slog.Error("database error", "characterId", id, "operationId", b.OperationID)
		}
	}
	return
}
func (s *Service) Permissions(user, id string) (out []storage.Permission, e error) {
	e = s.Repo.Read(func(tx storage.Tx) error {
		_, err := access(tx, id, user, false, true)
		if err != nil {
			return err
		}
		out, err = tx.Permissions(id)
		return err
	})
	return
}
func (s *Service) Permission(user, id, target, role string) error {
	if role != "" && role != "viewer" && role != "editor" {
		return protocol.Fail("validation_error", 422, "role must be viewer or editor")
	}
	unlock := s.sequence.lock(id)
	defer unlock()
	e := s.Repo.Write(func(tx storage.Tx) error {
		c, err := access(tx, id, user, false, true)
		if err != nil {
			return err
		}
		if target == c.OwnerID {
			return protocol.Fail("forbidden", 403, "owner permission cannot be changed")
		}
		exists, err := tx.UserExists(target)
		if err != nil {
			return err
		}
		if !exists {
			return protocol.Fail("not_found", 404, "user not found; provision user first")
		}
		if role == "" {
			return tx.Revoke(id, target)
		}
		return tx.SetPermission(storage.Permission{CharacterID: id, UserID: target, Role: role})
	})
	if e == nil {
		if role == "" {
			if s.PermissionRevoked != nil {
				s.PermissionRevoked(id, target)
			}
		} else if s.PermissionChanged != nil {
			s.PermissionChanged(id, target, role)
		}
	}
	return e
}

// allow protects only the rate table, never database work or Hub callbacks.
func (s *Service) allow(id string) bool {
	s.rateMu.Lock()
	defer s.rateMu.Unlock()
	at := time.Now()
	lim := s.rates[id]
	if at.Sub(lim.at) >= time.Second {
		lim = rate{at: at}
	}
	if lim.n >= s.Rate {
		return false
	}
	lim.n++
	s.rates[id] = lim
	if len(s.rates) > 10000 {
		for k, v := range s.rates {
			if at.Sub(v.at) > time.Minute {
				delete(s.rates, k)
			}
		}
	}
	return true
}
