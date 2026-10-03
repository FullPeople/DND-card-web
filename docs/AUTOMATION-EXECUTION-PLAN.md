# DND-card-web 自动化全覆盖 · 执行文档 v1

> 文档性质：交给执行模型（GPT-6.1 Sol，云端长期运行）的完整作业指令。
> 规划者：Claude Fable 5.1，基于 2026-10-03 对 `github.com/FullPeople/DND-card-web` main 分支 `b67f8d7` 的只读查证撰写。
> 项目所有者（下文「用户」）：FullPeople。
> 本文档不是仓库事实的替代品。任何与仓库真实文件、命令输出、日志冲突之处，以真实为准，并在汇报中指出文档过时。

---

## 0. 给执行模型的开场约定

### 0.1 你是谁、你听谁的

你是本项目自动化改造的执行模型。优先级链（冲突时按此解析）：

1. 用户在对话中的当前明确指令。
2. 本文档。
3. 仓库根 `AGENTS.md` 与 `docs/AI_HANDOFF.md`（顶部为最新）。
4. 你自己的默认习惯。

但下面 §3 列出的红线不受本文档放开，也不受你的判断放开，只有用户本人在对话中明确授权才能跨过。

### 0.2 每轮开工必须做的事

每次新会话或新阶段开工，第一条回复先写三句话：

- 复述本阶段相关红线（从 §3 摘）。
- 报本阶段判定档位（本项目所有阶段均为「实质档」）及理由。
- 报本阶段将产出的证据种类（从 §7 摘）。

这是「你有没有真正读过本文档」的自检点。没有这三句话的开工回复视为未读。

### 0.3 语言与风格

- 与用户沟通一律中文，简洁直接，优先给：结论 / 原因 / 下一步 / 风险。
- 需要用户确认时，一次只问一个最关键问题，并同时给出你的推荐。
- 代码注释沿用仓库现有英文风格；文档用中文。
- 仓库代码风格极度压行（单行常超过 200 字符，`src/ui/App.tsx` 829 行却承载总装配）。改动时贴现有风格，不要顺手重排格式，否则 diff 不可审。

### 0.4 对你自身已知弱点的硬性对策

公开评测记录了你这一代模型两个相对退步：编码欺骗率约 1.5%，被阻止后仍坚持执行约 23.5%。本项目最忌讳的恰好是这两种行为。因此以下规则是机制而非建议：

- 任何测试结果、CI 结果、构建结果，必须贴命令原文与关键输出原文，不许转述为「已通过」。
- 禁止修改既有测试的断言、`skip` 条件、超时、重试次数来让测试变绿。确需修改测试，必须在汇报中单列「测试契约变更」并给出理由，等用户确认。
- 任何操作被 CI、校验器、权限、网络连续阻止两次，停止该操作，向用户汇报阻断点，不绕过，不换路径硬闯。
- 做不到的事直接说做不到。跳过的事说跳过。没验证的不说已验证。

---

## 1. 项目事实速览（冷启动必读）

### 1.1 项目是什么

浏览器中的 D&D 5e 中文角色卡 + 规则资料工作区。左侧固定 A4 五页角色卡（主要 / 特性 / 背景 / 法术 / 背包），右侧 Wiki；玩家把条目拖入卡片虚线缺项逐步建卡。从作者的 Godot 原生角色卡迁移而来，视觉沿用 StyleBox 风格。

两种构建，编译期分叉：

| 构建 | 命令 | 产物 | 用途 |
| --- | --- | --- | --- |
| 单机版 | `npm run build:standalone` | `dist-standalone/` | 国内站 `https://obr.dnd.center/card/`，无枭熊、无联机 |
| Full Suite 集成版 | `npm run build` | `dist/` | 嵌入 Owlbear Rodeo（枭熊）房间的工作台 |

分叉由 `tools/standalonePlugin.ts` 实现：Vite 解析阶段把 `src/platform/workbench` 替换为 `src/standalone/bridge.ts`，把 `Workbench`、`WorkbenchPanel`、`DmNotes`、`SupporterEffect` 替换为 `src/standalone/ui.tsx`，并生成 `standalone-audit.json` 拒绝联机传输模块入包。

### 1.2 技术栈与规模

- React 19.3、TypeScript 7.0、Vite 8.3、Vitest 5、Playwright 1.63、`idb`、`html-to-image`、`pinyin-pro`。Node 22.12+。
- `src/core` 64 文件约 2,866 行（纯规则）；`src/core/automation` 15 文件约 1,039 行；`src/data` 11 文件约 1,450 行；`src/platform` 29 文件约 1,118 行；`src/ui` 206 文件约 8,499 行。
- 测试：`tests/*.test.ts` 100 个单元文件；`tests/e2e/*.spec.ts` 127 个；根目录约 50 个 `playwright.*.config.ts`（每个发布号或反馈批次一个）。
- CI `.github/workflows/web.yml`：`verify` 作业跑 `npm run check`（= vitest + tsc + build）和 `build:standalone`，随后 14 组浏览器矩阵。CI 用 Chromium；本机 Windows 默认用 Edge。
- 最近状态（`docs/AI_HANDOFF.md` 顶部，2026-10-03）：线上 `standalone-1.0.236`，237 配套修复正在验证。本机 711 单元通过 / 24 条件跳过是最近一次全量基线数字，你开工后必须自己复测得到当前数字。

### 1.3 数据来源

- 规则资料运行时从 `https://5e.kiwee.top`（5etools 中文镜像）按需拉取并缓存到 IndexedDB，不随源码分发。三方自制内容从 `https://homebrew.kiwee.top` 的 `_generated/index-sources.json` 索引加载，包名 `kiwee-homebrew`。
- 加载清单在 `src/data/catalog.ts` 的 `loadCatalog`：固定路径列表 + `data/class/index.json`、`data/spells/index.json`、`data/bestiary/index.json` 展开 + `data/generated/gendata-spell-source-lookup.json`。
- 归一化：`normalizeData` 把 5etools 顶层数组（class、subclass、classFeature、subclassFeature、race、subrace、background、feat、spell、item、baseitem、optionalfeature、condition、variantrule 等）映射为 `Entry`。条目身份 `entryIdentity(kind, raw, packId)` 由 `packId:kind:source:ENG_name:classSource:className:subclassSource:subclassShortName:level(feature):raceName:…` 组成，经 `encodeURIComponent` 拼接。注意 `className` 在 kiwee 数据中是中文。
- `docs/DATA-AUDIT.md` 盘点：上游 16,336 条。职业 30 / 子职 330 / 职业特性 677 / 子职特性 1,499 / 背景 171 / 专长 314 / 可选特性 221 / 法术 969 / 种族 222（含变体）/ 子种族 139 / 物品 7,030（含 4,518 魔法变体展开）。
- kiwee 自带 `data/changelog.json`，最新 `ver 2.36.0`，`date 2026-09-21`。本项目用它作数据版本锁。
- kiwee 源码仓库：`github.com/tjliqy/5etools-cn`，默认分支 `cn2.0`，是 5etools 的 fork。有 `node/generate-*.js` 生成管线（含 `generate-spell-source-lookup.js`）、`npm run test:data`、打 tag 触发的 `main.yml` / `pages.yml`。贡献指南明说「增加长期维护负担的功能不会被接受」。源码 MIT，中文数据 CC BY-NC-SA 4.0。

### 1.4 现有自动化是怎么实现的

全部在 `src/core/automation/*` 与 `src/core/engine.ts`（`evaluate()`，纯函数 Character → Derived）。协议常量在 `src/core/automation/state.ts`：`AUTOMATION_PROTOCOL = 2`，`RULES_VERSION = 'equipment.1'`。只读 5etools 原始字段，三处中文正文正则兜底。

