# 后端实施前源码审计

审计基线：工作区开始时干净；无 Go 模块、无可复用的网站用户数据库或登录服务。package.json 为 React 19 / TypeScript / Vite，idb 8；现有 relay Bearer secret 属于 Suite 会话运输，不是本站用户身份，不能直接当用户令牌。仓库未发现 FVTT 运行实现（只在评估文档中提及）。不修改 src、prototype 或前端依赖。

## 证据与结论

| 位置 | 实际行为 |
| --- | --- |
| src/core/model.ts:29 | Character schemaVersion 固定 1；id、revision、createdAt、updatedAt 已存在。2014/2024 edition 必须保留。 |
| src/core/model.ts:25 | Selection.id 是实例身份，Entry.id 是来源条目身份；物品、法术、专长、职业、状态均在 selections 数组，不存在独立 spells/feats 实体表。 |
| src/core/model.ts:40 | inventory 是呈现、顺序、金币、格子位置及同调配置；order/displayEquipment/displayAttunement 引用 Selection.id。 |
| src/core/inventory.ts:3 | 公共仓库另有 Stock/StockContainer/InventoryState，Stock.id稳定、slot表示格位；它不是Character里的inventory字段，跨容器转移协议不在本次单角色服务内。 |
| src/main.tsx:11 | 实际React入口为src/ui/App.tsx，另有PlayerViewer；只读，未替换界面或状态管理。 |
| src/core/model.ts:61 | 当前 HP 是 runtime.hp；resources 是稳定字符串键的 map，不能强改成 resources.hp.current。来源资源键不一定是 UUID。 |
| src/core/model.ts:27 | spellSettings.prepared/cantrips 使用 selection ID，空字符串是空槽；slots 按环级键保存 max/used，special 按 selection ID。 |
| src/core/model.ts:43 | hpProgression.rolls 是按职业键及等级位置排列的数组；这些 index 表示等级语义，不是实体身份。 |
| src/core/model.ts:73 | 新身份使用 crypto.randomUUID；历史 Suite 角色 ID 也可能是 suite: 前缀，不能要求旧 document.id 是 UUID。 |
| src/core/merge.ts:26 | 三方合并按对象递归，带 id 的数组按 ID 合并增删改；冲突抛 MERGE_CONFLICT；数组纯重排不是一个完整、独立的顺序同步协议。 |
| src/core/merge.ts:42 | applyProjectionPatch 区分 UI hydration 的 observed 与原始 before，避免投影回写覆盖原生内容。 |
| src/platform/document-delta.ts:1 | 旧 delta 为 {path:string[],before,after,observed,remove}，数组是整叶；不等于本次服务器 operation。 |
| src/platform/storage.ts:5 | Workspace v1 含 characters/activeId/packs/customEntries/siteSources/legacySourceProfiles；documents 存 workspace、backup、recovery:{id}，cache 保存资料 body/revision。 |
| src/platform/workbench.ts:189 | Suite save 使用 requestStatus 确认未知结果，80ms 合批，双 native/legacy delta；没有本站数据库的全局 operationId/revision 协议。 |
| src/core/export.ts:9 | 原生导出为 format=dnd-card-web/version=1/character；集合导出另有 characters。linked Owlbear 包含 dnd_card_web 原生快照。 |
| src/core/export.ts:25 | Owlbear 0.3 投影身份、属性、HP、技能、特性、装备、金币、法术位、法术准备、资源；丢失字段靠原生嵌入保留。 |
| prototype/adapter.ts:19 | 最小 Owlbear 原型只同步 token health/max/binding/scope，校验 owner/GM 和场景 generation；不是通用同步服务器。 |
| src/core/validation.ts:82 | 导入校验结构及规则计算；readCharacter 可修复坏图片和旧 false save expertise。后端不会删除图片或运行规则引擎。 |
| src/core/automation/state.ts:4 | automation.protocol 独立版本；未知协议保留且不执行。runtime.automationActions 是已保存消费回执，不是临时 UI 状态。 |

持久数据包括 Character 中的规则快照、选择、运行资源、手动修正、图片、配色和角色呈现布局。Derived（计算结果、trace/issues）、React 编辑态、焦点、拖拽、弹窗、当前页、工作区 activeId、连接状态、目录缓存、撤销栈不进入服务器 document。不能把所有呈现字段误删为临时状态。

selections、quickbarCopies、quickbarActions、adjustments、rulePacks 已有 id；runtime.resources 已有稳定 key。Entry.entries/raw/effects/choices 是来源内容，其中无身份数组按完整值替换；answers、prepared、rolls 等值数组也是完整叶，不可按下标同步。源快照内容和消耗资源保持独立，不从重新读取或订阅授予资源。

采用兼容 Character v1，不创建虚构 inventory.entities/spells 表。服务器使用虚拟实体路径访问已知 ID 数组，快照仍是原数组，前端适配无需改变既有业务模型。服务器 envelope.id 是 UUID，document.id 原样保留且不可通过 operation 修改；两者分开映射。envelope revision 是唯一网络 revision，document.revision/updatedAt 在每次提交由服务端镜像更新。创建导入保留 document.createdAt。

已有 Vitest/Playwright 覆盖核心、持久化、Suite/prototype；这些不替代新后端真实 SQLite/HTTP/WS 测试。仓库没有 backend lint/staticcheck 配置。
