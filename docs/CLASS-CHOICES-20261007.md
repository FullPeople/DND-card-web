# 职业专长与可选特性入口：本地候选，未发布

## 2026-10-08：PR17 与已发布 254 主线的兼容整合

只读核对 Web main `92cf89ca650e0ecef273f05b421cb1a95308ed1c`、PR17 `fd875ed`、未合并 PR20 `bff0489` 及 Data main `a59ed56d8399ecc5005e915aaadf44879c38c86f`。PR17 没有后续分支提交或接手评论，另一个开放 PR 是独立 255 云端工作；未发现重复职业选择分支。本轮只在 PR17 原分支合入已发布 main，不合入 PR20，不替其三个失败浏览器组修发布，不合并 PR17 到 main、不部署、不改权限或创建凭据。

`merge-tree --write-tree` 与实际 `merge --no-commit --no-ff` 都复现唯一内容冲突 `docs/STATUS.md`；保留两侧全部历史并加本轮说明。App 与 web workflow 自动合并后逐项核对：职业来源选择、AI/EI 限定拖拽、`pruneQuickbar`、档案身份 / 子树 / 资源 / 旧答案均保留；同序编辑和纯显示编辑专项合计 **117 通过 / 0 失败 / 0 跳过**。没有重写已有角色数据或新增能力机制。合入的包版本 0.1.44、254 公告和云端代码属于已发布主线，候选不据此冒充职业入口线上已验证。

Data PR8 确已合并，实际报告绑定 Web `09b53cf92405c67bb43511fb3869a1fcdbc02ce9`、229 输入及 49 模块；主线现有 Web 报告绑定 `7ad94f1`，均不能证明本次组合消费者。原 Windows 缓存未访问；通过已授权公开输入 URL 重新取得 **全部 229 份**，按真实 producer 的 `sha256(JSON.stringify(parsed body))` 对 Data a59 输入账本逐条验证，229 匹配、0 缺失 / 摘要不符。新组装 index SHA256 为 `1d3bd0f6af68f4511f20fd9ad2791a3de0d80ad3198bdab3708bc9b34a52e8c4`，不是旧 Windows index。原数据只存在忽略的 `.cache/pr17-inputs`，不提交源全文或私有角色资料。

在隔离 Data 只读克隆使用实际 producer，并只应用公开的最小绑定补丁到本地脚本；不写 Data 远端。补丁增加本次真实编辑流程使用的 `src/core/resourceWidgets.ts`，保留此前 `quickbar.ts` / 导入校验 / 新入口绑定。正式审计结果、实际消费者 SHA、运行模块和统计以本轮生成回执为准，不复制旧报告，不预先假定数量增加。需要原 Data 会话审阅并正式提交新报告，Web 才能锁定其真实 Data SHA；当前正式门禁继续保留。

最终冻结 HEAD 的完整单测、类型、构建、浏览器运行状态、实际本地 producer 结果和远端 CI 保存在 PR17 与 `.local-evidence/class-level-choices/oct08/`。首次 npm ci 因默认缓存 `/home/agent/.npm` 不存在失败，使用工作区明确缓存路径后成功；首次专项未能启动不是测试通过。Node fetch 没有取得源，环境标准网络配置取得 200 并完成全部摘要检查，没有权限拒绝或改身份。下节旧 HEAD / 无缓存 / 未整合文字为当时记录，不覆盖本节真实进展。

本轮合入 main 的实际 merge SHA 和回滚收据见 PR17。撤回这次主线整合使用 `git revert -m 1 <本轮实际merge-SHA>`，保留 PR17 原提交与后续 Git 历史，不 reset 或 force push；若后来有正式报告绑定，应先撤回绑定提交。回滚前保留原生卡备份，Git 回滚不迁移玩家存档。

## PR17 App 编辑末尾的 pin 保留补修

终审 `2e3bcda` 发现 App.edit 在 `syncFeatures` 后仍只保留当前 `selections` 的快捷栏 ID，导致降级档案中的 grant / 子项 / 父来源 pin 被删除。先前直接调用 `syncFeatures` 的回归没有覆盖这个实际编辑末尾。本轮替换为共享 `pruneQuickbar`：保留 active selections 与档案中实际保存的 selection / parent ID；`quickbarEntries` 仍只读 active selections，不呈现或启用档案中的能力。

明确 `removeSelection` 时同时清理被删除职业 / 父来源的档案树和引用；明确删除停用的手工子项只清理该子树，保留其余 grant。取消 pin 不删除档案，升回也不会自动补 pin。普通失效 ID 仍被过滤。没有修改其他编辑流程、仪表板保存、迁移或云端同步。

