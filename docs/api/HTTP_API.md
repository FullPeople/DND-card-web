# HTTP API v1

正式机器契约：根目录 `openapi.yaml`（OpenAPI3.1，JSON语法的合法YAML）。基址默认 `http://127.0.0.1:8080`。请求/响应 application/json；204无body。默认request与snapshot分别4MiB，UTF-8；限制见 backend/README.md。无全量PUT角色接口，无WS写操作。

## 认证

管理员运行 `go run ./cmd/server -create-user <name>` 得到user.id/token，或使用首次启动本地bootstrap文件。发送 `Authorization: Bearer <64位hex token>`。不接受调用方任意userId冒充用户。数据库只保存token摘要。浏览器建立cookie会话后HTTP可credentials:include，WS自动带cookie。健康检查免认证，其他接口都要认证。

### GET /health

200 `{"status":"ok"}`。表示进程已启动并完成数据库配置/迁移；不是持续磁盘可写监控。无request body。

### GET /api/v1/me

任意已认证用户，200：

```json
{"id":"50000000-0000-4000-8000-000000000001","name":"local-owner"}
```

### POST /api/v1/session

必须使用Bearer header，无request body。200同me，Set-Cookie: dnd_session，HttpOnly、SameSite=Strict、Path=/api/v1、Max-Age=86400，Secure由配置决定。不是新token签发，底层仍是预配置token。前端与后端须同站；推荐同域反向代理，开发时不要混用localhost和127.0.0.1。

### DELETE /api/v1/session

需认证，无body，204清cookie。不会撤销令牌，也不关闭已有WS；前端退出必须主动close所有WS并清自己的内存凭证。

### GET /api/v1/characters?limit=50&offset=0

列出当前用户有owner/editor/viewer权限的角色元数据，按createdAt/id稳定排序。limit=1..100，offset>=0；默认50/0。200，无document正文：

```json
{"characters":[{"id":"40000000-0000-4000-8000-000000000001","ownerId":"50000000-0000-4000-8000-000000000001","system":"dnd5e","schemaVersion":1,"revision":1,"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-10-01T00:00:00Z"}],"limit":50,"offset":0}
```

列表没有从角色正文提取name；前端从已缓存snapshot显示标题，未缓存时按需读取。不能假设列表已包含Character。参数错误422 validation_error。

### POST /api/v1/characters

已认证用户可创建，自动成为owner。request：`{"document":<完整Character v1>}`，示例完整document见 `backend/examples/character.json` 和 CHARACTER_SCHEMA.md。只提交document；不接受ownerId/revision/system等外层客户端元数据。

201返回完整CharacterSnapshot（见 CHARACTER_SCHEMA.md），server id是新UUID、revision1；保留旧document.id/createdAt，镜像revision/updatedAt。422 schema_mismatch/validation_error；413 payload_too_large。导入走同接口；只支持原生Character模型，非原生先转换。创建本身不支持operationId，超时后先核对列表/原document.id再决定是否创建，勿盲目重试。

### GET /api/v1/characters/{id}

owner/editor/viewer，200完整CharacterSnapshot。id是服务器UUID。无body。不存在404 not_found；已存在但无权限403 forbidden。

### POST /api/v1/characters/{id}/operations

owner/editor，viewer403。request：

```json
{"operationId":"20000000-0000-4000-8000-000000000001","clientId":"30000000-0000-4000-8000-000000000001","baseRevision":1,"operations":[{"op":"inc","path":"/runtime/hp","value":-5}]}
```

200：

```json
{"characterId":"40000000-0000-4000-8000-000000000001","revision":2,"baseRevision":1,"operationId":"20000000-0000-4000-8000-000000000001","clientId":"30000000-0000-4000-8000-000000000001","origin":"web","operations":[{"op":"inc","path":"/runtime/hp","value":-5}],"touchedPaths":["/runtime/hp"],"updatedAt":"2026-10-01T00:01:00Z","rebased":false}
```

