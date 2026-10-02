# 230 后续 Web 修复 · 完整远端 CI 验收

本轮按父任务明确授权，在已有正规 GitHub CLI 能力上对 `FullPeople/DND-card-web` 的 `codex/web230-followup-20261001` **仅启动一次纯验证工作流**，没有创建 PR、修改 main、启动部署或操作玩家数据。没有读取、复制 token 或增加凭据。实际远端结果为 **success，verify 与全部 7 组浏览器 job 均通过**；这是 GitHub Runner 实跑，不是本地模拟 CI。

## 锁定输入与终态

- [GitHub Actions run 36934766948](https://github.com/FullPeople/DND-card-web/actions/runs/36934766948)，`workflow_dispatch`，attempt 1。
- 工作流 `.github/workflows/web.yml`，运行名称 `Verify web`；远端读取锁定版本确认只有 `verify` / `browsers`，权限 `contents: read`，无 deploy job。
- 实际运行 HEAD：`262a7017806f0ef555cd36805554e06adda146a8`；产品源码：`488ea1bee7e46b763f80d2bb331420ad5ea583c0`。262a701 只增加交接文档与联调证据。
- 创建 `2026-10-01T22:23:32Z`，终态 `2026-10-01T22:31:25Z`，`status=completed` / `conclusion=success`；8 个 job 全部终态 success。
- main 仍为 `4e398a39a5cb37e5e632ae377fdf2488cdc3924c`。本轮随后提交只保存此验收记录，不把文档提交 SHA 冒充该 run 的实际 SHA。
- GitHub Runner：Ubuntu 24.04.5 LTS、Node 22.23.3、npm 10.9.9。官方 Playwright 安装 Chrome for Testing / Headless Shell 153.0.8010.12（v1243）；followup 组另安装 Firefox 155.0（v1543）及官方系统依赖。

完整 API 终态、job/step、各命令计数和边界保存为 [结构化证据](evidence/ci230/run-36934766948.json)。仅汇总必要元数据，没有保存凭据、签名下载链接、用户图片或私有资料正文。

## 完整门禁结果

`verify` job `110612328838` 的 `npm ci`、`npm run check`、`npm run build:standalone` 与构建上传均成功。`check` 包含完整 Vitest 与 `tsc -b` / Vite 集成构建；单元 **486 通过 / 23 条件跳过 / 0 失败**，74 文件通过 / 1 条件跳过。国内 `/card` 所需 standalone 构建仍保留。项目没有独立 lint script，未虚报 lint。

7 组共执行 15 个浏览器命令，全部走到成功终态：

| 组 | job ID | 命令与结果（通过 / 跳过 / 失败） | 组汇总 |
| --- | --- | --- | --- |
| screen-release | 110612477002 | screen：9/0/0；release：59/0/0 | 68/0/0 |
| feedback-touch | 110612476885 | feedback198：17/0/0；compat207：8/0/0；touch：6/6/0 | 31/6/0 |
| startup-integration | 110612476881 | wiki-recovery：7/0/0；integration230：51/5/0 | 58/5/0 |
| resources-sources | 110612476976 | feedback217：53/0/0；source-feedback：21/0/0 | 74/0/0 |
| choices-standalone | 110612476806 | choices：13/5/0；standalone：18/0/0 | 31/5/0 |
| automation-unified | 110612476749 | automation209 standalone 模式：26/0/0；unified191：18/2/0 | 44/2/0 |
| followup-230 | 110612477028 | Chromium/Firefox 启动、Wiki、编辑与备份恢复：50/2/0；资源、选择、骰子、休息与迁移：42/0/0 | 92/2/0 |
| 全部浏览器命令 | 7 jobs / 15 commands | 418 次执行 | **398 通过 / 20 条件跳过 / 0 失败** |

这些是按各配置的**执行次数**，不是 398 个互不重复的场景；integration、choices 和 followup 存在重复覆盖。此前本地 92 个相关 Web 场景及 SDK 配对 15 项独立记录，不与此数字相加。远端本次没有产品失败、测试期望失败或依赖安装失败，故未新增源码修订、未重跑工作流、未扩大重构。

## 条件跳过与未验边界

20 次浏览器跳过逐条核对原测试的条件：

- 10 次为缺少未公开规则快照：5 个真实职业资料场景在 choices 与 integration 中重复执行。未上传私有规则，未称全职业自动化完成。
- 6 次为手机/桌面项目模式不适用：手机测试在 desktop 项目跳过、桌面测试在 phone 项目跳过；适用项目中的对应测试实际执行。
- 2 次为 Suite 联机场景不适用于 standalone 项目，integrated 对应项目实际执行；其联机场景仍是协议夹具，不能替代真实玩家权限。
- 2 次为 Firefox 不支持 Playwright 的 ServiceWorker 离线控制/路由注入；实际关停本地服务器后的缓存回开与继续保存用例已在 Chromium/Firefox 执行。

WebKit 仍未验：当前 executor 普通用户 UID 1000，未提供 sudo，缺官方系统运行库；本次远端工作流也没有 WebKit 项目。没有申请新的系统安装权限或改变网络/浏览器安全设置。真实登录 Suite 房间、多玩家权限、物理骰子、实体触屏与玩家生产线路仍未验。

用户原图消费仍失败，文件不存在；三列 44/24/32 改版未实施，已停止重试。本次 CI 不消除该素材阻塞，也不替代看图验收。Suite 代码 `3fc7c710019bd7ac705915d5b91e633aeeb4215f` 的实际 SDK 独立配对 15/15 已在 [配对报告](DICE-FOLLOWUP230-PAIRED.md) 保存，但该 Suite 配对没有纳入本 Web 工作流；正式发布时仍需统一 manifest 与公告版本。

## 证据读取与保存

触发前后及终态通过正规 `gh api` 核对 ref、run、job/step 和 artifact；`gh run watch --exit-status` 最终退出 0。中途 CLI run 日志提示运行未结束，直接 job 日志的外部存储转跳受访问限制；随后通过现有授权 GitHub 连接器读取已完成 job 日志成功。运行中的 followup 日志曾返回 BlobNotFound，等终态后正常读取。这些是证据读取时序/路径限制，未记成产品失败，没有复制凭据或绕过权限。

完整日志在本机忽略目录 `.local-evidence/ci230-remote/`：`watch.log`、`verify-connector.log`、7 份 `job-*.log`、`run-final.json`、`jobs-final.json`、`artifacts-final.json`。该目录路径不能当作其他 executor 已有文件；永久结构化摘要随 Git 提交保存。GitHub 构建 artifact `verified-web-builds` 已成功上传，ID `11198000296`、4,335,342 bytes，保留期 1 天；没有下载或发布此构建包。

最终需求、已修/实测/剩余与体验建议仍以 [总清单](FOLLOWUP-230-WEB-RESULT.md) 为入口；本页只补齐本批此前未执行的完整远端 CI。
