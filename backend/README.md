# DND Go 后端

独立模块；不改变现有 React 前端。Go 1.25+，Gin、GORM、纯 Go SQLite、gorilla/websocket。运行不需要 C 编译器、SQLite 服务、Redis 或 Docker。协议入口：[OpenAPI](../openapi.yaml)、[前端接入](../docs/frontend/FRONTEND_IMPLEMENTATION_GUIDE.md)。

```bash
cd backend
go mod download
go test ./...
go vet ./...
go run ./cmd/server
```

默认监听 `127.0.0.1:8080`，数据库 `data/dnd.db`，启动自动执行嵌入的 SQL migrations 并校验 WAL/外键/busy_timeout/synchronous。首次启动生成 `data/bootstrap-credentials.json`（user.id 和 token）；凭证不输出到日志。保护此文件；勿提交或放在静态文件服务器内。Windows 文件 ACL 需由运行账号/目录权限保护。

```bash
# 新建其他用户；输出一次明文令牌，由管理员安全交付
go run ./cmd/server -create-user player-two
# Linux / 当前平台
CGO_ENABLED=0 go build -o dnd-backend ./cmd/server
# Windows 单文件构建（无 CGO）
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o dnd-backend.exe ./cmd/server
```

Windows 直接运行 `dnd-backend.exe`，所有相对路径相对于当前工作目录。用户身份通过 CLI 预配置，不开放注册，不实现 OAuth。默认仅 loopback；对外提供服务时配置监听、HTTPS 反向代理、准确的前端 origin 和 Secure cookie。代理不是本机运行的硬依赖。浏览器前后端必须同站（推荐同域 `/api/v1` 代理），才能使用 SameSite=Strict 的 WS 会话 cookie。

## 配置

均为环境变量；`DND_LISTEN` 包含 address:port。启动失败会明确报错，不默默切换数据库或禁用校验。

| 环境变量 | 默认 | 含义 |
| --- | --- | --- |
| DND_LISTEN | 127.0.0.1:8080 | 监听地址和端口 |
| DND_DATABASE | data/dnd.db | SQLite 文件 |
| DND_CORS_ORIGIN | http://localhost:5173 | 唯一允许的浏览器 Origin，不支持 * |
| DND_LOG_LEVEL | info | debug/info/warn/error |
| DND_SECURE_COOKIE | false | HTTPS 部署设 true |
| DND_RETENTION | 1000 | 每角色保留的最近操作数，1–10000 |
| DND_RECEIPT_DAYS | 90 | 成功回执最短保留天数，1–3650；按服务器提交时间计算 |
| DND_RECEIPT_RETENTION | 10000 | 每角色回执保留的最近 revision 范围，1–1000000；实际至少 DND_RETENTION 的10倍 |
| DND_RECEIPT_CLEANUP_BATCH | 100 | 每次新提交最多清理的过期回执数，1–1000 |
| DND_PAYLOAD_BYTES | 4194304 | HTTP JSON 上限，最多 20 MiB |
| DND_SNAPSHOT_BYTES | 4194304 | 最终文档上限，最多 20 MiB |
| DND_MAX_OPERATIONS | 128 | batch 操作数，1–128 |
| DND_CHARACTER_RATE | 30 | 每角色每秒新 batch 尝试数；相同成功回执重试不计 |
| DND_WS_MESSAGE_BYTES | 8192 | 客户端 WS 单消息上限 |
| DND_WS_SUBSCRIPTIONS | 16 | 每连接订阅数 |
| DND_WS_QUEUE | 64 | 每连接待写消息数 |
| DND_WS_CONNECTIONS | 1200 | 全局连接上限 |
| DND_WS_RATE | 20 | 每连接每秒应用消息数 |

固定保护：HTTP同时处理最多16个请求（WS长连接不占用此名额）；指针最多 4096 UTF-8 字节/32 段；JSON 深度 40、节点 200000；delta 查询的 result_json + operations_json 最多 16 MiB；WS 总排队字节预算 64 MiB，超预算关闭无法入队的连接。WS 每25秒 ping、75秒 pong 超时、10秒写超时。HTTP header 16 KiB、header 超时5秒、读写超时30秒、idle60秒。

日志只记录事件和身份/修订号，不记录角色正文、SQL payload 或令牌。默认单实例；不要同时启动多个写服务器连接同一数据库（内存顺序门禁与广播 Hub 不跨进程共享）。

