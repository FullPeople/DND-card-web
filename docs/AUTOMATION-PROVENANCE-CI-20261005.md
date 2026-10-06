# 配对产物验证补修，独立分支，未合并或部署

本轮以远端配对头为准：Web 草稿 PR #3 为 `c99b0a879c13c9dae9ce1501afeee07130c99ea2`，基于进度分支 `1a201caaf05d3787c14352b6094231c9022bb827`；Data 草稿 PR #1 为 `52ddf4267ef8168f3904a418d1542dc63d9996e9`。两者未合并，main 未更新。本轮新建 `codex/automation-progress-provenance-ci-20261005` 和 Data `codex/progress-export-ci-20261005`，不改写原配对分支，也不从 main 重做界面或导出。

## 验证的具体范围

原导入器只验证本地状态合同、完整 SHA 格式和产物散列。本次补上实际 Git blob 比较：固定 Data 仓库和导出提交，确认提交存在、路径为普通 JSON 文件、大小和全部字节与 Web 副本一致。使用 `--no-replace-objects`，本地检查禁用隐式懒加载；工作区换行转换或后续 HEAD 移动不能替代锁定提交。默认联网检查仅取得固定提交及该公开 blob；不会下载原始 `25ccc37` 审阅链、规则原文或私有材料。

导入必须先完成该核验，之后才写生成副本和版本锁；失败保留原文件。新增检查命令在网络不可用时以非零状态明确报告缺验证，不回退到 HEAD、旧收据或散列自证。再次检查先清除旧成功回执；失败回执标记 `verified: false`。

```sh
# 重新读取 GitHub 的固定导出提交，验证当前 Web 副本（无导入、无数据写入）。
npm run verify:automation-source

# 离线复核已有 Data 克隆中的固定提交，明确只证明本地 Git 对象。
npm run verify:automation-source -- --data-repository /path/to/data-checkout

# 未来确有新产物时导入；默认联网验证，或显式提供已有 Data 克隆。
node tools/importAutomationRuleStatus.mjs --input /path/to/new-export.json \
  --revision <真实Data导出提交完整SHA> --branch <对应导出分支> \
  --data-repository /path/to/data-checkout
```

普通 npm 测试和构建继续离线可运行。`Verify automation progress` 和 `Verify web` 的构建前增加固定仓库、固定 SHA 的 sparse checkout，仅检出 `reports/progress/automation-rule-status.json`，随后比较提交 blob；任一步失败不会给出通过。回执存于忽略目录 `.local-evidence/automation-progress/source-provenance.json` 并随现有 CI 证据上传。原本地导出字节没有重新复制，版本锁仍绑定 `52ddf42`，并未改成只修 CI 的后续提交。

这不是原始审阅链重放或规则资格升级。远端不能取得来源 `25ccc37e1584745a45f515c67d112d790db90ce9`；公开产物中 161 批次和 41 条历史关联保持原本地来源范围，原始 IR、覆盖层和私有回执在本环境没有重放。回执显式写 `scope: export-commit-blob-only`、`originalReviewChain: not-replayed`，本地克隆核验与新远端获取也分别标记。

18,789 条 / 4,561 已核对 / 162 原本地完整标记仍从同一公开产物重算。162 不等于当前整条实现验证；当前整条证明仍为 0，当前发布整条可用待核实。UI、执行模块、默认设置、手工记录、角色存储和资源余额未修改；机制原创验证与历史逐条标记、发布可用继续分开。

## 验证与限制

新增 8 项原创反例覆盖：固定提交成功、旧来源缺失不冒充重放、工作区 CRLF / HEAD 移动、重算散列后的伪造字节、不存在提交、无关仓库、伪造散列 / 文件模式，以及导入核验失败和断网不写入两个目标。关联验证 255 通过 / 20 条件跳过，23 文件有机制证据、19 文件无跳过；完整 Vitest 959 通过 / 26 条件跳过，类型与生产 / 单机构建通过；双模式启动边界通过。生产公告 / 进度 Chromium 11 项通过，0 跳过、失败或重试；390px 手机视口截图已检查，筛选、反复打开不重复加载、IndexedDB 角色 / 手工 / 资源记录保全及版本降级断言通过。最终精确 SHA 复测、远端 CI 状态以对应 followup PR / 回执为准。

当前汇总清单 45,814 字节（gzip 10,263），增量 JS 15,888 字节（gzip 5,793）；只包含公开平台合同和进度 UI。清单小于 48KiB、延后加载，新增规则模块为 0；10.7MB 逐条文件和新增 Git 工具没有进入浏览器。原有构建的大 chunk 警告保留，本轮不宣称解决性能问题。没有单独 lint 脚本；未运行的检查不能算通过。实体手机、真实玩家卡、枭熊房间和线上部署均未验收。

## 回滚

仅撤销本次补修：从包含本次提交的最新对应分支新建回滚分支，使用 followup PR 的完整 SHA 执行 `git revert <fix: verify pinned automation source blobs 的完整SHA>`。这样保留 PR #3 的界面与导入及其他后续修改；不 reset、强推或写角色数据。完整撤销配对导入另行 revert `c99b0a879c13c9dae9ce1501afeee07130c99ea2`，此前进度实现仍保留。Data 本次 CI 与原导出有独立 revert 记录。
