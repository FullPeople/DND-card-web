# 2026-10-05 自动化进度候选：独立分支，不合并、不部署

已实现公告区域的「自动化进度」标签、移动端固定入口、五类能力说明、来源书 / 资料类型 / 功能筛选、更新记录与构建自动生成的精简清单。页面分开显示核对、实现验证、当前发布加载可用；已有机制只承诺已证明部分，未开放或缺证据项只有状态。本轮不增加自动化执行功能，不修改角色数据或手工记录。

分支 `codex/automation-progress-20261005`；隔离工作树 `/workspace/automation-progress`。起始远端 main 为 `b0e61826849b54b9264d9254cbec4759e23f7640`，原 `/workspace/DND-card-web` 未 reset、clean、覆盖或切分支。推送前重新 fetch 核对，使用普通新增分支 push，不强推。当前提交及精确 CI 状态可从该分支的 Git 历史 / Actions 查询；不把本地通过写成远端通过。

## 取得与缺失的证据

已读取 `AGENTS.md`、`AI_HANDOFF.md`、`PROJECT_LESSONS.md`、`PRODUCT.md`、`ACCEPTANCE.md`、`STATUS.md`、`RULE-COVERAGE.md`、209覆盖与最新246发布记录，核对公告组件、自动化开关、运行 / 资源同步、构建与旧发布器。仓库没有 `.agents/skills`；共享 `/workspace/.agents` 为空，未找到需执行的本地技能。

实际只读 HTTPS 取得 `/card/release.json`：独立站 `standalone-1.0.246`，公告 `0.1.37`，Web 源码 `2bfc832916896e85aa22b4f36f3ba66a7bae6749`。Suite 另读 `manifest-dev.json` 为 `1.0.247-dev`，不混同独立站版本，也不调整任一已发布频道。

远端指定 `docs/AUTOMATION-IR-WRAPUP-4561-20261005.md` 缺失；没有逐条 IR / 当前全库规则状态文件。不能重新计算用户未推送的 18789 / 4561 / 162，也不能认定为线上证明。生成器实际读取既有来源登记的 184 个书目身份（183官方 / 1项目整理；第三方逐书状态缺失），以及 11 项机制说明：9项玩家机制有本轮原创单元证据，1项内部休息逻辑有测试但入口未开放，1项完整战斗 / 第三方复杂规则待实现或核实。这些不是规则条目统计。规则条目已核对、整条实现验证、当前发布整条可用均保留待核实。

## 变更与数据边界

- 唯一维护来源 `docs/data/automation-progress.json`；复用书名登记、规则协议及版本。可选精简逐条状态按来源+ID去重（重复拒绝），按分类聚合。详见 [维护及发布说明](AUTOMATION-PROGRESS.md)。
- Vite 自动生成 hashed JSON / 体积与依赖审计。构建不存在回执时显示待核实；代码 / 测试 / 输入改变即失效旧验证。玩家能力触发说明仅在该机制实际取得本次验证后展示。
- 运行模块固定 SHA / 指纹 / 模式 / 清单 SHA256；只接受同版本同频道的发布加载与逐项可用证明。缺字段、版本 / 来源 / 散列不匹配、未开放 ID 或未知协议不能成为当前可用。开发预览不能冒充发布。
- `prepareAutomationRelease.mjs` 只写新暂存 release 输出，不发布。检查干净精确提交、同一产物的浏览器 metadata 和功能回归；仅进度 UI 通过不能让所有机制自动获得当前可用资格。
- 只读组件不接收角色、edit 或存储接口，不读取规则正文或自动化库。48 KiB解压后读取上限、SHA256和schema检查，成功清单按URL+SHA缓存；发布身份按每次打开重新读取。
- 长短休资源入口继续未开放；转场演出不恢复HP / 生命骰 / 法术位 / 资源。不存在新执行按钮、授予接口或默认补齐规则。

## 本机验证及准确范围

在本轮源码上执行：

- 关联自动化及证据测试：236通过 / 20条件跳过，21文件通过。没有取得的上游资料条件跳过，不作全规则语义通过。
- 完整 Vitest：940通过 / 26条件跳过（117文件通过 / 1文件条件跳过）。
- `npm run check` 包含完整单元、TypeScript及集成构建；`build:standalone`和`checkStartupBoundary241.mjs`的两种实际构建 / 加载边界通过。仓库未提供独立lint脚本，不宣称已跑lint。
- Chromium生产浏览器公告 / 进度共11项通过：首次与重复公告、强制确认、记忆版本、手机正文滚动、标签切换与键盘、三维筛选、发布版本 / SHA / 清单不匹配降级、清单损坏、重复打开只有一次清单请求、未开放项无执行控件。对实际 IndexedDB 保存的原创手工说明、关闭自动化选择与已消耗资源逐字节前后比对保持一致；进度期间没有额外Wiki / 自动化编辑库请求。
- 桌面1440×960、移动390×760的实际截图；标签44px，正文无横向溢出，底部确认始终可用。实体手机、真实玩家私有卡 / DM私审、真实枭熊房间、完整战斗、全库语义和未来部署没有因此验收。

现有大块JS超过500kB的Vite提醒仍在；本轮没有把构建提醒当作实机性能或全库问题已解决。

