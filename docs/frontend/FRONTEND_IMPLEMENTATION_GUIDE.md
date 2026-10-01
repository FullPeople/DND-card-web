# 前端 Agent 接入指南

目标读者：独立 Claude Code Agent。只依赖本文及列出的协议文档即可接入，无需读取 Go 内部实现。后端已实现独立服务；**本轮未修改任何React页面、组件、样式、前端状态或package依赖**。保留现有五页角色卡与业务模型，新增同步层，而不是重建UI。

## 先读这些证据

按顺序：`docs/backend/AUDIT.md`、`docs/protocol/CHARACTER_SCHEMA.md`、`OPERATIONS.md`、`SYNC.md`、`WEBSOCKET.md`、`docs/api/HTTP_API.md`、根`openapi.yaml`、`backend/schemas/character/v1.json`、`backend/schemas/protocol/operation.v1.json`。

然后只读定位这些旧源码：

- `src/core/model.ts`：Character/Selection/Entry/uid/newCharacter；不要改真实HP路径或把inventory配置误当物品数组。
- `src/core/validation.ts`、`src/core/export.ts`：原生/枭熊导入、完整备份、坏图片和旧expertise处理。
- `src/core/merge.ts`、`src/platform/document-delta.ts`：旧三方merge/投影observed与数组叶行为。
- `src/platform/storage.ts`：workspace、backup、recovery、cache。
- `src/platform/workbench.ts`、`workbench-cache.ts`、`mutationQueue.ts`、`src/core/workbenchRevisions.ts`：旧Suite传输、回执、选择状态与缓存权限；不能把旧requestStatus当新API。
- `src/core/characterDetails.ts`、`src/core/inventory.ts`、`src/core/resources.ts`、`src/core/spellWorkspace.ts`、`src/core/automation/state.ts`、`actions.ts`：现有装备、资源、法术选择与消费语义。
- `prototype/adapter.ts`、`prototype/protocol.ts`：仅HP同步的Owlbear原型；完整Suite仍在workbench链。
- React入口及持久化调用者，通过import/call site精确定位，读取适用AGENTS，不凭文件名猜业务。

## 数据分层与迁移

旧IndexedDB数据库 `dnd-card-workspace` / `dnd-card-standalone` / `dnd-card-automation-209` 仍保留。documents中的workspace/backup/recovery:*、规则packs、自制条目、activeId与资料cache不删除。既有用户先明确选择“上传到服务器”；成功映射server id后该角色的IndexedDB成为cache/outbox，不再作为网络权威。保留本地旧版本用于导出恢复。

新增独立版本化sync store（建议新数据库，避免直接破坏旧v1 upgrade）：按accountId+serverOrigin+serverCharacterId做键，不能只用document.id。保存：confirmedSnapshot、confirmedRevision、pending完整batch、发送状态、创建时间、旧base上下文/可恢复用户意图、conflict详情、document.id映射、同步schema版本。事务地保存confirmed与outbox收束，保证刷新不会重复inc。不要缓存Bearer令牌到Character或可导出的workspace；cookie由浏览器管理。

前端临时焦点、编辑开关、拖拽、popup、当前页仍本机；Character中的palette/portrait/featureLayout/quickbarLayout仍随卡保存。Derived不上传。不要因读取snapshot再次运行“一次性发放”或用来源更新补满资源。

## 推荐模块职责（本任务没有创建这些前端文件）

| 文件 | 职责 |
| --- | --- |
| characterApi.ts | 唯一HTTP封装、cookie/Bearer、稳定错误解析、snapshot/delta/submit/permissions |
| characterSync.ts | 每卡confirmed+pending状态机、revision排序、乐观投影、冲突和resync |
| wsClient.ts | 同站认证连接、订阅表、重连退避、消息类型验证，向同步器分发 |
| operationQueue.ts | 每卡单飞、完整请求持久化、原ID重试、未知结果与失败分类 |
| indexedDbCache.ts | 原子保存confirmed/outbox、账户隔离、版本迁移、恢复与磁盘错误处理 |

## TypeScript 契约

