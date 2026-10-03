# 自动化 IR 第 5 期 · 验收记录（待最终闸门）

G5 未通过：正式独立审计确认 F1–F4（2 项 P1、2 项 P2），原结论与反例完整保存在
`AUDIT-AUTOMATION-IR-G5.md`。第二轮 CI 已全部通过；四项技术问题正在修复，
原 F1–F4 与零值维护修复后，ffa 追加审计仍发现 D1–D4（1P1、3P2），原文已保存。
主实施者已继续修复，双 Node844/25/0，需新冻结完整CI与独立复核。G6 未开始。
用户已全批准持续执行，包含协议、测试契约、提交与分支推送；本分支不部署。

## 冻结对象与实现

Web 实现冻结 `29c2f23c3b0a315f871912166c7836b82f4b758b`，
分支 `codex/automation-ir-20261003`，已整合 main `112e3d0` 的发布 240。
独立数据仓 `5f24e49380777d189fc4aefda712c780ac9bbc0f`，
分支 `codex/automation-ir-v1`。原始 Web `80c94e0` 工作区未修改，仍为等价 oracle。

协议 3；哈希和版本锁定的懒加载 IR、独立 worker 完整校验、同哈希离线缓存、
无效刷新关闭执行、显式复制升级、纯数值投影、来源/父级/数量/同调检查、
资源消费债务与装备领取回执。条件护甲消费已审阅 IR，保留 240 的手动技能、
追溯及旧护甲恢复功能。未实施战斗结算或效果实例执行。

默认生产记录 18,789 条（核心四书 6,396 条）仍全部 needsAnnotation。
自创夹具和主实施者审阅的真实回归样本均不进入生产覆盖。

## 本地原始结果（各命令分别报告，不相加）

| 命令 / 配置 | 通过 | 跳过 | 失败 |
| --- | ---: | ---: | ---: |
| Web npm run check，Node 22.12 | 824 | 25 | 0 |
| Web npm run check，Node 24 | 824 | 25 | 0 |
| 夹具修复后的 npm test，Node 22.12 / 24，各自 | 824 | 25 | 0 |
| 独立数据仓 npm test，Node 22.12 / 24，各自 Vitest | 298 | 0 | 0 |
| 独立数据仓原 Node tests，各版本 | 14 | 0 | 0 |
| 不依赖 Web 的独立干净 checkout Vitest | 287 | 11 | 0 |
| 干净 checkout 原 Node tests | 14 | 0 | 0 |
| 真实资料五文件定向单元 | 76 | 0 | 0 |
| 真实防御专长单元 | 18 | 0 | 0 |
| playwright.automation209，standalone | 26 | 0 | 0 |
| playwright.automation-ir | 4 | 0 | 0 |
| playwright.choices，全部真实输入环境 | 23 | 0 | 0 |
| playwright.feedback217 | 57 | 0 | 0 |
| playwright.source-feedback | 22 | 0 | 0 |
| playwright.standalone | 19 | 0 | 0 |
| playwright.release（单独复跑） | 59 | 0 | 0 |
| playwright.armor-offsets | 5 | 0 | 0 |
| playwright.feature-armor | 7 | 0 | 0 |
| playwright.feedback198（修复后） | 17 | 0 | 0 |
| playwright.direct232（修复后） | 13 | 0 | 0 |
| playwright.wiki232（修复后） | 17 | 0 | 0 |

两版本 Web tsc、integrated 与 standalone 构建通过；独立干净 checkout build / validate 通过。
单机审计 singlePlayer=true，multiplayerModules=[]。六份派生产物跨 Node 逐字节一致。

25 个普通单元环境跳过单独报告，未改 skip 来通过。真实输入运行覆盖其中职业、
起始段落、仪式和防御回归；equipment-feedback 的十文件外部验收输入尚未取得，
不虚构其执行。干净 checkout 的 11 个等价跳过需要外部 Web oracle；同一套在主
数据仓用 G0 原始 Web 与锁定 corpus 跑出完整 298/0/0。

