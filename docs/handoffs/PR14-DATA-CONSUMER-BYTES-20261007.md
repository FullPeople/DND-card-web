# PR14 / Data 字节校验补丁交接

此文档和补丁位于已授权 Web 独立 Draft PR14，供原 Data 会话读取。仅含源码增量和
脱敏说明，不含上游规则全文、缓存、玩家资料、私审材料、凭据或作者私人邮箱。
Data 写入401未取得修复交接，未借 Web 发布材料去写受阻 Data 仓库。
发布检查仍由原 owner 执行；不合并、不部署，战俑不纳入250发布。

## 提交与基线

| 对象 | 精确提交 | 基线 | 状态 |
| --- | --- | --- | --- |
| PR14 初轮机制 | `c38705cfe53ea245512050728669adff0b285c2f` | Web main `ab03f1f90d126dbbec0284a2a2c32741953385ab` | 已推送Draft；本轮另增两项审查修复，最新头请读取PR14 |
| Data 代码补修 | `39bd0dbb3d62ede9ff756f92a837f1199fc5dd40` | Data main `9acd4d5e7c5bed9cf34150db4319a7aeec6751e8` | 本地提交；真实增量见下方补丁；未推送Data或创建Data PR/CI |
| 原覆盖的 Web 消费者 | `0dde358a2382d4c3d88977165f3a854feb0609e4` | 由Data原运行报告锁定 | Data39检查的真实48模块与八个现有函数探针均通过 |

## 可直接取得的真实 Data39 源码

[runtime-consumer-byte-ci-39bd0db.patch](runtime-consumer-byte-ci-39bd0db.patch)
是从 Data 基线到39bd实际 Git blob 生成的 full-index diff，12053字节，SHA256：
`8053b61d259b4daf16869068e7e0db84631d79168900eba461e6f6d309a8f1e5`。
省略了邮件/作者头，不改任何源码字节。在临时Git index内从基线应用此补丁，完整树得到
`8bc634afb8f4355e7b169aab98d8212ed41c84bf`，与真实39bd的tree完全一致；原工作树未改变。
此为补丁传递完整性检查，未重新运行已通过的Data测试。

Data差异共6文件、119新增/2删除，两个进度报告及计数原样保留：

| Data文件及源码位置 | 补丁起始行 | 作用 |
| --- | ---: | --- |
| `.github/workflows/build.yml:32` | 1 | 真实消费者探针前强制模块字节校验 |
| `src/runtimeCoverage/consumerBytes.ts:10` | 99 | 校验根目录/精确HEAD、每个实际文件与HEAD blob摘要；拒绝缺失、symlink、路径和重复项 |
| `scripts/verify_runtime_consumer.ts:1` | 88 | CLI读取报告，调用只读校验，输出精简结果 |
| `test/runtimeConsumerBytes.vitest.ts:10` | 132 | 八项正反例，不需要原229项缓存 |
| `docs/runtime-coverage.md:38` | 68 | 维护与本机校验方法 |
| `docs/RUNTIME-CONSUMER-BYTES-CI-20261007.md:1` | 14 | 实际测试、首次稀疏检出失败和回滚说明 |

原Data会话应先只读核对最新main，确认无人已完成同一补修，再用隔离分支接收。若后续main
已有修改，先检查冲突、保留他人更新；不覆盖现有分支、不reset/force push。

```sh
# 原Data仓库已有上述真实基线时；补丁文件从PR14文档下载
git switch -c codex/runtime-consumer-byte-ci-review 9acd4d5e7c5bed9cf34150db4319a7aeec6751e8
sha256sum /path/to/runtime-consumer-byte-ci-39bd0db.patch
git apply --check /path/to/runtime-consumer-byte-ci-39bd0db.patch
git apply /path/to/runtime-consumer-byte-ci-39bd0db.patch
git add .github/workflows/build.yml docs/runtime-coverage.md docs/RUNTIME-CONSUMER-BYTES-CI-20261007.md scripts/verify_runtime_consumer.ts src/runtimeCoverage/consumerBytes.ts test/runtimeConsumerBytes.vitest.ts
git write-tree
# 此时应等于上方39bd的完整tree；由原会话提交，新的commit SHA可以不同
```

Data39仅补CI字节核验，不能代替缺失原缓存的全量运行重审。原会话后续适配、提交和授权
推送产生的新SHA需要自己的必要检查/CI；此处保留原39bd证据，不声称新SHA自动绿色。

## Data39 已完成的检查（本轮未重跑）

- Vitest：9文件通过、1文件条件跳过；318通过、11条件跳过、0失败。
- Node `test/*.test.ts`：14通过、0跳过、0失败。
- Python公开导出：6通过，涵盖输出字节大小/摘要、完整身份与未知版本/部分边界、重复或缺审阅身份、伪造叠加回执、篡改原裁定/载荷、陈旧锁与无效main审阅。
- TypeScript build通过；无独立lint脚本，diff空白检查通过。
- 实际固定Web `0dde…`：48个文件及Git blob摘要全部匹配；8个真实函数正反例通过（护甲、武器、未消费载荷、种族、职业、可保存内容选择、缺引用拒绝、父职资源不能冒充空子职能力）。八例输入是原创软件合同，执行真实函数，不声称真实全库重放。
- 新增8个字节校验用例全部通过：匹配且报告不变、错误HEAD、脏工作字节、仅匹配脏文件的伪hash、缺文件、symlink、重复/不安全路径、嵌套目录冒充根目录。

