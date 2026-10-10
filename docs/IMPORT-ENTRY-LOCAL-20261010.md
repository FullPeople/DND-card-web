# 2026-10-10 · 导入入口合并，本地界面反馈

用户反馈“导入与导出”中出现两个角色文件拖拽区。上方属于 TransferPanel 的统一批量入口，下方是旧单文件入口；272 接入 Excel 时同时扩展了两者，导致重复。

在隔离分支 `codex/import-entry-20261010`、远端 main `3c67c29d20817ecd23d5987ece3b98a39a046e33` 基线移除下方可见 JsonFileDrop，标题改为“本机恢复”。上方继续支持单文件和多文件的 JSON／Excel 导入，下面保留“读取上一次保存”。内部单文件兼容输入和恢复逻辑未改动。

类型检查通过。实际 TransferPanel 组件的本地浏览器预览确认只有一个可见拖拽区、点击仍打开多文件选择器、选择文件仍传入原回调、恢复和导出按钮保留；700 像素宽与 390 像素宽截图已检查。该预览仅核对组件和候选 App 的导出区域，不代替完整 App、正式生产构建或真实枭熊房间验收。

常规 Excel 浏览器回归启动被消费者运行审计过期门禁阻止：App.tsx 的一行界面修改改变了消费者文件摘要。原锁定输入、审计回执、规则实现和正式配置未改写，未关闭门禁来发布。后续统一验证与发布前，需为最终消费者树生成实际全量新审计，再执行原完整检查。

本轮未提交、推送或发布，遵循 AGENTS.md 的“During UI feedback, make local changes and provide screenshots. Batch full validation and publication at useful milestones … do not push each visual iteration.” 线上仍为网站 standalone-1.0.272 和新版插件 1.0.272-dev。

本地证据：`../evidence/single-import-area.png`、`single-import-area-390.png`、`layout-verification.json`；目录为 `work/excel-sync/import-entry/evidence`。预览浏览器与服务已正常关闭。
