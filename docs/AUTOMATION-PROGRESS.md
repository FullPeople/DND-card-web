# 自动化进度标签页

入口是公告弹窗标题下的「自动化进度」标签。角色簿旁的「公告」按钮可再次打开；手机标签固定在正文滚动区外，触摸目标至少 44px，支持左右方向键、Home / End。原公告、强制确认和记忆选项保留。

本页只解释已证实的机制及边界，不修改角色、不领取能力、不补齐缺失规则，也不执行休息。数值、装备与特性、熟练项、法术、资源 / 休息分组；提供资料类型、来源书、功能分类筛选和简短更新记录。部分支持项逐项说明自动做什么、如何触发、条件与人工边界。未开放、未验证和待实现项只显示状态。

## 单一维护来源与生成

维护玩家说明与证据关联的唯一文件是 `docs/data/automation-progress.json`。不在 UI 手写版本、数量、完成率或更新数字。来源书名称复用 `src/data/sourceRegistry.json`；规则协议和版本读取现有 `src/core/automation/state.ts`。原创夹具上的 PHB / XPHB 身份不表示对应出版社规则语义已经逐条验收，第三方逐书清单缺失时显示待核实。

所有现有 Vite build 模式，包括 `npm run build`、`build:standalone`、`build:domestic`，自动执行 `tools/automationProgressPlugin.ts`：

1. 读取单一维护来源、已有来源登记、可选逐条状态及本次验证回执。
2. 将证据投影成公开白名单字段，生成 `assets/automation-progress-<hash>.json`，最大 48 KiB；生成 `assets/automation-progress.audit.json` 记录压缩体积与新增依赖。
3. 将当前 Git SHA、源码指纹、模式和清单 SHA256 编入延后加载的进度模块。清单带更新时间、规则身份、机制状态、汇总数字和书名，不含规则正文、私审记录、角色对象、测试原文或整个自动化库。
4. 构建检查进度模块不进入首卡依赖图，首次点击新增依赖不能包含 `src/core/` 或 `src/data/`。已有公告和 React 公共依赖复用。

本轮实际取得的参考有 `docs/STATUS.md`、`docs/RULE-COVERAGE.md`、209 / 217 阶段说明及现行源码、测试、246发布回执。最新产品约定覆盖历史说明：资源休息入口未开放，转场短休 / 长休仅演出。

本次已从另一云端工作区找回并逐条核验原始成果，接入由权威数据仓库导出的schema2精简状态及完整版本锁；按实际文件重算数量，见 [逐条接入记录](AUTOMATION-REVIEW-SYNC-20261005.md)。这些是本地快照口径；整条实现验证仍按当前代码证据计算，生产整条可用保持待核实。schema1入口和以下历史接入说明继续兼容。书目元数据不作为已覆盖规则数量。

schema2的逐条身份、原始本地标记、载荷/阻碍类别、边界、接纳批次和历史验证关联保留在仓库输入；浏览器只取得聚合结果。权威来源是 `FullPeople/dnd5e-automation-data`，角色卡输入是生成副本，不在两仓分别手改。导入命令、SHA与更新流程见上述记录。外部版本锁也参加验证指纹；任一字节或源版本改变均需重新验证。历史回执不会满足当前整条或发布合同。

若以后取得可公开的逐条证据，将精简状态放到 `docs/data/automation-rule-status.json`：

```json
{
  "schemaVersion": 1,
  "scope": "local-snapshot",
  "updatedAt": "2026-10-05T00:00:00Z",
  "records": [
    {"id": "authored-rule-id", "source": "XPHB", "category": "equipment", "reviewed": true, "complete": false, "tests": []}
  ]
}
```

`scope` 只接受 `local-snapshot` 或 `catalog`，不能由本地快照推断全站。每个来源与 ID 组合必须唯一；来源必须先有公开元数据。分类为 `values/equipment/training/spells/resources`。`reviewed` 是整条语义核对事实；`complete` 加匹配且全部断言实际通过、没有跳过的关联测试文件才计为整条实现并验证；部分机制不计入整条完成。额外字段（如 raw、entries、角色、私审笔记）拒绝构建；逐条 ID 与测试路径不进入浏览器清单，只输出分类和来源汇总。某书所选分类没有状态证据时保留未知，不把其它分类证据推断成 0 条；只有明确的分类计数可以表示零。

## 三层证据

