# Operation protocol v1

`POST /api/v1/characters/{serverId}/operations`，owner/editor。JSON Schema：`backend/schemas/protocol/operation.v1.json`。

```json
{
  "operationId":"20000000-0000-4000-8000-000000000001",
  "clientId":"30000000-0000-4000-8000-000000000001",
  "baseRevision":1,
  "operations":[{"op":"inc","path":"/runtime/hp","value":-5}]
}
```

operationId/clientId 必填 UUID；baseRevision 是已确认服务器版本，>=1，外部平台事件版本不可代入。batch 1–128项（可配置更低）。全部操作按顺序作用于当前快照，一个 batch 一个事务/新 revision；任一操作或最终 schema 失败则全部回滚。成功 no-op 也占一个 revision，便于幂等回执和连续广播。回执窗口、清理及超窗恢复见 [SYNC](SYNC.md)。

## 路径

JSON Pointer `/` 分段；字段名中的 `~` 编码 `~0`，`/` 编码 `~1`，不是 URL encode。路径非空、不允许根替换；最多4096 UTF-8字节/32段，段不可空，拒绝坏转义和 prototype 污染键。路径父对象必须存在；必要时前一操作先 set 创建可选对象。不能进入任何实际数组下标。未知根字段、id/schemaVersion/revision/createdAt/updatedAt 受保护；顶层任意外部元数据均非有效根。

## 六种操作

| op | 必需字段 | 语义 | touched path |
| --- | --- | --- | --- |
| set | path,value（可为null，取决于schema） | 对现有父对象的成员设置完整值；最终schema决定类型 | path |
| unset | path | 删除可选字段；不存在时no-op，删除必填字段失败 | path |
| inc | path,value(number) | 已存在numeric值加delta；不创建、不转字符串、不钳制 | path |
| entity.upsert | path,entityId,value(object) | 注册数组按ID整行替换/新增；新增追加尾部；resources按键替换 | /collection/entities/ID 或 /runtime/resources/ID |
| entity.delete | path,entityId | 按ID删除，缺失时no-op；数组同时移除该ID顺序 | 同upsert |
| order.move | path,entityId；可选beforeId | 仅五个实体数组：移动到另一现有ID前，缺省/null表示末尾 | /collection/order，加移动实体和before实体路径 |

set/inc 必须有value；unset/delete/move 不携带value；普通操作不带entityId/beforeId。upsert 是整行替换，不是浅合并；小字段编辑用虚拟路径 set，避免同实体其他字段冲突。数组实体 value.id 必须与 entityId 相同；resource map 不额外要求 value.id。

```json
{"op":"set","path":"/abilities/str","value":16}
```
```json
{"op":"unset","path":"/biography"}
```
```json
{"op":"inc","path":"/runtime/hp","value":-5}
```
```json
{"op":"entity.upsert","path":"/quickbarActions","entityId":"action-A","value":{"id":"action-A","name":"测试攻击","attack":"1d20+3","damage":"1d6"}}
```
```json
{"op":"entity.delete","path":"/quickbarActions","entityId":"action-A"}
```
```json
{"op":"order.move","path":"/quickbarActions","entityId":"action-B","beforeId":"action-A"}
```

上述片段是独立语义示例，不是按此顺序执行的合法batch（move需要两实体仍存在）。selection 新增必须提供完整 Entry/quantity/level/equipped；见 Character schema。资源新增示例：

```json
{"op":"entity.upsert","path":"/runtime/resources","entityId":"custom-pool","value":{"current":2,"max":3,"name":"测试次数"}}
```

`inc` 只作用于已存在有限数；结果绝对值不超过 JS safe integer；属性等整数域仍由schema限制，资源current不得减为负。HP 按原模型允许负数。没有“先读取再 set”模拟 inc，没有隐式资源恢复。

order.move 的 beforeId 不能等于自己，也不能不存在。只改数组顺序，不改变实体对象；多个顺序操作保守冲突。新增/删除 touched 仅该实体：不同新ID可以自动rebase并按提交顺序追加，客户端必须按服务器提交顺序重放。move同时触及目标/锚点实体，避免删除锚点后的静默移动。

## 冲突算法

PathOverlap(a,b) 为相等，或一方是另一方的完整段前缀（加 `/` 比较）；`/profile` 与 `/profile/optional/feats` 相交，`/a` 与 `/ab` 不相交。合法指针编码是规范的，所以 `~1` 不会被当成路径分隔符。

当 base=current 直接执行；base<current 查询连续历史并展开每条操作的 touched paths。入站与历史任一重叠则冲突，**只有同一完全相等 path 的 inc/inc 可交换**。set/set 即使值相同也冲突；set/inc、delete/子字段、整个对象/子字段冲突。不同实体ID通常无冲突；同实体不同叶可并行；upsert整实体会与该实体任意子叶冲突。move 与相交实体字段采用保守冲突策略。

历史缺口或回放预算不足 → resync_required。未来 base → revision_conflict，不能提交。无冲突在当前snapshot执行，响应 rebased=true；不把base改成客户端猜测的新值。

冲突409：

```json
{
  "code":"revision_conflict","message":"overlapping concurrent operations",
  "currentRevision":2,"baseRevision":1,
  "conflicts":[{"path":"/runtime/hp","serverValue":15,"serverExists":true,"clientValue":99}]
}
```

serverExists=false 区分“字段缺失”和JSON null；clientValue 对set/upsert为提交值、inc为delta、unset/delete为null、move为{entityId,beforeId}。这是当前服务器值，不一定是最初造成冲突时的值。不要依赖message判断。

成功结果（HTTP和广播内容相同，WS另有type）：

```json
{"characterId":"40000000-0000-4000-8000-000000000001","revision":2,"baseRevision":1,"operationId":"20000000-0000-4000-8000-000000000001","clientId":"30000000-0000-4000-8000-000000000001","origin":"web","operations":[{"op":"inc","path":"/runtime/hp","value":-5}],"touchedPaths":["/runtime/hp"],"updatedAt":"2026-10-01T00:01:00Z","rebased":false}
```

origin 由服务器HTTP入口固定web，不接受客户端伪造；平台pipeline使用 adapter:<provider>:<bindingId>。外层timestamps/revision不是显式 operations，但客户端重放后必须镜像到document。