新增用例执行 App 相同顺序的初始化、导入施法信息、记住法术消耗、修改、装备核对、特性 / 法术 / 资源同步、新资源布局和最后的共享过滤。使用实际旧代码生成的原创完整树，覆盖父项、两层自动子项和手工子项 pin；实际 XPHB 圣武士 / 游侠旧 filter grant 验证 **2→1→2**。后两张卡的子项及 3 次资源为原创软件验收数据，不能据此宣称真实 FS 有该资源规则；它们连同既有资源布局由实际 `1a1717f` 的旧同步函数生成，降级后不生效，恢复后仍为 1/3。

红测试 **4 失败**；补修首次 **14 通过 / 2 失败 / 3 条件跳过**，两失败是旧生成器没有初始化资源布局，恢复时 App 正常初始化导致断言不符。已用旧版 `ensureResourceWidget` 初始化夹具并保留旧输出和失败日志，没有改生产布局机制或删布局保持断言。最终针对 **9 文件 110 通过 / 0 失败 / 0 跳过**，类型检查通过；新 producer **3 通过**。包含真删除职业、删除停用手工子项、取消停用 grant 的 pin 与普通失效引用清理。

最终推送完整 HEAD、完整单测、构建、远端和 CI 收据见 PR17 与 `.local-evidence/class-level-choices/edit-pins-handoff.json`；下节 1068 等属于 `2e3bcda` 的历史头，不能当本次最终结果。浏览器生产 QA 和截图仍未执行，正式覆盖门禁未解除。原 Data 会话须对新的最新完整 HEAD 重审，绑定补丁新增 `src/core/quickbar.ts`，不只绑定 App。main 只读最新观察 `b398530268701c4c0364d0e4e5b03aa92c4d24c7`，不合并 / rebase 或部署；并行 owner 的其他改动保持原归属。

重跑新旧生成器后，针对 9 文件额外设置 `DND_CLASS_CHOICE_EDIT_PRE_DEDUP_DATA=<private-old-card-directory>`，其余两项数据环境与下节相同；完整单测仍不设置这些局部来源目录。本轮实际源夹具放在忽略的 `pre-dedup-edit-real/`，之前未初始化布局的输出保留在 `pre-dedup-edit-real-first/`，没有公开来源全文。两个实际来源用例缺该目录时明确条件跳过。

本轮代码和记录的实际提交、精确 `git revert` 顺序见 PR17 和上述交接收据。回滚前保留原生卡备份；代码回滚不迁移玩家存档。此前 `2e3bcda` / `bce848c` 的回滚只覆盖上轮，不覆盖本次 App 末尾过滤补修。

## PR17 旧授予身份与子树保留补修

独立 review 发现 `8412e80` 去重只保留旧 filter 答案，实际旧授予却被删除并改建成新 ID，手工子项、嵌套选择与按原授予路径保存的引用会随旧树消失。补修代码提交为 `bce848c8781fa215c45c703c1470d4a5f7b539f5`。本节补足下节“保留答案即可恢复”的不足；正式 Data producer 必须检出 PR17 **最新完整 HEAD**，不能沿用 `8412e80` 或后续文档提交前的代码头。

- 对严格对应同次职业授予的旧 filter，持久化 canonical 答案副本，同时保留每个旧答案、原 selection ID、grantKey 和父项；只更新授予的 requirementId，不重新发放能力。
- 来源特性自动移除前，将失去条件的职业专长完整子树保存到原生卡的 `classChoiceArchive`，包括自动 / 手工后代与父来源快照。档案不在 `selections` 中，不能参与熟练、效果或资源授予；快捷栏、布局、嵌套答案和资源引用保留。
- 只有原职业、明确来源引用、合法职业等级、启用的来源与未 dismiss 的原特性允许时，才恢复原身份和子树。资源消耗不重置。未能恢复的档案不会被新 ID 替代，也不显示选择完成；历史重复授予保留在档案中，只有一个有效效果。
- 清空新答案不会从旧 alias 补回。导入验证检查身份唯一性、完整子树关联、来源快照及总数量，失败不改输入。没有读取 / 修改真实玩家卡，没有提交上游正文或原 229 缓存。

