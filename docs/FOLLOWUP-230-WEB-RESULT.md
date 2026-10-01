# 230 后续 Web 修复清单 · 2026-10-01

本轮在 `FullPeople/DND-card-web` 的 `codex/web230-followup-20261001` 保存成果。基线经 `fetch`、祖先检查与 `ls-remote` 核实：main 和 release230 均为 `4e398a39a5cb37e5e632ae377fdf2488cdc3924c`，保留 230 集成 `db223af57bd3df9e5422534de5d9a0806cd8832f` 及国内运行源码 `1d5c87cd9cfd1aab4bae1dbb564457bb3c5d0cc8`。没有采用旧 229 工作树，没有合并 main、发布生产版本或操作玩家数据。下方既有 230 发布回执仍是线上状态，本清单是后续修复候选。

## 需求 → 已修 → 实测 → 剩余

| 需求 | 已实施 | 本轮证据 | 剩余边界 |
| --- | --- | --- | --- |
| 1. 职业黄色提醒 | 警告图标与同行横幅从延迟下载的设置样式移到首屏样式，恢复黄色。文案按角色版本显示，仅职业触发，原匹配逻辑保留。 | 1512 / 390 px 首次打开、未进入设置即检查实际颜色与无溢出；自定义种族/背景/特性/专长/装备/法术不报警。同步副本回归同时验证原角色、个人次数和数量保留、匹配后横幅消失。 | 未用玩家原卡验收；2024 与 2014 仍独立。 |
| 2. 历史骰子显示 / 取消 / 互斥 | Web 原协议透传保留；修复同 rollId 暗骰公开漏更新、目标切换的迟到回执覆盖、重连不重新初始化。群体结果窄屏每目标一行，数字与状态完整。 | Web 桥接在两引擎、1512 / 390 px 验证单人/群体打开关闭、初始化竞态、内容去重与重连；旧代码故障已实测。实际 SDK 配对发现仍有 Suite 回显缺口，见下文。 | **联合需求仍未完全通过。** 历史按钮、棋子头顶及物理 overlay 由 Suite 实现；Web 无越界改动。 |
| 3. 资源仪表盘 | 全灰卡；颜色只影响图标。模块选择填写名称、当前值和可选上限，16 种预览与拖拽幽灵即时更新；有上限直接显示当前/上限，无上限直接显示数字，无 `∞`。二级菜单统一卡片。移除快捷栏额外休息行，资源/生命骰/仪表盘保留完整休息与回执，空卡也可休息。 | 最终 9 条新增资源场景 × 两引擎 = 18 通过。既有 Chromium 广回归 54 通过，补充原生弹层与原休息流程 4 通过；84 定向单元通过、1 外部规则条件跳过。 | 实体触屏、真实 Suite 权限及玩家房间仍未验证。 |
| 3. 数据与误操作恢复 | 保留余额、类型、来源、自动资源规则与休息恢复。设置取消、拖拽取消和布局放弃不落地。休息弹层位于原生 dialog 顶层，Esc 只关休息，返回焦点；未保存图标布局与确认休息余额可正确合并。 | 旧上限、契约独立池、共享池、2/4/6/9 环、旧 ACK、并发上限、撤销重做、保存刷新；空资源卡及未保存图标草稿的取消 / Esc / 确认。 | 原有自动资源受规则管理，不能把它当作任意自定义数值。 |
| 4. 自动化选择 | 完成与待选气泡使用明确的选择/调整/折叠入口，修复完成气泡被资料点击接管。展开工具显示来源、切换与进度；Esc 先取消拖拽，再退出；返回恢复焦点。候选索引与叶子组件隔离减少拖动重算，非施法选择使用小范围事务。 | 5 条原创新增选择场景 × 两引擎 = 10 通过；包含重复原格、跨格交换、替换、取消、快速切换、慢资料、保存刷新与窄屏返回 A4。2,000 条原创 Wiki、12 次悬停记录 0 次角色深拷贝、无记录长任务。 | 5 浏览器 / 18 单元真实职业资料场景在子任务中因缺快照跳过；没有补齐全部职业自动化或宣称所有设备性能。 |
| 5. 图片参考的三列布局 | **阻塞，未实施。** 当前 Library 支持流程的 `prepare_materialize` 返回完整元数据，下载助手持续报失败，目标文件实际不存在。已按父任务要求停止重试。 | 本 executor 已检查文件不存在；没有查看用户原图，也没有公开上传它。只对原创验收截图做视觉检查。 | 必须在可访问原图的 executor 物化并查看后再实施约 44% A4 / 24% Wiki / 32% 详情、独立滚动和窄屏降级；不以文字猜测替代。 |
| 6. 发布链清理 | 删除 Pages 配置/上传/发布 job、Windows 启动脚本与桌面 ZIP 生成入口，更新现行说明。保留国内 `/card` 网页版、`build:standalone`、domestic 构建、离线缓存及历史资源覆盖保留机制。 | 双入口构建通过；YAML 校验保留原 6 组浏览器命令，新增双浏览器 follow-up 第 7 组，主分支/PR/manual 触发不变；无部署 job。 | 未删除线上站点、历史 release 资源或更改账户。远端 CI 本分支不自动触发，本轮未执行完整 CI。 |
| 7. 首屏编辑下载失败 | 实际注入 cardRuntime 首次下载失败，旧 230 永久禁用编辑且无恢复入口。新增错误详情、导出备份与“保存后重新加载编辑功能”；等待保存队列，保存失败阻止重载，成功后继续编辑。 | 同一故障在隔离旧 230 基线失败复现；修复后两引擎读取原卡、导航、重连、恢复编辑、保存刷新，笔记与 2/5 资源逐字段保留。 | 重载会重新下载失败模块；全新浏览器在完全离线且未缓存编辑模块时仍需联网。 |
| 7. Wiki / 慢加载 / 离线恢复 | 保留 230 启动拆分与 Wiki 队列恢复机制，补双引擎验收。额外关闭真实本地 Web 服务器验证已用编辑/Wiki/法术页缓存回开和继续保存。 | 启动/Wiki/编辑组 38 通过、2 工具边界跳过：Chromium 20/0、Firefox 18/2。覆盖主体延迟、页面延迟/失败、拼音按需、暂时/持续/中途断线、缺失文档、缓存复用、默认 A4、保存偏好。实际服务器断线两引擎均通过。 | Firefox 两项 Playwright ServiceWorker 请求路由/离线控制不支持；另有真实服务器停机覆盖。公网线路、生产 Wiki 全库下载与真实登录房间未验证。 |

