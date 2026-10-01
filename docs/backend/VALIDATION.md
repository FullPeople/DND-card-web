# 后端交付验证

日期：2026-10-01。环境：WSL/Linux、Go1.25.0；使用真实SQLite临时文件，全部角色为原创合成数据。没有修改线上角色、旧Suite、Godot或前端运行源码，没有提交/发布。

## 本轮 Windows DSN / 撤权队列修复验证

2026-10-01，WSL/Linux Go1.25.0；Windows 原生 Go1.25.3。保留既有未提交修改，仅改 SQLite DSN、Hub 内部队列/barrier、对应测试及说明文档；没有更改 Character/Operation/HTTP/WS 协议、revision/rebase/幂等、Adapter 或 per-character sequencing 实现。没有安装/下载依赖、提交、push 或部署。

| 平台/命令 | 实际结果 |
| --- | --- |
| gofmt -w（本轮5个Go文件） | 通过 |
| WSL：GOCACHE=/tmp/dnd-backend-go-cache GOPROXY=off go test ./... -count=1 | 全部通过，真实 SQLite/HTTP/WS |
| WSL：同环境 go test -race ./... -count=1 | 全部通过，无竞态报告 |
| WSL：同环境 go vet ./... | 通过，无诊断 |
| Windows 原生：GOPROXY=off go test ./internal/storage/sqlite -run TestMigrationScriptTriggerChecksumAndRollback -v -count=1 | 通过，真实 trigger/checksum/rollback |
| Windows 原生：go test ./internal/storage/sqlite -v -count=1 | 全部通过，含新 DSN/path/Open/reopen 用例 |
| Windows 原生：GOPROXY=off go test ./... -count=1（默认缓存） | 依赖准备失败；缺 gin v1.10.1、jsonschema/v6 v6.0.2，module lookup disabled by GOPROXY=off，相关包未执行；SQLite 与 Config 通过 |
| Windows 原生：GOPROXY=off go test ./... -count=1（复用本地缓存） | 全部通过，含真实 SQLite/HTTP/WS、Adapter、Character 及本轮全部新测试；无网络下载 |
| git diff --check、受保护路径 diff | 通过；src/prototype/package.json/package-lock.json 输出为空，新增/未跟踪的本轮变更文件另做 no-index whitespace 检查通过 |
| Windows 交叉编译 | 本轮未重跑；历史成功只证明编译，不替代原生运行 |

Windows 原生最小诊断 `TestSQLiteDSNDriverFormats` 实际输出旧 `file://C:/Users/.../test%20space%20%23%20%E4%B8%AD%E6%96%87.db?...`，Open 为 `SQL logic error: out of memory (1)`；修复前 migration 定向测试也同样失败。普通 `C:\Users\...\test space # 中文.db?...` 和正确 `file:///C:/...` 在同机同驱动均真实打开预期文件，排除了网络下载原因。诊断 legacy 子例保留原错误日志；生产路径、新 helper 与磁盘测试均严格断言成功，不跳过 Windows SQLite。

`TestFileDSNPaths` 跨平台核对 Windows drive、Unix absolute 与空格/中文/`#`/`%`/`&`/Unix `?`，包括四个 pragma query 的完整值；`TestOpenDiskPaths` 使用 t.TempDir 真实 Open、检查 `database_list` 非 memory 且 `os.SameFile` 指向预期文件、写入再 reopen 验证持久化。Windows 无合法 `?` 文件名，Unix 对该字符执行真实 Open；Windows 实际执行 ASCII、空格、中文/Unicode、其他合法特殊字符全部用例。

新增真实 WebSocket 用例：`TestRevokeReclaimsFullQueue` 以容量2的 A delivery 填满，再撤权、发布 B、重新 grant，逐帧确认无旧 A、连接仍活跃且 bytes=0；`TestRevokeCompactionPreservesFIFOAndBytes` 检查 B/C/连接级响应的顺序和准确字节、重复撤权/close 不重复扣减；`TestConcurrentPublishRevokeAndWriter` 并发 A/B 发布、撤权和真实 writer，B 全部连续无缺失/重复、撤权后 A 不再发送且 bytes=0，纳入全量 race。

`TestRevokeBarrierIgnoresOtherCharacterWrite` 用通道阻塞真实 B 网络写入，A 撤权仍完成；`TestRevokeBarrierWaitsForRetiredCharacterWrite` 包含 unsubscribe/resubscribe 的旧 A in-flight；`TestSlowRevokedWriterDoesNotBlockOtherCharacterService` 用真实 SQLite 和阻塞 A writer 证明 DELETE 等待旧帧，而 B Submit/Synchronize/Create 均可完成，返回后旧 token 不再写出。测试通过 channel barrier 协调，不新增 sleep、不依赖 socket buffer 填满。最坏等待仍限于已开始的目标角色单次 WS write deadline（10秒剩余时间），不是无限等待或全角色锁。