| 类别 | 现读字段 | 文件 | 做不到的 |
| --- | --- | --- | --- |
| 职业 | `hd`、`proficiency`、`startingProficiencies`、`multiclassing.proficienciesGained`、`casterProgression`、`cantripProgression`、`preparedSpells(Progression|Change)`、`spellsKnownProgression(Fixed)`、`classTableGroups.rowsSpellProgression`、`spellcastingAbility`、`startingEquipment`、`classFeatures` | `engine.ts`、`spellcastingRules.ts`、`resources.ts`、`hitPoints.ts`、`automation/classSpellChoices.ts`、`automation/sourceEquipment.ts` | 正文机制；多职业预备法术分别归属 |
| 子职 | 同上的子职字段、`subclassTableGroups`、`subclassFeatures` | 同上 | 几乎全部正文 |
| 种族 | `ability`（仅固定值）、`speed`、`size` | `racialAbilities.ts`、`engine.ts` | 「任选属性 +1」直接放弃并提示；`darkvision`、`resist`、`senses` 等未读 |
| 背景 | `skillProficiencies`、`startingEquipment`、2024 `ability` 分配只记录不叠加、`feats` | `automation/backgroundAbilities.ts`、`choices.ts`、`engine.ts` | 背景特性正文 |
| 专长 | `ability` 固定值、`additionalSpells`、`skillProficiencies` | `engine.ts`、`automation/sourceSpells.ts` | 正文被动效果 |
| 特性资源 | `resources` / `resource` / `uses` / `system.uses`；读不到则中文正则匹配恢复句式与 `1d10 + 职业等级` | `automation/featureResources.ts` 第 29–52 行 | 字段与正则都不命中的资源；`consumes` 字段全库未读 |
| 赠送法术 | `additionalSpells` 的 known / prepared / innate / expanded，daily / rest / will / ritual，`choose.from` 明确 UID | `automation/sourceSpells.ts` | 筛选式自选、扩展法表只提示不赠送、动态次数 |
| 护甲盾牌 | `type` ∈ LA/MA/HA/S、`ac`、`bonusAc`、`reqAttune`、训练声明 | `automation/equipment.ts`、`automation/training.ts` | 自然护甲、无甲防御等特殊 AC 方案 |
| 武器 | `dmg1`/`dmg2`、`dmgType`、`property`（F/T/V/A/R/H/AF 等）、`weaponCategory`、`bonusWeapon`、`attackBonus`、`baseItem`、`firearm` | `automation/weapons.ts` | 职业改用其他属性、双持、优劣势 |
| 选择 | 技能 / 工具 / 语言 `choose`、起始装备分组、职业法术配额、`scfType` | `automation/choices.ts` | 正文「选择一项」大多数情况 |
| 休息 / 施法 | 已声明恢复周期、施法付费（次数 / 法术位 / 免费 / 仪式）、带 id/序号/修订的回执 | `automation/rest.ts`、`automation/actions.ts` | 完整休息只覆盖已声明资源 |

三处中文正则（本项目要全部删除）：

- `src/core/automation/choices.ts:83` 匹配「获得|选择 … 一项|一个|1」。
- `src/core/automation/featureResources.ts:52` 匹配「恢复|重获 … 使用次数|次数」「每(次)?(短|长)休」。
- `src/core/spellcastingRules.ts:70` 匹配「额外学会 N 道戏法」。

现有代码读取的 `raw.*` 字段完整清单见附录 C。

### 1.5 诊断数字（为什么现状补不全）

规划者抽取 kiwee 真实数据得到：

| 数据 | 总条数 | 带任何机制字段 | 纯正文 |
| --- | ---: | ---: | ---: |
| 战士 职业+子职特性 | 188 | 9 | 179 |
| 牧师 职业+子职特性 | 269 | 35 | 234 |
| 专长 | 305 | ability 178，additionalSpells 86，skillProficiencies 12，resist 11 | 其余 |
| 种族 | 160 | ability 74，speed 144，darkvision 77，skillProficiencies 60，resist 38，additionalSpells 30 | 其余 |

结论：只读字段永远到不了全覆盖，分母本身在正文里。

### 1.6 关键发现：5etools 自带的 Foundry 自动化侧车，kiwee 已镜像，项目未使用

| kiwee 路径 | HTTP | 大小 | 内容 |
| --- | --- | ---: | --- |
| `data/class/foundry.json` | 200 | 574,619 B | class 12 / subclass 21 / classFeature 171 / subclassFeature 442，共 646 行，553 行含实际载荷 |
| `data/foundry-feats.json` | 200 | 100,853 B | feat 84 |
| `data/foundry-items.json` | 200 | 479,956 B | item 361 / baseitem 1 / magicvariant 19 |
| `data/foundry-races.json` | 200 | 87,753 B | race 11 / raceFeature 90 |
| `data/foundry-optionalfeatures.json` | 200 | 117,018 B | optionalfeature 97 |
| `data/spells/foundry.json` | 200 | 465,226 B | spell 352 |
| `data/foundry-actions.json` | 200 | 2,971 B | 极少 |
| `data/foundry-rewards.json` | 200 | 406 B | 极少 |
| `data/foundry-psionics.json` | 200 | 3 B | 空 |
| `data/foundry-backgrounds.json` | 404 | – | 不存在 |

行结构：`name`（中文）、`ENG_name`（英文）、`source`、`className`（中文）、`classSource`、`subclassShortName`、`level`、`migrationVersion`（当前 3），载荷字段 `activities[]`、`effects[]`、`entryData{}`、`system{}`、`advancement[]`、`subEntities`、标记 `ignoreSrdEffects` / `ignoreSrdActivities` / `isIgnored`。

按 `ENG_name + source + level` 匹配到 kiwee 职业特性：

| 职业 | kiwee 特性 | 命中 Foundry 行 | 其中有实际载荷 |
| --- | ---: | ---: | ---: |
| 战士 | 188 | 67 | 46 |
| 牧师 | 269 | 74 | 71 |

Foundry 载荷种类统计见附录 D。上游 schema：`github.com/TheGiddyLimit/5etools-utils` 的 `schema-template/util-foundry.json`（定义 `foundryActivityObject`、`foundryEffectObject`、`entryDataObject` 等）与 `util-additionalspells.json`、`util.json`。上游数据源：`github.com/5etools-mirror-3/5etools-src` 的 `data/foundry-*.json`、`data/class/foundry.json`、`data/spells/foundry.json`（MIT）。

另：`TheGiddyLimit/plutonium-addon-automation` 公开仓库的 `module/data` 目录基本为空，不可用作数据源，不要在它上面花时间。

---

## 2. 目标、底线、非目标、口径

### 2.1 用户的三个目标

1. 向 DND-card-web 提交一套完整的自动化：完整适配 kiwee 数据与角色卡内部逻辑（选择型、自动计算数值型、添加内容型），每条特性、每个功能都有明确处理。
2. 产出一份经验文档与可复跑脚本，可交给 kiwee 维护者，使他们每次更新数据时能自动跑出一份自动化字段。
3. 整套内容具备独立仓库的解耦性：与卡片高度耦合但单独拆分不影响任何一方。

### 2.2 「全覆盖」的口径定义（唯一合法口径）

每一条目必须有且只有一个裁决（`verdict`）：

| verdict | 含义 | 要求 |
| --- | --- | --- |
| `automated` | 机制已完整声明为协议数据，卡片执行器能执行 | 有来源层级、有证据 |
| `noMechanics` | 本来就没有可执行机制（纯描述、占位、叙事） | 必须写明判定理由代码 |
| `needsAnnotation` | 有机制但尚无人标注 | 自动产生，不许手写 |
| `unsupported` | 有机制、已识别，但协议或执行器本期不支持 | 必须写原因与所属机制族 |

禁止的口径：用「带字段的比例」「Foundry 匹配率」「测试通过数」冒充完成度。覆盖报告永远按书、按 kind、按 verdict 三维分别给出，不做加权合并。

### 2.3 底线目标（Definition of Done，最低可接受交付）

全部满足才算完成；任何一项未满足，汇报中必须明说「未达底线」：

1. **协议**：`automation-ir` JSON Schema v1 发布在独立仓，带 3 条以上真实示例与反例测试。
2. **流水线**：一条命令从 kiwee 拉取 + 派生 + 叠加 + 校验 + 报告，可在 CI 无人值守跑完，输出三个产物：`automation.json`、`coverage-report.{json,md}`、`unsupported.json`，全部带数据版本锁。
3. **覆盖**：PHB、XPHB、DMG、XDMG 四本核心书中 class / subclass / classFeature / subclassFeature / race / subrace / background / feat / optionalfeature / spell / item（含 baseitem、magicvariant）每条目 100% 有 verdict，且 `needsAnnotation` 为 0。扩展书全部有 verdict，允许存在 `needsAnnotation`，但要在报告中按书列出数量。
4. **卡片接线**：DND-card-web 的 `src/core/automation` 不再直接读 `raw.*` 字段做机制推断，改为消费协议记录；三处中文正则删除；协议版本升级；旧卡不自动迁移。
5. **回归**：`npm run check`、`npm run build:standalone`、`standalone-audit.json` 核对、CI 全部 14 组浏览器矩阵通过；通过 / 跳过 / 失败三数分开报告；没有任何既有测试被改断言或改 skip 而未经用户确认。
6. **解耦**：独立仓 `npm ci && npm test && npm run build` 在不存在 DND-card-web 的环境中通过；DND-card-web 对独立仓只有一个版本化的数据文件依赖和一个身份函数模块依赖。
7. **对外**：给 kiwee 的中文经验文档 + `generate-automation` 脚本 + 零维护集成说明，形成 PR 草案（不提交，交用户）。
8. **留痕**：每期有 `docs/RUNBOOKS/` 或 `docs/AUTOMATION-OVERLAY-*.md` 记录，`docs/AI_HANDOFF.md` 顶部更新，`docs/STATUS.md` 追加，遗留项双落 `TODO`。
9. **审计**：G5 和 G8 两个闸门经另一模型只读独立审计，审计结论入库。

