# 职业专长与可选特性入口：本地候选，未发布

## PR17 独立 review 修复

[Draft PR17](https://github.com/FullPeople/DND-card-web/pull/17) 仍为 blocked Draft，不合并、不部署。本节替代下文旧的“未 push / 无 PR”和 consumer `1a1717f` 交接状态；正式 producer 必须使用 PR 的最新完整 HEAD，不能沿用第一次候选或迁移的报告。

1. **拖拽范围**：原 App 拦截所有 `optionalfeature`，无职业进度时直接返回，阻断子职 / 专长的战技等既有手动添加。有非 AI/EI 职业进度时也错误地强制学习记录。现由 `optionalFeatureLearningDrop` 只接管已有 class-owned AI/EI 学习入口；其他类别或无对应入口继续原明确添加路径，保留原来源 / 重复 / 权限校验。匹配到的 AI/EI 仍遵守不可用前置和来源限制，不用手动回退绕过该学习入口。
2. **非 ASI 专长离线**：原快照只有所选专长和授予 classFeature，首次直接选择其他专长后缺少 typed ASI 定义，离线重建会丢选择并撤去已关联效果。现同时保存实际解析出的 classFeature 与 typed ASI 引用证据；目录为空、部分缺失和导入往返继续关联同一已选专长。来源关闭或等级降低仍暂停自动关联，答案和手工数据保留；恢复后只有原本已适配效果生效。不会按名字猜授予或自动分配 ASI 属性。
3. **2014 不可重复专长**：[官方 2014 Feats 规则](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options#Feats)明确限制默认只能选一次。record-only 方案不进入 selections，原 candidateReason 漏掉其他有效 ASI 答案。现跨有效 class-feat 记录保留唯一资格，新重复选择在 mutation 前拒绝；旧重复答案不删除，后续重复记录显示当前不可用 / 不完整。显式 `repeatable: true` 与手动属性提升方案可重复；非活动授予不占用当前资格。
4. **同次 FS / EB 授予的重复入口**：这最初是组合风险，已通过保存的真实来源样本与 `syncFeatures` 复现。XPHB 战士 1 级 FS 原有 3 个入口（进度 + 两处 filter），战士 19 级 EB、圣武士 / 游侠 2 级 FS、魔契师 19 级 EB 各有 2 个。现只在来源身份、直属职业、明确 classFeatures 引用、授予等级、来源给出的组名 / 别名及类别都对应、单次授予且对应组唯一时合并为一个职业进度入口；不同来源奖励或无法明确对应的入口不按类别粗并。旧 filter 答案保持原字节，作为同一选择的保留记录读取；冲突旧答案显示超额，仅一个有效槽位。职业进度 ID 在特性后续加载前后保持稳定，清空新记录不会从旧 alias 自动补回。

针对 7 个文件已执行 **89 通过 / 0 失败 / 0 跳过**，类型检查和 `git diff --check` 通过；包含 5 个实际来源组合、独立背景 / 独立特性不被合并、直接非 ASI 的空 / 部分目录、导入、限制与恢复，以及不同职业的不可重复资格。真实样本仍是本轮独立公开来源样本，不是原 229 producer 输入。最终完整 HEAD 的全量、构建与 CI 结果记录在 PR 和 `.local-evidence/class-level-choices/`；生产浏览器与包体积仍需真实账本解锁后执行，不将列出用例称作通过。

红绿诊断：`review-regressions-red.log`、`review-overlap-red.log`、`review-targeted.json`。初次红测试中的一项旧重复离线夹具遗漏 6 级授予快照，已修正夹具；初次类型检查发现新测试的 unknown 类型标注不符合 normalizeData 参数，也已修正，最终检查通过。这两项不是产品回归证明。实际来源身份与文件散列保留于 `review-source-overlap-evidence.json`，没有把来源正文、样本或玩家数据加入仓库。

远端 main 已从 `4a95a7d` 前进到 `949dbbd0fea5dac8a51089514fe402cdeb95baf5`。本分支仍基于原 `792e9a4`，没有 merge / rebase 迁移，也没有改 Data。迁移 owner 的另轮 review 提示 App 草稿写入与验证顺序、旧 cloud-staged 重开及 cloud workflow paths 缺 App / storage / PlayerViewer / package 覆盖，见 [PR16 讨论](https://github.com/FullPeople/DND-card-web/pull/16#discussion_r4206885126)。这些由原迁移 owner 处理；本轮未把“有恢复副本”说成已发生数据丢失，也未并行重写迁移。未来整合须明确执行 migration / cloud 场景，不能只依赖 paths 自动触发，且必须对组合消费者重新 producer。

只回滚本节修复可用 `git revert <本节修复的实际提交 SHA>`；最终 SHA 见 PR。整批回滚还需按下文顺序撤去 c03c7d6 / f093b6c / 2077618，保留角色备份、手工记录和 Git 历史。

本轮以远端 Web main `792e9a490216fcf352a436a3b789b70c23092bc2` 为基线，隔离分支为 `codex/class-level-feats-infusion-invocation-20261007`。不接管 `codex/dnd-center-migration-20261007` 的迁移、公告或部署，也不覆盖另一会话的修改。上线基线仍以 251 发布回执为准；最新 main 的资源 CI 有独立失败，不能用历史候选结果宣称 main 全绿。

## 实际定位与变化

实际来源数据中，职业 `featProgression` 和 `optionalfeatureProgression` 没有进入 `sheetChoices`；正常化的可选特性是 `kind: feature`、`raw._category: optionalfeature`，接收器已经接受此类型，但拖拽路由没有切到特性页。初始六项回归为 5 失败 / 1 通过。

- `2077618`：可选特性拖拽进入特性页；已有选择工作区保留当前页面。
- `f093b6c`：从职业来源的结构化进度生成独立选择。typed 专长引用可识别可重复的 General 属性提升专长；每次职业授予独立保存，使用职业等级，不使用总等级发放。专长入口显示在“背景与专长”区域。
- 注法与祈唤保存为学习记录和显示快照，不新增可执行的角色特性、不生成魔法物品、不激活灌注效果，也不返还资源。数量显示为职业来源声明的数量；界面修改记录不代表规则许可替换。
- 来源、版本、typed ID 保持独立，分类比较容忍大小写。保存的旧版职业使用自身来源版本筛选，不随全局 2024 开关改写成新版职业。
- 旧答案、超额槽位和快照保留；来源关闭、降级或目录缺失时显示当前不可用。自动关联的专长会在失去授予条件后撤出；已选答案保留，可以随原授予恢复。原基础属性、资源及手工记录不因学习选择重新填写。
- 新增快照只保存在玩家原生卡数据中，并通过导入验证；公开仓库没有上游全文、缓存快照或玩家卡。

## 明确未完成的边界

2014 ASI 规则本身已经由官方规则核对。最初候选的缺口是来源到入口的适配，已补：显式来源矩阵中的 68 条旧版授予引用提供“属性提升（手动填写） / 可选专长”的方案记录；可选专长关闭时替代专长不可选。不会自动改属性或激活所选专长的效果。未收录的引用仍显示待核对，不能以名字猜测授予。

2024 的职业 19 级 Epic Boon 授予允许其他合格专长；其他已声明类别保持类别约束。未知的法术、契约、复杂选择前置仍禁用，显示需手动核对。重复子选项、逐级替换规则、注法激活/物品操作和 EFA 方案机制尚未自动化。

EFA 没有旧 `AI` 注法进度，因此没有从 TCE 注法表回填。新版使用魔法物品方案，与旧注法分开；[官方 EFA 说明](https://www.dndbeyond.com/posts/2106-whats-new-with-the-artificer-in-eberron-forge-of)。2024 的专长类别、前置与可重复规则见[官方基本规则](https://www.dndbeyond.com/sources/dnd/br-2024/feats)。这些链接是核对依据，不是本候选发布证明。

## 已执行的验证

本地针对选择与拖拽：5 个测试文件，45 通过 / 18 条件跳过。`npx tsc -b` 与 `git diff --check` 通过。过渡回归先复现 3 失败 / 7 通过，后修复；覆盖快照读取、导入往返、来源关闭、超额保留、独立重复授予、降级恢复、职业等级前置和未核实前置。

首次全量单测：123 文件通过、2 文件失败、1 文件跳过；1029 项通过、17 失败、32 跳过。17 项失败都来自正式覆盖绑定错误 `Runtime coverage is stale for current consumer code`。该结果不是最终提交全量通过记录。

`npm run build:standalone` 被同一个真实覆盖门禁拦截，尚未生成本候选生产包。没有绕过门禁、改写报告哈希或沿用旧清单数字。

新增生产浏览器用例与 CI 分组已经准备；Playwright 能列出 Chromium / 390×844 手机两项。**尚未实际运行**，没有最终浏览器截图、包体积或最终完整 CI 成功证明。可配置真实 Linux Edge 路径加入第三项。当前没有 push、PR、merge 或部署。

## 原缓存 producer 最小交接

需要原授权 Data 会话取得这两个 Web 提交，检出完整、干净的 consumer：

```text
c03c7d69ec02a10e2ffaec94c2f8ea5aa6d5287d
```

在授权的 Data checkout 中使用原 229 份缓存重审；不得以本轮新下载的六个入口样本代替：

```bash
node --experimental-strip-types scripts/audit_runtime_coverage.ts \
  "<clean-Web-checkout-at-current-draft-head>" "<original229-cache>" \
  reports/progress/runtime-coverage.json
```

原缓存的 index SHA-256 为 `654898faa8fd821e6dbc8dddbaa3914b287bcaef418512da6a4cfa7eca8d55f7`。缓存已在原机器恢复；当前 cloud 没有该输入，不是“全局仍缺 225 文件”。本会话没有访问原机器或重试曾被拒绝的 Data 写入。

返回真实 Data 报告提交 SHA、报告字节及 producer 诊断，随后 Web 才能绑定该提交/报告，运行 `verify:automation-runtime`、全量单测、双构建、生产浏览器和完整 CI。若期间需要 rebase 到迁移 owner 的新 main，必须重新运行真实 producer，不能复用旧 consumer 的审计。

```bash
npm run verify:automation-runtime -- --data-repository "<authorized-Data-checkout>"
npm run check
npm run build:standalone
npx playwright test --config playwright.class-choices.config.ts
```

本地完整诊断保留在 `.local-evidence/class-level-choices/`，包括初始红测试、过渡红测试、针对测试、类型检查、首次全量和构建阻断日志。git bundle 不包含缓存或玩家数据，可供原 Data 会话取得确定源码。

## 可复现回滚

角色备份包含学习记录与快照；回滚代码前保留原生备份。代码回滚不执行玩家数据清理或资源重置。

```bash
git revert c03c7d69ec02a10e2ffaec94c2f8ea5aa6d5287d
git revert f093b6c2eeedf823ff50b3a00f9c54eedd807717
git revert 2077618
```

这三条撤去本候选代码，不合并或部署任何版本。若随后产生绑定报告的提交，应先撤回绑定提交并恢复匹配基线报告，再执行代码回滚；具体 SHA 必须以实际新增提交记录为准。

## 补证：真实机制、来源矩阵与 blocked Draft

本节覆盖前面的初次本地状态。用户已明确授权推送一个 **blocked Draft PR** 供独立 review，仍未授权合并或部署。当前新增 consumer 代码提交为 `c03c7d69ec02a10e2ffaec94c2f8ea5aa6d5287d`；正式重审应检出 Draft PR 的最新完整 HEAD，以避免与本节后续文档提交混淆。

| 能力 | 已核对 / 来源识别 | 当前实现 | 未实现或不可用 |
| --- | --- | --- | --- |
| 2014 ASI / 可选专长 | 官方 ASI 替代规则已核对；矩阵列出 13 个来源职业、68 条来源授予引用，等级来自各自 classFeatures | 保存属性提升方案或允许的替代专长，不生成效果条目 | 数值分配、专长具体效果手动处理；矩阵外引用待核对 |
| 2024 ASI / 职业专长 | 矩阵列出 55 条 typed ASI 来源引用；General / repeatable / 两点属性结构识别，FS 与 EB 按声明进度 | 独立职业授予槽位；所选专长通过既有 syncChoiceContent 关联，复用已适配效果计算 | ASI raw.ability 不参与属性计算；复杂前置禁用，未知机制不补齐 |
| 旧奇械师注法 | TCE 与 EFA 保持分离；官方开局学习数 4 已核对，后续进度仅来源声明 | 记录已学注法与来源快照 | 不等同于同时激活物品数；激活、造物、替换和重复子选项未实现 |
| 2014 / 2024 祈唤 | 两个 EI 来源表分别核对；职业等级与属性条件可判定 | 保存已学记录；来源关闭 / 降级保留旧槽位 | 法术或契约等复杂前置暂禁用，例如当前 Agonizing Blast 的法术结构未适配；替换依赖、重复子选项和具体效果未实现 |
| EFA 魔法物品方案 | 官方新版使用方案，来源没有旧 AI 进度 | 保留既有来源特性显示，不从旧注法回填 | 没有方案选择、造物或激活执行入口 |

所有上述“发布版本已加载且验证可用”的状态均为待核实。`rule: verified` 只表示矩阵中已核对的规则部分，不表示整条机制、生产浏览器或发布验证通过。学习记录编辑也不代表规则允许无限替换。旧版祈唤的全局唯一性没有从 2024 规则反推；目前选择器的单 ID 槽位操作不能表达重复的不同子选择，这属于明确剩余边界。

真实路径：

- `src/core/automation/sourceClassChoices.ts`：来源进度、前置判断、各职业独立槽位；2014 `recordOnly` 使 option.grant 保持 undefined。
- `src/core/automation/classChoiceEvidence.json` 与 `classChoiceSupport.ts`：显式来源引用矩阵、数量来源和 grade；运行时不按具体职业/特性名称分支。矩阵只有元数据，没有规则全文。
- `src/core/automation/choices.ts` 的 `setSheetChoiceSlot`：保存 answers、选项快照和授予证据快照。`syncChoiceContent` 只处理有 grant 的选项。
- `src/core/engine.ts` 的 effects 循环：既有显式效果计算。raw.ability 的分配计算只在 race 路径，未把 feat ASI 改成自动加属性。
- `src/ui/ClassChoiceRecords.tsx`、`Overview.tsx`、`FeaturePanel.tsx`：专长区域入口和学习记录；`App.tsx`、`entryDragIntent.ts`、`choiceCatalog.ts`、`ChoiceWorkspace.tsx`：拖拽、来源版本匹配和槽位工作区。
- `src/core/model.ts`、`validation.ts`：私有卡快照与导入校验；公开库不包含角色数据或来源正文。

原 45 通过 / 18 跳过的原因是 `DND_AUTOMATION_CORE_DATA` 未设置：

- `class-spell-choices.test.ts` 的 17 个开局数量来源样本：wizard / cleric / druid / bard / sorcerer / warlock / paladin / ranger 各 PHB 与 XPHB，加 artificer TCE。
- `automation-choices-resources.test.ts` 的 1 个外部来源用例：fighter / cleric 的 PHB / XPHB 引用选择与回气资源。

已用独立保存的当前公开来源样本补跑全部 18 项，再加 4 个来源 grade / 2014 手动方案 / 2024 既有效果测试：**6 文件、67 通过、0 跳过**。13 份来源样本共 2,182,416 B，仅用于这些条件单测，不是原 229 审计输入。样本文件散列和日志留在 `.local-evidence/class-level-choices/`。矩阵 JSON 11,628 B / gzip 1,310 B；这不是生产 bundle 体积，生产包仍因真实覆盖门禁未生成。

## 并行改动与哈希说明

迁移 owner 的 `00aa1bf0` 已前进至 `8c9d79acc51563a48ddc289297766cde57942854`；本候选不接管 252。重叠路径为 `src/ui/App.tsx`、`.github/workflows/web.yml`、`docs/STATUS.md`。只读 merge-tree 诊断显示 App / workflow 自动合并，STATUS 内容冲突；没有改动工作树或执行分支合并。正式整合后仍需重新测试和真实重审，不能凭 merge-tree 宣称集成通过。

`f093b6c` 是第一轮代码提交，`54f680a` 只增加说明文档。比较现有账本的 49 条路径加两个新增组件路径共 51 项，二者消费者字节全部相同。**这不表示旧 Data 报告匹配新代码**：本分支旧报告绑定 `2a8f52c`；迁移配套 Data `7065e64ff2c32509e4b5a8708521a989ce43fe72` 绑定消费者 `7ad94f1`，也不能直接用于本候选。新增补证代码 c03c7d6 改变了消费者字节，必须重新 producer。

原缓存的持有位置是另一台 Windows 机器的 F: 工作目录，当前执行环境是 Linux /workspace，未挂载该目录。当前可读空间没有匹配的 229 行原缓存 index；未使用 shell、SSH 或其他方法跨机器访问。由原授权 Data 会话从本 Draft 获取确定源码是实际下一步。

原 Data producer 自动绑定 core adapter 的传递依赖和固定六个 UI 文件，尚未绑定本轮新增的记录组件、FeaturePanel、拖拽匹配与导入校验。[最小绑定补丁](CLASS-CHOICES-DATA-BINDINGS.patch)只扩展真实字节检查范围，由原 Data 会话 review 后应用；不修改既有输入哈希、报告或计数。新 core 模块与 JSON 会被 bundler metafile 识别，JSON 另显式保守绑定。原会话应使用原 229 输入完整重审，并提交真实报告后回传 Data SHA。若与 252 整合，必须再对组合源码重审。