```ts
import type { Character } from '../core/model';

export interface CharacterSnapshot {
  id: string; ownerId: string; system: 'dnd5e'; schemaVersion: 1;
  revision: number; document: Character; createdAt: string; updatedAt: string;
}
export type Operation =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'unset'; path: string }
  | { op: 'inc'; path: string; value: number }
  | { op: 'entity.upsert'; path: string; entityId: string; value: Record<string, unknown> }
  | { op: 'entity.delete'; path: string; entityId: string }
  | { op: 'order.move'; path: string; entityId: string; beforeId?: string | null };
export interface OperationBatch {
  operationId: string; clientId: string; baseRevision: number; operations: Operation[];
}
export interface OperationResult extends OperationBatch {
  characterId: string; revision: number; origin: string; touchedPaths: string[];
  updatedAt: string; rebased: boolean;
}
export interface ConflictResponse {
  code: 'revision_conflict'; message: string; currentRevision: number;
  baseRevision: number;
  conflicts?: Array<{path: string; serverValue: unknown; clientValue: unknown; serverExists: boolean}>;
}
export type ErrorCode = 'validation_error' | 'unauthorized' | 'forbidden' | 'not_found'
  | 'revision_conflict' | 'schema_mismatch' | 'resync_required' | 'duplicate_operation'
  | 'invalid_operation' | 'invalid_path' | 'payload_too_large' | 'rate_limited' | 'internal_error';
export interface ApiError {code: ErrorCode; message: string; currentRevision?: number; baseRevision?: number; conflicts?: ConflictResponse['conflicts']}
export type WebSocketMessage =
  | ({type: 'character.operations'} & OperationResult)
  | {type: 'subscribed'; characterId: string; revision: number}
  | {type: 'unsubscribed'; characterId: string}
  | ({type: 'error' | 'resync_required'; characterId?: string} & ApiError)
  | {type: 'pong'};
export interface PendingOperation {
  batch: OperationBatch;
  status: 'queued' | 'sending' | 'unknown' | 'conflict' | 'rejected';
  everSent: boolean; baseDocument: Character; error?: ApiError;
}
export interface ClientSyncState {
  serverOrigin: string; accountId: string; characterId: string; clientId: string;
  confirmed: CharacterSnapshot; pending: PendingOperation[];
  view: Character; // 由confirmed + pending派生，不当作网络权威
  phase: 'loading' | 'online' | 'offline' | 'catching-up' | 'conflict' | 'forbidden';
  buffered: Map<number, OperationResult>;
}
```

API结果中的operations是batch里的操作，不是整个document。OperationResult不含actorUserId或完整snapshot。列表metadata没有document；读取详情再得到CharacterSnapshot。

## 启动/身份

1. 配置backend base URL，管理员提供token；POST session带Bearer，credentials:'include'。开发时前后端使用相同hostname，例如localhost，DND_CORS_ORIGIN准确匹配Vite origin。
2. GET me得到accountId，打开相应账户缓存。可展示缓存并标明离线/待同步；禁止静默上传旧缓存覆盖服务器。
3. GET列表（分页），选卡GETsnapshot；原子保存为confirmed。
4. 开WS，subscribe(server id, confirmed.revision)。回放先于subscribed；处理结果后才进入online。
5. 处理旧outbox，未知结果优先原ID重试；只有已确认可发送时恢复新编辑队列。

```ts
const apiBase = 'http://localhost:8080/api/v1';
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(apiBase + path, {
    ...init, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!r.ok) throw await r.json() as ApiError;
  return r.status === 204 ? undefined as T : await r.json() as T;
}
async function login(token: string) {
  return request<{id:string;name:string}>('/session', {
    method: 'POST', headers: {Authorization: `Bearer ${token}`},
  });
}
function submit(id: string, batch: OperationBatch) {
  return request<OperationResult>(`/characters/${encodeURIComponent(id)}/operations`, {
    method: 'POST', body: JSON.stringify(batch),
  });
}
function connect() {
  const url = new URL(apiBase + '/ws');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(url); // cookie认证，URL不含token
}
```

生产封装还要处理响应非JSON、网络异常、abort和Retry-After，不能把解析失败当成“提交失败可换ID”。Abort只停止等待，不保证服务器未提交。

## 操作生成与实体身份

clientId建议每个标签页生成并保存在sessionStorage；跨刷新保持，同一账户/安装可有多个clientId。持久outbox始终保留创建时clientId，不用当前标签覆盖。operationId每个batch用crypto.randomUUID，必须先落盘再发送；禁止每次retry生成新ID。

