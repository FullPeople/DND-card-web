以下完整重发正式原报告，保留当时的 CI 快照。随后第二轮 CI 全绿的补充仍然有效，不改变本报告“不通过”的技术结论。本次未调用工具或修改文件。

---

**G5 独立只读审计报告 · 2026-10-03**

**结论：不通过。** 已确认 **2 项 P1、2 项 P2 技术问题**，其中两条资源路径违反“不经休息、刷新或升降级不得补资源”的硬性要求。第二轮 CI 尚缺完整终态证据，属于独立的证据缺口；即使全部转绿，也不能消除已复现的技术问题。未发现 P0。

本报告不把 G6 尚未开展、生产核心条目仍待注释本身认定为 G5 实现缺陷，也不宣称 G6/G7/G8 或整项任务完成。

**审计范围与方式**

- Web：`/workspace/dnd-automation-web`，分支 `codex/automation-ir-20261003`，冻结 **`29c2f23c3b0a315f871912166c7836b82f4b758b`**，相对基线 `112e3d0`。
- 独立数据仓：`/workspace/dnd5e-automation-data`，冻结 **`5f24e49380777d189fc4aefda712c780ac9bbc0f`**。
- 原始数据：数据仓 `.cache/upstream/kiwee`；等价性 oracle：`/workspace/DND-card-web`，HEAD **`80c94e082fcbf11be10893622b03d4220bff4d60`**，未修改。
- 追加审阅未跟踪草稿 `docs/AUTOMATION-IR-G5-RESULT.md`，只核对证据口径，不把它当作冻结提交内容。
- 本审计未修改文件、未委派实现、未推送，未运行浏览器或构建。聚焦测试关闭缓存；反例通过内存打包执行，不生成文件。
- `2bc2edd → 29c2f23` 仅修改测试作者边界、CI 类型检查选项和文档，应用 runtime 未变。四项技术问题均在最终冻结对象再次复现。

**一、附录 I 八项结论**

| 项目 | 结论 | 审计结果 |
|---|---|---|
| 1. 按职业／特性／物品名称执行分支 | 通过 | 未发现运行时按具体名称选择规则实现。名称适配位于数据派生或测试作者边界；`artificer` 是声明的施法进度枚举，不是职业名称判断。 |
| 2. 纯求值、消费债务、刷新／重载／禁用／升降级、`featureGrant.spent` | **不通过** | 求值纯函数检查通过；生命周期存在 F1、F2 两条补资源路径。另有 F3 熟练加值执行错误。 |
| 3. 协议／覆盖层正文、CJK、超过 15 词引用 | 通过，限已审产物 | 发布机制产物未检出 CJK、正文容器字段或超长引用；最大引用为 2 词。测试自创正文、忽略的原始输入不计作发布机制正文。 |
| 4. 既有测试断言、skip、timeout、retry | 通过，按已授权契约 | 实际断言变更逐处列于下文；未发现修改既有 skip 条件、超时或重试以通过。新增测试的显式超时另列。 |
| 5. 2014／2024 身份隔离 | 通过 | 规范身份包含来源、父级及版本约束；预审 TCE 版本绑定问题已有回归。允许角色持有兼容旧版条目不等于合并身份。F2 是同一身份的资源账本不稳定问题。 |
| 6. 导出 0.3／standalone audit | **不通过** | 单机审计为 `true / []`；0.3 标签未变，但 F4 显示 IR 已接线字段仍从 raw 导出，导致法术遗漏及数值不一致。 |
| 7. 原始通过／跳过／失败统计 | 有条件通过 | 已核对本地日志、第一轮全部 18 个 job、第二轮已完成部分。第二轮未取得全部终态，不得宣称完整 CI 通过。 |
| 8. §2.3 九条 DoD | **整体未达底线** | 逐条证据见第五部分。G6/G7/G8 未完成与本次 G5 技术发现分开记录。 |

**二、确认的技术发现**

**F1 · P1：显式资料同步副本截断溢出消费债务，之后升级补资源**

位置：

