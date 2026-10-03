# G5 正式审计修复记录

原正式审计冻结 Web `29c2f23` / data `5f24e49`，结论“不通过”，原文完整保存在
`AUDIT-AUTOMATION-IR-G5.md`。该报告保留当时 CI 快照，不将后来全绿改写为审计通过。
用户已授权持续执行、留痕与可回滚。以下修复由主实施者完成，等待独立复核。

| 发现 | 修复与有意义回归 |
| --- | --- |
| F1 · P1 | 三种同步副本统一保留溢出消费债务、限制可用次数且新资源为零；feature/automatic/pact 归档同步更新。覆盖职业、整卡、批量与关闭自动化后批量同步，保存重载及降升等级仍不补资源；显式休息才恢复。 |
| F2 · P1 | 资源键使用独立 ir-v1 命名空间、规范 identity.key 及稳定拥有者；显示字段只用于旧回执读取。唯一旧账本迁移保留债务、当前次数、图标与排序；重复回执取最大消费债务。旧回执关联有歧义时停止重新授予并显示核对警告。覆盖生成特性删除、换译名、重新生成、JSON 重载、旧归档与正余额同步。 |
| F3 · P2 | 熟练加值拒绝未支持的 stackGroup，跨拥有者按声明优先级排序；保留条件、装备与同调保护。回归检查 grouped 不执行、set 后 add 得 5、@prof 公式一致、求值不改原对象。 |
| F4 · P2 | 0.3 投影环阶使用 IR 或玩家明确的 manualSpellLevel；生命骰、重量、特性等级读取规范声明，未知机制不以 raw 推断。保留 schema_version 0.3、原生备份与手动覆盖。 |
| F5 · P3 | 修复采用的计划副本第 299 行尾随空白；基线至工作树 diff --check 通过。 |

新增 `tests/automation-ir-g5-findings.test.ts` 10 项生命周期、顺序和交换投影回归。
既有 `transfers-feedback` 自创手动法术夹具明确增加 manualSpellLevel=1，所有原
来源分离、数组、快照与原对象断言保持；没有改 skip、既有 timeout 或 retry。

主实施者验证：Node 22.12 / 24 各全套 **834 通过 / 25 环境跳过 / 0 失败**，
严格类型及 integrated/standalone 构建通过；两版 standalone audit 均
`singlePlayer=true, multiplayerModules=[]`。正式审计原始反例脚本在内存原样重跑：

```text
F1 copy：feature 1/0/spent5，slot 2/0/spent4；重载升5：5/0/spent5，4/0/spent4
F2 sameCanonicalIdentity=true，sameEntryId=true，keyChanged=false，newBalance=2/0/spent2
F3 groupedProficiency=2，priorityProficiency=5，pure=true
F4 schema=0.3，hitDice=1d8，dieSize=8，itemWeight=7，totalWeight=7，spell保留
```

原始日志在忽略的 `evidence/automation-ir/g5-findings-*` 与
`g5-formal-reproduction-freeze.log`；首轮完整测试发现一个缺显式环阶的自创交换
夹具（831/25/1），修复作者边界后重跑通过。首次复制 audit 回执误用 dist 路径
导致 shell 停止，修正为 dist-standalone 后继续 Node 22；没有将该失败称为通过。

第二轮冻结前 CI `37127675320` 的 verify 与 17 个浏览器组全成功，但不能代替
此次 runtime 修复后的新提交 CI 与独立 delta 审计。G5 尚未放行，G6 尚未开始。
数据仓已公开发布，原始七提交逐个 SHA 相同；main 普通合并树等于 `5f24e49`，
候选及 main CI 各 287/11/0 + Node tests 14/0/0，11 项外部 oracle 缺口照实保留。

修复前回滚点 `automation-g5-ci-followup-20261003`。新增修复提交可通过反转提交
或独立 worktree 回退；原始工作区、玩家卡、Web main 和线上未修改。