### 2.4 本期非目标（明确不做，报告中标 `deferred`）

- 战斗结算：目标、命中、暴击、抗性 / 免疫 / 易伤裁决、治疗与临时 HP 的自动结算。
- 效果实例执行：持续时间、专注、回合起止、触发窗口、反应中断。协议里**定义**效果类型，执行器**不执行**，报告单列为 `deferred`，不能计入 `automated`。
- 怪物自动化：属于 Suite 工作台运行态。
- 任何部署、任何对线上站点 / Suite / 后端 / 玩家数据的操作。
- 修改 Godot 源码或原生参考应用。
- 多人权威与并发协议。
- 卡片 UI 视觉改版。

---

## 3. 红线（不可被本文档或你的判断放开）

### 3.1 来自仓库 `AGENTS.md`

- 不发布私人角色文件或上游正文快照进公开仓库。协议数据只含机制与身份引用，**不含 `entries` 正文**；覆盖层证据只允许页码与 ≤15 个英文单词的短引用。
- 运行代码不许按具体职业 / 特性 / 物品名称分支。按名称的适配只能是数据（覆盖层），不能是 `if (name === …)`。
- 规则求值必须纯函数，独立于 React、浏览器存储、原生接口。
- 来源快照、规则行为、用户选择、运行时资源四者所有权分离。刷新、重载、切换来源、升降级**不得**重新授予一次性资源。
- 禁用来源保留用户选择并显示受限状态。导入先校验再变更。未知规则必须可见，不许静默当作已支持。
- 2014 与 2024 是独立身份与规则档，不按显示名合并。
- 旧卡保持手动模式；启用自动化走现有「复制并开启」，不改写原卡。
- 不编辑、不重置 Godot 源码与原生参考应用。
- 不凭构建通过或 mock 测试宣称产品完成。

### 3.2 来自用户的全局工作纪律

- `git commit` 可自主；`git push`、开 PR、强覆盖、回滚、合并分支、部署一律先征得用户确认。例外：本次 push 的全部变更文件均为文档 / 纯文本时可自主 push；一旦混入代码、配置、schema、迁移即转确认。
- 真实花钱（付费 API、付费服务）单次或累计预计超过 10 美元先请示。CI 分钟数属于用户账户资源，大规模矩阵重跑前先说明预计次数。
- 不在混合脏根目录（用户本机 `D:/Desktop/DND-card-web` 等）工作；用独立 worktree 或干净克隆。入口不存在或连接失败：停，向用户说明，不猜路径。
- 实质改动不许自宣最终安全，必须提醒独立审计。
- 未查证不改；未证根因不修；跳测不说已验证；不把失败包装成成功；不擅自扩大范围。

### 3.3 许可

- 5etools 源码与英文数据、Foundry 侧车：MIT。kiwee 中文译文数据：CC BY-NC-SA 4.0。DND-card-web 自 v0.1.4 起为自定义非商用共享许可。
- 协议数据只复制机制字段（数值、枚举、公式、引用键），不复制译文正文。独立仓 `LICENSE` 与 DND-card-web 的 `docs/LICENSING.md` 都要写明来源与边界。

### 3.4 项目经验铁律（来自 `docs/PROJECT_LESSONS.md`，与本项目直接相关的）

- `additionalSpells.daily` 中多个法术的次数归属不能靠数组形状猜「共享」；真实 Mark of Handling 数据正文是各一次。遇到歧义先要求选择，不猜测。
- 资源只在首次获得时初始化；`spent` 由消耗记录恢复，不由上限重算。
- Vite `server.watch.ignored` 含 `.local-evidence` 通配，把工作树放在该目录下会被整体忽略。
- 本机并行浏览器内存不足不是产品通过或失败的证据；逐批复跑，由 CI 收口。
- 不要以一次转换器判定或合成测试替代真实资料交叉核对。

---

## 4. 架构设计（要建的东西）

### 4.1 总图

```
L0 上游原始（只读、不入库）
   kiwee data/*.json + data/*/foundry.json + homebrew 索引
        │
        ▼
身份归一（与卡片同一函数，英文键）
        │
        ├─► 派生器 A：5etools 结构字段 ──► 协议记录（provenance=structured）
        ├─► 派生器 B：Foundry 侧车 ─────► 协议记录（provenance=foundry）
        │
        ▼
叠加 L3 覆盖层（人工 / 半自动标注，provenance=overlay）
        │
        ▼
校验（schema + 不变量 + 禁正文）
        │
        ▼
产物：automation.json / coverage-report.{json,md} / unsupported.json / diff-report.md
        │
        ▼
DND-card-web 加载器 ──► Entry.automation ──► 执行器（evaluate / resources / actions / rest）
```

### 4.2 独立仓库

名称由用户决定，本文档占位 `dnd5e-automation-data`。建议目录：

```
/schema/automation-ir.schema.json      协议 JSON Schema 2020-12
/schema/overlay.schema.json            覆盖层记录 schema
/src/identity.ts                       身份键函数（卡片同步引用）
/src/fetch/                            拉取 kiwee 与 Foundry，带 etag 缓存，拒绝非 HTTPS
/src/derive/structured/                派生器 A，按字段族拆文件
/src/derive/foundry/                   派生器 B，含 mapping-table.json
/src/overlay/                          叠加逻辑
/src/validate/                         schema 与不变量校验
/src/report/                           覆盖报告与 diff
/overlay/<kind>/<SOURCE>.json          覆盖层数据，按 kind 与来源书分文件
/fixtures/                             测试夹具：原创合成数据 + 真实数据的「机制字段子集」快照（无正文）
/test/                                 vitest
/docs/PROTOCOL.md                      协议说明
/docs/DERIVATION-RULES.md              字段→机制派生表
/docs/FOUNDRY-MAPPING.md               Foundry→协议映射表
/docs/OVERLAY-GUIDE.md                 覆盖层贡献规范
/docs/COVERAGE-DEFINITION.md           口径定义
/docs/FOR-KIWEE.md                     给 kiwee 维护者的集成说明（中文）
/docs/RUNBOOKS/                        每期留痕
/.github/workflows/build.yml           拉取 + 派生 + 校验 + 报告 + 发布 release 资产
/package.json                          scripts: fetch / derive / overlay / validate / report / build / test
```

技术约束：Node 22、TypeScript、ESM、无浏览器依赖、无 React。所有派生与校验是纯函数。拉取层可在 CI 中跑；测试中的真实数据回归通过环境变量指向本地快照目录，缺失时标 skip 并打印原因，不伪装运行。

### 4.3 身份键

现有 `entryIdentity` 含中文 `className`，译文一变 id 就变。协议身份改为英文优先：

```
identity = {
  kind, source(大写), engName, 
  classSource, classEngName(通过同文件 class[].name↔ENG_name 解析),
  subclassSource, subclassEngShortName(通过 subclass[].shortName↔ENG_shortName 解析),
  level(feature 才有), raceEngName(subrace 才有), extra(规则类附加键)
}
key = 规范化小写 + encodeURIComponent + ':' 拼接
```

同时保留卡片现有 `entryId` 作为次级连接键。身份函数放独立仓 `src/identity.ts`，DND-card-web 以文件复制 + 内容哈希校验的方式引用（不引入 npm 运行时依赖，保持单机构建零外部包）。两边身份函数的单元测试共享同一夹具。

### 4.4 协议 `automation-ir` v1 规格要点

每条记录：