- [src/core/classMigration.ts:83](/workspace/dnd-automation-web/src/core/classMigration.ts:83)
- [src/core/resources.ts:42](/workspace/dnd-automation-web/src/core/resources.ts:42)
- 同类调用还见 [src/core/cardMigration.ts:159](/workspace/dnd-automation-web/src/core/cardMigration.ts:159)、[src/core/batchCardMigration.ts:130](/workspace/dnd-automation-web/src/core/batchCardMigration.ts:130)。

`planClassMigration` 在同步资源之后，用当前可用次数调用 `setResource`。后者把 `featureGrant.spent`、`automaticSpent` 重算成 `max-current`，丢失超过当前低上限的消费债务。

已执行路径：5 级耗尽特性 5 次及一环位 4 次 → 降到 1 级 → 显式同步同身份、不同 revision 的职业副本 → JSON 保存重载 → 升回 5 级。全程无休息，角色校验通过，原卡未变。

| 阶段 | 特性资源：上限／当前／spent | 一环位：上限／当前／automaticSpent |
|---|---|---|
| 降级后原卡 | `1 / 0 / 5` | `2 / 0 / 4` |
| 同步副本 | `1 / 0 / 1` | `2 / 0 / 2` |
| 重载、升回 5 级 | **`5 / 4 / 1`** | **`4 / 2 / 2`** |

影响：显式同步副本成为恢复次数的渠道，违反计划 §3.1、G5 资源门槛。`cardMigration`、`batchCardMigration` 的同类调用为静态确认；本次动态反例直接覆盖 `planClassMigration`。

复现命令：末尾只读脚本，查看 `F1` 输出。

**F2 · P1：资源键依赖 raw 子职显示短名，同一规范身份换键后重新授予次数**

位置：

- [src/core/automation/featureResources.ts:33](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:33)
- [src/core/automation/featureResources.ts:50](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:50)

资源身份包含 `raw.subclassShortName`。目录翻译或显示标签变更，即使 `entry.id` 和 `automation.identity.key` 完全相同，也能改变资源键；新键查不到旧归档时按 `spent=0` 初始化。

已执行真实生命周期路径：3 级自动授予子职特性 → 耗尽 2 次 → 降到 1 级移除特性、归档债务 → 目录只修改 raw 显示短名 → JSON 重载 → 升回 3 级重新同步特性。

实际结果：

```text
sameCanonicalIdentity=true
sameEntryId=true
keyChanged=true
oldArchive={max:2,current:0,spent:2}
newBalance={max:2,current:2,spent:0}
```

影响：稳定 IR 身份未能稳定绑定消费账本，翻译变更叠加正常降升级即可补满资源。代码附近“资源身份完全来自 IR”的注释也与实际实现不符。

复现命令：末尾只读脚本，查看 `F2` 输出。

**F3 · P2：熟练加值绕过不支持的叠加组限制，并忽略 modifier 优先级**

位置：

- [src/core/automation/ir.ts:72](/workspace/dnd-automation-web/src/core/automation/ir.ts:72)
- 对照 [src/core/automation/ir.ts:79](/workspace/dnd-automation-web/src/core/automation/ir.ts:79)、[src/core/automation/ir.ts:84](/workspace/dnd-automation-web/src/core/automation/ir.ts:84)
- 能力声明：[src/core/automation/capabilities.ts:11](/workspace/dnd-automation-web/src/core/automation/capabilities.ts:11)

熟练加值单独循环计算，没有使用拒绝 `stackGroup` 的取值路径，也没有按 `irModifierOrder` 排序。

两个通过角色校验的反例：

1. `proficiency/add/99` 带 `stackGroup:'exclusive'`，客户端提示“尚未自动处理同组效果叠加”，实际熟练加值却为 **101**。
2. 数组依次为 `add 2, priority 20`、`set 3, priority 10`，实际结果 **3**；按已实现的优先级契约，应先 set 再 add，结果 **5**。

影响：显示“不支持”但仍执行；数组顺序替代声明的优先级，进一步影响使用 `@prof` 的公式。反例中求值未修改角色对象，因此这是执行语义问题，不是纯函数问题。

复现命令：末尾只读脚本，查看 `F3` 输出。

