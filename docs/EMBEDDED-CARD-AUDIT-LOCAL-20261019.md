# 枭熊内嵌角色卡排查 · 2026-10-19 · 仅审查

本轮承接用户“排查一下枭熊插件中内嵌的这个”的要求，同时记录单机版定稿。本轮不修改运行源码、不推送或部署。单机预览 5317 与已有角色数据保持原位。

## 范围和来源

- 当前本地网页定稿：标签 `standalone-approved-local-20261019`，运行来源 `de2bcee`。检查包括工作台专用分支，而不只看单机保存路径。
- 宿主源代码：已存在的独立 Suite dev 工作树 `F:/CodexData/admin/.codex/worktrees/loading-performance-20261018/suite-dev`，来源 `e7f22f31e057f88d09532760f8ab337ae7a44e09`。只读审查源码并生成原有测试工具的临时输出，原始 `U:/枭熊插件/obr-suite` 与 Web 混合根目录未编辑。
- 本轮实际 GET 公网 manifest：开发版 `https://obr.dnd.center/suite-dev/manifest.json` 返回 200、`1.0.301-dev`，入口为 `workbench-launcher.html`；稳定版 `https://obr.dnd.center/suite/manifest.json` 返回 200、`1.3.34`，入口为 `dice-panel.html`。没有据此声称已逐字验证全部线上工作台源码；线上运行提交沿用 301 发布回执，作为历史固定来源。

## 排查结果

| 优先级 | 证据与现象 | 结论及后续方向 |
| --- | --- | --- |
| P0 性能 | Web `src/ui/App.tsx:680–685` 的 `sendCharacter`，包括局部生命／资源修改，仍执行 `evaluate(projectedBefore)` 与 `evaluate(projectedAfter)`；`src/platform/workbench.ts:359` 在 80 ms 归并前就接收这两个结果。 | 单机局部修改的收益不能直接当作内嵌端的端到端收益。复杂卡可能仍承担两次完整规则计算。应先按依赖复用已计算结果或把可安全合并的派生计算延后到发送时；不能直接删除旧值计算，它用于旧资料导出、冲突基线与属性差量。 |
| P0／P1 性能 | Suite `src/workbench/background.ts:516` 对所有可访问卡排入 hydration，最多两条后台读取并发；已选卡有优先级，缓存审计间隔为 120 秒。`warmCard` 的 24 项限制只限制热快照，`documents` 保存完整文档且没有同等容量或字节上限。 | 冷启动仍可能逐渐读取整本目录的完整卡／图片，卡册大时带来请求和内存压力；不能称为无限并发或每个场景事件都重新下载。应区分目录摘要、当前卡、相邻卡与用户打开过的完整卡，增加有界缓存，同时保留总览所需数据及权限撤回清理。 |
| P1 发布集成 | Suite `tools/build-workbench-dev.mjs:5–20` 默认从 `D:/Desktop/DND-card-web` 构建并复制 Web 的 `dist` 到插件 `workbench`，不是引用 5317 单机预览；当前本地定稿从未部署。 | 单机版优化不会自动进入线上插件。后续候选必须明确指定审核过的 `DND_CARD_WEB_ROOT` 和精确提交，不能从历史混合根目录打包。稳定版的 native card viewer 是另一条构建／验收路径，也不能视为新版工作台的替身。 |

当前工作台已经具有 80 ms 保存归并、按角色排队、跨角色写入通道、显示状态去旧与权限复核，不应以“完全没有队列”描述它。优先减少排队前的重复工作与不必要的完整文档读取，保留确认、冲突与不确定结果保护。

## 完成的检查

Web 17 个定向文件、172 个用例通过，覆盖工作台握手、缓存选卡、版本去旧、读取恢复、权限撤回、删除回执、写入队列，以及 P0 数值、保存队列与搜索 Worker。日志为 `.local-evidence/embedded-audit-tests.log`。

Suite 的四组现有 Node 专项均通过：`operation-lanes-selftest.mjs`（5 组）、`workbench-merge-selftest.mjs`（8 组）、`workbench-runtime-176-selftest.mjs`（17 组）、`runtime-completion-selftest.mjs`（13 组）。这些检查验证同卡有序、跨卡独立、冲突不覆盖、旧资源不复活，以及本地呈现确认的边界；是受控模型检查，不是新的真实房间验收。

未连接真实 Owlbear 房间，未改角色文档或现场数值，未测原玩家设备及断线现场，不给出未经测量的“快了多少”结论。当前记录是明确优化点与回归基线，不将推测描述为已复现的用户卡顿原因。

## 当前收束

单机版已留好本地定稿引用；枭熊端完成一轮代码、构建路径和回归排查。尚未把单机定稿封成新插件候选，也没有改动宿主协议或部署任何版本。下一轮若实施，应从定稿引用建立独立工作分支，优先处理工作台派生计算及预读范围，并另做真实房间验收。
