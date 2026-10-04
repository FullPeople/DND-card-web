# 转场短休 / 长休按钮恢复候选 · 2026-10-04

## 范围与精确来源

本地候选，未推送、合并或部署。只修改新版工作台总览的转场演出入口；不恢复角色卡的资源休息操作，不改任何生命值、生命骰、法术位、背包或自动化规则。

- Web 基线 `41a652373019cb912edb0fa7e0eef13f702c2fef`（main）。
- 配套 Suite 检查基线 `7783de080b0a32465150fbb2672daf848d5385b5`（dev），本候选无需 Suite 运行代码变更。
- 2026-10-04 07:03 UTC 再次通过官方 GitHub API 核对，以上仍为 main / dev 的最新 SHA。Web 已显式 fetch main 并核对 FETCH_HEAD；Suite 首次检查已显式 fetch dev 并核对 FETCH_HEAD。

## 根因

`3aad5715bc00560c442c5290ae590c76a7c7f197` 的资源模块重做，曾将 `WorkbenchConsole.tsx` 的转场选择从短休、长休、文字改成只有文字，并把默认选择从短休改成文字。这与该批移除资源休息操作的范围混在一起，演出入口也被删除。

当前 Suite 原生 `src/modules/transitions/control-page.ts` 仍保留三种选项。宿主 `src/workbench/background.ts` 的 console/transitions 分支与 `src/modules/transitions/index.ts` 仍完整支持 short / long / text；这一条链只是演出。原生提示明确写明不更改生命值、法术位或休息资源。

工作台入口条件是 GM 且 transitions 模块开启；不依赖选中角色、选中棋子、卡片展开或窗口高度。原生独立转场面板没有此按钮丢失问题。

## 最小修复

`WorkbenchConsole.tsx` 四行运行变更：

1. 恢复历史的默认短休，以及短休 / 长休 / 文字三选项。
2. 保留原有自己预览、播放转场及文字输入行为。
3. 同步 ref 门禁保护正在等待回执的请求，防止同一轮渲染连续点击提交两次，并在入口复查 GM、在线与模块启用状态。
4. 成功或失败后释放门禁。失败不自动重发，原错误展示保留。

原交互没有另设确认弹窗：选模式不执行；自己预览 / 播放转场是明确执行入口；离开总览可放弃尚未发送的选择。没有发出请求前不会写角色或资源；已开始的演出继续使用 Suite 原有关闭 / Esc 处理。

## 已执行验证

- 新增六项组件事件回归，使用实际 ConsoleContent 源码及确定性 hook 槽位，修复前 5 失败 / 1 通过；修复后 6 通过。它验证真实组件生成的事件处理逻辑，但不是浏览器或真实 React 生命周期验证。
- 全量单元：113 文件通过 / 1 文件跳过；873 测试通过 / 25 条件跳过。
- `npm run build`：TypeScript 与集成构建通过。
- `npm run build:standalone`：TypeScript 与单机构建通过。
- 编译仅有既存大 chunk 提示，未将其当成失败。

覆盖默认和两模式、无选中角色、选模式无提交、short / long 的 preview / play 原协议、同一事件轮重复点击、等待回执的双按钮禁用、失败不自动重发与显式重试、玩家 / 模块 / 离线限制及自定义文字回退。

## 浏览器与发布边界

已准备 `tests/e2e/transitionRest.spec.ts` 六项浏览器回归及隔离 fixture，覆盖退出再进、两模式的预览 / 播放、重复点击、失败重试、玩家 / 模块门禁及 320 / 390px 布局。fixture 只在本地记录请求并模拟回执，不连接真实房间、不使用真实角色。

浏览器验收未完成：本环境 CLI Chromium 在页面开始前被 `socket() failed: Operation not permitted` 阻断；升级运行仍相同。已提供的云浏览器对本机 fixture 地址返回 `net::ERR_BLOCKED_BY_CLIENT`，未绕过限制。因此不能宣称本候选已通过浏览器、窄屏、真实枭熊、多玩家或实体手机验收。

CI 已接入独立 transition-rest 浏览器组，并添加候选分支触发；新增组件回归由现有全量单元任务自动发现。当前只准备配置，未触发远程 CI。

后续在可用浏览器环境运行：`npx playwright test tests/e2e/transitionRest.spec.ts --project=chromium`（按仓库配置启动开发 / 预览服务器）。另外在配套 Suite 测试环境核对两个演出的实际可见内容及关闭 / Esc，不在真实玩家卡上试休息。发布前需重新核对 main / dev 的最新来源，保留其他并行修复与部署。当前没有 push、merge 或 deploy 授权。

## 独立审阅

父任务已独立只读审阅四行生产差异与六项组件 / 六项浏览器测试，未发现产品阻断；明确保留浏览器未验边界。没有借此宣称额外审阅者或浏览器通过。
