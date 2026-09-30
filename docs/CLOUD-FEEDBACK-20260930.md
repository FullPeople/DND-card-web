# 2026-09-30 云端修复分支审阅

本次交付基于 `87c3a5677cbe5a5dc2ef80c9e6a21ca012c0f66f`，目标分支为 `fix/cloud-feedback-20260930`。四批实现供本地隔离验收；未合并 main，未部署玩家站点，未修改本机手机 A4 原型。`STATUS.md` 中各批“未提交”说明是当时检查点状态，最终交付提交以此分支的 Git 记录为准。

## 已完成范围

| 批次 | 实现与验收边界 |
| --- | --- |
| 1 | 计算时识别拖入盾牌/军用武器熟练项的 `itemProperty` 引用；主动删除或清零背景赠品后不再同步补回，临时库存快照缺项不算删除；修复双列自定义编辑/新建按钮遮挡。保留原引用、撤销重做和刷新持久化。 |
| 2 | 拖拽拒绝明确说明落点、版本/来源、重复、权限与当前同步状态；已有明确引用的赠送戏法路径独立于普通职业容量；增加有限、按来源登记的手动赠送数量与普通容量调整，默认不放宽限制。自动 `choose/filter` 规则映射未完成，人工设置不等于自动识别。 |
| 3 | 每个武器实例保存可选 `weaponAbility`。缺字段沿用力量/敏捷/灵巧自动选择；自选只替换现有属性调整项，攻击与伤害沿用原共用语义，不改变额外加值、熟练、骰子、完整手写公式或资源。覆盖清除、重算、重复实例、刷新和导入导出。 |
| 4 | 默认中文的持久化 UI 语言基础，App/阅读器顶栏、五页页签、阅读器关键状态、DND 公告与卡内靠上反馈区。英文资料标题只复用 `Entry.english` 并回退原名；语言切换不改角色、Tuple、快照或自动化结果。反馈链接为 `https://github.com/FullPeople/obr-suite/issues`；沿用分版本公告确认。 |

基础英文覆盖不包括五页内部多数标签、Wiki 分类/筛选/规则正文、资源与自动化面板、导入管理弹窗、部分诊断及启动兜底。历史公告保留中文原文。Suite 宿主外层旧/新版公告、宿主“观看公告”及外部设置/音乐/三龙牌面板需要正确的 Suite 源码，本分支没有覆盖。

## 已执行验证

| 检查点 | 单元测试 | 类型/常规/独立站构建 | 当批不同浏览器用例 |
| --- | --- | --- | --- |
| 1 | 247 通过，5 跳过 | 全部通过 | 35 通过，2 跳过 |
| 2 | 254 通过，5 跳过 | 全部通过 | 40 通过，0 跳过 |
| 3 | 259 通过，5 跳过 | 全部通过 | 10 通过，0 跳过 |
| 4，最终实现 | 262 通过，5 既有外部资料跳过 | 全部通过 | 37 通过，0 失败/跳过 |

历史浏览器组有重叠，不能相加作为全套覆盖。最终 37 项包括独立站/原中文公告/语言/自动化 20 项和集成配置反馈/装备 17 项，覆盖前三批相关回归、语言切换与刷新、完整工作区/公式不变、1512px 与 390px 按钮可见、阅读器请求次数/只读值、反馈 URL 及独立公告确认键。首次第四批开发回归的两条失败是测试误点折叠标题及在单机构建中检查 Suite 通道，测试场景修正后通过，没有据此改变产品语义。

最后执行了 `npm run check`、`npm run build:standalone` 及上述有界浏览器组。交付前复核了前三批 7 个检查点哈希、源码/测试未在最终验证后继续修改、补丁重放及 `git diff --check`，仅补交付文档并移除新增测试末尾空白行，未改测试逻辑。常规构建保留既有大块提示。

实际云端为 Node 24.19.0、npm 11.9.0、Debian 13、Playwright 1.63.0、预装 Chromium 151.0.7922.173，单 worker；期望官方环境为 Node 22.12+ 与 Playwright 配套 Chromium 153.0.8010.12（revision 1243）。云端使用仓库外的可执行路径适配，未提交 Linux 临时配置，也未声称与精确 CI 环境一致。官方浏览器下载此前在 `cdn.playwright.dev` 被 403 拦截，没有绕过。

## 本地复核与预览

先读 `AGENTS.md`、其引用的文档、`package.json` 和相关 Playwright 配置。使用 Node 22.12+ 与 `npm ci`。Windows 非 CI 配置通常选择已安装 Edge；若采用 CI 模式，使用官方安装的 Playwright Chromium，不照抄云端 `/usr/bin/chromium`。

可按本机浏览器情况执行以下仓库自带检查；浏览器组按实际选中的用例报告，不将其称为全套发布验收：

```text
npm run check
npm run build:standalone
npm run test:standalone -- --workers=1
npx playwright test --config playwright.feedback198.config.ts --workers=1
```

独立站自动化组使用仓库 `playwright.automation209.config.ts`，按配置要求设置 `DND_AUTOMATION_TEST_MODE=standalone`。第二批来源戏法可复核 `tests/sourceCantrips.test.ts`、`tests/spellWorkspace210.test.ts` 和相关浏览器组；已声明赠送、手动容量与尚未支持的自动选择映射需分别验收。

运行 `npm run dev:standalone` 开本地独立站，报告 Vite 实际输出的 URL（默认请求 5183 端口，冲突时以实际结果为准）。这可验收本地制卡、持久化和 UI；真实 Suite 宿主往返、房间权限、多人同步及外层公告须另用正确 Suite 版本验证。不要将独立站预览称为已验证真实 Owlbear 集成。

## 未完成或未验证

- 专长/种族自动 `choose/filter` 赠送映射：仍需受支持的明确规则数据；受限资料源此前 CONNECT 403，未换渠道或按名字/正文猜规则。
- 旧卡迁移：仍需真实旧存档和正确 Suite 宿主源码，不按中文名盲猜 Tuple 或版本。
- 真实 Suite 库存/武器覆盖字段往返、多人房间、实际 FUS/玩家设备及海外白屏根因：未验收。
- 完整发布浏览器套件、精确 Node 22/Chromium 153 环境：本次没有重跑。
- 反馈只有人工 GitHub Issues 入口，无已确认公开邮箱、自动监测或自动修复。

## 推送和证据

仓库唯一 `.github/workflows/web.yml` 的 push 仅监听 main；Pages 上传和 deploy 还要求 `github.ref == 'refs/heads/main'`。本修复分支的普通推送不会触发该工作流部署。没有改工作流、强推、合并或创建自动部署。

四批独立补丁、原始日志、失败截图与最终桌面/窄屏截图保留在执行器 `/workspace/cloud-validation/`，不把它当成本机共享路径或已交付 Library 附件。第四批补丁为 `dnd-feedback-fourth-batch.patch`，按前三批之后应用；详情为 `fourth-results.json` 和 `fourth-review-summary.txt`。Library 此前在 `chatgpt.com` CONNECT/tools-list 阶段 403，未取得上传 ID。公开仓库仅纳入实现、必要自制测试夹具和审阅文档，不纳入私人角色卡、上游正文快照、缓存、凭据或构建产物。
