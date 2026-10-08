# dnd.center 正式部署接入

正式工作流 [Deploy dnd.center frontends](https://github.com/FullPeople/DND-card-web/actions/workflows/dot-deploy-production.yml) 已由 [PR26](https://github.com/FullPeople/DND-card-web/pull/26) 合入 main 并注册。AI 可用 `workflow_dispatch` 从 Web `main` 自行触发，构建输入的完整提交 SHA。输入 SHA、工作流 SHA、当前 main 头和三组完整 CI 的 SHA 必须完全相同。

发布目标固定为 `/var/www/dnd-center/card` 和 `/var/www/dnd-center/library`，两个入口成对发布。网站首页、三龙牌、旧 `/var/www/obr-plugins/card`、后台、SQLite、Nginx 和其他站点不在上传范围。

## 自主发布授权与当前接入状态

- `preflight`：构建并上传候选，服务器验证并保留 root 管理的恢复封包；不会切换线上目录。**会写入服务器的候选封包目录**，与旧工作流的纯只读预检不同。
- `publish`：经过同样校验后备份两个目录，调用预先安装的固定发布器进行原子切换和就绪检查；失败时恢复本次已切换的目录。

2026-10-08 用户明确授权云端部署、持续 AI 维护和 dot 推进自行更新，无需逐次人工批准；报告问题后可恢复已知可用版本。两种操作仍使用现有 `production-card` Environment，以保留密钥和 OIDC 身份。移除该环境的 required reviewers 后，AI 可自行发起预检、读取回执并发起发布，无需网页点批准。构建 job 不持有部署密钥或 OIDC 写权限。

**当前阻塞**：云端实际取消审批的 PUT 请求返回 `403 Resource not accessible by integration`，缺少仓库 `Environments: write` 权限。随后 GET 复核仍有一名 FullPeople 审批者，main 分支限制和管理员不可绕过均保留。此记录不代表审批已经取消。触发 Actions 的权限已实际验证；不需要新部署密钥或 PAT 才能运行工作流。

管理员用已有仓库管理权限，在 [production-card 设置](https://github.com/FullPeople/DND-card-web/settings/environments) 中取消 **Required reviewers** 并保存，保留 main 部署分支及现有两项凭据。也可在具有仓库 `Environments: write` 权限的管理员 `gh` 会话中执行以下一次性命令（现有环境配置为零等待时间、只允许自定义 main 分支）：

```sh
gh api --method PUT repos/FullPeople/DND-card-web/environments/production-card --input - <<'JSON'
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [],
  "can_admins_bypass": false,
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
JSON
gh api repos/FullPeople/DND-card-web/environments/production-card \
  --jq '{name,protection_rules,deployment_branch_policy,can_admins_bypass}'
gh api repos/FullPeople/DND-card-web/environments/production-card/deployment-branch-policies \
  --jq '[.branch_policies[] | {name,type}]'
```

回读结果必须没有 `required_reviewers`，且部署分支仍只有 `main`。取消审批仅修改该规则，不删除或重建 Environment。服务器安装是另一项一次性管理员工作，步骤见下方。若希望由云端完成环境设置，还需给其 GitHub 集成增加该仓库的 Environments 写权限；用户授权本身不会改变集成权限。

## 现有配置与新增配置清单

| 配置 | 要求 |
| --- | --- |
| Environment Secret `DEPLOY_SSH_KEY` | 沿用现有专用身份，不创建第二把密钥 |
| `DEPLOY_KNOWN_HOSTS` | 优先读取现有 Environment Variable；也兼容同名 Environment Secret。内容为已核对的单行 `obr.dnd.center ssh-ed25519 ...` |
| SSH host / port / user | 固定 `obr.dnd.center:22` / `obr-deploy`；传输仍连接原服务器，发布目录使用新站点路径 |
| SSH host key 指纹 | 继续固定 `SHA256:bS1JRj3+1zJntm+ZOKtjlRhK7MjAAOEdKOdnKq+2yco` |
| Environment 规则 | 只允许 main，保留管理员不可绕过；按最新用户授权取消 required reviewers。当前云端修改返回 403，管理员尚需完成一次性设置 |
| 云端触发认证 | 同一仓库的 Actions 写权限用于 `workflow_dispatch`；读取状态需要 Actions 读权限。提交工作流文件需要 Contents 写权限及 Workflows 写权限 |
| 服务器固定入口 | 安装 `server_entry.py`、`server_production.py`、`production_common.py`；保留原 `server_preflight.py` |
| 服务器固定发布器 | 安装 root 管理的 `production/frontend.py` 和 `production/publish.py`。候选只能上传静态数据，不能替换或执行发布器 |
| 原 SSH / sudo / 公钥规则 | 安装器仅把唯一强制命令从旧预检入口改为新固定分派入口，保留账号、公钥、禁用转发/PTY/密码/动态公钥等限制 |

**不需要新增 Secret、PAT、服务账号或服务器 API Token。** 服务器使用公开 GitHub API 核对提交和 CI；遭遇 GitHub API 限流时拒绝发布，稍后重新运行，不放宽校验。

## 管理员安装

在服务器管理员 root 终端执行。`INSTALL_SHA` 使用已验证的冻结实现完整提交，不能填 main 或分支名；后续文档及授权变更没有修改该安装器或发布器。

```sh
INSTALL_SHA=f8046e7b0244a1b21ae15b4d2d5ae710c6144e6d
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

确认 required reviewers 已移除、服务器入口已安装后，由 AI 自行检查构建产物和服务器回执。预检通过后，以相同源码和仍有效的线上基线另行触发 `operation=publish`，再验证真实公网结果并记录回执。AI 发起 API 请求不需要用户逐次确认。每次运行或重跑使用自己的 run ID/attempt，已有接收目录拒绝重复请求；不覆盖失败回执或复用旧备份。

## 用户报告问题后的自主恢复

发布过程中就绪检查失败时，固定发布器自动恢复本次切换的目录。上线后若用户报告问题，AI 已获授权将确认可用的应用源码恢复到新的 main 提交，取得该新提交的三组完整成功 CI，再刷新线上基线并通过同一 preflight/publish 流程恢复。完整 SHA 必须仍是当前 main；不能直接给工作流传入旧 SHA 复用旧 CI，也不能覆盖玩家数据库。若恢复涉及已安装的发布器变更，须先核对固定发布器版本；异常配置或未知恢复点应明确报告，不放宽校验。下方现有 root 快速回滚命令继续保留，部署账号本身没有任意 shell 或服务器 rollback 权限。

持续自主维护还需要实际运行中的 AI 任务或已配置的调度器来发起工作；本次没有新增定时 AI 任务。工作流就绪及长期授权不代表 AI 会在会话结束后持续运行。

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

实际认证、构建、封包与 GitHub 运行证据见 [交付回执](DND-CENTER-PRODUCTION-DEPLOY-RECEIPT.md)，其中给出管理员应使用的冻结实现提交。

本地及 GitHub 合约 CI 分别记录验证结果。合约测试包含错误 OIDC 身份/提交/工作流/部署环境、完整 CI/跳过项、恶意归档、源码 ZIP 内容、截断上传、旧预检兼容、真实 Linux 双目录发布/失败恢复/管理员回滚、数据库及第三方首页保留、旧 assets 保留、安装失败恢复原 SSH/sudo/公钥。

管理员实际安装、取消 Environment 审批和真实服务器发布需要各自的现场回执；代码、合约通过或 workflow_dispatch 返回成功均不等于实际部署完成。正式工作流实际触发 [37785977083](https://github.com/FullPeople/DND-card-web/actions/runs/37785977083) 已成功提交请求，并按预期拒绝旧提交 CI，deploy job 跳过；未读取部署密钥或连接服务器。
