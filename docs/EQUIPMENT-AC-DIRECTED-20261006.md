# 六条普通装备 AC 的定向验证（未合并、未部署）

基线：Web `79a84b5565f571f491484d00a765d4505047df27`，独立分支 `codex/equipment-ac-directed-20261006`。开始前核对公开 PR、相关远端分支和本机工作树，没有发现重叠的装备 AC 定向工作；没有改其他工作树、生产规则代码、UI249、进度统计或发布版本。

## 来源与证明范围

复用 Data `9acd4d5e7c5bed9cf34150db4319a7aeec6751e8` 的 `reports/g1/inputs-sha256.json`，Git blob `a074bc740ac5fd2641d000b7d40826e20c553cba`。只读取既有锁的 `https://5e.kiwee.top/data/items-base.json`：197,272 字节，SHA256 `9f1346c69344d66088dbdb1c26ea5872102d318ac148805a8ae9b5fedc5fc94f`。实际下载字节与锁完全一致；没有抓取其他资料文件或全库。稳定身份及逐项字段锁见 `tests/fixtures/equipment-ac-source.lock.json`。

| 真实条目 | PHB / 2014 | XPHB / 2024 | 结构字段证明 |
| --- | --- | --- | --- |
| Chain Mail / 链甲 | HA，16，p145 | HA\|XPHB，16，p219 | 版本、来源、稳定 ID、类型及基础 AC |
| Scale Mail / 鳞甲 | MA，14，p144 | MA\|XPHB，14，p219 | 同上 |
| Shield / 盾牌 | S，2，p144 | S\|XPHB，2，p219 | 同上 |

源文件没有提供本轮需要的完整条款：中甲敏捷上限、重甲排除敏捷、2014 盾牌熟练后果、2024 盾牌训练要求。这四项保持**规则条款待核实**。不能由结构字段、旧审阅笔记或软件测试推断其规则语义已核实，也不能据此排除真实规则与产品决策的冲突。

真实源的六项单元用例只检查六个身份、真实归一化器的映射、敏捷 10 且明确手工记录训练时的基础 AC 穿卸/替换、数量不倍增、禁来源及备份保全。浏览器只收到这六项的机械字段投影；上游正文和其他字段不会进入角色夹具、截图、trace 或公开产物。

原创夹具另有十八项软件行为用例：独立手算敏捷 6/10/16/30 的穿卸结果；现行中甲上限与重甲公式；两版缺盾牌训练的现行产品策略；数量为零和多份、两盾冲突、导入双护甲冲突及显式修复；禁条目/禁来源；关闭自动化；手工正负修正和旧绝对 AC；导出恢复及消耗资源不补满。现行产品策略为 2014 未训练仍计盾牌基础 AC 并提示限制，2024 未训练不计盾牌 AC。**这些原创用例验证产品合同，不是上述缺失条款的真实规则证据。** 五项额外原创反例验证字节/哈希漂移、重复身份及版本/类型/AC 改变会拒绝。

没有发现需要修改生产机制的真实 bug，没有把局部 AC 检查记为整条装备完成或当前线上完成。力量要求、速度/隐匿后果、占手、施法限制、魔法装备、同调及其他装备仍在本批证明范围之外。

## 门禁与安全边界

`tools/fetchEquipmentAcSource.mjs` 只读取一个锁定 URL，限制字节数，校验 SHA256 后才保存到忽略目录；不更新锁、不重试、不跟随重定向、不换镜像。HTTP 拒绝直接失败。采用环境既有网络代理的 curl，关闭 curl 配置，保留 TLS 校验；不读取令牌或改网络配置。

`Verify directed equipment AC` 只使用 `contents: read`，执行锁定源、定向单元、类型/两种构建、加载边界及四项浏览器流程。原始输入目录不在 artifact 上传范围；只保留软件夹具与脱正文投影的浏览器证据。外部源缺少时，本机默认测试明确跳过六项真实用例和两项真实浏览器用例；专用 CI 必须先取得正确锁定输入，读取失败不会以夹具替代。

仅测试文件、测试工具、新的独立门禁和本记录发生变更；没有生产入口、能力授予、玩家数据、角色迁移、Data 写入、部署、权限修改或 Issue 路由。Data 后续方案只记录：取得并锁定四项规则条款，独立复核后再申请把局部 AC 证据接入其 ledger；本次不增加任何进度数字，也不尝试先前 401 的 Data 写入。

## 本机验证记录

- 最终全量单元：991 通过、26 项既有条件跳过、0 失败；其中新增 29 项全部运行，包含六项真实源检查，没有本批跳过。
- TypeScript `tsc --noEmit`、常规和 standalone 构建通过。仓库没有独立 lint 命令；另执行 `node --check` 与 `git diff --check`。
- `node tools/checkStartupBoundary241.mjs` 通过；两种产物分别检查 38 / 40 个 JS 文件，测试读取器和源路径标记均未打入运行 bundle。源输入不参加产品加载。
- 最终 Chromium 浏览器 4 项通过，0 跳过、0 重试，45.6 秒：两版原创合同与两版真实机械投影。2014 敏捷 6 的撤销从 AC 19 回到 15、重做回到 19；2024 原创流程在 390×844 视口执行。明确核对保存后的版本、HP、临时 HP、手工余额、金币、熟练记录及手工回答；刷新保留主动关闭。手机与桌面截图已实际查看，无本批遮挡或横向裁切；实体手机、真实多人未验收。截图见 `.local-evidence/equipment-ac/browser/`，远端专用 CI 仍需精确提交验证。
- 首轮 25 项通过、两项投影断言失败：归一化器产生空 `raw.entries`，不代表规则正文泄露或生产机制 bug。投影现只含明确列出的机械字段。
- 浏览器首次发现阶段分别因 JSON 导入属性和间接 `import.meta.env` 依赖失败，未执行用例；已将测试工具与浏览器平台依赖分离，真实归一化器仍由 corpus 单元独立复核。
- 首次完整浏览器为 2 通过 / 2 失败：2014 导入停在既有跨版本核对，测试未点击确认。补明确保留记录的确认后 4 项通过；进一步增加版本保全断言、可区分的撤销 AC 及手机场景，最终 4 项再次通过。各轮证据分别保留，不宣称首次全绿。
- Node 原生 fetch 本机直连失败；改用既有代理配置的 curl 后同一 URL、字节与哈希验证成功，没有 HTTP 401/403 或镜像替代。初始文件搜寻遇受保护系统目录拒绝，未进入或绕过；随后仅使用实际锁定的公开输入。
- 本机复用的 61 个已安装依赖记录与当前 package-lock 的版本、resolved 和 integrity 全部一致；没有写入共享依赖目录。CI 自行 `npm ci`。

复跑（原始资料留在忽略目录）：

```sh
node tools/fetchEquipmentAcSource.mjs --output .local-evidence/equipment-ac/upstream/items-base.json
DND_EQUIPMENT_AC_SOURCE=.local-evidence/equipment-ac/upstream/items-base.json npm test
npm run build
npm run build:standalone
node tools/checkStartupBoundary241.mjs
DND_EQUIPMENT_AC_SOURCE=.local-evidence/equipment-ac/upstream/items-base.json npx playwright test --config playwright.equipment-ac.config.ts
```

## 回滚与审阅

本分支只提供 draft PR，用户审阅前不合并、不部署。合并后可按该 PR 的实际提交执行 `git revert <equipment-ac-directed-commit>`；保留后来他人的提交，不 reset 或覆盖 main。未合并时不需要生产回滚。独立回滚验证及最终 commit / CI 以交付记录为准。
