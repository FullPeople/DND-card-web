# 国内单机站紧凑工具栏

2026-09-24，用户要求仅调整 https://obr.dnd.center/card/，让 1080p 屏幕留出更多 A4 阅读高度。

- 桌面顶栏 58 → 36 px；角色标签和卡片工具栏 46 → 28 px。
- 隐藏底部 28 px 保存状态条。IndexedDB 自动保存、保存失败 Toast、撤销和导出不变。
- 卡内字号、五页排版、A4 比例、原有缩放算法不变；省出的高度直接用于放大纸张。
- 构建命令 `npm run build:domestic`：复用 standalone 模块排除，另加 `VITE_DOMESTIC_COMPACT=true`。普通 `build:standalone`、Suite 构建不启用这套界面。
- 国内站源码入口改为本站 `source.zip`，对应国内站实际源码。此轮不发布 GitHub Pages、Suite 稳定版/开发版或下载 ZIP。

浏览器验收：Edge，1920×1080 和 1920×940；纸张可见高度分别 929 → 997 px、789 → 857 px，增加 68 px（约 7.3% / 8.6%）。五页尺寸一致、无文档横向溢出；全屏/Esc、角色切换、规则与导入导出入口、保存后刷新、撤销/重做、存储失败提示通过。390×844 保留原有手机布局与操作入口。

验收脚本 `playwright.domestic.config.ts` / `tests/e2e/domestic188.spec.ts`，基准 187 单机预览在 5268，候选站在 5197（可用 `DOMESTIC_URL` 指向已部署网站）。数据使用自制测试条目；不是玩家实机主观可读性验收。

部署版本 standalone-1.0.187-domestic.1；仅替换 `/var/www/obr-plugins/card`，保留旧下载文件、原用户浏览器数据库和资料缓存。
