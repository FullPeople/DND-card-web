# 307 发布与验收记录 · 2026-10-25

用户在一小时本地优化交付后明确要求“部署”。本批 `/card/`、`/library/`、`/wiki/` 均已发布 `standalone-1.0.307`，公告版本为 `0.1.80`。后台仍为 `1.0.303`；首页、旧卡站、新旧 Owlbear 插件、账号权限和正式玩家卡片内容不在改动范围。

角色卡与卡库于北京时间 15:48:43 取得 `published` 回执，Wiki 于 15:58:59 取得独立 `published` 回执。服务器后验、公网文件与实际浏览器检查已完成。本记录是发布后文档，不触发再次部署。

## 来源与准确提交检查

- 实际运行 Web 源码：`1aa35b537fd8c6bd1a850ebb55a6c5a7b43677a6`，由 [PR118](https://github.com/FullPeople/DND-card-web/pull/118) 普通合并；完整树与最终检查候选 `7ea4619cc9a8226921a91c0025893e025168f925` 一致。
- 交互改动冻结于 `1d79842fc07181686a684401f7f292947d06345b`；后续仅公告、版本、上游原始输入锁与文档。改动范围、指标及初始失败见 [一小时交互优化记录](INTERACTION-SPRINT-20261025.md)。
- Data [PR72](https://github.com/FullPeople/dnd5e-automation-data/pull/72) 合并为 `598655132018b44b45b77a4b5db4b5bebdb0f296`。Web 锁定的 `540370369e7cf439d76461c219b401871a1ad927` 已在远端 main 历史可访问。
- 配对报告 SHA-256：`1dd8e0ca0943e3f5a16296ee23a59ec2334dfe64410382544905d145e5e47ec5`。169 项消费者字节检查保留原 159 项；59＋1 项实际规则依赖、229 个冻结输入、18,789 条记录、见证与原回放时间不变，未借发布修改规则计算。

最终 main 的 7 组工作流共有 38 个成功任务，另有 1 个 Data 条件跳过任务。准确 Web 提交的单元检查为 1,806 通过、92 条件跳过，219 个测试文件通过、3 个跳过；30 个 Web 主工作流任务全部成功。条件跳过不计作执行通过。

| 工作流 | 最终运行 | 结果 |
| --- | --- | --- |
| dot-deploy-contract.yml | [40171606879](https://github.com/FullPeople/DND-card-web/actions/runs/40171606879) | 成功 |
| cloud-migration.yml | [40171604732](https://github.com/FullPeople/DND-card-web/actions/runs/40171604732) | 成功 |
| web.yml | [40171539208](https://github.com/FullPeople/DND-card-web/actions/runs/40171539208) | 成功 |
| cloud-suspension.yml | [40171539178](https://github.com/FullPeople/DND-card-web/actions/runs/40171539178) | 成功 |
| standalone-cloud-production.yml | [40171539175](https://github.com/FullPeople/DND-card-web/actions/runs/40171539175) | 成功 |
| loading-performance.yml | [40171539172](https://github.com/FullPeople/DND-card-web/actions/runs/40171539172) | 成功 |
| build.yml | [40170383844](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/40170383844) | 成功 |

最终 PR 的盾牌训练、战俑工具、法术图标、加载性能、自动化来源、云端迁移及完整 Web 工作流也均通过。main 的来源／功能验收绑定上述运行，不用后续文档提交的检查替代。

## 发布过程与原始失败

1. 角色卡／卡库基线为 306（`add54ce3493e3385fca9d229e95ae990ef0196cf`），Wiki 为 302（`a17685fbd7871984f672f7221d4b6b55b9204aad`）。分别读取公网与服务器状态，使用隔离工作树；桌面混合目录未用于打包。
2. [预检 40172842645](https://github.com/FullPeople/DND-card-web/actions/runs/40172842645) 成功，封存 SHA-256 为 `e11f2ca5dc5a3f69743127ee1cd5caa69c8f59a88569ddcfce274c0ef380d616`；原始发布包 SHA-256 为 `6729ade884f4489d4637bbe77d6c9ae207bf2b9f0229f2cc3a196b6926821cf6`。
3. [Actions 发布 40173241532](https://github.com/FullPeople/DND-card-web/actions/runs/40173241532) 因传输及检查超过临时凭证有效期，以 `token-expired-or-future` 失败。服务端已写入事务绑定，但没有发布回执、备份目录或目录切换；失败保留，未重新发起 Actions 发布。
4. 再次读取远端 main、准确提交 CI、事务记录及线上 306 后，经已有身份核验的维护 SSH 连接，对同一封存包调用原安装发布器一次。没有修改认证配置、发布器、CI 要求或包内容；完整备份、全目录与保护状态核对、并发锁、原子切换及失败回退均保留。维护执行退出码 0，持久回执为 `published`。
5. Wiki 在角色卡／卡库发布完成后独立 capture、seal、preflight、apply、postverify，各阶段只执行一次。封存 SHA-256 为 `3f503e1895273de42136a5f3b80d1a23f71176cd12ce35d3d51cb51b883a8142`；69 文件包 SHA-256 为 `5919494a630c12e9c096345147ad4e4f9f29f8e9d4baffe27df61ff64f3d0cf1`，32,259,103 字节。

早期失败均保留：本地 Windows 版本锁用例超过原 5 秒时限，未放宽断言或时限；最终 Linux 完整检查通过。首轮盾牌训练与工具熟练检查发现上游文件字节变化，逐字段核对机制投影与原夹具完全相等后，只更新两份测试输入的原始散列、字节数、日期和来源说明。战士文件为 170,404 字节，种族文件为 603,959 字节，物品原文件未变；上游原文只留忽略目录，不加入公开仓库。

Wiki 上传时发现两份既有内容散列资源的 gzip 字节不同；解压后与新包原始 JavaScript 逐字节一致。保留线上旧 gzip 字节后重打包，最终不可变资源冲突为零。原包和比较证明保留，未改 JavaScript 或 CSS 来绕过检查。

## 公网与浏览器验收

- 三个入口的 `release.json` 均为 307，源码均为 `1aa35b537fd8c6bd1a850ebb55a6c5a7b43677a6`；健康接口正常，后台 303、QQ ready、私人卡库、账号额度、关闭临时上传和公开目录的策略保持。
- 260 个公网文件 SHA-256 全部一致；4 个源码归档入口的 HTTP 206、ZIP 标识和完整长度正确。发布包内源码 ZIP 注释绑定准确提交，两个角色卡／卡库归档逐字节相同；源码文件与 Git 的 1,928 个 blob 逐一相符，Wiki 来源归档也已核对。
- 公网隔离 Edge：卡库未登录隐私状态、手机侧栏；角色卡五页、力量 14→18、本机保存和刷新恢复、390 px 页面；新版公告、旧公告历史和确认状态保存均通过。卡面流程采用既有自编规则夹具和本机测试角色，阻止正式 API 写入。
- 首轮卡面检查误用全局 `.paper` 选择器，同时命中当前卡面与为了性能保留的隐藏卡面；原截图、错误上下文及 trace 保留。限定当前卡面后单独复验通过，未改产品代码，未设置自动重试。首轮其余 2 项通过；报告 JSON 被定向复验覆盖的事实单独记录。
- Wiki 使用实际公网页面和实时上游资料，共 43,423 条；“火球”搜索 17 项，方向键／回车保持正确焦点并打开延迟爆裂火球，7 环属性及正文一致，没有职业旧正文、重复属性或重复原始数据区；页面错误和失败请求均为零。桌面及 390 px 截图已人工查看，手机页面宽度为 390 px。

## 数据保护与回退

发布前单独生成在线数据库备份，并在正式切换前再次备份。发布后 SQLite 完整性正常，数据库身份未被替换，129 项非目标保护状态全部相同。当前 185 张卡，对照初始快照：185 行不变、0 行更新、0 行新增、0 行删除；期间正常写入按实际对照保留，未恢复旧数据库。Wiki 独立后验核对 129 项保护状态及完整目标／备份目录。

| 内容 | 本次完整备份或持久回执 |
| --- | --- |
| 角色卡旧版 | `/root/codex-release-packages/dnd-center-actions-40172842645-1/backup/frontend/card` |
| 卡库旧版 | `/root/codex-release-packages/dnd-center-actions-40172842645-1/backup/frontend/library` |
| Wiki 旧版 | `/var/www/dnd-center/wiki-before-wiki307-20261025` |
| 数据库备份 | `/root/codex-backups/card-wiki307-20261025/capture.sqlite`、`prepublish.sqlite`（私有，只读核验） |
| 角色卡／卡库回执 | `/root/codex-release-receipts/dnd-center-actions-40172842645-1.json` |
| Wiki 回执 | `/root/codex-release-receipts/wiki307-20261025.json` |

若需要整批回退，先核对当前目录和封存文件，再按 Wiki → 角色卡／卡库的顺序执行；Wiki 的保护快照包含新版角色卡与卡库。以下命令只回退静态前端，不能用于恢复数据库。后续目录变化将被散列保护拒绝。

```sh
python3 -B /root/codex-release-packages/wiki307-20261025/publish-wiki307.py --rollback --seal 3f503e1895273de42136a5f3b80d1a23f71176cd12ce35d3d51cb51b883a8142
python3 -B /usr/local/libexec/obr-deploy/production/frontend.py --package /root/codex-release-packages/dnd-center-actions-40172842645-1 --manifest-sha e11f2ca5dc5a3f69743127ee1cd5caa69c8f59a88569ddcfce274c0ef380d616 --rollback
```

本地证据位于隔离工作树 `.local-evidence/deploy307/`；私有玩家散列与数据库备份只留服务器私有目录。封存 Wiki 发布器的原子切换、失败恢复和显式回退在 Linux 文件系统的 3 项检查已通过，但并未为了验收而回退正式站。

## 保留边界

本批保留原灰色切角、A4 和五页。大规模解析／索引线程化、规则架构及后端网络改造仍按一小时限制搁置；不能把本次自动化浏览器检查称为所有实际手机、原设备卡顿或真实 QQ 账号写入验收，也不宣称所有场景零延迟。