**F4 · P2：0.3 导出仍读取 raw，遗漏合法 IR 法术并输出不一致数值**

位置：

- [src/core/export.ts:22](/workspace/dnd-automation-web/src/core/export.ts:22)：法术环级读取 `raw.level`。
- [src/core/export.ts:29](/workspace/dnd-automation-web/src/core/export.ts:29)：生命骰面数读取 `raw.hd.faces`。
- [src/core/export.ts:34](/workspace/dnd-automation-web/src/core/export.ts:34)：单件重量读取 `raw.weight`。
- [src/core/export.ts:35](/workspace/dnd-automation-web/src/core/export.ts:35)：按上述错误环级分配导出法术数组。

合法 IR 声明职业 `hitDie=8`、法术 `level=3`、物品 `weight=7`，相应 raw 字段为空时：

```text
schema="0.3"
derived.hitDice="1d8"
export.hit_dice.die_size=null
export.inventory.items[0].weight=0
export.inventory.total_weight=7
cantrips_known=[]
prepared=[]
always_known=[]
```

影响：界面／求值已采用 IR，交换投影仍采用 raw，造成语义不兼容。保留 `schema_version:'0.3'` 不能证明 0.3 导出正确；原生备份保留完整角色也不能替代此检查。

该文件虽不是此次直接改动文件，仍是执行器数据所有权迁移后的消费端遗漏。

复现命令：末尾只读脚本，查看 `F4` 输出。

**F5 · P3，非阻断：提交差异仍有尾随空白**

位置：[docs/AUTOMATION-EXECUTION-PLAN.md:299](/workspace/dnd-automation-web/docs/AUTOMATION-EXECUTION-PLAN.md:299)。

```bash
git -C /workspace/dnd-automation-web diff --check 112e3d0 29c2f23
```

实际退出码 `2`，报告该行 trailing whitespace。此项不影响上述技术结论。

预审文档中的五项修复已审阅，相关聚焦回归通过。F1、F2 是不同生命周期路径，不能以此前 pact pool／共享池债务修复代替验证。

**三、测试差异及 fixture authoring 契约**

审阅方式：比较 `112e3d0 → 29c2f23` 的测试和配置差异，使用 TypeScript AST 提取断言及测试控制调用，并人工复核夹具、操作序列和语义变化。以下行号为最终冻结版本。

| 文件位置 | 实际断言变化／审查结论 |
|---|---|
| `tests/automation-choices-resources.test.ts:64` | 两处泛化自创金币预期 `700→7000`。这是已声明的纠正契约变更；真实牧师 `700 CP` 的 SHA 绑定纠正测试仍在数据仓，不能概括为所有数字完全未改。 |
| 同文件 `:67` | `_equipmentRef` 从存在改为不存在；增加缺引用整包拒绝、原卡精确不变断言。 |
| `tests/automation-defaults.test.ts:9` | 增加协议 2 初始化不改写、直接启用拒绝及原对象不变检查；新卡夹具改协议 3。 |
| `tests/book-rituals232.test.ts:96` | 增加两处正文改变不影响仪式资格的断言；既有资格及负例保留，夹具改为明确声明／撤销 IR。 |
| `tests/e2e/automation209.spec.ts:68` | IndexedDB 预期改为实际已有的隔离开发库名；不涉及生产库迁移。 |
| 同文件 `:114` | 从首个 `details` 改按武器标题定位，原“感知 +5”预期保留。 |
| `tests/e2e/automationChoices.spec.ts:64` | 移除寻找资源的 30 次分页循环，增加唯一行断言并滚动定位；未增加 retry。 |
| `tests/e2e/card-atmosphere.spec.ts:9` | 增加“已保存到本机”等待断言。 |
| `tests/e2e/localFeedback212.spec.ts:41`、`:53` | 自动产生生命骰／法术位的轮询，改为显式同步前资源不存在；保存失败保护仍保留。 |
| `tests/e2e/sourceChoices232.spec.ts:80` | 精确比较拆为原条目全部字段 `toEqual(race)`，另查实际安装 SHA、2014/PHB 身份及六项各 `+2`。基础 14、显示 16、取消输入和重载断言保留。 |
| `tests/featureArmor.test.ts:37` | 追溯路径从 `entries:0` 改为 `automation.mechanics.modifiers:0`；加值仍为 1。 |
| `tests/feedback205.test.ts:19` | hydrate 预期 `true→false`，增加原对象不变；通过显式副本同步保留原容量验证。 |
| `tests/fixes194.test.ts:43`、`:45` | 同样改为未审阅来源不自动 hydrate，保留原数值与显式同步验证。 |
| `tests/refinement183.test.ts:15` | 输入公式改协议变量，结果仍为 5。 |
| `tests/sourceChoices232.test.ts:68`、`:115` | 占位物品预期改为实际引用；增加缺引用拒绝及原对象不变。原物品数、金币和重复领取检查保留。 |
| `tests/spellWorkspace210.test.ts:69` | hydrate 改为 false；施法属性检查移到角色手动设置，仍为 `cha`；原容量 2 保留。 |

