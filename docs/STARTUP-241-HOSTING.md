# 241 首次加载的静态资源配置

线上采用已有 Nginx gzip_static 模块。此次只对 `/card/assets/`、`/suite-dev/assets/`、`/suite-dev/workbench/assets/` 和 `/suite-dev/card-viewer/assets/` 中包含八位内容散列的 JS/CSS 开启一年不可变缓存，并优先提供构建时生成的 gzip 文件。文件名随内容变化，旧散列资源继续保留；HTML、清单、公告、Service Worker 和人物文档沿用原来的更新策略。

部署包中的 `.gz` 必须逐项解压并核对原文件 SHA-256；未接受 gzip 的客户端仍取得原文件。配置备份放在 Nginx include 目录之外，语法检查成功后 reload，失败立即恢复。

```nginx
location ~* "^/(card|suite-dev(/(workbench|card-viewer))?)/assets/[^/]+-[A-Za-z0-9_-]{8}\.(js|css)$" {
    gzip_static on;
    gzip_vary on;
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header Access-Control-Allow-Origin "*" always;
    try_files $uri =404;
}
```

公网验收要核对 Cache-Control、Vary、Content-Encoding、identity/gzip 解码内容，以及各角色卡入口的冷启动、缓存重开和减少动态效果。网络带宽与玩家实际线路仍会影响首次传输时间，不能将一台机器的测量推广为所有玩家都能立即打开。
