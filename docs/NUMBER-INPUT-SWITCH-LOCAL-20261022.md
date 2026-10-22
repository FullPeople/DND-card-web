# 2026-10-22 · 数字输入跨卡补提交，本地性能候选

基线为 `0381a08`；生产代码只改 `src/ui/NumberInput.tsx`。没有修改 App、规则求值、缓存边界、保存队列或权限保护，也没有推送、部署或接触玩家原卡。

## 改动与前后对照

原组件在失焦时通过 `useLayoutEffect` 把 `display` 复制到 `draft`。跨卡值不同时，第一次提交后还要同步更新每个字段的本地状态。候选让失焦字段直接显示当前 `display`，只在聚焦期间显示输入草稿；每次聚焦先用当前存储值初始化草稿。追溯接管和既有 blur／Enter／Esc 处理保留。

使用真实 NumberInput、ValueTraceProvider 和 InteractionFeedbackProvider，两个预先求值的合成角色，六属性及当前／临时生命共 8 个输入。先往返预热，再测 4 次切卡；每个字段外包 React Profiler，并记录实际 DOM 数值。测试没有替换数字输入实现。

| 观测 | 修改前，4 轮各自结果 | 修改后，4 轮各自结果 |
| --- | --- | --- |
| 8 个输入的叶节点提交总数 | 16、16、16、16 | 8、8、8、8 |
| 其中 nested-update | 8、8、8、8 | 0、0、0、0 |
| 实际字段值 | 与目标卡一致 | 与目标卡一致 |

原组件运行新增性能断言时因仍有 8 个同步补提交而失败，原始失败回执保留。前后逐字段 JSON 分别位于忽略目录 `.local-evidence/number-input-before/` 和 `.local-evidence/number-input-after/`，文件名为 `number-input-switch-commits.json`。

这个结果只证明数字输入叶节点消除了重复提交，不代表整个 App 切卡耗时减半，也不代表整张角色卡没有其他渲染或布局工作。

## 验证

Windows／Edge，隔离缓存、5201 端口、单浏览器工作进程：

- TypeScript 和 `git diff --check` 通过；`numberInput234.test.ts`、`resource-intents182.test.ts` 共 6 项单元通过。
- 新增 4 项浏览器通过：跨卡提交计数、聚焦算术期间外部更新、按最新余额运算、一次提交、Esc／错误表达式／空值取消、原值播种和只读字段跟随更新。
- 既有 `valueTraceImmediate.spec.ts` 的 5 项通过：鼠标首帧、键盘及 Tab、存储基础值与计算总值、只读追溯、重新聚焦被覆盖的基础字段不回写旧值。
- `control-settlement182.spec.ts`、`resource-burst182.spec.ts` 共 24 项通过：晚到／乱序回执、ABA、聚焦表达式、未确认写入、实际 App 快捷栏、延迟编辑器、加载期间撤权或切卡、公共资源、怪物资源、撤销重做及自动法术位一致性。

合计 33 项浏览器通过。浏览器配置只用于隔离开发验收，没有修改标准来源门禁。标准生产构建、最终整合提交的 CI 和真实账号／房间验收继续由整合阶段完成；这些合成夹具不替代上述验收。