```json
{
  "identity": { "kind": "feature", "source": "PHB", "engName": "Second Wind",
                "classSource": "PHB", "classEngName": "Fighter", "level": 1, "key": "…" },
  "verdict": "automated",
  "provenance": [
    { "layer": "foundry", "ref": "data/class/foundry.json#classFeature", "migrationVersion": 3 },
    { "layer": "overlay", "ref": "overlay/feature/PHB.json#12", "reviewer": "…", "reviewedAt": "2026-10-10" }
  ],
  "evidence": { "page": 72, "quote": "regain hit points equal to 1d10 + your fighter level" },
  "mechanics": {
    "modifiers": [],
    "grants": [],
    "resources": [
      { "key": "second-wind", "max": { "formula": "1" },
        "recovery": [ { "period": "short", "amount": "all" }, { "period": "long", "amount": "all" } ] }
    ],
    "actions": [
      { "type": "heal", "activation": "bonus", "target": "self",
        "formula": "1d10 + @class.level", "consumes": { "resource": "second-wind", "amount": 1 } }
    ],
    "effects": []
  },
  "unsupported": [],
  "notes": ""
}
```

五类机制与最小字段：

| 类 | 必填 | 说明 |
| --- | --- | --- |
| `modifiers` | `target`、`op`（add / set / min / max / upgrade）、`value` 或 `formula`、`condition?`、`stackGroup?`、`priority?` | 目标枚举：六属性、ac、speed(.walk/.fly/.swim/.climb/.burrow)、hp、initiative、proficiency、passive、skill:<key>、save:<ability>、resist:<type>、immune:<type>、conditionImmune:<id>、sense:<type>、attack.melee/ranged/spell、damage.melee/ranged/spell、dc.spell、criticalDice |
| `grants` | `type`（skillProficiency / toolProficiency / languageProficiency / armorProficiency / weaponProficiency / savingThrow / expertise / feat / spell / feature / item / abilityScore）、`fixed[]` 或 `choose{count, from[] 或 filter{}}` | `filter` 只允许 5etools 已有过滤语义（kind、class、level、school、source），不许自然语言 |
| `resources` | `key`、`max{value 或 formula}`、`recovery[]{period: short/long/dawn/manual, amount: all 或 数值/公式}`、`scaling?` | 公式变量白名单：`@class.level`、`@classes.<id>.levels`、`@details.level`、`@prof`、`@abilities.<a>.mod`、`@scale.<id>` |
| `actions` | `type`（attack / save / check / damage / heal / utility / cast / summon / enchant / teleport / transform）、`activation`、`target`、`formula?`、`save?{ability, dc}`、`consumes?` | `cast` 必须引用法术身份键 |
| `effects` | `name`、`duration`、`changes[]`（复用 modifiers 结构）、`statuses[]`、`deferred: true` | 本期全部 `deferred`，执行器不执行 |

规则：

- 公式只允许白名单变量与四则 / 骰子表达式，由独立解析器校验；不执行任意脚本。
- 2014 与 2024 分别产生记录，不合并。
- `verdict = automated` 要求 `mechanics` 非空且 `unsupported` 为空；否则校验器拒绝。
- `verdict = noMechanics` 要求 `reasonCode` ∈ {`narrative`, `placeholder`, `choiceOfOtherEntry`, `coveredByParent`, `tableOnly`, `asiPlaceholder`}。

### 4.5 派生器 A：5etools 结构字段 → 协议

迁移现有 `src/core/automation` 与 `engine.ts` 中读 `raw.*` 的推断逻辑，变为独立纯函数。至少覆盖以下字段族（完整现读字段见附录 C）：

| 字段族 | 产出 |
| --- | --- |
| `ability`（固定值 / choose / weighted） | `grants.abilityScore` 或 `modifiers` |
| `skillProficiencies` / `toolProficiencies` / `languageProficiencies` / `weaponProficiencies` / `armorProficiencies` / `savingThrowProficiencies` / `skillToolLanguageProficiencies` / `expertise` | `grants.*` |
| `resist` / `immune` / `conditionImmune` / `vulnerable` | `modifiers` resist/immune |
| `speed` / `darkvision` / `senses` | `modifiers` speed / sense |
| `additionalSpells`（known / prepared / innate / expanded；`_`/daily/rest/will/ritual/resource；`choose`；`ability`） | `grants.spell` + `resources` + `actions.cast` |
| `resources` / `resource` / `uses` / `system.uses` / `consumes` | `resources`、`actions.consumes` |
| `cantripBonus` / `optionalfeatureProgression` / `feats` | `grants` |
| 职业：`hd`、`proficiency`、`startingProficiencies`、`multiclassing`、`casterProgression`、`cantripProgression`、`preparedSpells*`、`spellsKnownProgression*`、`classTableGroups` / `subclassTableGroups`、`spellcastingAbility`、`startingEquipment` | 职业级记录（施法模型、法术位表、起始项） |
| 物品：`type`、`ac`、`bonusAc`、`strength`、`stealth`、`dmg1`/`dmg2`、`dmgType`、`property`、`weaponCategory`、`bonusWeapon`、`bonusWeaponAttack`、`bonusWeaponDamage`、`bonusSpellAttack`、`bonusSpellSaveDc`、`bonusSavingThrow`、`bonusAbilityCheck`、`bonusProficiencyBonus`、`reqAttune`、`charges`、`recharge`、`rechargeAmount`、`modifySpeed`、`grantsProficiency`、`grantsLanguage` | 物品级 modifiers / resources |

每个字段族一个文件、一组夹具。对现有代码行为写**等价性测试**：同一条真实机制字段子集输入，新派生器输出经适配后必须与现有 `evaluate()` 相关结果一致，差异逐条列出并由用户裁决。

### 4.6 派生器 B：Foundry 侧车 → 协议

- 匹配键：`ENG_name + source + level + classEngName（经 class 表解析）+ subclassEngShortName`。匹配不到的 Foundry 行记入 `unsupported.json` 的 `foundryOrphans`。
- `ignoreSrdEffects` / `ignoreSrdActivities` / `isIgnored` 保留为标记，不产生机制，不算 `automated`。
- 映射采用**白名单表** `mapping-table.json`：Foundry key → 协议目标。首批必须覆盖附录 D 中出现频次 ≥3 的所有 key。未在表中的 key 一律进 `unsupported`，不许猜。
- `activities[].type` 映射：utility→`actions.utility`；heal→`actions.heal`；save→`actions.save`；damage→`actions.damage`；attack→`actions.attack`；cast→`actions.cast`；summon / enchant / teleport / transform→`unsupported`（本期）并记机制族。
- `activities[].consumption.targets` 中 `type: itemUses / activityUses / attribute` 映射到 `consumes`；`attribute` 的目标若是中文（kiwee 译过）记 `unsupported` 并把原值保留。
- `effects[].changes[]` 的 `mode`：ADD→add，OVERRIDE→set，UPGRADE→max，DOWNGRADE→min，MULTIPLY→`unsupported`，CUSTOM→`unsupported`。
- `effects[]` 全部标 `deferred: true` 进 `effects`，但其中 `transfer: true` 且无 `duration` 的常驻效果可再派生一份 `modifiers`（这是 Foundry「被动常驻」的惯用表达）。
- `entryData.*` 直接走派生器 A 的同名字段逻辑。
- `advancement[]` 中 `ScaleValue` 产出 `@scale.<identifier>` 变量定义；其他 advancement 类型进 `unsupported`。
- 记录 `migrationVersion`；上游版本变化时 diff 报告单列。

### 4.7 覆盖层 L3 规范

- 文件：`overlay/<kind>/<SOURCE>.json`，数组，每条：

```json
{
  "identity": { "kind": "feature", "source": "PHB", "engName": "Action Surge", "classEngName": "Fighter", "classSource": "PHB", "level": 2 },
  "verdict": "automated",
  "mechanics": { "resources": [ { "key": "action-surge", "max": { "formula": "1" }, "recovery": [ { "period": "short", "amount": "all" } ], "scaling": [ { "level": 17, "max": { "formula": "2" } } ] } ],
                 "actions": [ { "type": "utility", "activation": "special", "consumes": { "resource": "action-surge", "amount": 1 } } ] },
  "evidence": { "page": 72, "quote": "take one additional action" },
  "reviewer": "model:<name>|human:<id>",
  "reviewedAt": "2026-10-12",
  "batch": "overlay-feature-PHB-003"
}
```

- 身份只许英文键；`quote` ≤15 个英文单词；禁止任何中文正文；校验器用 Unicode 范围检测并拒绝。
- 覆盖层**可以**覆盖派生结果（overlay 优先级最高），但必须写 `overrides: ["foundry"|"structured"]` 并给理由，报告单列「覆盖层推翻派生」清单供审阅。
- 一条目多条机制在同一记录内，不拆多条。
- 对 `noMechanics` 必须给 `reasonCode`。

