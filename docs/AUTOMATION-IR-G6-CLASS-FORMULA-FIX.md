# G6 同名职业等级公式绑定修复

2026-10-03。审阅2024 Fighter时，主实施者实际复现：同时保存XPHB Fighter2与PHB Fighter17，Fighter2所属资源公式`@classes.fighter.levels`被后遍历的旧版职业覆盖，上限错误地从1变成2；无职业父项的装备也把同名歧义静默当17。

公式变量现在按实际父职业绑定该职业的别名；没有匹配父项时，只允许唯一活跃职业绑定，歧义保持未绑定并显示现有“未执行资源规则”提示。没有按职业名称写特殊规则，不改协议、来源身份或算式。

主实施者新增两项独立手写运行测试：同名不同来源/顺序/外职业升级不借等级，自己升级及移除/恢复/来源开关保留消费债务；无父项装备歧义不造资源，唯一绑定恢复后仍不补次数。原失败是2失败/12通过，日志`evidence/g6/class-formula-before-fix.log`保留。修复后定向14/0/0；Node22.12.0与24.19.0全量各900通过/25环境跳过/0失败，严格类型及两种构建退出0，单机审计各true/[]。IR浏览器原四例4/0/0，使用实际配置`playwright.automation-ir.config.ts`，没有改变断言、skip、超时或预算。

全量日志：`class-formula-check-node22.log`/`class-formula-check-node24.log`；单机构建`class-formula-standalone-node22.log`/`class-formula-standalone-node24-replay.log`，审计各`class-formula-audit-node22.log`/`class-formula-audit-node24-replay.log`；浏览器`class-formula-browser-ir-correct-config.log`，均在忽略的`evidence/g6/`。首次辅助审计读错`dist/build-audit.json`及浏览器筛选不存在文件，失败日志保留；更正为实际生成的`dist-standalone/standalone-audit.json`和现有配置后通过，没有修改测试契约。

完整远端CI需以本修复的实际提交后续回执为准，不沿用47421a5的结论。G6核心仍有needsAnnotation，默认JSON仍为G5草稿；未合Web main、部署或修改玩家资料。

回滚：反转本次代码/测试/记录提交，或恢复分支此前ebf0efe；旧失败、阶段标签和数据批次回执保留。数据覆盖批次与Web运行代码分开提交，恢复代码不自动重新授予资源。
