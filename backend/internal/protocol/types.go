package protocol

import "encoding/json"

type Operation struct {
	Op       string          `json:"op"`
	Path     string          `json:"path"`
	Value    json.RawMessage `json:"value,omitempty"`
	EntityID string          `json:"entityId,omitempty"`
	BeforeID *string         `json:"beforeId,omitempty"`
}
type Batch struct {
	OperationID  string      `json:"operationId"`
	ClientID     string      `json:"clientId"`
	BaseRevision int64       `json:"baseRevision"`
	Operations   []Operation `json:"operations"`
}
type Result struct {
	CharacterID  string      `json:"characterId"`
	Revision     int64       `json:"revision"`
	BaseRevision int64       `json:"baseRevision"`
	OperationID  string      `json:"operationId"`
	ClientID     string      `json:"clientId"`
	Origin       string      `json:"origin"`
	Operations   []Operation `json:"operations"`
	TouchedPaths []string    `json:"touchedPaths"`
	UpdatedAt    string      `json:"updatedAt"`
	Rebased      bool        `json:"rebased"`
}
type Snapshot struct {
	ID            string          `json:"id"`
	OwnerID       string          `json:"ownerId"`
	System        string          `json:"system"`
	SchemaVersion int             `json:"schemaVersion"`
	Revision      int64           `json:"revision"`
	Document      json.RawMessage `json:"document,omitempty"`
	CreatedAt     string          `json:"createdAt"`
	UpdatedAt     string          `json:"updatedAt"`
}
type Conflict struct {
	Path         string `json:"path"`
	ServerValue  any    `json:"serverValue"`
	ClientValue  any    `json:"clientValue"`
	ServerExists bool   `json:"serverExists"`
}
type Error struct {
	Code            string     `json:"code"`
	Message         string     `json:"message"`
	CurrentRevision int64      `json:"currentRevision,omitempty"`
	BaseRevision    int64      `json:"baseRevision,omitempty"`
	Conflicts       []Conflict `json:"conflicts,omitempty"`
	Status          int        `json:"-"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }
func Fail(code string, status int, message string) *Error {
	return &Error{Code: code, Status: status, Message: message}
}

type Delta struct {
	CharacterID     string   `json:"characterId"`
	CurrentRevision int64    `json:"currentRevision"`
	Operations      []Result `json:"operations"`
}
