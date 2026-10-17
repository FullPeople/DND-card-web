# 加载与反馈 301 最终发布记录

2026-10-18 05:16:43 +0800，首页、网站／卡库／Wiki `standalone-1.0.301`、新版插件 `1.0.301-dev`／工作台 `0.1.75` 与稳定插件 `1.3.34` 已实际发布。独立线上核对和公网浏览器检查通过。后续文档提交不替代下列运行来源。

## 冻结来源与修复

| 目标 | 运行提交 |
| --- | --- |
| 首页、网站、卡库、Wiki、开发版内嵌工作台 | `82114d67b732f4ede0e804f1e6bd66717de3b2d5` |
| Suite dev | `e7f22f31e057f88d09532760f8ab337ae7a44e09` |
| Suite stable | `729edd0747657c0afb90e3c9b162fe02450e19d4` |
| 稳定版配套旧查看器 | `c2d20cdc9e434dd8c22e4e89966ece51c39120af` |
| Data main | `c2718249dcec5b03ae9c8d6e0bf619ca27a6fca4` |

Web PR87／88、Suite PR105／106／107、Data PR43／44 已合并，保留各原始提交。首页重复初始化和侧栏重置、开场退出等待重资源、Wiki 假空结果与切换跳闪、仪表盘旧表单残留、熟练说明截断均已修复。首页复用原切图、配色、轮播和骰子，电脑和平板默认展开侧栏，原 3D 物理资源在交互后加载。角色卡保留真实卡面，首次操作排队并重新核对角色与权限；离线入口收齐实际使用功能的静态依赖后才登记。

原生透明浮层使用共享原模块的独立 HTML 别名，首次绘制前确定画布配色。普通投骰、先攻和群体结果五秒后自动清理，不等待视口请求；手动历史保留至关闭。具体原因、开源参考及逐项反馈见[加载说明](LOADING-PERFORMANCE-20261018.md)和[反馈记录](LOADING301-FEEDBACK.md)。

后台 `1.0.295`、QQ／云端暂停、账号私有、开发版轻量 2D、稳定版旧查看器、旧站卡档导出、其他项目、服务与数据库均保留。原混合工作区、Godot／原生参考工程和玩家资料未修改。

## 完整来源回放与检查

原始 229 份输入、18,789 个身份与 70 个消费者模块已完整回放，消费者固定为 `23920a9ee751fac6686fa0bd6c94fcc0aae4ce18`。最终报告 Data `1caf46a57caaa1e9bcb48e0dd8195cb08078f403`，SHA-256 `2ad65f4b05bd07b58194ad599ab4435babae0e01ef56b3437331e8edd0be1688`，4,355,245 字节。逐条结果与前一完整报告一致：已复核 4,561、部分可用 6,537、不可用 522、未解决 0；部分可用不代表整条规则完成。没有手工移植见证、缩减原始输入或放宽下一次来源漂移守卫。

Web 完整单测 1,546 通过／91 项条件跳过；完整加载浏览器组 43 通过／2 项诊断跳过。另有首次资源操作四流程、Suite 配色两流程、四种窄屏和九项法术拖动通过。Suite 67 组回归、18 项演出控制器、17 项演出浏览器及轻量四客户端的结果清理与历史保留通过。Data 454 项 Vitest、14 项 Node、6 项 Python 和可重复生成通过；历史条件跳过未计入成功。

必要精确提交 CI 共 22 组、53 个任务全部成功。全部对准上表运行来源；候选结果不替代合并后的精确提交检查。按尝试记录保留历史失败，未降低断言或改产品去适配未就绪的测试操作。

