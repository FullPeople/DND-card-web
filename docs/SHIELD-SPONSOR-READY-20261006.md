# 盾牌与赞助者 · 独立可验证批次

独立分支 `codex/shield-sponsor-ready-20261006` 从远端 main
`79a84b5565f571f491484d00a765d4505047df27` 继承盾牌提交
`240bed6253961aaf0d7dd9ebfb5976553baa8928`，再追加赞助者“别名”50元。
不包含战俑工具候选修改，不改 PR10、现有规则消费者、Data 回执、版本或玩家记录。
推送后保持 Draft，未合并、未部署；最终 SHA 与全部 CI 以 PR 交付回执为准。

盾牌问题的真实复现、源字段、类型隔离、手工记录边界及红绿记录见
[盾牌记录](SHIELD-TRAINING-REFERENCE-20261006.md)。本批复用已证实的类别显示/精确ID绑定修复，
不将明确装备/Shield法术文本改为训练，也不迁移已错误保存的历史记录。

赞助名单精确去重后按现有格式追加 `{"name":"别名","amount":50}`，其余原记录逐条相同。
不推断真实身份、头像或账户。浏览器从实际构建的完整 JSON 响应核对唯一记录，再用该真实记录
作为确定性弹幕样本，确认原加载器显示并只发出一次名单请求；测试夹具不改变产品名单。

本机完整单元 **986通过 / 26条条件跳过 / 0失败**（总1012）；新增盾牌入口24条全部执行。
TS、production/standalone 双构建、启动加载边界、node --check与git diff --check通过；无独立lint脚本。
生产 standalone Chromium **8通过 / 0跳过 / 0重试**：两版自动与手工类别、保存/重载、
移除/撤销/重做、物品/法术隔离、手工记录/余额保全、390×844手机、公告赞助显示。
桌面/手机及赞助截图实际检查；最终提交还须重跑上述构建与浏览器，不借用三项候选的局部绿灯。
48个锁定运行消费者文件散列全部与正式Data回执一致，生成器、锁与门禁未放宽。
新增源夹具2,422字节仅用于测试；规则原文、校验脚本、原创碰撞夹具没有进入产品JS。
产物体积、源摘要、精确SHA、远端CI和临时索引回滚验证保留于本机交付回执。

## 战俑待办与 Data 最小交接

战俑完整成果保留在另一独立本地分支 `codex/shield-training-reference-20261006`，
头 `1c16134f5bd1a2b9e400345603ee2aaa292c9b28`；本 PR 不包含其修复，也不将它标为构建/浏览器已通过。
真实ERLW/EFA任选工具问题已有2条浏览器红复现、8条工具单元、相关36单元通过，TS通过。
追加后的整批仍有17条旧运行回执门禁失败，不能发布。

实际只读取得 Data `0ac0520dae0a81ad15be0c53eac395d21a70230f` 后发现正式生产器：
`scripts/audit_runtime_coverage.ts`，说明 `docs/runtime-coverage.md`，真实函数适配器
`src/runtimeCoverage/adapter.ts` 与 `probe.ts`。本地执行原8条消费者探针、6条账本结构/拒绝测试，
另外实际调用新版Web函数验证两版工具选择/替换/移除并核对48个当前消费者文件与Git提交，均通过。
这些局部证据只证明所测能力，不能充当全部18,789身份的正式回执。

原生产器需要含229行的既有浏览器缓存 `index.json` 和其 `row.path` 指向的全部JSON文件；
每行的url/path/sha256必须对应原审计缓存，sha256按 `JSON.stringify(body)` 重算。
库存必须精确匹配已提交的 `reports/progress/automation-rule-status.json` 全部18,789身份。
当前工作环境未取得该缓存；实际执行在读取index时ENOENT，没有生成候选全量账本。
不能用两份新下载输入拼一个缓存、沿用旧witness或手改module hash代替全量重算。

已有授权维护者在具有该缓存的环境按原流程执行：

```bash
# Data checkout以0ac0520为基线，保持已提交的公开review snapshot不变。
npm ci
node --experimental-strip-types scripts/test_runtime_probe.ts /path/to/web-at-1c16134
node --experimental-strip-types scripts/audit_runtime_coverage.ts \
  /path/to/web-at-1c16134 /path/to/existing-229-input-cache \
  reports/progress/runtime-coverage.json
npm test
npm run build
```

输出须重算全部witness/统计、真实导入模块hash及消费者完整SHA；消费者工作树不能与其Git提交不同。
正式Data导出必须提交在 `reports/progress/runtime-coverage.json`，确保其真实commit可远端取得，
并让现有Data CI按声明的Web SHA取代码验证（因此该Web消费者提交也须由授权流程发布为可取候选）。
随后Web复制该真实blob，绑定Data完整commit及原字节SHA256，重跑provenance、完整测试、双构建、
工具拖入/重载/替换/撤销浏览器绿测和精确最终SHA CI，再决定如何合入本批。

当前现有认证的只读请求确认FullPeople同账号、Data仓库角色admin/push；令牌scope头未披露细粒度
Contents写权限，不能由仓库角色推断令牌写能力已修复。未尝试Data远端写入，也未换身份绕过原拒绝。
全量缓存持有者和正式Data导出发布仍是战俑的具体待办。

## 部署与回滚

实际只读线上card/release.json为249，源b4f65410970ece89018d53fc3e79950951c344f5。
现有dot工作流成功运行的能力仅preflight，没有publish/rollback；production-card只允许main、
审批人FullPeople且管理员不可跳过。当前没有执行生产步骤；须父线程核对精确目标、最终CI、
现行249的备份/保护/回滚和已有正式发布能力后再执行，不复用旧248回执。

本PR含两提交。只回滚赞助和本轮交接说明，用交付回执的最新提交完整SHA；回滚整个PR按新到旧：

```bash
git revert --no-edit <本PR最终提交SHA> 240bed6253961aaf0d7dd9ebfb5976553baa8928
npm test
npm run build
npm run build:standalone
```

反向补丁在独立临时index核对恢复main基线，不reset、强推或覆盖他人提交。
本地完整记录分别位于split工作树的 `.local-evidence/shield-sponsor/` 及保留战俑工作树的
`.local-evidence/warforged/`，不上传原始规则、私审内容或角色存档。
