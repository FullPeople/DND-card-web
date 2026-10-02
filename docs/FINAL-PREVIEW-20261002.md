# GitHub 分支最终整合与本地预览 · 2026-10-02

用户要求合并 GitHub 当前各分支并提供本地预览。本轮从远端 main 建立隔离工作树，不使用历史混合脏主目录作为整合输入，不修改 Godot、原生参考应用、Suite 源码或线上站点。

工作区：`D:/Desktop/DND-card-web/.local-evidence/final-preview-20261002/web`；整合分支：`codex/final-preview-20261002`；本地生产构建预览：[5299](http://127.0.0.1:5299/)。服务仅监听本机。角色保存按该地址独立，其他端口和线上角色不会自动迁入。

## 分支输入与冲突处理

开始时 main 为 `4e398a39a5cb37e5e632ae377fdf2488cdc3924c`。以 merge 保留各分支历史；最后一次 fetch 还补入 followup 新增的用户批准布局参考图。

| 远端分支 | 输入提交 | 最终覆盖方式 |
| --- | --- | --- |
| main / codex/release230 | 4e398a3 | 整合基线 |
| codex/web230-followup-20261001 | fcc3bee | 合并后续修复及最新布局参考图 |
| codex/dice-notice219-20261001 | 2aaeb21 | 合并剩余历史记录，保留230公告与既有219归档 |
| codex/a4-wiki-recovery-229 | 8c58542 | 已在基线祖先中 |
| codex/feedback-september | 7243be5 | 已在基线祖先中 |
| codex/final-integration230 | db223af | 已在基线祖先中 |
| codex/release-216-receipt | 769a3aa | 已在基线祖先中 |
| codex/resource-dashboard222 | f6f9068 | 已在基线祖先中 |
| codex/selection-follow223 | 84d50cc | 已在基线祖先中 |
| codex/startup-226 | 6dee5fb | 已在基线祖先中 |
| fix/cloud-feedback-20260930 | 7f00bea | 已在基线祖先中 |

逐个 `git merge-base --is-ancestor` 确认全部12个远端引用均包含在最终HEAD中。没有删分支、强制推送或用旧分支覆盖新源码。

旧219公告分支在 `docs/AI_HANDOFF.md`、`docs/STATUS.md`、`src/platform/announcement.ts`、`src/platform/releaseNotes.ts` 发生冲突：保留最新交接和230公告；最新 releaseNotes 已有219完整归档。补齐 `RELEASE-219-CANDIDATE.md` 与 `RELEASE-219-RESULT.md`。最终运行源码、测试、构建配置和依赖与最新 followup 分支完全一致，仅额外保存历史回执及本次整合文档。

## 本轮实际验证

- 全套单元：486通过、23资料条件跳过；74测试文件通过、1文件条件跳过。
- TypeScript、集成生产构建、单机生产构建通过。单机构建审计 `singlePlayer=true`、`multiplayerModules=[]`。保留既有大于500kB分块警告，未把构建成功解释为所有线路速度保证。
- 实际 Edge 浏览器21个资源、骰子桥接宽窄布局、选择、一次性装备/休息生命周期和旧卡迁移场景通过；无跳过、失败或重试。
- 实际 Edge 浏览器26个编辑下载失败恢复、完整备份持久化、离线重开、启动拆分、默认A4、Wiki暂停/补读/缺失文件与缓存激活场景通过；无跳过、失败或重试。合计47场景，不叠加历史CI或重复用例数字。
- 本地生产预览无网络夹具：空缓存卡面815ms可见；当前启动资料173个真实请求均200，页面显示29,505条资料，脚本错误0。截图/五页检查总耗时约44秒。五页均保留210:297比例，并查看390px主动选择非A4的截图。此为本机当次测量，不是玩家线路或所有上游资料完整覆盖。
- 本轮截图和原始报告只留在忽略的 `.local-evidence/`；真实Wiki正文截图不提交公开仓库。证据包含 `unit.log`、两个构建日志、`ui-results/report.json`、`recovery-results/report.json`、`preview-verification.json`、`final-preview-a4.png`、五页截图及 `final-preview-mobile.png`。

## 范围与剩余边界

默认A4、可选非A4、五页切角、最新灰色资源模块、休息入口、自动化选择与保存恢复均沿用已实现代码。最新布局参考图已进入分支，但其约44/24/32的三列布局在原 followup 分支尚未实现，本次不把图片当作已完成产品。详细既有范围见 [后续修复清单](FOLLOWUP-230-WEB-RESULT.md)。

骰子浏览器检查验证Web桥接与生产显示组件的本地传输边界；本轮没有重新构建Suite宿主、验证真实登录枭熊房间、多人权限、物理投掷或实体手机。未来Suite集成应复核 [配对记录](DICE-FOLLOWUP230-PAIRED.md) 锁定的Suite `3fc7c710019bd7ac705915d5b91e633aeeb4215f`，不得将Web单机预览称为完整宿主验收。

## GitHub 与发布

用户本轮授权合并源码并预览，整合结果保存为统一分支并推进GitHub main。最新 `.github/workflows/web.yml` 仅有 verify/browsers，无Pages或其他部署job；源码推送仅触发质量检查。国内站、Suite线上版本、服务器服务和玩家数据不在此次操作范围。远端推送SHA和CI终态另以本轮收尾回执为准，不引用历史CI冒充本次结果。
