# 战俑工具选择：最新主线本地候选

基于实际已合并 Web main `ab03f1f90d126dbbec0284a2a2c32741953385ab`。
原 `1c16134f5bd1a2b9e400345603ee2aaa292c9b28` 候选及红测试仍保留；只移入
工具选择的两处生产增量、真实机械投影及相应测试，不重复带入已合并的盾牌/赞助/查看器成果。

根因是工具任选候选只读 `raw.tool`，真实来源的工匠工具/乐器用 AT/INS 类型而没有该标记。
现从明确工具类型 AT/T/INS/GS 和显式 tool 标记取候选，复用来源/版本门禁，排除车辆、
盔甲与未知类型，去重稳定ID；工具选择即使资料尚未加载也保留空的物品资料槽，
不能从空候选执行或默认补齐。运行代码不按战俑名称特判。

ERLW2014及EFA2024实际声明各有技能任选1、工具任选1。只保留两条声明和四个工具身份
的1902字节机械投影，原文 entries 为空，原始文件不提交。来源及字节验证脚本沿用原候选。
选择、替换、移除仅由明确用户动作写入；原手工熟练优先，已消耗资源不变。

当前36项定向测试与类型检查通过。Data实际函数探针和两条工具选择局部回执只证明这两条
明确能力及保存边界，不能升格为18,789身份的完整运行回执或发布证明。
`src/core/automation/choices.ts` 改变了48个锁定模块之一；正式构建保持拒绝陈旧运行覆盖，
不会只手改散列、计数、锁或生成回执以通过门禁。

本轮对工作区已有规则缓存与诊断JSON重新计算 JSON.stringify(JSON.parse(body)) 的SHA256，
按原报告229个 URL/摘要匹配，文件名不参与身份。只匹配4项，仍缺225项；已匹配文件和
明确缺失URL记录在私有本地 `existing-cache-match.json`，没有把G1输入当成完整原缓存。
未取得完整输入前，不生成假的 index/覆盖报告，不新增下载第三方规则原文。

完整测试/构建的实际结果、冻结SHA、范围差异及 bundle 留在交付回执；因缺全量输入，
绿色生产浏览器复验与远端CI待完成。无角色迁移、默认授权、上线、合并或部署声明。
Data/Suite既有401没有已证实修复，本轮不借其他凭据或API路线重试。

复现本地范围：

```sh
npx vitest run tests/warforged-tools.test.ts tests/choice-catalog.test.ts tests/shield-training-reference.test.ts
npx tsc -b
node tools/verifyWarforgedToolSources.mjs --verify-only --directory /path/to/existing-two-locked-files
# 完整门禁：必须先由原Data流程用全部229项真实原缓存重算，发布并绑定实际Data提交/blob
npm test
npm run build
npm run build:standalone
npx playwright test --config playwright.warforged-tools.config.ts
```

回滚仅此独立候选：`git revert --no-edit <本候选提交SHA>`。保留后续主线历史，
不 reset、force push 或还原已合并的盾牌/查看器成果。旧候选回滚方法保持其原记录。
