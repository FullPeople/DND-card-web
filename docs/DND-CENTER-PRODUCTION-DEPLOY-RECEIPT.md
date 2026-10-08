# 2026-10-08 正式部署接入交付回执

安装与实际封包验证的实现提交：`f8046e7b0244a1b21ae15b4d2d5ae710c6144e6d`，分支 `codex/dnd-center-production-deploy-20261008`，基于当时最新 main `a634ab766044a53ae997ce0b2f9cabb18486e73b`。此后仅补交付文档，不改安装器或运行代码。

- 工作流：[dot-deploy-production.yml](https://github.com/FullPeople/DND-card-web/blob/f8046e7b0244a1b21ae15b4d2d5ae710c6144e6d/.github/workflows/dot-deploy-production.yml)。
- 管理员步骤、参数与完整新增配置清单：[部署接入说明](DND-CENTER-PRODUCTION-DEPLOY.md)。管理员 `INSTALL_SHA` 填入上面的实现提交。
- 云端认证**真实首次 dispatch 成功**：[GitHub 合约运行 37780818927](https://github.com/FullPeople/DND-card-web/actions/runs/37780818927)，event `workflow_dispatch`，head SHA 精确为上述实现提交，conclusion `success`。身份/上传/安装/发布合约和真实 Linux 原子发布器步骤均通过。

认证结论：实际写入含工作流文件的分支成功，实际 `workflow_dispatch` 成功，并能读取运行和 jobs。现有云端认证具备本仓库所需的 Contents/Workflows 写权限及 Actions 写/读权限，本次没有发现需要补充的触发权限。未读取或修改 Environment Secret 的值，未调用人工审批 API。

新正式工作流尚未合并到默认 main，GitHub 的 workflow 查询返回 404，属于**尚未注册**，不能据此认定缺少 Actions 权限。合并后才能首次从 main 触发正式流程；合约工作流已存在于默认分支，所以可先用同一认证在候选分支上 dispatch 验证权限。

## 实际验证

- 本地 Python 合约：36 项通过，含旧 Web/Suite 身份拒绝、不可变 OIDC 身份、同提交完整 CI、恶意归档、截断上传、旧预检兼容、Unicode 头像文件、真实 Linux 发布/失败恢复、数据库/其他站点/旧资源保留及管理员安装失败恢复。
- 既有发布器：frontend 10、publish 8、upgrade 3 项通过。
- 完整 `npm run build:cloud` 通过；actionlint v1.7.9 校验两个工作流通过；安装 shell 语法及 Git 空白检查通过。
- 真实构建封包 150 个前端文件，压缩 17,534,132 字节，展开 20,052,349 字节，只含 card/library；散列 `83797463eca3ab3c7714c64fbf9ee5583f81ed1ef291f530570534a5c9223a30`。
- 真实 `git archive` 的完整源码 ZIP 已与 GitHub 上实现提交的全部 Git blobs 逐项核对通过，不只是比对 release.json 或 ZIP 注释。
- 初次真实封包拒绝了既有中文赞助者头像文件名；已加入安全 Unicode 名称支持及对应回归，再封包通过。路径穿越、链接和范围外文件仍被拒绝。

## 尚需现场完成

1. 审查并合并正式工作流到 main，取得该 main 精确 SHA 的 Web、Cloud、部署合约三组完整成功 CI。
2. 管理员使用冻结实现提交执行安装预检及 `--apply`；云端环境未配置 VPN/TCP，本次没有直接 SSH 安装。
3. 从 main 运行正式流程的 `operation=preflight`，在 GitHub 网页批准 `production-card`，取得真实服务器产物预检回执。
4. 使用仍有效的线上基线以 `operation=publish` 运行并再次人工批准，取得真实发布回执。

本次完成代码和部署接入交付，不代表服务器已安装新入口或新网站已上线。原 production-card 审批、现有密钥/公钥、固定 host key 和线上版本没有被工具修改。
