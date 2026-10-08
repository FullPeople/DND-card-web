# dnd.center 正式部署接入

新增工作流 `Deploy dnd.center frontends`：`.github/workflows/dot-deploy-production.yml`。只允许手动从 Web `main` 触发，构建输入的完整提交 SHA。输入 SHA、工作流 SHA、当前 main 头和三组完整 CI 的 SHA 必须完全相同。新文件合并到默认分支后，GitHub 才会注册首次 `workflow_dispatch`。

发布目标固定为 `/var/www/dnd-center/card` 和 `/var/www/dnd-center/library`，两个入口成对发布。网站首页、三龙牌、旧 `/var/www/obr-plugins/card`、后台、SQLite、Nginx 和其他站点不在上传范围。

## 操作与审批

- `preflight`：构建并上传候选，服务器验证并保留 root 管理的恢复封包；不会切换线上目录。**会写入服务器的候选封包目录**，与旧工作流的纯只读预检不同。
- `publish`：经过同样校验后备份两个目录，调用预先安装的固定发布器进行原子切换和就绪检查；失败时恢复本次已切换的目录。

两种操作的服务器 job 均使用现有 `production-card` Environment，由 FullPeople 在 GitHub 网页人工批准。实现没有批准审批、移除审批规则或绕过 Environment 的接口。构建 job 不持有部署密钥或 OIDC 写权限。

## 现有配置与新增配置清单

| 配置 | 要求 |
| --- | --- |
| Environment Secret `DEPLOY_SSH_KEY` | 沿用现有专用身份，不创建第二把密钥 |
| `DEPLOY_KNOWN_HOSTS` | 优先读取现有 Environment Variable；也兼容同名 Environment Secret。内容为已核对的单行 `obr.dnd.center ssh-ed25519 ...` |
| SSH host / port / user | 固定 `obr.dnd.center:22` / `obr-deploy`；传输仍连接原服务器，发布目录使用新站点路径 |
| SSH host key 指纹 | 继续固定 `SHA256:bS1JRj3+1zJntm+ZOKtjlRhK7MjAAOEdKOdnKq+2yco` |
| Environment 规则 | 保留只允许 main、FullPeople 人工审批、管理员不可跳过；不新增免审批环境 |
| 云端触发认证 | 同一仓库的 Actions 写权限用于 `workflow_dispatch`；读取状态需要 Actions 读权限。提交工作流文件需要 Contents 写权限及 Workflows 写权限 |
| 服务器固定入口 | 安装 `server_entry.py`、`server_production.py`、`production_common.py`；保留原 `server_preflight.py` |
| 服务器固定发布器 | 安装 root 管理的 `production/frontend.py` 和 `production/publish.py`。候选只能上传静态数据，不能替换或执行发布器 |
| 原 SSH / sudo / 公钥规则 | 安装器仅把唯一强制命令从旧预检入口改为新固定分派入口，保留账号、公钥、禁用转发/PTY/密码/动态公钥等限制 |

**不需要新增 Secret、PAT、服务账号或服务器 API Token。** 服务器使用公开 GitHub API 核对提交和 CI；遭遇 GitHub API 限流时拒绝发布，稍后重新运行，不放宽校验。

## 管理员安装

先审查 PR 和安装器，然后在服务器管理员终端执行。`INSTALL_SHA` 使用最终交付的完整安装提交 SHA，不能填 main 或分支名。此提交可以在 PR 分支上；正式工作流仍必须合并到 main 才能运行。

```sh
INSTALL_SHA='<交付的完整安装提交 SHA>'
INSTALL_DIR=$(mktemp -d /root/dnd-deploy-install.XXXXXX)
git -C "$INSTALL_DIR" init
git -C "$INSTALL_DIR" fetch --depth=1 https://github.com/FullPeople/DND-card-web.git "$INSTALL_SHA"
git -C "$INSTALL_DIR" checkout --detach FETCH_HEAD

# 默认只检查当前身份、SSH/sudo 策略、安装源提交和保护状态。
sh "$INSTALL_DIR/tools/dot-deploy/admin-install-production.sh" \
  --expected-revision "$INSTALL_SHA"

# 安装已审查的持久发布权限；自动备份原策略并验证 SSH 配置。
sh "$INSTALL_DIR/tools/dot-deploy/admin-install-production.sh" \
  --expected-revision "$INSTALL_SHA" --apply
```

安装要求 root、现有 `obr-deploy` 账号、密码锁定、唯一现有受限 ed25519 公钥、root 管理的 `/etc/ssh/obr-deploy-preflight.conf`、原单命令 sudoers 和现有全局发布锁。原身份校验脚本散列必须与所审查提交一致；任何配置偏差都会停止，不能直接覆盖。脚本不读取私钥、不轮换公钥、不开放 shell。

安装时持有 `/run/lock/obr-static-release.lock`，复核网站全树和保护状态，比较 root/sync 的有效 SSH 配置，执行 `visudo`、`sshd -t` 后 reload 已存在的 SSH 服务。若检查或 reload 失败，恢复原公钥命令、SSH 和 sudoers，撤销本次新入口。安装备份与回执在输出的 `/root/codex-backups/dnd-production-entry-...`；安装不会发布网站。

