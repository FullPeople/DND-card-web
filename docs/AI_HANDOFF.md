# 2026-09-27 · 197 已发布，公网核验通过

国内单机 `standalone-1.0.197`、新版 Suite `1.0.197-dev`、旧版 Suite `1.3.6` 已上线，公告 `0.1.6`；GitHub Pages 完整门禁和部署通过。实际源码 Web `cd31b0a` / Suite `8996ff6`。服务器 1054 文件校验、公网 195 文件抽查与关键页面流程通过。以 [最终发布回执](RELEASE-197-RESULT.md) 为准，下方同日“候选/未发布”段落属于历史记录。

本次追加修复见 [RELEASE-197.md](RELEASE-197.md)，原始清单及图片共 33 项见 [白话对照](FEEDBACK-PLAIN-20260927.md)。多人视野、投骰按钮缺失、偶发放怪、实际房间性能等仍待验证；突然掉线自动接任尚未完成。

继续开发使用 `F:/CodexWork/2026-09-27/feedback/{web,suite}`。`D:/Desktop/DND-card-web` 与 `U:/枭熊插件/obr-suite` 的历史混合源码没有被覆盖，不能从这两个脏主目录直接发布。

# 2026-09-27 · 197 发布候选已完成本机验证

用户本轮已授权验证后统一部署；配套说明见 [RELEASE-197.md](RELEASE-197.md)。新增装备词条、职业起始信息、正文拖拽、上下文菜单、法术学习来源、统一 JSON 与折叠 Owner 教程；公告日期 2026-09-27，APP_VERSION 0.1.6。计划发布单机 1.0.197、Suite-dev 1.0.197-dev、旧 Suite 1.3.6，最终结果以后续部署回执为准。

177 核心检查通过；发布回归 51 项已覆盖并通过（49 项首轮、修正旧界面断言后相关 8 项复测通过）；单机 7 项、统一布局 18 项（2 个条件跳过）、触摸 5 项（5 个平台条件跳过）、管理 4 项、审卡等 4 项、新 Wiki 8 项、真实报错资料生产回放 2 项均通过。旧断言按新的编辑模式、菜单和 JSON 流程更新；额外修复了键盘聚焦自动滚动误关悬浮提示。

真实上游 229 请求读取无异常、无脚本错误；冷读取约 30.35 秒、缓存重载 11.83 秒，不能冒称全库操作已完全不卡。真实多人光源、视野、偶发投骰入口/放怪、三龙整局性能与突然掉线接任仍按分项标注。主目录源码未覆盖，所有源码修改在 `F:/CodexWork/2026-09-27/feedback/{web,suite}`。

> **同日用户复查修正**：先读 [33项白话说明及读取回归](FEEDBACK-PLAIN-20260927.md)。本轮曾因误用数组 entries() 引入 blocks.map 报错，已修并以10份真实上游资料验证。仍在原隔离候选中，未发布；不要建议用户清空角色解决此代码问题。

> **2026-09-27 本地新候选（未发布）**：反馈清单工作在 `F:/CodexWork/2026-09-27/feedback/{web,suite}`，分支 `codex/feedback-september`。先读 [FEEDBACK-20260927.md](FEEDBACK-20260927.md) 与 STATUS 顶部。线上仍为196头像热修/195-dev/旧1.3.5；不能把本轮本地实现写成已上线。主目录混合源码未覆盖，继续本轮时使用上述隔离路径。

> 最新已发布：195，见 [FIXES_195_REVIEW.md](FIXES_195_REVIEW.md) 与 [STATUS.md](STATUS.md)。国内单机站 `standalone-1.0.195`、Suite-dev `1.0.195-dev` 已上线；本机连不上 github.com，**未推送**，GitHub Pages 仍停在 193，与国内站不同步。候选发布分支：web `cce51ca`（含 195 全部内容与「特性内引用型选项内联」追加修复）、suite `66ca635`。公告已按用户要求更新为 7 条问题清单并升到 `APP_VERSION = '0.1.5'`（含「10月1号结束前大修」提示句），国内单机站版本 `standalone-1.0.195-announce.1`；上一轮写好的「已修复」版本文案仍未采用，留在候选历史 `9a264b2`。

# Full Suite / DND Card Web：AI 交接入口

