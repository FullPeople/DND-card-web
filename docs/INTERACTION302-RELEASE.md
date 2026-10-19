# 302 最终发布记录 · 2026-10-19

已发布。北京时间 2026-10-19 12:59:56，服务器完成四个目标切换及保护检查；13:03:22，独立线上树复核通过。此记录覆盖此前“发布候选”和“仅本地”的发布状态；历史条目保留当时事实。

## 范围与运行来源

| 目标 | 公开版本 | 运行源码 |
| --- | --- | --- |
| [单机角色卡](https://dnd.center/card/) | standalone-1.0.302 | `a17685fbd7871984f672f7221d4b6b55b9204aad` |
| [卡库](https://dnd.center/library/) | standalone-1.0.302 | 同上 |
| [Wiki](https://dnd.center/wiki/) | standalone-1.0.302 | 同上 |
| [新版插件](https://obr.dnd.center/suite-dev/manifest.json) | 1.0.302-dev | `c58f1d40de24bb12735d42aedadacc3672e09a2d` |

应用内部版本为 `0.1.76`。Data 来源为 `398c4f2af5db767aa951145cd742c03b627f7321`，包含锁定的完整审计提交 `3ae567f4a965031c9c12d404e23d7fc9145e039d`。后续文档提交不替代上述运行来源，也不重新封包。

稳定插件 `/suite/` 保持 `1.3.34`；后端保持 `1.0.295`，QQ／云功能继续暂停。首页、三角机构、旧档案导出入口、其他项目、服务配置和玩家资料均不在本次写入范围。

## 实际改动

- 发布已获用户认可的 P0–P3：局部数值更新、保存合并、搜索与触屏优化、选择确认和操作回执、可读性与统一动效、完整五页导出。
- 常用弹窗提前准备，公告基础样式前置；规则与扩展、导入导出减少首次空壳。角色簿采用紧凑单行与拖拽排序；Wiki 恢复原有密集条目。此前新增的手机快捷按钮已按用户要求移除。保留灰色切角、五页、默认 A4、个人偏好及角色格式。
- 内嵌工作台把派生计算移到既有 80 ms 合并窗口后，并复用经过认证的余额修改结果；实际角色构成或规则变化仍使缓存失效。
- 宿主启动只预读当前和前后相邻的有权限角色，完整目录继续可选。当前卡读取不等待两条后台预读通道；切卡取消尚未开始的旧预读，排队期间撤权会取消读取。已访问的完整文档并非全程只保留三张，不能把启动读取上限解释为会话内存硬上限。

详见 [单机定稿](STANDALONE-APPROVED-LOCAL-20261019.md)、[P2／P3](INTERACTION-P2-P3-LOCAL-20261019.md)、[内嵌性能本地验证](EMBEDDED-PERFORMANCE-LOCAL-20261019.md)。

## 验证与历史失败

最终精确源码的 18 组必要 CI 全部成功，共 47 个成功任务；Data 的一个条件流水线按原规则跳过。Web 完整工作流 29／29 个任务成功，单元检查 196 个文件、1,639 项通过，92 项条件用例跳过。Suite 六组最终检查全部通过，并显式绑定上述 Web 提交构建。

Windows 本地完整检查曾有一个 POSIX shell 夹具失败，最终 Linux CI 同项通过；云迁移同一源码首轮遇到账号切换使旧窗口安全关闭的点击竞态，第二次通过。更早候选中的过时选择器、手机／平板断言、保存完成等待和宿主夹具缺项均有原始失败记录，修复后在最终提交重新通过；没有把被替代或取消的任务称为成功。

| 仓库 | 检查 | 精确提交 | 成功尝试 | 成功任务 |
| --- | --- | --- | --- | --- |
| DND-card-web | [Verify web](https://github.com/FullPeople/DND-card-web/actions/runs/39199864426) | `a17685fb` | 1 | 29 |
| DND-card-web | [Cloud suspension release checks](https://github.com/FullPeople/DND-card-web/actions/runs/39199913304) | `a17685fb` | 1 | 1 |
| DND-card-web | [Verify smooth loading](https://github.com/FullPeople/DND-card-web/actions/runs/39199864416) | `a17685fb` | 1 | 1 |
| DND-card-web | [Verify automation progress](https://github.com/FullPeople/DND-card-web/actions/runs/39199903741) | `a17685fb` | 1 | 1 |
| DND-card-web | [F7 loading and transport performance](https://github.com/FullPeople/DND-card-web/actions/runs/39199906587) | `a17685fb` | 1 | 1 |
| DND-card-web | [DND Center cloud migration](https://github.com/FullPeople/DND-card-web/actions/runs/39199910260) | `a17685fb` | 2 | 1 |
| DND-card-web | [Validate dot deploy contract](https://github.com/FullPeople/DND-card-web/actions/runs/39199916319) | `a17685fb` | 1 | 1 |
| DND-card-web | [Verify directed equipment AC](https://github.com/FullPeople/DND-card-web/actions/runs/39199919863) | `a17685fb` | 1 | 1 |
| DND-card-web | [Verify responsive spell icon painting](https://github.com/FullPeople/DND-card-web/actions/runs/39199970814) | `a17685fb` | 1 | 2 |
| DND-card-web | [Verify shield training binding](https://github.com/FullPeople/DND-card-web/actions/runs/39199974342) | `a17685fb` | 1 | 1 |
| DND-card-web | [Verify tool proficiency choices](https://github.com/FullPeople/DND-card-web/actions/runs/39199977603) | `a17685fb` | 1 | 1 |
| obr-suite | [Verify Suite candidate](https://github.com/FullPeople/obr-suite/actions/runs/39199895610) | `c58f1d40` | 1 | 1 |
| obr-suite | [Runtime synchronization](https://github.com/FullPeople/obr-suite/actions/runs/39199898805) | `c58f1d40` | 1 | 1 |
| obr-suite | [Verify QQ account and room permissions](https://github.com/FullPeople/obr-suite/actions/runs/39199902540) | `c58f1d40` | 1 | 1 |
| obr-suite | [Lightweight 2D dice](https://github.com/FullPeople/obr-suite/actions/runs/39199906008) | `c58f1d40` | 1 | 1 |
| obr-suite | [Multiplayer synchronization regression](https://github.com/FullPeople/obr-suite/actions/runs/39199909191) | `c58f1d40` | 1 | 1 |
| obr-suite | [Cloud suspension release checks](https://github.com/FullPeople/obr-suite/actions/runs/39199912672) | `c58f1d40` | 1 | 1 |
| dnd5e-automation-data | [automation-ir validation](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/39197133016) | `398c4f2a` | 1 | 1 |

原始资料完整回放包含 229 个输入、18,789 个身份。报告记录已审核 4,561 项，具有至少一项实际计算或可用选择的 6,537 项，不可用 522 项，未解决项为 0；这些统计有交叉，且具有部分可用行为不等于整条规则完全实现。报告消费者为 `1da0a173c243747b7516f6fadb9be3aeb010bfaf`，报告 SHA-256 为 `d445883804c742e3a2206dcdfa1e405ddb360c5986f7c56f7d6fdefe75ed8a80`。最终 70 个受审计模块字节与完整回放来源一致。最终发布前的 Web 追加改动仅为测试，运行 `src` 与初始候选相同。

## 封包、恢复与保护

发布标识：`interaction302-20261019`。服务器封存目录：`/root/codex-release-packages/interaction302-20261019`。全局回执：`/root/codex-release-receipts/interaction302-20261019.json`，状态为 `published`，与封存目录中的副本逐字节一致。

- 清单封印 SHA-256：`def76bea756e73a036d5fa5820906c6472b78c4c5a5965d10665b34f195629ff`。
- 发布回执 SHA-256：`c605f0fa5dd6576bb7d43987d30ade3e4009ee6c899bbab08b1c93be9ddcb44c`。
- 最终制品清单 SHA-256：`8eee631857f8643b69b915a8c860c11c12043abdd80d19c5eb4cd4c2bcf2725b`。
- 四份归档共 1,650 个候选文件；源码 ZIP 来自固定提交的 Git 归档，注释与提交核对一致。没有打包玩家卡、上游原始资料缓存或依赖目录。
- 全局发布锁、限额辅助进程和四目标目录原子交换完成；capture、preflight、apply、postverify 各启动一次，未因连接延迟重放。

本轮新建的完整恢复副本如下，文件及散列已在发布和独立复核中验证。目录时间戳继承原目录，不代表旧备份。

- `/var/www/dnd-center/card-before-interaction302-20261019`
- `/var/www/dnd-center/library-before-interaction302-20261019`
- `/var/www/dnd-center/wiki-before-interaction302-20261019`
- `/var/www/obr-plugins/suite-dev-before-interaction302-20261019`

恢复副本原文件数依次为 1,779、677、75、2,567。保留旧散列资源和旧源码归档。4 个同名 Vite JS 的差异仅为生成的 JS 预加载依赖次序；先展开引用并验证完整规范化代码及依赖集合一致、拒绝任何 CSS 次序差异，再保留线上原文件和 gzip 字节。证明文件为封存包中的 `retained-immutable-assets.json`，没有覆盖既有不可变资源内容。

独立复核检查四棵完整线上树、四份恢复副本、128 项保护值及数据库完整性，全部通过；玩家资料和后台未被发布器修改，服务没有因本次发布重启。封包时本机 C 盘空间不足，已只把本轮自建的临时包移到 `U:/CodexWork/2026-10-19/release302-artifacts`，完成封包验证后才开始发布，没有清理用户或其他项目文件。

## 公网与验收边界

外部 HTTPS 实际下载的 49 个入口／版本／JS／CSS／图标散列与清单一致；7 个源码归档的 HTTP 206 范围请求通过，完整归档散列已在服务器验证，没有重复批量下载全部源码。稳定插件和后台暂停状态再次独立核对。实际公网页面已看见 `standalone-1.0.302` 及更新日志，截图留在本地 `release302/public-card-302.png`。部分浏览器自动化观察接口较慢或超时，未据此宣称最终控制台检查通过。

本地单机 `5317` 原进程、构建首页散列及工作副本保持；`5353` 内嵌预览保留。本轮未导入、删除或修改用户当前卡册。此前本地受控浏览器、真实调度器／SDK 及 CI 浏览器验证不替代真实多人枭熊房间、微信／QQ 内置浏览器或实体触屏验收；这些仍需原环境体验。

用户刷新网站即可更新。新版枭熊房间刷新后关闭并重开角色工作台。不要为了刷新清空浏览器存储。