## 同一提交的 CI 与触发命令

当前 main 的同一完整 SHA 必须具备三组 completed/success CI，所有 jobs 也必须 success；跳过、失败、取消、PR 事件、错误分支或分页缺失都会拒绝：

1. `Verify web`：`.github/workflows/web.yml`。
2. `DND Center cloud migration`：`.github/workflows/cloud-migration.yml`。
3. `Validate dot deploy contract`：`.github/workflows/dot-deploy-contract.yml`。

Web 随 main push 执行；cloud-migration 可手动从 main 执行；部署合约 CI 随相关 main 文件变更执行，也可手动执行。新 main SHA 没有 CI 时先触发缺少的完整工作流，不能借用旧绿灯。

```sh
gh workflow run cloud-migration.yml --repo FullPeople/DND-card-web --ref main
gh workflow run dot-deploy-contract.yml --repo FullPeople/DND-card-web --ref main
```

读取实际 main 头、三组最终成功的 run IDs，刷新线上 release.json 散列后触发候选预检。下面的参数由本轮真实状态填写；输入通过环境变量传递，不插入 shell 代码。

```sh
SOURCE_SHA='<当前 main 完整 SHA>'
CI_RUN_IDS='<web-run-id>,<cloud-run-id>,<contract-run-id>'
BASELINE_SHA='<当前 https://dnd.center/card/release.json 的 SHA256>'
RELEASE_VERSION='standalone-1.0.257'
gh workflow run dot-deploy-production.yml --repo FullPeople/DND-card-web --ref main \
  -f operation=preflight -f source_sha="$SOURCE_SHA" -f ci_run_ids="$CI_RUN_IDS" \
  -f expected_release_sha256="$BASELINE_SHA" -f release_version="$RELEASE_VERSION"
```

在 GitHub 网页人工批准 `production-card`，检查构建产物和服务器回执。预检通过后，以相同源码和仍有效的线上基线另行触发 `operation=publish`，再次经过人工审批。每次运行或重跑使用自己的 run ID/attempt，已有接收目录拒绝重复请求；不覆盖失败回执或复用旧备份。

## 上传、验证、发布与恢复边界

上传分为 GitHub Artifact 保存和经过 SSH 的二进制流。部署 job 从本次运行下载产物，核对构建 job 输出的完整散列与字节数，再获取短期 OIDC token。JWT 只在内存和 stdin 中使用；私钥只在 GitHub runner 临时目录使用，日志和 artifact 只保存经过筛选的结果。

服务器保留原 JWKS/RS256、issuer/audience、不可变 repository/owner ID、main/ref 类型、production-card、github-hosted、workflow 路径与 SHA、event、短期有效期校验，并增加本次 run ID/attempt 的绑定。旧 Web/Suite 预检协议继续走原校验，不能获得发布权限。

上传压缩包上限 128 MiB、展开上限 512 MiB、最多 10,000 个普通文件。拒绝范围外路径、路径穿越、链接、特殊文件、重复成员和文件/目录冲突；忽略上传的 owner 与可执行位。两套入口、release.json、完整同源源码 ZIP、单机图审计和逐文件散列都必须齐全。源码 ZIP 的文件集及 Git blob 散列还需匹配公开的该提交完整 Git tree；子模块和截断的 GitHub tree 返回会停止。改变固定发布器后，需要管理员另行审查升级，候选产物不能自行升级它。

封包在 `/root/codex-release-packages/dnd-center-actions-<run-id>-<attempt>`，校验后冻结完整基线、manifest 和固定发布器副本。保留旧 assets/downloads，避免已打开的标签页丢失散列资源。固定发布器在全局锁下进行完整双目标备份、基线/保护漂移检查、两个目录原子切换、真实本机 HTTPS/后端策略检查，写入 `/root/codex-release-receipts`。SQLite 始终使用现有持久目录。

管理员需要回滚某次**已发布**的本轮封包时，先检查该次回执的 manifest 散列和最新保护状态，然后以该封包冻结的发布器执行：

```sh
python3 /root/codex-release-packages/dnd-center-actions-<run-id>-<attempt>/frontend.py \
  --package /root/codex-release-packages/dnd-center-actions-<run-id>-<attempt> \
  --manifest-sha <该次回执的 manifestSha256> --rollback
```

部署账号不接受任意命令或 rollback。回滚会保留之后的新数据库记录和其他项目更新；目标或保护状态漂移会拒绝。没有自动清理历史恢复包，管理员定期审阅磁盘容量。

## 本次验证范围

本地及 GitHub 合约 CI 分别记录验证结果。合约测试包含错误 OIDC 身份/提交/工作流/审批环境、完整 CI/跳过项、恶意归档、源码 ZIP 内容、截断上传、旧预检兼容、真实 Linux 双目录发布/失败恢复/管理员回滚、数据库及第三方首页保留、旧 assets 保留、安装失败恢复原 SSH/sudo/公钥。

管理员实际安装、生产 Environment 人工审批和真实服务器发布需要对应现场回执；代码、合约通过或 workflow_dispatch 返回成功均不等于实际部署完成。新工作流未注册时，可先用同一认证向现有无凭据合约工作流实际 dispatch，独立验证 Actions 写权限。