首次 WSL 定向测试的真实 socket 因沙箱 `listen tcp6 [::1]:0: socket: operation not permitted` 失败；授权在沙箱外重跑定向、全量及 race 全部通过，没有跳过/放宽测试。Windows 默认缓存不足；直接复用复制到 WSL `/tmp` 的缓存又遇 Windows Go 的 UNC 文件锁 `RLock ...ziphash: Incorrect function`，两者都是依赖准备/缓存环境失败，发生在代码测试前，不是 SQLite 运行失败。

最终将既有 WSL 已解压模块及校验元数据离线复制到 Windows 临时目录 `C:\Users\chenzihan\AppData\Local\Temp\dnd-backend-offline-g9g8swdx`，原生 PowerShell 设置本命令环境 `GOPROXY=off`、`GOMODCACHE` 指向该目录后执行全量测试成功。没有联网补依赖，没有改 go.mod/go.sum，也没有修改永久 Go 环境配置。Windows 原生全量最终无未解决测试失败；Windows native race/vet、exe 独立进程 smoke 和本轮交叉编译未另跑，WSL 全量 race/vet 已通过。

Windows 新路径测试可离线复现：在 backend 设置 `GOPROXY=off` 及可用的原生磁盘 `GOMODCACHE` 后分别运行 `go test ./internal/storage/sqlite -run TestFileDSNPaths -v -count=1`、`go test ./internal/storage/sqlite -run TestOpenDiskPaths -v -count=1`；本轮已通过 storage/sqlite 全包原生运行覆盖二者，不以交叉编译替代。

## 上一轮审阅修复验证

2026-10-01 在既有未提交实现上修复每角色 sequencing、Adapter revision、局部权限撤销、migration script 和回执清理；未安装依赖，未改动 Character Schema、Operation JSON、HTTP 路由、WS 消息类型或前端源码，未提交/推送/部署。

| 命令（在 backend；GOCACHE=/tmp/dnd-backend-go-cache、GOPROXY=off） | 本轮结果 |
| --- | --- |
| gofmt -w（本轮变更的Go文件） | 通过 |
| go test ./... -count=1 | 全部通过，含真实SQLite/HTTP/WebSocket |
| go test -race ./... -count=1 | 全部通过，无竞态报告 |
| go vet ./... | 通过，无诊断 |
| git diff --check、受保护前端路径diff | 通过，src/prototype/package.json/package-lock.json无diff |

新增及加强的证据：

- `TestDifferentCharactersProgressDuringCommitPublish`：真实SQLite中阻塞 cardA commit后的Publish，cardB仍能Submit/Synchronize、Create及权限检查；同一卡下一提交仍等待，结束后 gate 表为空。
- `TestSubscribeReplayAndConcurrentCommitsHaveNoGap` / `TestWebSocketSubscribeRacesHTTPCommitWithoutLostRevisions`：回放窗口与并发提交，逐条核对连续revision和subscribed barrier，没有缺失/重复/乱序。
- `TestDispatchUsesConfirmedServerRevisionWithRealSQLite`：外部版本99/100使用 binding server revision 1/2提交，重放仍返回原operationId/revision且不重复广播；纯映射测试另覆盖 LastEventID/origin过滤和未确认binding拒绝。
- `TestHTTPPermissionChangesAndCharacterLocalWebSocketRevoke`：真实socket同时订阅cardA/cardB，viewer/editor双向切换保留订阅；DELETE后A的HTTP和再次subscribe均拒绝，A广播消失，B持续广播与ping仍正常。`TestRevokeInvalidatesQueuedCharacterOnly` 验证旧排队token不能被重新grant复活。
- `TestMigrationScriptTriggerChecksumAndRollback`：完整script包含trigger多语句、字符串转义/分号及注释分号；校验SHA-256、重复执行、checksum变化拒绝；失败后的DDL/DML/checksum全部rollback，已成功migration仍可工作。
- `TestReceiptCleanupPreservesRetryWindowAndRejectsExpiredReplay` / `TestReceiptCleanupProtectsExistingLogAndRollsBack` / `TestReceiptCleanupBatchBound` / `TestHTTPReceiptWindowCleanupAndExpiredRetry`：双保留窗口、10倍最低revision窗口、有log不删、批量上限、清理失败事务回滚、清理后reopen和HTTP原请求resync而不重复执行；Config测试覆盖环境变量与非法值。

