# 230 后续 Web 修复清单 · 2026-10-01

本轮在 `FullPeople/DND-card-web` 的 `codex/web230-followup-20261001` 保存成果。基线经 `fetch`、祖先检查与 `ls-remote` 核实：main 和 release230 均为 `4e398a39a5cb37e5e632ae377fdf2488cdc3924c`，保留 230 集成 `db223af57bd3df9e5422534de5d9a0806cd8832f` 及国内运行源码 `1d5c87cd9cfd1aab4bae1dbb564457bb3c5d0cc8`。没有采用旧 229 工作树，没有合并 main、发布生产版本或操作玩家数据。下方既有 230 发布回执仍是线上状态，本清单是后续修复候选。

## 需求 → 已修 → 实测 → 剩余

| 需求 | 已实施 | 本轮证据 | 剩余边界 |
| --- | --- | --- | --- |
| 1. 职业黄色提醒 | 警告图标与同行横幅从延迟下载的设置样式移到首屏样式，恢复黄色。文案按角色版本显示，仅职业触发，原匹配逻辑保留。 | 1512 / 390 px 首次打开、未进入设置即检查实际颜色与无溢出；自定义种族/背景/特性/专长/装备/法术不报警。同步副本回归同时验证原角色、个人次数和数量保留、匹配后横幅消失。 | 未用玩家原卡验收；2024 与 2014 仍独立。 |
| 2. 历史骰子显示 / 取消 / 互斥 | Web 原协议透传保留；修复同 rollId 暗骰公开漏更新、目标切换的迟到回执覆盖、重连不重新初始化。群体结果窄屏每目标一行，数字与状态完整。发现并协调 Suite 修复旧群体回显。 | Web 桥接双引擎宽窄回归通过；最终 Web488 / Suite3fc 的原脚本 15 项生产组件 + 实际 SDK 配对全部通过，取消后 DOM 为零，旧群体不复活，Action 连点 open/close。 | 本地配对通过；真实登录房间、多人权限和物理投掷仍未验收。历史按钮及数字绘制由 Suite 修复，Web 无越界改动。 |
| 3. 资源仪表盘 | 全灰卡；颜色只影响图标。模块选择填写名称、当前值和可选上限，16 种预览与拖拽幽灵即时更新；有上限直接显示当前/上限，无上限直接显示数字，无 `∞`。二级菜单统一卡片。移除快捷栏额外休息行，资源/生命骰/仪表盘保留完整休息与回执，空卡也可休息。 | 最终 9 条新增资源场景 × 两引擎 = 18 通过。既有 Chromium 广回归 54 通过，补充原生弹层与原休息流程 4 通过；84 定向单元通过、1 外部规则条件跳过。 | 实体触屏、真实 Suite 权限及玩家房间仍未验证。 |
| 3. 数据与误操作恢复 | 保留余额、类型、来源、自动资源规则与休息恢复。设置取消、拖拽取消和布局放弃不落地。休息弹层位于原生 dialog 顶层，Esc 只关休息，返回焦点；未保存图标布局与确认休息余额可正确合并。 | 旧上限、契约独立池、共享池、2/4/6/9 环、旧 ACK、并发上限、撤销重做、保存刷新；空资源卡及未保存图标草稿的取消 / Esc / 确认。 | 原有自动资源受规则管理，不能把它当作任意自定义数值。 |
| 4. 自动化选择 | 完成与待选气泡使用明确的选择/调整/折叠入口，修复完成气泡被资料点击接管。展开工具显示来源、切换与进度；Esc 先取消拖拽，再退出；返回恢复焦点。候选索引与叶子组件隔离减少拖动重算，非施法选择使用小范围事务。 | 5 条原创新增选择场景 × 两引擎 = 10 通过；包含重复原格、跨格交换、替换、取消、快速切换、慢资料、保存刷新与窄屏返回 A4。2,000 条原创 Wiki、12 次悬停记录 0 次角色深拷贝、无记录长任务。 | 5 浏览器 / 18 单元真实职业资料场景在子任务中因缺快照跳过；没有补齐全部职业自动化或宣称所有设备性能。 |
| 5. 图片参考的三列布局 | **阻塞，未实施。** 当前 Library 支持流程的 `prepare_materialize` 返回完整元数据，下载助手持续报失败，目标文件实际不存在。已按父任务要求停止重试。 | 本 executor 已检查文件不存在；没有查看用户原图，也没有公开上传它。只对原创验收截图做视觉检查。 | 必须在可访问原图的 executor 物化并查看后再实施约 44% A4 / 24% Wiki / 32% 详情、独立滚动和窄屏降级；不以文字猜测替代。 |
| 6. 发布链清理 | 删除 Pages 配置/上传/发布 job、Windows 启动脚本与桌面 ZIP 生成入口，更新现行说明。保留国内 `/card` 网页版、`build:standalone`、domestic 构建、离线缓存及历史资源覆盖保留机制。 | 双入口构建通过；YAML 校验保留原 6 组浏览器命令，新增双浏览器 follow-up 第 7 组，主分支/PR/manual 触发不变；无部署 job。 | 未删除线上站点、历史 release 资源或更改账户。远端 CI 本分支不自动触发，本轮未执行完整 CI。 |
| 7. 首屏编辑下载失败 | 实际注入 cardRuntime 首次下载失败，旧 230 永久禁用编辑且无恢复入口。新增错误详情、导出备份与“保存后重新加载编辑功能”；等待保存队列，保存失败阻止重载，成功后继续编辑。 | 同一故障在隔离旧 230 基线失败复现；修复后两引擎读取原卡、导航、重连、恢复编辑、保存刷新，笔记与 2/5 资源逐字段保留。 | 重载会重新下载失败模块；全新浏览器在完全离线且未缓存编辑模块时仍需联网。 |
| 7. P2：读取备份后重试 | 独立读审指出当前恢复入口只等队列、未保存已接受备份。实测确认重载回到先前磁盘版本，补未保存状态及离页保护；重试沿原队列原子保存完整已接受工作区，成功才重载。普通重试不轮换有效备份；失败、只读和快速连点受保护。 | 新六条 × 两引擎 = 12 通过：不同姓名/笔记/修订/敏捷/临时生命/4/9资源恢复持久化、另一角色与独立草稿逐字段保留、取消离页、事务失败后重试、普通重试、连点和真实本地编辑锁。详见 [P2 清单](BACKUP-EDITING-RECOVERY-231.md)。 | 已读取完整备份的原语义保留，没有改成选择性合并；真实 Suite 房间备份与多人权限未由此单机测试替代。 |
| 7. Wiki / 慢加载 / 离线恢复 | 保留 230 启动拆分与 Wiki 队列恢复机制，补双引擎验收。额外关闭真实本地 Web 服务器验证已用编辑/Wiki/法术页缓存回开和继续保存。 | 含 P2 的最终启动/Wiki/编辑组 50 通过、2 工具边界跳过：Chromium 26/0、Firefox 24/2。覆盖主体延迟、页面延迟/失败、拼音按需、暂时/持续/中途断线、缺失文档、缓存复用、默认 A4、保存偏好。实际服务器断线两引擎均通过。 | Firefox 两项 Playwright ServiceWorker 请求路由/离线控制不支持；另有真实服务器停机覆盖。公网线路、生产 Wiki 全库下载与真实登录房间未验证。 |

