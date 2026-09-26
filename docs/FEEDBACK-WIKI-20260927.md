# 2026-09-27：法术、Wiki 与自定义条目反馈

本轮只在 `F:/CodexWork/2026-09-27/feedback/web` 的发布基线隔离区修改。没有发布、推送或改动 Godot / 原生参考程序。

## 重复反馈与本轮根因

| 用户反馈 | 核实与本轮处理 |
| --- | --- |
| 主要页预备法术更新不及时 | 194 已有按 `spellState` 与预备 ID 即时投影及远端 revision 覆盖。本轮保留该实现，并用新的编辑权限流程回归预备后立即切主要页。未把历史修复重新列为本轮根因。 |
| 普通模式点击法术不应改预备 | `SpellsPage` 的左键、拖拽、右键预备未检查编辑模式；现统一门控，普通左键查阅。`FeaturePanel` 的中键路线由审卡分任务补同样门控。 |
| 天生、固定、次数法术 | 新增「固定 / 次数法术」栏。编辑模式在法术右键菜单设置，固定法术不占预备位；次数法术可调整总次数、剩余次数、恢复说明并手动使用/恢复。类型设置在 `spellSettings.special`，已用次数在 `runtime.resources`，刷新不会重新发放。移除条目同时清理设置与资源。 |
| 简易 / 军用武器词条 | 新增项目整理的四个独立身份（两类 × 2014/2024），进入武器词条并复用武器训练拖拽路径。没有按职业名分支。 |
| Wiki 状态仍有三项被后置 | `compareEntries` 曾在来源排序前对 `_category=status` 强制降序；取消该特殊排序，使用现有书籍优先级与名称排序。 |
| 拼音搜索与结果定位 | 全局和分类共用 `matchesEntrySearch`，支持中文、英文、全拼、首字母、带音调或空格的拼音片段。GlobalSearch 的 `Reference` 默认点击提交会提前 return，现显式执行导航；CatalogList 给虚拟列表传入选中行位置。App 由主任务清除目标类别的旧搜索/筛选和版本限制。 |
| 2024 职业初始装备、熟练项缺失 | `readableEntries` 没处理 `startingProficiencies`，装备只读数组/default；增加来源声明的起始熟练与选择说明，并支持 `startingEquipment.entries/defaultData`。只展示资料，不自动填写技能或发放装备。 |
| 自定义每类字段、JSON、提示词 | 两个创作入口共用结构字段。物品重量/价格、职业生命骰/豁免、法术环阶/学派/时间/范围/成分/持续时间、武器类别/伤害、护甲类型/AC、种族体型/速度、子职父职业/来源、语言类别/文字执行校验。通用背景/特性/状态/规则保留正文与结构化内容。增加完整 JSON 载入、Wiki JSON 复制及两入口可复制创作提示词。修复编辑嵌套正文变成 JSON 字符串，以及军用/远程武器被默认字段覆盖。旧人物快照不因新增创作必填项无法打开。 |
| Wiki 初次加载卡顿 | 原目录归一化、继承/模板展开和具体魔法物品生成在 UI 线程执行；本轮移入可复用 Worker，四路下载共用一个归一化队列，完成/中止时销毁。不可用时保留让步回退。仍使用既有 IndexedDB 原始资料缓存与增量目录发布。没有承诺首次联网零等待。 |
| 导出再导入丢失联动 | 主任务增加独立联动导出方法，本分任务在 `importOwlbear` 加入严格验证原生 `dnd_card_web` 优先分支；损坏的原生内容不会静默降级成自定义。 |

## 验证

- `tsc -b --pretty false`：通过。
- `tests/customEntries.test.ts`、`tests/fixes194.test.ts`、`tests/characterDetails.test.ts`：16 项通过。
- `tests/spellWikiFeedback.test.ts`：6 项通过，覆盖拼音、状态来源排序、武器词条身份、职业结构正文、全部创作模板校验与嵌套内容往返、次数资源刷新/导入/修改上限/删除清理。
- `vite build --outDir dist-feedback-wiki`：生产构建通过，生成独立 `catalog.worker` 文件。
- `FEEDBACK_WIKI_PRODUCTION=1` 下 `playwright.feedback-wiki.config.ts`：4 项 Edge 浏览器检查通过（15.8 秒）。使用真实产品组件及本地原创资料夹具，覆盖普通模式不修改预备、编辑预备后主要页立即更新、次数消耗刷新保持、搜索定位虚拟列表、职业正文、自定义 JSON 保存后再打开、6000 条目录冷/热加载及 Worker 生命周期。

6000 条原创法术夹具的本机生产版本量测如下。时间包括测试中的点击与断言，不是网络下载 SLA；没有无修改基线对照，不能声称固定倍数提升。

| 量测 | 首次进入 | 同 origin 缓存刷新 |
| --- | --- | --- |
| 页面相对开始时间 | 1758 ms | 1140 ms |
| 最大动画帧间隔 | 217 ms | 67 ms |
| 主线程 longtask | 1 次，220 ms | 1 次，67 ms |

两次加载共创建 2 个 Worker，完成后 2 个均已关闭。目录为 6000 行，实际 DOM 行数小于 80。冷启动仍存在 220 ms 长任务，不能称为完全无卡顿；真实上游全库、低性能设备和真实枭熊房间尚未量测。

本地结果：

- `test-results-feedback-wiki/spellWikiFeedback-ordinary-8ea99-d-limited-resources-persist/fixed-and-limited-spells.png`
- `test-results-feedback-wiki/spellWikiFeedback-pinyin-s-a76a1-in-structured-starting-data/wiki-starting-data.png`
- `test-results-feedback-wiki/spellWikiFeedback-custom-J-a884d-remains-editable-after-save/custom-structured-entry.png`
- `test-results-feedback-wiki/**/first-load-local-metrics.json`

## 验收边界

没有执行本轮所有历史浏览器套件、真实多人房间、跨设备同步或真实全量 Wiki 性能验收。旧法术浏览器用例中「普通模式点击预备」与本次用户要求冲突，完整发布验证时须将其前置条件改为编辑模式；不能按旧断言恢复普通模式改预备。次数法术恢复按钮为手动操作；恢复方式字段是明确说明，不凭职业/特性名称自动推断，不提供未实现的自动休息流程。没有发布新增 Buff 包。

依赖：固定版本 `pinyin-pro@3.29.4`，使用官方项目文档中的 `pinyin(..., { toneType: 'none', type: 'array' })` API：[官方仓库](https://github.com/zh-lx/pinyin-pro)。
