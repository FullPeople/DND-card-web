package sqlite

import (
	"crypto/sha256"
	"fmt"
	"path/filepath"
	"testing"
	"testing/fstest"
)

func TestMigrationScriptTriggerChecksumAndRollback(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "migration.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	const script = `-- semicolons ; in a comment do not split statements
CREATE TABLE script_input(id INTEGER PRIMARY KEY, value TEXT);
CREATE TABLE script_audit(value TEXT);
CREATE TRIGGER script_trigger AFTER INSERT ON script_input BEGIN
  INSERT INTO script_audit VALUES('first;value');
  INSERT INTO script_audit VALUES(NEW.value || ';last');
END;
INSERT INTO script_input VALUES(1, 'quoted'';value');`
	scripts := fstest.MapFS{"900_complex.sql": &fstest.MapFile{Data: []byte(script)}}
	if err = migrateFS(store.DB, scripts); err != nil {
		t.Fatal(err)
	}
	var values []string
	if err = store.DB.Raw("SELECT value FROM script_audit ORDER BY rowid").Scan(&values).Error; err != nil {
		t.Fatal(err)
	}
	if len(values) != 2 || values[0] != "first;value" || values[1] != "quoted';value;last" {
		t.Fatal(values)
	}
	var applied struct{ Checksum, AppliedAt string }
	if err = store.DB.Raw("SELECT checksum, applied_at FROM schema_migrations WHERE version = ?", "900_complex.sql").Scan(&applied).Error; err != nil {
		t.Fatal(err)
	}
	if applied.Checksum != fmt.Sprintf("%x", sha256.Sum256([]byte(script))) || applied.AppliedAt == "" {
		t.Fatal(applied)
	}
	if err = migrateFS(store.DB, scripts); err != nil {
		t.Fatal("migration not idempotent", err)
	}
	scripts["900_complex.sql"].Data = []byte(script + "\n-- changed")
	if err = migrateFS(store.DB, scripts); err == nil {
		t.Fatal("checksum mismatch accepted")
	}
	bad := fstest.MapFS{"901_failure.sql": &fstest.MapFile{Data: []byte(`CREATE TABLE rollback_input(value TEXT);
CREATE TRIGGER rollback_trigger AFTER INSERT ON rollback_input BEGIN
 INSERT INTO script_audit VALUES('must;rollback');
END;
INSERT INTO rollback_input VALUES('semicolon;value');
INSERT INTO missing_table VALUES(1);`)}}
	if err = migrateFS(store.DB, bad); err == nil {
		t.Fatal("broken script accepted")
	}
	var count int64
	for _, query := range []string{
		"SELECT count(*) FROM sqlite_master WHERE name IN ('rollback_input','rollback_trigger')",
		"SELECT count(*) FROM schema_migrations WHERE version='901_failure.sql'",
		"SELECT count(*) FROM script_audit WHERE value='must;rollback'",
	} {
		if err = store.DB.Raw(query).Scan(&count).Error; err != nil || count != 0 {
			t.Fatal("migration did not rollback", query, count, err)
		}
	}
	if err = store.DB.Exec("INSERT INTO script_input VALUES(2, 'still;works')").Error; err != nil {
		t.Fatal(err)
	}
	if err = store.DB.Raw("SELECT count(*) FROM script_audit").Scan(&count).Error; err != nil || count != 4 {
		t.Fatal(count, err)
	}
}
