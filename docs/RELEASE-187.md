# 187 手机 Wiki 触摸修复发布

2026-09-24，基于 186，只包含 Wiki 触摸滚动、长按拖拽及触摸引用预览修正。普通上下滑动不再触发拖拽或窄屏切页；短按打开，保持约 320 ms 后拖拽。鼠标原行为保留。详见 WIKI-TOUCH-187.md。

本地 4 项手机触摸模拟与 1 项桌面回归通过；常规与单机构建、类型检查通过。发布流程继续执行核心测试、既有发布回归、触摸专项与生产单机离线测试。最终公网部署检查单独记录，不将触摸模拟当作实体手机验收。

入口：https://obr.dnd.center/card/ 及 https://obr.dnd.center/suite-dev/manifest-dev.json 。独立下载包为 DND-Card-Standalone-187.zip，GitHub Pages 同步。既有屏幕排版、稳定版公告与中继协议保留；未发布的新 Buff 包仍排除。