另行复核的语义变化：

- 额外戏法仍为 `3→4→3`；无效体型拒绝从 raw 输入迁移到 IR 输入。
- 条件护甲原 `16/17/19/12/10` 保留；未知条件由明确 unsupported 夹具表达，正文变化不再选择机制。
- 起始装备改为作者提供实际 UID 和目标条目，原 7 GP、三件物品及原子领取检查保留。
- 选择投影继续保留排序 oracle 和数量预期；名称／URI 编码调整用于匹配规范目录身份。
- 手动基线测试明确关闭新卡自动化，避免改变其原先要验证的手动模式。
- reviewed core samples 位于测试目录，带审阅和输入来源记录，未被应用导入，也未计入生产覆盖。

`29c2f23` 增量单独核对结果：

- `equipment-followup`、`direct232SkillsAttacks`、`choiceProjection233`、`sourceChoices232`、`wikiMotion232` 在测试作者边界安装完整 IR。
- `tests/helpers/irFixture.ts:64` 不再把目录生成的展示段落写回 `raw.entries`。
- `tests/e2e/automationFixtures.ts:52` 保留 raw 原有正文，不补生成正文。原“两个实际职业特性”预期未改成五个。
- `.github/workflows/web.yml:96` 只增加 `--allowImportingTsExtensions`，与主 tsconfig 一致；`--strict`、`--noEmit` 及其他检查参数保留。
- 六维元数据断言只剥离两项新增字段后比较全部原字段，没有泛化忽略原字段。绑定 SHA 来自本次安装资料，不是任意非空字符串。

**skip／timeout／retry：**

- 未发现既有 skip 条件或既有超时、重试预算变化。
- 新增完整产物校验测试 `tests/automation-ir-loader.test.ts:58` 显式使用 `30000 ms`。
- 新增 `playwright.automation-ir.config.ts:2` 使用测试 `60000 ms`、expect `15000 ms`、单 worker，无新增 retry。
- 因而文档“未调整任何测试超时”应按“未放宽既有测试超时”理解；新增测试确有上述显式设置。

以上契约变更符合本会话明确授权和 `AUTOMATION-IR-G5-TEST-CONTRACTS.md`。本审计没有将其认定为未经授权改断言，但也不以夹具通过替代生产覆盖或隐藏生命周期验证。

**四、统计与证据核对**

生产产物重新计算结果：

| 指标 | 结果 |
|---|---:|
| 发布记录总数 | 18,789 |
| `automated` | 0 |
| `noMechanics` | 0 |
| `needsAnnotation` | 18,789 |
| `unsupported` verdict | 0 |
| DoD 指定 kinds 的 PHB 核心记录 | 1,519 |
| XPHB | 1,448 |
| DMG | 1,171 |
| XDMG | 2,258 |
| 核心合计 | **6,396，全部 needsAnnotation** |
| identity gaps／duplicate conflicts | 3／2 |
| Foundry 行／匹配／孤立 | 1,661／1,564／97 |

四本核心书所有 kinds 共 6,971 条，另外 575 条不属于 DoD 指定 kinds，不能将其误报为 6,396 的分母错误。

