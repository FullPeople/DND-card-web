# 独立国内访问地址

2026-09-24：独立单机版 185 已部署至 [obr.dnd.center/card/](https://obr.dnd.center/card/)。GitHub Pages 继续作为备用地址。用户确认现有 obr.dnd.center 域名可在国内不使用代理访问；此次复用现有 HTTPS 和服务器。

页面、脚本、样式、图标、[Windows 下载包](https://obr.dnd.center/card/downloads/DND-Card-Standalone-185.zip)和[对应源码](https://obr.dnd.center/card/source.zip)均从自有服务器提供，运行时无需 GitHub。Wiki 仍读取指定中文站 5e.kiwee.top 和 homebrew.kiwee.top，并缓存在浏览器中；首次下载和更新资料仍依赖这些上游。

## 验证

- 使用已发布 185 的 `dist-standalone` 原始构建，未加入撤回的屏幕适配或未发布 Buff。
- 公网 HTTPS 逐文件核对 12 个文件的 SHA-256，包含源码和下载包；HTTP 自动跳转 HTTPS。
- 全新 Edge 浏览器上下文完成 229 份资料读取，无失败 HTTP、资料读取错误或页面异常；首次完整读取约 22 秒，此结果是当次测试值。
- 编辑角色并刷新、断网重开和读取缓存 Wiki 通过；未创建 WebSocket，运行请求只涉及本站和两处中文资料源。
- Service Worker 仅作用于 `/card/`；独立数据库为 `dnd-card-standalone`，不使用枭熊集成版的数据库。
- 原 Suite 稳定版 335 个文件和开发版 605 个文件逐文件未改变；中继服务未重启。

GitHub Pages 在此次测试网络同样加载成功，未复现玩家报告的资料库异常，因此不将换地址视为已修复所有网络环境的上游问题。新地址的跨运营商、实体玩家设备体验仍以实际反馈为准。

## 后续发布

服务器目录 `/var/www/obr-plugins/card` 只部署 `npm run build:standalone` 产物，不能用集成版 `dist` 替代。每次发布独立暂存、核对文件哈希后切换目录，并同步源码和下载包。`release.json` 记录实际版本与哈希。

此入口使用已有 nginx 站点 `/etc/nginx/sites-enabled/obr-plugins`；仅新增 `/card/sw.js` 的 `no-cache, must-revalidate`，其余路径沿用原静态托管。不要修改 `/suite`、`/suite-dev` 或中继服务。当前镜像采用发布时同步；GitHub Pages 推送本身不会自动更新自有服务器。

不同域名的浏览器存档独立。迁移需使用“导入 / 导出 → 角色完整备份”，不要清理原站点数据后再迁移。