最新进展（2026-09-25）：194/195 已合并发布，见 [公告与玩家反馈修复记录](FIXES_194_REVIEW.md) 与 [STATUS.md](STATUS.md) 顶部记录。下列 193 基线与表格描述的是旧版本，接手前按 STATUS.md 的最新一条重新核对。

记录日期：2026-09-24。这是当前发布基线与接手方法，不是新的功能授权。后续用户指令优先；文中的版本和路径是本次核实的快照，接手时重新核对。

## 1. 先看这几件事

1. 网页主目录是 `D:/Desktop/DND-card-web`；枭熊主目录是 `U:/枭熊插件/obr-suite`。不要编辑旧 `D:/Desktop/枭熊插件` 副本。
2. 两个主目录都有大量未提交的历史改动，包含已发版本的回填和未发布实验。**主目录 HEAD、当前文件内容、线上源码提交不是一回事。禁止从主目录直接整包发布，也不要 reset/clean 来追平远端。**
3. 最新已发布：Suite-dev `1.0.195-dev`、国内单机 `standalone-1.0.195`；稳定旧插件仍为 `1.3.5`。GitHub Pages 仍为 193（未推送）。
4. 最近完成并部署的是 194（棋子归属权限、怪物血量静默、quickref、旧卡施法制度）与 195（Wiki 特性子条目、子职来源独立、重复职业升级、生命值取值与施法属性框）。不要再当待办重做。
5. 新 Buff 创作包仍未发布；185 那轮屏幕适配实验已被用户撤回。保留原有状态效果和既有窄屏重排，不能把“撤回一次实验”理解成删除所有响应式行为。
6. 看完本文再按任务阅读 [项目经验与故障复盘](PROJECT_LESSONS.md)、[产品约定](PRODUCT.md)、[验收要求](ACCEPTANCE.md)、[状态流水](STATUS.md)。旧流水中的“未部署”可能被后续发布记录覆盖；不能只按文件名最大数字或第一段推断现状。

## 2. 当前源码与发布基线

| 对象 | 本次核实结果 |
| --- | --- |
| Web 线上源码 | 国内站发布提交 `657539f7cd0f3bd448bbc30849fa42b6459ac02f`（本地候选分支，未推送）；GitHub `main` 仍是 `e3bb0805d1fa88ad9d59b3ce37013e8f15c069f6` |
| Suite-dev 线上源码 | `66ca6350140d53b2d21986658c235c6377ec1b23`（本地候选分支，未推送） |
| Web 主目录 HEAD | `ced21129a764f49a91f277340b809fff8e0b3eeb`，分支 `main`；并非线上完整状态 |
| Suite 主目录 HEAD | `5c508e17e043b363cf69ac3cb61158145829a8f2`，分支 `review/product-roadmap-20260908`；并非线上完整状态 |
| 195 发布源码与打包工作区 | `F:/CodexWork/2026-09-20/w-xu/ac195/`（`web`、`suite` 为指向 fixes194 候选的联接） |
| 195 候选根目录 | `F:/CodexWork/2026-09-20/w-xu/fixes194/{web,suite}`；发布证据 `ac195/{package-receipt.json,card-manifest.json,release-hashes.json,public195-verification.json,FINAL-195.md}` |
| 193 Suite 隔离发布源码 | `F:/CodexWork/2026-09-20/w-xu/ac193/suite` |
| 发布证据与脚本 | `F:/CodexWork/2026-09-20/w-xu/ac193/` |

记录时主目录分别有 307、277 项已修改/未跟踪路径（不含本次新增交接文档）；数量只说明不能盲发，不代表都是未发布功能。193 隔离源码已提交，Web 仅遗留未跟踪测试输出 `test-results-ac193/`。下一次修复优先从已确认的发布提交新建隔离 checkout；不要复用旧构建目录中的产物冒充新构建。

公开入口：