产物 `public/automation/ir-1-b4936cf74db94c23.json`：

```text
bytes  = 16223832
sha256 = b4936cf74db94c238e9fdc91fe7fc7609c279398bce71249b18d7862de30d270
```

该值与 `default-source.json` 一致。递归扫描结果：CJK 字符串／键为 0，正文容器字段为 0，最大 evidence quote 为 2 词。生产扫描不将测试样本当作发布覆盖。

`shared-files.json` 的源提交为数据冻结 `5f24e49…`，10 项共享文件的散列全部相符。117 个原始输入文件的字节数和散列核对无不符；跨 Node 22/24 的六份派生产物逐字节一致。发布版对部分路径做了安全化处理，输入对应关系以 namespace、role、SHA、bytes 核对。

审计员实际聚焦执行：

| 执行范围 | 通过 | 跳过 | 失败 |
|---|---:|---:|---:|
| 最终 Web 冻结：IR runtime、audit、loader、choices-resources、真实 Defense 五文件 | **61** | **1** | **0** |
| 数据冻结：validator、shared identity 两文件 | **22** | **0** | **0** |

Web 的 1 项跳过因未为该次命令设置 `DND_AUTOMATION_CORE_DATA`；真实 Defense 输入已设置，其 18 项包含在 61 项内。四个额外反例不是 Vitest 通过数，不与这些数字相加。

主实施者日志核对：

- Web Node 22／24 全套：各 `824/25/0`。
- 真实资料五文件：`76/0/0`；真实 Defense：`18/0/0`。
- 数据仓 Node 22／24：各 Vitest `298/0/0`，另 Node tests `14/0/0`。
- 干净数据 checkout：Vitest **`287/11/0`**，另 Node tests `14/0/0`。11 项等价性测试依赖外部 oracle，不能把这一运行写成 298 项无跳过。
- 单机审计原文：`{"singlePlayer":true,"multiplayerModules":[]}`。

第一轮 CI `37126576230` 的完整原始日志和 `summary.json` 已核对。以下三数均为 **通过／跳过／失败**，同组不同命令不相加：

| 浏览器组 | 第一轮原始结果 | 第二轮已读取快照 |
|---|---|---|
| dashboard-appearance | dashboard `30/2/0`，success | success |
| screen-release | screen `9/0/0`；release `59/0/0`，success | success，同数 |
| resources-sources | feedback217 `57/0/0`；source-feedback `22/0/0`，success | 运行中 |
| feedback-touch | feedback198 **`14/0/3`**；compat207 `9/0/0`；touch `6/6/0`，failure | success：`17/0/0`；`9/0/0`；`6/6/0` |
| startup-order | `12/0/0`；fullscreen `2/0/0`，success | success |
| startup-integration | wiki-recovery `7/0/0`；integration230 `58/5/0`，success | 运行中 |
| direct-232 | direct **`8/0/5`**；wiki **`9/0/8`**，failure | success：`13/0/0`；`17/0/0` |
| armor-feature-followup | armor-offsets `5/0/0`；feature-armor `7/0/0`，success | success |
| card-fixes-235 | `10/0/0`，success | success |
| class-drop-profile-232 | 浏览器 `32/0/0`；独立 tsc 失败，job failure | success，浏览器 `32/0/0` |
| portrait-frame | `9/1/0`，success | success |
| edit-profile-232 | `12/0/0`，success | success |
| automation-unified | automation209 `26/0/0`；unified191 `18/2/0`，success | success |
| monster-lifecycle | `8/0/0`，success | success |
| choices-standalone | choices `18/5/0`；standalone `19/0/0`，success | success |
| followup-230 | followup231 `52/2/0`；followup-ui231 `68/0/0`，success | 运行中 |
| automation-ir | `4/0/0`，success | success |

第一轮：verify 成功，`824/25/0`；**17 个浏览器组中 14 成功、3 失败**。

第二轮 `37127675320`：读取到的回执快照为 verify 成功、`824/25/0`，**14 个浏览器组成功、3 个运行中**，无已确认失败。这里记录的是审计读取的快照，不预判后续终态。

