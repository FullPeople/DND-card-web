# 2026-10-07：PR14 独立审查回归修复

原独立运行提交 `c38705cfe53ea245512050728669adff0b285c2f` 已推送
[Draft PR14](https://github.com/FullPeople/DND-card-web/pull/14)，基线为下方实际 main。
本轮修复两项审查复现：所有工具被强制Wiki导致显式 choose.from 概念选择不可点击；
过滤禁用来源/错版工具时重建空槽，修改别槽会丢掉旧答案。补红测试得到5失败/14通过。

现在真实索引工具及空的 any 选择保留Wiki槽；显式/混合概念选择保留原按钮，不伪造索引条目。
工具保存值和当前资格分开：禁用、错版、缺资料和超额旧槽原样保留，显示不可用状态，
不计入当前完成资格。编辑一个槽不清除其他旧值；恢复来源或明确开启legacy后恢复候选。
未知旧ID以文本显示，允许明确移除；不构造假Entry或自动授予能力。概念模式里点击已存
不可用项只允许取消，不能重新选择不可用项。技能通道原有筛选保持不变，禁用源技能不生效。
概念按钮同样按原槽位操作，不用去重显示列表重写答案；另一个红例证实旧重复值、空位与缺索引尾槽可被错误压缩，现已保留未操作记录。
玩家手工熟练、已消耗资源和HP不迁移或补写。

修复相关四文件测试64通过/1既有条件跳过（外部职业快照环境变量未设置），类型检查通过。
其中两项使用真实ChoiceWorkspace静态输出核对按钮、旧值/不可用提示和明确移除入口；
只隔离Node未使用的房间传输/指针事件初始化，未mock核心规则或伪造索引。这不是浏览器QA。
初次静态输出检查缺浏览器location全局，随后发现按钮选择器误计容器class，均保留诊断并
修正测试环境/选择器，没有为了测试改变产品需求。Data39的已绿测试未重新执行。

当前实际运行门禁仍失败 `Runtime coverage is stale for current consumer code`。
锁定48模块中变化的是choices.ts与ChoiceWorkspace.tsx两项；不手改散列/计数以绕过。
原c387全量结果1004通过/17陈旧回执失败/32条件跳过及四项CI红属于原提交，不能当作
本次完整绿色证明。完整重审、生产构建和浏览器仍待真实原输入，战俑不纳入250发布。

原Data会话可直接读取[真实39bd源码补丁与脱敏交接](handoffs/PR14-DATA-CONSUMER-BYTES-20261007.md)，
无需访问本机目录。补丁不含源全文、缓存、角色或凭据。本轮只更新独立PR14，不改原owner发布分支。
下方是初轮候选历史；当前源码和检查范围以本段及PR14最新头为准。

# 战俑工具选择：最新主线本地候选（初轮历史）

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