最初定向测试中SQLite/Service/Adapter/Config/Hub通过，HTTP因沙箱禁止监听端口失败：`listen tcp6 [::1]:0: socket: operation not permitted`。已授权在沙箱外重跑完整测试及race通过，未跳过或放宽断言。Windows原生运行、交叉编译、独立进程smoke和容量压测本轮未重跑；下面为先前交付证据，不能当作本轮新结果。

## 先前交付验证

| 项目 | 结果 |
| --- | --- |
| gofmt | 全部Go源码已格式化 |
| go test ./... | 通过；包含真实SQLite、HTTP与WebSocket，不mock持久化 |
| go test -race ./... | 通过；覆盖并发inc、相同ID并发重试、Hub发送与撤权 |
| go vet ./... | 通过；仓库无其他既有backend lint/staticcheck配置 |
| Windows构建 | CGO_ENABLED=0 GOOS=windows GOARCH=amd64编译成功，/tmp/dnd-backend.exe |
| 独立进程 | 编译server二进制并启动，使用/tmp/dnd-backend-smoke.YW6doU/dnd.db，127.0.0.1:18081，retention=2 |
| 独立网络验收 | cmd/smoke通过health/create/snapshot/operation/revision/retry/conflict/rebase/WS/reconnect/delta/resync/日志清理后回执；不证明无限时间的幂等 |
| 迁移/SQLite配置 | 启动验证WAL、foreign_keys、busy_timeout、NORMAL；SQL版本/checksum写入；重新打开数据保留 |
| 协议一致性 | 路由与OpenAPI双向核对、全部OpenAPI请求/响应example校验、Operation schema一致性、文档JSON示例解析/操作及Character校验 |
| 前端边界 | src、prototype、package.json、package-lock.json未修改；本机无node_modules，没有安装前端依赖 |

测试范围包括：创建/镜像metadata、set/unset/inc、实体upsert/delete/顺序、不同实体ID、父子路径、同路径冲突、无冲突rebase、两个inc、重复operationId、ID复用拒绝、原请求并发重试、未来/历史revision边界、注入日志写入失败rollback、delta重放等于snapshot、日志清理resync、迁移确定性/幂等/未知版本拒绝、SQLite reopen、权限拒绝及撤销、commit后广播、订阅重连、session cookie、大小限制和慢队列隔离。具体测试名称可在backend运行 `go test ./... -list Test` 查看。

最初HTTP集成测试被沙箱socket限制阻止；授权后在沙箱外重跑通过，未将这次环境失败算为产品失败或跳过。依赖下载同样经授权完成。Windows Interop出现UtilBindVsockAnyPort错误后，本轮全部验证回退WSL，没有反复调用Interop。

## 复现

```bash
cd backend
go test ./...
go test -race ./...
go vet ./...
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o /tmp/dnd-backend.exe ./cmd/server
```

真实进程另开终端，使用专用测试目录：

```bash
DND_DATABASE=/tmp/dnd-verification/dnd.db DND_LISTEN=127.0.0.1:18081 DND_RETENTION=2 go run ./cmd/server
```

```bash
go run ./cmd/smoke -url http://127.0.0.1:18081 -credentials /tmp/dnd-verification/bootstrap-credentials.json
```

smoke会创建测试角色，不应指向生产。初始凭证由进程生成，不出现在代码或本记录。

## 明确边界

- 没有进行1000真实在线连接/4GB主机长期负载测试；连接上限和内存预算是实现保护，不是性能认证。
- Windows SQLite 已通过本轮原生测试；Windows exe 的独立 server 启动/smoke 本轮仍未执行。历史 CGO_ENABLED=0 Windows 交叉编译结果与原生运行证据分开记录。
- 没有前端接入实现、前端浏览器UI验收或旧前端测试运行（缺node_modules；WSL Node20低于项目要求Node22）。已有前端源码保持只读。
- FVTT/Owlbear只有Adapter边界与HP示例映射；完整第三方认证、双向连接器、binding管理端点及持久出站worker不在当前实现。
- PostgreSQL JSONB仅保留Repository/Tx替换路径，无当前驱动/迁移实现。当前服务要求单进程写同一个SQLite。
- 后端验证Character结构和操作一致性，不移植完整D&D规则引擎；来源依赖及业务授予仍由现有纯前端核心处理，不自动补资源。
- 回执在时间或较长revision窗口内仍会增长，不是硬性数据库大小上限；只在该角色新成功提交时分批清理，静止角色过期回执继续保留。默认至少90天/最近10000revision，超窗未知结果只能人工核对，不再保证取回原result。SQLite仍单连接，消除Service层全角色锁不代表并行数据库写入。当前无自助注册/复杂OAuth/令牌管理UI。
