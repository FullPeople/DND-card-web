# 本次文件清单

已有文件仅修改：根 `README.md`（后端入口链接）、`docs/STATUS.md`（本地交付与验证边界）。`src/`、`prototype/`、`package.json`、`package-lock.json`未修改。

新增后端文件（相对于backend/）：

```text
.gitignore
AGENTS.md
README.md
go.mod
go.sum
cmd/server/main.go
cmd/smoke/main.go
examples/character.json
internal/auth/auth.go
internal/config/config.go
internal/protocol/types.go
internal/character/operations.go
internal/character/schema.go
internal/character/service.go
internal/character/service_test.go
internal/storage/store.go
internal/storage/sqlite/sqlite.go
internal/api/http/server.go
internal/api/http/server_test.go
internal/api/http/contract_test.go
internal/api/websocket/hub.go
internal/api/websocket/hub_test.go
internal/adapters/adapter.go
internal/adapters/adapter_test.go
internal/adapters/fvtt/fvtt.go
internal/adapters/owlbear/owlbear.go
migrations/001_initial.sql
migrations/embed.go
schemas/embed.go
schemas/character/v1.json
schemas/protocol/operation.v1.json
tools/generate_schemas.py
tools/generate_openapi.py
```

新增根 `openapi.yaml`，以及：

```text
docs/backend/AUDIT.md
docs/backend/ARCHITECTURE.md
docs/backend/DATABASE.md
docs/backend/VALIDATION.md
docs/backend/FILES.md
docs/protocol/CHARACTER_SCHEMA.md
docs/protocol/OPERATIONS.md
docs/protocol/SYNC.md
docs/protocol/WEBSOCKET.md
docs/api/HTTP_API.md
docs/frontend/FRONTEND_IMPLEMENTATION_GUIDE.md
docs/frontend/CLAUDE_FRONTEND_PROMPT.md
```

生成制品：两个JSON Schema与openapi由tools确定性生成；go.sum由Go生成。二进制、临时SQLite、凭证、Go构建缓存均在/tmp，不加入源码。新增backend目录中的data/与默认可执行文件已加入本地.gitignore规则。
