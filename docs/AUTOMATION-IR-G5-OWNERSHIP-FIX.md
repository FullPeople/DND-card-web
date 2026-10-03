# G5 D2-R1：旧合并消费账本的持有与历史修复

不同模型对 `8c5d80355e619496b953a23ccfcbdc429f04dc64` 的复核仍为“不通过”。
原文保存在 [审计](AUDIT-AUTOMATION-IR-G5-DELTA-8C5.md)，没有更改结论。
第五轮 [CI 37133385767](https://github.com/FullPeople/DND-card-web/actions/runs/37133385767)
最终 18/18 任务 success；该结果不能关闭审计的 P1。

旧合并账本仅按当前启用的 grant 检查歧义。先卸下一件，再协调账本，重载后
重新装备另一件，能够把它变成满额新计数器。主实施者改为检查全部持有的已审阅
IR 资源身份，装备、同调、数量及来源暂停不改变账本的归属候选。不对暂停项求值。

旧 class/path scope 的物品账本不能证明历史实例归属，即使当前只持有一件也需要
手动核对；不再自动采用上一版记录中的“单件旧 canonical 键可迁移”决策。
未解决账本持久保存 `featureGrant.requiresReview=true`，保留原消费债务与完整回执，
移除某一持有项、改父职业、保存重载也不会清除已知歧义。当前物理 selection ID
绑定的两份独立账本保持原迁移行为。计划函数保持纯函数，协调函数才写入标记。

增加 18 项回归，发现测试共 38 项：装备/同调/数量/来源 × 两个实例 × 加载前或
检测后暂停，以及删除持有项、删除父职业、历史标记持久性。首次四个数量回归失败
是把仅供协调边界验证的瞬时 quantity=0 当合法持久卡保存；原卡校验最低数量为1，
现先验证暂停时阻断，再恢复合法数量后做重载。未放宽卡片校验或既有断言。
失败日志 `g5-ownership-focused.log` 与后续原始日志均保留在忽略的证据目录。

```text
定向六文件：89 passed / 0 skipped / 0 failed
Node 24 全套：862 passed / 25 skipped / 0 failed
Node 22.12 全套：862 passed / 25 skipped / 0 failed
严格类型、integrated / standalone 构建：exit 0
两份单机审计：singlePlayer=true，multiplayerModules=[]
原正式 F1–F4、ffa D1–D4、8c D2-R1 三份原始反例脚本：exit 0
D2-R1 两方向重装备：grants=[]，resources=[]，旧 archive 回执仍存在
```

原始日志 `evidence/automation-ir/g5-ownership-*`。测试契约、skip、timeout、retry
均未放宽。数据仓 `5f24e49`、生产产物和共享散列未改变。新冻结须第六轮完整 CI
和不同模型只读复核；G5 未放行，G6 未开始，核心 6,396 条仍待标注。

回滚点 `automation-g5-delta2-fix-20261003`；本补丁可反转，原卡/G0工作区/
Web main/线上/玩家数据保持原状态。
