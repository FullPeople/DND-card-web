# 盾牌熟练入口修复 · 2026-10-06

## 结果与交付边界

从远端 main `79a84b5565f571f491484d00a765d4505047df27` 创建独立分支
`codex/shield-training-reference-20261006`，修复自动熟练声明被同名装备覆盖的问题。
本次检查时没有其他盾牌入口修复分支/PR；PR10 是独立数值与证据补齐，不包含本问题的生产修复，本次没有修改它。
本修复保持 Draft，未合并、未部署、未改版本或 Data 仓库。最终提交 SHA、远端复测结果及回滚命令以该 PR 的交付回执为准。

## 已复现的根因

真实 PHB/XPHB 战士的 `startingProficiencies.armor` 均为
`light, medium, heavy, shield`；兼职字段为 `light, medium, shield`。
现有 `equipmentTraining()` 已支持 shield/Shields、大小写与中文盾牌；根因不在大小写。

旧 `Overview` 先用声明中的名称查找普通装备，于是 `shield` 命中英文名 Shield 的物品，生成
`{@item 盾牌|PHB}` 或 `{@item 盾牌|XPHB}`，而非训练类别 `itemProperty`。
训练编辑器将显示值保存为明确手工覆盖；现有计算器不会把普通物品或 Shield 法术当作类别训练。
2024 保存自动内容后因此由“有盾牌训练”变成“未声明类别训练”，AC 从 12 降到 10。
2014 盾牌的数值 +2 与训练警告分别处理，不能用 AC 仍是 12 来证明熟练入口正确。

未改 main 的真实浏览器红测试共 3 条失败：两版的引用类型错误，2024 保存后的 AC 为 10 而非 12。
原始日志、截图、trace 保留于本地 `.local-evidence/shield-training/browser-red/` 与 `red-browser.log`。

## 最小实现与玩家边界

- 自动声明先匹配已有装备训练类别，再采用现有具名装备/语言查找。盾牌输出已有中文类别引用，不增加训练规则或能力。
- `TrainingChips` 接收字段组及当前核心书；已知裸类别别名和 `itemProperty` 引用绑定
  `dnd-card.weapon-training:2014:shield` 或 `:2024:shield`。
  预览和点击读取用精确 `entry:` ID，防止通用 rule 查找再次命中同名 `itemType`。
- 存储和编辑仍使用原手工 token。大小写、来源、玩家标题、未收录说明不会因显示绑定而改写。
  明确的 `item`、`spell` 引用保留原类型；未知来源不猜测类别归属。
- 保存、拖动、移除继续使用既有显式编辑动作；不会迁移历史角色、自动补齐训练或恢复已消耗资源。
  已经错误保存成 `{@item ...}` 的历史记录不会被静默转换；玩家可在明确编辑时选择相应训练类别。
- 核心训练、装备 AC、身份归一化、已有来源限制均未改。锁定的 48 个规则运行消费者文件 SHA256 全部不变；未弱化覆盖验证门禁。

## 真实输入与公开材料

身份/字段出处沿用 Data `9acd4d5e7c5bed9cf34150db4319a7aeec6751e8` 的
`reports/g1/inputs-sha256.json`。2026-10-06 实际取得并重新计算：

| 输入 | 字节 | SHA256 |
| --- | ---: | --- |
| https://5e.kiwee.top/data/class/class-fighter.json | 170179 | da2d63f3d4eb692db32f22b081dafecbc08394f27fbaeff7a51503824aefd1e0 |
| https://5e.kiwee.top/data/items-base.json | 197272 | 9f1346c69344d66088dbdb1c26ea5872102d318ac148805a8ae9b5fedc5fc94f |

职业索引实际返回 497 字节，SHA256
`77b4e3c24ab8a0515948c258a7104f04bbe70e6a89a17714f2ee0bdfce23c2e8`，指向 class-fighter.json。
两个版本的普通盾牌分别为 `S` / `S|XPHB`、`ac: 2`，名称与版本独立。
公开夹具只有两条职业及两条盾牌的必要机械字段，共 2,422 字节；职业正文置空。
同名装备类型与 Shield 法术碰撞夹具为原创，不引用其规则正文。

