# 分栏隐藏、紧凑资料列表与更新日志 · 2026-10-07

## 修改范围

基线为 GitHub `main` 的 `792e9a4`，隔离工作区为 `D:/CodexWork/2026-10-07/split-hide/web`，分支为 `codex/split-hide-compact-20261007`。本轮授权包含提交 GitHub；后续反馈继续在此工作区修改。原 `D:/Desktop/DND-card-web` 的混合改动和其他工作区保留。

- 分隔条仍在 30% 至 70% 间调整正常宽度。指针越过限度时，对应侧覆盖全高半透明“隐藏该区域”；松手隐藏，剩余侧占满工作区。拖回正常范围只调整宽度；Esc、触摸取消、捕获丢失或窗口失焦取消本次拖动。
- 隐藏状态保存在本机，刷新和窄屏切换继续显示剩余侧。隐藏时保留原组件；“重置隐藏区域”位于顶部“公告”按钮左侧，恢复两侧及隐藏前的宽度。此设置不写角色数据。Wiki 权限被关闭、分隔组件卸载时清理布局投影，避免隐藏角色侧造成空白。
- Wiki 普通条目、种族组标题和种族子条目改为 20 像素；窗口化行高、最小高度、内边距和行内文字同时调整，排序、点击、拖拽和正文保留。
- 公告页签依次为“公告内容”“自动化进度”“更新日志”。最新版和全部历史日期都显示在独立日志页；同一日期归入一个淡灰色框，去除旧批次后缀，不使用 details／summary。上下间距缩减约 3/4；页签支持左右键、Home 和 End。
- 同一天的相同栏目合并，完全相同的说明只出现一次。新说明可声明 supersedes，覆盖旧状态句而保留未被替代的内容。本批移除旧的“战俑工具选择仍待处理”，保留最新修复说明、手机待验证及支持者记录。原始发布历史不改写；网站与 Suite 日志分别生成。

用户最后要求“日志内不再折叠也无法折叠”覆盖此前默认折叠的中间要求。本批没有增加新的上线版本或将本地调整写成已经发布。

## 验证和边界

TypeScript、单机构建、供 Suite 使用的常规构建、现有启动边界检查均通过；12 项定向单元检查通过。22 项不同的 Edge 浏览器场景分批通过（21 项网站场景及 1 项 Suite 日志场景），验证公告与确认记忆、自动化进度、Wiki 滚动／预览、分栏隐藏／取消／刷新／恢复、20 像素行及手机尺寸日志。使用原创资料夹具，不包含玩家角色或上游正文。

初次将布局状态接入 App 时，构建的实际消费者散列门禁拒绝旧自动化账本。最终将布局偏好与头部重置控件统一留在现有分隔组件内，App 与全部受审计模块恢复原字节，双构建通过；没有放宽校验或更改自动化统计。

首轮键盘测试在开屏完成前尝试聚焦，被原有输入门禁挡住；测试改为等待实际 startup complete 并核对焦点。随后布局回归发现旧 `.48` 宽度未规范保存为 `0.48`；补回原来的规范化保存，拖动预览不保存临时极值，受影响的布局及隐藏场景共 8 项复验全部通过；其余 13 项网站场景与 Suite 日志场景已在本批通过。

完整 CI、真实枭熊房间、玩家原设备和实体手机不属于本次本机反馈验收；没有合并 main、发布 Pages、部署国内站或修改 Suite 源码。

## 预览与证据

本地生产预览：<http://127.0.0.1:5694/>。使用浏览器自己的本机存储；没有移入玩家文件。

截图保存在忽略目录 `.local-evidence/workspace-feedback/screenshots/`：左右隐藏预览、仅角色卡、仅 Wiki、20 像素列表和桌面／手机更新日志。首轮报告和失败上下文保存在 `.local-evidence/workspace-feedback/first-pass/`；复验报告、Suite 日志检查及启动边界证据保留在各自忽略目录。

复现定向检查：

```powershell
node node_modules/vitest/vitest.mjs run tests/releaseLog.test.ts tests/announcement.test.ts tests/workspaceGeometry232.test.ts
npm run build:standalone
node node_modules/@playwright/test/cli.js test --config playwright.workspace-feedback.config.ts
npm run build
$env:DND_WORKSPACE_SUITE='1'
node node_modules/@playwright/test/cli.js test --config playwright.workspace-feedback.config.ts --grep 'release notes contain only'
```