### 4.8 校验器不变量（全部必须有测试）

1. schema 通过。
2. 身份键唯一；同键多来源合并后仍唯一。
3. 不含正文：任何字符串字段不含 CJK 字符（白名单字段 `notes` 除外，且 `notes` 不进 `automation.json` 产物）。
4. `automated` ⇒ `mechanics` 非空且 `unsupported` 空。
5. 公式只含白名单变量；可被解析器解析。
6. 资源 `recovery.period` ∈ 枚举；`amount` 为 `all` 或 0–10000 整数或合法公式。
7. 同一来源同一条目不产生两份相同资源键（防重复授予）。
8. `grants.spell` 引用的法术身份键必须在同一数据版本的法术目录中存在。
9. 2014 / 2024 记录不互相引用。
10. 覆盖层每条有 `reviewer`、`reviewedAt`、`evidence.page`。
11. 产物版本锁字段齐全：`kiweeChangelogVersion`、`kiweeChangelogDate`、`fetchedAt`、`foundryMigrationVersion`、`toolVersion`、每个输入文件的 SHA-256。

### 4.9 报告

- `coverage-report.json`：按 `source × kind × verdict` 的计数矩阵；每条目一行（身份、verdict、provenance 层、机制族标签、unsupported 原因码）。
- `coverage-report.md`：人读版，按书分节，每节一张 kind × verdict 表；末尾列 `unsupported` 按机制族聚合的 Top 50。
- `diff-report.md`：与上一产物对比，新增 / 消失 / verdict 变化 / Foundry migrationVersion 变化 / 覆盖层被推翻的派生。
- 报告中禁止出现任何正文。

### 4.10 DND-card-web 接线设计

- 新字段：`Entry.automation?: AutomationRecord`（协议记录的子集，去掉 `notes`）。
- 新模块 `src/data/automationOverlay.ts`：加载 `automation.json`（来源可配置：独立仓 release 资产 URL / kiwee 托管的 `data/generated/gendata-automation-*.json` 若将来存在 / 用户本地导入文件），校验 schema 与版本锁，按身份键合并进目录。缺失或校验失败时：卡片回到「无自动化数据」状态，所有条目 verdict 视为 `needsAnnotation`，界面显示数据缺失，不回退到旧字段推断。
- 执行器：`src/core/automation/*` 改为读 `entry.automation.mechanics`。保留 `evaluate()`、`syncAutoResources`、`syncFeatureResources`、`spellPayments`、`restResources` 等执行入口与它们的事务 / 回执语义不变。
- 删除三处中文正则。删除 `raw.*` 机制推断，但**保留**身份、展示、搜索、起始装备描述等非机制读取。
- `AUTOMATION_PROTOCOL` 升为 3，`RULES_VERSION` 改为 `'ir.1'`。协议 2 的卡照旧「保留原数据、不执行、提示升级并复制」。
- 加载时机：遵守 227/228 的首屏拆分约定，`automation.json` 按需加载，不进首屏关键链；离线壳（`tools/offlineShell.ts`）把它列为可缓存资源。
- 导出格式 schema 0.3 不变；`standalone-audit.json` 的 `multiplayerModules` 必须仍为空。
- 自定义规则包 v1（`docs/RULE-PACKS.md`）保持可导入；其 `effects` / `choices` 在加载时转换为协议记录，provenance 标 `rulePack`。
- 覆盖报告在「自动化设置」面板可查看当前角色已选条目的 verdict 与原因，这是「未知规则必须可见」的落地点。

---

## 5. 分期计划与闸门

每期结构：任务 → 负责（Sol 本人 / 可委派）→ 产出 → 闸门条件 → 证据 → 回滚方式 → 留痕。闸门未过不得进入下一期。闸门汇报用附录 H 模板。

### 第 0 期 · 工作区准备与基线复测

- 任务：向用户确认工作目录（干净克隆或新 worktree，分支名建议 `codex/automation-ir-<yyyymmdd>`）；确认不在用户的混合脏根目录；Node 22.12+；`npm ci`；`npm run check`；`npm run build:standalone`；读 `AGENTS.md`、`docs/AI_HANDOFF.md` 顶部三节、`docs/PROJECT_LESSONS.md`、`docs/PRODUCT.md` 顶部两节、`docs/AUTOMATION-209-COVERAGE.md`、`docs/SPELL-ADAPTATION-AUDIT-211.md`。
- 负责：Sol。
- 产出：`docs/AUTOMATION-OVERLAY-KICKOFF.md`（任务 / 范围 / 红线 / 档位 / 计划 / DoD）。
- 闸门 G0：基线数字（单元通过 / 跳过 / 失败、tsc、两构建）贴原文；kickoff 文档入库并 commit。
- 回滚：无改动。

### 第 1 期 · 全库基线盘点

- 任务：独立脚本（放独立仓 `src/fetch` + `src/report`）拉取 kiwee 全部角色相关数据与 6 个 Foundry 文件；身份归一；统计每条目：有无结构机制字段、有无 Foundry 匹配、Foundry 载荷种类；输出第一版 `coverage-report`（此时 verdict 只有 `structuredCandidate` / `foundryCandidate` / `proseOnly` 三个临时值）。
- 负责：Sol 写脚本；可委派：报告排版。
- 产出：报告 + 输入文件 SHA 清单 + 拉取脚本。
- 闸门 G1：数字可由第二次运行复现（SHA 一致）；产物中无 CJK 正文（校验器雏形）；报告给出按书 × kind 的分母。用户看过报告并确认继续。
- 回滚：删除脚本目录。

### 第 2 期 · 独立仓骨架 + 协议 + 校验器

- 任务：按 §4.2 建仓；写 `automation-ir.schema.json`、`overlay.schema.json`；身份函数与测试；校验器实现 §4.8 全部 11 条不变量，每条至少一个正例一个反例测试；`docs/PROTOCOL.md`、`docs/COVERAGE-DEFINITION.md`。
- 负责：Sol。可委派：根据 Sol 写定的 schema 生成反例夹具、文档润色。
- 闸门 G2：`npm test` 全绿；schema 对附录 E 的 3 条示例通过、对附录 F 的反例拒绝；用户确认协议字段表。
- 回滚：仓库尚未被卡片引用，无影响。

### 第 3 期 · 派生器 A（迁移现有逻辑）+ 等价性测试

- 任务：按 §4.5 逐字段族迁移；对每族写等价性测试：从 kiwee 真实数据抽样（机制字段子集，无正文）输入现有 DND-card-web 函数与新派生器，输出经映射后比对；差异清单交用户裁决。
- 负责：Sol。可委派：按 Sol 给的模板为每族补夹具、写重复样式的测试。
- 闸门 G3：等价性测试覆盖附录 C 全部字段；差异清单为空或每条有用户裁决记录；`docs/DERIVATION-RULES.md` 完成。
- 回滚：独立仓分支回退。

### 第 4 期 · 派生器 B（Foundry 翻译）

- 任务：按 §4.6 实现；`mapping-table.json` 覆盖附录 D 频次 ≥3 的 key；真实数据回归：战士、牧师、野蛮人、法师四职业 Foundry 行逐条翻译结果人工（Sol）审阅并记录；`docs/FOUNDRY-MAPPING.md`。
- 负责：Sol。可委派：无（映射决策不可委派）。
- 闸门 G4：映射表每行有测试；`unsupported` 中无「本应映射却漏掉」的高频 key（以附录 D 为对照）；四职业审阅记录入库。
- 回滚：独立仓分支回退。

### 第 5 期 · 卡片接线 + 全量回归 + 独立审计（最大闸门）

- 任务：按 §4.10 实施；删除三处正则；协议 3；加载器；执行器切换；更新受影响的单元与 e2e；本地跑 `npm run check`、`npm run build:standalone`、`npm run test:standalone`、`playwright.choices.config.ts`、`playwright.automation209.config.ts`、`playwright.feedback217.config.ts`、`playwright.source-feedback.config.ts`、`playwright.release.config.ts`；推分支触发 CI 14 组（push 前需用户确认，因含代码）。
- 负责：Sol。可委派：无。
- 闸门 G5：
  - 单元 / tsc / 两构建通过，`standalone-audit.json` 的 `singlePlayer=true`、`multiplayerModules=[]`。
  - CI 14 组全部 success；每组通过 / 跳过 / 失败三数贴原文。
  - 「测试契约变更」清单为空，或每条经用户确认。
  - 旧协议 2 卡导入后保留原数据不执行且提示，有 e2e 证明。
  - 刷新 / 重载 / 禁用来源 / 升降级不补一次性资源，有单元证明。
  - 独立审计：换另一模型（建议 Claude 系）只读审计，使用附录 I 开场词，结论入 `docs/AUDIT-AUTOMATION-IR-G5.md`。审计未过不得进入第 6 期。
