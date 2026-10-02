# 国内单机网页托管

国内单机网页版入口为 [obr.dnd.center/card/](https://obr.dnd.center/card/)。页面、脚本、样式、图标和[对应源码](https://obr.dnd.center/card/source.zip)均从自有 HTTPS 服务器提供。Wiki 读取指定中文站 5e.kiwee.top 和 homebrew.kiwee.top，并缓存在浏览器中；首次下载和更新资料仍依赖这些上游。

230 后续维护按用户要求移除 GitHub Pages 发布及 Windows 免安装启动包逻辑。CI 保留单元、两种网页构建和浏览器验收，验收产物可独立供国内发布核对；国内发布无需等待 Pages 上传或发布。此次源码调整不操作线上站点、历史下载、release 资源或账号设置。最新已部署基线见 [230 发布回执](RELEASE-230-RESULT.md)。

## 发布流程

服务器目录 `/var/www/obr-plugins/card` 只部署 `npm run build:standalone` 产物，不能用集成版 `dist` 替代。`npm run build:domestic` 是同一网页构建的兼容命令。发布前核对对应提交的单元、类型、正常构建与浏览器验收；独立暂存、核对文件哈希后切换目录，并同步对应源码。`release.json` 记录实际版本与哈希。

发布保留旧 hashed assets 和已有 `downloads/` 文件，供已打开页面及历史用户继续使用。当前构建不生成新的桌面下载包。版本固定的历史部署脚本仅可作为审阅范本，不能直接拿旧版本脚本升级当前站点。

此入口使用已有 nginx 站点 `/etc/nginx/sites-enabled/obr-plugins`；`/card/sw.js` 使用 `no-cache, must-revalidate`，其余路径沿用原静态托管。不要修改 `/suite`、`/suite-dev` 或中继服务。服务器发布是独立操作，仓库推送本身不会自动更新国内站。

不同域名的浏览器存档独立。迁移需使用“导入 / 导出 → 角色完整备份”，不要清理原站点数据后再迁移。

## 历史 185 部署验证

2026-09-24：独立单机版 185 部署至国内地址，复用已有 HTTPS 和服务器；当时还发布 Windows 下载包并保留 GitHub Pages 备用站。以下为该次历史验证，后续基线以具体发布回执为准。

- 使用已发布 185 的 `dist-standalone` 原始构建，未加入撤回的屏幕适配或未发布 Buff。
- 公网 HTTPS 逐文件核对 12 个文件的 SHA-256，包含源码和下载包；HTTP 自动跳转 HTTPS。
- 全新 Edge 浏览器上下文完成 229 份资料读取，无失败 HTTP、资料读取错误或页面异常；首次完整读取约 22 秒，此结果是当次测试值。
- 编辑角色并刷新、断网重开和读取缓存 Wiki 通过；未创建 WebSocket，运行请求只涉及本站和两处中文资料源。
- Service Worker 仅作用于 `/card/`；独立数据库为 `dnd-card-standalone`，不使用枭熊集成版的数据库。
- 原 Suite 稳定版 335 个文件和开发版 605 个文件逐文件未改变；中继服务未重启。

GitHub Pages 在该次测试网络同样加载成功，未复现玩家报告的资料库异常，因此不将换地址视为已修复所有网络环境的上游问题。跨运营商、实体玩家设备体验仍以实际反馈为准。