新增结果草稿的口径核对：

- `docs/AUTOMATION-IR-G5-RESULT.md:18` 的生产统计、`:23` 起各命令分列、`:50` 起环境缺口、`:57` 起首轮失败留痕，口径正确。
- 本地 release `59/0/0`、wiki `17/0/0`、真实 choices `23/0/0` 与已读取日志一致；各配置不相加。
- `:30` 的干净 checkout 结果需要连同 `:52` 的 11 项 oracle 跳过说明阅读，不能扩大成全部等价性检查在完全无 Web 环境通过。
- `:74` 的“正式审计仍进行”是草稿阶段状态。本报告入库后，结果记录需要如实列入 F1–F4；不能继续只把阻碍写为等待 CI／等待审计。
- 核心覆盖、对外脚本、G8 和真实设备边界明确未完成，未发现把它们包装为完成。

**五、§2.3 九条 DoD**

| DoD | 已有证据 | 尚缺／结论 |
|---|---|---|
| 1. 协议 schema v1、三条真实示例与反例 | 独立仓两份 schema、G2 三示例、validator 反例测试 | 协议基础有证据。示例是受限机制子集：Second Wind 是 schema 正例、语义 deferred 反例；不能称三个完整自动化正例或计入覆盖。 |
| 2. 一条命令拉取、派生、叠加、校验、报告，全部版本锁 | CLI 可拉取／派生／校验／报告；六产物可复现 | **未完整达到。** `src/cli.ts:20` 的流程未体现覆盖层叠加；`src/derive/index.ts:55` 输出的 `unsupported.json` 无 versionLock；数据 CI 目前只跑 ci/test/build，缺完整生产流水线 CI 证据。 |
| 3. 核心全部有 verdict 且 needsAnnotation=0 | 按书／kind／verdict 的分母和报告存在 | **未达到。** 核心 6,396 条仍全部 needsAnnotation；这是 G6 待办，不单独作为 G5 缺陷。 |
| 4. 卡片消费 IR、删除中文推断、协议升级、旧卡不自动迁移 | 协议 3、加载器、执行器、旧卡提示／副本升级和回归证据 | 接线已有实质证据，但 F1–F3 阻止按完整运行契约宣布达标。 |
| 5. check、standalone、audit、全部 CI、授权测试契约 | 本地检查和构建、audit、第一轮及第二轮部分日志、授权契约 | **未达到最终门槛。** 第二轮全部终态尚未取齐，且存在独立技术阻断项。现行矩阵为 17 组加 verify，不能退回历史 14 组。 |
| 6. 独立仓无 Web 环境通过，Web 仅依赖数据文件和身份模块 | 干净 checkout ci/test/build；共享文件 SHA 锁；生产端不依赖测试派生器 | 有解耦证据，但 11 条 oracle 测试跳过。原条文字面的“一个身份函数模块”与当前 10 项共享文件也不完全一致，需如实记录范围，不能宣称逐字满足。 |
| 7. kiwee 中文文档、generate-automation、零维护集成及 PR 草案 | 尚无完整交付证据 | **未完成，G7 范围。** |
| 8. runbook、handoff、status、TODO 留痕 | 各阶段 runbook、预审、测试契约、handoff 存在 | **部分完成。** G5 RESULT 仍为未跟踪草稿；本次正式结论尚待主实施者原文入库，不能称全部留痕完成。 |
| 9. G5、G8 另一模型只读审计并入库 | 本次 G5 审计已完成 | **未达到最终要求。** 本次结论不通过；G8 未开展，报告入库由主实施者完成。 |

**六、可直接执行的只读反例命令**

以下命令针对冻结 `29c2f23`，只在内存创建角色、打包模块并输出结果，不写文件、不启动服务。F1–F4 均在同一命令中复现；它是审计反例，不含修复实现。

