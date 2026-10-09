# 2026-10-10 · 角色卡与卡库 267 发布验收

角色卡与卡库均已上线 `standalone-1.0.267`，公告 `0.1.54`，源码提交 `9aca0f6e6d507e14436deb87a0972a04c155f70a`。本次完善具名职业等级、熟练加值和等级表对应的资源次数计算，拒绝不明确的恢复条件和多个独立冷却的错误共用。职业升级按已消耗量调整剩余次数，刷新、来源关闭和原生导入保留消耗。范围仅为 `/card/` 与 `/library/`，后端、插件及其他入口保持原状；玩家休息执行入口仍未开放。

精确主线 [网页检查](https://github.com/FullPeople/DND-card-web/actions/runs/37992985255) 的 25 项任务、[云端检查](https://github.com/FullPeople/DND-card-web/actions/runs/37992990062) 和 [发布合约](https://github.com/FullPeople/DND-card-web/actions/runs/37992994355) 全部成功。固定服务器发布入口的 [预检](https://github.com/FullPeople/DND-card-web/actions/runs/37994258748) 与 [发布](https://github.com/FullPeople/DND-card-web/actions/runs/37994699398) 均成功。

服务器回执为 `published`，两个入口均为 `candidate`，`protectedMatches=true`、`databasePreserved=true`、`backendChanged=false`、`recoveryNeeded=false`。发布前创建并校验两个入口的备份。独立公网核对 197 个封包文件的 SHA-256 全部吻合，版本与精确源码一致。新的浏览器上下文使用原创角色验证上限 5、剩余 2，职业等级升到 7 后上限 7、剩余 4；刷新和原生 JSON 导入继续保持 7／4，无页面异常或休息执行按钮。真实玩家和实体设备未验收。

运行报告锁定 Data `18b7fcbf0c0cf35a1a4792e570931751139e3a7b`，SHA-256 `2d42725116328a45743b4050d421b4077cc499a176f49a7239de017f3d4ac241`，消费者 `e835aedb8fb4c1e544f793a4a48ba61fddb98182`。18,789 个身份、229 份资料、4,561 项审阅保持一致；6,535 项至少具有一项计算或可用选择，比原报告净增 8 项。这不代表整条规则全部实现。十个实际点数付费法术属于独立 268 候选，不包含在此次发布中。

封包 20,106,791 字节，SHA-256 `9fcb2762aa6bc87f54db81b5b1d88ddac9e88a7e6d2a6859a9448212ad411514`。服务器封印 `bffa42c404cfb6dce8165bd810564f58c862aa86188718ddb535f943c2f58edd`，预检运行 `37994258748`／尝试 `1`，原发布运行 `37994699398`／尝试 `1`。恢复点包为 `/root/codex-release-packages/dnd-center-actions-37994258748-1`，服务器回执为 `/root/codex-release-receipts/dnd-center-actions-37994258748-1.json`。恢复时使用固定发布入口及对应封印核对原事务；结果不明确时先查询原发布状态，避免再次切换。不得覆盖玩家数据库或包外入口。
