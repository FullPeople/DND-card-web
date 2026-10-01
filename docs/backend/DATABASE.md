# 数据库契约

生产结构以 `backend/migrations/001_initial.sql` 为准，GORM 不执行 AutoMigrate。所有时间 TEXT，使用 UTC RFC3339Nano；JSON TEXT 用 SQLite json_valid CHECK。revision 是正整数，协议不超过 JS safe integer。

| 表 | 字段与约束 |
| --- | --- |
| users | id TEXT PK(UUID)、name TEXT、token_hash TEXT UNIQUE NOT NULL、created_at TEXT |
| characters | id TEXT PK(UUID)、owner_id FK users、system TEXT(dnd5e)、schema_version INTEGER(1)、revision INTEGER CHECK>=1、document_json TEXT JSON、created_at/updated_at TEXT |
| character_permissions | character_id FK characters ON DELETE CASCADE、user_id FK users、role CHECK owner/editor/viewer；复合 PK(character_id,user_id) |
| character_operations | operation_id TEXT PK(UUID)、character_id FK characters CASCADE、revision/base_revision INTEGER、client_id TEXT、actor_user_id FK users、origin TEXT、operations_json/touched_paths_json/result_json TEXT JSON、created_at TEXT；UNIQUE(character_id,revision) |
| operation_receipts | operation_id TEXT PK(UUID)、character_id FK characters CASCADE、actor_user_id FK users、request_hash TEXT、result_json TEXT JSON、created_at TEXT |
| external_bindings | id TEXT PK、character_id FK characters CASCADE、provider TEXT、external_id TEXT、mapping_version INTEGER、last_revision INTEGER DEFAULT0、last_event_id TEXT DEFAULT空、origin TEXT、config_json TEXT JSON DEFAULT{}；UNIQUE(provider,external_id) |
| schema_migrations | version TEXT PK（SQL 文件名）、checksum TEXT（SHA-256）、applied_at TEXT |

所有上述字段 NOT NULL（建表 SQL 中主键沿 SQLite 语义；应用总是提供非空 ID）。附加索引：characters_owner(owner_id)、permissions_user(user_id,character_id)、receipts_character(character_id)、bindings_character(character_id)；新增 `002_receipt_cleanup.sql` 的 receipts_cleanup(character_id,julianday(created_at),operation_id)，支持按真实时间检索过期回执，避免 RFC3339Nano 不同精度的字符串排序问题。各 PK/UNIQUE 对应 SQLite 自动索引。external_id 应含平台世界/房间/场景命名空间，不能用不带作用域的显示名。

## SQLite 与迁移

每个连接 DSN 设置 `journal_mode=WAL`、`foreign_keys=1`、`busy_timeout=5000`、`synchronous=NORMAL`；本地 go-sqlite v1.21.2 源码确认 `_pragma` 在每次建立连接时执行。Open 后逐项读取验证，任何不匹配都拒绝启动。池仍为 MaxOpenConns=1、MaxIdleConns=1：Service 已使用每角色 gate，本轮保持既有 sequencing 与连接池，避免并发 deferred 写事务升级锁争用。文件目录自动创建；使用真实文件而非 `:memory:`，WAL 可以验证。

DSN 使用 `filepath.Abs` 得到原生绝对文件路径，优先直接保留路径并用 `url.Values.Encode` 添加四个 `_pragma` 参数。例如 Windows `C:\card space\中文 #.db?_pragma=journal_mode%28WAL%29&...`，Unix `/tmp/card space/中文 #.db?_pragma=journal_mode%28WAL%29&...`。普通路径中的空格、`#`、Unicode、`%` 不按 URI 解码。当前驱动按第一个 `?` 拆 query，因此合法 Unix 文件名含 `?` 时改用 `url.URL{Scheme:"file", Path:abs}` 自动转义路径，例如 `/tmp/card # ?.db` 对应 `file:///tmp/card%20%23%20%3F.db?...`；Windows 文件名不能含 `?`。不自行替换 URI 字符，不回退内存库。

旧构造在 Windows 将 `C:/...` 放入 URL Path，序列化为 `file://C:/...`，形成错误的 URI authority；原生 Go1.25.3 与锁定驱动实际复现 `SQL logic error: out of memory (1)`。诊断测试确认普通 Windows 绝对路径及正确 `file:///C:/...` 都能打开磁盘，本实现优先普通路径。Windows 和 WSL 的 ASCII、空格、中文/Unicode、`#`/`%` 路径均已真实 Open/reopen，以 `PRAGMA database_list` 加 `os.SameFile` 核对磁盘身份，并保留全部 pragma 校验及 migration trigger/checksum/rollback 断言。具体平台与命令见 [验证记录](VALIDATION.md)。

