# 持续目标：automation-ir 全覆盖

执行依据：[用户附件](docs/AUTOMATION-EXECUTION-PLAN.md)。当前隔离分支 `codex/automation-ir-20261003`，不推送、合并或部署。

- [x] G0：基线729通过/24跳过/0失败，类型与两构建成功，单机审计通过。
- [ ] G1：技术盘点与二次复跑完成（117输入、18,792暂定记录），用户审阅待确认；证据见docs/AUTOMATION-IR-G1-RESULT.md。
- [ ] G2–G4：独立协议、校验、结构派生与Foundry白名单。
- [ ] G5：接线、协议3、旧卡保护、全回归与独立审计。
- [ ] G6：核心四书needsAnnotation为零，扩展书逐书报告。
- [ ] G7–G8：kiwee演练、对外交付与最终审计。

详细待办同步维护于 [自动化TODO](docs/AUTOMATION-OVERLAY-TODO.md)。未达完整底线；真实房间、实体设备、Node22回归尚未验收。

G1遗留：58英文身份缺口、107Foundry孤项、2三方同键冲突、3未解复制、5父级/变体缺口。见详细TODO与G1报告；尚未卡片接线或进行浏览器/CI及独立审计。
