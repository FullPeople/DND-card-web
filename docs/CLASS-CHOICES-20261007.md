# 职业专长与可选特性入口：本地候选，未发布

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

2014 ASI 来源目前只有专长目录链接，没有明确的 typed 授予结构。候选显示“待核对”，没有可执行选择或属性补齐机制。2014 可选专长替代与属性分配仍需手动核对。

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
f093b6c2eeedf823ff50b3a00f9c54eedd807717
```

在授权的 Data checkout 中使用原 229 份缓存重审；不得以本轮新下载的六个入口样本代替：

```bash
node --experimental-strip-types scripts/audit_runtime_coverage.ts \
  "<clean-Web-checkout-at-f093b6c>" "<original229-cache>" \
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
git revert f093b6c2eeedf823ff50b3a00f9c54eedd807717
git revert 2077618
```

这两条撤去本候选代码，不合并或部署任何版本。若随后产生绑定报告的提交，应先撤回绑定提交并恢复匹配基线报告，再执行代码回滚；具体 SHA 必须以实际新增提交记录为准。
