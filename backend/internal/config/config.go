package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Addr, DBPath, Origin, LogLevel                                                                             string
	Retention                                                                                                  int64
	ReceiptAge                                                                                                 time.Duration
	ReceiptRetention                                                                                           int64
	ReceiptCleanupBatch                                                                                        int
	Payload, Snapshot, Operations, WSMessage, Subscriptions, Queue, Connections, ConnectionRate, CharacterRate int
	SecureCookie                                                                                               bool
}

func Default() Config {
	return Config{Addr: "127.0.0.1:8080", DBPath: "data/dnd.db", Origin: "http://localhost:5173", LogLevel: "info", Retention: 1000, ReceiptAge: 90 * 24 * time.Hour, ReceiptRetention: 10000, ReceiptCleanupBatch: 100, Payload: 4 << 20, Snapshot: 4 << 20, Operations: 128, WSMessage: 8192, Subscriptions: 16, Queue: 64, Connections: 1200, ConnectionRate: 20, CharacterRate: 30}
}
func Load() (Config, error) {
	c := Default()
	for key, p := range map[string]*string{"DND_LISTEN": &c.Addr, "DND_DATABASE": &c.DBPath, "DND_CORS_ORIGIN": &c.Origin, "DND_LOG_LEVEL": &c.LogLevel} {
		if v, ok := os.LookupEnv(key); ok {
			*p = v
		}
	}
	for key, p := range map[string]*int{"DND_PAYLOAD_BYTES": &c.Payload, "DND_SNAPSHOT_BYTES": &c.Snapshot, "DND_MAX_OPERATIONS": &c.Operations, "DND_WS_MESSAGE_BYTES": &c.WSMessage, "DND_WS_SUBSCRIPTIONS": &c.Subscriptions, "DND_WS_QUEUE": &c.Queue, "DND_WS_CONNECTIONS": &c.Connections, "DND_WS_RATE": &c.ConnectionRate, "DND_CHARACTER_RATE": &c.CharacterRate} {
		if v, ok := os.LookupEnv(key); ok {
			n, e := strconv.Atoi(v)
			if e != nil || n < 1 {
				return c, fmt.Errorf("invalid %s", key)
			}
			*p = n
		}
	}
	if v, ok := os.LookupEnv("DND_RETENTION"); ok {
		n, e := strconv.ParseInt(v, 10, 64)
		if e != nil || n < 1 || n > 10000 {
			return c, fmt.Errorf("DND_RETENTION must be 1..10000")
		}
		c.Retention = n
	}
	if v, ok := os.LookupEnv("DND_SECURE_COOKIE"); ok {
		b, e := strconv.ParseBool(v)
		if e != nil {
			return c, e
		}
		c.SecureCookie = b
	}
	if v, ok := os.LookupEnv("DND_RECEIPT_RETENTION"); ok {
		n, e := strconv.ParseInt(v, 10, 64)
		if e != nil || n < 1 || n > 1000000 {
			return c, fmt.Errorf("DND_RECEIPT_RETENTION must be 1..1000000")
		}
		c.ReceiptRetention = n
	}
	if v, ok := os.LookupEnv("DND_RECEIPT_DAYS"); ok {
		n, e := strconv.ParseInt(v, 10, 64)
		if e != nil || n < 1 || n > 3650 {
			return c, fmt.Errorf("DND_RECEIPT_DAYS must be 1..3650")
		}
		c.ReceiptAge = time.Duration(n) * 24 * time.Hour
	}
	if v, ok := os.LookupEnv("DND_RECEIPT_CLEANUP_BATCH"); ok {
		n, e := strconv.Atoi(v)
		if e != nil || n < 1 || n > 1000 {
			return c, fmt.Errorf("DND_RECEIPT_CLEANUP_BATCH must be 1..1000")
		}
		c.ReceiptCleanupBatch = n
	}
	c.ReceiptRetention = max(c.ReceiptRetention, 10*c.Retention)
	if c.Operations > 128 || c.Payload > 20<<20 || c.Snapshot > 20<<20 || c.Origin == "*" {
		return c, fmt.Errorf("limits exceed protocol bounds or wildcard credential origin")
	}
	return c, nil
}