体积以实际最终构建审计为准，当前测得 standalone 清单23346字节 / gzip约7.2KB，进度新增JS13396字节 / gzip约5.0KB。集成模式相同级别。与隔离的同一主线基线构建相比，首卡JS gzip无增长（样本225124→224979；集成282392→282274，属于打包差量，不宣称性能改善）。清单 / 进度模块均在首次点击后读取，新增模块只有展示组件与公共状态契约，没有额外规则模块。

## 首次失败与修正

最终只读审查指出并同批修正四项证据边界及CI接入：

- 验证指纹原只覆盖顶层测试，遗漏其导入夹具和依赖锁。现在保守覆盖完整源码、测试、工具、prototype及CI树，包含featureArmor/originFeatChoice夹具、传递辅助文件、新增动态夹具、package锁/脚本、根构建与测试配置和TypeScript配置；改变任一输入即使旧回执失效。签发前复查输入未在测试期间改变。
- 某书只有装备逐条状态时，筛选法术不再把空集合累计为0；无分类证据保留null / 待核实，明确存在的零计数才显示0。回归从真实生成器读取原创逐条状态fixture验证。
- 回执schema 2分别保存机制部分原创证据和无跳过完整文件证据。含任何跳过的文件不支持整条complete计数；机制说明不被当作整条语料验收。
- 缺少逐条发布回执结构，“当前发布整条可用”固定待核实，手填ruleAuditVerified=true无效；原机制级精确SHA / 指纹 / 清单 / 浏览器metadata门禁保留。
- 既有Verify web主线构建自动执行关联验证并随双构建保存回执，现有浏览器矩阵追加进度QA；性能候选构建也重新验证，独立PR路径覆盖夹具/依赖锁/配置。没有部署步骤，CI通过不会填入线上可用证明。

新增15项回归，精确最终SHA的本机 / 两个远端工作流实际结果随最终交付提供。诊断保留在忽略目录；曾尝试直接使用TypeScript编译器API追踪导入，但仓库TypeScript7只导出版本入口，已撤销该尝试，使用上述完整输入树保守覆盖，不新增依赖。

最初新增两个证据测试的临时Git目录指向错误，后续复制缺少新配置；修正为真实Git目录和完整必要文件。首次新增依赖门禁把已经加载的公告共享CSS依赖算作新增，细化为扣除首卡与原公告已加载依赖后检查；规则加载限制保留。一次清单损坏用例的页面拦截被现有Service Worker缓存路径绕过（正常清单被返回）；网络故障夹具显式阻止worker后原拒绝断言通过，未修改生产worker或降低断言。

首次远端CI[37315835490](https://github.com/FullPeople/DND-card-web/actions/runs/37315835490)单元/类型/双构建/边界成功，浏览器10通过/1失败：既有Wiki后台队列尚未结束时即开始请求计数，7个旧请求被错计为进度新增。修正测试为等待真实“条资料 / 缓存”完成状态及加载按钮可用后再划定测量起点，仍保留原先“无新增规则/编辑库请求”的空集合断言，不加固定睡眠、不改生产加载器。日志保留在 `remote-ci-first-failure.log`；首轮产物下载的GitHub跳转返回HTTP403，已停止该下载，不尝试绕过；本机报告/截图和授权CI日志完整保留。修正后的精确SHA重新跑本机及远端CI，以最终真实结果为准。

第一次损坏失败的原报告 / 日志保留在 `.local-evidence/automation-progress/browser-first-corruption-failure.{json,log}`，重新执行原用例及完整11项通过。早期新增测试定位和修正记录见同目录 `diagnostics.json`；最终报告、截图、单元JSON、构建输出、加载边界、公开版本只读快照、体积比较与最终提交核验都保留该忽略目录。CI工作流上传这批原创证据保留14天，不上传上游规则或玩家材料。

## 复现与回滚

```sh
git fetch origin
git switch -c review/automation-progress origin/codex/automation-progress-20261005
npm ci
npm run verify:automation-progress
npm run check
npm run build:standalone
node tools/checkStartupBoundary241.mjs
npx playwright install chromium
npx playwright test --config playwright.automation-progress.config.ts
```

系统Chromium可用时指定 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`。可选生产机制QA与发布证据生成见维护文档；本轮未运行全套未来发布机制QA，不因此标记当前发布可用。

本功能提交91b3201之后追加CI测量起点修正c75f5ea和审查证据边界修正；精确最终SHA随交付结果提供。可在含本批修改的最新远端创建回滚分支，保留并行维护成果：

```sh
git fetch origin
git switch -c rollback/automation-progress origin/codex/automation-progress-20261005
git log origin/main..origin/codex/automation-progress-20261005 --format='%H %s'
# 按最新在前的顺序，核实并撤销审查修正、测试起点修正和功能实现
git revert <最终审查修正SHA> c75f5ea8139022df41ea2bbbd8e76c0dd1790a88 91b32019022b0da2a6f903e4285fcf793d1a83c3
# 如存在后续同文件修改，逐项解决冲突，然后重跑上述验证；不reset、不强推。
```

若功能尚未合入main，无需在main做revert。未部署，因此没有服务器产物或玩家数据需要回滚。后续合并 / 部署需另按当时授权执行；本轮只推送独立分支，没有创建非draft PR。
