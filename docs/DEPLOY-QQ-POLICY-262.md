# 2026-10-09：自动部署入口接续 QQ 配置

262 的界面与原卡同步修复已经发布。本次继续核对发现，正式 Actions 封包仍要求 QQ 为 `pending`，服务器固定入口也没有把实际 QQ 状态写入清单；线上 API 已为 `ready`，因此后续自动发布会被拒绝。修复已通过 [PR35](https://github.com/FullPeople/DND-card-web/pull/35) 合并，并安装到现有受限发布入口。

本批只修复发布工具及浏览器检查的就绪条件。网站和卡库仍为 `standalone-1.0.262`／公告 `0.1.52`，新版枭熊 `1.0.262-dev`、稳定版 `1.3.21`、后端 `1.0.261`。对应界面与逐目标回滚见 [262 最终回执](RELEASE-262-FINAL.md)。本次没有切换这些页面或重启后端。

新格式 2 制品把实际 `qqLogin` 写入两份 `release.json`、制品元数据与服务器清单。固定入口核对每一层一致，预检和切换继续检查实际后端版本、临时上传、IP 限额及 QQ 状态。预检之后发生状态漂移，必须在备份和切换前停止。历史格式 1 仍只代表 `pending`，用于既有状态查询和恢复，不能借缺失字段推断为 `ready`。未知状态、格式与不一致的页面元数据拒绝处理。原 OIDC 身份、精确提交 CI、目录范围、制品散列、锁、备份和恢复检查保留。

## 验证与实际接入

冻结安装源码 `eea6528543f5174ad4e1244cb8cfc528c2ff0732` 的五组 CI、全部 30 个任务通过。本地 Linux 52 项身份、制品与实际目录发布检查、24 项前端发布器检查通过，覆盖两种 QQ 状态、历史制品拒绝、预检后状态漂移、页面元数据不一致及实际封包。

合并后的同提交 `f3c9cdd9fa00cd999f9a78ba5b52e51ae9406f4f` 再次通过以下三组正式发布门禁：

| 工作流 | 运行 | 通过任务 |
| --- | --- | --- |
| Verify web | [37926896727](https://github.com/FullPeople/DND-card-web/actions/runs/37926896727) | 25 |
| DND Center cloud migration | [37926921701](https://github.com/FullPeople/DND-card-web/actions/runs/37926921701) | 1 |
| Validate dot deploy contract | [37926896678](https://github.com/FullPeople/DND-card-web/actions/runs/37926896678) | 1 |

[实际 Actions 清单回读](https://github.com/FullPeople/DND-card-web/actions/runs/37927010630) 已成功认证并连接服务器，核对冻结安装版本和全部帮助程序散列；该操作没有服务器持久写入或线上版本写入。[完整制品预检](https://github.com/FullPeople/DND-card-web/actions/runs/37928374672) 对应同一主线提交，包含实际云端构建、完整 Git 源码 ZIP、上传、服务器核对与封存清单；具体状态和封存散列见其 `dnd-center-receipt` 回执。本次只执行 `inventory` 和 `preflight`，没有执行 `publish`。

这次预检绑定上述主线提交与当时的在线基线。后续主线即使只更新文档，也须为新的发布提交取得同提交三组 CI 并重新预检，不能直接拿本次制品发布。

浏览器检查保留原行为断言：画廊等待实际可点击的侧卡区域；赠送法术落点使用接收区；离线重载先等待编辑按钮可用，再修改生命值为 17、失焦提交、核对 IndexedDB 并断网重载。离线检查本机连续三次通过。没有放宽数值、跳过失败或修改产品行为。

## 安装、保护与回滚

安装目录为 `/usr/local/libexec/obr-deploy`，从 `bc010449656e8e3af299a25393f6ca15f9d3f5af` 升至 `eea6528543f5174ad4e1244cb8cfc528c2ff0732`。安装器先核对旧程序实际字节与已知提交，再在现有静态发布锁内备份和替换。新备份：`/root/codex-backups/dnd-production-entry-20261009T115620Z`，保留五份旧帮助程序和原安装标记。升级模式不改部署公钥、SSH 策略或 sudo 授权，不重新加载 SSH 服务。

安装后回读核对通过：六张原有云端角色卡内容不变、数据库完整性为 `ok`；车卡和卡库的 291 个文件、首页、三龙牌、Nginx、SSH、QQ 凭据文件散列、备份任务和旧玩家目录均保持原状态。本机两个混合源码根目录保留。

本次工具更新可单独回滚。服务器保留了完整旧提交 Git 对象，执行前先核对实际安装标记仍为 `eea6528543f5174ad4e1244cb8cfc528c2ff0732`：

```sh
git -C /root/codex-production-entry-qq262-20261009-r3 checkout --detach bc010449656e8e3af299a25393f6ca15f9d3f5af
python3 -I -B /root/codex-production-entry-qq262-20261009-r3/tools/dot-deploy/admin_install_production.py --expected-revision bc010449656e8e3af299a25393f6ca15f9d3f5af --expected-installed-revision eea6528543f5174ad4e1244cb8cfc528c2ff0732 --apply
```

该操作会再次创建新备份，只回退发布工具，保留网页、后端及玩家数据；回退会重新带回旧工具要求 QQ 为 `pending` 的限制。网页和插件需要回退时，使用上述 262 最终回执的独立命令，先插件、后网站。

## 尚未完成的验收与权限功能

真实 QQ 账号扫码、真实枭熊多人房间、玩家原设备和实体触屏仍需相应环境验收。API 的 `ready` 只证明配置和入口就绪，不代表已完成真实账号验收。

按 QQ 号码授予云端卡编辑权仍未开放：当前 QQ 登录确认的是 OpenID，没有可信 QQ 号码关联，页面明确禁用该入口。不能把手填号码当作真实身份。枭熊按用户最新决定继续使用房间保存，不接云端卡同步；临时公开上传继续按 IP 限额运行。
