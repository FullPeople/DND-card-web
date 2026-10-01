package storage

import (
	"dnd-card/backend/internal/protocol"
	"errors"
	"gorm.io/gorm"
)

var ErrNotFound = gorm.ErrRecordNotFound
var ErrHistoryTooLarge = errors.New("history exceeds 16 MiB replay budget")

type User struct {
	ID        string `gorm:"primaryKey"`
	Name      string
	TokenHash string
	CreatedAt string
}
type Character struct {
	ID            string `gorm:"primaryKey"`
	OwnerID       string
	System        string
	SchemaVersion int
	Revision      int64
	DocumentJSON  string `gorm:"column:document_json"`
	CreatedAt     string
	UpdatedAt     string
}

func (c Character) Snapshot() protocol.Snapshot {
	return protocol.Snapshot{ID: c.ID, OwnerID: c.OwnerID, System: c.System, SchemaVersion: c.SchemaVersion, Revision: c.Revision, Document: []byte(c.DocumentJSON), CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt}
}

type Permission struct {
	CharacterID string
	UserID      string
	Role        string
}

func (Permission) TableName() string { return "character_permissions" }

type Operation struct {
	OperationID      string
	CharacterID      string
	Revision         int64
	BaseRevision     int64
	ClientID         string
	ActorUserID      string
	Origin           string
	OperationsJSON   string `gorm:"column:operations_json"`
	TouchedPathsJSON string `gorm:"column:touched_paths_json"`
	ResultJSON       string `gorm:"column:result_json"`
	CreatedAt        string
}

func (Operation) TableName() string { return "character_operations" }

type Receipt struct {
	OperationID string
	CharacterID string
	ActorUserID string
	RequestHash string
	ResultJSON  string `gorm:"column:result_json"`
	CreatedAt   string
}

func (Receipt) TableName() string { return "operation_receipts" }

// Repository is the service boundary. PostgreSQL supplies the same transaction semantics.
type Repository interface {
	Read(func(Tx) error) error
	Write(func(Tx) error) error
}
type Tx interface {
	UserExists(string) (bool, error)
	Character(string) (Character, error)
	Create(Character) error
	Save(Character, int64) error
	Role(string, string) (string, error)
	Permissions(string) ([]Permission, error)
	SetPermission(Permission) error
	Revoke(string, string) error
	List(string, int, int) ([]Character, error)
	Operations(string, int64) ([]Operation, error)
	Receipt(string) (Receipt, error)
	Append(Operation, Receipt) error
	Prune(string, int64) error
	PruneReceipts(string, string, int64, int) error
}
type Store struct{ DB *gorm.DB }
type transaction struct{ db *gorm.DB }

func (t transaction) UserExists(id string) (bool, error) {
	var n int64
	e := t.db.Model(&User{}).Where("id = ?", id).Count(&n).Error
	return n > 0, e
}

func (s *Store) Read(fn func(Tx) error) error {
	return s.DB.Transaction(func(db *gorm.DB) error { return fn(transaction{db}) })
}
func (s *Store) Write(fn func(Tx) error) error {
	return s.DB.Transaction(func(db *gorm.DB) error { return fn(transaction{db}) })
}
func (t transaction) Character(id string) (c Character, e error) {
	e = t.db.First(&c, "id = ?", id).Error
	return
}
func (t transaction) Create(c Character) error { return t.db.Create(&c).Error }
func (t transaction) Save(c Character, old int64) error {
	r := t.db.Model(&Character{}).Where("id = ? AND revision = ?", c.ID, old).Updates(map[string]any{"revision": c.Revision, "document_json": c.DocumentJSON, "updated_at": c.UpdatedAt})
	if r.Error != nil {
		return r.Error
	}
	if r.RowsAffected != 1 {
		return errors.New("revision compare-and-swap failed")
	}
	return nil
}
func (t transaction) Role(character, user string) (string, error) {
	var p Permission
	e := t.db.Where("character_id = ? AND user_id = ?", character, user).First(&p).Error
	return p.Role, e
}
func (t transaction) Permissions(id string) (p []Permission, e error) {
	e = t.db.Where("character_id = ?", id).Order("user_id").Find(&p).Error
	return
}
func (t transaction) SetPermission(p Permission) error {
	return t.db.Exec("INSERT INTO character_permissions(character_id,user_id,role) VALUES(?,?,?) ON CONFLICT(character_id,user_id) DO UPDATE SET role=excluded.role", p.CharacterID, p.UserID, p.Role).Error
}
func (t transaction) Revoke(id, user string) error {
	return t.db.Where("character_id = ? AND user_id = ?", id, user).Delete(&Permission{}).Error
}
func (t transaction) List(user string, limit, offset int) (c []Character, e error) {
	e = t.db.Select("characters.id, characters.owner_id, characters.system, characters.schema_version, characters.revision, characters.created_at, characters.updated_at").Joins("JOIN character_permissions p ON p.character_id = characters.id").Where("p.user_id = ?", user).Order("characters.created_at, characters.id").Limit(limit).Offset(offset).Find(&c).Error
	return
}
func (t transaction) Operations(id string, after int64) (o []Operation, e error) {
	var size int64
	e = t.db.Model(&Operation{}).Select("COALESCE(SUM(LENGTH(result_json) + LENGTH(operations_json)), 0)").Where("character_id = ? AND revision > ?", id, after).Scan(&size).Error
	if e != nil {
		return nil, e
	}
	if size > 16<<20 {
		return nil, ErrHistoryTooLarge
	}
	e = t.db.Where("character_id = ? AND revision > ?", id, after).Order("revision").Find(&o).Error
	return
}
func (t transaction) Receipt(id string) (r Receipt, e error) {
	e = t.db.Where("operation_id = ?", id).First(&r).Error
	return
}
func (t transaction) Append(o Operation, r Receipt) error {
	if e := t.db.Create(&o).Error; e != nil {
		return e
	}
	return t.db.Create(&r).Error
}
func (t transaction) Prune(id string, through int64) error {
	return t.db.Where("character_id = ? AND revision <= ?", id, through).Delete(&Operation{}).Error
}
func (t transaction) PruneReceipts(id, before string, through int64, limit int) error {
	if through < 1 || limit <= 0 {
		return nil
	}
	return t.db.Exec(`DELETE FROM operation_receipts WHERE operation_id IN (
		SELECT r.operation_id FROM operation_receipts r
		WHERE r.character_id = ? AND julianday(r.created_at) < julianday(?)
		AND json_extract(r.result_json, '$.revision') <= ?
		AND NOT EXISTS (SELECT 1 FROM character_operations o WHERE o.operation_id = r.operation_id)
		ORDER BY julianday(r.created_at), r.operation_id LIMIT ?
	)`, id, before, through, limit).Error
}
func (s *Store) UserByHash(hash string) (u User, e error) {
	e = s.DB.First(&u, "token_hash = ?", hash).Error
	return
}
func (s *Store) CreateUser(u User) error { return s.DB.Create(&u).Error }
func (s *Store) UserCount() (int64, error) {
	var n int64
	e := s.DB.Model(&User{}).Count(&n).Error
	return n, e
}
func (s *Store) Close() error {
	db, e := s.DB.DB()
	if e != nil {
		return e
	}
	return db.Close()
}
