# 闸门 G1 · 全库盘点 · 2026-10-03

## 结论

技术盘点和复跑完成，用户审阅待确认；G1尚未最终放行，不进入G2。当前只是分母与候选报告，未达完整自动化底线。

独立工具本地暂名 `dnd5e-automation-data`，目录 `/workspace/dnd5e-automation-data`，尚无远端仓库或release。原DND-card-web的代码、既有测试和运行协议保持原状态。

## 范围与结果

- 从实际kiwee读取117份输入：官方角色相关固定文件、全部职业/法术索引文件、6份Foundry侧车和完整三方索引展开文件。
- 原始角色相关记录13,624；继承、版本与具体魔法物品展开后，按暂定身份键去重为18,792。
- 结构候选11,475 / Foundry候选1,485 / 正文候选5,832。三类互斥；它们均不是正式协议verdict或完成度。
- Foundry实际1,661行，匹配1,554行、未匹配107行；有效载荷命中按条目统计，不能与行数相加。
- 英文身份缺口58；未解决_copy 3；父种族/变体依赖未解决5；同键不同内容冲突2。全部在inventory-gaps.json中保留。
- 数据锁：kiwee 2.36.0 / 2026-09-21，Foundry migrationVersion 3；逐输入SHA-256齐全。

核心四书，仅统计执行计划DoD中的13种原始kind（包含baseitem、magicvariant；item含具体魔法物品）：

| 核心来源 | 展开后暂定分母 | 结构候选 | Foundry候选 | 正文候选 | 身份缺口 |
| --- | ---: | ---: | ---: | ---: | ---: |
| PHB | 1519 | 902 | 118 | 499 | 10 |
| XPHB | 1448 | 417 | 698 | 333 | 10 |
| DMG | 1171 | 1058 | 10 | 103 | 0 |
| XDMG | 2258 | 1864 | 334 | 60 | 0 |

逐书逐kind完整矩阵见独立目录 `reports/g1/coverage-report.md`；逐条身份、来源文件引用、候选与缺口见同目录JSON。

## 身份与归一化边界

本期身份仅用于盘点，正式英文身份函数须在G2审阅。58个缺口包括PHB的10条子种族、XPHB的10条种族、FTD的15条种族、EGW的20条子种族，以及3条三方物品；涉及生成变体中缺少纯英文标识。没有猜译，也没有按显示名硬配。

107条Foundry未匹配行是raceFeature 90、race 11、subclassFeature 6。前者多为正文内特性，不能强行匹配到整条种族；须在后续协议中明确父子归属。

两处同键冲突均在第三方库。当前保留一个主盘点身份并记录冲突，尚未裁决它们是否需要独立extra键，不能把这个暂定去重分母当最终发布分母。官方核心四书没有该冲突。

复用DND-card-web 80c94e0的纯expandCopies/expandVersions/specificMagicItems及子种族继承。按namespace全局展开；不将官方来源作为三方的隐式同包父项，不应用运行期sourceCorrections。报告已经明确这些与运行目录逐文件加载的差异。

## 命令与证据

`npm ci --cache /workspace/npm-automation-cache`，退出0：

```text
added 4 packages in 523ms
```

`npm test`，退出0，最终原始输出：

```text
ℹ tests 14
ℹ pass 14
ℹ fail 0
ℹ skipped 0
```

`npm run build`，退出0：

```text
> dnd5e-automation-data@0.0.1 build
> tsc -p tsconfig.json
```

真实拉取：`npm run inventory -- --cache .cache/upstream --out reports/g1`，首轮所有117文件HTTP200。最终算法修订后仅以同一锁定输入重生成；没有伪装成再次在线拉取。

最终生成：`npm run report -- --cache .cache/upstream --out reports/g1`，退出0。

复跑：`npm run report -- --cache .cache/upstream --out .cache/g1-replay-shapes`，退出0。输入文件逐个先核对锁定SHA；4份产物全部逐字节相同：

- `coverage-report.json`：`3b5c5d67d83af786449958e0ec1aa3ef5eea1c3ac15798215f5c48256d337bca`
- `coverage-report.md`：`fc7318c365532d0320eae13a964820611da7a40cb1a6b9fa3a468f40822a2851`
- `inputs-sha256.json`：`fdb5282737407a9687ff602d9d7e5acfc7740aba1266bf2999ff800531b1a87a`
- `inventory-gaps.json`：`f33bd0810b3fc47739a493bc0f8a429cc8a03ea33d94be2533631c347b81be50`

完整原始日志和命令退出码留在独立工具的忽略目录 `evidence/`；输入正文仅在忽略 `.cache/upstream/`。

## 首次失败与修正

1. 新工具首次测试11通过/0跳过/1失败：正文检测器把报告顶层的元数据entries数组误判为正文。修正检测器，只允许已知盘点记录结构，仍递归拒绝正文和CJK；未改测试断言。
2. TypeScript首次构建退出2，TS5011要求rootDir；补显式rootDir后发现Node类型未启用和一个可选对象收窄问题。补types=node及明确非空分支后构建退出0。未关闭strict或跳过类型检查，失败日志均保留。
3. 真实复核发现第三方包级_meta.edition未继承，首轮跨版本模板产生19,484条。按现有homebrewBody约定补版本继承，新增一项跨版本反例，最终18,792；692条跨版本展开被排除。核心四书分母未变。首轮报告保留在忽略缓存，不与最终报告混用。
4. 云环境revision 5→6恢复后文件和缓存保留；旧进程ID失效，重查环境、干净安装并重新取得最终命令退出码。未据旧进程状态推断成功。

## 测试契约变更

既有DND-card-web测试变更：无。独立工具新增14项原创测试，覆盖译名变化、版本隔离、完整父级匹配、继承展开、冲突留痕、候选分区、inline orphan、正文拒绝、路径拒绝、包级版本与载荷统计。没有修改skip、超时或重试。

## 未验证与下一步

尚未完成正式schema/automation.json/unsupported.json、派生器A+B、真实字段等价性、卡片协议3接线、覆盖标注、浏览器/CI、两次独立审计或kiwee演练。真实登录房间、实体手机、玩家旧卡及Node22执行未因此验收。

执行计划§5的G1条件为“用户看过报告并确认继续”。建议审阅本报告后进入G2：建立严格schema、11类不变量与正式身份，保留全部未知缺口，不把它们判为automated；远端名称在创建前仍由用户决定。下一期仍不推送、合并、部署。