原创旧卡由实际 `1a1717f84d9774f34194b9e57a45c247980cfba2` 的 `syncFeatures` / `setSheetChoiceSlot` / `syncChoiceContent` 生成，含真实旧 filter grant、技能选择、两层子项、手工挂接、快捷栏和 1/3 剩余资源。补修前该卡三项回归均失败。另以本地实际 XPHB 圣武士 / 游侠 / 魔契师公開来源样本在同一旧代码生成无子项旧 grant，验证 **2→1→2、2→1→2、19→18→19**，不使用非法等级 0。来源正文仅存忽略的证据目录；公开夹具完全原创。重复历史 grant 用例是额外原创回归，不冒充旧 producer 输出。

8 个针对文件 **104 通过 / 0 失败 / 0 跳过**，旧代码生成器复跑 **4 通过**，类型检查和 `git diff --check` 通过。完整单测 **1068 通过 / 17 失败 / 40 条件跳过**；17 项仍全部是正式 runtime coverage 对新消费者失效（公告 15、来源快照 2）。`build:standalone` 的 TS 阶段通过，Vite 在 0 个模块处被真实门禁拦截。最终推送 HEAD 的复测、远端与 CI 收据留在 `.local-evidence/class-level-choices/legacy-*.json/log`；没有生产包、浏览器 QA、截图或最终 bundle 体积证明。

保留尝试包括最初三项身份回归失败、来源特性 pin 保留回归失败、旧整张 answers 相等断言改成旧 key 保留加 canonical 持久化，以及 JSON 固定键索引的类型错误。一次针对命令误带公告测试，再遇既有 15 项门禁失败，记录为 `legacy-targeted-with-stale-gate.*`。104 项命令只含指定 8 文件；完整命令不设置只含职业样本的 `DND_AUTOMATION_CORE_DATA`，避免把样本当完整 corpus。

可重复生成旧卡（Node 22；自选目录，不含玩家数据）：

```bash
git worktree add --detach /tmp/class-choice-old 1a1717f84d9774f34194b9e57a45c247980cfba2
mkdir -p /tmp/class-choice-old/tests/fixtures
cp tests/fixtures/preDedupClassChoice.producer.ts /tmp/class-choice-old/tests/fixtures/preDedupClassChoice.test.ts
cp tests/fixtures/preDedupRealClass.producer.ts /tmp/class-choice-old/tests/fixtures/preDedupRealClass.test.ts
cd /tmp/class-choice-old
npm ci
DND_CLASS_CHOICE_FIXTURE_OUTPUT=/tmp/authored-old-card.json \
  npx vitest run tests/fixtures/preDedupClassChoice.test.ts
# 已取得实际公开职业样本时，输出到忽略的私有证据目录：
DND_AUTOMATION_CORE_DATA=<private-source-directory> \
  DND_CLASS_CHOICE_PRE_DEDUP_OUTPUT=<private-old-card-directory> \
  npx vitest run tests/fixtures/preDedupRealClass.test.ts
```

生成器强制校验 Git HEAD 等于旧提交，UUID 在重跑时改变，结构、旧授予关系与剩余资源由断言核对。新候选针对 8 文件时同时设置 `DND_AUTOMATION_CORE_DATA=<private-source-directory>` 和 `DND_CLASS_CHOICE_PRE_DEDUP_DATA=<private-old-card-directory>`；缺实际来源时三项真实旧卡回归明确条件跳过。

最新只读远端 main 为 `6ea7d790f35ac9af2cf06eaf20115dc28a7d8dba`。原迁移 owner 的 PR18、另一并行分支 `beac665` 的仪表板 / cloud review 成果不在本候选中。App 验证顺序、cloud-staged、Safari / 备份 / workflow paths 等由原 owner 处理，不把提案文档说成已修复。未来组合后须重新 producer，并明确运行迁移 / cloud 场景；本轮没有 merge / rebase、Data 更新或部署。

只撤回本次兼容性补修，先备份原生卡，再按实际提交保留 Git 历史：

```bash
git revert bce848c8781fa215c45c703c1470d4a5f7b539f5
```

另撤本次记录时可先 revert 随后的文档提交（实际 SHA 见 PR）；整批继续按下節与旧回滚记录逆序撤回。Git revert 只恢复代码，不迁移玩家存档：旧版本不会恢复新档案中的停用子树，须保留补修版完整 JSON 和变更前备份，恢复玩家记录使用对应备份，不删档案或重发资源。

## PR17 独立 review 修复

