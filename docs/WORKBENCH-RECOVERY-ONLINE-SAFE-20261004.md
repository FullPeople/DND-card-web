# 工作台恢复候选：保留已发布三龙在线入口

## 状态与源码来源

本次是新的独立本地候选，不修改先前候选，不推送、合并或部署，不操作真实玩家资料。最终双仓提交和配对 CI 引用由统一收口记录补充。

- Web 起点：fresh main `04d8a8408ed7e2815dabb9c14617fd369ee11ebb`。
- 404／角色管理／脱敏诊断／删除守卫／当前窗口权限公告：定向移植原候选 `c2bf5c8046db32eec27a1920553f57770e3cebac` 的非三龙部分；没有整提交或整 App 覆盖。
- 已发布三龙新窗口入口的实物源码：公开部署归档 `three-dragon-link-source-b681f78dccad.zip`，ZIP comment 为 `b681f78dccad90ab407738074dedba62b13db470`，共 1042 项。
- 公开来源：[已发布 Web 宿主源码](https://obr.dnd.center/suite-dev/workbench/three-dragon-link-source-b681f78dccad.zip)。
- 归档 SHA-256：`c744021c0177bcf423321cd076d927e794faca618f86ecd67fde33d36c58bed8`，提取前已精确校验。
- 该归档证明部署方提供的源码内容，不能据此证明该 SHA 存在于可获取的远端 Git 对象或是 main 的后代。没有伪造 Git 祖先关系。

## 选择性整合

App 从原恢复候选保留 6 个恢复／管理 hunk，剥离 3 个内嵌牌桌 hunk；从公开归档只保留 6 个在线入口 hunk：引入链接样式、移除 tableOpen 状态、调整模块关闭与拖动条件、移除查阅事件中的关牌桌动作、替换标题栏链接、移除旧内嵌挂载。

在线入口使用普通链接，目标 `https://obr.dnd.center/three-dragon-ante/`，`target="_blank"` 与 `rel="noopener noreferrer"` 保留。不创建内嵌牌桌、不发送 table panel RPC，也不改写三龙服务器或游戏数据。

仅从公开归档额外保留：

- `src/ui/threeDragonLink.css`
- `tests/e2e/threeDragonFullscreen.spec.ts` 的新窗口测试正文。此文件名是历史名称，正文不再测旧内嵌全屏。

未采用归档中对主线启动优化的旧导入、等待编辑器的 ready 条件或 CI 删减。`classMigrationQuery`、`overviewConditionEntry`、`LockIcon`、`afterPaint`、`checkStartupBoundary241` 与 fresh main 逐字一致；App 独立只读卡面 ready 和编辑加载提示继续保留。

旧 `ThreeDragonFullscreen.tsx`／CSS 仍是基线原文件，没有带入先前内嵌改造，也未重新引用。最终生产 JS/CSS 检查确认不含旧全屏组件标识、全屏样式或 underlay 样式。原0.8独立三龙CSS候选完全不在本树范围内。

## 保留的恢复功能

- 有权限但读取失败时显示明确错误和重试入口，晚到的旧请求不能抢回新选择；404不会自动删卡或放宽 Owner。
- 角色管理保留逐项结果、失败恢复、重复删除防护、待确认结果与重新读取目录。
- 可复制诊断经过既有脱敏模块处理。
- 红色权限说明在当前工作台打开。原 GM／滚底／图片／可见绘制／明确确认门禁保留；配套 Suite 用宿主 RPC 写入宿主已读状态，避免独立窗口和宿主分区存储不同。
- 公告打印隐藏规则保留；没有新增旧牌桌 wrapper/inert 结构。

## 浏览器测试配置

`playwright.window-shell.config.ts` 只包含新的在线链接 2 项和权限说明 3 项。配置不包含 U:/ 路径，也不固定 Edge；允许 `CHROMIUM_PATH` 或 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定浏览器。

CI 必须显式传入 `SUITE_ROOT` 和 `TDA_SUITE_SETTINGS_DIST`。缺失权限面板直接报错，不能静默跳过。恢复组使用新配套 Suite 的真实 permissions/settings 产物；主线 startup-order 对同名在线链接测试的原调用保留，可继续使用隔离面板夹具。

1440／390px 的在线测试保留鼠标开新页并新增：键盘 Enter 打开、关闭网站标签后父页查询和卡页保留、功能开关与设置仍可用、禁用入口后隐藏、重新启用时不恢复旧iframe。目标网站 URL 被原创静态夹具拦截，不访问真实游戏服务器。

## 本地验证与边界

已执行：

- 定向 40 单元通过。
- `npm run check` 通过：111 测试文件通过、1 条件跳过；864 测试通过、25 条件跳过；集成生产构建通过。
- 独立 `tsc -b` 通过；`npm run build:standalone` 通过。
- `node tools/checkStartupBoundary241.mjs` 通过，含它执行的双模式构建与启动边界检查。
- 生产产物中在线链接存在，旧内嵌全屏标识／CSS 不存在。
- Playwright 发现／编译检查：window-shell 5 项、manager-recovery 6 项、owner-sync 15 项。
- `git diff --check` 通过。

构建仍给出既有大于500 kB chunk提示，没有把该警告当成失败，也没有以通过构建代替浏览器验收。

未执行：实际浏览器点击、宽窄截图、真实房间和实体手机。本环境先前已证实 Chromium 在页面创建前被 socket 权限阻止；本轮没有重复尝试升级或绕过。真实浏览器结果等待批准后的新配对 CI，发现／编译计数不能报为浏览器通过。

日志与产物留在本树 `.local-evidence/online-safe/`：`check.log`、`unit.log`、`build.log`、`standalone.log`、`startup-boundary.log`、各 `*-discovery.log`、`source-and-build-boundaries.json`。旧候选的验证结果没有混作本次新候选的浏览器证据。

## 首轮配对 CI 的公告测试路由修订

[Web run 37176150026](https://github.com/FullPeople/DND-card-web/actions/runs/37176150026) 在 Web `a7d37b9f97065847bf50161df9be5a357988cc92`、Suite `029fcdb07e26d23623c86f6284873d43ae78c458` 上实际运行。恢复组角色管理 6 项及在线三龙入口 2 项通过，公告 3 项均在打开工作台时因测试端读取不存在的 `workbench-panels/sound.js` 报 ENOENT，尚未进入公告交互。

三份失败 trace 均记录请求 `http://127.0.0.1:5764/workbench-panels/sound.js`。它来自正常工作台启动的可选声音加载，不是 Vite 源码模块。配套构建指定 `WORKBENCH_PANEL_ONLY=permissions/settings`，在生成共享声音模块前正常返回；公告测试原先把全部 `workbench-panels/*` 请求映射到配套产物，因此错误接管了该可选请求。

本次仅修订测试路由为 permissions HTML 及其构建 JavaScript，保留可选声音原来的失败容错；真实权限面板缺失仍由 beforeAll 或 readFileSync 硬失败。真实 permissions/settings 产物、GM、滚底、图片、显式 ACK、宽窄及撤权断言保持不变，没有返回空 JavaScript、增加跳过或修改产品运行代码。

路由回归先红后绿：保持旧范围时 3 项中 2 项失败，其中明确复现 sound.js 被接管；收窄后 3 项通过。最终完整单元 867 通过、25 条件跳过，TypeScript 和 diff 检查通过，窗口组仍发现 5 项。新增本地证据在 `.local-evidence/permission-ci-route/`（red、green、unit、typescript、discovery 日志及 trace 请求摘要）。修订后的真实浏览器结果须以下轮 CI 为准；本地没有重复尝试已被 socket 权限阻止的浏览器。

同批为已在首轮 CI 通过的 1280／390px 合成角色读取恢复场景补充成功路径图：通过 info.outputPath 保存错误与脱敏诊断、重试请求待回复、恢复后生命值 12 三个阶段（read-error、read-retry、read-restored）。原断言与产品代码不变；新增截图产出等待下轮 CI，补充后 TypeScript 与 owner-sync 15 项发现检查通过。
