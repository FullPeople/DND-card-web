# 2026-10-03 手动技能入口恢复（未部署）

按本轮用户要求，技能编辑恢复两个独立入口：手动熟练、专精。说明同时展示当前生效状态，手动勾选与规则授予分开保存；普通模式继续显示合并后的无熟练/熟练/专精标记。豁免保持原有只读状态。

- 专精勾选包含手动熟练；取消专精保留熟练，取消手动熟练同时清除手动专精。
- 技能熟练改为来源与手动记录取并集，历史 false 也不撤销来源授予；撤销来源不影响独立的手动记录。
- 不引入新的自动专精适配。现有引擎的专精来自既有 expertise 记录，本次原样保留其含义。
- 沿用统一编辑/保存/撤销通道；SheetEditContext 补足另一标签页只读与 Suite 断线限制，既有目标写权限和写入端门禁保留。
- 编辑状态仍将豁免与技能数值列对齐；新增控件不拉高原有状态行。

验证：41 项定向单元及 TypeScript、standalone 构建通过。第一次全单元找到一条仍期待手动 false 抹掉来源的历史断言；已按新契约修订并重跑：最终全单元 796 通过、25 条件跳过，TypeScript 及浏览器静态发现再次通过。现有 playwright.direct232.config.ts 静态发现 14 场景，其中 direct232SkillsAttacks.spec.ts 5 场景覆盖手动/来源、专精、撤销、自动化关闭重开、保存刷新、另一标签页只读、Suite 权限撤回、A4/响应式宽窄布局。workspace、reference-layout、edit-mode、card-refinements、manual-sheet 的过时技能禁用断言同步更新，豁免锁定保留。

本环境已有 Chromium socket 权限失败证据，没有重复启动或尝试绕过；浏览器执行及截图等待本分支 CI，不能用静态发现代替通过。尚未推送、合并或部署；未操作玩家存档。

定向浏览器命令：

```sh
npx playwright test --config playwright.direct232.config.ts tests/e2e/direct232SkillsAttacks.spec.ts
```


## CI2 失败诊断与定向修订

实际 Web 6ad412e4 / CI 37100640190 的 direct232 组为 12 通过、2 失败，不能记为全绿。手动开关、来源撤回/撤销、保存刷新已经走到最终深比较，失败原因是期望漏写取消熟练时明确保存的 expertise.perception=false；现保留完整对象比较并加入该字段。另一标签页只读和两种布局宽窄验收均实际通过。

Suite 权限用例误放在 standalone 配置。日志显示 level0 空卡，而 standalonePlugin 会在编译期移除 Suite 传输并固定 inWorkbench=false，故模拟消息从未载入目标。用例已移到 manualSkillsPermissions.spec.ts，注册于现有 source-feedback 的 integrated 项目，不跳过权限验收。新断言先验证目标姓名按钮、隐匿专精及 +8 数值，再开启编辑验证真实姓名输入和勾选态，撤回权限后验证原目标、衍生结果与无 save 消息。浏览器复验等待下一次 CI；本次不改变运行源码。

```sh
npx playwright test --config playwright.direct232.config.ts tests/e2e/direct232SkillsAttacks.spec.ts
npx playwright test --config playwright.source-feedback.config.ts tests/e2e/manualSkillsPermissions.spec.ts --project=integrated
```


## A4 编辑态技能名窄修

最终浏览器截图与 CI1 编辑态对照确认：双控件把状态列从 10px 增至 24px 后，A4 编辑态两字技能名被挤成一个字；原对齐与行宽断言不能发现文字被省略。只对 A4 编辑态将状态/数值/调整列收为 22/21/24px、列间距 1px，双控件内部间距 2px，两个控件各自 10×10px 和行高保留，读取态与响应式规则不变。

浏览器用例新增全部 18 个真实两字名称的 scrollWidth/clientWidth 检查，并核对控件尺寸与键盘焦点；原有长名称省略、数值列对齐、整页无横溢出断言保留。宽窄 A4 截图改为真实名称，避免被故意的长名称夹具遮蔽。窄修本地类型与发现检查通过不代表浏览器视觉已验收，仍须精确候选 CI 的新断言及截图复验。
