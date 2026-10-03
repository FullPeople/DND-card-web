# G5 追加审计 D1–D4 修复记录

原不同模型审计冻结 `ffa8d58811d46dbbb6cb4f82b461d63115ac227a`，结论“不通过”。
全文原样保存在 `AUDIT-AUTOMATION-IR-G5-DELTA-FFA.md`，原 CI 补充单独保存，
不会把后来全绿改写成技术放行。第四轮 CI `37131464955` 最终 verify 与 17 个
浏览器组全部成功，原始日志在 `evidence/automation-ir/ci-37131464955/`。

主实施者修复：

| 发现 | 处理与回归 |
| --- | --- |
| D1 · P1 | 职业同步及整卡 finalizer 在明确同步事务内临时协调协议 3 的暂停自动化，finally 恢复用户原开关。三种同步共用此路径，原资源按新上限保持原余额，新资源从 0 开始。暂停同步、上限5→10、新增资源、确认新特性、保存重载与启用均不补次数。协议 2 仍不执行、不升级。 |
| D2 · P2 | 物品计数器使用物理 selection ID 绑定实例；即使父职业、规范条目、来源路径和 grantKey 相同，不同实例仍独立。旧独立账本分别迁移，保存两份消费债务；单件旧 canonical 键可迁移，旧合并键关联有歧义时阻断新授予并提示核对。 |
| D3 · P2 | 回执换键同时迁移 quickbar 的 order、hidden、widgets 字典键及分组 members，保留位置、页、样式、颜色与用户标签；只替换精确资源引用。重复引用去重，单成员不保留无效 group。画布行筛选及重载验证隐藏资源仍隐藏。 |
| D4 · P2 | 0.3 输入明确的单件重量在导入边界存入可校验的 manualItemWeight，重量求值与导出共用 owned 单件重量函数；数量、总重量及再次交换一致。相同路径中的显式单职业 die_size 存入 manualHitDie 并保留。两者不从 raw 推断；未知值保持未知。 |

增加八项回归，现 `automation-ir-g5-findings.test.ts` 合计 20 项。没有修改既有断言、
skip、timeout 或 retry。首次移除批量专用同步时漏保留两个仍被消费历史记录使用的
import，定向运行暴露 20 个失败，修复 import 后同五文件 **66/0/0**；失败原日志保留。

Node 22.12 / 24 各全套 **844 通过 / 25 环境跳过 / 0 失败**，严格类型检查、
integrated / standalone 构建通过，两份 singlePlayer=true / multiplayerModules=[]。
原始追加审计的统一脚本在当前源码原样内存重跑：

```text
ZERO：保持 spent5/4，升回5级 current0/0
MIGRATION：class/card/batch × enabled/disabled 六组均 10/0/spent10，原卡不变
ITEMS：两个grant，row1 5/0/spent5；row2 5/3/spent2
LAYOUT：beforeVisible=0，afterVisible=0，新key隐藏且有布局，旧key无悬挂布局
EXCHANGE：schema0.3，weight7，quantity2，totalWeight14
```

忽略的原始日志为 `evidence/automation-ir/g5-delta2-*`。新冻结仍须全部 18 个 CI
任务成功与独立只读复核；G5 未放行，G6 未开始。生产核心 6,396 条仍待标注。
数据仓仍冻结 `5f24e49`，未改变生产产物、共享模块及其散列。

回滚点 `automation-g5-zero-maintenance-fix-20261003`；新修复提交可反转或从独立
worktree 查看。原始 G0 工作区、Web main、线上及玩家数据未修改。
