# 旧插件 JSON 导出与熟练显示候选

从远端 main 79a84b5 的盾牌/赞助候选 c70d8cf 独立分出
`codex/legacy-viewer-json-training-20261006`，只追加查看器与显示层修复。
Draft PR 以盾牌分支为基线，合入顺序及精确最终 SHA/CI 以交付回执为准；未合并、未部署。

真实稳定插件为 FullPeople/obr-suite main `31a14a20df38d737b100cc838b6cf487488d835f`，
只读公网 manifest 为 1.3.14。角色列表加载 `card-viewer/index.html?legacyViewer=1`，
`cc-fullscreen.html` 也转到该查看器；历史 `fullscreen-page.tsx` 已不作为实际入口。
查看器由 Suite 的 `tools/build-legacy-card-viewer.mjs` 复制已审 Web 构建，需配套更新稳定产物。
只修改 Web 而不重建旧插件，线上旧包仍不会取得修复。

玩家在卡片顶部点击「导出 JSON」。下载本次成功读取的完整 JSON 字符串，不重新投影角色、
翻译 ID 或用局部视图重建交换数据；未知交换字段、手工记录、资源余额和格式/换行都保留。
使用现有 Blob 下载接口，没有额外 API 请求或持久化写入；刷新中/失败时旧卡与旧导出被清除。
本地特性展开状态不会进入导出。导出仅限当前查看器实际已读取的角色。

装备训练沿用盾牌类别修复，shield/Shields 可显示「盾牌」。工具仅复用现有七项已知工具词表，
如 Tinker's Tools→修补工具、Thieves' Tools→盗贼工具；不加载 Wiki 或全工具目录。
自定义标题、未知第三方工具、技能名误填工具和明确物品/法术类型保留其原始身份与文本。
此显示增量不修改角色数据或授予熟练，其他未收录工具仍可能保留英文，不宣称完整翻译。
当前产品语言沿用现有中文 UI 决策，此次没有改变语言偏好机制。

本机完整单元 990通过 /26条件跳过 /0失败（1016条），新增4条显示边界测试；
相关盾牌/显示28条执行通过。类型、production与standalone构建通过。
浏览器在实际稳定 `cc-fullscreen`→内嵌产物，以及同一产物的新插件 App 入口对照合成角色：
2014/2024显示、重复导出不重复读取、原文下载、手工标题/未知字段/资源、旧0.3桥接往返、
刷新失败清空及390×844截图，4通过 /0跳过 /0重试。
首次本地启动使用 Suite 的 HTTPS 开发配置导致预览等待失败；改用仅用于测试的HTTP构建预览。
随后对照步骤先误用 standalone桥接入口，再误找只读角色名输入框；真实入口/卡片标签/按钮修正后通过，
失败日志保留，没有改变产品流程迁就测试。冻结提交后需重新构建、复测及核对CI回执。

Suite另有独立 main 候选及固定 Web 源绑定。稳定 TS/build、公告9断言、背包事务与依赖加载回归通过。
其 main 的历史 `Verify Suite candidate` 引用 `tools/verify-suite-candidate.mjs`，该文件不在此 main 提交；
不能声称该历史总回归通过。新的配套检查只覆盖稳定构建和本次入口，真实Owlbear登录房间、原设备、
实体手机与全Suite多人模块尚未现场验收。

回滚本 Web 增量：`git revert --no-edit <本PR提交SHA>`；盾牌/赞助仍按各自记录独立回滚。
Suite配套绑定增量单独 `git revert --no-edit <Suite候选提交SHA>` 并重建原配对包。
不得用开发候选覆盖线上运行版本证据，生产部署/公网验收另行由正式发布流程完成。
本地诊断/截图/测试在 `.local-evidence/legacy-viewer/`，只含原创合成角色；不提交玩家文件或上游规则正文。
