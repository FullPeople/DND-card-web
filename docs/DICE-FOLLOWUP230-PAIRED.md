# Web / Suite 230 骰子配对复验

最终独立复验锁定 Web `488ea1bee7e46b763f80d2bb331420ad5ea583c0`（P2 修复后冻结源码）与 Suite `3fc7c710019bd7ac705915d5b91e633aeeb4215f`（`FullPeople/obr-suite` 的 `codex/suite-host-repair-20261001`）。另读取 Suite 报告提交 `dd55be38638fd828352ca379fc55f954735a5c73` 的 `docs/SUITE-DICE-REPLACEMENT-20261001.md`，本页结果来自随后本 executor 独立重建与实跑，不借用对方通过数。原 `259672c6e7f504c43deca6ee340f2bbf62a865d8` 与 `f78c78b14cb6569645e5343f3efcb1806358c6e4` 的失败对照保留。没有修改 Suite tracked 源码、Web 产品代码、发布站点或真实房间。

**最终固定 15 项配对全部通过：15 通过、0 失败、0 跳过，退出 0，pageerror 为零。** Chromium `153.0.8010.12`，390×850 / 1280×850；旧自动群体可见时打开另一历史再取消，两宽度均 `remaining:[]`。群体同项取消、Action 同项取消、历史互斥和延迟 SDK 回执下快速双击均通过，数字 DOM 清零；双击真实消息仍为 `open/close`。已实际查看取消后的窄屏、宽屏截图，旧数字 14 不再出现。

原 `tools/verifyPairedDice230.mjs` 完整执行，没有修改脚本或断言。运行前后 SHA-256 均为 `30af419a8c8301e119f017c397919c5756bc258766ceb2417c43dcc534ca461a`，Web HEAD 与 JSON 都为上述完整 SHA，Suite 前后 tracked clean。新 [结构化结果](evidence/dice230-paired/3fc-results.json)、[窄屏清除截图](evidence/dice230-paired/3fc-narrow-single-cancel.png)、[宽屏清除截图](evidence/dice230-paired/3fc-wide-single-cancel.png) 是本轮永久证据。真实房间与物理渲染边界仍见下文，不能由这 15 项推定通过。

## 组件与测试边界

- 实际 Web `DicePage`、`DiceFrame`、`useWorkbench`；没有用探针替换 iframe 的历史 UI。
- 隔离生产构建的 Suite `workbench-dice` 面板、Action 历史页、`diceRpc`、`workbenchObservation`、`dice.ts`、`token-results.ts` 和 overlay 标签 DOM。
- 实际安装的 `@owlbear-rodeo/sdk` 3.1.0；房间仅为原创低层 postMessage/SDK 传输夹具。`LOCAL` 广播回本机，`REMOTE` 不回本机。
- 物理 Controller、3D renderer、音频和资产加载用惰性测试边界替代。这是生产历史/数字显示组件的 SDK 配对，不是完整 Suite background、真实 Owlbear 房间、物理投掷或真人多人权限验收。合成群体记录包含 collectiveId 和一个 token，不能据此称真实多人群体投掷通过。
- 标签数量和 `data-group` 实测区分清除与透明；失败截图临时隐藏测试房间的 Action iframe，使 token 数字可见，不改产品代码。截图中的名称、数字和位置全部是合成测试数据。

## 259 历史失败对照及修复

1. 本地房间以 GM 身份有三条记录：`single=16`、`second=20`、`member=14`；第三条 `collectiveId='group-synthetic'`、`itemId='unit'`。生产 `dice.ts` 自动显示群体结果，token DOM 的 `data-group='group-synthetic'`。
2. 在实际 Web iframe 历史页点击 `single`，显示唯一的 `history:single` 数字。
3. 再次点击 `single`。Web 透传完全正确：

```json
[
  {"channel":"com.obr-suite/dice-replay","data":{"cid":"single","action":"open"},"options":{"destination":"LOCAL"}},
  {"channel":"com.obr-suite/dice-replay","data":{"cid":"single","action":"open"},"options":{"destination":"REMOTE"}},
  {"channel":"com.obr-suite/dice-replay","data":{"cid":"single","action":"close"},"options":{"destination":"LOCAL"}},
  {"channel":"com.obr-suite/dice-replay","data":{"cid":"single","action":"close"},"options":{"destination":"REMOTE"}}
]
```

4. 在原 259 配对中，`history:single` 节点已删除，但旧群体节点回显：`{group:'group-synthetic',text:'14member',opacity:'1'}`。390 和 1280 两种宽度均相同，浏览器脚本错误为零。此段是历史失败复现，不是最终 3fc 的现存阻塞。

根因位于 Suite `src/workbench/token-results.ts`：原 `setTokenResults('history:'+cid)` 只隐藏相同 original cid 的自动群体；`clearTokenResults(historyId)` 删除当前历史；`refresh()` 使用 `history ? [history] : [...groups]`，因此此前另一 cid 的可见自动群体重新进入绘制。本任务即时报告后，Suite 任务在 3fc 进入历史时隐藏全部已有自动组，并保存各组的 visibility=false 意图；不清理骰子历史，新 ID 与明确显示旧组仍由原机制处理。当前独立配对原样复验确认该组合的结果节点完全清除。Web 没有新增协议字段或越界修改 Suite。