## 门禁与复现

环境 Node `v24.19.0`、npm `11.9.0`，满足项目要求。使用项目现有 Vitest / TypeScript / Vite / Playwright，没有修改网络或浏览器安全设置。

慢加载采用响应门控与故障注入，验证等待、返回、保存、恢复及逐文件重试；本轮没有重做吞吐限速基准，历史 230 的公网或 32 KiB/s 性能数字不计为本轮新测。

| 检查 | 最终结果 |
| --- | --- |
| `npx tsc -b --pretty false` | 通过 |
| `npm run build` | 通过，保留既有大 chunk 提示 |
| `npm run build:standalone` | 通过，国内单机网页版未删 |
| `npm test` | 74 文件通过 / 1 条件跳过；486 测试通过 / 23 条件跳过 / 0 失败 |
| `playwright.followup231.config.ts` | P2 后完整重跑：50 通过 / 2 Firefox 工具条件跳过 / 0 最终失败 |
| `playwright.followup-ui231.config.ts` | 前批相关源码分批收口 42 通过 / 0 跳过 / 0 最终失败：资源 18、选择 10、骰子宽窄 8、同步与休息生命周期 6；P2 未改这些组件，未重复整组 |
| `tools/verifyPairedDice230.mjs` | 最终冻结Web488 / Suite3fc，原15项实际SDK配对全部通过；双宽度取消DOM清零、0 pageerror；真实房间/物理投掷不在此覆盖 |
| YAML / `git diff --check` | 通过 |
| lint | 项目没有独立 lint script，未虚报执行 |
| WebKit | 浏览器下载成功，但缺 GTK4、graphene、harfbuzz-icu、manette、hyphen、GLES2 系统依赖，未进入产品交互。安装依赖受本机管理员条件限制，未改变安全设置 |
| 远端完整 CI / 国内部署 / 真实房间 / 实体触屏 | 未执行；应在父任务审查和协调后的阶段验收 |

