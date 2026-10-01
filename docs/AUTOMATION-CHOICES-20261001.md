# 2026-10-01 职业选择、资源与数据追溯 · 本机实现

本机预览：<http://127.0.0.1:5192/>。源码在 `D:/Desktop/DND-card-web/local-automation-choices`，从自动化 209 的 `87c3a5677cbe5a5dc2ef80c9e6a21ca012c0f66f` 导出。原来 5190 的开发站、U 盘移动交互原型和 D 盘混合脏源码均未覆盖。开发数据库为 `dnd-card-automation-choices-20261001`，Vite 缓存在该目录的 `.cache-choices`。

## 当前约定与行为

- 自动化开启后，职业特性组保留原有深色粗体职业标题、等级和下方分割线，未新增标题色带。待选的起始熟练项、起始装备出现在右侧，用浅灰小气泡和细虚线；有明确选择的特性气泡也带虚线及完成数。外层其他框仍遵守原五页 A4 的边框约定。
- 选择界面占据左侧整块特性正文区域，保留原身份栏、五页和切角框；“返回特性”或 Escape 退出。编辑模式才能修改。Wiki 中存在的候选显示无边框空格，拖入、删除、满格替换和重复项交换均写入原有记录。技能自动切到术语汇编、对应版本 PHB/XPHB 和技能类别；法术筛选来源、职业法表与环阶，法师预备候选限于当前法术书。引用特性同样拖拽选择；装备及内嵌/自定义内容列出全部可点击候选。
- 所有候选沿用 Reference 悬停预览；左侧选择内容使用独立 tooltip，不改变临时 Wiki 筛选。Wiki 拖入法术保持特性页；窄屏从 Wiki 开始拖拽会自动露出左侧空格，落下后回到 Wiki。“查看选择”可返回左侧；退出后恢复选择前的 Wiki 分类、搜索及筛选。候选未加载保留位置，不用替代概念冒充真实条目。
- 完成的职业自带按钮变为实线灰底，在其他选择未完成时继续可点击。职业及其特性的全部待选项完成后，一起收起这些按钮；已选特性正文和修饰符仍保留。职业标题右键仅一项“显示自带选项”/“隐藏自带选项”；开关写入 featureLayout，可随原生备份恢复。自动收起不留下阻止以后新增配额的隐藏标记。熟练项按每个职业首级的来源字段生成；装备属于起始职业，总等级 1 时显示未领取入口，再显示自带选项时可显式重新领取。
- 施法模型从职业结构字段生成戏法、法术书、职业法术和预备法术配额。2014/2024 分别读取身份、来源和单职业等级；未到施法等级不生成有环法术选择。书/已知引用保留空格位置，删除和替换保留已学记录；从书中移除未被其他职业保留的法术时同步取消它的预备。来源赠送另计。
- 法术选择直接写入既有 selections、职业戏法格、预备引用及 classSpells 职业归属引用，不另存一套答案。法术页修改同步反映选择气泡；重新选择不复制已有普通法术，不重置法术位或赠送法术的已用次数。取消选择保留已学记录，停用来源保留归属，导入校验归属格式，删除职业/法术清理对应引用。
- 明确的 cantripBonus 结构字段，以及同一子句同时声明额外戏法数量和所属职业法表的窄正文格式，加入该职业戏法容量。已选圣职奇术使/原初职能术师的额外戏法按声明适配；未选 options 分支不生效。其正文中的技能数值加值仍列待适配。
- 起始装备须显式确认领取。2014 的多组选择及固定装备一整套处理；具体武器/法器候选也有预览。领取的物品和金币不附着于特性修饰符；刷新、资料加载与升级不会再次领取。右键再次领取直接新增，不撤回旧物品或旧金币。资料迟到时只补齐已领取占位物品的数据，不新增数量。
- 金额修正发生在资料标准化及角色备份读入时：对于单组 A/B 方案、单个明确 GP 数值的无歧义正文，直接修正结构化铜币数。实际牧师方案 A 从 7000 修正为 700，领取 7 GP。界面不提醒；不改变已经领取的金币，不修改上游网络/外部快照文件。
- 选择答案与授予内容分开存储。重选撤回旧选择的内容和效果；停用来源保留答案，效果与关联资源停止执行；重新启用保留消耗记录。手动熟练记录仍优先。
- 资源转换优先读取 resources / resource / uses / system.uses；再适配明确的次数、短长休恢复句式、职业表和算式。运行代码无职业或特性名字分支。资源随提供它的特性出现/消失，名称固定；上限、剩余与外观属于资源。玩家未改上限时才随规则升级，上下调等级和重新附着不会清掉已消耗次数；玩家修改后保留上限与外观。恢复只在明确休息操作中执行。
- 回气保留 `1d10 + 当前职业等级` 算式。真实 2024 数据的 1 / 4 / 10 级上限 2 / 3 / 4 已核对；短休恢复一次、长休回满。2014 使用独立资料和恢复规则。
- 长短休弹窗同时处理资源、生命和生命骰。短休选骰后确认，掷骰只发生一次，回执记录结果；长休确认生命回满并分配生命骰恢复。重复请求不重复恢复，过期请求拒绝；原生导出/导入保留休息回执和资源历史。2014 与 2024 生命骰恢复预算分别处理，依据官方 [2014 休息规则](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring) 与 [2024 规则术语](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary)。
- 编辑模式点属性基础值或卡面调整输入会平滑展开追溯。原输入仍作布局锚点，覆盖输入的屏幕位置和高宽相同；上方显示名称，下方逐行显示来源、修正和分隔后的最终结果。输入中的候选数值纯计算预览，确认/关闭提交，Escape 撤回。AC、生命上限、先攻、速度、熟练、被动察觉、技能、豁免以及法术调整已接入现有追溯。

