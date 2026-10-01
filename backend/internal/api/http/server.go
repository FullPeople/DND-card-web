package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"dnd-card/backend/internal/api/websocket"
	"dnd-card/backend/internal/auth"
	"dnd-card/backend/internal/character"
	"dnd-card/backend/internal/config"
	"dnd-card/backend/internal/protocol"
	"github.com/gin-gonic/gin"
)

type Server struct {
	Service *character.Service
	Auth    auth.Authenticator
	Hub     *websocket.Hub
	Config  config.Config
}

func fail(c *gin.Context, e error) {
	var p *protocol.Error
	if !errors.As(e, &p) {
		slog.Error("request failed", "path", c.FullPath())
		p = protocol.Fail("internal_error", 500, "request could not be completed")
	}
	if p.Status == 429 {
		c.Header("Retry-After", "1")
	}
	c.AbortWithStatusJSON(p.Status, p)
}
func (s *Server) decode(c *gin.Context, out any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, int64(s.Config.Payload))
	dec := json.NewDecoder(c.Request.Body)
	dec.DisallowUnknownFields()
	e := dec.Decode(out)
	if e == nil {
		var extra any
		if trailing := dec.Decode(&extra); trailing != io.EOF {
			e = trailing
			if e == nil {
				e = errors.New("trailing JSON")
			}
		}
	}
	if e != nil {
		var size *http.MaxBytesError
		if errors.As(e, &size) {
			fail(c, protocol.Fail("payload_too_large", 413, "request exceeds configured byte limit"))
		} else {
			fail(c, protocol.Fail("validation_error", 422, "invalid JSON request"))
		}
		return false
	}
	return true
}
func user(c *gin.Context) string { return c.MustGet("identity").(auth.Identity).ID }
func (s *Server) Router() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	// Long-lived WebSockets do not occupy HTTP body-processing slots.
	inflight := make(chan struct{}, 16)
	r.Use(func(c *gin.Context) {
		if c.Request.URL.Path == "/api/v1/ws" {
			c.Next()
			return
		}
		select {
		case inflight <- struct{}{}:
			defer func() { <-inflight }()
			c.Next()
		default:
			fail(c, protocol.Fail("rate_limited", 429, "HTTP concurrency limit reached"))
		}
	})
	r.Use(func(c *gin.Context) {
		defer func() {
			if recover() != nil {
				fail(c, protocol.Fail("internal_error", 500, "request failed"))
			}
		}()
		c.Next()
	})
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && origin != s.Config.Origin {
			fail(c, protocol.Fail("forbidden", 403, "origin is not allowed"))
			return
		}
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Header("Cache-Control", "no-store")
		c.Next()
	})
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	a := r.Group("/api/v1")
	a.Use(func(c *gin.Context) {
		id, ok := s.Auth.Authenticate(c.Request)
		if !ok {
			fail(c, protocol.Fail("unauthorized", 401, "valid bearer token or session cookie required"))
			return
		}
		c.Set("identity", id)
		c.Next()
	})
	a.GET("/me", func(c *gin.Context) { c.JSON(200, c.MustGet("identity")) })
	a.POST("/session", func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if len(token) < 8 || token[:7] != "Bearer " {
			fail(c, protocol.Fail("unauthorized", 401, "Bearer header required to establish session"))
			return
		}
		c.SetSameSite(http.SameSiteStrictMode)
		c.SetCookie("dnd_session", token[7:], 86400, "/api/v1", "", s.Config.SecureCookie, true)
		c.JSON(200, c.MustGet("identity"))
	})
	a.DELETE("/session", func(c *gin.Context) {
		c.SetSameSite(http.SameSiteStrictMode)
		c.SetCookie("dnd_session", "", -1, "/api/v1", "", s.Config.SecureCookie, true)
		c.Status(204)
	})
	a.GET("/characters", func(c *gin.Context) {
		limit, offset := 50, 0
		var e error
		if v := c.Query("limit"); v != "" {
			limit, e = strconv.Atoi(v)
		}
		if e == nil && c.Query("offset") != "" {
			offset, e = strconv.Atoi(c.Query("offset"))
		}
		if e != nil || limit < 1 || limit > 100 || offset < 0 {
			fail(c, protocol.Fail("validation_error", 422, "invalid pagination"))
			return
		}
		rows, e := s.Service.List(user(c), limit, offset)
		if e != nil {
			fail(c, e)
			return
		}
		c.JSON(200, gin.H{"characters": rows, "limit": limit, "offset": offset})
	})
	a.POST("/characters", func(c *gin.Context) {
		var body struct {
			Document json.RawMessage `json:"document"`
		}
		if !s.decode(c, &body) {
			return
		}
		out, e := s.Service.Create(user(c), body.Document)
		if e != nil {
			fail(c, e)
			return
		}
		c.JSON(201, out)
	})
	a.GET("/characters/:id", func(c *gin.Context) {
		out, e := s.Service.Snapshot(user(c), c.Param("id"))
		if e != nil {
			fail(c, e)
			return
		}
		c.JSON(200, out)
	})
	a.POST("/characters/:id/operations", func(c *gin.Context) {
		var b protocol.Batch
		if !s.decode(c, &b) {
			return
		}
		out, e := s.Service.Submit(user(c), c.Param("id"), "web", b)
		if e != nil {
			fail(c, e)
			return
		}
		c.JSON(200, out)
	})
	a.GET("/characters/:id/operations", func(c *gin.Context) {
		n, e := strconv.ParseInt(c.Query("afterRevision"), 10, 64)
		if e != nil {
			fail(c, protocol.Fail("validation_error", 422, "afterRevision integer required"))
			return
		}
		out, e := s.Service.Delta(user(c), c.Param("id"), n)
		if e != nil {
			fail(c, e)
			return
		}
		c.JSON(200, out)
	})
	a.GET("/characters/:id/permissions", func(c *gin.Context) {
		out, e := s.Service.Permissions(user(c), c.Param("id"))
		if e != nil {
			fail(c, e)
			return
		}
		rows := []gin.H{}
		for _, p := range out {
			rows = append(rows, gin.H{"userId": p.UserID, "role": p.Role})
		}
		c.JSON(200, gin.H{"permissions": rows})
	})
	a.PUT("/characters/:id/permissions/:userId", func(c *gin.Context) {
		var b struct {
			Role string `json:"role"`
		}
		if !s.decode(c, &b) {
			return
		}
		if b.Role == "" {
			fail(c, protocol.Fail("validation_error", 422, "role required"))
			return
		}
		if e := s.Service.Permission(user(c), c.Param("id"), c.Param("userId"), b.Role); e != nil {
			fail(c, e)
			return
		}
		c.Status(204)
	})
	a.DELETE("/characters/:id/permissions/:userId", func(c *gin.Context) {
		if e := s.Service.Permission(user(c), c.Param("id"), c.Param("userId"), ""); e != nil {
			fail(c, e)
			return
		}
		c.Status(204)
	})
	a.GET("/ws", func(c *gin.Context) { s.Hub.Serve(c.Writer, c.Request, user(c)) })
	r.NoRoute(func(c *gin.Context) { fail(c, protocol.Fail("not_found", 404, "endpoint not found")) })
	return r
}
