# 2026-10-09：262 已配套上线

用户优先要求的旧卡同步修复已经发布：核对并确认后，生成一张完整的“同步前备份”，把新资料写回当前卡。当前卡 ID、当前选择及棋子绑定保持原身份；备份具有新 ID，保留旧内容。不能把备份选为新的当前卡，也不把新资料写进备份。

| 入口 | 实际版本 | 运行源码 |
| --- | --- | --- |
| [在线车卡](https://dnd.center/card/) | standalone-1.0.262 / 公告 0.1.52 | `e3aafedd089e62a0e533ed1ba76e1d6a693d6989` |
| [角色卡库](https://dnd.center/library/) | standalone-1.0.262 / 公告 0.1.52 | 同上 |
| [新版枭熊](https://obr.dnd.center/suite-dev/manifest-dev.json) | 1.0.262-dev | `d9744d9ce4ac84847f5eb1d72b68532b1f16dce1` |
| [稳定枭熊](https://obr.dnd.center/suite/manifest.json) | 1.3.21 | `2edf4882ba5e635f2f9174e3c3d0242a1ce037b9` |

实际后端保持 1.0.261。本轮接续另一个会话已经发布的 261 QQ 接入代码、首页按钮和服务器配置，未发布后端、写入凭据或重启服务。公网健康接口现在返回 `qqLogin: ready`；实际 QQ 扫码授权及账号登录仍需用户现场验收，不能仅凭此状态声称真实登录成功。临时公开上传、原浏览器管理及每 IP 10 张额度已在公网实测。枭熊按用户决定继续使用房间权限与保存，不接独立站云端；付款和购买槽位入口没有启用。

## 同批完成的改动

- 新建规则条目在点击处附近出现对应输入框；长怪物文档能滚动到底。怪物编辑使用完整文档、虚线可编辑区域和 JSON 切换，保留未编辑及未知字段。
- 自行导入的扩展同时出现在自定义与原分类，不改变资料来源开关、快照及扩展包所有权。编写示例补全武器、护甲、工具等物品字段，规则包 JSON 支持点击和拖入上传，先校验再写入。
- 新插件的公告、设置、音乐和转场操作留在工作台；旧插件逐卡加载不播放启动画面。“下次版本更新前不再弹出”持续保存，更新版本后再次提示。
- 空公共仓库默认收起并保留用户展开偏好；职业主体、子职和非自定义／自定义筛选更明确地显示当前选择。
- 怪物图鉴右键支持“添加到场景中央”，使用图鉴的先攻和隐形配置，并在执行前检查当前 GM 权限。
- 角色簿支持筛选与排序，手动顺序持久保存；怪物与玩家名字栏分开。卡名右键和人物／怪物／资源卡的定位按钮只定位当前仍可读取的场景绑定，缺少绑定时禁用，不授予写入权限。
- 删除设置中的迷雾编辑器入口，保留底层迷雾功能；再次点击设置或功能开关返回原界面。
- 按用户提供的金额登记“用短弓磨死欧吕尔的神秘红发女子”100 元，使用邮件原头像；未声称独立核实收款，私人邮件和附件记录未进入公开仓库。

## 来源与验证

- data PR14：受测提交 `82d835256bc3e9e504bd10f3914940097e9d8baf`，合并 `1eda67e44d40cbac5786749031fd3e414e4257de`；合并树与受测树一致。
- web PR32：受测提交 `e3aafedd089e62a0e533ed1ba76e1d6a693d6989`，合并 `ef93131c0e655ad6a1deaaf67df47a539740c96c`；合并树与受测树一致。
- suiteStable PR33：受测提交 `2edf4882ba5e635f2f9174e3c3d0242a1ce037b9`，合并 `daf68dcce793514e355216816be41d36218f3d8b`；合并树与受测树一致。
- suite PR34：受测提交 `d9744d9ce4ac84847f5eb1d72b68532b1f16dce1`，合并 `55c239140c32e680c0f4016fb4099082dbe4134f`；合并树与受测树一致。
- 发布工具修复 Web PR33 已合并，受测提交 `a32d3ab07acdc460d077d7ec88a5867beea6549d`，合并 `3f5001fd7bd3e099d576102d77ba68ea22df8d4f`，两者树一致。网站运行制品与这次单独验证的发布工具分别封存，不把工具修复或文档提交当作新的页面源码。

运行候选的 11 个工作流、37 个作业完成：36 个成功；Data 定时抓取按原事件条件跳过，无失败。发布工具的精确提交合同检查和 PR 检查另行通过。

- [Validate dot deploy contract](https://github.com/FullPeople/DND-card-web/actions/runs/37910296082)：`e3aafedd089e62a0e533ed1ba76e1d6a693d6989`。
- [Verify automation progress](https://github.com/FullPeople/DND-card-web/actions/runs/37910232289)：`e3aafedd089e62a0e533ed1ba76e1d6a693d6989`。
- [Verify legacy viewer JSON and captions](https://github.com/FullPeople/DND-card-web/actions/runs/37910232285)：`e3aafedd089e62a0e533ed1ba76e1d6a693d6989`。
- [Verify tool proficiency choices](https://github.com/FullPeople/DND-card-web/actions/runs/37910232300)：`e3aafedd089e62a0e533ed1ba76e1d6a693d6989`。
- [Verify shield training binding](https://github.com/FullPeople/DND-card-web/actions/runs/37910232307)：`e3aafedd089e62a0e533ed1ba76e1d6a693d6989`。
- [DND Center cloud migration](https://github.com/FullPeople/DND-card-web/actions/runs/37910232275)：`e3aafedd089e62a0e533ed1ba76e1d6a693d6989`。
- [Verify responsive spell icon painting](https://github.com/FullPeople/DND-card-web/actions/runs/37910232311)：`e3aafedd089e62a0e533ed1ba76e1d6a693d6989`。
- [Verify web](https://github.com/FullPeople/DND-card-web/actions/runs/37910232316)：`e3aafedd089e62a0e533ed1ba76e1d6a693d6989`。
- [automation-ir validation](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/37906291116)：`82d835256bc3e9e504bd10f3914940097e9d8baf`。
- [Verify Suite candidate](https://github.com/FullPeople/obr-suite/actions/runs/37914507989)：`d9744d9ce4ac84847f5eb1d72b68532b1f16dce1`。
- [Verify scoped stable paired release](https://github.com/FullPeople/obr-suite/actions/runs/37914517056)：`2edf4882ba5e635f2f9174e3c3d0242a1ce037b9`。

- 原 229 份输入重新生成 Data 报告，绑定 `82d835256bc3e9e504bd10f3914940097e9d8baf`。18,789 条、60 个消费者模块与实际源码匹配，6,527 条至少有一个已支持执行机制；此数字不代表全部规则自动化。
- 本机原卡同步相关 9 个浏览器场景通过；公网额外 4 个原卡同步场景通过，包括保留 ID、完整旧内容备份、资源余额、刷新恢复，以及保存失败后的核对重试不重复造卡。两套插件都直接运行实际主机创建处理逻辑，确认创建备份不切走原卡，失败不改目录，普通新建仍选择新卡。
- 新插件真实浏览器及 SDK 边界模拟检查 21 项通过，包含文档编辑、怪物分栏、生命值往返、定位、选择固定和撤权；这不是实际多人枭熊房间验收。
- 公网 196 个网站资源、20 个关键内容散列、115 个插件检查、4 份完整源码下载通过。HTML／服务工作线程使用更新检查，带内容散列的资源使用长期缓存。生命骰、赞助二维码和中文熟练名称正常加载。
- 公网 14 项浏览器检查通过，云端 API 未模拟：明确确认后真实上传、自动同步、匿名五页、外人删除拒绝、并发冲突保留本机草稿、完整 JSON 导出与核对导入均通过。仅创建并清理本次合成验收卡 `YIVOFD`，没有修改玩家卡。
- 已加载五页和导出模块后完全断网，正式缓存加载、修改后刷新保存、完整 JSON 导出通过；资源余额与未知字段保留，无云端写入。未把此检查称为玩家旧设备的缓存升级验收。
- 两域 HTTPS、首页、三龙牌、旧站不强制跳转、同源 API、自动备份与数据库完整性通过；原有 6 张卡的内容散列一致。Nginx、SSH、其他受保护站点和后台服务未改动。原混合 Web／Suite 目录的 424／315 项状态记录一致，未重置或打包原目录。

## 首轮失败及恢复

最初工具把 QQ 状态固定为 `pending`，而已有服务器配置实际为 `ready`，切换后的检查拒绝发布并完整自动恢复到 261。没有覆盖 QQ 配置。修复后由发布清单封存预期状态，并在备份／切换前及切换后都检查；状态漂移仍拒绝发布。第二次使用新的包名、清单散列和逐目标新备份完成发布。首轮失败回执与备份保留，不伪装为成功。

本机完整插件构建曾遇 Windows 构建进程退出码 3221226505；精确提交的 Linux CI 完整构建与检查通过，实际部署取这些 CI 制品。新插件早期浏览器用例曾假定 Linux 无界面浏览器支持中键开页、同窗口判定，以及公告只有一个版本；已改为有界面的 CI 浏览器及当前公告／路由检查，最终原卡选择检查未放宽。

## 备份与回滚

只切换已授权的 `card/library` 和 `suite-dev/suite` 静态目录，共用发布锁，先创建并核对完整备份。未覆盖数据库、QQ 配置、首页或三龙牌。

- 网站 261 备份：`/root/codex-release-packages/dnd-center-ux262-20261009-r2/backup/frontend/card`、`/root/codex-release-packages/dnd-center-ux262-20261009-r2/backup/frontend/library`。
- 新插件 259 备份：`/var/www/obr-plugins/suite-dev-before-suite-ux262-20261009`。
- 稳定插件 1.3.20 备份：`/var/www/obr-plugins/suite-before-suite-ux262-20261009`。
- 服务器发布回执：`/root/codex-release-receipts/dnd-center-ux262-20261009-r2.json`、`/root/codex-release-receipts/suite-ux262-20261009.json`。

需要恢复时，在已授权的 root SSH 中按以下顺序执行。先回滚插件，再回滚网站，保证插件的保护散列仍匹配本次网站状态；不删除后台或数据库，不覆盖发布后新增的角色卡。

```sh
python3 /root/codex-release-packages/suite-ux262-20261009/suite_links.py --archives /root/codex-release-packages/suite-ux262-20261009 --receipt-sha 28a251e70ed04fdc66399410234fed5a588016c3cca5f75994b737c4ce138cda --rollback
python3 /root/codex-release-packages/dnd-center-ux262-20261009-r2/frontend.py --package /root/codex-release-packages/dnd-center-ux262-20261009-r2 --manifest-sha fe761bab2743270c03e0c30e8cba66ce9902eb19599dc02a059350fe42fffbd0 --rollback
```

若保护状态或当前静态文件被别的发布改变，工具会停止；应重新核对并发改动，不能删除回执或绕过散列检查。网站回滚保留已有 261 QQ 后端和当前配置。既有受限自动部署入口本轮未重新安装；本次使用已授权的 root SSH 和封存发布包。

待办仅为真实 QQ 账号扫码授权、真实枭熊 GM／玩家多人房间、玩家原设备及实体触屏验收。本轮未冒充这些结果。GitHub 两个仓库的既有 Issue／PR 已复核无未处理开放项，废弃 Go 后端 PR2 仍为关闭状态。