```ts
const escapePointer = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');
const changeQuantity = (selectionId: string, quantity: number): Operation => ({
  op: 'set', path: `/selections/entities/${escapePointer(selectionId)}/quantity`, value: quantity,
});
const damage = (amount: number): Operation => ({op: 'inc', path: '/runtime/hp', value: -amount});
const spend = (resourceId: string): Operation => ({
  op: 'inc', path: `/runtime/resources/${escapePointer(resourceId)}/current`, value: -1,
});
const rename = (name: string): Operation => ({op: 'set', path: '/name', value: name});
const clearBiography: Operation = {op: 'unset', path: '/biography'};
const moveSelection = (id: string, beforeId: string | null): Operation => ({
  op: 'order.move', path: '/selections', entityId: id, beforeId,
});
```

新增selection使用完整实体upsert；更新局部字段用set；删除用entity.delete。删除实体引用的prepared/quickbar/特性布局等清理按既有业务生成同一batch，不让服务器猜测级联。多个空prepared槽位不可去重；改槽位整体set对应值数组。display/inventory.order整体set；只有注册实体数组用order.move。无ID正文数组/effects作为来源快照完整叶更新，不为嵌套正文凭空造身份。

如果需要自动diff，普通对象递归、跳过服务端metadata；注册ID数组按ID生成增删改及move，其他数组完整set。用户意图为扣除次数/伤害时明确inc，不能从所有数值diff一律猜inc：属性输入16是set，不是inc6。UI hydration、派生值与规则投影不是用户修改，不生成operation。

## 乐观UI与确认

每卡串行发送。未发送的多次输入可合成一个新batch；已发送batch的任何字段都不可再改。队列中依赖前一草稿的动作先作为意图保存，前一操作确认后根据实际confirmed构造下一batch，或保留原base交由服务器检测；不能在收到远端冲突后机械提升base。

实现一个纯 `applyCanonicalOperations(document, operations)`：复制文档；注册数组的`entities/ID`通过find(id)定位，根集合entity.upsert按ID整行替换/追加，delete同时移除行，order.move移除目标后插入before行或尾部。其他路径只走对象属性、禁止数组数字索引；set深拷贝值、unset删键、inc加数。按batch顺序执行，失败时恢复原副本。该函数同时供乐观预览与服务器重放，必须测试与协议示例一致。

关键收据处理伪实现（持久化应为单个IDB事务）：

```ts
async function receive(s: ClientSyncState, r: OperationResult) {
  if (r.characterId !== s.characterId) return;
  // 找到pending表示确认自己的意图；不能因此跳过confirmed层的重放。
  if (r.revision > s.confirmed.revision + 1) {
    s.buffered.set(r.revision, r);
    s.phase = 'catching-up';
    await catchUpFromHTTP(s); // GET delta，逐revision调用相同收据处理器
    return;
  }
  if (r.revision === s.confirmed.revision + 1) {
    const document = applyCanonicalOperations(s.confirmed.document, r.operations);
    document.revision = r.revision;
    document.updatedAt = r.updatedAt;
    s.confirmed = {...s.confirmed, document, revision:r.revision, updatedAt:r.updatedAt};
  }
  // r.revision <= confirmed是已确认重复消息/旧回执，绝不再执行inc。
  s.pending = s.pending.filter(p => p.batch.operationId !== r.operationId);
  s.view = replayPendingSafely(s.confirmed.document, s.pending);
  await cacheConfirmedAndOutboxAtomically(s);
}
```

以上 `catchUpFromHTTP`、`applyCanonicalOperations`、`replayPendingSafely`、`cacheConfirmedAndOutboxAtomically` 是待前端实现的职责占位，不是后端提供的JS库。远端操作使乐观意图无效时（例如实体被删），停止应用该意图并显示冲突，不能让receive抛异常丢掉已收到的权威revision。gap恢复只允许一个单飞任务，避免递归重复拉取；大于confirmed的buffer在补齐后按序清理。

## Reconnect / offline / refresh