```bash
cd /workspace/dnd-automation-web
node --input-type=module <<'JS'
import {build} from '/workspace/dnd5e-automation-data/node_modules/esbuild/lib/main.js';

const source=String.raw`
import {newCharacter} from './src/core/model';
import {initializeAutomation} from './src/core/automation/state';
import {createIdentity} from './src/data/automation/identity';
import {validateCharacter} from './src/core/validation';
import {evaluate} from './src/core/engine';
import {syncAutoResources,setResource} from './src/core/resources';
import {planFeatureResources} from './src/core/automation/featureResources';
import {planClassMigration} from './src/core/classMigration';
import {syncFeatures} from './src/core/sheet';
import {exportOwlbear} from './src/core/export';
import {spellState} from './src/core/characterDetails';

const make=(kind,name,mechanics,identity={},raw={})=>({
  id:name,kind,name,english:name,packId:'kiwee',source:'XPHB',
  edition:'2024',revision:'1',entries:[],raw,automationVersion:'audit',
  automation:{
    identity:createIdentity({kind,source:'XPHB',engName:name,...identity}),
    edition:'2024',verdict:'automated',
    provenance:[{layer:'structured',ref:'audit-synthetic'}],
    mechanics,unsupported:[]
  }
});
const card=entries=>{
  const c=newCharacter();initializeAutomation(c);
  c.selections=entries.map((entry,i)=>({
    id:'row'+i,entry,level:1,quantity:1,equipped:false
  }));
  return c;
};
const replay=c=>validateCharacter(JSON.parse(JSON.stringify(c)));
const balance=r=>({
  max:r.max,current:r.current,
  spent:r.featureGrant?.spent??r.automaticSpent
});

{
  const cls=make('class','Audit class',{
    classModel:{hitDie:8,casterProgression:'full'}
  });
  const feat=make('feat','Audit uses',{
    resources:[{
      key:'uses',max:{formula:'@class.level'},
      recovery:[{period:'long',amount:'all'}]
    }]
  });
  const c=card([cls,feat]);
  c.selections[1].parentId='row0';
  c.selections[0].level=5;
  syncAutoResources(c);
  const key=planFeatureResources(c).grants[0].key;
  setResource(c,key,0);
  setResource(c,'spell-slot:1',0);
  c.selections[0].level=1;
  syncAutoResources(c);
  validateCharacter(c);
  const before=JSON.stringify(c);
  const copy=planClassMigration(
    c,[{...cls,revision:'2'},feat],{row0:cls.id},
    {id:'audit-copy',now:'2026-10-03T00:00:00Z'}
  ).card;
  const reloaded=replay(copy);
  reloaded.selections[0].level=5;
  syncAutoResources(reloaded);
  validateCharacter(reloaded);
  console.log('F1',JSON.stringify({
    originalUnchanged:before===JSON.stringify(c),
    before:[
      balance(c.runtime.resources[key]),
      balance(c.runtime.resources['spell-slot:1'])
    ],
    copy:[
      balance(copy.runtime.resources[key]),
      balance(copy.runtime.resources['spell-slot:1'])
    ],
    reloadedLevel5:[
      balance(reloaded.runtime.resources[key]),
      balance(reloaded.runtime.resources['spell-slot:1'])
    ]
  }));
}

{
  const parent={
    classEngName:'Audit class',classSource:'XPHB',
    subclassEngShortName:'Audit subclass',subclassSource:'XPHB'
  };
  const feat=make('feature','Audit feature',{
    resources:[{
      key:'uses',max:{value:2},
      recovery:[{period:'long',amount:'all'}]
    }]
  },{...parent,kind:'subclassFeature',level:3},{
    _category:'subclassFeature',className:'Audit class',classSource:'XPHB',
    subclassShortName:'Old translated label',subclassSource:'XPHB',level:3
  });
  const cls=make('class','Audit class',{
    classModel:{hitDie:8}
  },{},{_category:'class'});
  const sub=make('subclass','Audit subclass',{
    classModel:{subclassFeatures:[feat.automation.identity.key]}
  },parent,{
    _category:'subclass',className:'Audit class',classSource:'XPHB'
  });
  const c=card([cls,sub]);
  c.selections[0].level=3;
  c.selections[1].level=3;
  c.selections[1].parentId='row0';
  syncFeatures(c,[cls,sub,feat]);
  syncAutoResources(c);
  const key=planFeatureResources(c).grants[0].key;
  setResource(c,key,0);
  syncAutoResources(c);
  c.selections[0].level=1;
  syncFeatures(c,[cls,sub,feat]);
  syncAutoResources(c);
  const newer={
    ...feat,raw:{...feat.raw,subclassShortName:'New translated label'}
  };
  const reloaded=replay(c);
  reloaded.selections[0].level=3;
  syncFeatures(reloaded,[cls,sub,newer]);
  syncAutoResources(reloaded);
  validateCharacter(reloaded);
  const newKey=planFeatureResources(reloaded).grants[0].key;
  console.log('F2',JSON.stringify({
    sameCanonicalIdentity:
      feat.automation.identity.key===newer.automation.identity.key,
    sameEntryId:feat.id===newer.id,
    keyChanged:key!==newKey,
    oldArchive:balance(reloaded.runtime.featureResourceArchive[key]),
    newBalance:balance(reloaded.runtime.resources[newKey])
  }));
}

