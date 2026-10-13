# 2026-10-14 · Wiki 290 最终发布记录

入口为 https://dnd.center/wiki/，沿用用户选择的子目录。共用阅读功能详见 [补充实现](WIKI-READING290.md)，对照依据见 [此前比较](WIKI-COMPARISON-20261013.md)。

## 冻结运行来源

| 目标 | 版本 | 来源 | 合并 PR |
| --- | --- | --- | --- |
| 网站、卡库、独立 Wiki | standalone-1.0.290／公告 0.1.69 | `2948267cf503ea525dd2bc037406460f1572c48f` | [Web 71](https://github.com/FullPeople/DND-card-web/pull/71) |
| 新版插件 | 1.0.290-dev | `966b09385362240cdfeee8fd132f621081623f34` | [Suite 81](https://github.com/FullPeople/obr-suite/pull/81) |
| 正式插件 | 1.3.29 | `8b5f9b8379f091b480e1a57d26d15a3438676ea1` | [Suite 82](https://github.com/FullPeople/obr-suite/pull/82) |

测试候选与合并提交的源码树一致。配套查看器使用上述 Web 来源，新版骰子生产包保留 production=true、instrumented=false 和精确的两端来源绑定。此后的文档提交不触发本批再次发布，不替代公开 release.json 和源码 ZIP 中的运行来源。

## 验证

必要精确提交 CI 共 34 项任务成功：Web [28 项主检查](https://github.com/FullPeople/DND-card-web/actions/runs/38432997415)、[云端迁移](https://github.com/FullPeople/DND-card-web/actions/runs/38433009399)、[部署契约](https://github.com/FullPeople/DND-card-web/actions/runs/38433990073)；新版插件 [构建](https://github.com/FullPeople/obr-suite/actions/runs/38433969512) 与 [权限](https://github.com/FullPeople/obr-suite/actions/runs/38433969598)；正式插件 [构建](https://github.com/FullPeople/obr-suite/actions/runs/38433984634) 与 [权限](https://github.com/FullPeople/obr-suite/actions/runs/38433984575)。两端多人性能工作流另行通过。

本地 10 项阅读单测、8 项独立 Wiki 浏览器流程、类型检查和完整构建通过。完整单测 1,441 项通过，91 项既有条件用例跳过；本机 Node 22 的类型擦除配置造成单项来源检查失败，以所需配置定向复验通过，没有修改产品或削弱断言。

公网 13 项浏览器流程通过：8 项独立 Wiki、1 项角色保存保护、1 项实际上游简介／图片／书籍章节、1 项网站公告，以及新旧插件公告各 1 项。公网 376 个发布文件与 18 个源码入口核对通过，包含普通／压缩发布描述、来源 ZIP 的公开长度与 Git 提交尾注。全部源码 ZIP 的 SHA、CRC 与库存清单由封存发布器完整检查；没有以尾注检查替代完整包验证。

原有 69 个消费者模块字节未改变，沿用 Data `cbbe884b7393c0c734b325c105795370a8ad51c2` 的锁定完整审计，运行报告 SHA-256 为 `459ca2ff1ccec24cda0b998314050acda8587ff8a4a9ab91d4361ceb66729708`，6535／18789 个身份有至少一项可执行支持，未解决身份为 0。保留现有覆盖边界，不声称每条规则全部自动执行。

旧 PR 的 [盾牌输入验证](https://github.com/FullPeople/DND-card-web/actions/runs/38432913118) 和 [工具来源验证](https://github.com/FullPeople/DND-card-web/actions/runs/38432913026) 因可变上游文件超过原有固定大小而失败。这两项不属于本批必要发布门禁；固定散列、大小限制及样本均未改动，不宣称所有历史检查全绿。

## 发布与恢复

网站正式 [预检](https://github.com/FullPeople/DND-card-web/actions/runs/38435795429) 和 [发布](https://github.com/FullPeople/DND-card-web/actions/runs/38436638910) 成功；完整恢复目录为 `/root/codex-release-packages/dnd-center-actions-38435795429-1/backup/frontend`。

独立 Wiki 正式回执为 `/root/codex-release-packages/wiki-reader-290-20261014/published.json`，完整恢复副本为同包目录的 `backup/wiki`。服务器在 2026-10-13 17:28:32 UTC 完成发布；本机等待连接最终超时，随后独立核对正式回执、完整目标树与其他目录／保护状态一致。没有盲目重复发布。保护核对在插件切换前保存，插件之后的授权变更不作为 Wiki 的外部漂移误判。

插件正式回执为 `/root/codex-release-receipts/wiki-reading290-suite-20261014.json`，两份完整独立恢复副本为 `/var/www/obr-plugins/suite-dev-before-wiki-reading290-suite-20261014` 和 `/var/www/obr-plugins/suite-before-wiki-reading290-suite-20261014`。两份备份在任一切换前验证，发布器随后核对完整发布树和所有保护项；独立读回封存包及正式回执一致。新版 11594 个、正式版 4011 个完整文件由发布器核验。SSH 回执接收未退出；确认服务端正式完成且没有发布进程后，仅结束本机接收连接，没有再次发布。

若需要整体回滚，先核验当前状态，再依发布顺序反向恢复插件、独立 Wiki、网站，保留本批恢复副本与退休目录。单独目标的恢复须先检查其保护基线，不绕过并发变更保护。

本批没有部署后台、写入玩家资料或更改服务器配置。后台保持 1.0.286、账号权限和 temporaryUpload=false；旧站 https://obr.dnd.center/card/ 存档导出入口保留。

## 适用边界

书籍、冒险正文从现有公开资料源按需读取，没有把上游出版正文或玩家资料提交到源码仓库。未知复杂嵌入资料明确提示回到资料源核对；没有逐条验收每份出版资料的每种格式。网页真实资源检查、窄屏布局和编写的 SDK 就绪事件不代表实体手机或真实 Owlbear 房间验收。