- 断网仍允许在缓存上编辑，但明确显示未同步；所有意图与完整已发送batch持久化。磁盘写失败不能继续假装已保存。
- 刷新读取confirmed/outbox，sending转换为unknown；先认证/同步，再以原ID/body询问结果（POST幂等重试）。不根据本地timestamp判输赢。
- WS重连指数退避含jitter；每个订阅使用confirmedRevision，不用乐观document.revision。收到gap用HTTPdelta；收到resync_required获取snapshot并保留outbox。
- snapshot跨过自己的已提交操作后，旧成功回执只清pending，不再应用。若一个unknown请求返回resync_required，不代表可以换base再扣；需要用户核对该意图。
- offline从未发送的意图不能各自直接与新snapshot比较（会把自己前一个离线意图当成远端冲突）。实现为纯函数 `rebaseNeverSentOutbox`：working=snapshot.document，按outbox原顺序遍历；已发送/未知的batch原ID/body冻结（sending→unknown）并投影进working；从未发送的意图若priorOperationIds引用了已阻塞的前置意图，标记为依赖阻塞，不越过它发送；否则与working比较before，冲突则阻塞，否则更新authoredRevision、把priorOperationIds收窄为仍有效的前置意图并应用到working。阻塞原因是客户端本地状态 `hold`（stale/unreplayable/dependency），不伪造后端错误码。冲突展示后用户明确选择，才用新ID/新base提交新决定；替换后的新ID会写回后续未发送意图的priorOperationIds，保持依赖链。不用旧整卡PUT。
- 意图的before/authoredRevision/priorOperationIds都在写入outbox的同一事务中，以“confirmed+已有活动意图”的投影计算，前一个意图尚未落盘时的快速连续编辑也不会被误判为自冲突。
- 多标签页推荐Web Locks选每角色发送主标签，BroadcastChannel分发状态；其他标签可编辑意图但通过主标签事务化outbox。主标签退出后先恢复unknown。即使不选主标签，每标签独立clientId+operationId仍依靠服务端一致性，IDB写入需事务/CAS避免覆盖pending。canSend由false变true（取得锁，或无Web Locks时直接成为发送者）后必须显式 `resumeSending()`：重读共享记录、sending→unknown、再pump；不能依赖open()时那次已经返回的pump。
- 注销清会话、断WS、切换账户cache键；不能让另一个账户读到前一个账户的私有卡缓存。注销是fail-closed：先独立写入本机退出标记 `dnd-card:server-signed-out:<origin>`（localStorage），再删账户缓存、再DELETE /session；restore()见到该标记直接返回，不调/me也不读缓存账户；只有明确login成功才清除标记。服务器注销结果未知只提示“已停止本机自动恢复”。保存的服务器地址只是偏好，不代表允许自动恢复。
- 服务器托管角色在React工作区里只以内存 `server:<uuid>` 出现；`saveWorkspace` 内部经 `localOnlyWorkspace` 统一剔除 `server:*` 行并把activeId换成本机角色，备份同样处理。服务器角色的“资料同步副本”通过POST /characters创建为新的服务器角色并打开，原服务器角色不变。

## Conflict UI / inc

409 revision_conflict显示路径标签、当前服务器值、用户意图；serverExists=false显示“已删除”，不能显示为数值0。展示batch未提交的事实，不局部当成功。保留服务器、重新编辑、明确应用我的修改是用户决策。重新应用必须新operationId并用刚读取的revision。对于inc展示“扣5”而非“设成15”；资源不足422属于schema失败，不可静默钳为0。撤销已提交编辑也是新操作：inc可显式反向inc，set须检查当前值和原值，不能回退整个snapshot revision。

## 旧代码保留/退出策略

merge.ts的sameValue和人工恢复比较可复用，applyProjectionPatch仍供旧Suite投影；服务器托管路径不能用三方merge覆盖409。document-delta旧格式只能保留给旧workbench桥，不转换成HTTP operation直接发送；未来diff需要稳定ID增删改和显式inc意图。IndexedDB仍保存缓存、outbox、旧备份、资料源与恢复文件。

Owlbear原型未来通过连接器Adapter接入同一pipeline，不允许UI把token metadata和server snapshot同时当权威。现有prototype只映射HP；不要宣传完整FVTT/OBR双向同步完成。当前后端无external binding API，前端不要发明端点或直接写数据库；完整连接器单独实施。

禁止猜测：source identity/edition、派生资源再授予、服务器owner、operation失败即未提交、WS必先于HTTP、同clientId即不必处理、全量替换selections、用数组index识别条目、未知schema自动降级、origin伪造、同名条目合并、客户端自增网络revision。

## 前端验收

在真实后端临时SQLite上用两个独立浏览器上下文：创建/加载、不同字段rebase、同字段冲突、同HP并发inc、相同operationId重复POST、不同实体修改、order.move、离线排队/刷新/重连、WS先于HTTP、HTTP先于WS、revision gap、retention resync、权限拒绝/撤销、IDB写失败、多标签接管。备份导入导出保持旧IDs/空槽/来源/资源，不修改旧站的五页样式。运行现有相关单元与浏览器回归，不把mock全过当多人验收。