| 仓库 | 检查 | 运行 | 成功任务 | 尝试 |
| --- | --- | --- | ---: | ---: |
| DND-card-web | `web.yml` | [39066543077](https://github.com/FullPeople/DND-card-web/actions/runs/39066543077) | 29 | 1 |
| DND-card-web | `automation-progress.yml` | [39066572059](https://github.com/FullPeople/DND-card-web/actions/runs/39066572059) | 1 | 1 |
| DND-card-web | `bc-performance.yml` | [39066574711](https://github.com/FullPeople/DND-card-web/actions/runs/39066574711) | 1 | 1 |
| DND-card-web | `cloud-migration.yml` | [39066577098](https://github.com/FullPeople/DND-card-web/actions/runs/39066577098) | 1 | 1 |
| DND-card-web | `cloud-suspension.yml` | [39066543164](https://github.com/FullPeople/DND-card-web/actions/runs/39066543164) | 1 | 1 |
| DND-card-web | `dot-deploy-contract.yml` | [39066579461](https://github.com/FullPeople/DND-card-web/actions/runs/39066579461) | 1 | 1 |
| DND-card-web | `equipment-ac.yml` | [39066582062](https://github.com/FullPeople/DND-card-web/actions/runs/39066582062) | 1 | 1 |
| DND-card-web | `loading-performance.yml` | [39066543175](https://github.com/FullPeople/DND-card-web/actions/runs/39066543175) | 1 | 1 |
| DND-card-web | `responsive-spell-icons.yml` | [39066584269](https://github.com/FullPeople/DND-card-web/actions/runs/39066584269) | 2 | 1 |
| DND-card-web | `shield-training.yml` | [39066586518](https://github.com/FullPeople/DND-card-web/actions/runs/39066586518) | 1 | 1 |
| DND-card-web | `warforged-tools.yml` | [39066590279](https://github.com/FullPeople/DND-card-web/actions/runs/39066590279) | 1 | 1 |
| obr-suite | `verify-suite.yml` | [39067887390](https://github.com/FullPeople/obr-suite/actions/runs/39067887390) | 1 | 1 |
| obr-suite | `qq-permissions.yml` | [39067887349](https://github.com/FullPeople/obr-suite/actions/runs/39067887349) | 1 | 1 |
| obr-suite | `dice-light292.yml` | [39067887340](https://github.com/FullPeople/obr-suite/actions/runs/39067887340) | 1 | 1 |
| obr-suite | `multiplayer-sync.yml` | [39067887567](https://github.com/FullPeople/obr-suite/actions/runs/39067887567) | 1 | 1 |
| obr-suite | `cloud-suspension.yml` | [39067887355](https://github.com/FullPeople/obr-suite/actions/runs/39067887355) | 1 | 1 |
| obr-suite | `runtime-sync.yml` | [39067905790](https://github.com/FullPeople/obr-suite/actions/runs/39067905790) | 1 | 1 |
| obr-suite | `verify-suite.yml` | [39058090610](https://github.com/FullPeople/obr-suite/actions/runs/39058090610) | 2 | 1 |
| obr-suite | `qq-permissions.yml` | [39058090629](https://github.com/FullPeople/obr-suite/actions/runs/39058090629) | 1 | 1 |
| obr-suite | `multiplayer-sync.yml` | [39058126790](https://github.com/FullPeople/obr-suite/actions/runs/39058126790) | 1 | 1 |
| obr-suite | `cloud-suspension.yml` | [39058130848](https://github.com/FullPeople/obr-suite/actions/runs/39058130848) | 1 | 1 |
| dnd5e-automation-data | `build.yml` | [39064228144](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/39064228144) | 2 | 1 |

旧 3D 资源性能诊断 [39067887409](https://github.com/FullPeople/obr-suite/actions/runs/39067887409) 使用历史配套 Web `fc2e4d5bb17e960cdae89c24526a1d5504c80d8c`，四个任务均在等待诊断宿主就绪时超时。失败日志已读取并保留；它不属于本批发布的轻量 2D 制品，未将其计为成功，也未据此恢复插件 3D。本批首页原 3D 则另以公网真实触摸加载及投掷完成检查。必要门禁的精确状态和每个任务链接保存在封包 `ci-proof.json`。

## 封包、恢复副本与公网

最终封包目录 `/root/codex-release-packages/loading-feedback301-r2-20261018`；全局回执 `/root/codex-release-receipts/loading-feedback301-r2-20261018.json`。清单 SHA-256 `85ab7c8eb6ca4a96a764d02fc19f575794a0f7ace31008da1f541f37f5ed1f0a`；回执 SHA-256 `dcd2680fe21503ca308d9d8450ee7a231d17315ab5ab3385c265b26d9e0b476a`。最终封包各阶段只启动一次，预检、apply、独立核对退出码均为 0，持久记录保留。发布在同一锁下交换五个完整目录，首页先发布资源与源码、最后替换入口；保留既定旧哈希资源。

第一份 `loading-feedback301-20261018` 预检成功，但 apply 在生成恢复副本后、任何目录交换前退出：发布器误把原有 `jolt-physics.wasm-Doo5Sm15.gz` 当成带原文件的生成压缩副本。它没有创建全局切换回执，当时线上六目标经复核仍逐文件等同原基线。原包、暂存、完整恢复副本和失败日志保留，没有重跑原 apply。修复仅区分带配对原文件的生成 gzip 与以 WASM 文件头确认的原始预压缩资源；10 项事务检查及实际包的 15 组配对 gzip、2,021,569 字节解压 WASM 通过。R2 重新捕获基线并另建六份完整恢复副本，网站运行代码及上述 CI 提交没有变化。

| 目标 | 完整恢复目录 | 原文件 | 线上完整文件 |
| --- | --- | ---: | ---: |
| card | `/var/www/dnd-center/card-before-loading-feedback301-r2-20261018` | 1702 | 1779 |
| library | `/var/www/dnd-center/library-before-loading-feedback301-r2-20261018` | 652 | 677 |
| wiki | `/var/www/dnd-center/wiki-before-loading-feedback301-r2-20261018` | 70 | 75 |
| suite-dev | `/var/www/obr-plugins/suite-dev-before-loading-feedback301-r2-20261018` | 2355 | 2567 |
| suite | `/var/www/obr-plugins/suite-before-loading-feedback301-r2-20261018` | 4337 | 4419 |
| home | `/root/codex-release-packages/loading-feedback301-r2-20261018/backup-home` | 287 | 315 |

六个目标的完整线上树、六份新恢复副本、126 项保护值和两个数据库只读完整性检查通过。公网 433 个关键文件按完整字节散列匹配；十个公开源码入口在服务器验证完整 SHA-256，各归档逐文件匹配冻结 Git blob，公网分别验证 ETag、长度及首尾各 4096 字节。没有冒充公网全量下载十份归档。

当前公网开发版 224 项与稳定版 24 项跨域透明像素检查通过，普通设置与配置背景另有不透明对照。该检查使用实际发布 HTML／CSS，阻止外部应用脚本，不代替枭熊真实宿主。首页手机触摸模拟使用实际命中坐标点击，首次零物理资源请求，延迟加载后完成真实投骰。

## 公网加载样本与真实验收边界

下表单位毫秒。电脑、平板使用公网实际线路；手机为无缓存、1.6 Mbps／100 ms 延迟／CPU 四倍降速。首页“就绪”表示原开屏结束；角色卡同时等待内容可用和开场退出；Wiki 等待真实条目。首屏背景绘制不算资料就绪。九次页面检查没有脚本异常；单次受控浏览器样本不保证所有线路、全部实体设备的速度。

| 模拟设备 | 入口 | 首次内容绘制 | 实际就绪 |
| --- | --- | ---: | ---: |
| desktop | home | 352 | 2634 |
| desktop | card | 320 | 3369 |
| desktop | wiki | 156 | 1759 |
| phone | home | 956 | 3271 |
| phone | card | 1556 | 5289 |
| phone | wiki | 384 | 3766 |
| tablet | home | 356 | 2644 |
| tablet | card | 288 | 3322 |
| tablet | wiki | 168 | 1742 |

Chrome 仍未出现在连接工具中，未进入用户原房间，也未完成实体手机／平板及原设备验收。Issue73 缺原卡与同版错误值；Issue77 缺真实双身份下刷新、换图、退出重进和再投骰的逐步结果，均保持开放。Data PR5 的运维权限提案继续留为草稿，没有扩大权限。部分邮件附件为工具不支持读取的二进制，未冒充已经查看。四封相关回复草稿更新，一封新增，并重新读取确认五份均未发送；其余五封原稿保留。自定义状态图标／文字及侧栏入口的建议未冒充为本轮已发布功能。