`verifyShieldTrainingSources.mjs` 只获取上述两个既有输入，无目录扫描、整库下载、镜像、重试或身份改变。
字节数、SHA256、四条机械投影必须完全相符，缺失/漂移失败，不能回退夹具；失败清除旧成功回执。
本机已用改变的输入验证拒绝路径。原始上游文件只存 ignored 本地目录，CI artifact 只上传摘要及原创浏览器证据。
这些是来源身份与本问题入口的证据，不是 PHB 全文证明、完整规则覆盖或线上可用证明。

## 验证

本地最终结果：完整单元 **986 通过 / 26 条条件跳过 / 0 失败**（总 1012）；相关单元
**48 通过 / 1 条既有条件跳过**，其中新增入口测试 24 条全部执行。
跳过项不能支撑验证声明。TS、production/standalone 两类构建、`node --check`、
`git diff --check` 通过。没有独立 lint 脚本；未声称运行不存在的检查。

生产 standalone 预览 Chromium **7 通过 / 0 跳过 / 0 重试**：

1. 两版真实自动声明绑定类别，并在同名装备类型/法术存在时预览项目训练说明。
2. 两版保存、持久重载、移除、撤销、重做；2024 AC 随训练移除即时 12→10，2014 保留其数值机制。
3. 两版手工混合大小写与复数类别、来源大小写、玩家标题；完整保存角色在只读预览前后相等。
4. 明确装备/法术记录不授予盾牌类别训练；手工工具、语言、HP、已消耗资源保留。
5. 390×844 手机可见中文盾牌，原 `SHIELD` 存储文本保持不变；桌面与手机截图已实际检查。

单元还覆盖自动职业/固定特性/兼职来源增删、来源禁用、手工空/完整覆盖及导出导入。
加载边界检查通过，启动 JS gzip 合计 standalone **225,218** / production **282,500** 字节。
类别显示复用已有映射，没有新增运行数据文件，源投影/校验脚本仅用于测试与 CI，不进入产品 bundle。
构建仍有既有 chunk 体积警告；未据此宣称整站性能改善。

保留的过程诊断：首次 Node 测试发现阶段导入 catalog 的环境差异（改用 Node-safe 投影辅助，并由实际 normalizer 单测核对）；
一次把显示格式化放入锁定运行文件导致覆盖门禁拒绝（恢复原文件，移到 UI）；
两次测试脚本假设错误（桌面预览在 Wiki 正文而非 tooltip、重载保留编辑模式，手机 Wiki 需显式切换）。
这些均区分于已证实生产 bug；修正后执行上述最终生产预览，未隐藏失败或启用重试。

## 复跑与回滚

```bash
npm ci
node tools/verifyShieldTrainingSources.mjs
npm test
npm run build
npm run build:standalone
node tools/checkStartupBoundary241.mjs
npx playwright install chromium
npx playwright test --config playwright.shield-training.config.ts
git diff --check
```

已有原始输入时可用 `node tools/verifyShieldTrainingSources.mjs --verify-only`，仍执行全部锁与投影核验。
本环境 Chromium 缓存在 `/workspace/.cache/equipment-ac-browsers`，运行时设置
`PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/equipment-ac-browsers`；CI 使用标准安装。
专项工作流与既有完整 Web/自动化进度工作流均以 Draft PR 最终 SHA 复测，不包含发布步骤。

在取得 PR 交付回执中的完整修复提交 SHA 后，先确认工作树无待处理改动，执行：

```bash
git show --stat <本次修复完整SHA>
git revert --no-edit <本次修复完整SHA>
npm test
npm run build
npm run build:standalone
```

只反向本次提交，不 reset、强推或回退他人提交。未部署时无需服务器回滚。
本次提交反向补丁会用临时 Git index 核验恢复上述 main 基线树，不改真实工作树或玩家记录。
本地诊断和最终 SHA/CI/回滚验证回执位于 ignored `.local-evidence/shield-training/`。
该回执不是线上发布证据，实体手机、真实玩家存档和历史错误文本迁移不在本轮验证范围。
