# 六项豁免调整值 · 2026-10-04 恢复后的本地候选

## 当前源码与范围

用户要求：「卡上的豁免也要有调整值输入框，而不是只有技能最后有。」本次只做本地候选，没有 push、PR、合并、部署、版本升级或玩家数据操作。

最初候选在主线更新时已重基于恢复244的 `41a652373019cb912edb0fa7e0eef13f702c2fef`，产生本地提交 `b53fd122bc18fe87680cc485cd407789d115ef85`。06:58 UTC 复查发现原候选目录及其本地对象随云环境恢复旧快照消失，旧提交现在不可读取；其验证仅是历史证据。

本次重新独立 clone 官方仓库，官方 main branch API 与显式 `git fetch origin main` 的 FETCH_HEAD 均核对为 `41a652373019cb912edb0fa7e0eef13f702c2fef`。在 `codex/saving-throw-adjustments-recovered-20261004` 恢复同一窄功能及全部已审阅修订，再运行验证。保留 upstream 的工作台恢复、公告、独立三龙网站入口、CI 配套与版本。本候选不改 Suite；后续集成前仍须再核最新主线。

## 实现

- 六项豁免在编辑模式各有独立额外调整输入，复用技能的 NumberInput 与四列布局/字号。普通与只读模式隐藏输入，保留最终值和熟练标记；来源熟练不改为可勾选。
- 新增可选 `saveBonuses`，只接受六个能力键、±9999 范围整数。现有 `adjustments` 是最终值覆盖，不能拿它当偏移。
- 原豁免计算（含来源、属性、熟练及已有最终值覆盖）之后加一次偏移。零值移除该项，正负值按技能方式截断/限定。空白、无效数字及 Escape 取消草稿；Enter / blur 提交，沿用技能交互。
- 不改 NumberInput、ValueTrace、技能计算、版本语义、规则/临时来源或资源；既有总值显示/基础值编辑的同步逻辑保留。
- 原生/联机文件保留 saveBonuses；现有 exportOwlbear 将最终豁免写到 `abilities[a].save.bonus`。native 与 legacy 增量独立应用对应字段；无需宿主字段白名单或存储迁移。

## 恢复版的重新验证

- 重新先加15项核心回归：13失败、2通过；恢复实现后新增15项全部通过，连同既有技能/数值输入/熟练显示的26项定向测试全部通过。
- 全量重新运行：882通过、25按外部资料等条件跳过；类型检查与集成/standalone双生产构建通过。保留原有大chunk提示。
- 覆盖2014/2024、六能力、正负零与整数边界、来源禁用/恢复、自动化开关、旧最终值覆盖、资源不补满、反复native/linked/raw往返，以及native/legacy独立add/change/zero/delete增量。
- 新增5个浏览器场景，专用配置发现integrated + standalone共10个实例，其中standalone联机桥接按产品边界跳过，预期9项实际运行。覆盖键盘/空白/非法/越界/小数、撤销重做、刷新、A4/重排的1512/390宽度、第二标签只读、桥接保存与当前access/epoch撤权。
- 恢复原独立审阅修订：浏览器夹具先初始化自动资源，生命骰保留2/5；撤权使用access目录及epoch；专项截图/trace加入CI失败和始终上传路径。现有CI矩阵增加本专项和既有valueTraceImmediate逐帧回归命令，未触发远端运行。
- 当前真实浏览器仍未执行成功：环境重新检查的结果见 `.local-evidence/recovery-browser-probe.log`。不以用例发现或单元通过称为布局/键盘/真实联机验收，没有截图。

本次未提交证据位于 `.local-evidence/`：`recovery-red.log`、`recovery-focused.log`、`recovery-full-test.log`、两份`recovery-*-build.log`、`recovery-browser-list.log`、`recovery-browser-probe.log`及启动边界日志。丢失前的日志未冒充当前证据。

## 已知边界

- native/linked完整保留偏移身份；只有旧schema的raw导入保留最终总值为人工覆盖，不重建独立偏移，与原技能路径一致。
- raw导入的历史人工覆盖限制为±10000。极端偏移与基础值相加超过此范围时raw重导入拒绝；native/linked仍正常。本轮不扩大旧格式导入界限。
- Suite旧fullscreen编辑器在它自身修改属性/熟练时，会重新计算旧schema豁免总值，并不读取新工作台独立偏移。这是原有手动总值兼容边界，本轮不改旧稳定插件。
- 最终精确提交的远端CI、实际A4/窄屏截图、真实枭熊多人/房间、实体手机和用户原卡仍待授权环境验证，未宣称正式发布或全部验收。