可重跑：先构建，再运行两份已提交 follow-up Playwright 配置。浏览器目录本机为 `/workspace/playwright-browsers`；Firefox 在受限沙盒报告找不到 profile，获自动审查批准的本机测试执行中成功启动。不是自动批准拒绝，也没有停用浏览器安全。WebKit 单独列未测，不能计为通过。

本机完整原始材料位于忽略目录，文档与原创截图随分支保存。日志路径不是其他 executor 可直接使用的文件路径：

- `.local-evidence/backup-retry231-unit.log`：P2 最终完整单元；此前 `followup231-unit-frozen.log` 保留。
- `.local-evidence/backup-retry231-{typecheck,build,build-standalone-final}.log`：P2 最终构建与类型；此前 `followup231-build-{integrated,standalone}-final.log` 保留。
- `.local-evidence/backup-retry231-final.log` / `backup-retry231-final/`：P2 后完整 52 项启动恢复回归；此前 `followup231-startup-final.log` 的 40 项保留。
- `.local-evidence/followup231-ui-final.log` / `followup231-ui-final/`：最初 32 项跨浏览器 UI 收口；后续受影响资源场景重新运行。
- `.local-evidence/followup231-ui-rest-final.log` / `followup231-ui-rest-final/`：最后 18 项资源回归。
- `.local-evidence/followup231-lifecycle-mode-fixed.log` / `followup231-lifecycle-mode-fixed/`：同步与休息生命周期最终复验。
- `.local-evidence/followup231-dice-toggle-final.log` / `followup231-dice-toggle-final/`：加入既有 `toggle` 意图后的最终骰子双引擎宽窄复验。
- `.local-evidence/baseline230-failure.log` / `baseline230-browser-failures/`：原 230 黄色与编辑失败缺口的失败证据。

