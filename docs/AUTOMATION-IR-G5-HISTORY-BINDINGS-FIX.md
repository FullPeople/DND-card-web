# G5 D2-R2：旧来源路径账本保留历史候选

`c993bbd4b128012665e658ed9e1f5bad7b8286c3` 不同模型只读审计仍不通过。
原文完整保存于 [审计](AUDIT-AUTOMATION-IR-G5-DELTA-C993.md)。
第六轮 [CI 37136767788](https://github.com/FullPeople/DND-card-web/actions/runs/37136767788)
18/18 任务最终 success，但不能关闭其 P1。原日志和逐命令统计仍保留。

旧 `feature-resource:["row0","equipment:0:a:0"]:uses` 合并账本与旧 canonical
编码不同：删除父职业时，实际 `removeSelection` 保留已交付装备并清除父关联，
当前路径改变。仅保存 requiresReview 标记未能继续关联原候选物品，导致无恢复授满。

主实施者修复：

- 按格式识别旧多段来源路径与 class scope 的物品回执；单个当前实例不能证明历史归属。
- 歧义回执保存已关联的稳定实例资源键 `reviewKeys`，归档保留全部历史候选；删除父项或旧 owner 不清除候选。
- `rememberFeatureResources` 在持有状态改变前保存候选，不执行资源授予、不求值公式；暂停自动化时同样保存历史。因此未先进行协调时的实际删除也受保护。
- 对更早已丢父项、没有 reviewKeys 的交付装备，保留的 grantKey 与旧路径尾段仍产生待核对候选。来源路径本身不作为唯一归属证明。
- 计划检查仍为纯函数；不带 review 标记的任意 reviewKeys、非法/重复/过长键在卡片导入校验时拒绝。正常独立物理实例回执保留原迁移行为。

新增20项回归：两种键 × 删除旧 owner 与否 × 开启/暂停 × 是否先检测（16组），
两种键单当前持有项、旧孤立装备回执、非法候选导入。全部通过，现发现测试58项。
原审计反例首次输出及四份审计反例后续复跑均保留。

```text
定向七文件：113 passed / 0 skipped / 0 failed
Node 22.12 全套：882 passed / 25 skipped / 0 failed
Node 24 全套：882 passed / 25 skipped / 0 failed
严格类型、integrated / standalone 构建：exit 0
两份 standalone-audit：singlePlayer=true / multiplayerModules=[]
原 F1–F4、ffa D1–D4、8c D2-R1、c993 D2-R2 四份反例脚本：exit 0
两种编码删除父项/旧 owner 后：grants=[]，resources=[]，spent5归档及候选提示保留
两种编码单持有项加载后：旧 archive 仍存在，requiresReview=true，无自动授予
```

原始日志 `evidence/automation-ir/g5-history-bindings-*`；没有更改既有断言、skip、
timeout 或 retry。数据仓 `5f24e49`、生产产物和共享文件保持冻结。
新冻结需第七轮完整 CI 与独立只读复核。G5 未放行，G6 未开始，核心6396仍待标注。

回滚点 `automation-g5-ownership-history-fix-20261003`。新提交可反转；原卡、原G0工作区、
Web main、线上、玩家数据未修改。
