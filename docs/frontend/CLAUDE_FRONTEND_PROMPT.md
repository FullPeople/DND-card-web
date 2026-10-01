# 可直接复制给 Claude Code 的实施 Prompt

你位于已经有源码的 DND Card Web 仓库。独立 Go 后端与协议文档已实现，位于 backend/；你的任务是改造现有 React 前端接入它，不是重建网站或修改后端协议迎合前端。

先遵守根/目录AGENTS.md，检查git status，保留用户已有改动。不修改Godot、参考原生应用、私有角色或上游资料。不要部署、push、创建commit，除非用户另行授权。不改厚深灰切角边框、浅灰内容、灰标题白字、固定A4五页和已批准交互层级。

先按顺序阅读：

1. docs/PRODUCT.md、docs/ACCEPTANCE.md、docs/STATUS.md。
2. docs/backend/AUDIT.md、docs/backend/ARCHITECTURE.md、backend/README.md。
3. docs/protocol/CHARACTER_SCHEMA.md、OPERATIONS.md、SYNC.md、WEBSOCKET.md。
4. docs/api/HTTP_API.md、根openapi.yaml、backend/schemas/character/v1.json、backend/schemas/protocol/operation.v1.json。
5. docs/frontend/FRONTEND_IMPLEMENTATION_GUIDE.md，这是实施时的主要交接文档，含TypeScript类型和状态机说明。

然后读取现有src/core/model.ts、validation.ts、export.ts、merge.ts；src/platform/storage.ts、document-delta.ts、workbench.ts、workbench-cache.ts、mutationQueue.ts；src/core/workbenchRevisions.ts、characterDetails.ts、inventory.ts、resources.ts、spellWorkspace.ts、automation/state.ts、automation/actions.ts；prototype/adapter.ts、protocol.ts。通过调用链定位React持久化与用户编辑入口，不凭文件名猜测。不需要读取Go内部业务实现。

已确定的契约：

- 服务器SQLite Snapshot是托管角色唯一权威；IndexedDB是cache、outbox和恢复草稿。旧本地角色不得自动覆盖服务器，上传须有明确操作；保留旧workspace/backup/recovery/资料cache。
- Character仍是v1。所有物品/法术/专长/状态实例在selections，有稳定id；inventory是配置。HP为runtime.hp。server envelope.id是API角色UUID，document.id是保留的旧身份，两者不能混用。
- document.revision/updatedAt由服务器镜像，创建后的用户修改走Operation，不PUT整卡、不发送前端自增revision。schemaVersion/createdAt/id不可用operation修改。
- 路径相对document，支持set/unset/inc/entity.upsert/entity.delete/order.move。五个带ID数组通过 `/selections/entities/<escaped-id>/quantity` 等虚拟路径寻址；Snapshot仍是数组。resources使用map键。禁止数组下标实体身份。
- prepared/cantrips空字符串是槽位，保留；其他值数组整体set。order.move只针对注册ID实体数组；inventory.order是独立显示顺序，整体set。
- operationId、clientId为UUID，baseRevision必填。成功batch新revision，落后无冲突自动rebase，真正重叠返回409；inc/inc同path可交换。
- HTTP超时不代表未提交。完整已发送body和ID不可改，原operationId重试返回原结果，日志清理后仍幂等。不能换ID再扣一次。
- WS只是运输，不是权威；HTTP与WS结果竞速。每个revision给confirmed文档只应用一次，匹配operationId收束pending。不能简单忽略同clientId消息。
- 管理员提供Bearer token；浏览器POST /api/v1/session换HttpOnly cookie，前后端同站，WS不把token放URL。角色权限owner/editor/viewer，403后停止角色发送；退出关闭WS。

分步实施：

1. 建立characterApi.ts、characterSync.ts、wsClient.ts、operationQueue.ts、indexedDbCache.ts或符合仓库现有布局的等价模块，职责按指南。先实现纯operation reducer并用协议样例测试。
2. 新建独立版本化sync store，按serverOrigin+accountId+serverCharacterId隔离，保存confirmedSnapshot/revision、完整outbox、everSent/unknown/conflict状态和旧base意图上下文。不要破坏旧IndexedDB v1存储。
3. 登录后me/list/snapshot，缓存后订阅lastRevision。保留本地独立模式入口，不无提示迁移所有卡。
4. 接入最小字段编辑：姓名set、HP inc、属性set，再扩到selection稳定ID增删改/排序、资源、法术、布局。派生计算和UI hydration不是编辑，不上传。
5. 先持久化意图再乐观显示；每卡单飞。confirmed和pending分开，失败保留恢复草稿；收到远端变化先更新confirmed再重新投影pending。编辑数量输入与增减意图必须区分set/inc。
6. 完成WS订阅/取消、回放先于subscribed、心跳、指数退避+jitter、revision gap单飞HTTP补delta、resync snapshot。未知已发请求原ID重试；从未发送的旧离线意图与新snapshot比对后再由用户确认。
7. 实现冲突UI：显示serverValue/clientValue/path，缺失与null区分；提供保留服务器/重新编辑/明确提交我的决定。新决定新ID，先读新revision；不得静默LWW。
8. 刷新把sending恢复为unknown；IDB事务保证confirmed/outbox一致。多标签页用Web Locks/BroadcastChannel或等价事务方案避免重复发送/覆盖队列；独立clientId，服务器仍做最终冲突判断。
9. 保留原生导入导出、旧备份、Suite原桥及Owlbear原型。新托管路径不再发document-delta旧三方输入；merge.ts保留人工恢复、sameValue和旧投影用途。仅当调用链与测试证明某旧函数在所有构建都无使用时才可删除；不要提前删整套merge/workbench/storage。
10. Owlbear/FVTT完整连接器不是已完成能力。当前Adapter只提供HP示例映射和统一pipeline边界，后端没有binding HTTP接口；不要凭空添加前端请求路径。需要平台对接时单独列范围，不通过直接改DB或双权威投影实现。

测试必须使用真实后端临时SQLite，不能全mock持久化和网络。启动方式：`cd backend && go run ./cmd/server`；默认127.0.0.1:8080，首次凭证在backend/data/bootstrap-credentials.json；配置同站origin，使用原创合成角色。后端不需要Redis、Docker或外部数据库。

最终验收：两浏览器/多标签独立身份，创建读取、不同路径自动rebase、同path冲突、并发inc累计正确、同operationId不重复、selection不同ID并改、order.move、删除引用清理、HTTP/WS不同到达顺序、离线编辑刷新恢复、断网未知结果重试、gap补齐、retention resync、权限拒绝/撤权、IDB失败和备份往返。运行现有受影响核心与浏览器回归，确认规则来源/2014/2024/空槽/资源余量/图片保留，五页外观不被改坏。记录实际测试及限制，不把mock测试或build通过当作真实多人完成。

遇到协议疑问先查文档/Schema/OpenAPI；不擅自更改后端字段名、错误码、幂等、revision或安全边界。确有协议缺陷时给最小复现和明确建议，等待单独后端修复。交付说明前端改了哪些文件、如何启动、已验证流程和未完成事项，不虚构平台或生产容量验收。
