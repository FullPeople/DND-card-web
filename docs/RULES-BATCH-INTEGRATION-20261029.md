<!-- RULES_BATCH_CURRENT_BEGIN -->
# 2026-10-29 规则整批集成验收记录

整合入口为 Data [#85](https://github.com/FullPeople/dnd5e-automation-data/pull/85) 和 Web [#137](https://github.com/FullPeople/DND-card-web/pull/137)。纳入范围为 Data #77–84、Web #120、#122–136，共 24 个原始 PR；下表保留其准确提交及依赖。最新合并状态、最终 main SHA 和准确提交的 CI 结果以这两个 PR 的检查及合并回执为准。

当前完整报告的实际 Data 锁为 `a15f0975f58898a008454201753b235e130270c2`，报告 5,092,393 字节，SHA-256 `b61af200abc291426a317ccfe5af9c7ca85f426bca0b93a1896b53b899e2c459`，Git blob `480af10abd55d15bfbfd7aa1d4a0e562cbb5a1ba`。Web 报告及组装收据直接读取该 Data 提交的 Git blob，逐字节相同。实际观察消费者为 Web `8c95ef37da452b280211212768c03a58f33ebf8f`，完整 src 树 `ddbe8ee6ec4e03d2e9e68d9f3a2fec111d8bc521`；生成器为 Data `4ca4cbb00b54f82dc237efbce5201cf924dc6587`。运行模块 304 个、独立样式 2 份均核对真实文件与 Git 字节，完整源码树同时绑定。

本轮从该源码执行全部 18,789 条真实观察，前后接续同一绑定的 6,158 条回执，完整观察日志及其原头均保留；没有使用另一源码的旧观察代替重算。结果为 7,858 条至少一项机制见证、4,561 条已核对、522 条不可用、0 条未决，229 份输入和身份／审阅标记保持。这是运行机制见证数，不是整条规则完成率或线上完成率。

普通施法与资源记账 actor 从同一完整报告绑定，保留实际字节核对及负例。 配对后的五份绑定／隐私文件 44 项通过，TypeScript 编译通过；准确导航读取暴露的可选测试值已增加真实存在性检查，未关闭严格类型检查。法术页复用本次渲染的纯派生状态，下一次角色变化重新计算，没有跨角色缓存；原 5 秒限制下两份客户端文件 8 项通过，相关预备／工作区／离线防护 26 项通过。只读新视图要求零条动作回执，按钮禁用及整张角色不变检查保留；拒绝拖入的等级场景精确匹配真实选择格提示，并增加实际职业等级和整张角色不变检查。角色读取采用实际持久化导航身份，来源操作等待持久化设置确认。

完整 App 清单为原 148 例加真实 Worker 回归 2 例，共 150 例，桌面／窄屏各 75。每个视口按 26／24／25 例拆为三组；全清单和六组并集已经逐项核对，无缺项、无重复，保留原 35 分钟任务上限、每例限制、全部断言及零重试。验收要求准确提交的六组实际回执合计 150 通过、零失败、零条件跳过、零未完成；并核对 63 例 main 交互、两库适用 CI、编译、各前端构建、数据与消费者配对、玩家手工值及资源保护。清单发现和旧提交的通过不替代这些门槛。

过程失败单独保留：Web `4d29373` 的 150 例在原整项任务上限中断，实际完成 104 例（97 通过、7 失败），46 例未完成；没有算作完整通过。定向修复后 8 例复跑为 7 通过／1 失败，余下一例在改用准确导航和来源保存确认后单独通过；不拼接成完整新提交结果。离线重开专项实际通过，切断网络前增加等待已用独立页头缓存，原重开页头可见断言保持。较早 Windows 全套为 7,608 通过、5 失败、100 条条件跳过，属于另一源码阶段的诊断；符号链接和 0600 权限断言未放宽。Data `4ca4cbb` 的准确 CI 为 1,123 通过、189 条历史版本绑定条件跳过；当前普通施法专项另有 45 通过、Node 15 通过、Python 6 通过。这些过程结果不替代本次最终 head 的结果。

本轮授权只到修复、验证和合格部分正常合并，不部署生产、不改玩家数据、不自动提交 APPROVE 审查。旧 runtime 报告内容对象请求的有效性和终态仍为 UNKNOWN，具体原生编号保留在本地交接回执；只读 404 不作终态，未重试旧 create_blob，也未写旧计划分支。该操作不绑定路径或分支，与另一次被拒的飞行元数据上传分别保留。本批使用明确批准的独立新分支及后续修复授权。
<!-- RULES_BATCH_CURRENT_END -->

## db1d7fe 准确提交的完整复验与后续修复

Web `db1d7fe08eddf24a29ce74f7f77bba7aeeb8fbd7` 的远端 150 例完整执行，桌面／窄屏各 75，146 通过、2 失败、2 超时，零条件跳过、零未完成、零重试；六份安全回执与完整清单逐项对应，没有发布原始来源或角色快照。[完整运行](https://github.com/FullPeople/DND-card-web/actions/runs/40879768598) 不能算作通过。该提交的 main 交互 63 例通过；常规单元为 6,732 通过、982 条条件跳过，新增来源专项另行执行，未把条件跳过计为通过。

该提交共有 42 个检查成功、6 个失败。除上述资源记账两组外，盾牌悬停比较过早捕获了首次打开前的角色基线，另三组旧浏览器回归的资料覆盖只作用于页面，真实 Worker 仍读取公共默认夹具。后续测试修复等待实际保存的自动生命骰后再比较整张角色，并将 53 份测试的 122 个公共资料 route／unroute 改为同一浏览器 context；独立逐文件核对只变更该接收者，API、静态资源路由、断言、时限均保持。盾牌 8 例和特性动画 4 例本地复验通过，严格类型编译通过。

资源记账的有限奖励选择改用当前源码定义的“职业”分类；窄屏打开自动化设置前通过实际“功能页”按钮返回角色卡，来源勾选等待持久化确认。完整条目身份、手工值、资源余额、只读、撤销／重做和原生导入导出断言保留。这些修复只涉及测试与记录，产品 src 树及完整运行报告字节不变；须在新的准确提交重新执行全部必要 CI 和 150 例，不拼接上一提交的通过结果。

## 历史过程快照

以下原样记录各阶段；其中“当前”“尚未上传”“待执行”只指记录时点，不代表最新结果。

# 2026-10-29 规则整批集成验收记录（进行中，未合并、未部署）

当前完整回放报告锁定真实 Data 提交 `4ca4cbb00b54f82dc237efbce5201cf924dc6587`，消费者 Web `bc419f961f0106062a62c2885c2e96fb7a04e935`，源码树 `d37d46c6ed0cd21e81e8de3a48cb4417c12cebd0`。新报告 5,092,393 字节，SHA-256 `da3c1a3eb781c7c39f41b6a8032a95381e28c1af8b36162cd6ad1aeda39e4962`，Git blob `1a96c6e723b5ad280bcbb35251f653037f4b5506`。Web 报告及组装收据直接取该 Data 提交的 blob，逐字节相同；304 个运行模块和两份样式均与实际 Git 字节独立核对。

完整 18,789 条新观察已经执行并通过原校验；7,858 条至少一项机制见证、522 不可用、0 未决，229 份输入与所有身份／审阅标记保持。和上一轮同计算逻辑的完整记录逐条相同，不把 A4 修复称为新增规则。最终提交的完整单元、150 例 App、63 例 main 交互、构建和远端 CI 尚未完成；下文过程通过不替代这些门槛。独立新分支已推送，Data #85 与 Web #137 均为 main 整合草稿；尚未合并或部署。

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

第一轮产品源码冻结于 Web `fe6a5fde96c5ea97cb82087b11898e283a670e91`，源码树 `71ad399d3e793d86aea2ed6fe9ef4768323de922`；生成器为 Data `8b6caf72f4c255219052d9c42d053ab190f34610`。完整观察现已执行完毕，报告实际提交为 Data `e8a816a251ee507f44db5ea9846b2b0f28ee85d8`（仅本地，尚未上传）。Web 副本与该提交逐字节相同，并使用此真实提交的版本锁。此前另一源码上的部分回放及所有原失败保留，不计入这份新源码的最终证据。

修复包含：合并主线的交互和隐私保护；从回放报告统一读取普通施法 actor 绑定并保留实际文件字节断言；为完整 CI 准备全部十九族输入与独立物品施法政策原件；保留旧客户端完整源码和锁哈希，同时对当前 main 的准确依赖锁及完整依赖图进行核对；统一 Windows 测试夹具的路径表示；一次职业候选调用内复用纯派生结果，下次调用重新核对当前角色。新增红例保留，32 次重复派生降为 1 次，属性与来源变化、非突变及既有支持检查 12 项通过。

过程结果不拼接成最终通过：旧源码上的七项 item HP 客户端检查曾全部通过；新来源分组首轮 869 通过／4 项原 5 秒超时，隔离组为 871 通过／2 项原 5 秒超时；更改临时目录后的关键组为 25 通过／2 项超时。148 例 App 清单已发现，但报告锁门禁阻止启动时，实际用例均为未执行。Data 的旧环境完整单元为 1061 通过／60 失败／189 待执行或条件跳过，须逐项区分；默认临时目录所在 exFAT 分区不能提供所需符号链接。NTFS 复验进行中。初轮不受限并发的 Data 调用已停止，不记为最终验收。Data 的 Node 15 项、Python 6 项通过；最终提交仍须运行全部适用 CI、编译与构建。


补查初始 main：Web `accb00f` 的 36 个检查任务全部成功。Data `5ee1e38` 在后来计划运行 [40297309624](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/40297309624) 中，validate 与历史 UI8 保留验证成功，live 全库 pipeline 因一个冒险资料地址 404 失败；该文件不在本批冻结的 229 份输入内，本次对原地址及转义地址的只读 HEAD 核查均为 404。既有普通 PR／推送事件会按原条件跳过这个 live pipeline，本轮未删除该任务、未放宽规则，也不把它记为通过。此项上游阻塞与本批最终源码的固定来源验收分别记录。

NTFS 本机 Data 调用还发现环境配置错误：本轮 Web 夹具的来源目录被传给未开启对应显式开关的 Data 分组，三个文件因此按原安全检查拒绝启动。该次为 1106 通过、15 失败、71 条 pending 记录；并非合格全套结果。其余失败包括 Windows 文件符号链接 EPERM、临时目录 EBUSY 和新报告尚未替换时的模块数量门禁。后续正常 CI 使用独立配置，不删除这些失败或改成条件通过。


完整固定来源执行完成：18,789 条、4,561 已核对、7,858 个至少一项机制见证、522 不可用、0 未决，保留全部身份／审阅标记及 229 份输入哈希。相对 main 新增 1,324 个见证，相对普通施法候选新增 224 个，均无见证丢失；11 个已有见证因新的自然 AC／被动物品加值更新了观察机制。304 个代码／JSON 门禁逐项核对实际 Git 字节；一份 CSS 在独立组装记录中绑定。首次组装误列 CSS 的失败保留，原校验器不变；12 项池／检查点／组装防护通过。完整收据原头及绑定未改，源码／别名树、观察配方和 adapter 字节一致后才恢复组装。

报告 5,092,393 字节，SHA-256 `177d40f613280039bbd8cc5165b594385c4485ebaa3b57848e0634a4edebd743`，Git blob `d6bdeb96052de284f5b14ebed4daf16a48bc771b`。Data 实际本地提交 `e8a816a251ee507f44db5ea9846b2b0f28ee85d8`。此为当前产品源码的真实完整观察，新的 App／最终 CI 仍需执行；旧 UNKNOWN 内容对象请求未重试。


全套单元在新启动网络阻断下复现了 main 真实 HTTP 测试被拦的冲突，首次全套因此中止，不作为完整通过。修复仅在六份真实 HTTP 夹具中显式注册当前监听的本机服务器，使用严格限定到该监听地址的 HTTP 客户端；不恢复／保留原生 fetch，不允许公共地址或未注册端口，不跟随跨域跳转，原权限、CSRF、配额、保存和会话断言保持。六份原 HTTP 文件加两个客户端边界测试共 95 项通过，编译通过。产品 src 树仍为同一 `71ad399d3e793d86aea2ed6fe9ef4768323de922`，不冒充新的规则回放。


Web `2394814` 首次真实 App 执行在 23 项完成后停止修复：15 通过、8 失败，其余 125 项未完整执行（含中断中的一项），无完整通过结果。失败证据保留于本地。A4 先攻格的 24px 内容区裁切约 26px 字形；在不减小 18px 数值字号、不改 A4 尺寸／断言的情况下调整内部空间，独立诊断完整首场景通过。另确认 main 的后台资料 Worker 不受原 page.route 来源夹具覆盖，造成真实网络等待与共享来源不同步；改为上下文级来源夹具，同时保留真实 Worker。两项独立诊断均通过，但不计为最终 App 全套。新增 Worker 夹具回归纳入同一配置后，完整清单扩为 150 例。Data 当前正常 Windows 单元再次遇到符号链接 EPERM，执行已中止，不能称为最终完整结果；Linux CI 仍须验证这些原断言。


真实 App 后续修复产品源码冻结为 Web `bc419f961f0106062a62c2885c2e96fb7a04e935`、src 树 `d37d46c6ed0cd21e81e8de3a48cb4417c12cebd0`；新 Data 生产者为 `f769ac89995eaa5fea980c42d95134bebeb52844`。新回放为同一源码的新观察；经逐条摘要校验，接续本轮自己的 6,571 条完整收据，未读取前一不同源码回放作为新观察。

Web 全套单元的 512 MiB 运行内存不足，未生成完整结果：304 份文件已报告 6,222 条，其中 11 失败、48 跳过，177 份文件未完整执行。此轮只作诊断，不能称为全套通过。已发现的源码绑定重复锁改从完整回放报告读取固定 22 份文件集，保留实际文件字节验证并新增缺失／重复／未固定 revision／改动真实文件字节的红例；与普通施法和两组安全截图路径检查共 35 条全部通过，TypeScript 编译通过。Windows 截图路径统一分隔符，不修改截图隔离、隐私排除或布局断言；符号链接及 0600 权限保护原断言未放宽。新增 item HP 5 条交互和 2 条 UI 检查在当前源码实际通过，全族 28 条也均通过；不替代后续最终提交的 CI。

来源夹具修复后的定向 App 为 5 通过／1 失败；未通过的祈唤拖拽只取移动前坐标，改用既有真实指针及当前命中位置校验助手，保留接受／拒绝与持久化断言。随后与高负荷计算并行的 150 例尝试为 0 通过／5 加载超时失败／145 未完整执行，已停止，完整 150 例需单独重跑。原 148 例中断尝试为 15 通过／8 失败／125 未完整执行，未计为验收。


独立进度验证入口现使用与全套相同的启动网络阻断包装器，完整保留原 23 份测试及三份验证文件，并固定单 worker；没有删除测试、修改重试或增加断言时限。需实际重跑才写验证收据。


Web e2c0ebb 的 CI 在浏览器前置门禁失败，App 未执行。已保留准确 head 的原日志：CI 彩色输出不能通过原精确错误文本匹配，现只剥离终端显示控制码、保留原完整锚定错误断言／失败退出／网络零调用；测试固定复现彩色 GitHub Actions 输出。普通施法身份已拆到 ordinaryCastingIdentity.ts，原生导入门禁增加此真实入口，覆盖全部 8 处 JSON import（含新 nonunit 证据），每处均在实际 Node ESM 中验证字节相同；未删除原入口、未削减断言。两文件 14 项通过。验收工作流增加手动验证入口，用于合并后在真实 Web main SHA 重跑完整 150 例；不调用发布工作流。