首次完整检查因隔离 sparse checkout 未取得已提交 `reports/g1/coverage-report.json`，
为317通过/1失败/11跳过；补回原已提交目录后上述最终检查通过，没有删除断言。

11项跳过全部来自既有 `test/equivalence.vitest.ts`，没有设置
`DND_AUTOMATION_REAL_DATA` 与 `DND_WEB_EQUIVALENCE_REPO`。
它们要求11个G3锁定原始输入、原始字节hash/大小，以及src与历史Web
`80c94e082fcbf11be10893622b03d4220bff4d60`保持一致的对照目录；这不同于当前运行报告的0dde消费者。
以下是跳过的具体测试，不能称通过：

1. 固定种族属性与原planRacialAbilities等价。
2. 两版护甲基值、敏捷上限与同调条件。
3. 背景属性分配与已存分配控件等价。
4. 首职技能及豁免授予与evaluate等价。
5. 固定移动、生命骰与HP数值。
6. 戏法与累计法术书容量。
7. 投掷/多用武器的命中与伤害。
8. 两版领域法术的来源归属及等级门禁。
9. Foundry空uses、骰池与明确不可用边界。
10. 起始装备货币与已有正文数值修正的差异。
11. 战斗风格类型选项的已存答案键及目录身份。

## 原229输入与目前4个实物匹配

229是原Data运行报告的审计输入总数，不表示此执行环境此前持有完整229文件。
原报告记录URL与JSON正文摘要，不记录原缓存机、持有人或原路径。当前没有取得完整浏览器缓存/index。
先前定向盾牌/战俑核验留下的四个实物被找到，因此当前缺项为229−4=225；不是丢失了225个此前持有的文件。
本轮仅重新读取并核算现有四个实物，未重新下载或发布全文。文件名不作为身份。

摘要算法严格复用原audit：UTF-8 `JSON.stringify(JSON.parse(fileText))` 的SHA256，
不排序键、不使用Python重新序列化、不用原始HTTP字节hash替代。以下四项在原229报告中
各恰好一条，同URL的期望摘要与实际归一化摘要逐字节相同；原始字节hash另与G1对应URL实锁相同。
只发布URL/大小/摘要，不发布原文或本机缓存位置。

| 原公开来源URL | 原始字节数 | 真实匹配的归一化SHA256 |
| --- | ---: | --- |
| `https://5e.kiwee.top/data/class/class-fighter.json` | 170179 | `a4c5afc0e7ec7a444d1418a04ab4fe392b9a7a25907ac0fb9b8618a79d1ee509` |
| `https://5e.kiwee.top/data/class/index.json` | 497 | `df3b169d180b64285926b206848c5241a89497b9433af4e90e0e83feece8d5c7` |
| `https://5e.kiwee.top/data/items-base.json` | 197272 | `8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff` |
| `https://5e.kiwee.top/data/races.json` | 603288 | `a9289aaafcc24674d632b3daafc93eace5bf4496c66c9f5482a6baf304473712` |

前三项来自先前盾牌定向核验保留的文件，races来自战俑核验；items-base在两项任务中共有。
G1的117个输入URL与原229只交集110项，另119个原运行输入不在G1清单中。
即使找回G1实物，也要逐项比对上述归一化摘要，不能以G1清单或重新导出结果顶替原缓存。

合法可继续的方法是由原生产会话/合法缓存持有人，从既有浏览器缓存或本机备份取JSON正文，
按原报告的URL及归一化摘要重新匹配；原文件名不同不影响。只在全部229项验证一致后，在私有
缓存根下建立真实 `index.json`（每行 `url/path/sha256`，path指向根内实物），再用原audit对
真实干净Web候选重算，并验证18,789身份集合、aliases与原review snapshot。当前尚未找到
余225项的位置、缓存持有人或可在本环境恢复它们的现有入口；这个方法可行，不等于缓存已恢复。
不会生成假的补全index、改hash/计数或默认补齐机制，公开仓库不接收原缓存。

## 战俑审查修复与剩余边界

本轮补红得到5失败/14通过，另一个概念点击旧重复/空位红例复现压缩丢值；修复后相关四文件64通过/1既有外部职业快照条件跳过、TS通过。
覆盖显式/混合概念点击、真实索引拖拽路由、禁用/重开来源、错版/显式legacy、缺索引及超额旧槽、
独立编辑/明确移除、不激活禁用源技能、手工熟练与资源保全；两项真实组件静态输出检查不是浏览器QA。
Data39绿色检查未重跑，原PR14完整1004通过/17失败/32条件跳过属于c387，不冒充本次完整通过。

当前运行门禁仍陈旧，锁定48模块中有两项变动：

- `src/core/automation/choices.ts`：`e6238445850d47d38799d59c51db7eb74decb5506091b64bc5804af99673f4c4`
- `src/ui/ChoiceWorkspace.tsx`：`9fd520ff14f444b454a08423bb2ab42fcf0e66b4a2987bc4a1f92532755bd8ff`

这些真实摘要供核对，不可直接手填到旧回执；必须由真实原输入重审生成完整证据。
绿色生产构建/浏览器仍未取得，不合并或部署。

回滚Data原39bd为 `git revert --no-edit 39bd0dbb3d62ede9ff756f92a837f1199fc5dd40`；
若原会话接收补丁产生新SHA，revert实际新提交。Web只撤本轮修复可revert审查修复提交；
整PR按实际追加提交逆序revert，保留main后续历史及已合并盾牌/查看器成果。
