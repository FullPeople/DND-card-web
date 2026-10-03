# 持续目标：automation-ir 全覆盖

执行依据：[用户附件](docs/AUTOMATION-EXECUTION-PLAN.md)。当前隔离分支 `codex/automation-ir-20261003`，不推送、合并或部署。

- [x] G0：基线729通过/24跳过/0失败，类型与两构建成功，单机审计通过。
- [ ] G1：真实全库分母、Foundry匹配、输入哈希与二次复跑，提交用户审阅。
- [ ] G2–G4：独立协议、校验、结构派生与Foundry白名单。
- [ ] G5：接线、协议3、旧卡保护、全回归与独立审计。
- [ ] G6：核心四书needsAnnotation为零，扩展书逐书报告。
- [ ] G7–G8：kiwee演练、对外交付与最终审计。

详细待办同步维护于 [自动化TODO](docs/AUTOMATION-OVERLAY-TODO.md)。未达完整底线；真实房间、实体设备、Node22回归尚未验收。
