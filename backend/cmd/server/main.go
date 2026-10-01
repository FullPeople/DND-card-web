package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	httpapi "dnd-card/backend/internal/api/http"
	"dnd-card/backend/internal/api/websocket"
	"dnd-card/backend/internal/auth"
	"dnd-card/backend/internal/character"
	"dnd-card/backend/internal/config"
	"dnd-card/backend/internal/storage/sqlite"
)

func main() {
	if e := run(); e != nil {
		slog.Error("server stopped", "error", e)
		os.Exit(1)
	}
}
func run() error {
	create := flag.String("create-user", "", "provision a user and print credentials, then exit")
	flag.Parse()
	cfg, e := config.Load()
	if e != nil {
		return e
	}
	var level slog.Level
	if e = level.UnmarshalText([]byte(cfg.LogLevel)); e != nil {
		return e
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: level})))
	store, e := sqlite.Open(cfg.DBPath)
	if e != nil {
		return e
	}
	defer store.Close()
	tokens := auth.Tokens{Store: store}
	if *create != "" {
		id, token, err := tokens.Provision(*create)
		if err != nil {
			return err
		}
		return json.NewEncoder(os.Stdout).Encode(map[string]any{"user": id, "token": token})
	}
	count, e := store.UserCount()
	if e != nil {
		return e
	}
	if count == 0 {
		id, token, err := tokens.Provision("local-owner")
		if err != nil {
			return err
		}
		path := filepath.Join(filepath.Dir(cfg.DBPath), "bootstrap-credentials.json")
		b, _ := json.MarshalIndent(map[string]any{"user": id, "token": token}, "", "  ")
		if err = os.WriteFile(path, b, 0600); err != nil {
			return fmt.Errorf("write bootstrap credentials: %w", err)
		}
		slog.Info("bootstrap credentials created", "path", path, "userId", id.ID)
	}
	v, e := character.NewValidator(cfg.Snapshot)
	if e != nil {
		return e
	}
	service := character.New(store, v)
	service.Retention = cfg.Retention
	service.ReceiptAge = cfg.ReceiptAge
	service.ReceiptRetention = cfg.ReceiptRetention
	service.ReceiptCleanupBatch = cfg.ReceiptCleanupBatch
	service.MaxOperations = cfg.Operations
	service.MaxPayload = cfg.Payload
	service.Rate = cfg.CharacterRate
	hub := websocket.New(service, cfg)
	defer hub.Close()
	api := &httpapi.Server{Service: service, Auth: tokens, Hub: hub, Config: cfg}
	server := &http.Server{Addr: cfg.Addr, Handler: api.Router(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() {
		slog.Info("server startup", "listen", cfg.Addr, "database", cfg.DBPath)
		done <- server.ListenAndServe()
	}()
	select {
	case e = <-done:
		if e == http.ErrServerClosed {
			return nil
		}
		return e
	case <-ctx.Done():
		hub.Close()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
}