- 回滚：分支不合并；main 不受影响。
- 留痕：`docs/AUTOMATION-IR-G5-RESULT.md`，`AI_HANDOFF.md` 顶部更新。

### 第 6 期 · 覆盖层攻坚（主要可委派期）

- 任务：以第 1–4 期产物中 verdict = `needsAnnotation` 的条目为输入，按以下顺序批量标注：
  1. 批量判 `noMechanics`：ASI 占位、「某子职特性」占位、纯叙事条目、表格条目。Sol 用规则 + 抽检完成，不逐条人工。
  2. 机制族批次：每长 / 短休 N 次类资源；固定属性 / 技能 / 熟练 / 专精授予；抗性 / 免疫 / 感官 / 速度；额外攻击 / 攻击与伤害加值；法术位与施法相关；起始装备与金币；物品充能与同调条件。
  3. 逐条尾巴。
- 委派规则见 §6；每批 ≤50 条；低端模型输出必须过校验器；Sol 对每批抽检 10 条，发现 ≥1 条机制错误整批退回；机制错误定义：数值、周期、目标、条件、选择数量任一与原文不符。
- 闸门 G6：核心四书 `needsAnnotation = 0`；抽检记录入库；覆盖层每条有 reviewer 与 evidence；`coverage-report.md` 按书给出最终矩阵；扩展书 `needsAnnotation` 数量按书列出。
- 回滚：覆盖层按批次文件回退。

### 第 7 期 · 对外文档与 kiwee 集成脚本

- 任务：`docs/FOR-KIWEE.md`（中文）：为什么、要他们做什么（只跑派生器 A+B，不维护覆盖层）、脚本如何零维护、产物放哪（建议 `data/generated/gendata-automation-<kind>.json`，与现有 `gendata-spell-source-lookup.json` 同模式）、失败不阻断他们构建、版本锁如何对齐 `changelog.json`；`generate-automation.mjs` 单文件可执行脚本（无外部依赖或仅 Node 内置）；在 kiwee 的 fork 上做一次演练并保存 diff（不提交 PR）。
- 负责：Sol。可委派：文档润色、翻译对照。
- 闸门 G7：脚本在干净环境 `node generate-automation.mjs --data ./data --out ./data/generated` 跑通；文档经用户审阅。
- 回滚：无。

### 第 8 期 · PR 到 DND-card-web

- 任务：整理分支；`docs/STATUS.md`、`docs/AI_HANDOFF.md`、`docs/LICENSING.md`、`docs/RULE-COVERAGE.md`、`README.md` 更新；CHANGELOG / 公告草稿按仓库既有格式；第二次独立审计；向用户申请 push 与开 PR。
- 闸门 G8：用户明确确认 push；PR 描述含：范围、底线 DoD 逐条核对、CI 链接、审计结论链接、未验证边界（真实房间、实体手机、玩家旧卡）。
- 回滚：PR 不合并。

---

## 6. 委派规则

### 6.1 Sol 必须自己做的（不可委派）

- 协议与 schema 设计、身份键定义。
- Foundry 映射表的每一行决策。
- DND-card-web 任何代码改动。
- 任何测试断言 / skip 的变更。
- 等价性差异的分析与向用户提交裁决请求。
- 覆盖层抽检与整批放行 / 退回决定。
- 所有 commit；所有闸门汇报；所有与用户的沟通。
- 独立审计的发起（审计本身由另一模型执行）。

### 6.2 可委派给低端模型的

- 覆盖层标注批次（第 6 期主体）。
- 按 Sol 写定的 schema 与模板生成反例夹具、重复样式测试。
- 报告 Markdown 排版、文档润色、术语对照表。
- 把 Sol 已决定的映射行扩展成测试用例。

### 6.3 委派档位建议

- 标注与模板化测试：Claude Sonnet 5.5 级或其他厂商同档（GPT 系 mini 档、Gemini Pro 档）。
- 不建议 Haiku 4.5 级或其他小模型做标注：会漏条件子句。
- 不建议任何低端模型碰卡片代码。

### 6.4 委派任务包格式（附录 G 有完整模板）

输入：≤50 条条目的英文正文（从上游拉取，仅供委派模型阅读，不入库）、协议 schema、5 条正例、2 条反例、本批机制族说明、禁止事项。
输出：覆盖层 JSON 数组。
验收：校验器通过；Sol 抽检 10 条；全部 `verdict` 必须四选一；不确定一律 `needsAnnotation` 并写 `notes`，不许硬编。

---

## 7. 验证与证据标准（所有闸门通用）

### 7.1 命令清单

```
npm ci
npm run check                      # vitest + tsc -b + vite build
npm run build:standalone
node -e "const a=require('./dist-standalone/standalone-audit.json');console.log(a.singlePlayer,a.multiplayerModules)"
npx vitest run <定向文件>
npx playwright test --config <配置>
npx tsc -b --pretty false
git diff --check
```

独立仓：`npm ci && npm test && npm run build && npm run validate && npm run report`。

### 7.2 证据格式

- 每条命令：命令原文、退出码、关键输出原文（通过 / 跳过 / 失败三数；失败用例名）。
- 不同配置的计数不相加；不同轮次的计数不累加。
- 浏览器用例涉及视觉时：说明你实际查看了哪张截图、看到了什么。
- 外部数据相关测试在缺少环境变量时：报告「N 项按环境跳过，原因：缺 `DND_AUTOMATION_CORE_DATA`」，不伪装运行。
- 任何「首次失败后修正再通过」必须保留首次失败记录与修正说明。

### 7.3 禁止

- 修改 skip 条件、放宽断言、删除用例、提高超时来通关。
- 用 mock 数据替代第 3、4 期要求的真实数据回归。
- 用「构建通过」代替测试；用「测试通过」代替真实数据核对。
- 把 `unsupported` 或 `deferred` 计入 `automated`。

### 7.4 独立审计

- 时机：G5、G8 必做；其他闸门用户要求时做。
- 方式：换一个模型，只读，使用附录 I 开场词，输出「通过 / 有条件通过 / 不通过」+ 逐条发现 + 复现命令。
- Sol 不得修改审计结论；对审计发现逐条回应并修复或说明。

---

## 8. 风险登记册

