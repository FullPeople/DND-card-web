package sqlite

import (
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	driver "github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const pragmaQuery = "?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)"

// Keep the failing URI visible alongside the formats accepted by the pinned
// driver. The legacy case is diagnostic; both supported cases must open disk.
func TestSQLiteDSNDriverFormats(t *testing.T) {
	for _, format := range []string{"legacy-uri", "plain-path", "absolute-uri"} {
		t.Run(format, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "test space # 中文.db")
			u := url.URL{Scheme: "file", Path: filepath.ToSlash(path)}
			dsn := u.String() + pragmaQuery
			if format == "plain-path" {
				dsn = path + pragmaQuery
			} else if format == "absolute-uri" {
				if runtime.GOOS == "windows" {
					u.Path = "/" + u.Path
				}
				dsn = u.String() + pragmaQuery
			}
			t.Logf("%s DSN: %s", runtime.GOOS, dsn)
			db, err := gorm.Open(driver.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			if err != nil {
				if format == "legacy-uri" {
					t.Logf("legacy open error: %v", err)
					return
				}
				t.Fatal(err)
			}
			pool, err := db.DB()
			if err != nil {
				t.Fatal(err)
			}
			defer pool.Close()
			assertDiskPath(t, db, path)
		})
	}
}

func assertDiskPath(t *testing.T, db *gorm.DB, want string) {
	t.Helper()
	var databases []struct{ Name, File string }
	if err := db.Raw("PRAGMA database_list").Scan(&databases).Error; err != nil {
		t.Fatal(err)
	}
	if len(databases) != 1 || databases[0].Name != "main" || databases[0].File == "" || databases[0].File == ":memory:" {
		t.Fatalf("expected one disk database: %+v", databases)
	}
	gotInfo, err := os.Stat(databases[0].File)
	if err != nil {
		t.Fatal(err)
	}
	wantInfo, err := os.Stat(want)
	if err != nil {
		t.Fatal(err)
	}
	if !os.SameFile(gotInfo, wantInfo) {
		t.Fatalf("database_list path %q differs from %q", databases[0].File, want)
	}
	t.Logf("database_list main: %s", databases[0].File)
}

func TestFileDSNPaths(t *testing.T) {
	for _, path := range []string{`C:\data\dnd.db`, `C:\card space\中文 # % &.db`, `/var/data/dnd.db`, `/tmp/card space/中文 # % &.db`, `/tmp/中文 # ? % &.db`} {
		t.Run(path, func(t *testing.T) {
			dsn := fileDSN(path)
			filename, query, found := strings.Cut(dsn, "?")
			if !found {
				t.Fatal("missing pragma parameters", dsn)
			}
			if strings.ContainsRune(path, '?') {
				u, err := url.Parse(dsn)
				if err != nil || u.Scheme != "file" || u.Host != "" || u.Path != path || u.Fragment != "" {
					t.Fatalf("invalid file URI %q: %+v, %v", dsn, u, err)
				}
			} else if filename != path || strings.HasPrefix(filename, "file:") {
				t.Fatal("ordinary absolute path changed", dsn)
			}
			params, err := url.ParseQuery(query)
			if err != nil {
				t.Fatal(err)
			}
			want := []string{"journal_mode(WAL)", "foreign_keys(1)", "busy_timeout(5000)", "synchronous(NORMAL)"}
			if len(params) != 1 || strings.Join(params["_pragma"], ";") != strings.Join(want, ";") {
				t.Fatal("pragma parameters changed", params)
			}
		})
	}
}

func TestOpenDiskPaths(t *testing.T) {
	names := []string{"ascii.db", "space path/test database.db", "中文目录/角色卡.db", "special # % &/文件 # %.db"}
	if runtime.GOOS != "windows" { // '?' is not a legal Windows filename.
		names = append(names, "question ?/角色 # ?.db")
	}
	for _, name := range names {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), filepath.FromSlash(name))
			store, err := Open(path)
			if err != nil {
				t.Fatal(err)
			}
			assertDiskPath(t, store.DB, path)
			if err := store.DB.Exec("CREATE TABLE path_marker(value TEXT); INSERT INTO path_marker VALUES('persisted')").Error; err != nil {
				t.Fatal(err)
			}
			if err := store.Close(); err != nil {
				t.Fatal(err)
			}
			store, err = Open(path)
			if err != nil {
				t.Fatal(err)
			}
			defer store.Close()
			assertDiskPath(t, store.DB, path)
			var value string
			if err := store.DB.Raw("SELECT value FROM path_marker").Scan(&value).Error; err != nil || value != "persisted" {
				t.Fatal("reopen lost disk data", value, err)
			}
		})
	}
}
