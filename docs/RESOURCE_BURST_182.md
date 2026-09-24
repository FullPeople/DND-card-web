# 182：连续修改资源的客户端回归

## 已确认的原因

总览中的同一资源在第一笔请求未确认时从 `5 → 4 → 5`，旧版 `saveResource` 会将第二次的目标值 `5` 与尚未更新的已确认值 `5` 比较，算出空差量。第二笔实际执行时，最新值已经是 `4`，空差量使请求再次提交 `4`。因此第二次修改没有实际变化，也不会产生变化通知，界面随后可能回弹。

修复前，真实 `DMConsole → ResourceRow → platform/resources` 浏览器路径已复现：第二笔发出的 `resource.current` 期望 `5`，实际为 `4`。不是只依据最终界面或直接调用队列推断。

修复后，资源数值与锁定按钮提交明确的字段意图，在队列执行时与最新权威资源合并。同一资源串行执行，其他资源可独立执行；仍保留宿主 expected 冲突检查及撤销/重做的预期值。配置编辑的字段差异与按钮的数值意图分开处理。

## 浏览器覆盖

新增 `tests/e2e/resource-burst182.spec.ts` 与 `resourceBurst182.harness.jsx`，使用实际 `App`、`DMConsole`、资源控件、自动资源推导、Workbench 消息接收与请求队列。只在宿主边界模拟持久状态、ACK、旧 selection/catalog 及其他玩家的更新，以精确控制它们的先后顺序。

共 11 项：

1. 总览 `5 → 4 → 5`，第一笔 ACK 到达前继续操作，第二笔真实请求必须为 `5`。
2. 总览 `2 → 1 → 2 → 0`，每笔意图都发送，早期 ACK 不覆盖最后的 `0`。
3. 不同资源交错操作，迟到回执不使任一资源回退。
4. 第一笔 ACK 被延迟时，远端将上限改为 `7`；第二笔数值修改保留新上限及正确 expected。
5. 完整 App 快捷栏 `5 → 4 → 5`，跨自动保存批次、迟到旧 selection、后续远端修改。
6. 完整 App 快捷栏 `2 → 1 → 2 → 0` 与另一资源交错，允许真实点击跨越 80 ms 批次边界，逐帧检查最终本地意图。
7. 公共资源通过真实库存队列完成 `5 → 4 → 5`，抵抗旧 catalog。
8. 公共资源 `2 → 1 → 2 → 0` 与另一资源交错，四次变更保持独立。
9. 怪物资源只有 metadata，没有角色文档或 documentRevision，连续往返及旧消息后仍保持最新值。
10. 总览连续修改后的撤销/重做，检查实际请求 `5 → 4 → 5 → 4 → 5` 及迟到快照。
11. 完整 App 加入真实全施法进度职业并调用 `syncAutoResources`，一环法术位连续 `4 → 3 → 4 → 3`；`runtime.resources.current`、`spellSettings.slots.used`、旧格式 `spellcasting.spell_slots.current` 始终一致，重新接受远端文档不补满已消耗的法术位。

法术位用例独立应用实际请求中的 `delta.native` 与 `delta.legacy`，没有在每次保存后从 native 重导出旧格式来代替验证。每项保存真实请求、权威状态与逐动画帧显示样本，避免最后正确但中途回弹的假通过。

## 本地结果与边界

- 11/11 通过（21.8 秒）。随后加强旧格式独立差量验证，自动法术位单项再次通过（4.3 秒）。
- 此后资源控件的 ACK/props 唤醒及 ABA 场景由独立 `control-settlement182` 回归覆盖；最终无新增 Buff 发布候选需合并这组测试验证。当前记录不将较早整组运行冒充最终候选验收。
- 修复前证据：`F:/CodexWork/2026-09-20/w-xu/resource-burst182/before-fix/second-intent-lost.png` 与 `error-context.md`。
- 每次运行输出：`F:/CodexWork/2026-09-20/w-xu/resource-burst182/results/` 下的 `resource-burst-evidence.json`。
- 本组 notices 日志记录的是模拟宿主接受的实际变化，不能代替真实 Suite 通知/音效或在线多人房间验收。生产宿主持久化与通知队列的定向证据见 Suite `docs/WORKBENCH_RESOURCE_182.md`。

本任务只添加测试与本文档，没有更改同步协议，也没有部署。