## 门禁与复现

环境 Node `v24.19.0`、npm `11.9.0`，满足项目要求。使用项目现有 Vitest / TypeScript / Vite / Playwright，没有修改网络或浏览器安全设置。

慢加载采用响应门控与故障注入，验证等待、返回、保存、恢复及逐文件重试；本轮没有重做吞吐限速基准，历史 230 的公网或 32 KiB/s 性能数字不计为本轮新测。

| 检查 | 最终结果 |
| --- | --- |
| `npx tsc -b --pretty false` | 通过 |
| `npm run build` | 通过，保留既有大 chunk 提示 |
| `npm run build:standalone` | 通过，国内单机网页版未删 |
| `npm test` | 74 文件通过 / 1 条件跳过；486 测试通过 / 23 条件跳过 / 0 失败 |
| `playwright.followup231.config.ts` | 38 通过 / 2 Firefox 工具条件跳过 / 0 最终失败 |
| `playwright.followup-ui231.config.ts` | 按最后相关源码分批收口 42 通过 / 0 跳过 / 0 最终失败：资源 18、选择 10、骰子宽窄 8、同步与休息生命周期 6 |
| YAML / `git diff --check` | 通过 |
| lint | 项目没有独立 lint script，未虚报执行 |
| WebKit | 浏览器下载成功，但缺 GTK4、graphene、harfbuzz-icu、manette、hyphen、GLES2 系统依赖，未进入产品交互。安装依赖受本机管理员条件限制，未改变安全设置 |
| 远端完整 CI / 国内部署 / 真实房间 / 实体触屏 | 未执行；应在父任务审查和协调后的阶段验收 |

可重跑：先构建，再运行两份已提交 follow-up Playwright 配置。浏览器目录本机为 `/workspace/playwright-browsers`；Firefox 在受限沙盒报告找不到 profile，获自动审查批准的本机测试执行中成功启动。不是自动批准拒绝，也没有停用浏览器安全。WebKit 单独列未测，不能计为通过。

本机完整原始材料位于忽略目录，文档与原创截图随分支保存。日志路径不是其他 executor 可直接使用的文件路径：

- `.local-evidence/followup231-unit-frozen.log`：最终完整单元。
- `.local-evidence/followup231-build-{integrated,standalone}-final.log`、`followup231-typecheck-final.log`：最终构建与类型。
- `.local-evidence/followup231-startup-final.log` / `followup231-startup-final/`：40 项启动恢复回归。
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

## 实际 SDK 配对联调与 Suite 阻塞

父任务指定最终 Suite 分支 `codex/suite-host-repair-20261001`，完整 SHA `259672c6e7f504c43deca6ee340f2bbf62a865d8`，替代先前 `f78c78b14cb6569645e5343f3efcb1806358c6e4`。两份只读 clone 的源码保持干净；本 Web 任务没有修改 Suite。配对使用实际安装的 OBR SDK、Web `DiceFrame`、Suite `diceRpc` / history UI / token-results / overlay 标签；宿主消息、场景控制器与物理 renderer 由本地测试替代，**不是真实登录房间或物理骰子验收**。

