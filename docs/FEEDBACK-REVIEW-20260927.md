# 2026-09-27：审卡、怪物编辑、交互与旧插件阅读器

本轮在 `F:/CodexWork/2026-09-27/feedback/web` 隔离源码中实施，基于已发布 195 候选提交；未提交、推送或部署。主目录历史混合改动未重置。此记录只覆盖本轮负责的子项，不能替代总反馈清单。

## 已确认的原因与改动

- **DM 审卡**：已有 `exportReview` 离线 HTML，但站内没有便于核对的独立视图。新增 `core/characterReview.ts` 纯只读汇总和 `ui/CharacterReview.tsx`，按概况风险、属性熟练、法术资源、装备负重、条目来源、裁定依据分组。记录等级与生效等级分别显示；禁用来源及受限祖先条目不会被当作有效条目；手动调整、来源修订和旧格式未关联项可见。保留手动填卡约定，不自动判定配额或复杂前提是否合法。
- **怪物编辑过于抽象**：原 `MonsterEditor` 直接递归列出 JSON 字段。改为基础资料、属性防御、特质动作、施法及高级 JSON；动作有名称、正文、排序、移除。`core/monsterEditing.ts` 修改普通 AC/HP/速度时保留条件护甲、速度条件、骰子公式和未知字段；切换出 JSON 或保存前校验，失败不调用保存。
- **生命值算式**：原 `NumberInput` 强制数字类型，`StatInput` 本地预览只识别简单正负整数。新增有限语法 `core/numericExpression.ts`，支持数字、括号、加减乘除，不执行代码。`-5` 表示减 5，`=20` 表示设置为 20；支持显式绝对负数 `=-5`，最终字段仍受原有范围约束。生命整数向下取整。枭熊 `saveVital` 在队列执行时基于最新权威值求值，再传原有整数相对增量或绝对数值，保留期望值/冲突校验和撤销协议。
- **Wiki 右键操作**：原 `EntryMenuProvider` 只在枭熊显示分享菜单，`Reference` 仅限少量卡面类名，资料标题和目录缺入口。现在目录、正文标题和真实引用共用查看/加入菜单，枭熊附全员展示；加入沿用来源、重复条目及编辑模式限制。扩展分享白名单，使怪物动作、抗性、物品、职业等资料不因字段裁剪而缺失。来源在菜单中为独立副行。骰子日志展示排版由 Suite 子项处理。
- **普通模式拖拽样式与权限**：身份和特性 CSS 无条件使用 grab；FeaturePanel 的 Delete、Alt 排序与中键预备未同指针路径一起校验编辑模式。增加 `data-drag-enabled` 和统一普通光标；键盘删除、排序、中键预备跟随编辑模式。状态和物品既有普通模式操作保持可用。
- **旧插件角色卡**：新增 `ui/PlayerViewer.tsx`，入口 `?legacyViewer=1&data_url=<JSON URL>`；`main.tsx` 条件动态导入，不运行 App/Wiki。复用原 A4、五页及状态外观，读取原生、完整备份、含 `dnd_card_web` 的旧格式和纯 0.3 JSON。可查阅卡内快照及本地折叠，输入只读，不写源文件、不缓存私人卡。拒绝 XLS/XLSX 入口并提供网站制卡链接。`platform/legacyPlayerBridge.ts` 提供 `normalizeLegacyUpload`，由 Suite 旧面板打包调用，将原生文件转换为服务器支持的旧投影并保留完整原生身份。

## 定向验证

以下均为本地定向验证，不是完整发布套件或真实多人验收：

- `node node_modules/typescript/bin/tsc -b --pretty false`：通过。
- `node node_modules/vitest/vitest.mjs run tests/feedback-stats.test.ts tests/feedback-review.test.ts`：9 项通过，覆盖安全算式/错误输入、连续队列权威基值、相对与绝对协议、审卡来源关闭/恢复、无副作用、怪物结构保留与坏 JSON 拒绝、旧上传桥身份往返。
- `node node_modules/@playwright/test/cli.js test --config playwright.feedback-review.config.ts`：4 项通过，13.9 秒。覆盖审卡分组和受限信息；怪物表单真实输入与拒绝坏 JSON；HP 算式、刷新持久化、Wiki 菜单权限和普通光标；旧阅读器五页、只读输入、零 Wiki 请求和 XLSX 拒绝。
- 审卡和怪物用例挂载真实组件，保存边界为测试接收器；HP/Wiki 和旧阅读器经过实际网页入口。首次组件夹具因 Vite React 前导及 CJS 导出格式加载失败，修正夹具后通过；此失败不是产品已通过的证据。
- 三张截图已目视检查，位于 `test-results-feedback-review/` 的 `dm-review.png`、`monster-form.png`、`legacy-reader.png`（各测试子目录）。截图与自制测试角色不作为上游资料公开。
- Suite 生产嵌套测试发现构建专属问题：条件写在同一个 `lazy` 回调内，使 Vite 将 Viewer 与 App 的动态导入错误合并为仅 App 的 CSS 预载；Viewer 专属样式未请求，980 px 以下卡面被通用移动布局隐藏。改为两个独立 `lazy` 回调后，生产包分别预载各自 CSS；884 px 阅读器断言显示尺寸及全部五页通过，重新打包了 Suite 的 `dist-feedback/card-viewer` 与上传桥。此问题不能由开发模式测试代替生产模式验收。

## 验收边界

- 旧阅读器本轮明确只读；没有借阅读器写回 HP、资源或预备状态。旧宿主其他运行值入口是否需合并后续由真实使用验收决定。
- 本轮没有真实用户房间、多设备、旧插件服务器上传与再次打开的完整联调，也没有公开站点发布。
- DM 审卡是资料组织与透明核对工具，不宣称复杂 D&D 规则、前提、职业选择配额已经全面自动审定。
- Wiki 菜单的可见权限不代替宿主鉴权；展示和加入仍走既有宿主/规则边界。
