# QQ 账号与填写窗口 280 上线回执

[角色卡网站](https://dnd.center/card/?intro=0)和[卡库](https://dnd.center/library/)已上线 **standalone-1.0.280**；[新版枭熊插件](https://obr.dnd.center/suite-dev/manifest-dev.json)已上线 **1.0.280-dev**。刷新网站；关闭工作台并刷新枭熊房间后读取新版本。

已登录的 QQ 按钮显示该账号昵称和头像，点击打开账号与卡库二级弹窗。旧卡核对的自定义勾选减少重复计算，加入全选和全取消。导入时所有未填写的选择默认忽略，包括稍后载入的职业等级属性提升；已填写内容、当前资源和之后升级产生的新选择保留。

主要页的虚线填写入口展开覆盖快捷栏、特性、背景与专长、已预备法术的整个区域，支持拖入、选择、切换其他待填项和 Esc 关闭。固定 A4、可选响应式布局、其他页面和导出尺寸保留。

单机版角色名及角色簿显示云端标记。登录后本机卡右上角改为云按钮，可上传成为云端卡；已是云端卡则查看信息、管理授权或移除原卡。编号和复制操作移入二级账号弹窗与云端设置。卡主管理授权，获授权账号编辑角色内容，未授权 DM 同样只读；房间改动继续自动写回云端原卡。279 的原生导入、紧凑权限提示、卡库动画和个人骰子设置保留。

## 运行来源与检查

- Web：`3952a89a36f0f3d6ab260910d1f57ddc2ab7e54f`，[PR 52](https://github.com/FullPeople/DND-card-web/pull/52)。
- Suite：`e94cc6827f09c6444e46679d34e0359bc68cc7e9`，功能 [PR 55](https://github.com/FullPeople/obr-suite/pull/55)、检查基准 [PR 56](https://github.com/FullPeople/obr-suite/pull/56)。
- Data：`a1c070e86a30df3a6f3432919cb0dacd13e7bee4`，[PR 28](https://github.com/FullPeople/dnd5e-automation-data/pull/28)。

| 精确提交检查 | 运行 | 结果 |
| --- | --- | --- |
| web / web | [38074843194](https://github.com/FullPeople/DND-card-web/actions/runs/38074843194) | 26 项任务成功 |
| web / cloud-migration | [38074859440](https://github.com/FullPeople/DND-card-web/actions/runs/38074859440) | 1 项任务成功 |
| web / dot-deploy-contract | [38074862876](https://github.com/FullPeople/DND-card-web/actions/runs/38074862876) | 1 项任务成功 |
| suite / qq-permissions | [38078971851](https://github.com/FullPeople/obr-suite/actions/runs/38078971851) | 1 项任务成功 |
| suite / verify-suite | [38078971849](https://github.com/FullPeople/obr-suite/actions/runs/38078971849) | 1 项任务成功 |
| suite / dice-release246-profile | [38078971848](https://github.com/FullPeople/obr-suite/actions/runs/38078971848) | 4 项任务成功 |

最终运行源码共 28 项 Web 任务、6 项 Suite 任务全部成功。此前本机单元检查 1,292 项通过、91 项既有条件跳过；云端浏览器覆盖 48 个场景，原生卡及权限检查 23 项通过，使用合成账号。填写窗口拖入、切换、关闭和窄屏 A4、旧卡 80 个选项反复全选与全取消、资源及备份保留、职业选择、Wiki 和离线保存均有实际浏览器记录。

原 229 份真实输入的完整运行审计：18,789 个身份、4,561 项审阅、6,535 个实现见证、零未决、63 个消费者模块。报告 SHA-256 为 `b58dec23f2b5c9389fbab74b87e8a22072842575fec0c0f341ad9ad156fffcca`，绑定上述不可变 Data 提交；没有手改见证、计数或消费者指纹。

旧骰子画面对照连续两轮在 246 基准与当前代码之间发现 2 个像素、单通道 1 级差异，原始失败记录保留。当前绘制源码与实际线上 279 版一致；仅将画面对照固定到该线上提交 `a4eedb8c6ae798bd072ca0bade8e366db59132c6`，核对 7 个共享纹理。继续要求全部 RGBA 精确相等，保留透明边角、恢复和屏幕尺寸检查；其他三组历史性能与生命周期仍使用原 246 基准。最终提交所有检查通过，没有改动生产绘制代码。

公网 95 项入口、资源与源码链接通过核对，其中 11 项源码别名。运行资源和 3 份代表性源码封包在公网核对完整散列；其他源码别名在服务器核对完整散列，在公网核对状态、长度和首尾字节，避免重复下载同一大包。公开网站实际浏览器确认角色卡、私有卡库及桌面和窄屏 QQ 图片，卡库无公告和调色盘；腾讯授权页返回 200，无 100008。**本轮未做真人 QQ 扫码、真实多人枭熊房间和实体设备验收**，不据此宣称所有卡顿已经消失。

## 发布、保护与恢复

网站使用[官方预检 38075759473](https://github.com/FullPeople/DND-card-web/actions/runs/38075759473)的精确源码制品，[发布 38076076596](https://github.com/FullPeople/DND-card-web/actions/runs/38076076596)成功。制品 SHA-256 为 `1ec460773791723462be0797a83daf92fe37b9cf3aca6f699a23c59d1ca52bde`。网站发布前后数据库同为 58 个账号、32 张云端卡、13 张临时卡，没有替换数据库。

Suite 使用精确最终提交的 QQ 检查生产制品，仅切换 Suite-dev。完整发布目录 9762 项、126 项保护值通过核对。发布前完整独立备份 251,792,246 字节，SHA-256 `341768af6b18b8211254e39514f4562dc9965154a7192c690d71f71faa4ea113`；备份自包含，不依赖线上目录。封存回执散列 `27b8bd3de7f846c3d6b295fe94068e4583788c7d8f1919c356afea2e73b35233`。

服务器在 `2026-10-10T19:33:51.652152+00:00` 记录发布完成。此次本地 SSH 客户端在服务器任务结束后未正常收尾；独立读取并核对服务器封存回执、封包散列、源码和当前线上版本后，恢复本地发布结果，保留连接失败日志。随后公网和数据库检查通过。

| 目标 | 服务器回执 | 独立恢复点 |
| --- | --- | --- |
| 网站与卡库 | `/root/codex-release-receipts/dnd-center-actions-38075759473-1.json` | `/root/codex-release-packages/dnd-center-actions-38075759473-1/backup/frontend/card`、`/root/codex-release-packages/dnd-center-actions-38075759473-1/backup/frontend/library` |
| Suite-dev | `/root/codex-release-receipts/qq-fill280-20261011.json` | `/var/www/obr-plugins/suite-dev-before-qq-fill280-20261011.tar.gz` |

Suite 单独恢复入口：

```sh
/usr/local/sbin/obr-maintenance python3 /root/codex-release-packages/qq-fill280-20261011/suite_links.py --archives /root/codex-release-packages/qq-fill280-20261011 --receipt-sha 27b8bd3de7f846c3d6b295fe94068e4583788c7d8f1919c356afea2e73b35233 --rollback
```

恢复入口先核对当前完整目录、独立备份、保留原目录和保护值，再执行原子交换。后续保护项变更会拒绝覆盖；组合恢复先读取各目标回执和当前状态，保留独立首页及现有玩家数据。云端 API 继续 1.0.279 / account-private，稳定插件继续 1.3.23；首页、三龙牌和旧卡入口的公网散列保持一致。原混合工作区未用于打包或重置。

## 服务器抢修后状态

按固定清单清理 45 个旧静态回退目录、26 个旧编译包，实际释放 16,725,610,496 字节。安装持久内存保护：管理会话上限 512 MiB，维护任务合计上限 256 MiB；服务器文件校验和发布均通过受限维护入口，前端在 CI 构建。

发布后 7 个服务运行，数据库完整性为 ok；本次重启至核验没有新增内核内存耗尽记录。可用磁盘 17.23 GB，现场数据库为 58 个账号、34 张云端卡、13 张临时卡。现场计数会随玩家使用变化；核验只读。历史转发服务的内存限制问题保留为独立观察项，没有据此认定所有潜在内存问题已解决。

本文件及后续文档提交只补充发布记录。运行制品、源码 ZIP 和已通过的检查仍绑定上列精确运行源码，不重新构建或发布。