- **已核对**：机制说明与存在的源码已人工查看；整条规则核对另由逐条状态计算，不能混用。
- **已实现并验证**：`npm run verify:automation-progress` 实际运行关联单元测试，输出忽略目录 `.local-evidence/automation-progress/verification.json`（schema 2）。保守哈希整个 `src/tests/tools/prototype` 输入树（包含传递导入、动态读取的原创夹具与辅助文件），以及依赖锁、package脚本、全部根配置、TypeScript配置、入口HTML和CI工作流；源码、维护数据或这些验证输入改变，指纹失配即撤销旧证据。执行前后指纹变化也拒绝签发回执。`passedFiles` 只支撑有边界的原创机制说明；`completePassedFiles` 要求文件所有断言通过、无跳过，只有后者可支撑整条规则计数。条件跳过不冒充真实资料语义通过。
- **当前发布已加载且验证可用**：必须取得运行旁的 `release.json`，其 `automationProgress` 对象与当前源码 SHA、指纹、模式、版本、清单 SHA256、通过能力 ID 和验证时间全部匹配。不能以公告版本、主机版本、开发分支、旧发布说明或只有单元测试替代。协议不支持、清单损坏、网络失败、缺字段、跨频道和旧发布证据都保守降级。内部休息逻辑虽有测试，玩家入口未开放，永远不在可用 ID 中。

清单成功读取按 URL + SHA256 缓存，重复切换和重新打开不重读；发布身份重新打开时用 `no-store` 再读。流式读取限制解压后的实际字节数，并检查 SHA256 / schema。进度组件没有角色对象、edit 回调或持久化 API；失败也保留原卡与公告操作。

本轮没有逐条规则的生产发布QA回执结构，因此“当前发布整条可用”固定待核实，忽略单独手填的 `ruleAuditVerified: true`。精确绑定的机制级发布证明仍按所列能力ID核验。

## 下次发布的明确证据

此分支不合并、不部署、不修改当前网站版本。所有本地生成与测试只证明开发候选。

先在最终干净提交上执行：

```sh
npm run verify:automation-progress
npm run check
npm run build:standalone
node tools/checkStartupBoundary241.mjs
npx playwright test --config playwright.automation-progress.config.ts
```

如果要为部分机制生成当前发布资格，还需在同一生产产物上运行关联功能浏览器测试。该配置可追加现有生产回归：

```sh
DND_PROGRESS_MECHANISM_QA=1 DND_AUTOMATION_TEST_MODE=standalone npx playwright test --config playwright.automation-progress.config.ts
```

Playwright JSON 报告的 metadata 绑定实际产物 SHA、指纹、模式和清单散列。仅进度 UI 测试不能证明玩家机制可用。没有明确生产回归映射的机制（例如完整生命流程）继续待核实，不自动列入当前可用。

由未来负责发布的会话准备现有 `release.json`（含准确版本和 `sourceCommit`），再使用：

```sh
node tools/prepareAutomationRelease.mjs \
  --manifest dist-standalone/assets/automation-progress-实际散列.json \
  --release staged-release.json \
  --browser-report .local-evidence/automation-progress/browser-report.json \
  --output release-with-automation-evidence.json
```

工具检查干净精确提交、匹配测试 / 浏览器产物、无失败 / 跳过和成功的逐项生产回归，只为证据足够的能力写资格；不会覆盖已有输出，不部署、不修改角色。当前整条规则发布资格仍不自动推断。Suite 需在其 Web 产物旁发布对应 `release.json`，使用 `suite` 频道、Suite 的实际版本和 Web 源码 SHA；没有该证据就继续待核实。

实际发布后仍应只读复核公网 `release.json`、清单 / JS 的 SHA256 与版本，才能记录上线结果。`prepareAutomationRelease` 的暂存结果不等于已经部署或在真实房间验收。

## 验证与回滚

具体结果、首次失败与复验见 `AUTOMATION-PROGRESS-20261005.md`。既有主线 `Verify web` 自动在正常构建前执行关联验证，重算回执并随双构建上传；现有浏览器矩阵追加自动化进度回归，发布资格不会由CI成功自动填入。候选性能工作流也先重新验证。独立分支工作流 `Verify automation progress` 执行单元、类型检查、两种构建、加载边界与公告 / 进度浏览器回归；PR路径包含测试夹具、依赖锁和配置，保存忽略目录内的原创测试、截图和体积证据，不运行部署。本地仅运行build时仍自动重算清单；没有新回执则保守降级，不要求手改版本或数字。

保留原始主目录，使用隔离工作树；禁止强推、reset 或整包覆盖他人改动。未部署时无需服务器回滚。需要撤销此功能的后续维护者应在最新远端建立新的回滚分支，查明本功能提交并执行 `git revert <功能提交SHA>`；保留撤销记录，不重写历史。精确提交和可复现命令见本轮报告及交付结果。
