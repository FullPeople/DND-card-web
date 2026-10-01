package sqlite

import (
	"crypto/sha256"
	"fmt"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"dnd-card/backend/internal/storage"
	"dnd-card/backend/migrations"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(path string) (*storage.Store, error) {
	abs, e := filepath.Abs(path)
	if e != nil {
		return nil, e
	}
	if e = os.MkdirAll(filepath.Dir(abs), 0700); e != nil {
		return nil, e
	}
	db, e := gorm.Open(sqlite.Open(fileDSN(abs)), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent), SkipDefaultTransaction: true})
	if e != nil {
		return nil, e
	}
	s := &storage.Store{DB: db}
	pool, e := db.DB()
	if e != nil {
		return nil, e
	}
	pool.SetMaxOpenConns(1)
	pool.SetMaxIdleConns(1)
	for _, check := range []struct{ key, want string }{{"journal_mode", "wal"}, {"foreign_keys", "1"}, {"busy_timeout", "5000"}, {"synchronous", "1"}} {
		var got string
		if e = db.Raw("PRAGMA " + check.key).Scan(&got).Error; e != nil || strings.ToLower(got) != check.want {
			s.Close()
			return nil, fmt.Errorf("pragma %s: got %s: %v", check.key, got, e)
		}
	}
	if e = migrate(db); e != nil {
		s.Close()
		return nil, e
	}
	return s, nil
}

// The pinned driver strips the query from ordinary filenames at the first '?'.
// Prefer native absolute paths (including Windows drive/UNC paths); only Unix
// filenames containing '?' need an escaped SQLite URI to avoid truncation.
func fileDSN(abs string) string {
	filename := abs
	if strings.ContainsRune(abs, '?') {
		filename = (&url.URL{Scheme: "file", Path: abs}).String()
	}
	query := url.Values{"_pragma": {"journal_mode(WAL)", "foreign_keys(1)", "busy_timeout(5000)", "synchronous(NORMAL)"}}
	return filename + "?" + query.Encode()
}

func migrate(db *gorm.DB) error {
	return migrateFS(db, migrations.Files)
}

func migrateFS(db *gorm.DB, scripts fs.FS) error {
	if e := db.Exec("CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)").Error; e != nil {
		return e
	}
	files, e := fs.ReadDir(scripts, ".")
	if e != nil {
		return e
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Name() < files[j].Name() })
	for _, f := range files {
		if !strings.HasSuffix(f.Name(), ".sql") {
			continue
		}
		b, e := fs.ReadFile(scripts, f.Name())
		if e != nil {
			return e
		}
		hash := fmt.Sprintf("%x", sha256.Sum256(b))
		var old []struct{ Checksum string }
		if e = db.Raw("SELECT checksum FROM schema_migrations WHERE version = ?", f.Name()).Scan(&old).Error; e != nil {
			return e
		}
		if len(old) > 0 {
			if old[0].Checksum != hash {
				return fmt.Errorf("migration checksum changed: %s", f.Name())
			}
			continue
		}
		e = db.Transaction(func(tx *gorm.DB) error {
			// go-sqlite executes all statements using SQLite's prepare/tail
			// parser, including trigger bodies and quoted semicolons.
			if err := tx.Exec(string(b)).Error; err != nil {
				return err
			}
			return tx.Exec("INSERT INTO schema_migrations VALUES(?,?,?)", f.Name(), hash, time.Now().UTC().Format(time.RFC3339Nano)).Error
		})
		if e != nil {
			return e
		}
		slog.Info("database migration", "version", f.Name())
	}
	return nil
}
