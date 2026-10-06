# 六条普通装备 AC 的定向验证（未合并、未部署）

基线：Web `79a84b5565f571f491484d00a765d4505047df27`，独立分支 `codex/equipment-ac-directed-20261006`。开始前核对公开 PR、相关远端分支和本机工作树，没有发现重叠的装备 AC 定向工作；没有改其他工作树、生产规则代码、UI249、进度统计或发布版本。

## 来源与证明范围

复用 Data `9acd4d5e7c5bed9cf34150db4319a7aeec6751e8` 的 `reports/g1/inputs-sha256.json`，Git blob `a074bc740ac5fd2641d000b7d40826e20c553cba`。只读取既有锁的 `https://5e.kiwee.top/data/items-base.json`：197,272 字节，SHA256 `9f1346c69344d66088dbdb1c26ea5872102d318ac148805a8ae9b5fedc5fc94f`。实际下载字节与锁完全一致；没有抓取其他资料文件或全库。稳定身份及逐项字段锁见 `tests/fixtures/equipment-ac-source.lock.json`。

| 真实条目 | PHB / 2014 | XPHB / 2024 | 结构字段证明 |
| --- | --- | --- | --- |
| Chain Mail / 链甲 | HA，16，p145 | HA\|XPHB，16，p219 | 版本、来源、稳定 ID、类型及基础 AC |
| Scale Mail / 鳞甲 | MA，14，p144 | MA\|XPHB，14，p219 | 同上 |
| Shield / 盾牌 | S，2，p144 | S\|XPHB，2，p219 | 同上 |

初轮锁定源没有提供中甲敏捷上限、重甲排除敏捷、2014 盾牌熟练后果、2024 盾牌训练要求。身份锁的 `missingRuleClauses` 继续如实描述**该输入文件**的缺口，不改源字节、哈希、版本或六个 ID。后续用户提供的独立官方核验已在 2026-10-06 重新读取，并仅闭合下节列明的 AC 机制依据。公开 Basic Rules/SRD 不证明仓库 ID，也不等于已逐字核对付费 PHB 全文或完整条目。

真实源的六项单元用例检查六个身份、真实归一化器映射，并将独立 AC 矩阵应用到匹配版本的三项真实机械投影；训练均明确记录为有或无，不猜未知状态。另验数量/两盾冲突、禁来源及备份保全。浏览器仍只收到这六项的机械字段投影；上游正文和其他字段不会进入角色夹具、截图、trace 或公开产物。

原创夹具另有十八项行为用例，现明确使用敏捷调整 −1/0/+2/+3 的独立矩阵；还覆盖穿卸、已知盾牌训练、数量为零和多份、两盾冲突、导入双护甲冲突及显式修复、禁条目/禁来源、关闭自动化、手工正负修正和旧绝对 AC、导出恢复及消耗资源不补满。**原创条目只验证软件行为，不证明真实六项身份；机制依据来自下列官方来源，真实投影另验身份与行为的连接。** 五项原创反例继续验证字节/哈希漂移、重复身份及版本/类型/AC 改变会拒绝。

## 独立官方 AC 依据与用例映射

只保存简短转述、链接和字面预期，不下载或提交官方规则全文；链接内容复核不宣称官方字节快照已锁定。独立可审矩阵见 `tests/fixtures/equipment-ac-mechanisms.json`，与身份锁分开维护，不从引擎反推预期。