启动创建 schema_migrations，按文件名排序，逐个事务用 `tx.Exec(string(script))` 执行完整 SQL 和写入版本/校验和。go-sqlite v1.21.2 使用 SQLite prepare/tail parser 逐条执行，支持 trigger BEGIN...END、字符串与注释内分号；任一错误返回并回滚本 migration 的 DDL、DML 和 checksum 记录，不影响先前已提交 migration。已执行文件 checksum 不匹配则停止；只能新增 migration，不修改已上线 SQL。没有自动 down migration；回退应先停服并从经过验证的完整备份恢复。WAL 状态下不要只复制 .db 文件做热备份；停服后备份，或使用 SQLite 一致性备份接口。

## 事务与权限

每笔角色创建同时写 owner permission。后续 operation 在同一事务读取权限、当前快照、幂等回执和历史；snapshot compare-and-swap 更新、log、receipt、retention 删除原子提交。写日志失败会回滚 snapshot。读 snapshot/delta 也在读事务内校验权限。

owner_id 是最终所有者，permission owner 在创建时生成；API 不提供所有权转移或删除 owner permission。普通 editor 修改 Character.locked 不改变服务端授权。grant/revoke 仅 owner；目标用户必须已由 CLI 创建。viewer/editor 变化 commit 后调用 PermissionChanged，保留读订阅；删除权限调用 PermissionRevoked，只撤销该用户该角色订阅。订阅、提交、撤权共用既有每角色顺序锁，不改变 sequencing 实现。

队列由 `sendMu` 统一保护 enqueue、take、close 和撤权时的稳定压缩；删除旧 token 的 delivery 立即释放消息容量与全局字节计数，其他角色及连接级消息保持 FIFO。入队增加一次计数，取出、压缩删除或 close 清理三者互斥且各扣减一次；已取出的帧不再计入 queue bytes。失效 token 的后续 enqueue 不占容量，重新 grant/subscribe 使用新 token。

writer 在同一 `sendMu` 下检查 token 并注册 in-flight write，实际网络写入在 mutex 外；Revoke 在失效/压缩时只捕获目标 characterId 的 in-flight completion channel，释放 Hub registry mutex 后等待。即使该帧来自已被替换或 unsubscribe 的旧 token 也等待，其他角色写入不参与 barrier。DELETE 返回后旧 token 不能再开始发送，已进入网络的字节无法撤回。该角色 Service gate 仍等 barrier，最坏受当前单次10秒 WS write deadline 的剩余时间影响；其他角色 Submit/Synchronize/Create 可继续推进。数据库事务已提交后才等待，网络不进入事务。再次 subscribe 通过 Service 当前权限检查返回 forbidden。

## Retention

默认每角色保留1000个操作；每次成功 batch 删除 `revision <= currentRevision-retention`。snapshot 完全不依赖这些历史，删除不影响当前卡。delta 或 rebase 缺少任一历史版本时返回409 resync_required；历史超过16MiB回放预算时同样要求 snapshot。没有自动时间压缩任务。

**operation_receipts 不随日志立即删除**。保存全局 operationId、用户/角色绑定、请求 hash 和原 result，在保留窗口内重启、日志删除后 retry 仍返回原成功结果。回执也包含操作正文，要按角色数据同样保护。

配置 `DND_RECEIPT_DAYS`（默认90天）、`DND_RECEIPT_RETENTION`（默认10000 revision，实际至少10×log retention）、`DND_RECEIPT_CLEANUP_BATCH`（默认100）。每次成功新提交，在同一事务先 prune log，再清理该角色同时满足以下条件的最旧回执：提交时间已超过天数、result.revision <= currentRevision-effectiveReceiptRetention、对应 operation log 不存在。最近 revision 或未过期时间范围任一条件仍满足则不删；一次最多指定批量，静止角色回执继续保留。清理失败也回滚本次 snapshot/log/receipt，不产生广播。

过期原请求的 baseRevision 不大于其原提交 revision，且已落后于被删除的 log 范围；回执清理后重试必然因历史缺口返回 resync_required，不会重新应用。此时服务器不再保证可取得原成功 result，也不永久检测任意不同 body 的旧 ID 复用；客户端 ID 仍须全局唯一，禁止提高旧请求 base 或换 ID 自动补交。正常未知结果重试必须在配置窗口内，超窗转人工核对。协议详见 [SYNC](../protocol/SYNC.md)。

external_bindings.last_revision 是最后确认的服务器 Character revision；初始0表示尚未取得服务器 snapshot，不能 Dispatch。Event.Revision 是外部平台版本/sequence，不进入服务器 optimistic concurrency。external_bindings 只建立可迁移结构，目前没有在线 binding CRUD/检查点 worker。连接器持久化 pending 事件的原 binding base/payload，成功确认后通过独立 binding repository 更新 last_revision/last_event_id；未知结果保留原请求重试，不能用新检查点重建同 ID 的 body。连接器不得直接更新 characters。
