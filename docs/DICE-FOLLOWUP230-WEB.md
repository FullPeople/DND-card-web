# 230 后续骰子 Web 桥接检查

本记录针对 `codex/web230-followup-20261001` 的 Web 改动，不是上线回执。没有修改 Suite 仓库、线上版本、真实房间或玩家数据；提交和推送由主任务分阶段执行。

## 需求、改动与证据

| 需求/发现 | Web 改动 | 验证与边界 |
| --- | --- | --- |
| 历史同项再次点击取消，单人/群体互斥 | 核对 230 已有消息协议，保留 `open`/`close` 原样透传，没有增加字段 | 实浏览器连续发送单人和群体 7 笔打开/关闭意图，宿主收到的顺序、内容与 iframe 回执全部对应。历史按钮和棋子头顶绘制属于 Suite；协议探针不替代真实按钮/宿主验收 |
| 暗骰公开后 Web 面板仍保留旧记录 | `Workbench.tsx` 将永久 rollId 集合改为当前快照的内容指纹；同 ID 更新会重新发送，重复内容不重发，缓存随最多 100 条快照收敛 | 原代码同 ID `hidden:true → false` 实测失败；修复后公开更新仅发送一次，重复快照不新增发送 |
| 快速切换目标，迟到初始化恢复旧目标 | 初始化 effect 失效时停止投递其迟到回执 | 原代码先收到 B、后收到 A 时最终快照为 A；修复后只保留当前 B |
| 断线恢复时目标和角色未变，骰子读快照不刷新 | 初始化依赖增加连接状态 | 浏览器时钟推进 47 秒，实际 Workbench 进入离线；恢复 pong 后同目标再次请求初始化 |
| 窄屏群体结果名称与成功/失败逐字断行 | `GroupRollArea.css` 在不超过 480px 时，每目标独立一行，结果状态保持完整词语 | 390×844 截图实看前后变化，隐藏/显示、结算、关闭返回角色卡全部可操作；1512×982 保留现有布局 |

代码：`src/ui/Workbench.tsx`、`src/ui/GroupRollArea.css`；新增浏览器用例：`tests/e2e/diceFrame230.spec.ts` 与 `tests/e2e/harness/dice-frame230.tsx`。既有 `tests/e2e/groupRoll217.spec.ts` 原样执行。

## 已有协议与 Suite 协调项

只读核对仓库为 [FullPeople/obr-suite](https://github.com/FullPeople/obr-suite)，配套分支 `codex/release230-suite` 当次完整 SHA `c90ed018bb869068526ef9bfc24da2a3d9022712`。

iframe 消息：

```json
{
  "channel": "workbench-dice-frame/v1",
  "id": "每次调用唯一 ID",
  "method": "broadcast.sendMessage",
  "args": [
    "com.obr-suite/dice-replay",
    { "cid": "rollId 或 collectiveId", "action": "open 或 close" },
    { "destination": "LOCAL" }
  ]
}
```

Web 将 `method` 和 `args` 传入已有 `diceRpc`。Suite `src/modules/dice/panel-page.ts`、`history-page.ts` 拥有历史按钮；`src/workbench/dice.ts`、`token-results.ts` 与 3D overlay 拥有头顶结果及取消显示。Web 仓库没有 `workbench-dice` 资产目录，这些面板由 Suite 构建提供。本地 `LocalDice.tsx` 只有投骰弹窗，没有历史列表。

已向主任务报告 Suite 竞态候选：`history-page.ts` 的 Action 历史路径先等待发送回执，再修改 `activeReplayCid`；延迟回执期间连续点击同项可能连续发送 `open`。`panel-page.ts` 则先记录意图。此记录为源码核对和协调项，未宣称已经在真实 Suite 宿主复现或修复。半透明残留、群体历史完全取消和跨历史入口互斥仍需 Suite 任务实测并修复。

## 本任务测试结果

| 检查 | 结果 |
| --- | --- |
| Node | 24.19.0 |
| `npx tsc -b --pretty false` | 通过 |
| `npx vitest run tests/diceHistory.test.ts` | 2 通过，0 失败，0 跳过 |
| 修复前新增桥接测试，Chromium | 2 失败，分别证实公开更新漏发、旧目标迟到覆盖 |
| 修复后第一次回归 | 公开更新通过；另一场因夹具包含此前未指定目标的初始化，错误地断言待回执总数，修正为按目标计数 |
| 最终 Chromium，1512×982 与 390×844 | 3 场景 × 2 宽度 = 6 通过，0 失败，0 跳过 |
| Firefox，原沙盒执行 | 浏览器启动失败，提示 `Could not find profile folder`；移到工作区 TMPDIR 后仍相同。未执行产品交互；主任务已能在其浏览器执行方式中启动，后续复验由主任务记录 |
| WebKit | 启动前报缺少 GTK4、graphene、harfbuzz-icu、manette、hyphen、GLESv2；未执行产品交互 |
| lint/完整测试/双入口 build | 本子任务未执行；项目没有独立 lint script，完整门禁由主任务统一执行 |
| 真实 Suite 宿主/真人多人权限/实体设备/生产网络 | 未测 |

可运行配置留在忽略目录 `.local-evidence/playwright.dice230.config.ts`，不会进入正式产品。执行命令：

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/playwright-browsers npx playwright test --config .local-evidence/playwright.dice230.config.ts --project chromium-wide --project chromium-narrow
```

父任务可用相同配置执行 `firefox-wide`、`firefox-narrow`。本配置没有修改网络安全或停用浏览器安全机制。

本地证据：修复前 `.local-evidence/dice230-before/`；首次多浏览器启动记录 `.local-evidence/dice230-first-multibrowser/`；Firefox TMPDIR 复试 `.local-evidence/dice230-firefox-blocked/`；最后 Chromium 截图、trace 和 JSON `.local-evidence/dice230-browser/`。已实际查看群体区域宽屏/窄屏及窄屏修复后截图。
