# 2026-10-03 · 来源护甲加值与属性首帧编辑（本地候选）

本轮在独立 Web 工作树中实施用户追加的来源自动化与属性点击修复，不推送、不合并 main、不部署。AC 场景覆盖与顶部按钮移除的配套记录见 [护甲调整](ARMOR-OFFSET-LOCAL.md)。

## 防御来源的实际根因

从当前资料站分别读取 2014 optionalfeatures、2024 feats 与战士职业声明，在仓库外验证。两个版本的选择声明分别是 optionalfeature 引用与 FS 专长筛选；选择保存、来源归属和撤回路径本身存在。缺口是来源只有带穿甲条件的正文，并无已有引擎执行的数值 effects 字段。旧引擎因此保存选择而未产生 AC 加值。

新增纯规则适配器 `src/core/automation/featureArmor.ts`：

- 按完整、有限的中英机制句式识别“着装护甲期间获得固定 AC 加值”，不按职业名、专长名或译名选择行为。
- 只读取已生效来源自己的正文；跳过未选择 options、引用节点，以及已经实体化为子特性的父段落。
- 只有一件实际装备且数量大于零的轻/中/重甲满足穿甲条件。单独持盾、卸甲、空库存或互斥穿甲冲突不满足。
- 规则保留 selectionId、entryId、来源、版本、revision 和正文路径；相同来源与重复机制句不叠加，显式 AC effects 不重复解读。
- 关闭来源、关闭对应专长、删除父来源、换选/清空、关闭自动化都遵守现有生命周期。保存/刷新只重算，不重发资源。
- 附带未知条件的 AC 正文不猜测执行，并在自动化护甲区显示未完整适配提示。本次不表示其他战斗风格或整库自动化已完成。

## 属性点击延迟的实际机制

旧组件在 click 时才打开追溯框，浏览器已可先聚焦显示总值的原输入框。总值到基础值切换走状态更新，追溯输入的 focus/select 走被动 effect，且整个框有 200ms 的透明度与裁切入场效果。它们共同允许先看到总值被选中，再看到基础值和追溯框。

修复在主键 pointerdown 阶段接管并阻止原输入的默认聚焦，立即提交追溯框；追溯字段在 layout effect 中聚焦/全选，去掉隐藏追溯输入的入场动画。键盘聚焦先将编辑值切为基础值，再在绘制前进入追溯字段。数字显示同步也改为 layout 阶段。

不同字段的追溯框有独立实例，避免快速切换沿用旧草稿。Tab 从原输入位置继续移动；失焦、关闭与 Enter 的重复提交共用幂等保护。取消和只读不写回，总值仍只用于展示。

## 本次已执行

- 定向单元：64 通过 / 1 条既有外部资料条件跳过，6 个文件。
- 新 `featureArmor.test.ts`：18 通过，其中实际 2014/2024 战士 + 防御声明的外部快照用例已设置路径并执行。上游 JSON 仅保存在 `/tmp`，未纳入仓库。
- Web TypeScript：通过。
- Playwright 静态发现：6 条新场景，包含两个版本真实 UI 的虚线选择/换选/撤销/保存刷新/持盾条件，以及首个 pointerdown 同事件快照、四个帧快照、键盘 Tab、快速切换、启用编辑环境下只读字段仍可查阅、写入次数。

运行命令：

```sh
DND_ARMOR_FEATS=/path/to/feats.json DND_ARMOR_OPTIONALFEATURES=/path/to/optionalfeatures.json DND_ARMOR_FIGHTER=/path/to/class-fighter.json npm test -- --run tests/featureArmor.test.ts tests/automation209-equipment.test.ts tests/automation-choices-resources.test.ts tests/choiceProjection233.test.ts tests/numberInput234.test.ts tests/armorAdjustments.test.ts
npx tsc --noEmit
npx playwright test --config playwright.feature-armor.config.ts
```

## 明确未验收

本机 Chromium 普通启动和获准的提权重试都在测试页面运行前失败，`socket() failed: Operation not permitted`。未绕过沙箱。新浏览器测试仅完成发现与类型检查，不能称浏览器通过、首帧截图通过或用户视觉体验已验收。已有静态/单元结果不能替代这些检查。

浏览器配置可使用 `PLAYWRIGHT_EXECUTABLE_PATH` 指向执行环境中已安装的 Chromium；默认使用 Playwright 所带浏览器。执行成功时首帧用例会保存 first-frame-evidence JSON 与首个 pointerdown 截图。真实枭熊多人房间、玩家原设备、实体手机和线上发布均未验证。

## 首轮远端 CI 与测试交互修订

[GitHub run 37099173157](https://github.com/FullPeople/DND-card-web/actions/runs/37099173157) 实际检验提交 `2a1004c4ac19b97205b8eb25b2edbfb028962399`：护甲调整/恢复 5 条通过，首帧/键盘/快切/只读追溯 4 条通过。首次 pointerdown 的实测截图已输出。下方两条 Defense 浏览器失败不计为通过。

已检查 [armor artifact 11265582590](https://github.com/FullPeople/DND-card-web/actions/runs/37099173157/artifacts/11265582590) 的截图、页面快照与 trace；没有页面脚本异常，两条测试均在首次选择之前被测试操作错误阻断：

1. 2014 卡导入当前 2024 工作区时，产品正确停在“导入前核对”；原测试直接等待导入后的角色标签，漏点“保留全部记录并导入”。现在明确断言跨版本保留提示，确认导入并读取持久化版本。
2. 2024 卡已正确展开虚线选择，两个候选都在右侧 Wiki。原测试错误寻找左侧内嵌选项按钮；真实目录来源使用 Wiki 拖入/替换格。现在两版都沿现有真实拖拽 helper 完成候选选择，断言格已填、选择已保存，再继续原有全部 AC、撤销/重做、刷新、护甲/盾牌与换选检查。额外核对来源版次和已消耗资源未恢复。

本次只修订测试流程，没有改产品行为或放宽数值断言。修订后本机类型检查、6 条浏览器发现通过；针对性单元 38 通过 / 2 外部资料条件跳过。修订后的 Defense 两条仍须新提交的远端浏览器实际复验，不能由测试修改直接宣布通过。

## 首轮 CI 暴露的原字段重新聚焦写回问题

同一提交的 automation 组为 25 通过 / 1 失败。已读取 [automation artifact 11265343194](https://github.com/FullPeople/DND-card-web/actions/runs/37099173157/artifacts/11265343194) 的实际截图与 trace：武器属性覆盖场景在填写感知 20 后，追溯框仍显示 20，但角色基础值和攻击仍为 16 / +8。原测试将填写和 Enter 都指向原字段，这触发重新聚焦被追溯框覆盖的基础输入。

代码复核发现真实的编辑归属缺口：追溯草稿失焦提交后，原输入仍可能将旧基础值再次失焦写回；同一追溯框被再次请求时也没有重新接管焦点。现在原输入在把焦点交给追溯编辑器后不再执行自己的失焦提交；同一锚点重新聚焦会回到原追溯实例，保留草稿而非重建。

`automation209.spec.ts` 的原填写/Enter 流程、攻击 +10、伤害 1d6+9、另一武器和手填攻击、保存刷新及文件往返断言全部保持。新增独立浏览器回归覆盖原字段 fill + Enter，以及有草稿时再次 focus 原字段，断言最终基础值、显示总值和仅一次写入。类型检查和 7 条浏览器发现通过；数字输入、武器、装备、护甲来源 4 文件单元共 48 通过 / 1 外部资料条件跳过。新浏览器用例及旧失败需下一次远端实际运行，不由本次修补即称通过。
