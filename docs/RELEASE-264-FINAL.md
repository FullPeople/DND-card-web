# 2026-10-10：264 已配套上线

| 入口 | 实际版本 | 运行源码 |
| --- | --- | --- |
| [在线车卡](https://dnd.center/card/) | standalone-1.0.264 / 公告 0.1.53 | `7b99b0efa9a8b06b51f6f71f7da944a23c2d6133` |
| [角色卡库](https://dnd.center/library/) | standalone-1.0.264 / 公告 0.1.53 | 同上 |
| [新版枭熊](https://obr.dnd.center/suite-dev/manifest-dev.json) | 1.0.264-dev | `345abba37a852bab0d7a712eb2baffeaad578a01` |
| [稳定枭熊](https://obr.dnd.center/suite/manifest.json) | 1.3.22 | `b7f56eb6b58ea4012b8c2fadf7dd18b98fb37854` |

本次只更新 card/library 和 suite-dev/suite 静态页面。后端继续 1.0.261，实际 API 的 QQ 状态继续为 ready；此状态不等于已经验收真实 QQ 扫码。临时公开上传仍按 IP 限制，枭熊继续房间保存。没有修改 Nginx、SSH、防火墙、安全组或网络配置。

## 本批落实

- 修复受限筛选和职业主体／子职的文字与背景冲突。选中时白字深灰底，并持续显示流动标记；“目前全部”保持普通状态。系统要求减少动画时显示静态标记。
- 全局搜索遵守“规则与扩展”的 2014／2024 基础版本，继续尊重明确开启的旧版兼容设置。分类页选择“全部版本”不会覆盖全局搜索的基础版本。
- Wiki 增加“收藏”分类，条目右键可添加至收藏或移除收藏。按各自浏览器保存，切卡与刷新后保留；同名条目按版本、来源、扩展分别记录。只保存身份，不缓存私有规则正文，也不写入房间公共资料。
- 虚线选项在阅读模式也能打开并自动进入编辑。在当前特性框内展开、独立滚动，保持当前页、A4 布局和其他数值可见；手机需要资料时由明确的按钮打开 Wiki。
- 未填项可以忽略。仍按真实填写数量显示比例，不授予规则效果或资源；虚线变实线，全部填完或忽略后收起，可以恢复填写。
- 核对并同步旧卡后，仅忽略当前未填项。仍先生成完整的旧卡备份，再更新当前卡，保留当前 ID、绑定、已有答案与资源余额。
- 网站、卡库、新版枭熊及旧插件公告同步更新。新工作台保留 263 骰子修复；旧插件只更新配套查看器和公告。

## 来源与验证

- data：PR 15，受测源码 `0d4839463fd2fe87157db14a3bc77cd3643ee84e`，合并 `0b06aa5b048fc1761269a52315932f38e646ddd6`；两者 Git 树一致。
- suiteStable：PR 38，受测源码 `b7f56eb6b58ea4012b8c2fadf7dd18b98fb37854`，合并 `24169e836cf06c13ab00eb04f222c8efbc880f68`；两者 Git 树一致。
- suite：PR 37，受测源码 `345abba37a852bab0d7a712eb2baffeaad578a01`，合并 `693bddb83ae9c4bb3dea3249b8fb76c3588b0485`；两者 Git 树一致。
- web：PR 37，受测源码 `7b99b0efa9a8b06b51f6f71f7da944a23c2d6133`，合并 `6855427eec2d7b5e8feda29cf6d5edd6c580dc96`；两者 Git 树一致。

10 个精确候选工作流运行、37 个作业完成，35 个成功；2 个 Data 定时抓取作业按事件条件跳过。所有运行候选的检查通过后才合并和发布。

- [Verify tool proficiency choices](https://github.com/FullPeople/DND-card-web/actions/runs/37955723082)：`7b99b0efa9a8b06b51f6f71f7da944a23c2d6133`，success。
- [Verify shield training binding](https://github.com/FullPeople/DND-card-web/actions/runs/37955722778)：`7b99b0efa9a8b06b51f6f71f7da944a23c2d6133`，success。
- [Verify responsive spell icon painting](https://github.com/FullPeople/DND-card-web/actions/runs/37955723072)：`7b99b0efa9a8b06b51f6f71f7da944a23c2d6133`，success。
- [DND Center cloud migration](https://github.com/FullPeople/DND-card-web/actions/runs/37955722827)：`7b99b0efa9a8b06b51f6f71f7da944a23c2d6133`，success。
- [Verify web](https://github.com/FullPeople/DND-card-web/actions/runs/37955722981)：`7b99b0efa9a8b06b51f6f71f7da944a23c2d6133`，success。
- [Verify automation progress](https://github.com/FullPeople/DND-card-web/actions/runs/37955723093)：`7b99b0efa9a8b06b51f6f71f7da944a23c2d6133`，success。
- [automation-ir validation](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/37954804952)：`0d4839463fd2fe87157db14a3bc77cd3643ee84e`，success。
- [automation-ir validation](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/37954794705)：`0d4839463fd2fe87157db14a3bc77cd3643ee84e`，success。
- [Verify Suite candidate](https://github.com/FullPeople/obr-suite/actions/runs/37956454566)：`345abba37a852bab0d7a712eb2baffeaad578a01`，success。
- [Verify scoped stable paired release](https://github.com/FullPeople/obr-suite/actions/runs/37956416324)：`b7f56eb6b58ea4012b8c2fadf7dd18b98fb37854`，success。

- 完整单元检查：1,176 项通过，90 项按既有可选输入条件跳过；构建、类型、启动边界及网站／插件回归通过。
- 原 229 份输入重新完成 18,789 条运行核对，绑定 Data `0d4839463fd2fe87157db14a3bc77cd3643ee84e` 和 60 个实际消费者模块。6,527 条至少有一个支持的执行机制；此数不代表整条规则全部自动化。“忽略”不计为已填写或已实现规则。
- 正式域名的新增浏览器流程 9 项通过，没有跳过或重试：阅读模式就地选择、手机布局、忽略恢复、收藏刷新与切卡、版本搜索、持续状态与减少动画。
- 公网 API 未模拟，15 项浏览器检查通过：确认后真实上传、短 ID 复制、同步状态、匿名五页、外人删除拒绝、并发冲突保留本机草稿、完整 JSON 导出与核对导入，以及后端保留忽略状态。仅创建并清理合成验收卡 `YQWHSS`。
- 已加载五页和导出模块后完全断网，正式缓存加载、修改后刷新保存、完整 JSON 导出通过；云端写入为零。未代替玩家旧设备的缓存升级验收。
- 网站 196 个资源、20 个关键内容散列，插件 115 个公网检查和 4 份完整源码下载通过。两域 HTTPS、缓存、生命骰、赞助二维码、中文熟练名称、首页和三龙牌通过；旧站仍可打开导出，没有强制跳转。
- 原有 10 张云端卡的内容散列保持一致，数据库完整，自动备份运行。首页、三龙牌、Nginx、SSH 和其他保护状态未变；原混合 Web／Suite 目录的 424／315 项状态记录一致。

## 首轮失败与复验

内嵌选择的底部固定按钮曾遮住拖拽目标，已改成正常滚动布局；测试读取了错误的预览数据库，也已纠正。与新按钮文案、手机显式打开资料有关的既有验收路径已更新，未放宽规则、资源或保存断言。后续 Linux 浏览器完整选择组通过；本机就地拖拽另连续三次通过。

一项既有赠送戏法拖拽在首次 CI 中失败；同一受测提交重跑后整组通过，本机正式构建的该场景另连续两次通过。本机规则证据检查曾超时，最终采用精确提交 Linux CI 的实际验证结果。早期本机开发服务器曾出现动态模块加载失败，未将该次运行计为通过。

插件首次发布前检查因网站和插件回执重名停止，未切换插件目录、未删除网站回执；改用独立插件发布名后重新封存清单、核对并备份，完成发布。公网合成卡首次增加忽略字段时缺少必需的显示数组，存档验证正确拒绝；补全验收夹具后重新实测通过，没有改动产品校验或玩家卡。

## 备份与回滚

- 网站 262：`/root/codex-release-packages/dnd-center-choices264-20261009/backup/frontend/card` 和 `/root/codex-release-packages/dnd-center-choices264-20261009/backup/frontend/library`。
- 新插件 263：`/var/www/obr-plugins/suite-dev-before-suite-choices264-20261009`。
- 稳定插件 1.3.21：`/var/www/obr-plugins/suite-before-suite-choices264-20261009`。
- 服务器回执：`/root/codex-release-receipts/dnd-center-choices264-20261009.json` 和 `/root/codex-release-receipts/suite-choices264-20261009.json`。

在已授权的 root SSH 中，先回滚插件，再回滚网站。保留当前后端、QQ 配置和发布后新增的角色卡；不要绕过散列检查。

```sh
python3 /root/codex-release-packages/suite-choices264-20261009/suite_links.py --archives /root/codex-release-packages/suite-choices264-20261009 --receipt-sha 52fda29191e27b3b2a42a6b9f2c45e86073a89b56f815d06af93ed22ce53b7a6 --rollback
python3 /root/codex-release-packages/dnd-center-choices264-20261009/frontend.py --package /root/codex-release-packages/dnd-center-choices264-20261009 --manifest-sha ba9ecceda62d6548a7c100caddfba8a448b84c489ef0217b7be23efd8b4c4cab --rollback
```

若另一次发布已经改变保护状态，工具会停止，应先核对并发修改。待办为真实 QQ 扫码／账号授权、真实枭熊 GM／玩家房间、玩家原设备和实体触屏验收；上述构建与合成测试不能代替这些验收。
