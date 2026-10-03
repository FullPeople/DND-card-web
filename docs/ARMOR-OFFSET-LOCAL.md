# 角色护甲调整修复（隔离候选，未发布）

## 行为边界

- 角色 AC 按规则、装备、特性与 `sheetBonuses.ac` 计算；不再从枭熊场景最终数值制造 `suite-ac` 绝对覆盖。
- 新的旧格式导入只把已知总值与当次规则计算之间的差额保存为可撤回调整，并保留完整原文档 `externalSnapshot`。
- 已保存的旧 AC 覆盖不会在读取时静默更改。自动化设置 → 护甲与盾牌显示原记录、当前总值、当前规则值及已有调整。用户可明确恢复规则计算（保留已有调整），或将当前总值转换为调整；原记录另存历史，原生导入/导出保留。操作幂等，可撤销/重做；调整归零恢复计算值。
- 用户追加要求的卡面上方“条目 / 等级”和“修正”按钮移除，AC 调整与恢复入口仍在卡面调整/自动化设置中。
- Suite 关联角色的 stats AC 写入被拒绝；场景差异即使来自 revision 0 也不再覆盖角色 AC。HP、资源、状态仍按原增量规则同步。怪物 AC 保持原编辑语义。混合角色/怪物群体 AC 操作先整体拒绝，避免部分执行。
- 已有规则 `effects` 的 AC set/add 仍有效。旧覆盖在用户明确处理前仍生效，并显示警告；此候选不推断被覆盖前的历史基础，也不修改实际玩家存档。

## 验证

- `npx vitest run tests/armorAdjustments.test.ts tests/ac193.test.ts`：12 通过。
- Web `npx tsc -b --pretty false`：通过。
- Suite `node tools/workbench-runtime-176-selftest.mjs`：17 组通过。
- Suite `node tools/workbench-group-217-selftest.mjs`：32 项通过，含混合组预先拒绝、怪物 AC 与 HP 回归。
- Suite `node tools/workbench-proxy-178-selftest.mjs`：9 项通过，实际 SDK/Immer Proxy 边界。
- Suite `npx tsc --noEmit --pretty false`：通过。
- Web 全单元首轮：717 通过、25 跳过、30 失败；失败集中于并行启动改动的 `startupPhase` 在无 document 的握手测试中读取 DOM。对应工作者修复后重跑：747 通过、25 跳过（100 个文件通过，1 个跳过）；随后 Web/Suite 类型检查再次通过。
- 新/更新浏览器测试 `playwright.armor-offsets.config.ts` 共 5 条已发现；普通与经审批的本地重试都在 Chromium 启动时遇到 `socket() failed: Operation not permitted`，没有执行任何产品断言。真实 UI、真实枭熊房间、多设备仍未验收。

只修改隔离分支，不推送、不部署、不合入 main/dev。
