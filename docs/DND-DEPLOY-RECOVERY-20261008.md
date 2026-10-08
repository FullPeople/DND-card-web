# 部署恢复修复与接入核验 · 2026-10-08

本轮从干净的 Web main `4c437b7882cb2be8b06415a4f139f389592a42d9` 建立独立候选。没有产品版本更新、合并或服务器安装/发布。用户 14:07 UTC 的“已自行移除人工审批、正式入口 status:installed”声明优先于旧文档；安装声明已接受，尚不能用现有入口读取其现场 revision/hashes。

## 实际核验

- GitHub `production-card` GET 已无 required_reviewers，只有 branch_policy；部署分支 GET 只有 main，can_admins_bypass=false。现有认证可以读取设置，无需申请 Environments 写权限。
- main Web CI [37795359039](https://github.com/FullPeople/DND-card-web/actions/runs/37795359039) 的全部 24 jobs success。该 main 尚没有相同 SHA 的完整 Cloud/contract 发布门禁组合；不能复用 df42ce4 的绿灯。
- 使用现有 Environment 身份发起原纯只读预检 [37858208000](https://github.com/FullPeople/DND-card-web/actions/runs/37858208000)。validate/preflight 两个 jobs 和全部步骤 success；该旧协议只核对旧 obr/card 及原受保护目录，不证明新版生产协议的安装 revision。
- 该 run 的 artifact 下载重定向至 Actions Azure 存储后返回 403，已停止下载，没有更换身份或路线。Actions 元数据可读；仅凭此 403 不能断言是 GitHub OAuth 权限不足。当前环境没有本地 SSH 私钥，也没有授权的 root 服务器执行会话；不要求用户提供秘密。
- 公网 card/library release.json 均 HTTP 200，Web 258、公告 0.1.48、源码 df42ce480ef227ddfe4474a9bffbe81e449da98c。card SHA256=41e8191638cacef60f9dff3204af9c5b3e881e8d7ab9f12695c2ba9c1ba2ab57，library SHA256=c1ce7d253998c8fbd46bf599fe5adde60a866ae65ee795fff07364a889536da2。
- API health HTTP 200，后端 1.0.253，temporaryUpload=true、quotaScope=ip、qqLogin=pending。枭熊公网 258-dev / 1.3.19 保持；旧 obr/card 251 保留。没有写玩家卡。
- Web PR24、21、17、7、2 与 Suite PR25、12、7 保持原状；本轮不改职业 PR17、三龙牌或桌面负责人发布的插件。

## 修复行为

frontend.py 在备份前写 preparing；持久备份/候选后写 prepared；每目标写 publish/restore intent，原子交换和目录 fsync 后再写结果。JSON 临时文件、rename 后的父目录与备份/候选均 fsync。进程死在交换与结果写入之间时，status 用完整实际树哈希消除歧义，recover 只接受冻结基线/候选。补偿失败保存 recovery-required 并继续尝试另一个目标。外部漂移拒绝覆盖；数据库只读检查，后续玩家记录保留。恢复/回滚验证 card 和 library HTTP。

服务器持久保存不含 OIDC 的 attempt binding、manifest 指针与结果。同 attempt 重复请求先核对身份字段/封包哈希，再返回实际状态，不再重复交换。SSH 超时或断开仅触发带新 OIDC 的只读查询；无法查询则明确 publicationOutcome=unknown，不宣称失败或成功。成功回执先持久化，清理失败只标 cleanupPending。

preflight 保存唯一封包，publish 从该成功 preflight 的 GitHub artifact 下载原始 bytes，服务器核对完整 archive hash/bytes、source、CI、基线与 sealed manifest；不重新构建。未完成的 preflight、self-reference、错误哈希和新旧源不匹配均拒绝。保留完整 Git blob ZIP核验、限额、独立备份、空间预算与 assets/downloads。

新 inventory/status 是只读固定操作。recover 只能恢复 preparing/prepared/recovering/recovery-required 的未完成尝试；已 published 的任意服务器 rollback 仍拒绝。管理员 root 的冻结包 --rollback 继续独立使用。跨 run 查询仍绑定固定仓库/owner IDs、main/workflow SHA、production-card、当前 run/attempt 和短期 OIDC；写恢复要求当前 main 的完整三组 CI。

## 待独审的服务器代码与权限影响

所有路径均在 `/usr/local/libexec/obr-deploy/` 下。下表为候选字节散列，**不是现场已安装散列**。server_entry.py、publish.py 字节未改变。

| 安装相对路径 | 候选 SHA256 |
| --- | --- |
| `server_entry.py` | `faa58b5cec0862a2df4c23569bf2b630bd68228bea6336dcb5183e6c9e7c608d` |
| `server_production.py` | `020fef889bceed6f78179b196230ed3b3eea111b89447b0ef4ed49a0a6c31cee` |
| `production_common.py` | `67d1e9b3b4a4f09e6457f94680fe96ce83da2ddcbf58e6be51765d155161f5af` |
| `production/frontend.py` | `1af02bf054d0e040b8afe2e6921683a80e4cf97eba1f1b29aad09d6a3ff12e91` |
| `production/publish.py` | `7aecd9312d8a97881121833698f03250912e20513ca641e6af0def1489b980b6` |

新增 root 管理的 installation.json 记录实际 reviewedRevision 和五文件散列。安装器需 root，先以 --expected-installed-revision 将全部已有代码字节比对旧冻结提交；任何未知漂移都停止。升级不改变原公钥、账号、sudo/SSH grant，不 reload SSH；新增固定操作 inventory/status/recover 及安装代码是安全边界变更，须由主会话对这些具体文件与行为确认后安装。没有新 Secret、PAT、账号、任意 shell、DB权限、服务重启或新发布目录。

安装器的恢复逐文件记录并继续尝试所有旧文件；恢复报告位于备份目录 recovery.json。原始 helper/policy 备份在修改前 fsync，升级失败恢复旧 helper 而不删除。

管理员命令模板（只在主会话独审确认**最终完整提交和新增固定操作**后执行，不能以一般开发授权代替）：

```sh
REVIEWED_SHA='<最终独审确认的完整40位提交>'
INSTALLED_SHA='<现场 installation.json/管理员安装回执的完整提交>'
INSTALL_DIR=$(mktemp -d /root/dnd-deploy-upgrade.XXXXXX)
git -C "$INSTALL_DIR" init
git -C "$INSTALL_DIR" fetch https://github.com/FullPeople/DND-card-web.git "$REVIEWED_SHA" "$INSTALLED_SHA"
git -C "$INSTALL_DIR" checkout --detach "$REVIEWED_SHA"
sh "$INSTALL_DIR/tools/dot-deploy/admin-install-production.sh" \
  --expected-revision "$REVIEWED_SHA" --expected-installed-revision "$INSTALLED_SHA"
# 前一步哈希核对通过、具体升级已确认后才安装。
sh "$INSTALL_DIR/tools/dot-deploy/admin-install-production.sh" \
  --expected-revision "$REVIEWED_SHA" --expected-installed-revision "$INSTALLED_SHA" --apply
```

旧安装指南冻结实现为 f8046e7b0244a1b21ae15b4d2d5ae710c6144e6d；不能据此猜现场值。管理员安装回执或逐文件只读散列才能确认，非秘密无需私钥。安装后先 inventory 回读上述哈希和 revision，再检查 main 相同 SHA 的三个完整 CI。正式 publish 必须提供 prepared_run_id/attempt/prepared_manifest_sha256；status/recover 另提供原 publish lookup_run_id/attempt 和同一 preflight 输入。status 允许当前 workflow SHA 查询历史冻结产物，recover 要求当前完整 CI，均不会执行上传代码。

## 验证与门槛

本机 19 frontend unittest + 44 dot unittest + 8 publish unittest + 3 upgrade unittest + 8 Suite filesystem checks 全部通过；31 cloud 单元及完整 build:cloud 通过。actionlint 1.7.7 校验两份改动 workflow 通过。故障测试包含真实 Linux fork/os._exit：两次发布交换后和回滚交换后进程终止、备份准备中止、回执写失败/fsync失败、补偿失败、外部漂移、library HTTP失败、重复请求、错误批准封包、cleanup失败、SSH超时及安装首文件恢复失败。

最终候选同 SHA 的 Web/Cloud/contract CI 将在 Draft PR 运行并通过 GitHub 元数据回读；PR 事件 CI 不能冒充服务器要求的 main push/dispatch CI。独审及安装变更确认前不合并、不发布。本轮没有必要重发健康的 258。

## 有效恢复点与剩余边界

258 原回执和两套完整备份保留，见 [RELEASE-258-FINAL](RELEASE-258-FINAL.md)。Web 包 /root/codex-release-packages/dnd-center-palette-gallery258-20261008，manifestSha256=ba1282d38f6ea21bb3dd428f843e852295d8e1d720184f70345a4a9844aebc4d，包内 backup/frontend/{card,library} 是回到 257 的完整备份；插件包 suite-palette-gallery258-20261008，receiptSha256=3a821ed2c22b94f0abae895628701738adb83ec57cc82bc9ca617b96bc49e7e5，两目标 before 同名完整备份保留。这些点来自已验证 258 最终回执，本轮没有服务器读权再次现场核对。

恢复当前健康 258 应以 df42ce480ef227ddfe4474a9bffbe81e449da98c 的应用树恢复成**新 main 提交**，保留最新受审部署代码，再取得新 SHA 全 CI；不能直接输入旧 SHA 绕过 main门禁。旧冻结 frontend.py 仍有本轮发现的恢复缺陷，不能据文档存在命令就把中断恢复称为安全已验收。

枭熊云端仍只有 dev 只读预检，没有 stable/main 的受限正式发布授权。两入口正式流程、服务器升级范围和测试清单见 [枭熊发布接入准备](DND-SUITE-DEPLOY-PREPARE-20261008.md)，不能通过 Web 当前固定入口发布。