最新 259 已在本地生产构建及 390 / 1280 px 配对复验：**13 通过 / 2 失败 / 0 跳过，脚本退出 1、pageerror 为 0**。两项失败是同一个回显问题在两种宽度出现。Action 快速双击正确发送 `open/close`，数字 DOM 为零，已独立通过。已有原创自动群体结果 `group-synthetic` 时，点击单人历史，再次点击同项取消，Web 正确透传四条消息：

```text
open  single  destination LOCAL
open  single  destination REMOTE
close single  destination LOCAL
close single  destination REMOTE
```

历史单人 DOM 删除后，旧群体 DOM 重新出现，记录 `{group:"group-synthetic",text:"14member",opacity:"1"}`。这是实心数字回显；不是仅有半透明不可见容器。源码定位 Suite `token-results.ts`：当前 history 只隐藏相同原 cid 的自动 group，其他 groups 继续保留，关闭 history 的 `refresh()` 重新绘制 `groups`。Web 消息已经完整送达，不能通过更改 Web 假协议或清空玩家数据掩盖此结果。已即时报告父任务协调 Suite；精确步骤、完整消息与永久可重跑脚本见 [配对记录](DICE-FOLLOWUP230-PAIRED.md)。

旧 f78 SDK 对照在 390 / 1280 px 同时复现两个问题：上述回显，以及 Action 历史快速双击在延迟 SDK 回执下发送 `open/open`。父任务的 259 已修复 Action 意图顺序及 ready=false 微任务问题，不能据此推断旧群体回显也已修复。旧 f78 的 SDK-stub 公告/宿主工具 45/45 通过，但没有覆盖这个真实 SDK 组合，不替代本轮新失败。Web 公告为配对 230，Suite manifest 仍源基线 227，父任务明确要求正式发布时统一版本，本轮不自行发版。

原始材料 `.local-evidence/suite-web-dice230/results-f78-complete.json`、`suite-web-dice230-259.log` 和原创截图；最终结构化 [259 结果](evidence/dice230-paired/259-results.json)、[窄屏取消证据](evidence/dice230-paired/259-narrow-single-cancel.png)、[宽屏取消证据](evidence/dice230-paired/259-wide-single-cancel.png) 已永久保存。主任务在本 executor 实际查看两张数字残留图。当前用户原图完全未进入这些材料。完整 Web 通过数与此配对失败单独列出，联合骰子需求在此剩余项解决前保持未完成。

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

最终相关 Web 浏览器共 80 通过 / 2 工具条件跳过 / 0 最终失败，不把子任务重复运行次数累加为独立覆盖。最终源码 SHA 为第 6 批 `a6f5f29225d7c94ec61f05ee4b4970510ffd1c06`，已核对远端；其后的交接提交只保存报告或联调材料。最终 Suite 配对失败独立记录，不能被 Web 通过数掩盖。

分项文档：[资源](RESOURCE-FOLLOWUP-231-RESULT.md)、[职业选择](AUTOMATION-230-FOLLOWUP.md)、[骰子 Web](DICE-FOLLOWUP230-WEB.md)、[实际 SDK 配对](DICE-FOLLOWUP230-PAIRED.md)、[发布清理](PUBLISH-CLEANUP-230-FOLLOWUP.md)。永久视觉证据均来自原创验收角色，未保存用户原图或上游规则正文：[资源宽屏](evidence/resources231/gray-preview-wide.png)、[资源窄屏](evidence/resources231/gray-preview-narrow.png)、[空卡休息](evidence/resources231/empty-resource-rest-dashboard.png)、[选择窄屏](evidence/automation230/slow-narrow.png)。

## 后续工作与体验建议

- 先解决原图消费阻塞，再完成明确要求的三列布局。当前默认仍保留 230 排版，不能把窄屏选择工具的局部改进算作三列改版完成。
- Suite 需要配对审查历史同项完全取消、跨入口互斥与快速操作。使用本地实际构建和 SDK 的联调也不能代替真实登录房间、多玩家权限、真实棋子与原设备验收。
- 补私有规则快照后运行真实职业资料抽样，再依既有覆盖表推进职业自动化；本轮只改善交互和事务，不虚报全职业支持。
- 资源休息放在资源/生命骰/仪表盘的入口，首次使用可加简短发现提示；继续清楚区分规则管理次数与自定义数字。
- 普通选择立即保存、装备明确领取，当前文案已说明返回保留。若以后统一为“保存 / 放弃”草稿模式，需先确认规则事务边界。
- 等父任务审查通过后再协调生产上线，并执行真实房间、实际网络与玩家设备验收。此次分支仅保护修复成果。
