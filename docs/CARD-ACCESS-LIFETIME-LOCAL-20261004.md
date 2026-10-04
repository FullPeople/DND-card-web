# 2026-10-04 · 撤销读取权限后的完整文档释放，仅本地候选

## 范围和基线

- 独立分支 `codex/card-access-release-20261004`，基于 Web `1e234716948e6b1095c81da4efc013711f16c4f0`。不改 Suite、不改 CSS/可见动画、不改 Wiki 全库加载、不改可读卡的缓存容量。
- 本轮仅在独立分支保存本地提交，未推送、合并、触发远端 CI 或部署；当前线上版本不变。
- 用户提供的 Edge 约 579–623 MB 单张截图只能说明当时占用，不能证明泄漏，也不能把 Edge 总进程或共享 GPU 归因给本页面。本轮没有真实 Edge 内存/CPU/合成器结果。

## 已复现原因和最小改动

原 `WorkbenchSnapshotCache` 有24张/24 MiB预算，但 `observedDocuments` 和 `WorkbenchRevisions.documents` 同时保留完整文档，读取权限被移除后两旁路不会同步清除。32张合成卡全撤销读取权限时，前者缓存归零，两个旁路仍各32。

本次仅清除失去**读取**权限的完整文档：

1. `platform/workbench.ts` 在现有写意图失效后，按当前读取 grant 清除 observedDocuments；仅保存 key/cardId/itemId/kind 用于归属判断，不额外持有整个状态。仍可读但 write=false 的卡不淘汰。
2. `core/workbenchRevisions.ts` 释放不再可读的完整 snapshot，并仅保留 key→数字 revision 水位。若该 key 的当前 body 已释放，低于水位的迟到 body 必须拒收，不能凭空恢复旧 body、降级至全量写入或把旧状态冒充当前状态。相同/更高 revision 可在新有效 grant 下重新读取。
3. 在进入 MonsterRuntime 之前即检查被退役的版本，避免先缓存被拒收的旧 body。selection、cacheSnapshot、单 ACK、批 ACK 都覆盖拒收分支；丢弃 body 不丢弃 ACK 的 promise/receipt 处理。显式重读失败会退出 loading 并保留可重试错误。
4. `ui/App.tsx` 清除失效作用域或已撤读当前卡的 appliedDocument 引用。既有 dirty/uncertain/failed 草稿隔离、undo、持久恢复和80ms待写时已克隆 baseline 不变。

跨 scene/role/host 时原来就已重置 revisions/observed 主缓存，本次不把这项既有收益算作新增；App 的额外 appliedDocument 引用释放是本批补充。

## 有意保留与未解决

- `WorkbenchRevisions.cards` 仍保留目录运行摘要以维持同revision补字段和乱序保护；摘要可能包含 classSummary/Entry/raw 等对象。不能据本次完整文档释放宣称所有卡片相关对象归零。
- 当前仍可读的32张卡仍可在旁路常驻；本次没有将所有缓存统一成24张LRU。简单加限额而继续全量预热会导致重读抖动。
- 未决/不确定草稿和撤销历史仍可保留角色内容，这是恢复语义。本次不是丢弃用户未保存数据的“清内存”。
- Wiki全库、Suite跨scene文档、闭窗120秒审计、3D资源和CSS循环不在本批。
- 原版在重授权后收到v4时，可用仍保留的v5将它正常化；这本来是正确抗回退行为。新版本因为已释放v5 body，必须等待授权的v5或更新body，而不是恢复v4。这项红绿差异是释放后的安全替代语义，不是把原版v5复用误称为权限漏洞。

## 同字节红绿

真实生产模块打包，仅追加只读测试探针；传输、声音、启动/React hook环境为VM夹具。相同32张合成快照 JSON 共2,576,191字节，SHA256：

`829ecdd0e2c0d8da7dd8ca8c5868056dd7df055e630452b4ec53183ab2050462`

- 两版撤权前：SnapshotCache24，observed32，revisions32。
- 原版全撤读后：SnapshotCache0，observed32，revisions32，独立portrait/raw-heavy可达标记各32。
- 候选全撤读后：SnapshotCache0，observed0，revisions0，独立portrait/raw-heavy可达标记各0；保留水位32个number，不含whole message。
- 两版均在只撤销编辑权限时保留可读body；候选重授权同revision加载成功。
- 两版均保留32份目录摘要，此为明确未清理范围。

这证明指定缓存根的引用释放，不是浏览器GC、堆占用、进程working set或GPU显存测量。证据脚本 `/tmp/audit-card-lifetime-redgreen.mjs`，结果 `/tmp/audit-card-lifetime-redgreen.json`；原始只读审计 `/tmp/card-suite-idle-resource-audit-20261004.md`。

## 验证

- 新增 `tests/workbenchDocumentLifetime.test.ts`：13项通过。覆盖版本水位、完整body独立标记、只撤写权限、80ms撤读再授、其他卡未决写baseline、在途ACK及串行后继、读取中撤权、快速A/B、旧scope、新scope低revision重建、过期单/批ACK、显式retry结束loading与再次成功。
- 首轮8项候选测试在原版代码上3失败/5通过；两条早期测试自身断言问题先修正后重做红场景，未据误断言宣称产品失败。
- 最终全量：880通过、25条件跳过（113文件通过、1文件跳过）；`tsc -b`、集成生产构建和standalone生产构建通过。构建仅有既有大chunk提示。
- Chromium浏览器组尝试时，15项均在浏览器启动阶段被 `socket() failed: Operation not permitted` 阻断，实际行为断言未执行。未重试或绕过。不能称App实际隔离草稿、真实双端、用户Edge或原房间已经验收。

主要本机日志：`/tmp/card-access-lifetime-full.log`、`/tmp/card-access-lifetime-green.log`、`/tmp/card-access-typecheck.log`、`/tmp/card-access-build.log`、`/tmp/card-access-standalone-build.log`、`/tmp/card-access-owner-browser.log`。

可用浏览器环境的待验命令：

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<approved Chromium path> node node_modules/@playwright/test/cli.js test --config playwright.owner-sync.config.ts --max-failures=1`

应继续验证实际输入草稿未丢失、同步中撤权/重新授权、迟到ACK、快速切卡、读失败重试和两端Owner变更；不在真实卡上作破坏性试验。