- [枭熊测试版安装清单](https://obr.dnd.center/suite-dev/manifest-dev.json)
- [国内单机网页](https://obr.dnd.center/card/)
- [GitHub Pages 单机网页](https://fullpeople.github.io/DND-card-web/)
- [Windows 单机 193 下载包](https://obr.dnd.center/card/downloads/DND-Card-Standalone-193.zip)
- [稳定旧插件安装清单](https://obr.dnd.center/suite/manifest.json)

`/suite-dev/workbench/` 是集成前端资源入口；不能把不带房间会话参数的地址当作可同步的枭熊启动链接。用户应从房间插件入口打开。Pages 和国内站角色数据按浏览器 origin 隔离，换站须导入完整备份。

## 3. 产品约定，避免重新设计已确认内容

- 核心是左侧可手填角色卡、右侧 Wiki 同时展示，通过查阅和自制拖拽填卡。不是逐步向导，也不是自动执行全部 D&D 规则的规则引擎。
- 桌面纸卡保留厚灰描边、灰底白字标题、切角与五页结构：主要、特性、背景、法术、背包。纸卡配色与 UI 基准色分开。
- 既有窄屏可读重排保留；191 的紧凑顶部栏、隐藏底部保存占位、Logo 等比缩放、Wiki 实际宽度达到 1040 CSS px 的左右双栏已统一到各端。未重新启用撤回的缩放实验。
- 鼠标拖拽使用现有指针系统，不恢复浏览器原生拖拽。拿起时保留物品样式和抓取偏移，落位/让位应连续；触摸纵向滚动优先，长按后才开始拖拽。
- Wiki 条目可以拿起；是否能加入卡由编辑权限、来源和归属判断。普通模式拖入受限身份/规则内容只提示开启编辑模式，不自动开启，也不偷偷写入。
- 同屏有 Wiki 时，卡片 hover 临时在 Wiki 预览；移出恢复，点击确认保留阅读高度。没同屏 Wiki 时才使用 tooltip。物品右键是上下文菜单，不是固定 tooltip。
- 条目身份必须包含类别、来源、版本和关联信息；不能按中文显示名合并。子职归属于具体主职，等级跟随主职；每个主职只保留一个子职。
- 背景属性加点只表达分配信息，不重复给基础属性加数值。装备/同调框是背包条目的展示引用，不因此自动计算 AC 或限制物品类型。
- 2014/2024 基础书版本隔离主要针对 PHB/XPHB、DMG/XDMG；不要按一个 edition 字段封死所有第三方扩展。
- 不补写用户未要的解释、旧入口提示、空正文免责声明，不恢复已删入口。保持紧密资料排版、冻结标题、紧凑表格与快速目录跳转。
- 全部规则必须数据驱动；不按某个中文职业名写特判。未知规则不可伪装成已支持。

## 4. 数据所有权与同步架构

| 数据 | 权威位置 / 处理边界 |
| --- | --- |
| 单机角色、包、网站资料来源 | 当前 origin 的 IndexedDB 工作区；`src/platform/storage.ts`，默认不上报枭熊 |
| 单机资料来源勾选、逐项禁用 | 工作区 `siteSources`，同站各角色共用；不是服务器全用户共用配置 |
| 角色版本、数值、选择 | 角色文档；列表前“跟随角色 / 2014 / 2024”筛选独立，不被来源共享覆盖 |
| 枭熊人物完整卡 | 持久角色 JSON，保留原生 `dnd_card_web` 与旧格式投影；不全塞进棋子 metadata |
| 枭熊人物棋子 metadata | HP、AC、状态、资源等场景投影；原生场景改动经 baseline 合并回角色权威文档 |
| 怪物运行值 | metadata 是实际持久写边界，不能套用人物“文档已提交可提前确认”的逻辑 |
| 公共仓库/背包事务 | 库存 ledger 与幂等操作回执；人物文档是其投影之一 |
| 枭熊规则与扩展 | 房间或场景共享文档，作用域由设置决定，DM 写、玩家只读 |
| 来源显示格式、UI 主题 | 使用者本机偏好，不应被共享房间规则回写覆盖 |

新工作区/新默认配置启用全部扩展；旧配置、手动关闭和逐项禁用必须保留。未启用的扩展不进 Wiki；已启用扩展中单项禁用仍可查阅，标题及正文保留删除线。`autoSourceDefaults` 不能使玩家为了发现新来源而后台写 DM 配置。

枭熊通信优先有窗口引用的本机 `postMessage`，否则走中继回退。标签页与弹出窗口的外观不是快慢根因。复制链接、两端刷新、`noopener` 或跨设备均可能需要网络路径。不要承诺物理零延迟，不要通过取消持久确认、CAS 或权限校验来制造“即时成功”。

保存已有增量协议 `delta.native` / `delta.legacy`：未改的大对象分支不传；修改数组仍可能携带整个数组供按 ID 合并。因此既不是“每次必传整卡”，也不是“每个数组元素都已实现独立补丁”。

头像和背景立绘各自存储压缩后的 data URL 与变换信息，随原生角色持久化/备份；压缩目标不超过 450000 字节、最长边初始上限 1280。没有自定义头像时，绑定人物使用棋子图片 URL 作显示回退；不要每次把棋子图重新导入角色。源码见 `src/platform/portrait.ts`、`src/ui/Portrait.tsx`。

## 5. 代码导航

| 修改目的 | 先看 |
| --- | --- |
| 数值、条目、备份、AC | `src/core/model.ts`、`engine.ts`、`validation.ts`、`export.ts` |
| 自动资源、法术、背包、来源 | `src/core/characterDetails.ts`、`sheet.ts`、`siteSources.ts` |
| 卡片编辑与导入路由 | `src/ui/App.tsx`、`Overview.tsx`、`SheetEdit.tsx`、`NumberInput.tsx` |
| 拖拽、Wiki、预览 | `src/ui/pointerDrag.ts`、`DragEntry.tsx`、`useLibrary.ts`、`LibraryDocument.tsx`、`Reference.tsx` |
| 客户端同步/撤销 | `src/platform/workbench.ts`、`document-delta.ts`、`mutationQueue.ts`、`resources.ts`、`stats.ts`、`actionHistory.ts` |
| 独立单机构建 | `tools/standalonePlugin.ts`、`src/standalone/`、`vite.config.ts`、`tools/standalone/` |
| Suite 宿主保存与选中 | Suite 的 `src/workbench/background.ts`、`observation.ts`、`card-location.ts`、`runtime-authority.ts` |
| Suite 合并/库存/通知 | Suite 的 `src/workbench/merge.ts`、`inventory.ts`、`inventory-model.ts`、`conditions.ts`、`notices.ts` |
| 中继持久化/CAS | Suite 的 `server/workbench-relay/server.mjs`、`documents.mjs`、`patches.mjs` |

单机必须用 `build:standalone`：构建图排除 SDK、连接、重连与联机队列，不能只隐藏按钮。`standalone-audit.json` 应确认没有 multiplayer 模块。首次 Wiki 下载仍联网，后续本地缓存；下载 ZIP 不包含上游规则快照。

## 6. 最近两次修复的接手点

**192 导入假成功：** `App.importFile` 曾只写本地工作区，枭熊角色簿却来自房间目录。现在复用 `createRemoteCard` / 宿主 `createCard`，校验后发送完整原生+旧格式内容，确认后才选中、关闭窗口和提示成功。无棋子也能创建；拒绝/断线不能生成隐藏本地副本。旧误导入数据不自动重放以免重复建卡。见 [导入回执](IMPORT-192-RESULT.md)、`tests/e2e/import192.spec.ts`。

**193 AC 调整：** `SHEET_BONUS_KEYS` 增加 `ac`；`evaluate` 在规则计算/旧绝对覆盖之后加 `sheetBonuses.ac`；Overview 使用 `AdjustedValue`，数值本体只读，编辑模式右侧调整。场景回写总 AC 时，Web 旧格式回退和 Suite `writeRuntime` 都先减去已存 offset，再存绝对基值，防止双加。正负值、导出、撤销、刷新均覆盖。见 [AC 修复](AC-193.md)、`tests/ac193.test.ts`、`tests/e2e/ac193.spec.ts`、Suite `tools/workbench-runtime-176-selftest.mjs`。

## 7. 开发、测试与部署方法

先比较主目录与发布提交，只移入当前任务所需代码。193 两份干净源码可作为本机基线；更长远应重新读取远端 main/dev 和线上 manifest，防止已有更新。冻结的发布目录不要作为日常累积修改区。

在隔离 Web 根目录：

```powershell
npm ci
npm run test
npm run build
npm run test:release
npm run build:standalone
npm run test:standalone
```

按改动选择定向回归；AC 可用 `node node_modules/@playwright/test/cli.js test --config playwright.ac193.config.ts`。涉及触摸/资料来源/布局才追加 `playwright.touch.config.ts`、`playwright.unified191.config.ts`。不要将旧 UI 测试里失效的选择器断言当新需求，也不能为了通过删掉行为要求。

在隔离 Suite 根目录，将环境变量指向**这次隔离的 Web 源码**：

```powershell
$env:DND_CARD_WEB_ROOT='<本次隔离 Web 的绝对路径>'
node tools/build-workbench-dev.mjs
```

未设置变量时脚本默认读主 Web 目录，会带入未发布改动。产物 `dist-workbench-dev` 包含宿主、workbench、骰子及嵌入面板；Web 常规 `dist` 与单机 `dist-standalone` 不可互换。

193 发布流程可复用的材料都在 `F:/CodexWork/2026-09-20/w-xu/ac193/`：

- `package193.py`：对应提交源码包、Windows ZIP、两端归档及逐文件哈希。
- `deploy193.py`：部署前版本守卫、暂存校验、备份后切换、失败回退、保留旧 hash 资源及下载包。
- `verify193.mjs`：公网关键应用文件哈希验证；大源码包本次在服务器验哈希。
- `sync-primary-web.py` / `sync-primary-suite.py`：精确分段回填主目录、先校验再写入、保留无关工作。它们是一次性基线脚本，不能原样重复执行。
- `package-receipt.json`、`deployment193.json`、`public193-verification.json`、`FINAL-193.md`：正式证据。部署脚本的旧版本断言、目标版本、归档名和备份目录必须按新任务重设，不能全局替换数字后直接执行。

服务器发布根为 `/var/www/obr-plugins`：`suite-dev` 为集成开发版，`card` 为国内单机，`suite` 为稳定版。开发中继目录 `/opt/obr-workbench-relay-dev`，服务名 `obr-workbench-relay-dev`。193 未改中继、nginx 或稳定版；角色服务器数据不是静态包内容，部署不能覆盖它。凭据使用本机既有部署配置，绝不把密钥或会话令牌写入文档/仓库。

回滚备份：追加修复前为 `/var/www/obr-plugins/{suite-dev,card}-before-wikiref`，195 首发前为 `{suite-dev,card}-before-195`，193 的两份也在；回滚前再次核实当前版本与路径。回滚前再次核实当前版本与路径，避免覆盖之后的新发布。GitHub 推送 Web main 会触发 CI/Pages；只写交接文档不需要发布网站。

离线 ZIP SHA256：`da347d79b9016d80dfdb04526356b4394254486fb09738c9394073f7a855410c`。193 CI：[35999216827](https://github.com/FullPeople/DND-card-web/actions/runs/35999216827)，verify 和 deploy 均成功。

## 8. 验收边界与尚未完成的方向

193 已验证：29 项定向核心检查、2 项本地浏览器检查、14 项 Suite runtime 检查、类型检查和两种构建；线上集成前端 2 项、国内单机 1 项浏览器回归通过；服务器核验 604 个集成文件与 12 个单机文件，18 个公网应用文件哈希一致。稳定版 336 个文件保持不变。

以上联机浏览器检查使用模拟宿主/SDK 边界，**不等于真实多人房间、不同设备、实体平板已全部验收**。用户此前的真实卡顿反馈不能被某次本机毫秒数字推翻。再有问题优先取 requestId、phase、revision 与时间线，参考经验文档的诊断步骤。

尚未发布/不应自行推进：新增祝福术、加速术、猎人印记、诗人激励等 Buff 创作包；C++ 桌面阶段；任何被撤回的屏幕缩放实验。原有状态效果已发布，不能随新增 Buff 一起删除。是否继续这些方向由用户后续任务决定。

许可按 [LICENSE](../LICENSE) 与 [许可说明](LICENSING.md)：项目专用非商用、分发/对外服务需公开完整衍生源码并沿用许可，商用另授权；不是 AGPL/OSI 标准开源。源码包须匹配发布版本；不公开角色、私人笔记、密钥或上游内容快照。

## 9. 可直接给下一位 AI 的接手提示

> 请先读 `D:/Desktop/DND-card-web/docs/AI_HANDOFF.md` 和 `PROJECT_LESSONS.md`，再检查两库 Git 状态与线上 manifest。当前已发布基线是 195（国内站）；主目录有大量混合改动，不能直接整包部署。先从已核实的发布提交建立隔离工作区，按当前用户任务修改、定向验证、记录真实验收边界。同步问题必须找出权威数据、请求队列和回执顺序的根因，不要靠禁用按钮、延时或取消冲突保护掩盖。旧三龙牌 `NEXT_SESSION_HANDOFF.md` 是另一模块的历史交接，不代表本工作台当前任务。
