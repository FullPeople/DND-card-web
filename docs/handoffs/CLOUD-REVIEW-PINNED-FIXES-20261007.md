# 2026-10-07 · PR16 审阅修复中受 Data 字节门禁约束的两项

PR16（dnd.center 卡库与 Node + SQLite API）已按 CI 全绿、可合并状态合入 main（合并提交 `4a95a7d42fb07489e051021936e7821fb10a85e7`）。Codex 在该 PR 留下五条未解决 P2 审阅，本轮逐条对照源码核实均成立，处理如下：

| 审阅 | 核实 | 处理 |
| --- | --- | --- |
| `src/cloud/api.ts` 使用 `AbortSignal.timeout`，卡库构建目标含 Safari 15.4 | 成立：`vite.library.config.ts` target 含 `safari15.4`，该 API 自 Safari 16 起才可用 | 已改用仓库既有 `withRequestTimeout`，同分支提交 |
| `tools/buildCloud.mjs` 未把 `server/cloud/backup.mjs` 放进后端包 | 成立：SSR 构建只产出 `server.mjs`，备份 systemd 单元执行 `current/backup.mjs` | 已在打包脚本中显式复制，同分支提交 |
| `cloud-migration.yml` 只监听云端路径 | 成立：PR16 同时改动 `App.tsx`、`storage.ts`、`PlayerViewer.tsx` 等共享模块 | 已扩展 `pull_request.paths`，同分支提交 |
| `App.tsx` 在 `acceptWorkspace` 校验前就 `saveWorkspace` 暂存云端草稿 | 成立：校验失败时无效工作区已成为主记录 | **见下文补丁，未合入本分支** |
| `storage.ts` 的 `cloud-staged:` 记录在本机草稿删除后不刷新 | 成立：旧暂存会复活已删除快照并立即冲突 | **见下文补丁，未合入本分支** |

## 为什么后两项没有直接提交

`docs/data/automation-runtime-coverage.json` 由 Data 仓库 `FullPeople/dnd5e-automation-data` 的实际消费者审计生成，并以 `automation-runtime-coverage.lock.json` 锁定报告字节。报告中 `consumer.modules` 固定了 49 个 Web 消费者文件的 SHA-256，其中包括 `src/ui/App.tsx` 与 `src/platform/storage.ts`。改动这两个文件后，`tests/automationProgress.test.ts` 与 Vite `public-automation-progress` 插件都会以 `Runtime coverage is stale for current consumer code` 失败（本轮已实际复现：17 项单元失败、`npm run build` 失败）。

伪造锁或报告哈希违反该门禁的本意；正确路径是 PR16 采用的 Data → Web 串行流程：Data 侧针对包含这两处改动的 Web 提交重新审计并发布新报告，Web 再更新 JSON 与 lock。本分支因此只保留不受门禁约束的三项修复，并把余下两处改动原样存为 [cloud-review-pinned-fixes-20261007.patch](cloud-review-pinned-fixes-20261007.patch)，供下一次 Data 审计周期合并应用（`git apply docs/handoffs/cloud-review-pinned-fixes-20261007.patch`）。

## 补丁行为摘要

- `App.tsx`：先 `acceptWorkspace(value)`（读取、修复、校验），再在 `value!==stored&&canWrite` 时 `saveWorkspace(value)`。不兼容的云端卡在校验阶段抛错时，原工作区保持不变，与错误提示承诺一致。
- `storage.ts`：`stageCloudDraft` 仅在工作区已有该云端卡的本机草稿时跳过暂存；工作区没有该卡（从未导入或本机草稿已删除）就用刚取回的卡刷新 `cloud-staged:` 与 `cloud-binding:` 记录。已有本机草稿与冲突/撤销保存的保护不变。

两处均未在真实 dnd.center 环境验证，补丁应用后仍需 `npm run test:cloud` 与 `test:cloud-browser` 复核。
