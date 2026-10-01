package config

import (
	"testing"
	"time"
)

func TestReceiptConfiguration(t *testing.T) {
	t.Setenv("DND_RETENTION", "2000")
	t.Setenv("DND_RECEIPT_RETENTION", "1000")
	t.Setenv("DND_RECEIPT_DAYS", "30")
	t.Setenv("DND_RECEIPT_CLEANUP_BATCH", "25")
	c, e := Load()
	if e != nil || c.ReceiptRetention != 20000 || c.ReceiptAge != 30*24*time.Hour || c.ReceiptCleanupBatch != 25 {
		t.Fatal(c, e)
	}
	for _, key := range []string{"DND_RECEIPT_RETENTION", "DND_RECEIPT_DAYS", "DND_RECEIPT_CLEANUP_BATCH"} {
		t.Run(key, func(t *testing.T) {
			t.Setenv(key, "0")
			if _, e := Load(); e == nil {
				t.Fatal("invalid cleanup bound accepted")
			}
		})
	}
}
