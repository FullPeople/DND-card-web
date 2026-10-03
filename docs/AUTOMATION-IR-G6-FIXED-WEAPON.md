# G6：2024 固定武器伤害的执行边界

主代理核对 XPHB p27 完整 Damage Rolls 后，用有效 IR 记录复现了固定伤害 `1` 被自动算为 `1+7`：敏捷修正 +5 与魔法武器伤害加值 +2 都被无条件叠加。2024 固定伤害不是伤害骰；当前装备模型也不能安全表达对固定伤害适用的例外及仅作用于伤害掷骰的加值。

执行器现在对 2024 的固定数值伤害停止生成自动攻击，并显示固定伤害需要手动填写的提示。判定仅使用协议装备模型和规则版本，不检查条目名称或 raw 字段。既有手写攻击、弹药资源、骰子伤害与 2014 规则保持原有行为。PHB p196 与 XPHB p27 的完整英文规则分别核对，未混用两个版本。

本次新增两项回归；没有修改既有断言、skip、超时、重试或性能预算。用例验证正负属性修正、明确手写攻击、导出再导入、资源不变、卸下与禁用来源，以及 2014 和 2024 的区别。新用例草稿曾因缺少 revision 和使用无效 provenance 层失败；修正测试输入后保留完整 schema 校验、所有原断言与失败日志，再移除修复重现有效记录的原始错误，最后恢复修复。

命令与关键原文：

```text
npx vitest run tests/automation-ir-fixed-weapon.test.ts
Tests  1 failed | 1 passed (2)
"damage": "1+7"

npx vitest run tests/automation-ir-fixed-weapon.test.ts tests/automation209-weapons.test.ts
Test Files  2 passed (2)
Tests  18 passed (18)

npm test -- --maxWorkers=2
Test Files  108 passed | 1 skipped (109)
Tests  902 passed | 25 skipped (927)

npm exec --yes --package=node@22.12.0 --cache /workspace/npm-automation-cache -- npm test -- --maxWorkers=2
Test Files  108 passed | 1 skipped (109)
Tests  902 passed | 25 skipped (927)

npm run build
npm run build:standalone
npm exec --yes --package=node@22.12.0 --cache /workspace/npm-automation-cache -- npm run build
npm exec --yes --package=node@22.12.0 --cache /workspace/npm-automation-cache -- npm run build:standalone
exit_code: 0
standalone-audit.json: singlePlayer=true, multiplayerModules=[] (both Node versions)

CI=1 PLAYWRIGHT_BROWSERS_PATH=/workspace/playwright-browsers npx playwright test --config playwright.automation-ir.config.ts --workers=2
4 passed (31.6s)
```

日志在私有 ignored `evidence/g6-fixed-weapon-*`。全量 CI 以后续实际回执为准；该修复没有部署。G6 当前已审核 1275/6396；1190 条更正产物经双 Node 八文件逐字节重放及数据 CI 37152872630 验证后，已普通合并到数据 main `60cc978`，旧 main `a69b542` 和被撤回批次均保留。新增 85 条尚待全量重放与发布。G6/G7/G8 未通过，整体未达执行文档底线。

回滚：同时 revert 本次执行器和新回归提交，重新运行原检查命令；历史失败与审核撤回记录保留。数据批次独立 revert 对应 overlay 与 reviews 索引，重新派生锁定产物。Web main、部署和玩家文件没有本次写入。