{
  const grouped=card([make('feat','Audit grouped',{
    modifiers:[{
      target:'proficiency',op:'add',value:99,stackGroup:'exclusive'
    }]
  })]);
  validateCharacter(grouped);
  const before=JSON.stringify(grouped);
  const d=evaluate(grouped);
  const priority=card([make('feat','Audit priority',{
    modifiers:[
      {target:'proficiency',op:'add',value:2,priority:20},
      {target:'proficiency',op:'set',value:3,priority:10}
    ]
  })]);
  validateCharacter(priority);
  console.log('F3',JSON.stringify({
    pure:before===JSON.stringify(grouped),
    groupedProficiency:d.proficiency,
    warnings:d.issues.map(i=>i.message),
    priorityProficiency:evaluate(priority).proficiency
  }));
}

{
  const c=card([
    make('class','Audit export class',{
      classModel:{hitDie:8,casterProgression:'full'}
    }),
    make('spell','Audit export spell',{spellModel:{level:3}}),
    make('item','Audit export item',{
      equipmentModel:{category:'other',weight:7}
    })
  ]);
  c.spellSettings={...spellState(c),mode:'known',prepared:[]};
  validateCharacter(c);
  const d=evaluate(c),e=exportOwlbear(c,d);
  console.log('F4',JSON.stringify({
    schema:e.schema_version,
    hitDice:d.hitDice,
    dieSize:e.core_stats.hit_dice.die_size,
    itemWeight:e.inventory.items[0].weight,
    totalWeight:e.inventory.total_weight,
    cantrips:e.spellcasting.cantrips_known.map(s=>s.name),
    prepared:e.spellcasting.prepared.map(s=>s.name),
    alwaysKnown:e.spellcasting.always_known.map(s=>s.name)
  }));
}
`;

const result=await build({
  stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},
  bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'
});
await import(
  'data:text/javascript;base64,'+
  Buffer.from(result.outputFiles[0].text).toString('base64')
);
JS
```

本次聚焦测试的复跑命令：

```bash
cd /workspace/dnd-automation-web
DND_ARMOR_FEATS=/workspace/dnd5e-automation-data/.cache/upstream/kiwee/data/feats.json \
DND_ARMOR_OPTIONALFEATURES=/workspace/dnd5e-automation-data/.cache/upstream/kiwee/data/optionalfeatures.json \
DND_ARMOR_FIGHTER=/workspace/dnd5e-automation-data/.cache/upstream/kiwee/data/class/class-fighter.json \
node node_modules/vitest/vitest.mjs run \
  tests/automation-ir-runtime.test.ts \
  tests/automation-ir-audit.test.ts \
  tests/automation-ir-loader.test.ts \
  tests/automation-choices-resources.test.ts \
  tests/featureArmor.test.ts \
  --no-cache --no-fsModuleCache --configLoader runner --reporter=dot
```

```bash
cd /workspace/dnd5e-automation-data
node node_modules/vitest/vitest.mjs run \
  test/validator.vitest.ts test/shared-identity.vitest.ts \
  --no-cache --configLoader runner --reporter=dot
```
