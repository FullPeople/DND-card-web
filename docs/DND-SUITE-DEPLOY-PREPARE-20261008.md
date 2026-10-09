# 枭熊新旧版正式发布接入准备 · 2026-10-08

线上仍为 suite-dev 1.0.258-dev / suite 1.3.19，由桌面负责人发布。GitHub 实际远端确认 dev 与 main 两分支存在；当前受限 server_preflight.POLICIES 只有 suite-dev/dev，只读入口不能发布 stable/main。Web 新恢复 PR 也没有开放 Suite targets。

候选固定流程：由 FullPeople/obr-suite 的 dev 上单一 workflow 发起配套发布，封包 source tuple 包含完整 dev 和 main SHA，分别验证最新分支头和对应完整 CI。开发版要求 verify-suite.yml、dice-cross-window-ready.yml、dice-release246-profile.yml 及扩展后的 dot contract；稳定版要求 main 上 verify-suite.yml、verify-stable-paired.yml 及 dot contract。这些 workflow 文件已通过 GitHub 元数据确认存在；最终具体 job 条件必须逐项核验，不把 skipped 当 success。

服务器新 helper 必须独立于 Web policy，只固定 /var/www/obr-plugins/{suite-dev,suite}；保留旧 /card、首页、三龙牌、dnd.center、service/SQLite/玩家数据。preflight 在 root 包目录校验原始封包完整 SHA、两份 release.json/manifest 版本、全部文件清单和 Git blob 源码 ZIP，并冻结基线、原始封包和 manifest；publish 仅复用该封包，成对全备份、每目标持久意图/结果、双目标 HTTP与manifest验证、哈希查询/中断恢复。沿用同一全局锁、防止另一桌面 root 正在发布时抢写。

OIDC 须沿用真实 repository/owner IDs，严格绑定 dev workflow/main源码组合、Environment、不可变 repo身份和 run/attempt。当前 suite-dev 旧 subject 来自现有 policy；stable 没有既有有效 Environment/subject，不能猜或把旧 dev subject 扩大到 main。两目标成对发布的新增受限权限必须先交主会话确认，再按现场已配置的精确 subject编写 policy。不要创建第二身份、公钥、PAT或任意shell。

准备时已运行 deploy/cloud/test_suite_links.py 的8项真实 Linux目录合约：纯只读预检、目标漂移拒绝、全部完整备份先于交换、硬链接不截断旧文件及独立备份、双目标精确回滚、期间新增卡保留、第二次切换失败补偿、归档路径穿越拒绝。现有 suite_links.py 仍依赖内存 changed/stages，不能原样作为新受限服务。新增 helper 必须补 Web 本轮相同的 kill/receipt/fsync/补偿失败/外部漂移/重复 attempt/SSH超时/library式双入口HTTP测试；尚未实现或通过这些 Suite 新门禁，不能称正式通路已完成。

服务器升级需增加 root管理的 server_suite_production.py 与持久安全 publisher、副本 installation manifest，并在 server_entry.py 加固定 Suite分派。具体文件及哈希须等此独立扩展实现和独审冻结后再确认；当前Web升级安装器不安装这些文件。所需命令形状如下，**当前没有可填入的受审 Suite实现 SHA，因此不可执行安装**：

```sh
# 冻结 Suite helper 实现后，由 root 使用明确的旧/新完整提交运行同一
# hash-check-only 默认安装器；实际 --apply 必须支持这几个经过审查的文件。
sh "$INSTALL_DIR/tools/dot-deploy/admin-install-production.sh" \
  --expected-revision "$REVIEWED_SUITE_ENTRY_SHA" \
  --expected-installed-revision "$VERIFIED_INSTALLED_SHA"
# 具体扩展已确认、默认预检通过后才 --apply。
```

本轮没有该升级开关、不修改另一桌面负责人的 Suite源码、没有 dispatch Suite发布或改变环境规则。下一步应在独立扩展 PR 完成上述代码和故障测试，把准确新增文件哈希/配置交回确认；获得确认后才能增加服务器固定权限。既定日常产品发布授权本身不替代这项新增入口权限确认。