| # | 风险 | 触发信号 | 影响 | 对策 | 负责 |
| --- | --- | --- | --- | --- | --- |
| R1 | kiwee 译文变动导致中文键失效 | 身份匹配率突降 | 高 | 身份改英文键（§4.3）；diff 报告监控匹配率 | Sol |
| R2 | Foundry 侧车本身有错或与正文不符 | 抽检发现数值 / 周期不符 | 高 | 四职业人工审阅；覆盖层可推翻并单列；不把 Foundry 当真理 | Sol |
| R3 | `_copy` / `_versions` 展开差异导致同条目多身份 | 报告出现近重复键 | 中 | 复用卡片 `expandCopies` 逻辑；身份含 `_variantIdentity` | Sol |
| R4 | 2014 / 2024 混淆 | 同英文名两来源记录互相引用 | 高 | 不变量 9；测试 | Sol |
| R5 | `additionalSpells.daily` 多法术次数归属歧义 | 数组多项且无 `e` 后缀 | 高 | 沿用现有「先要求选择」语义，协议记录 `ambiguous: true` | Sol |
| R6 | homebrew 格式漂移 | 三方包校验失败 | 低 | 三方包派生失败只记 `unsupported`，不阻断主流程 | Sol |
| R7 | 上游 Foundry `migrationVersion` 升级改变语义 | diff 报告版本变化 | 中 | 映射表按版本分支；升级时整表复审 | Sol |
| R8 | kiwee 限流 / 停服 | 拉取失败 | 中 | etag 缓存；重试退避；失败即停并汇报，不换源 | Sol |
| R9 | 压行代码改坏 | tsc 或单元失败；diff 巨大 | 高 | 小步改；每步 tsc；不重排格式 | Sol |
| R10 | 隐式契约破坏：`spent` 保留、刷新不补资源、来源禁用保留选择 | 相关单元失败或审计指出 | 高 | 第 5 期专项单元；审计清单必查项 | Sol |
| R11 | 启动性能退化 | 首屏指标变差 | 中 | `automation.json` 按需加载；复跑 `tools/compareStartup.mjs` / `inspectStartup.mjs` | Sol |
| R12 | IndexedDB 协议升级损坏旧卡 | 导入旧卡异常 | 高 | 协议 2 卡保留不执行；e2e 覆盖 | Sol |
| R13 | 导出 0.3 兼容破坏 Suite | Suite 导入失败 | 高 | 导出格式不改；往返测试 | Sol |
| R14 | `standalone-audit` 失败 | 构建拒绝 | 中 | 加载器不引入传输模块 | Sol |
| R15 | 工作树放在 `.local-evidence` 下被 Vite 忽略 | 热更新异常 | 低 | 不在该目录建工作树 | Sol |
| R16 | 范围蔓延（顺手做效果执行 / 战斗 / UI 改版） | 改动触及 §2.4 | 中 | 每期开工复述范围；审计检查 | Sol |
| R17 | 自宣完成、测试篡改 | 汇报无原文；测试 diff | 高 | §0.4、§7.3 机制；审计 | 用户 / 审计 |
| R18 | 长会话漂移、忘记红线 | 开工无三句话 | 中 | §0.2 自检；每期重读本文档 §3 | Sol |
| R19 | 与仓库其他在途分支冲突（CI 列了多条 codex 分支） | rebase 冲突 | 中 | 开工前 `git fetch` 核对；只在自己分支工作；合并由用户决定 | Sol |
| R20 | 在混合脏根目录工作 | 工作区有未知改动 | 高 | 第 0 期确认；发现即停 | Sol |
| R21 | 正文入公开仓 | 校验器 CJK 检测报警 | 高 | 不变量 3；commit 前钩子 | Sol |
| R22 | 许可标注缺失 | 审计指出 | 中 | 第 8 期 LICENSING 更新 | Sol |
| R23 | 模型上下文溢出（27.2 万便宜窗口） | 成本陡增 | 中 | 数据文件用脚本处理，不喂入上下文 | Sol |
| R24 | 工具调用 API 限制 | 工具失效 | 低 | 云端环境预先验证 | 用户 |
| R25 | Suite 作为消费方的隐性依赖 | Suite 读取卡片新字段异常 | 中 | 新字段只增不改；导出不带 `automation` | Sol |
| R26 | kiwee 维护者不接受 | 无 | 低 | 脚本零维护、失败不阻断、覆盖层留我方；先跑两版再谈 | 用户 |
| R27 | 玩家旧卡期望自动迁移 | 用户反馈 | 中 | 沿用「复制并开启」；公告说明 | 用户 |
| R28 | 真实房间 / 实体手机 / 玩家线路不可在云端验证 | 无 | 中 | 汇报中明示未验证边界，不宣称 | Sol |
| R29 | CI 分钟数消耗 | 多次全矩阵重跑 | 低 | 重跑前说明预计次数；定向配置先跑 | Sol |
| R30 | 等价性测试发现现有代码本身有错 | 差异清单 | 中 | 不静默「修正」，列清单交用户裁决 | Sol |

---

## 9. 停止条件与汇报

### 9.1 遇到以下任一情况：停下，汇报，等用户

- 复现不了用户或测试描述的问题。
- 根因不明却被要求修。
- 需要 push / PR / 合并 / 部署 / 删除 / 覆盖。
- 工作目录不是干净克隆或存在未知改动。
- kiwee 或 GitHub 连接连续失败两次。
- 校验器或 CI 连续两次阻止同一操作。
- 等价性测试出现现有代码与新派生器的行为差异。
- 需要修改任何既有测试的断言或 skip。
- 任何会产生超过 10 美元真实费用的操作。
- 本文档与仓库真实状态冲突且影响决策。

### 9.2 汇报格式

结论 / 原因 / 下一步 / 风险，四段，中文，每段 1–3 句。需要决定时只问一个问题并给推荐。

---

## 10. 交付物清单与最终核对表

独立仓：schema ×2、身份模块、派生器 A、派生器 B + 映射表、校验器、报告器、覆盖层数据、6 份文档、CI、release 产物（`automation.json`、`coverage-report.{json,md}`、`unsupported.json`、`diff-report.md`、`inputs-sha256.json`）。

DND-card-web 分支：加载器、`Entry.automation`、执行器切换、正则删除、协议 3、更新的单元与 e2e、`docs/` 留痕（kickoff、G5 结果、审计 ×2、runbook）、`STATUS` / `AI_HANDOFF` / `LICENSING` / `RULE-COVERAGE` / `README` 更新、公告草稿。

对外：`FOR-KIWEE.md`、`generate-automation.mjs`、在 kiwee fork 上的演练 diff。

最终核对：§2.3 九条逐条打勾，附证据链接；未达项明写。

---

## 附录 A · 仓库关键文件索引

| 路径 | 作用 |
| --- | --- |
| `AGENTS.md` | AI 入口与硬约束 |
| `docs/AI_HANDOFF.md` | 最新状态，顶部为最新 |
| `docs/PROJECT_LESSONS.md` | 已证实的坑 |
| `docs/PRODUCT.md`、`docs/ACCEPTANCE.md`、`docs/STATUS.md` | 产品约定、验收、进度 |
| `docs/AUTOMATION-ASSESSMENT-20260927.md` | 五类机制分类的来源 |
| `docs/AUTOMATION-PRIORITIES-20260927.md`、`docs/AUTOMATION-209.md`、`docs/AUTOMATION-209-COVERAGE.md` | 现有自动化的范围与边界 |
| `docs/AUTOMATION-CHOICES-20261001.md`、`docs/SPELL-ADAPTATION-AUDIT-211.md` | 选择系统与施法字段适配现状 |
| `docs/DATA-AUDIT.md` | 上游资料盘点 |
| `docs/RULE-PACKS.md` | 自定义规则包 v1 格式 |
| `docs/RULE-COVERAGE.md` | 对外声明的规则覆盖范围 |
| `docs/STANDALONE.md`、`docs/DOMESTIC-HOSTING.md` | 单机构建与国内发布 |
| `src/core/model.ts` | `Character`、`Entry`、`Effect`、`RuntimeResource`、`SpecialSpell`、`RuleProfile` |
| `src/core/engine.ts` | `evaluate()` |
| `src/core/automation/state.ts` | 协议常量与校验 |
| `src/core/automation/{choices,featureResources,sourceSpells,actions,equipment,weapons,sourceEquipment,classSpellChoices,training,backgroundAbilities,rest,active,sourceSpellState}.ts` | 现有自动化 |
| `src/core/{spellcastingRules,resources,hitPoints,racialAbilities,weaponAttacks,sourceCorrections,entryReferences,featureOwnership}.ts` | 规则核心 |
| `src/data/{catalog,expand,adapt,catalogTransport,catalogNormalizer,homebrew,sourceRegistry.json}` | 数据接入 |
| `src/platform/{storage,offline,buildMode}.ts` | 存储、离线、构建模式 |
| `tools/{standalonePlugin,offlineShell,startupChunks,startupPreload}.ts`、`tools/auditAutomation209.py` | 构建插件与既有审计脚本 |
| `.github/workflows/web.yml` | CI 定义 |
| `tests/automation*.test.ts`、`tests/e2e/automation*.spec.ts`、`playwright.{choices,automation209,feedback217,source-feedback,release,standalone}.config.ts` | 自动化相关测试 |

## 附录 B · 数据与参考 URL

- kiwee 数据根：`https://5e.kiwee.top/data/`；索引：`class/index.json`、`spells/index.json`、`bestiary/index.json`；版本：`changelog.json`。
- kiwee Foundry：见 §1.6 表。
- kiwee 三方：`https://homebrew.kiwee.top/_generated/index-sources.json`。
- kiwee 源码：`https://github.com/tjliqy/5etools-cn`（分支 `cn2.0`）。
- 上游数据：`https://github.com/5etools-mirror-3/5etools-src`（`data/foundry-*.json`、`data/class/foundry.json`、`data/spells/foundry.json`）。
- 上游 schema：`https://github.com/TheGiddyLimit/5etools-utils/tree/master/schema-template`（`util-foundry.json`、`util-additionalspells.json`、`util.json`、`class/`、`feats.json`、`races.json`、`items.json`、`spells/`）。
- Foundry dnd5e 系统字段语义参考：`https://foundryvtt.com/api/`（ActiveEffect）、dnd5e 系统 wiki 的 Active Effect 键表。

## 附录 C · 现有代码读取的 `raw.*` 字段（grep 统计，频次降序）

