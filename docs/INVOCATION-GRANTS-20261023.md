# PHB 魔能祈唤：三项职业学习授予

## 范围与来源

基线为 `06d95a35d9022f83813a863d3d9fbdb2f247b8b3`。只实现 PHB 第 110 页的诱导话术（Beguiling Influence）、魔能视界（Eldritch Sight）、幽影护甲（Armor of Shadows）。职业来源是 PHB 第 105 页的魔契师／魔能祈唤，完整 20 级学习表、来源声明、实际特性父链和当前学习答案共同限定授予。

`src/core/automation/invocationEvidence.json` 保存来源 URL、页码、冻结修订和 SHA-256。散列算法是 Node `SHA256(JSON.stringify(parsedJSON))`，不排序键、不散列格式化文件文本。三个输入分别为：

- optionalfeatures.json：`031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844`
- class/class-warlock.json：`34721a04db792923cf0a19fbab3f90616093d9f6519a7cfe6f81a9eb52e775d4`
- spells/spells-phb.json：`e1f2221020cfb5d31995c99b78dc09435c9962476ef1cef81b52399e6df0263d`

测试对冻结索引、以上输入及三项祈唤、职业、来源特性共五条记录逐一验散列。公开仓库仅提交元数据原创夹具和散列，不上传来源全文或玩家角色。

## 行为与边界

- 诱导话术沿用技能派生机制授予欺瞒和游说熟练，不叠成专精、不写手工技能开关。
- 魔能视界和幽影护甲仅在有效职业学习授予下将精确裸 innate 声明接入既有免费施法支付。直接手工导入、失去职业／父链／学习答案、一级职业以及未知裸数组仍是 `check`，不升级为免费资格。
- 侦测目标、专注、持续时间与侦测结果仍手动处理。幽影护甲只对自身且免材料；自身目标、未穿甲条件、AC 和持续时间仍手动处理，不自动建立护甲持续效果。
- 替换时机／升级替换次数仍手动核对。未适配祈唤继续只记学习记录。没有放宽等级前置中缺省职业 source 的规则。
- 禁用来源、职业／特性／条目，降低学习上限，替换、遗忘或关闭自动化，均停用并保留原授予子树、ID、手工子法术和已花次数；恢复不补充资源。关闭自动化期间再降级或移除来源声明也先保留子树，避免父特性删除导致数据丢失。
- 有效手工同源副本不会被领养或重复授予；无效父链的副本不阻止合法学习。不同导入 ID 的同源学习只激活一项。错误来源父链的历史授予被保留而不是继续生效。

## 验证与限制

基线回归先证明三条学习路径失败：技能不熟练、两项法术均无职业学习授予。手工导入保持 `check` 是负例，不是本批要“修好”的路径。复审发现的关闭自动化期间降级／删除声明问题，在内存加载器仅移除保留补丁后，两条回归均因归档不存在失败；当前候选恢复后通过。

新增单元／静态渲染矩阵共 56 项，含冻结来源回放、实际免费支付、不扣法术位、保存重开、无目录恢复、三选项降为二选项、遗忘／替换／按钮切换、自动化关闭、错误与重复身份、手工技能／法术与余额保护、只读呈现及未支持边界。

最终定向回归覆盖 19 个文件，277 项通过、5 项既有条件跳过；新增 56 项全部通过。五项跳过为 `class-choice-edit-pins.test.ts` 的两项圣武士／游侠历史去重前数据检查（缺少 `DND_CLASS_CHOICE_EDIT_PRE_DEDUP_DATA`），以及 `class-choice-legacy-identity.test.ts` 的三项圣武士／游侠／魔契师历史去重前数据检查（缺少 `DND_CLASS_CHOICE_PRE_DEDUP_DATA`）。本批冻结输入检查均实际执行，无新增跳过。`tsc -b --pretty false` 与 `git diff --check` 均成功。

浏览器文件 `tests/e2e/invocationControls.spec.ts` 已编写，两条用例经 Playwright `--list` 发现，未在此工作区执行浏览器。用例走实际 App 导入核对、职业学习拖放、主要页技能数值、重开、替换和遗忘、来源免费施法、资源不变、自身／手动 AC 边界及第二标签只读。首次发现失败于测试夹具导入浏览器专用模块，拆出纯元数据夹具后发现通过。发现测试不等于浏览器验收。

本批未跑 18,789 条全量回放，没有更新旧自动化覆盖账本，没有以旧账本认证候选，没有启动预览、推送、合并或部署。新文件由普通单元 CI 自动发现；浏览器文件需接入阶段的 `/card/` 配置与检查。

## 定向复验命令

以下命令使用本机已核对的冻结输入；`/tmp/invocation-core-sources` 中的职业夹具是冻结输入的元数据路径副本，不是新下载资料。

```sh
INVOCATION_FROZEN_DIR=/tmp/infusion-frozen-229 \
INFUSION_FROZEN_DIR=/tmp/infusion-frozen-229 \
INFUSION_SOURCE_DIR=/tmp/infusion-source-verification \
DND_AUTOMATION_CORE_DATA=/tmp/invocation-core-sources \
DND_ARMOR_FEATS=/tmp/infusion-frozen-229/verified/input-138.json \
DND_ARMOR_OPTIONALFEATURES=/tmp/infusion-frozen-229/verified/input-146.json \
DND_ARMOR_FIGHTER=/tmp/infusion-frozen-229/verified/input-124.json \
node node_modules/vitest/vitest.mjs run \
 tests/invocation-regression.test.ts tests/invocations.test.ts tests/invocation-ui.test.ts \
 tests/sourceSpellChoiceLifecycle.test.ts tests/sourceSpellMechanics217.test.ts \
 tests/class-choice-edit-pins.test.ts tests/class-choice-legacy-identity.test.ts tests/class-choice-support.test.ts \
 tests/infusion-activation.test.ts tests/infusion-controls.test.ts \
 tests/enhanced-weapon.test.ts tests/enhanced-weapon-controls.test.ts \
 tests/returning-weapon.test.ts tests/returning-weapon-controls.test.ts \
 tests/featureArmor.test.ts tests/sourceChoices232.test.ts tests/optional-feature-drag.test.ts \
 tests/import-choice-ignore.test.ts tests/automation-choices-resources.test.ts
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/playwright/cli.js test tests/e2e/invocationControls.spec.ts --list
git diff --check
```
