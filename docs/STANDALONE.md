# 单机角色卡与 Wiki

单机版使用专门的构建入口，产物不包含 Owlbear SDK、房间连接、发现/重连、联机请求队列或联机面板。网址中的房间参数也不会开启连接。角色修改先更新界面，再写入当前浏览器的 IndexedDB；不用等网络确认。

保留五页角色卡、Wiki/全局搜索、拖拽、规则与扩展、自定义内容、撤销重做、独立角色簿、图片、完整备份、审卡和 PNG。快捷栏的命中/伤害按钮可在本机投骰。

## 使用

- [在线单机网页（国内地址）](https://obr.dnd.center/card/)；[GitHub Pages 备用地址](https://fullpeople.github.io/DND-card-web/)。两者都是静态网页，角色数据不会上传。
- [Windows 191 下载包（国内直链）](https://obr.dnd.center/card/downloads/DND-Card-Standalone-191.zip)；[对应源码](https://obr.dnd.center/card/source.zip)。
- Windows 下载包：解压后双击 `Start.cmd`，浏览器打开 `http://127.0.0.1:5183/`。无需安装 Node、Python或枭熊；保留启动窗口，关闭窗口即停止本地静态文件服务。
- 不要直接双击 `site/index.html`：浏览器对 `file://` 的模块、缓存和存储支持不一致。
- 首次使用 Wiki 需要联网下载资料，此后读取本机缓存。尚未下载的资料、手动更新资料仍需联网。下载包不附带上游资料快照。
- 角色按浏览器和网址分别保存。在线版与本机版之间用“导入 / 导出 → 角色完整备份”搬迁；清理浏览器站点数据会删除该站点的本机存档，建议定期导出。
- 从 GitHub Pages 换到国内地址时，也需要导出完整备份后在新地址导入，两个域名不会自动共享角色。

## 开发和构建

```sh
npm ci
npm run dev:standalone
npm run build:standalone
npm run test:standalone
```

部署 `dist-standalone/` 至任意静态站点。构建生成 `standalone-audit.json`，列出实际入包的源模块并拒绝包含联机传输模块的构建。常规 `npm run build` 仍供 Full Suite 集成版使用。

本地保存消除了网络往返等待；浏览器渲染、存储、图片处理和首次 Wiki 下载仍有实际耗时，不承诺所有硬件上的物理零延迟。

## 183 验证

生产构建浏览器检查：伪造房间参数无法启用连接；未创建 WebSocket、未请求房间/角色服务器；角色与快捷栏刷新保留；断网重开可阅读缓存 Wiki、修改生命值和投骰；导入导出界面无枭熊入口。

发布继续排除尚未发布的新 Buff 特效包，已发布的 18 种状态效果保留。
