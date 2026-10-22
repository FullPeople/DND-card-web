# 三方 404 恢复的实际浏览器传输检查

2026-10-22 16:52（北京时间），在隔离的 Microsoft Edge 浏览器中，直接挂载候选 `6d84726` 的真实 `homebrewRecovery`、`catalogTransport`、`normalizeCatalogData` 及原三方资料适配函数。首轮检查通过，没有进行第二次尝试。

本次只验证浏览器实际跨域传输、来源身份校验和规范化。没有启动完整 App，没有修改或绕过其运行账本门禁，也没有使用生产角色库或玩家卡。夹具没有模拟 `fetch`、没有路由或替换网络响应，没有修改代理设置或绕过 TLS；`ignoreHTTPSErrors=false`。实际观察到 IndexedDB 打开次数为 0。

## 实际请求与结果

浏览器首先直接读取 `https://homebrew.kiwee.top/_generated/index-sources.json`，返回 HTTP 200、`Access-Control-Allow-Origin: *`。按实时索引得到 240 个去重路径；解析后的索引 SHA-256 为 `a9024b3a7b524146b5168aaf031dfc3577acb64fb7d0ac3f2922b6bd84a3f9be`。两份资料的后续路径均直接取自这份实时索引。

| 来源 ID | 同一路径 | 镜像实际响应 | 中文部署源实际响应 | 规范化结果 |
| --- | --- | --- | --- | --- |
| `KG` | `adventure/Eventyr Games; The Kraken's Gamble.json` | 404 | 200，CORS `*` | 18 条，全部为 `KG` |
| `s5e` | `class/D'Artagnan; 召唤师.json` | 404 | 200，CORS `*` | 99 条，全部为规范化来源 `S5E` |

部署源为 `https://raw.githubusercontent.com/tjliqy/homebrew-deploy/main`。浏览器实际完成了“镜像 404 → 相同路径中文部署源 200 → 原始来源 ID 校验 → 实际正文规范化”，没有使用英文替代或猜测映射。部署源正文声明的 ID 分别精确为 `KG`、`s5e`；规范化沿用项目原有大写来源约定及 `kiwee-homebrew` 包身份。

`KG` 实际样本为“底栖魔鱼粘液 / Aboleth Mucous”，身份 `kiwee-homebrew:item:kg:aboleth%20mucous::::::`；原始冒险元数据为《海妖的赌局》。`s5e` 实际样本为“召唤师 / Summoner”，身份 `kiwee-homebrew:class:s5e:summoner::::::`。两份内容均保持 2014 身份，传输队列没有暂停。

浏览器 `pageerror` 为 0。控制台仍记录资源 404，包括本次有意检查的两个镜像 404；没有将这些响应隐藏或记成源站成功。跨域读取和恢复成功来自浏览器实际执行结果，不以此前 Node 直连失败、PowerShell GET 成功或冻结正文回放代替。

## 证据与边界

私有证据目录：`U:/CodexWork/2026-10-20/dnd-feedback-control/next-sources-20261022/live-browser/`。

- `attempt-1.json`：五个真实 HTTPS GET 的 URL、状态、CORS 响应头、规范化身份、计数及异常。
- `attempt-1.png`：本次浏览器实际结果页面，已查看。
- `harness/`：隔离夹具与浏览器检查脚本备份；通过源码模块导入调用真实候选函数，没有复制恢复实现。

本结果不代表完整 App、Data 账本、发布封包、缓存持久化或生产玩家流程全部验收。完整整合仍须配套回放与最终检查；本轮没有推送、合并、部署或生产写入。
