package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"dnd-card/backend/internal/storage"
	"github.com/google/uuid"
)

type Identity struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type Authenticator interface {
	Authenticate(*http.Request) (Identity, bool)
}
type Tokens struct{ Store *storage.Store }

func Hash(token string) string { h := sha256.Sum256([]byte(token)); return hex.EncodeToString(h[:]) }
func (t Tokens) Authenticate(r *http.Request) (Identity, bool) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if token == r.Header.Get("Authorization") {
		token = ""
	}
	if token == "" {
		if c, e := r.Cookie("dnd_session"); e == nil {
			token = c.Value
		}
	}
	if len(token) != 64 {
		return Identity{}, false
	}
	u, e := t.Store.UserByHash(Hash(token))
	return Identity{u.ID, u.Name}, e == nil
}
func (t Tokens) Provision(name string) (Identity, string, error) {
	var b [32]byte
	if _, e := rand.Read(b[:]); e != nil {
		return Identity{}, "", e
	}
	token := hex.EncodeToString(b[:])
	u := storage.User{ID: uuid.NewString(), Name: name, TokenHash: Hash(token), CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	e := t.Store.CreateUser(u)
	return Identity{u.ID, u.Name}, token, e
}
