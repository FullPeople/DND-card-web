# G5 零值维护追加修复

主实施者在 `8ad78e6` 的独立复核期间追加原 F1 脚本：同步副本后、重载前，仅再调用
`setResource(copy,key,0)` 和 `setResource(copy,'spell-slot:1',0)`。无正值恢复、无休息，
消费债务仍从 5/4 截断为 1/2，升级恢复 4/2 次。反例已交原审计员独立确认。

为保持审计对象不变，在独立 worktree `/workspace/dnd-automation-g5-zero` 从
`8ad78e6` 准备补丁。主实施者只调整 setResource：当前结果为 0 时保留消费债务，
同步副本显式 preserveDebt 继续适用；玩家明确的正值恢复及休息仍可降低债务。
feature/automatic/pact pool 归档一起更新，避免下次同步重算截断。

新增两项回归：重复零值维护、同步、JSON 重载、升级不补资源；正值恢复可以清债；
契约位换环时维持共享池债务，短休明确恢复。没有修改任何既有断言、skip、timeout
或 retry。原 `8ad78e6` 第三轮 CI 继续保留结果，不能替代此补丁的新冻结验证与复核。

主实施者验证：Node 22.12 / 24 各全套 836 通过 / 25 环境跳过 / 0 失败，严格类型、
integrated/standalone 构建通过，单机审计 true/[]。追加零值维护的原反例在此补丁
原样重跑，copy 与升回 5 级仍保持 feature spent5、slot spent4，两者 current0。
F2–F4 原脚本也保持纠正结果；回执位于此 worktree 忽略的 `evidence/automation-ir/`。

回滚从新补丁提交反转，或隔离 worktree 查看 `automation-g5-formal-findings-fix-20261003`。
原始 G0 工作区、原卡、线上未修改。G5 尚未放行，G6 未开始。