原 [259 结构化结果](evidence/dice230-paired/259-results.json)、[窄屏失败截图](evidence/dice230-paired/259-narrow-single-cancel.png)、[宽屏失败截图](evidence/dice230-paired/259-wide-single-cancel.png) 原样保留 13 通过、2 失败、退出 1。中间 [f78 对照](evidence/dice230-paired/f78-results.json) 保留 11 通过、4 失败：除了旧群体回显，还包含两宽度 Action 双击 `open/open`。这些历史失败不计入最终当前失败数。

## 已通过与其他检查

| 验证 | 结果 |
| --- | --- |
| 最新 Web 单人/群体 `open`、`close`、各两次 `toggle` 原样透传 | Chromium 宽/窄桥接与既有群体结算回归 6/6 通过；已保存于 Web `a6f5f292…` |
| 最终 3fc / Web 488 配对，普通单人显示、已有旧自动组时的单人取消、群体历史取消、Action 同项取消、快速切换互斥、延迟 SDK 快速双击 | 原固定 15 项，两宽度均通过；取消后 `.token-result` 数量零。群体用例原样保留已有 GM close；旧自动组组合先独立检查通过，没有改变夹具掩盖问题 |
| 同 ID 暗骰公开、迟到目标 A 不覆盖 B、47 秒离线恢复重新初始化 | Web 回归通过，见 [初轮记录](DICE-FOLLOWUP230-WEB.md) |
| Suite f78 npm ci、tsc、新旧 Vite 宿主及当前 dice3d/面板覆盖包 | 通过；依赖缓存移到忽略目录以避开只读系统 npm cache；261 个文件、1061 静态引用、59 资产锁核验 |
| Suite 历史 259 宿主覆盖包和 dev Vite 生产构建 | 通过；261 个文件、1061 静态引用；两次 Suite tracked `git status` 均为空 |
| Suite 最终 3fc 宿主 / workbench-dice / dice3d 覆盖包与 dev Vite 生产构建 | 使用冻结 Web 488 源重新构建，通过；261 个文件、1061 静态引用、59 资产锁；Suite tracked clean。输出是覆盖包，非完整网站或部署 |
| Suite 原浏览器工具，SDK stub / 生产标签与公告 | 历史 f78 复制工具改过时 227 文案断言为配对 230 文案后 45/45；不能替代当前实际 SDK 配对 15/0，也不能覆盖真实房间边界 |
| 公告适配 | Web `announcementVersionFor('suite')` 为 `1.0.230-dev`，Suite dev 产物读配对 Web 并保留折叠历史、Gmail；stable 公告与 `public/announcement.md` 字节相同，频道/已读键/modal 契约独立。Web 公告源不需修改 |
| manifest 227 / 公告 230 | 已知发布方待统一版本，本任务没有自动发版 |
| Firefox | 本子任务初轮沙盒启动受 profile 写权限阻挡；主任务用获准执行方式复验。此配对脚本的 Firefox 未运行 |
| WebKit / 真实房间 / 真多人 / 实体触摸 / 生产线路 / 物理动画 | 未测；WebKit 缺运行库，其他项不能由本地夹具替代 |

## 可重跑原创脚本

[tools/verifyPairedDice230.mjs](../tools/verifyPairedDice230.mjs) 要求显式 Suite 目录、完整 SHA、面板/dice3d 和 dev 宿主构建目录；先验证 checkout SHA，输出写在 Web 忽略目录，拒绝写到 Suite checkout。需要 Web 的 Playwright/Vite 和 Suite 的 rolldown/SDK 依赖已安装。它不会安装依赖、改 Suite 源码、提交或部署。

构建输入必须来自同一锁定 Suite SHA。按 Suite `tools/build-release217.mjs` 生成宿主覆盖包，明确指定 `DND_CARD_WEB_ROOT` 为配对 Web 源码、`DND_SUITE_DEPS_ROOT` 为隔离依赖根、`DND_SUITE_RELEASE_OUT` 为忽略输出；dev Vite build 使用 `SUITE_BASE=suite-dev SUITE_CHANNEL=dev`。不要运行 deploy 脚本。

```sh
PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chromium node tools/verifyPairedDice230.mjs \
  --suite /path/to/readonly-suite \
  --sha 3fc7c710019bd7ac705915d5b91e633aeeb4215f \
  --dice-build /path/to/production-host-overlay \
  --dev-build /path/to/production-dev-host \
  --out .local-evidence/paired-dice230-3fc-web488
```

可用 `PAIRED_DICE_BROWSER=firefox` 配合实际可运行的 Firefox 二进制；默认 Chromium。任一行为失败即退出 1，保留每个检查的 JSON 与截图；不因失败跳过后续宽度的独立检查。历史 259 重跑为 13/2、退出 1；最终 3fc / Web 488 独立重跑为 15/0、退出 0，均与 JSON 一致。完整本地日志为 `.local-evidence/paired-dice230-3fc-web488.log`，构建日志为 `.local-evidence/suite-host-3fc/.local-evidence/build-overlay.log`、`build-dev.log`。没有无意义循环或部署动作；本轮只保存联调材料和文档，未重复运行不受影响的 Web UI 回归。