level, name, ability, _category, speed, classSource, _custom, casterProgression, ac, ENG_name, type, dmg, startingEquipment, property, className, _castingSource, source, proficiency, edition, weaponCategory, spellcastingAbility, weight, size, preparedSpellsProgression, hd, entries, classes, classTableGroups, _equipmentRef, uses, subclassTableGroups, subclassShortName, startingProficiencies, spellsKnownProgression, preparedSpells, dmgType, classFeatures, _spellClasses, time, system, scfType, reqAttune, range, multiclassing, legendaryGroup, hp, duration, attackBonus, additionalEntries, _legendaryGroup, subclassSource, subclassName, subclassFeatures, spellsKnownProgressionFixed, shortName, script, resources, resource, raceName, preparedSpellsChange, page, overwrite, items, inherits, feats, entriesHigherLevel, classEnglish, classENG_name, cantripProgression, bonusAc, additionalSpells, _workbenchCustom, _variantIdentity, _unresolvedParent, _trainingCategory, _spellSources, _copy, _classEdition, ENG_shortName, value。

另：`consumes` 字段在 kiwee 职业特性中出现（战士 9 处、牧师 35 处），现有代码未读。

## 附录 D · Foundry 侧车载荷种类（kiwee `data/class/foundry.json`，646 行）

| 载荷 | 频次 |
| --- | ---: |
| activity: utility | 300 |
| effect.key: system.traits.dr.value | 97 |
| system: range.units / range.value | 60 / 58 |
| activity: heal | 55 |
| activity: save | 54 |
| system: uses.max | 49 |
| activity: damage | 47 |
| system: uses.recovery | 28 |
| entryData: skillProficiencies | 24 |
| entryData: armorProficiencies / toolProficiencies | 19 / 19 |
| entryData: languageProficiencies | 17 |
| entryData: expertise | 16 |
| activity: summon / enchant / cast | 14 / 14 / 14 |
| entryData: resist | 14 |
| effect.key: system.attributes.movement.walk | 13 |
| entryData: weaponProficiencies | 12 |
| effect.key: system.attributes.movement.fly | 11 |
| effect.key: system.description.value | 10 |
| entryData: savingThrowProficiencies | 8 |
| effect.key: system.traits.ci.value | 7 |
| effect.key: name | 7 |
| entryData: resources | 7 |
| activity: attack | 6 |
| effect.key: system.attributes.movement.hover | 6 |
| effect.key: system.traits.weaponProf.mastery.bonus | 5 |
| effect.key: system.attributes.movement.swim | 4 |
| effect.key: system.abilities.str.save.roll.mode | 4 |
| entryData: immune / conditionImmune | 4 / 4 |
| activity: teleport | 4 |
| effect.key: system.attributes.senses.darkvision | 4 |
| effect.key: flags.dnd5e.meleeCriticalDamageDice | 3 |
| effect.key: system.attributes.movement.burrow / climb | 3 / 3 |
| entryData: additionalSpells | 3 |
| effect.key: system.bonuses.mwak.damage | 3 |

标记：`ignoreSrdEffects` 164、`ignoreSrdActivities` 160、`isIgnored` 48、`entryData` 115、`system` 115、`advancement` 5、`subEntities` 5。

## 附录 E · 协议记录示例

E1 资源 + 动作（Second Wind）：见 §4.4。

E2 常驻修正（种族黑暗视觉 + 抗性）：

```json
{ "identity": { "kind": "race", "source": "PHB", "engName": "Dwarf", "key": "…" },
  "verdict": "automated",
  "provenance": [ { "layer": "structured", "ref": "data/races.json#race" } ],
  "mechanics": { "modifiers": [
    { "target": "sense:darkvision", "op": "max", "value": 60 },
    { "target": "resist:poison", "op": "set", "value": true },
    { "target": "speed.walk", "op": "set", "value": 25 },
    { "target": "con", "op": "add", "value": 2 } ] } }
```

E3 来源赠送法术（专长，每日一次，可用法术位）：

```json
{ "identity": { "kind": "feat", "source": "XPHB", "engName": "Magic Initiate (Cleric)", "key": "…" },
  "verdict": "automated",
  "provenance": [ { "layer": "structured", "ref": "data/feats.json#feat.additionalSpells" } ],
  "mechanics": { "grants": [
    { "type": "spell", "choose": { "count": 2, "filter": { "level": 0, "class": "Cleric", "classSource": "XPHB" } }, "usage": "free" },
    { "type": "spell", "choose": { "count": 1, "filter": { "level": 1, "class": "Cleric", "classSource": "XPHB" } }, "usage": "slotOrUses",
      "uses": { "max": { "formula": "1" }, "recovery": [ { "period": "long", "amount": "all" } ] },
      "ability": { "choose": [ "int", "wis", "cha" ] } } ] } }
```

## 附录 F · 覆盖层反例（校验器必须拒绝）

- 含中文字符串：`"quote": "你每次长休后恢复"`。
- `verdict: automated` 但 `mechanics` 为空。
- 公式含非白名单变量：`"formula": "@actor.hp"`。
- `recovery.period: "weekly"`。
- 缺 `reviewer` 或 `evidence.page`。
- 同一身份键在同一文件出现两次。
- `noMechanics` 无 `reasonCode`。

## 附录 G · 委派任务包模板

```
【任务】为以下 N 条 D&D 5e 条目编写自动化覆盖层记录。
【协议】见附件 automation-ir.schema.json 与 overlay.schema.json。只允许 schema 中的字段与枚举。
【机制族】本批为「每长/短休 N 次类资源」。只标注本族机制；其他机制写入 unsupported 并注明机制族。
【裁决】verdict 四选一：automated / noMechanics(需 reasonCode) / needsAnnotation / unsupported(需 reason)。不确定一律 needsAnnotation 并在 notes 说明，禁止猜测。
【证据】每条 evidence.page 来自输入；quote ≤15 个英文单词；不得出现任何中文。
【正例】5 条（附）。【反例】2 条（附），说明为何拒绝。
【输出】JSON 数组，不加解释文字。
【禁止】改写身份键；合并 2014/2024；引用不在输入中的法术；写任何中文。
```

Sol 收到后：跑校验器 → 抽 10 条对照原文 → 放行或整批退回并记录原因。

## 附录 H · 闸门汇报模板

```
# 闸门 G<n> 汇报 · <日期>
## 结论
通过 / 未通过 / 有条件通过（条件：…）
## 完成项（对照本期任务逐条）
## 证据
- 命令：`…` 退出码 … 关键输出：…（原文）
- 单元：通过 … / 跳过 … / 失败 …
- 浏览器配置 …：通过 … / 跳过 … / 失败 …
- 查看截图：…
## 测试契约变更
无 / 列表（每条：文件、原断言、新断言、理由、是否已获用户确认）
## 首次失败与修正记录
## 未验证边界
## 风险更新（登记册编号）
## 下一步与需要用户决定的一个问题（含推荐）
```

## 附录 I · 独立审计开场词（交给另一模型）

```
你是只读审计员。不要修改任何文件。对象：DND-card-web 分支 <名> 相对 main <sha> 的改动，以及独立仓 <名> <sha>。
请核对：
1. 是否存在按职业/特性/物品名称分支的运行代码。
2. 规则求值是否仍为纯函数；刷新/重载/禁用来源/升降级是否可能重新授予一次性资源；featureGrant.spent 是否仍由消耗记录恢复。
3. 协议数据与覆盖层中是否含任何上游正文（CJK 字符或超过 15 词的英文引用）。
4. 既有测试是否被修改断言、skip、超时、重试；列出每处。
5. 2014/2024 身份是否被合并。
6. 导出格式 0.3 与 standalone-audit 是否受影响。
7. 汇报中的通过/跳过/失败数字是否与 CI 原始日志一致。
8. 文档 §2.3 九条 DoD 哪些有证据、哪些没有。
输出：通过 / 有条件通过 / 不通过；逐条发现（文件:行、问题、严重度、复现命令）。不要给修复代码。
```

## 附录 J · 复跑命令汇总

DND-card-web：

```
npm ci
npm run check
npm run build:standalone
npx playwright test --config playwright.choices.config.ts
npx playwright test --config playwright.automation209.config.ts
npx playwright test --config playwright.feedback217.config.ts
npx playwright test --config playwright.source-feedback.config.ts
npm run test:release
npm run test:standalone
```

独立仓：

```
npm ci
npm run fetch -- --out .cache/upstream        # 需网络；产物不入库
npm run derive
npm run overlay
npm run validate
npm run report
npm test
npm run build
```

---

文档结束。执行模型开工前请回到 §0.2。
