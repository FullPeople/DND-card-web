# dnd.center 首页

从已发布项目的源码恢复，并核对当前线上项目版本、下载链接及 QQ／云端暂停状态。保留原四块开屏切片、骰子、项目图片和真实 React Bits 交互。

在本目录安装锁定依赖后运行 `npm run build`。完整发布 `dist` 的资源图，不单独重命名或替换入口脚本。页面交互后才加载骰子模块；骰子读取线上既有 `/assets/catalog.json` 及其模型、音频和物理资源，发布时保留这些文件。相关资产来源见 ASSET-SOURCES.md 和 PROJECT-MEDIA.md。

本地验证可将 `DND_HOME_PUBLIC` 指向原有静态资源目录，通过 Web 仓库的 `tools/serveLoadingPreview.mjs` 服务首页、角色卡和 Wiki；无需复制或改动原资产。新增构建依赖只来自 package-lock.json，不再依赖开发机器的绝对路径。
