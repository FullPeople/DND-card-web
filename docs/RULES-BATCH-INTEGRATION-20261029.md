# 2026-10-29 规则整批集成验收记录（进行中，未合并、未部署）

本轮只修复、验收和按依赖正常合并；不发布生产、不修改玩家数据、不提交 APPROVE 审查。桌面原混合目录保留。因 F 盘空间不足，当前隔离源码在 G 盘；原工作区、缓存和过程证据均保留，复制文件已核对 SHA-256。

初始 main：Data `5ee1e38b5999ec39a7e44f0a9d8b8869f635c390`；Web `accb00fb724b64d7948d3599064a19dcbf00fdad`。初始候选为 Data #77–84、Web #120、#122–136，全部为草稿。表中是首次刷新的远端准确提交与检查任务，不代表当前整合源码已经验收。

| 仓库／PR | 远端 head | base 分支 | 初始检查任务 |
| --- | --- | --- | --- |
| Data [#77](https://github.com/FullPeople/dnd5e-automation-data/pull/77) | `9fda6dcc75d5187d3cede212911f808236eb89dd` | `codex/cloud-reviewed-linguist-20261025` | SUCCESS 2, SKIPPED 2 |
| Data [#78](https://github.com/FullPeople/dnd5e-automation-data/pull/78) | `06889ec69d5c423d9a3e6e6dc8be0a5818cf8268` | `codex/cloud-reviewed-observant-20261025` | SUCCESS 2, SKIPPED 2 |
| Data [#79](https://github.com/FullPeople/dnd5e-automation-data/pull/79) | `954cf46fcf236f2f5553e294e5f358c52d3fafd4` | `codex/cloud-reviewed-alert-20261026` | SUCCESS 2, SKIPPED 2 |
| Data [#80](https://github.com/FullPeople/dnd5e-automation-data/pull/80) | `f5eb3d1600e16903e5d4ee83f09760c01e58a64d` | `codex/cloud-rules-rebuild-common-casting-20261027` | SUCCESS 3, SKIPPED 2 |
| Data [#81](https://github.com/FullPeople/dnd5e-automation-data/pull/81) | `fde5bf19f06ce4c6eee82151a14140f6830aa60b` | `codex/cloud-rules-expanded-spell-source-gate-20261028` | SUCCESS 3, SKIPPED 2 |
| Data [#82](https://github.com/FullPeople/dnd5e-automation-data/pull/82) | `8c080c6abd839e50c605f3745f53130e18a3ad25` | `codex/cloud-rules-ten-family-source-gate-20261028` | SUCCESS 3, SKIPPED 2 |
| Data [#83](https://github.com/FullPeople/dnd5e-automation-data/pull/83) | `e899f8efa6f2a2fb8461996f20e610717bd57796` | `codex/cloud-rules-fourteen-family-source-gate-20261028` | SUCCESS 3, SKIPPED 2 |
| Data [#84](https://github.com/FullPeople/dnd5e-automation-data/pull/84) | `8749f4b8f21af0a570b9d9e16189754ef9574226` | `codex/cloud-rules-sixteen-family-source-gate-20261028` | SUCCESS 3, SKIPPED 2 |
| Web [#120](https://github.com/FullPeople/DND-card-web/pull/120) | `8e48bbbe801b21a57fbb9072b4d4c324379448ea` | `codex/cloud-reviewed-linguist-20261025` | SUCCESS 41 |
| Web [#122](https://github.com/FullPeople/DND-card-web/pull/122) | `bfdc77419b37773a1e762ab096898690e4d0fe0d` | `codex/cloud-reviewed-observant-20261025` | SUCCESS 42 |
| Web [#123](https://github.com/FullPeople/DND-card-web/pull/123) | `8a37ce9701eb4b33f1364082d6480f1ece731cd8` | `codex/cloud-reviewed-alert-20261026` | FAILURE 5, SUCCESS 35, CANCELLED 1 |
| Web [#124](https://github.com/FullPeople/DND-card-web/pull/124) | `7ee3556b0959ff12294d72ea53a65ff8ce9845ff` | `codex/cloud-rules-rebuild-common-casting-20261027` | FAILURE 12, SUCCESS 1, SKIPPED 1 |
| Web [#125](https://github.com/FullPeople/DND-card-web/pull/125) | `cfb6f1ae21b8acaebf51c9f9e271aafcbbc6c58c` | `codex/cloud-rules-expanded-spell-milestone-20261028` | FAILURE 11, SKIPPED 1 |
| Web [#126](https://github.com/FullPeople/DND-card-web/pull/126) | `5b429566475a77b69ed7a08749139321a6ca4b9e` | `codex/cloud-rules-rebuild-passive-item-bonuses-20261028` | FAILURE 10, SKIPPED 1 |
| Web [#127](https://github.com/FullPeople/DND-card-web/pull/127) | `29fe71508747f92a9ce314f87aaa5f0909a6c963` | `codex/cloud-rules-rebuild-item-casting-bonuses-20261028` | FAILURE 11, SKIPPED 1 |
| Web [#128](https://github.com/FullPeople/DND-card-web/pull/128) | `86725926e4b815e2f8dccc5f6ac9c8fe65970623` | `codex/cloud-rules-rebuild-item-resistances-20261028` | FAILURE 11, SKIPPED 1 |
| Web [#129](https://github.com/FullPeople/DND-card-web/pull/129) | `bb21b5b79adcfcd67e424612c3df4715d79d43cc` | `codex/cloud-rules-rebuild-relative-racial-movement-20261028` | FAILURE 11, SKIPPED 1 |
| Web [#130](https://github.com/FullPeople/DND-card-web/pull/130) | `58e0faa707b5219b428235282de1865bf06c40bb` | `codex/cloud-rules-armor-resistance-variants-20261028` | FAILURE 11, SKIPPED 1 |
| Web [#131](https://github.com/FullPeople/DND-card-web/pull/131) | `80ebe76d4e2a4aef7ff448683e2b5d5497d01f75` | `codex/cloud-rules-fourteen-family-milestone-20261028` | FAILURE 10, SKIPPED 1 |
| Web [#132](https://github.com/FullPeople/DND-card-web/pull/132) | `f96632b1ae40b898ebd250c166da70ddaeb9380a` | `codex/cloud-rules-inherited-resistance-checkpoint-20261028` | FAILURE 10, SKIPPED 1 |
| Web [#133](https://github.com/FullPeople/DND-card-web/pull/133) | `b78ab5b2295da26621ddcce1f46066bff53e0f85` | `codex/cloud-rules-racial-carrying-20261028` | FAILURE 11, SKIPPED 1 |
| Web [#134](https://github.com/FullPeople/DND-card-web/pull/134) | `b416732093ad17d3f5ef269379fbaab1b4499021` | `codex/cloud-rules-natural-armor-20261028` | FAILURE 11, SKIPPED 1 |
| Web [#135](https://github.com/FullPeople/DND-card-web/pull/135) | `37f367145422da0606db91b3c6301555331bcb86` | `codex/cloud-rules-source-level-hp-20261028` | FAILURE 5, SKIPPED 1 |
| Web [#136](https://github.com/FullPeople/DND-card-web/pull/136) | `380498eaa4b167eda70d7416ff2f5e0c4fc553cc` | `codex/cloud-rules-eighteen-family-contract-fix-20261028` | FAILURE 11, SKIPPED 1 |

本轮拟纳入上述完整依赖链；是否合格取决于最终整合提交的证据。未纳入不在清单内的 PR、飞行来源元数据候选、未推送的旧报告及生产发布操作。较早的独立报告内容对象上传仍为 UNKNOWN，本轮没有重试；404 只表示本次只读查询未查到对象或计划分支，不是原操作的终态。

产品源码当前冻结于 Web `fe6a5fde96c5ea97cb82087b11898e283a670e91`，源码树 `71ad399d3e793d86aea2ed6fe9ef4768323de922`；生成器为 Data `8b6caf72f4c255219052d9c42d053ab190f34610`。完整观察现已执行完毕，报告实际提交为 Data `e8a816a251ee507f44db5ea9846b2b0f28ee85d8`（仅本地，尚未上传）。Web 副本与该提交逐字节相同，并使用此真实提交的版本锁。此前另一源码上的部分回放及所有原失败保留，不计入这份新源码的最终证据。

修复包含：合并主线的交互和隐私保护；从回放报告统一读取普通施法 actor 绑定并保留实际文件字节断言；为完整 CI 准备全部十九族输入与独立物品施法政策原件；保留旧客户端完整源码和锁哈希，同时对当前 main 的准确依赖锁及完整依赖图进行核对；统一 Windows 测试夹具的路径表示；一次职业候选调用内复用纯派生结果，下次调用重新核对当前角色。新增红例保留，32 次重复派生降为 1 次，属性与来源变化、非突变及既有支持检查 12 项通过。

过程结果不拼接成最终通过：旧源码上的七项 item HP 客户端检查曾全部通过；新来源分组首轮 869 通过／4 项原 5 秒超时，隔离组为 871 通过／2 项原 5 秒超时；更改临时目录后的关键组为 25 通过／2 项超时。148 例 App 清单已发现，但报告锁门禁阻止启动时，实际用例均为未执行。Data 的旧环境完整单元为 1061 通过／60 失败／189 待执行或条件跳过，须逐项区分；默认临时目录所在 exFAT 分区不能提供所需符号链接。NTFS 复验进行中。初轮不受限并发的 Data 调用已停止，不记为最终验收。Data 的 Node 15 项、Python 6 项通过；最终提交仍须运行全部适用 CI、编译与构建。


补查初始 main：Web `accb00f` 的 36 个检查任务全部成功。Data `5ee1e38` 在后来计划运行 [40297309624](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/40297309624) 中，validate 与历史 UI8 保留验证成功，live 全库 pipeline 因一个冒险资料地址 404 失败；该文件不在本批冻结的 229 份输入内，本次对原地址及转义地址的只读 HEAD 核查均为 404。既有普通 PR／推送事件会按原条件跳过这个 live pipeline，本轮未删除该任务、未放宽规则，也不把它记为通过。此项上游阻塞与本批最终源码的固定来源验收分别记录。

NTFS 本机 Data 调用还发现环境配置错误：本轮 Web 夹具的来源目录被传给未开启对应显式开关的 Data 分组，三个文件因此按原安全检查拒绝启动。该次为 1106 通过、15 失败、71 条 pending 记录；并非合格全套结果。其余失败包括 Windows 文件符号链接 EPERM、临时目录 EBUSY 和新报告尚未替换时的模块数量门禁。后续正常 CI 使用独立配置，不删除这些失败或改成条件通过。


完整固定来源执行完成：18,789 条、4,561 已核对、7,858 个至少一项机制见证、522 不可用、0 未决，保留全部身份／审阅标记及 229 份输入哈希。相对 main 新增 1,324 个见证，相对普通施法候选新增 224 个，均无见证丢失；11 个已有见证因新的自然 AC／被动物品加值更新了观察机制。304 个代码／JSON 门禁逐项核对实际 Git 字节；一份 CSS 在独立组装记录中绑定。首次组装误列 CSS 的失败保留，原校验器不变；12 项池／检查点／组装防护通过。完整收据原头及绑定未改，源码／别名树、观察配方和 adapter 字节一致后才恢复组装。

报告 5,092,393 字节，SHA-256 `177d40f613280039bbd8cc5165b594385c4485ebaa3b57848e0634a4edebd743`，Git blob `d6bdeb96052de284f5b14ebed4daf16a48bc771b`。Data 实际本地提交 `e8a816a251ee507f44db5ea9846b2b0f28ee85d8`。此为当前产品源码的真实完整观察，新的 App／最终 CI 仍需执行；旧 UNKNOWN 内容对象请求未重试。
