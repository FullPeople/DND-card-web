# G5 HB1 / HB2：旧五段账本与协议保留边界

不同模型对 `cc8ad07f1b120ae997eab691050c8c67dc808df0` 复核仍不通过，
原文保存在 [审计](AUDIT-AUTOMATION-IR-G5-DELTA-CC8.md)。
第七轮 [CI37137878357](https://github.com/FullPeople/DND-card-web/actions/runs/37137878357)
最终18/18任务success，不能代替技术问题关闭。

HB1（P1）：前版实际生成的孤立旧存档没有 reviewKeys。五段 class-scope 回执
末段是英文条目名，不能用 grantKey 尾段补偿；父职业和 owner 已删除后仍会授满。
主实施者增加旧五段格式候选匹配，使用已审阅 IR 的来源与英文身份，遵循身份的
NFKC/大小写/空白归一，不读取 raw 推断机制。该关系只产生待核对候选，不证明
唯一归属，因此同源同身份的未知历史仍保留债务、标记、归档及提示。

HB2（P2）：删除条目前无条件扫描条目 IR，旧协议保留的不透明 resources 对象
会在 `.map` 处抛错。全部持有扫描现以 supportedAutomation 门控，暂停的当前协议
仍记录历史；协议2、未来协议、未知 rulesVersion、未启用协议的手动卡均保留其
原数据，不扫描不受当前规则支持的 IR。没有放宽协议3的条目输入校验。

新增16项回归：旧五段回执标记有无 × owner已删除与否 × 开启/暂停八组，以及
旧协议2/未来4/手动卡的不透明字段六组、当前协议未知规则版本下合法IR和既有
债务的两组。发现文件共74项。首次129项中2项失败：未知规则版本仍受协议3
输入校验，测试中无关保留条目的空 automated mechanics 非法。补为合法equipment
mechanics，使用合法IR资源验证未知规则版本不修改历史；没有弱化校验或断言。
首次127/0/2及所有后续日志保留。

```text
定向七文件：129 passed / 0 skipped / 0 failed
Node22.12全套：898 passed / 25 skipped / 0 failed
Node24全套：898 passed / 25 skipped / 0 failed
严格类型与integrated / standalone构建：exit0
两份单机审计：singlePlayer=true，multiplayerModules=[]
五份原审计反例脚本：exit0
当前代码加载c993实际旧存档：grants=[]，issues=[row1]，resources=[]，spent5保留
协议2同一旧输入删除：validated=true，removed=true
```

原始证据 `evidence/automation-ir/g5-history-compatibility-*`。身份空白归一前的通过
日志另存 preidentity-normalization，不覆盖此前失败。所有既有断言、skip、timeout、
retry保持原契约。数据仓5f24e49与生产产物未改变。新冻结仍须第八轮完整CI和独立
复核；G5未放行，G6未开始，核心6396待标注不变。

回滚点 `automation-g5-history-bindings-fix-20261003`，新提交可反转；原卡、原G0工作区、
Web main、线上与玩家数据保持原状态。
