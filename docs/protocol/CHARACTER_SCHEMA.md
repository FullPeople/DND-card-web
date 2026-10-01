# Character v1

真源：`backend/schemas/character/v1.json`。完整原创可发送示例：`backend/examples/character.json`。此后端保留仓库真实 `src/core/model.ts` 的 Character v1，不发明独立 inventory/spells/feats SQL 模型。

Snapshot envelope：

```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "ownerId": "50000000-0000-4000-8000-000000000001",
  "system": "dnd5e",
  "schemaVersion": 1,
  "revision": 1,
  "document": {
    "schemaVersion": 1,
    "id": "10000000-0000-4000-8000-000000000001",
    "revision": 1,
    "name": "协议测试角色",
    "player": "",
    "edition": "2024",
    "createdAt": "2026-10-01T00:00:00Z",
    "updatedAt": "2026-10-01T00:00:00Z",
    "abilities": {"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10},
    "baseHp": 20,
    "identity": {"gender":"","alignment":"","age":"","description":""},
    "selections": [], "answers": {}, "reviewed": [], "notes": "",
    "profile": {"enabledSources":[],"optional":{"feats":true,"multiclass":false,"legacy":false},"exceptions":{}},
    "runtime": {"hp":20,"tempHp":0,"inspiration":0,"resources":{}}
  },
  "createdAt": "2026-10-01T00:00:00Z",
  "updatedAt": "2026-10-01T00:00:00Z"
}
```

外层 id 是服务器聚合 UUID；document.id 是保留的旧身份，可以是 `suite:...`。不要互换。外层 createdAt 是上传创建时间，document.createdAt 保留原创建时间。document.revision/updatedAt 在提交后由服务器镜像为权威 revision/updatedAt；客户端不能提交这些 metadata 路径。ownerId/system 只属于 envelope，不能放入操作寻址根。所有 delta path 相对于 document，无 `/document` 前缀。

## 字段所有权与主要结构

| 字段 | 结构/含义 |
| --- | --- |
| edition | 2014 或2024，不按中文名字合并 |
| abilities / baseHp | 六属性1–100整数；基础生命上限非负数 |
| identity / biography / notes | 用户角色资料、背景、笔记 |
| selections | Selection[]；实例 id + Entry 来源快照、quantity、level、equipped、attuned、parentId、grantKey 等 |
| Entry | id/kind/name/english/source/edition/packId/revision/entries/raw；可以包含 effects/choices/dependencies |
| profile | enabledSources/optional/exceptions，加 disabledEntries、历史 sourceConflicts、autoSourceDefaults；禁用来源不删选择 |
| answers / reviewed / backgroundChoices | 用户回答、核对标记、背景属性与装备选择，保持来源键 |
| inventory | order/displayEquipment/displayAttunement 引用 selection ID；positions 格子位置；view、coins、grantedCoins、capacityAdjustment、attunementLimit |
| spellSettings | mode/ability/capacity/attackBonus/dcBonus/prepared/slots；cantrips、special、来源容量修正和赠送关系 |
| runtime | hp/tempHp/inspiration/resources/deathSaves/sourceSpellSpent/automationActions；全部是持久运行值 |
| runtime.resources | Record<string,{current,max,...}>；键可为 UUID 或来源/类型键；current/max非负，不默认要求current<=max |
| hpProgression | mode + rolls[职业ID] 按等级位置的数组，null表示尚未记录 |
| quickbar / quickbarLayout | 引用和用户呈现布局，不是全局浏览器偏好 |
| quickbarCopies / quickbarActions / adjustments | 带 id 的副本、自定义动作和手动修正实体 |
| featureLayout / dismissedFeatures | 顺序、展开、手动移除记录，不能刷新后擅自恢复 |
| proficiencies / expertise / training / size / sheetBonuses / skillBonuses | 手动熟练、训练、体型、调整 |
| portrait / illustration / palette | 用户保存的头像、独立立绘和卡面配色，含 data URL，持久化 |
| rulePacks / automation / externalSnapshot | 私有规则快照、版本化自动化意图、未映射平台原始数据，保留而不在后端执行 |

服务器检验结构与核心数值约束，不移植 TS evaluate 规则引擎，不声称验证 D&D 规则合法性。现有公式、来源文本、未知 automation protocol 保留；未知规则必须由前端保持可见。schema 的部分对象允许额外属性以避免丢失扩展数据，但未知顶层字段不能通过正常 operation 寻址。禁止 `__proto__`、`prototype`、`constructor` 对象键，限制深度/节点/字节。部分 TS 更细的规则关联校验仍由前端导入预检负责，后端不会自动修复赠送关系或发放资源。

## 稳定身份与顺序

实体数组保持原 JSON 格式，协议使用虚拟路径，不实际把 document 转成 entities/order：

| Snapshot | 操作路径 |
| --- | --- |
| selections[].id = A | /selections/entities/A/quantity |
| quickbarCopies[].id = A | /quickbarCopies/entities/A/entry/name |
| quickbarActions[].id = A | /quickbarActions/entities/A/name |
| adjustments[].id = A | /adjustments/entities/A/value |
| rulePacks[].id = A | /rulePacks/entities/A/name |
| runtime.resources[A] | /runtime/resources/A/current |

注册的数组集合仅以上五种。entity.upsert/delete 对集合路径操作；order.move 改实体数组顺序。ID 不要求改为 UUID，旧 ID 原样保留；新前端实体推荐 crypto.randomUUID。重复/空 ID 拒绝，不通过 index 猜测目标。数组成员 id 不能用 set 修改。

其余数组是原子叶：prepared/cantrips 允许多个空字符串表示槽位，非空 ID 不重复；hpProgression.rolls 的下标是等级语义；answers/order/displayEquipment/Entry.entries/effects/choices 等整体 set，并按整条路径检测冲突。不得逐数组下标写入。显示 inventory.order 和 selections 本体顺序是不同含义，调整背包显示顺序应 set `/inventory/order`，不是 order.move selections。

## 迁移

当前只有 Character v1。集中 `Validator.Migrate` 接受原生 document，亦可解包原生单卡 `format=dnd-card-web` 的 character；规范 HTTP 请求仍推荐先解包后放 document。唯一旧格式修复是移除 `expertise["save:<ability>"] === false` 的已知无效空标记；不丢图片、不修改规则、不补次数。该迁移确定性、幂等，并有测试。不存在臆造的 v0/v2 兼容；未知 schemaVersion 返回 schema_mismatch。未来版本只能在集中迁移层增加显式步骤及 fixtures，不在 handler 中偷偷兼容。

Owlbear 0.3 非原生 JSON 先走原有 importOwlbear，再验证原生 v1；含 dnd_card_web 的导出优先读原生嵌入。批量导入仍应先全批验证，但当前 HTTP 是逐卡创建，不提供跨卡原子事务。创建请求不幂等，超时后先查询并核对，不盲目重放创建。