## 验证与边界

119 项相关核心检查通过（13 个文件）：纯计算不改角色、重选/停用来源、装备一次性领取、多组完整校验、金币资料修正、迟到装备补全、消耗保留、手改上限、重放/过期休息和原生备份恢复；包括外部 2014/2024 战士及牧师实际快照，以及 17 组 2014/2024/TCE 职业开局施法配额；名称改写的原创资料验证没有按职业名分支。外部快照仅只读，不收入源码或补丁。

13 条 Edge 浏览器流程分批通过：完整技能拖拽/替换/删除、灰色按钮与统一收起、单项右键开关及重载、真实牧师 Wiki 特性悬停、真实战士资源升级、资源/休息/特性删除、多组装备领取、原位追溯、再次领取与生命骰回执、法师戏法/书/预备、术士满格替换、牧师额外戏法、窄屏拖拽、Wiki 筛选恢复和自定义选项。列表中的组合行为属于同一流程，不单独虚增计数。新交互首批 12 条中 9 条通过，3 条仍使用旧点击/控件角色的测试修正后，与受影响流程共 6 条复测通过；最终退出按钮位置及自定义选项修正后 3 条复测通过。技能/法术候选来自原创夹具；职业来源使用只读真实快照。桌面 1512×982、窄屏 430×900。原位输入偏差在 1.1 px 阈值内。

TypeScript 与 automation-standalone 构建通过。standalone-audit.json 记录 singlePlayer=true、multiplayerModules=[]。没有执行完整 CI、真实枭熊多人或实体手机验收，没有发布、推送或更改版本/公告。

复杂正文中的数值条件、临时效果和未结构化的额外戏法/法术/熟练并未全部转换。例如实际圣职选择的正文技能加值仍需人工处理（额外戏法已支持）；选择本身、资料引用和归属已保存，自动化设置明确列出待适配规则。未知资源算式/恢复格式也会列出，不静默执行。休息由玩家确认；历时、每日资格、休息中断及场景条件尚未建立游戏时钟模型。

## 试用与复跑

在新开发站建立职业或导入角色，打开编辑模式，在“特性”页点虚线气泡。旧手动卡需先开启自动计算。Wiki 候选从右侧拖入左侧空格；灰色按钮可再次打开，全部完成后从职业标题右键“显示自带选项”找回；长短休在主要页资源栏打开。

```powershell
Set-Location D:/Desktop/DND-card-web/local-automation-choices
node node_modules/vite/bin/vite.js --mode automation-standalone --host 127.0.0.1 --port 5192

$env:DND_AUTOMATION_CORE_DATA='U:/code/DND-card-automation-209/local-rules/upstream-209'
node node_modules/vitest/vitest.mjs run tests/automation-choices-resources.test.ts tests/automation209-equipment.test.ts tests/automation209-spells.test.ts tests/automation209-actions.test.ts tests/automation209-weapons.test.ts tests/resources.test.ts tests/characterDetails.test.ts tests/ac193.test.ts tests/spellWorkspace210.test.ts tests/rules-179.test.ts tests/spells-179.test.ts tests/class-spell-choices.test.ts tests/choice-catalog.test.ts
node node_modules/@playwright/test/cli.js test --config playwright.choices.config.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build --mode automation-standalone
```

当前 node_modules 是既有 U 盘依赖的只读复用联接；新的缓存和构建产物留在本目录。源码没有独立 Git 元数据；`evidence/implementation.patch` 以 87c3a56 为基线，供在合适分支复核合入，不应直接覆盖混合脏目录。

当前截图见下节；源码哈希、补丁及检查回执在 `evidence/source-receipt.json`。早期弹窗截图属于历史迭代，不代表当前选择界面。


## 本轮选择视图截图

- `evidence/wiki-skill-empty-workspace.png`：两个无边框空格及 Wiki 技能筛选。
- `evidence/wiki-skill-workspace.png`：拖入技能、移除按钮与悬停。
- `evidence/wizard-wiki-spell-workspace.png`：戏法拖拽与完整概念。
- `evidence/cleric-wiki-choice-tooltip.png`：真实引用特性拖入后的概念。
- `evidence/inline-choice-workspace-tooltip.png`：内嵌选项全部展开及悬停。
- `evidence/completed-options-hidden.png`：按钮统一收起，特性正文保留。
- `evidence/wiki-choice-narrow.png`：430×900 的 Wiki 拖拽返回与悬停。

非 A4 / 紧凑布局的独立副本 `local-layout-nona4` / 5197 不属于本轮改动副本；本轮恢复补丁与来源回执来自 5192 功能树。后续整合须同时保留该布局分支的最新用户决定。