Service 按 characterId 排序提交、commit后入队、订阅回放/注册及权限变化；闲置顺序锁立即回收，Create 不占用这些锁。数据库仍保留单连接：DSN 的连接级 pragma 由当前驱动每次建连执行，不增加连接池或改动事务模型，SQLite 的单写入者限制仍在。DSN 优先使用原生绝对文件路径并通过 `url.Values` 拼接 pragma；Unix 文件名含 `?` 时使用 `url.URL` 转义的 file URI。Windows 不再生成错误的 `file://C:/...`。

viewer/editor 切换保留连接与角色订阅；删除权限只使该角色订阅失效，立即压缩受控队列、释放旧 token 的消息数及字节容量，其他角色与连接级响应保持 FIFO。重新订阅不能复活旧 token。撤权只等待目标角色已开始的网络写入（也包含已替换/取消订阅的旧 token），不等待其他角色写入；Service 仍持有目标角色 gate，最坏受该帧剩余的单次10秒写超时影响，其他角色 gate 可继续推进。等待发生在事务提交后、Hub registry mutex 外。migration 使用当前驱动的 SQLite parser 执行完整 script，不自行拆分分号。

回执独立于 operation log。只有超过天数、落在较长 revision 保留范围之外、且对应 log 已删除的回执才会在新提交事务内分批清理；静止角色不启动额外清理任务。默认幂等保证至少90天，同时保留最近10000个 revision 的回执；缩短配置前需保证所有客户端正常重试窗口仍被覆盖。清理后的原请求因旧 baseRevision 已缺历史而返回 resync_required，不会再次扣资源；不能修改 baseRevision 或换 ID 自动重放未知结果，转人工核对。详细恢复约定见 [SYNC](../docs/protocol/SYNC.md)。

## 请求示例

从本地凭证文件取得 token 后放入 shell 环境变量 `DND_TOKEN`，不要把真实令牌写入脚本或版本库。

```bash
curl http://127.0.0.1:8080/health
# 创建请求体在 examples/character.json 外包一层 document
python3 -c 'import json; print(json.dumps({"document":json.load(open("examples/character.json"))}))' \
  | curl -sS http://127.0.0.1:8080/api/v1/characters \
      -H "Authorization: Bearer $DND_TOKEN" -H 'Content-Type: application/json' --data-binary @-
curl -sS "http://127.0.0.1:8080/api/v1/characters/$DND_CHARACTER_ID" -H "Authorization: Bearer $DND_TOKEN"
curl -sS "http://127.0.0.1:8080/api/v1/characters/$DND_CHARACTER_ID/operations" \
  -H "Authorization: Bearer $DND_TOKEN" -H 'Content-Type: application/json' \
  --data '{"operationId":"20000000-0000-4000-8000-000000000001","clientId":"30000000-0000-4000-8000-000000000001","baseRevision":1,"operations":[{"op":"inc","path":"/runtime/hp","value":-5}]}'
```

重试最后一条时保持 body 完全一致；新编辑必须换 operationId。`DND_CHARACTER_ID` 使用创建响应的外层 id，不能使用 document.id。

## 协议制品维护

```bash
python3 tools/generate_schemas.py
python3 tools/generate_openapi.py
gofmt -w cmd internal migrations schemas/embed.go
go test ./...
go test -race ./...
go vet ./...
```

JSON Schema 和 OpenAPI 是确定性生成制品；先改 tools 中的显式定义再生成。OpenAPI 使用 JSON 语法（合法 YAML），不是草稿。契约测试核对路由、示例及 OperationBatch schema。没有既有 backend staticcheck 配置。

实际规模取决于角色大小、写频率、磁盘与代理；1200 是连接保护上限，不是已证明的性能容量。完整平台连接器、用户自助注册、令牌轮换 UI、PostgreSQL 驱动不属于当前交付。

独立进程验收工具：对全新临时数据库以 `DND_RETENTION=2` 启动服务，再运行 `go run ./cmd/smoke -url http://127.0.0.1:8080 -credentials data/bootstrap-credentials.json`。它创建原创测试角色并保留在该临时数据库；不要指向生产实例。结果和边界见 [验证记录](../docs/backend/VALIDATION.md)。