同请求ID/body重试仍200及原结果，没有额外duplicate:true字段，也没有第二次广播。409 revision_conflict/duplicate_operation/resync_required；422 invalid_operation/invalid_path/validation_error；429 rate_limited。详细set/unset/inc/entity/order语义见 OPERATIONS.md。

### GET /api/v1/characters/{id}/operations?afterRevision=N

owner/editor/viewer只读，N必填正整数。200：

```json
{"characterId":"40000000-0000-4000-8000-000000000001","currentRevision":2,"operations":[{"characterId":"40000000-0000-4000-8000-000000000001","revision":2,"baseRevision":1,"operationId":"20000000-0000-4000-8000-000000000001","clientId":"30000000-0000-4000-8000-000000000001","origin":"web","operations":[{"op":"inc","path":"/runtime/hp","value":-5}],"touchedPaths":["/runtime/hp"],"updatedAt":"2026-10-01T00:01:00Z","rebased":false}]}
```

等于current返回operations:[]。超出版本范围409 revision_conflict；历史已清理或超过回放预算409 resync_required；缺失/非整数422 validation_error。不是分页接口；所有结果必须连续，否则服务端拒绝。

### GET /api/v1/characters/{id}/permissions

仅owner。200：

```json
{"permissions":[{"userId":"50000000-0000-4000-8000-000000000001","role":"owner"}]}
```

### PUT /api/v1/characters/{id}/permissions/{userId}

仅owner，目标是已经CLI创建的用户UUID。request `{"role":"editor"}` 或 `{"role":"viewer"}`；204。目标用户不存在404 not_found；试图改owner403 forbidden；角色值非法422 validation_error。viewer/editor 切换保留已有 WS 连接和该角色订阅；后续写入按当前角色权限检查，降为 viewer 后写入返回403。

### DELETE /api/v1/characters/{id}/permissions/{userId}

仅owner，无body，204；不存在permission但用户存在也是204。不能删除owner；未知用户404。撤权只使该角色订阅及未发送消息失效，连接上其他角色继续同步。响应返回后不再发送该角色广播；HTTP读取/写入和已有WS再次subscribe均返回403。已在撤权前发送到网络的字节不能撤回。

### GET /api/v1/ws

认证后WebSocket upgrade，101；协议见 WEBSOCKET.md。无合法握手400，其他认证/Origin/限额与HTTP一致。浏览器不把Bearer token放URL。

## 统一错误

```json
{"code":"invalid_path","message":"parent must exist and be an object; array indexes are forbidden"}
```

| HTTP | code | 前端动作 |
| --- | --- | --- |
| 401 | unauthorized | 重新认证，保留outbox |
| 403 | forbidden | 停止角色发送/订阅，保留恢复草稿 |
| 404 | not_found | 校验角色/用户ID，刷新可访问列表 |
| 409 | revision_conflict | 显示冲突或纠正future base，禁止自动LWW |
| 409 | resync_required | 读取新snapshot，保留未知结果请求 |
| 409 | duplicate_operation | ID被不同请求复用，停止自动重发并诊断 |
| 413 | payload_too_large | 缩减图片/批量操作，不能靠无穷重试 |
| 422 | validation_error | JSON/schema/参数/最终文档非法 |
| 422 | schema_mismatch | 保留旧文件，禁止猜测版本升级 |
| 422 | invalid_operation | op/type/实体/数值语义非法 |
| 422 | invalid_path | 非法、受保护、数组下标或不存在父对象 |
| 429 | rate_limited | Retry-After:1，抖动退避，原ID重试 |
| 500 | internal_error | 结果可能未知，原ID重试 |

code稳定，message仅诊断。冲突附currentRevision/baseRevision/conflicts；future revision可能无conflicts；缺失值通过serverExists区分null。请求未知字段通常422；传输层畸形HTTP/WS握手不保证JSON应用错误。CORS预检OPTIONS204，Origin必须准确匹配配置。