| 依据 | 本批适用结论 | 用例映射 |
| --- | --- | --- |
| [2014 Basic Rules · Equipment](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment)，Armor and Shields / Medium / Heavy / Shield；[角色创建](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters)，Choose Equipment / Armor Class；[SRD5.1](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=62)，印刷 pp62–64 | 链甲固定16，不受正负敏捷影响；鳞甲14加敏捷且仅上限+2，负值仍扣；盾牌+2不以熟练为 AC 条件，只一面生效。创建示例链甲与盾合计18。其他未熟练后果未纳入 | `armorCases`、2014 `shieldCases`、`singleShield` |
| [2024 Basic Rules · Equipment](https://www.dndbeyond.com/sources/dnd/br-2024/equipment)，Armor / Armor Training / One at a Time；[Rules Glossary · Armor Training](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary)；[SRD5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=92)，印刷 p92 | 同样的链甲/鳞甲 AC；盾牌只有训练才+2，仅一面。未训练盾不自动承担身甲的劣势或禁施法 | `armorCases`、2024 `shieldCases`、`singleShield`；2024 提示不得套身甲限制 |
| [PHB2024 官方勘误 v1.0](https://media.dndbeyond.com/compendium-images/errata/PHB-24/PHB-2024_v1.pdf#page=1)，p1，Armor Table (p219) | 盾牌穿卸是 Utilize 动作 | 仅记边界；没有动作计时、执行或自动完成断言 |

| 敏捷调整（分数） | −1（8） | 0（10） | +2（14） | +3（16） |
| --- | --- | --- | --- | --- |
| 两版链甲 | 16 | 16 | 16 | 16 |
| 两版鳞甲 | 13 | 14 | 16 | 16 |
| 两版鳞甲 + 明确已训练盾 | 15 | 16 | 18 | 18 |

盾牌独立矩阵：链甲 + 2014 盾熟练/明确不熟练 = 18/18；链甲 + 2024 盾训练/明确未训练 = 18/16。两个矩阵同时用于原创条目和六个锁定真实条目。重复盾数量不得变成 +4；两条同时装备盾记录属非法产品状态，目前保守排除冲突部分并提示，测试中的 AC16 **不是官方规定的非法状态总值**。显式重装一盾恢复18且不删除记录。

原机制实现符合矩阵，未编造 bug 或修改生产公式。此轮补确实缺漏的精确敏捷边界、链甲下训练组合、真实源两盾冲突及无身甲惩罚提示断言，不增加测试数量来冒充新能力。跨版如何选择机制、训练未知如何处理仍待产品决策；本轮只验证版本匹配与明确训练声明。

没有发现需要修改生产机制的真实 bug，没有把局部 AC 检查记为整条装备完成或当前线上完成。力量要求、速度/隐匿后果、占手、施法限制、魔法装备、同调及其他装备仍在本批证明范围之外。

## 门禁与安全边界

`tools/fetchEquipmentAcSource.mjs` 只读取一个锁定 URL，限制字节数，校验 SHA256 后才保存到忽略目录；不更新锁、不重试、不跟随重定向、不换镜像。HTTP 拒绝直接失败。采用环境既有网络代理的 curl，关闭 curl 配置，保留 TLS 校验；不读取令牌或改网络配置。

`Verify directed equipment AC` 只使用 `contents: read`，执行锁定源、定向单元、类型/两种构建、加载边界及四项浏览器流程。原始输入目录不在 artifact 上传范围；只保留软件夹具与脱正文投影的浏览器证据。外部源缺少时，本机默认测试明确跳过六项真实用例和两项真实浏览器用例；专用 CI 必须先取得正确锁定输入，读取失败不会以夹具替代。

仅测试文件、测试工具、独立门禁和记录发生变更；机制矩阵只由 Node 测试读取，专用 CI 的路径筛选也包含该矩阵。没有生产入口、能力授予、玩家数据、角色迁移、Data 写入、部署、权限修改或 Issue 路由。Data 后续方案只记录：独立复核这些局部 AC 来源及连接证据后再申请接入 ledger；本次不增加任何进度数字，也不访问先前 401 的 Data 写入口。2014 未熟练其他后果、完整付费 PHB 内容、跨版/未知训练及整条/生产发布验证仍无本批完成声明。

## 本机验证记录

初轮提交 `1c4bbdfa2568f66d9e1505d43f8532bfd66bc33c` 的远端 [完整 Web CI](https://github.com/FullPeople/DND-card-web/actions/runs/37462986190) 为 **985 通过 / 32 条件跳过**、23 个 job 成功；[专项](https://github.com/FullPeople/DND-card-web/actions/runs/37462986224) 已实际读取锁定源，29 单元 + 4 浏览器全部通过。带源本机全量为 **991 / 26**，不能把本机带源结果写作未配置源的完整 CI 结果。下列首次失败和初轮本机结果保留；本轮官方机制证据最终复测、exact SHA 与 CI 收口另见交付记录。

官方机制复核后，专项仍为29项（18原创行为、5来源门禁反例、6真实身份连接），新增断言第一次执行全部通过，没有机制红例或生产修复。全量分别重新执行：带源991通过/26条件跳过；无源985通过/32条件跳过，均0失败、总1017项。类型、双构建及启动边界复测通过；没有独立lint命令。JSON报告、后续精确提交的浏览器/产物复验和远端CI结果保留在 `.local-evidence/equipment-ac/rule-evidence-*` 及 `rule-evidence-delivery.json`，推送前以最后结果核对，不把待跑写成通过。

- 最终全量单元：991 通过、26 项既有条件跳过、0 失败；其中新增 29 项全部运行，包含六项真实源检查，没有本批跳过。
- TypeScript `tsc --noEmit`、常规和 standalone 构建通过。仓库没有独立 lint 命令；另执行 `node --check` 与 `git diff --check`。
- `node tools/checkStartupBoundary241.mjs` 通过；两种产物分别检查 38 / 40 个 JS 文件，测试读取器和源路径标记均未打入运行 bundle。源输入不参加产品加载。
- 初轮最终 Chromium 浏览器 4 项通过，0 跳过、0 重试，45.6 秒：两版原创合同与两版真实机械投影。2014 敏捷 6 的撤销从 AC 19 回到 15、重做回到 19；2024 原创流程在 390×844 视口执行。明确核对保存后的版本、HP、临时 HP、手工余额、金币、熟练记录及手工回答；刷新保留主动关闭。手机与桌面截图已实际查看，无本批遮挡或横向裁切；实体手机、真实多人未验收。初轮浏览器证据保留在同一忽略目录下的独立归档，后续结果写入 `browser/`；初轮精确 SHA 的远端门禁已成功，后续提交须重验。
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

本分支沿 [draft PR10](https://github.com/FullPeople/DND-card-web/pull/10) 继续审阅，不合并、不部署。只撤销本轮机制证据时执行 `git revert <mechanism-evidence-commit>`，恢复初轮 `1c4bbdfa` 的树；撤销整个 PR 则按逆序执行 `git revert <mechanism-evidence-commit> 1c4bbdfa2568f66d9e1505d43f8532bfd66bc33c`，恢复 Web 基线树并保留后来他人的提交，不 reset 或覆盖 main。未合并时不需要生产回滚。独立回滚验证及最终 commit / CI 以交付记录为准。
