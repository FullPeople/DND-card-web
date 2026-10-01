# WebSocket v1

URL：`GET /api/v1/ws`。连接前必须认证。非浏览器可以用Authorization: Bearer；浏览器先带Bearer执行 `POST /api/v1/session` 建立 HttpOnly cookie，再 `new WebSocket('ws://同站后端/api/v1/ws')`。HTTPS使用wss、配置Secure cookie。不得把token放URL/query或subprotocol。

Origin必须与DND_CORS_ORIGIN一致；无Origin的非浏览器客户端仍需认证。无权限/无令牌在upgrade前HTTP401/403；连接超限HTTP429。非法WebSocket握手属于HTTP传输400，可为库的文本错误。正常应用错误均为稳定JSON code。

## 消息

订阅：

```json
{"type":"subscribe","characterId":"40000000-0000-4000-8000-000000000001","lastRevision":1}
```

服务器先按revision发送全部缺失操作，再确认：

```json
{"type":"subscribed","characterId":"40000000-0000-4000-8000-000000000001","revision":2}
```

提交后增量广播和重连回放使用相同格式：

```json
{"type":"character.operations","characterId":"40000000-0000-4000-8000-000000000001","revision":2,"baseRevision":1,"operationId":"20000000-0000-4000-8000-000000000001","origin":"web","clientId":"30000000-0000-4000-8000-000000000001","operations":[{"op":"inc","path":"/runtime/hp","value":-5}],"touchedPaths":["/runtime/hp"],"updatedAt":"2026-10-01T00:01:00Z","rebased":false}
```

取消订阅及响应：

```json
{"type":"unsubscribe","characterId":"40000000-0000-4000-8000-000000000001"}
```
```json
{"type":"unsubscribed","characterId":"40000000-0000-4000-8000-000000000001"}
```

历史不可用或回放队列不足：

```json
{"type":"resync_required","characterId":"40000000-0000-4000-8000-000000000001","code":"resync_required","message":"operation history is no longer contiguous","currentRevision":1200,"baseRevision":1}
```

currentRevision/baseRevision 在某些队列容量错误中可省略。此时该角色未订阅，客户端应HTTP delta或snapshot恢复后重新订阅；message不能用于分支判断。

错误：

```json
{"type":"error","characterId":"40000000-0000-4000-8000-000000000001","code":"forbidden","message":"no character permission"}
```

characterId 在无角色上下文的非法JSON/未知消息错误中省略。

应用层心跳（可选）：

```json
{"type":"ping"}
```
```json
{"type":"pong"}
```

另有WebSocket控制帧ping每25秒发出；浏览器自动pong，75秒无控制pong断开。应用ping不能替代控制pong。禁止通过WS发送编辑；统一走HTTP操作pipeline。未知消息返回invalid_operation。

## 断线及顺序

一条WS内消息排队有序；HTTP结果可能比广播早或晚。按characterId+revision去重，按operationId确认pending。检测到revision>confirmed+1即暂停应用后续消息，HTTP补delta，不能越过缺失版本。subscribed.revision应等于本地已回放版本，否则补同步。

默认16个角色/连接、1200连接、20消息/秒、入站8KiB、队列64项、全局排队64MiB；10秒写超时。超速/慢客户端/大小越界会关闭连接，可能收到1006或传输错误，不承诺一定送达最后error消息。一个慢客户端不会阻塞其他人。重连采用指数退避+随机抖动，以最后**已确认**revision重新订阅。

权限授予仅owner通过HTTP进行。viewer/editor 切换保留socket和该角色订阅；删除权限只撤销该角色订阅，失效其尚未发送的队列消息，其他角色在原连接上继续同步。撤权返回后不再发送该角色消息，撤权前已经发送的字节无法撤回。没有新增WS消息类型或强制关闭通知；已有连接再次subscribe通过Service权限检查返回error/forbidden。客户端403后停止自动订阅该角色，保留草稿。重新subscribe失败会取消该角色旧订阅。