[Draft PR17](https://github.com/FullPeople/DND-card-web/pull/17) 仍为 blocked Draft，不合并、不部署。本节替代下文旧的“未 push / 无 PR”和 consumer `1a1717f` 交接状态；正式 producer 必须使用 PR 的最新完整 HEAD，不能沿用第一次候选或迁移的报告。

1. **拖拽范围**：原 App 拦截所有 `optionalfeature`，无职业进度时直接返回，阻断子职 / 专长的战技等既有手动添加。有非 AI/EI 职业进度时也错误地强制学习记录。现由 `optionalFeatureLearningDrop` 只接管已有 class-owned AI/EI 学习入口；其他类别或无对应入口继续原明确添加路径，保留原来源 / 重复 / 权限校验。匹配到的 AI/EI 仍遵守不可用前置和来源限制，不用手动回退绕过该学习入口。
2. **非 ASI 专长离线**：原快照只有所选专长和授予 classFeature，首次直接选择其他专长后缺少 typed ASI 定义，离线重建会丢选择并撤去已关联效果。现同时保存实际解析出的 classFeature 与 typed ASI 引用证据；目录为空、部分缺失和导入往返继续关联同一已选专长。来源关闭或等级降低仍暂停自动关联，答案和手工数据保留；恢复后只有原本已适配效果生效。不会按名字猜授予或自动分配 ASI 属性。
3. **2014 不可重复专长**：[官方 2014 Feats 规则](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options#Feats)明确限制默认只能选一次。record-only 方案不进入 selections，原 candidateReason 漏掉其他有效 ASI 答案。现跨有效 class-feat 记录保留唯一资格，新重复选择在 mutation 前拒绝；旧重复答案不删除，后续重复记录显示当前不可用 / 不完整。显式 `repeatable: true` 与手动属性提升方案可重复；非活动授予不占用当前资格。
4. **同次 FS / EB 授予的重复入口**：这最初是组合风险，已通过保存的真实来源样本与 `syncFeatures` 复现。XPHB 战士 1 级 FS 原有 3 个入口（进度 + 两处 filter），战士 19 级 EB、圣武士 / 游侠 2 级 FS、魔契师 19 级 EB 各有 2 个。现只在来源身份、直属职业、明确 classFeatures 引用、授予等级、来源给出的组名 / 别名及类别都对应、单次授予且对应组唯一时合并为一个职业进度入口；不同来源奖励或无法明确对应的入口不按类别粗并。旧 filter 答案保持原字节，作为同一选择的保留记录读取；冲突旧答案显示超额，仅一个有效槽位。职业进度 ID 在特性后续加载前后保持稳定，清空新记录不会从旧 alias 自动补回。

针对 7 个文件已执行 **89 通过 / 0 失败 / 0 跳过**，类型检查和 `git diff --check` 通过；包含 5 个实际来源组合、独立背景 / 独立特性不被合并、直接非 ASI 的空 / 部分目录、导入、限制与恢复，以及不同职业的不可重复资格。真实样本仍是本轮独立公开来源样本，不是原 229 producer 输入。最终完整 HEAD 的全量、构建与 CI 结果记录在 PR 和 `.local-evidence/class-level-choices/`；生产浏览器与包体积仍需真实账本解锁后执行，不将列出用例称作通过。

红绿诊断：`review-regressions-red.log`、`review-overlap-red.log`、`review-targeted.json`。初次红测试中的一项旧重复离线夹具遗漏 6 级授予快照，已修正夹具；初次类型检查发现新测试的 unknown 类型标注不符合 normalizeData 参数，也已修正，最终检查通过。这两项不是产品回归证明。实际来源身份与文件散列保留于 `review-source-overlap-evidence.json`，没有把来源正文、样本或玩家数据加入仓库。

最终检查还发现 Node 22 的浏览器用例发现无法读取无 import attribute 的来源矩阵 JSON，已补显式 `with {type:'json'}`，不改变矩阵或机制。第一次全量命令误设只含职业文件的 `DND_AUTOMATION_CORE_DATA`，额外激活需要全库的 corpus 测试并失败；该目录只用于针对职业测试，全量恢复不带此环境变量。两次尝试各自保留日志，不用补规则全文、伪造完整缓存或把失败说成通过。

新源码的真实 fingerprint `594070f45a41cccad8b9d0683e1fb3eb8d4497bcd148cc1d5dd9c0e94ec14561` 恰好以 `4561` 结尾，使旧公告测试对整个 JSON 的裸数字扫描误判为缺证据时泄露历史数量。诊断确认 audit.counts 仍为 null；测试改为先检查缺证据时 audit / snapshot / runtime / 来源计数及所有禁止字段，再对排除两项不透明哈希的玩家内容扫描历史数字。另补合法哈希包含 18789 / 4561 的回归。没有更改 fingerprint 算法、报告哈希或生产门禁。

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
