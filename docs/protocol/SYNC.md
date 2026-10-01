# Snapshot + Delta 同步

权威快照来自 SQLite。每卡 revision 独立，从1开始，提交成功batch增加1。不要比较不同角色的revision，也不要把旧本地Character.revision当服务器版本。

## 首次加载

GET snapshot → 保存 envelope/document/confirmedRevision → 建立WS → subscribe(lastRevision=confirmedRevision)。snapshot读取与订阅间发生的提交会由订阅回放补齐；服务器先发缺失 character.operations，再发 subscribed(revision)，之后是直播。客户端必须顺序处理。

## 正常编辑与自己广播

编辑前保存 confirmed snapshot 与当前用户意图；生成 operationId/clientId/baseRevision；先将完整batch持久化到IndexedDB outbox，再展示乐观结果并POST。HTTP与WS竞速，不能假设HTTP先到。

维护两个层次：**已确认文档**和**pending覆盖层**。每个服务器结果只按revision给已确认文档应用一次，再移除匹配operationId的pending，重算乐观视图。不要仅按clientId忽略自己的广播：自己的广播可能是唯一成功回执。已应用revision的重复HTTP/WS只用于收束outbox，不再次inc。

## 幂等

operationId 全局唯一；请求hash包含原始batch和服务端origin，并绑定actor与character。成功请求重复返回原成功结果（相同revision/updatedAt/rebased），不再写入、不广播、不扣资源。不同body/用户/角色复用相同ID返回409 duplicate_operation。重试仍须当前权限允许修改。

operation_receipts独立于日志retention；在幂等窗口内重启和日志删除不影响幂等。默认回执至少保留90天，同时保留每角色最近10000 revision；配置见 [backend/README](../../backend/README.md)，revision 窗口强制至少为 log retention 的10倍。只有同时超出时间和 revision 窗口且对应 log 已删除的回执才会分批清理，不和 log 一起立即 prune。幂等窗口从服务器首次成功提交开始，重试不延长窗口。失败事务不占用operationId，但修改内容后仍推荐生成新ID，避免客户端混淆未知结果。不要用新ID重试网络未知的旧请求。

超窗原请求即使回执已删除，也会因其旧 baseRevision 缺少历史返回 resync_required，不能再次应用；此时无法从服务器确认原成功结果。保留 outbox/草稿、读取 snapshot并人工核对原意图，禁止静默提高 baseRevision 或换 ID 补交。服务器不永久保存旧 ID 的任意 body 复用检测信息，客户端仍不得复用 operationId。缩短配置窗口前必须覆盖所有正常客户端重试周期，长期离线客户端超窗后走人工恢复。

## Rebase 完整时序

```text
客户端 A/B 读取 revision 1，hp=20，str=10
A: inc hp -5, base=1, op=A → commit revision 2, hp=15
B: set str=16, base=1, op=B
服务器检查 rev2 只改 runtime/hp，与 abilities/str 不相交
→ 自动rebase，commit revision 3，hp=15,str=16，rebased=true
C: inc hp -3, base=1 → rev2 inc同路径可交换，rev3不相交
→ commit revision 4，hp=12
D: set hp=99, base=1 → 与rev2/rev4 inc相交
→ 409 revision_conflict，不写入、不生成revision
```

## Delta / reconnect

GET operations?afterRevision=N 返回 `{characterId,currentRevision,operations:OperationResult[]}`，是从N+1到current的全部连续batch，不分页；N=current返回空数组。N必须>=1；初始无snapshot不能用N=0代替读取。

```text
本地已确认rev4 → 断网
其他客户端提交rev5、6
重连/HTTP delta(afterRevision=4) → [rev5,rev6] → 本地rev6
subscribe(lastRevision=6) → 缺失回放（如果期间有新提交）→ subscribed
恢复发送已持久化outbox中的原请求
```

每卡同一时间只发一个batch。服务端会做rebase，客户端不能擅自提高未知/冲突batch的baseRevision绕过冲突检测。并发标签页也必须依赖服务器，不自选最后时间戳。

## resync_required

默认保留最近1000个操作。历史不连续、delta体积超过16MiB预算、WS回放放不进当前连接队列时返回resync_required。HTTP409或WS同名消息；WS响应后该角色没有处于订阅状态。

停止新发送 → 保留outbox和乐观草稿 → GET snapshot替换confirmed → 重新subscribe → 对**已经发送但结果未知**的batch以原operationId/原body重试获取回执。在回执窗口内它若曾提交，将返回历史成功；不能再把这个旧result应用到较新的snapshot，但应删除匹配pending。它若未提交且base过旧，或回执已超窗清理，可能再次要求resync，需转入显式用户核对流程，不用新base静默补交。

对**从未发送**的离线意图，用保存的旧confirmed上下文与新snapshot做比较：展示冲突/重新确认；确认后重新生成操作与ID，以新revision发送。整张卡PUT覆盖不存在。

## 冲突与错误恢复

revision_conflict 保留草稿并显示 path/serverValue/clientValue；“保留服务器”丢弃该意图，“保留我的值”在用户确认且重新读取snapshot后创建新operationId；需要保持inc语义，不把差量改成绝对值。失败batch里的全部操作都未应用。

HTTP超时、连接断开、5xx均可能结果未知：保存原body并退避重试。401重新认证后重试；403停止发送、清除授权订阅但保留恢复草稿；422修正输入后新ID；429按Retry-After且加抖动；duplicate_operation是ID冲突或错误复用，先核对本地队列，不自动再扣一次。

旧merge.ts可用于恢复草稿的人工比较和旧Suite投影，不能在服务端拒绝后将合并结果自动全量覆盖。旧document-delta.ts不具备operationId/增量加法/revision协议，不能直接发送。