两项 Firefox 跳过的原因是 Playwright 工具接口边界：[官方 Service Workers 说明](https://playwright.dev/docs/service-workers)。真实服务器停机用例不依赖该接口，已在 Chromium 和 Firefox 执行。

## 首轮失败与修正保留

1. 隔离原 230 注入编辑模块下载失败，没有恢复元素；首次警告底色透明。这是可重现产品缺口，已修复。
2. Firefox 普通沙盒不能建立 profile；获批的本机执行方式可启动。WebKit 缺依赖保持未测。
3. Firefox 的两项 ServiceWorker 工具故障注入先失败，按官方支持边界标条件跳过，并增加真正关停服务器的跨引擎缓存回归；没有以跳过宣称产品通过。
4. 收尾 lifecycle 配置先因锚定完整测试名过滤得到“无测试”，修正过滤后仍把旧 standalone 数据库用例置于 automation 模式，出现两项数据库 object store 错误。按各夹具原有模式分开服务后重跑；没有删除断言或修改生产数据库。
5. 资源首轮误用 standalone 宿主模式、旧展示断言、契约池数字节点丢失、窄屏图标压缩、空卡休息入口与原生 dialog 层问题，均在 [资源清单](RESOURCE-FOLLOWUP-231-RESULT.md) 记录失败、修正和复验。
6. 选择测试最初发现完成气泡不能展开、按钮标签不准确；另有测试产物并发清理事故，改为串行收口。完整记录见 [自动化清单](AUTOMATION-230-FOLLOWUP.md)。
7. 独立读审提出备份读取后重试会丢掉内存恢复版本。新增夹具先误把敏捷数字当成对象，修正后在 4da0 基线实际失败；P2 修复后的不同字段、原子事务失败和恢复完整回归均通过，详见 [P2 清单](BACKUP-EDITING-RECOVERY-231.md)。

## 实际 SDK 最终配对与历史失败对照

最终锁定 Web `488ea1bee7e46b763f80d2bb331420ad5ea583c0` 与 Suite 代码 `3fc7c710019bd7ac705915d5b91e633aeeb4215f`（分支 `codex/suite-host-repair-20261001`）。独立读取 Suite 报告提交 `dd55be38638fd828352ca379fc55f954735a5c73` 的 `docs/SUITE-DICE-REPLACEMENT-20261001.md`，随后自行生产构建并使用原 `tools/verifyPairedDice230.mjs` 重跑；没有以对方报告替代本机验证，也没有改断言。Suite tracked 源码前后干净，本 Web 任务没有修改 Suite。

**最新配对 15 通过 / 0 失败 / 0 跳过，退出 0、pageerror 为 0。** Chromium 390 / 1280 px：Web 单人和群体历史第二次点击后 `.token-result` 为零，取消另一条历史后旧自动群体不再回显；Action 同项取消、切换互斥、延迟 SDK 广播与回执下快速双击 `open/close` 均通过。最终 [3fc 结构化结果](evidence/dice230-paired/3fc-results.json)、[窄屏取消](evidence/dice230-paired/3fc-narrow-single-cancel.png)、[宽屏取消](evidence/dice230-paired/3fc-wide-single-cancel.png) 保存到仓库，精确复现和命令见 [配对报告](DICE-FOLLOWUP230-PAIRED.md)。

配对使用实际安装的 OBR SDK、Web `DiceFrame`、Suite `diceRpc` / history UI / token-results / overlay 标签；宿主消息、场景控制器与物理 renderer 由本地测试替代，**不是真实登录房间、多人权限或物理骰子验收**。配对 Firefox 未运行；Web 自身回归已在 Chromium / Firefox 执行。Web 公告为配对 230，Suite manifest 仍源基线 227，父任务明确要求正式发布时统一版本，本轮不自行发版。

此前 f78 配对 11/4，259 配对 13/2，保留为历史失败：Web 正确发送单人 `open LOCAL/REMOTE → close LOCAL/REMOTE`，但 Suite 关闭 history 后重新绘制其他旧 `groups`，出现 `14member`、opacity 1；f78 还在延迟回执时连点发送 `open/open`。父任务分别修复 Action 意图顺序、ready=false 微任务问题，以及进入历史后隐藏全部旧自动组。旧 SDK-stub 45/45 不覆盖该组合；原脚本在新 3fc 变为 15/0 后才撤销当前回显阻塞结论。[259 结果](evidence/dice230-paired/259-results.json) 与旧截图仍作为对照，不能当作最新版本的失败。所有材料为合成验收数据，用户原图未进入仓库。

## 分阶段保护与审查入口

每批推送后已使用 `git ls-remote` 对完整 SHA，未仅凭 push 输出宣称保存。

| 批次 | 完整 SHA | 内容 |
| --- | --- | --- |
| 1 | `0374225d7d484d06779ac1425aac258838606249` | Pages / 桌面包清理 |
| 2 | `a2f7eed58b25b3c40b9b41c80ed31e04ec126e75` | 黄色提醒与编辑模块恢复 |
| 3 | `c5b3e479cafd2665f03427ffc2ac229c36fd3d8e` | 骰子桥接、竞态和窄屏群体布局 |
| 4 | `3b833576f974f4eb8aee669a2dab3bb6c03ad740` | 资源卡与实时预览、原休息机制保留 |
| 5 | `4ad925fc86a409dbb987f267836ad88bdd75c38c` | 选择展开与拖入事务性能 |
| 6 | `a6f5f29225d7c94ec61f05ee4b4970510ffd1c06` | 空卡休息与原生弹层草稿、实际离线回归、双浏览器门禁、原创截图与分项文档 |
| 7 | `4da0b4cd6f37d1c2ad6181baeee2864d25df50ac` | 首轮完整交接与原 259 配对失败证据 / 可重跑脚本 |
| 8 | `488ea1bee7e46b763f80d2bb331420ad5ea583c0` | P2：编辑重试前保存已读取备份、取消 / 失败 / 只读 / 连点保护与双引擎回归 |

最终相关 Web 浏览器共 92 通过 / 2 工具条件跳过 / 0 最终失败：本次启动50与前批其他相关组件42，不把重复运行次数累加为独立覆盖。最终源码 SHA 为第 8 批 `488ea1bee7e46b763f80d2bb331420ad5ea583c0`，已核对远端；其后的交接提交只保存报告或联调材料。Suite 配对结果独立记录，不与 Web 通过数混算。

分项文档：[资源](RESOURCE-FOLLOWUP-231-RESULT.md)、[职业选择](AUTOMATION-230-FOLLOWUP.md)、[骰子 Web](DICE-FOLLOWUP230-WEB.md)、[实际 SDK 配对](DICE-FOLLOWUP230-PAIRED.md)、[发布清理](PUBLISH-CLEANUP-230-FOLLOWUP.md)、[备份恢复 P2](BACKUP-EDITING-RECOVERY-231.md)。永久视觉证据均来自原创验收角色，未保存用户原图或上游规则正文：[资源宽屏](evidence/resources231/gray-preview-wide.png)、[资源窄屏](evidence/resources231/gray-preview-narrow.png)、[空卡休息](evidence/resources231/empty-resource-rest-dashboard.png)、[选择窄屏](evidence/automation230/slow-narrow.png)、[备份保存失败保护](evidence/backup-retry231/save-aborted.png)。

## 后续工作与体验建议

- 先解决原图消费阻塞，再完成明确要求的三列布局。当前默认仍保留 230 排版，不能把窄屏选择工具的局部改进算作三列改版完成。
- Suite 最终本地 SDK 配对已经通过，生产协调仍需真实登录房间、多玩家权限、真实棋子与原设备验收；发布时统一 manifest 与公告版本。
- 补私有规则快照后运行真实职业资料抽样，再依既有覆盖表推进职业自动化；本轮只改善交互和事务，不虚报全职业支持。
- 资源休息放在资源/生命骰/仪表盘的入口，首次使用可加简短发现提示；继续清楚区分规则管理次数与自定义数字。
- 普通选择立即保存、装备明确领取，当前文案已说明返回保留。若以后统一为“保存 / 放弃”草稿模式，需先确认规则事务边界。
- 等父任务审查通过后再协调生产上线，并执行真实房间、实际网络与玩家设备验收。此次分支仅保护修复成果。
