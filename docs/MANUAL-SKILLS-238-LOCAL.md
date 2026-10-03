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