## CI 与失败留痕

首轮 [37126576230](https://github.com/FullPeople/DND-card-web/actions/runs/37126576230)：
verify 成功；17 浏览器组 14 成功、3 失败。完整原日志与按 command 原文三数在
忽略路径 `evidence/automation-ir/ci-37126576230/`，不会将首轮称为通过。
旧装备、技能、选择及种族夹具在作者边界提供 IR；适配器保留原始正文字段，
防止把生成的显示段落复制成额外特性；独立 strict/noEmit 检查采用主 tsconfig 的
allowImportingTsExtensions。契约清单 `AUTOMATION-IR-G5-TEST-CONTRACTS.md`。

第二轮 [37127675320](https://github.com/FullPeople/DND-card-web/actions/runs/37127675320)
已完成 success：verify 与全部 17 浏览器组均成功。原始日志及逐 command 三数保存在
`evidence/automation-ir/ci-37127675320/`。verify 824/25/0；各浏览器命令保留各自
统计，不相加。正式审计原文保留审计时 14 成功 / 3 运行中的快照，后来全绿仅关闭
CI 证据缺口，不改变该冻结对象的“不通过”技术结论。

本地首轮高并行发布组出现三个“更新资料”按钮等待超时，原日志保留；相同
配置及原超时单独完整复跑为 59/0/0，远端首轮发布组也是 59/0/0。未改断言、
超时、重试或跳过来通过。既有断言修改逐条记录在契约清单中。

## 审计、留痕与回滚

预审发现及修复已入 `AUDIT-AUTOMATION-IR-G5-PRELIMINARY.md`。
不同模型 GPT-6 Astra 正式只读审计结论“不通过”，原文已入库。
F1 同步副本截断溢出消费债务；F2 raw 显示短名参与资源键；F3 熟练加值绕过
stackGroup 限制及优先级；F4 导出仍读取 raw 环阶、生命骰和重量。主实施者修复后
须由原审计员复核，原失败报告保留，不能用 CI 通过替代技术审计。
G5 技术和审计全部通过后才进入每批最多 50 条的 G6 标注。

Web 阶段标签 `automation-g5-preintegration-20261003`、
`automation-g5-main240-integration-20261003`、`automation-g5-ci-followup-20261003`；
数据标签 `automation-g5-integration-data-20261003`。使用隔离 worktree 或提交反转，
不覆盖用户原始工作区或玩家卡。完整数据 Git bundle 已验证，SHA256
`7fb686074d8770b0690604cd0ab924ace0df0db5d068247724417a444f90fa27`。

用户通过另一个会话创建并授权独立公开仓
[FullPeople/dnd5e-automation-data](https://github.com/FullPeople/dnd5e-automation-data)。
通过 GitHub Git database API 已发布完整七提交与阶段标签，原 blob/tree/commit
逐一核对 SHA。候选分支 HEAD 为 `5f24e49…`。空仓初始化 LICENSE 后，以普通
非强制合并发布 main `3543759e2dce8c00c36b6ff59955c17a24091ed8`，其树与候选完全
一致，初始化历史保留。没有改 Web main。Git HTTPS 401 失败日志保留；仓库设置
API 缺集成 administration scope，未依赖修改默认分支或强制更新来发布。
候选 [CI 37129017706](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/37129017706)
及 main [CI 37129357482](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/37129357482)
均 success：各自 Vitest 287/11/0、Node tests 14/0/0、build 通过。外部 oracle
缺失的 11 项跳过照实报告；Git 对象校验与发布回执在忽略的 data `evidence/`。
没有发布缓存中的规则原文或玩家卡。
真实房间、实体手机、实际玩家旧卡未验收；核心覆盖、kiwee 单文件脚本与最终
G8 审计尚未完成，整项任务仍未达最终底线。
