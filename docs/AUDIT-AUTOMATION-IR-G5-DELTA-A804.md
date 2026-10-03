**G5 本轮技术复核结论：通过。**

冻结 **`a804d3be3a16558c874db43ce6e2332a2950ad8b`** 的 HB1、HB2 修复可以关闭；此前 F1–F4、zero、D1–D4、D2-R1、D2-R2 未发现回归。**本轮 G5 runtime／delta 范围内，未发现未关闭的 P0、P1、P2。**

**这不是 G5 最终放行。** 第八轮 CI `37139204468` 的完整终态仍须另行独立核对。本报告不宣称该 CI 已成功，也不宣称 G6–G8 或整体任务完成。

以下为完整技术审计原文，可单独入库；此前各冻结的“不通过”报告保持原结论。

**一、冻结对象与执行范围**

| 项目 | 核实结果 |
|---|---|
| Web 目录 | `/workspace/dnd-automation-web` |
| Web 冻结 | `a804d3be3a16558c874db43ce6e2332a2950ad8b` |
| 本轮比较基线 | `cc8ad07f1b120ae997eab691050c8c67dc808df0` |
| 数据目录 | `/workspace/dnd5e-automation-data` |
| 数据冻结 | `5f24e49380777d189fc4aefda712c780ac9bbc0f` |
| 工作树 | 两仓审计开始及结束时 tracked 工作树均干净 |

本轮审查旧五段 class-scope 回执兼容、身份归一与来源隔离、不支持协议的扫描门控及新增测试；原样复跑五份原审计脚本，并验证正常独立实例账本。

未修改文件、未创建提交、未委派、未推送，未运行浏览器全套或共享目录构建。独立实验使用内存角色及 `esbuild write:false`。

**二、HB1 · 原 P1：关闭**

问题：没有 `reviewKeys` 的旧五段 class-scope 孤立回执，在父职业和旧 owner 已删除后无法关联保留物品，加载时产生未经恢复的满额资源。

本轮相关位置：

- [featureResources.ts:17](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:17)：从已审阅 IR 保存物品的来源及英文身份作为旧回执候选信息。
- [featureResources.ts:88](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:88)：使用 NFKC、首尾空白、连续空白和大小写归一。
- [featureResources.ts:98](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:98)：五段旧键通过来源及英文身份建立待核对候选。
- [featureResources.ts:42](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:42)、[:52](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:52)：候选参与阻断，并持久保存到原回执的 `reviewKeys`。
- 回归：[automation-ir-g5-findings.test.ts:149](/workspace/dnd-automation-web/tests/automation-ir-g5-findings.test.ts:149)。

已原样执行上一份报告的前后版本对照脚本：先由 `c993` 资源实现通过实际删除函数生成存档，再交给当前冻结加载。

旧存档具有：

```text
旧键：
feature-resource:["row0","XPHB","XPHB","","Charges"]:uses

持有项：
row1，grantKey=equipment:0:a:0，无父职业

旧回执：
ownerId=row2
spent=5
requiresReview=true
没有 reviewKeys
```

当前冻结的实际结果：

```text
grants=[]
issues=["row1"]
resources=[]

旧回执：
spent=5
requiresReview=true
reviewKeys=[row1 的稳定实例资源键]
```

旧债务、回执及待核对提示保留，没有新授予次数。原脚本中全程使用当前版本执行删除的对照也保持阻断，并保留原两个候选。

五段匹配只形成待核对关系，不将“当前只剩一件”当作唯一历史归属证明，也没有从 `raw` 推断资源机制。

**三、HB2 · 原 P2：关闭**

问题：协议 2 角色允许保留未经 IR 3 校验的数据；新增历史扫描此前无条件遍历其中的 `mechanics.resources`，导致合法旧卡删除条目时抛错。

本轮相关位置：

- [featureResources.ts:19](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:19)、[:20](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:20)：全部持有扫描首先检查 `supportedAutomation`。
- [state.ts:7](/workspace/dnd-automation-web/src/core/automation/state.ts:7)：同时限定协议版本和规则版本。
- [validation.ts:92](/workspace/dnd-automation-web/src/core/validation.ts:92)、[:115](/workspace/dnd-automation-web/src/core/validation.ts:115)：协议 3 的 IR 输入校验保持。
- 回归：[automation-ir-g5-findings.test.ts:154](/workspace/dnd-automation-web/tests/automation-ir-g5-findings.test.ts:154)。

上一份报告中的同一协议 2 输入，保留：

```json
{
  "verdict": "automated",
  "mechanics": {
    "resources": {
      "key": "uses"
    }
  }
}
```

原样复跑结果：

```text
前版 c993：
validated=true
removed=true

当前 a804：
validated=true
removed=true
```

此前 `cc8` 的 `.map is not a function` 删除回归已消失。

新增回归还覆盖：

- 协议 2、未来协议 4、手动卡中的对象及字符串不透明字段；
- 协议 3、未知 `rulesVersion` 下的合法 IR 和已有归档债务；
- 删除后无关条目、资源、归档及自动化意图保持不变。

当前受支持协议即使暂停，仍会记录历史候选；门控没有退回到“只在自动化开启时记录”的旧漏洞。

**四、身份隔离、纯计划及正常账本补充验证**

除仓库测试外，独立执行十二组身份实验：

| 对照 | 结果 |
|---|---|
| 同来源、同身份，全角／大小写／多空白差异 | 正确归一，旧回执产生待核对候选并阻断 |
| PHB 旧回执与 XPHB 当前条目 | 不建立新增五段候选 |
| XPHB 旧回执与 PHB 当前条目 | 不建立新增五段候选 |
| 同来源但 IR 英文身份不同，`raw` 显示字段相似 | 不建立新增五段候选 |

上述四种情形分别使用 `uses`、`resource:0`、`charges:daily`，共十二组。每组均验证计划前后角色 JSON 不变；不同来源或身份的归档仍保留原 `spent5`，没有被迁移到当前条目。

另执行十二组正常独立账本实验：

- 旧物理实例键／canonical 物理实例键；
- 三种资源键；
- 自动化开启／暂停；
- 实际删除父职业，保留装备，再 JSON 重载并协调。

十二组均得到：

```text
row1: current=0, spent=7
row2: current=3, spent=2
```

两份正常账本均未被添加 `requiresReview` 或 `reviewKeys`。本轮未发现新增兼容匹配污染正常独立实例账本。

**五、此前发现的回归结果**

| 项目 | 本轮结果 |
|---|---|
| F1 迁移截断债务 | 保留 feature `spent5`、automatic `spent4`；升回原等级后余额仍为零 |
| F2 改名重授 | 同规范身份不换资源键，消费债务保留 |
| F3 纯求值、stackGroup、优先级 | 原对象不变，不支持的同组效果不执行，优先级结果仍为 5 |
| F4 IR 导出 | 生命骰、重量、法术环阶及分类保持正确 |
| zero 重复设零 | 不截断溢出债务 |
| D1 三种同步路径 | class/card/batch × 开启/关闭六组均为 `max10/current0/spent10` |
| D2 独立物品实例 | 两份旧独立账本分别保留 `5/0/spent5`、`5/3/spent2` |
| D3 布局与隐藏 | 原隐藏资源仍不可见，新键保留布局，旧布局键清除 |
| D4 0.3 显式字段 | 单件重量 7、数量 2、总重量 14；显式生命骰回归通过 |
| D2-R1 活动状态变化 | 两个卸装方向均保持阻断，旧归档回执保留 |
| D2-R2 实际删除路径 | canonical／旧路径编码删除父项及旧 owner 后均保持阻断；单持有项不自动迁移 |
| HB1、HB2 | 按第二、三部分关闭 |

五份原报告脚本均原样执行。最后一份脚本保留了 `CC8_LOADS_C993_SAVE`、`PROTOCOL2_CC8` 等历史输出标签；其中“当前模块”实际由本次工作树 `a804d3b` 编译，标签没有作为冻结身份使用。

**六、精确复现命令**

复跑五份原审计脚本，包含 HB1 的实际旧存档生成以及 HB2 的同输入对照：

```bash
cd /workspace/dnd-automation-web
git rev-parse HEAD

node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

for(const path of [
  'docs/AUDIT-AUTOMATION-IR-G5.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-FFA.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-8C5.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-C993.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-CC8.md'
]){
  const doc=readFileSync(path,'utf8');
  const start=doc.indexOf(
    "import {build} from '/workspace/dnd5e-automation-data/node_modules/esbuild/lib/main.js';"
  );
  const end=doc.indexOf('\nJS\n',start);
  if(start<0||end<0)throw Error('Missing exact harness '+path);

  console.log(path);
  console.log(execFileSync(process.execPath,['--input-type=module'],{
    input:doc.slice(start,end),
    encoding:'utf8'
  }));
}
JS
```

本轮独立七文件验证：

```bash
cd /workspace/dnd-automation-web
node node_modules/vitest/vitest.mjs run \
  tests/automation-ir-g5-findings.test.ts \
  tests/resources.test.ts \
  tests/classMigration.test.ts \
  tests/cardMigration.test.ts \
  tests/batchCardMigration.test.ts \
  tests/automation-ir-audit.test.ts \
  tests/transfers-feedback.test.ts \
  --no-cache --no-fsModuleCache --configLoader runner --reporter=dot
```

实际结果：

```text
Test Files  7 passed (7)
Tests       129 passed (129)
```

身份隔离和正常账本的独立内存实验：

```bash
cd /workspace/dnd-automation-web
node --input-type=module <<'JS'
import {build} from '/workspace/dnd5e-automation-data/node_modules/esbuild/lib/main.js';

const source=String.raw`
import assert from 'node:assert/strict';
import {newCharacter} from './src/core/model';
import {initializeAutomation} from './src/core/automation/state';
import {createIdentity} from './src/data/automation/identity';
import {validateCharacter} from './src/core/validation';
import {syncAutoResources} from './src/core/resources';
import {planFeatureResources} from './src/core/automation/featureResources';
import {removeSelection} from './src/core/sheet';

const entry=(kind,name,mechanics,source='XPHB')=>({
  id:'audit:'+kind+':'+source+':'+name,
  kind,name,english:name,packId:'kiwee',source,
  edition:source==='PHB'?'2014':'2024',
  revision:'1',entries:[],raw:{},automationVersion:'audit',
  automation:{
    identity:createIdentity({kind,source,engName:name}),
    edition:source==='PHB'?'2014':'2024',
    verdict:'automated',
    provenance:[{layer:'structured',ref:'audit-synthetic'}],
    mechanics,unsupported:[]
  }
});

const resources=key=>({
  equipmentModel:{category:'other'},
  resources:[{
    key,max:{value:5},
    recovery:[{period:'long',amount:'all'}]
  }]
});

const cases=[
  ['normalized','XPHB',' ＸＰＨＢ ',
    'Charges Once','  Ｃｈａｒｇｅｓ   Ｏｎｃｅ ',true],
  ['old2014-current2024','XPHB','PHB',
    'Charges Once','Charges Once',false],
  ['old2024-current2014','PHB','XPHB',
    'Charges Once','Charges Once',false],
  ['different-ir-name','XPHB','XPHB',
    'Other Charges','Charges Once',false]
];

let identityChecks=0;
for(const [label,currentSource,oldSource,currentName,oldName,blocked]
    of cases){
  for(const specKey of ['uses','resource:0','charges:daily']){
    const c=newCharacter(currentSource==='PHB'?'2014':'2024');
    initializeAutomation(c);
    const item=entry('item',currentName,resources(specKey),currentSource);
    item.raw={
      name:'Charges Once',
      ENG_name:'Charges Once',
      className:'Removed'
    };
    c.selections=[{
      id:'owned',entry:item,level:1,quantity:1,equipped:true,
      grantKey:'equipment:0:a:0'
    }];

    const slot=specKey==='resource:0'?'0':specKey;
    const key='feature-resource:'+
      JSON.stringify(['removed-parent',oldSource,'XPHB','',oldName])+
      ':'+slot;

    c.runtime.featureResourceArchive={
      [key]:{
        max:5,current:0,
        featureGrant:{
          ownerId:'removed-owner',ruleMax:5,spent:5,
          requiresReview:true,recovery:{long:'all'},
          origin:'old five-part'
        }
      }
    };

    validateCharacter(c);
    const before=JSON.stringify(c);
    const plan=planFeatureResources(c);
    assert.equal(JSON.stringify(c),before);
    assert.equal(plan.grants.length,blocked?0:1,label);

    syncAutoResources(c);
    const ledger=c.runtime.featureResourceArchive[key].featureGrant;
    assert.equal(ledger.spent,5);
    assert.equal(ledger.reviewKeys?.length||0,blocked?1:0,label);
    assert.equal(
      Object.values(c.runtime.resources).filter(r=>r.featureGrant).length,
      blocked?0:1,label
    );
    identityChecks++;
  }
}
console.log('IDENTITY_ISOLATION_AND_PURITY',{
  cases:identityChecks,passed:identityChecks
});

let normalChecks=0;
for(const specKey of ['uses','resource:0','charges:daily']){
  for(const codec of ['physical','canonical']){
    for(const enabled of [true,false]){
      let c=newCharacter();
      initializeAutomation(c);
      const cls=entry('class','Owner',{classModel:{hitDie:8}});
      const item=entry('item','Charges',resources(specKey));
      c.selections=[cls,item,structuredClone(item)].map((entry,i)=>({
        id:'row'+i,entry,level:1,quantity:1,equipped:true,
        ...(i?{parentId:'row0',grantKey:'equipment:0:a:0'}:{})
      }));

      const grants=planFeatureResources(c).grants;
      c.runtime.featureResourceArchive={};
      for(const g of grants){
        const key=codec==='canonical'
          ?g.key
          :'feature-resource:'+JSON.stringify([g.ownerId])+':'+g.slot;
        const r={
          max:5,current:g.ownerId==='row1'?0:3,
          featureGrant:{
            ownerId:g.ownerId,ruleMax:5,
            spent:g.ownerId==='row1'?7:2,
            recovery:{long:'all'},origin:'independent'
          }
        };
        c.runtime.resources[key]=structuredClone(r);
        c.runtime.featureResourceArchive[key]=structuredClone(r);
      }

      c.automation.enabled=enabled;
      removeSelection(c,'row0');
      c=validateCharacter(JSON.parse(JSON.stringify(c)));
      c.automation.enabled=true;
      syncAutoResources(c);

      assert.equal(planFeatureResources(c).grants.length,2);
      const balances=Object.values(c.runtime.resources)
        .filter(r=>r.featureGrant)
        .sort((a,b)=>
          a.featureGrant.ownerId.localeCompare(b.featureGrant.ownerId)
        );
      assert.deepEqual(
        balances.map(r=>[r.current,r.featureGrant.spent]),
        [[0,7],[3,2]]
      );
      assert(balances.every(r=>
        r.featureGrant.requiresReview===undefined &&
        r.featureGrant.reviewKeys===undefined
      ));
      normalChecks++;
    }
  }
}
console.log('NORMAL_INDEPENDENT_LEDGERS',{
  cases:normalChecks,passed:normalChecks,
  overflowSpent:7,positiveBalance:3
});
`;

const result=await build({
  stdin:{
    contents:source,
    resolveDir:process.cwd(),
    loader:'ts'
  },
  bundle:true,platform:'node',format:'esm',
  write:false,logLevel:'silent'
});

await import(
  'data:text/javascript;base64,'+
  Buffer.from(result.outputFiles[0].text).toString('base64')
);
JS
```

本次实际结果：身份实验 **12/12**，正常账本实验 **12/12**，均无断言失败。

**七、测试差异与真实统计**

相对 `cc8`，新增十六项回归，findings 文件共七十四项。未发现修改既有断言数值、skip、timeout 或 retry；`git diff --check` 通过。

已核对原始日志：

| 范围 | 通过／跳过／失败 | 证据 |
|---|---:|---|
| 审计员本轮七文件 | **129/0/0** | 独立执行 |
| 主实施者最终七文件 | **129/0/0** | `g5-history-compatibility-focused-final.log` |
| 主实施者首次七文件 | **127/0/2** | `g5-history-compatibility-focused.log` |
| Node 22 最终全套 | **898/25/0** | `g5-history-compatibility-check22.log` |
| Node 24 最终全套 | **898/25/0** | `g5-history-compatibility-check24.log` |

首次两项失败均为 `futureRules` 用例的 IR 输入校验失败。最终夹具提供合法装备机制和合法资源声明后继续验证未知规则版本不修改历史；没有修改协议 3 校验来容纳非法记录。

身份归一之前的通过日志以 `preidentity-normalization` 单独保留，本报告使用最终日志，不用中间结果替代最终冻结验证。

Node 22/24 最终日志均包含：

- `tsc -b` 成功；
- integrated 构建成功；
- standalone 构建成功；
- 审计 JSON：`singlePlayer=true`、`multiplayerModules=[]`。

构建由主实施者执行，本审计只读核对。不同 Node、不同执行者和内存实验分别记录，不累加为新的测试总数。

**八、CI 与本次技术结论的分界**

第七轮 `37137878357` 属于 `cc8`。按本次用户回执及修复记录，十八项任务成功；该结果不计为 `a804` 的 CI，也不改写 `cc8` 的技术不通过结论。

第八轮 `37139204468` 属于本次新冻结。本报告没有独立核对其完整终态，因此：

- **本轮技术审计通过。**
- **第八轮完整 CI 尚待独立核对。**
- **G5 最终闸门尚未在本报告中放行。**

后续应对同一冻结的完整任务终态及逐命令原始统计单独形成 CI 补充，保留本技术报告全文。

**九、附录 I 八项核对**

| 清单 | 本轮结论 |
|---|---|
| 1. 职业／特性／物品名称执行分支 | 未发现新增此类分支；新增英文身份比较用于旧消费回执候选关联，不选择或推断机制 |
| 2. 纯求值、资源不补发、spent 回放 | 原反例全部保持纠正；新增纯计划、身份及正常账本实验通过 |
| 3. 协议／覆盖层 CJK、正文与长引用 | 生产协议及数据未变，沿用此前审查；测试夹具不计生产覆盖 |
| 4. 断言、skip、timeout、retry | 未发现削弱既有契约；首次失败及修正后的真实统计保留 |
| 5. 2014／2024 身份隔离 | 新增旧键匹配未串联 PHB／XPHB 对照；规范身份协议未改 |
| 6. 0.3 与 standalone | 既有导出回归保持，双 Node 单机审计已核对；HB2 旧协议删除回归关闭 |
| 7. 原始统计 | 独立执行、本地日志、中间失败、历史 CI 和待核新 CI 分开记录 |
| 8. 九条 DoD | 本轮技术项通过，整体最终交付仍有后续边界，见下表 |

**十、§2.3 九条 DoD 边界**

未变项目沿用此前审计证据，本轮不冒充重新全面验证。

| DoD | 当前状态 |
|---|---|
| 1. 协议、示例与反例 | 协议基础已有证据；示例受限机制范围与 deferred 说明继续适用，不冒充生产自动化覆盖 |
| 2. 完整流水线及版本锁 | 原报告列明的覆盖层叠加、`unsupported.json` 版本锁及完整生产流水线 CI 待办，本轮未关闭 |
| 3. 核心覆盖 | **整体交付尚未达到此条**。生产 18,789 条口径未变，指定核心 6,396 条仍全部 `needsAnnotation`；test-only samples 不计覆盖 |
| 4. 卡片接线 | 本轮涉及的 runtime 兼容及债务发现已关闭；此前 IR 接线证据沿用 |
| 5. 回归 | 本地严格类型、构建、单机审计及统计已有；同冻结第八轮完整 CI 仍待独立核对 |
| 6. 解耦 | 沿用独立执行与共享 SHA 证据；十一项外部 oracle 跳过及此前记载的共享模块范围差异继续保留 |
| 7. 对外材料与草案 | 本轮不认定完成，属于后续阶段待办 |
| 8. 留痕 | 原失败报告与日志保留；本次通过报告供主实施者原文入库 |
| 9. 独立审计 | **本轮 G5 技术复核通过**；G5 最终 CI 证据尚待补核，G8 未完成 |

G6 尚未开展、核心标注及其他后续阶段未完成，不被列为本轮 G5 runtime 技术缺陷；它们仍限制“整体任务完成”的表述。

**最终裁定**

对 **`a804d3be3a16558c874db43ce6e2332a2950ad8b`**：

- **技术复核：通过。**
- **HB1、HB2：关闭。**
- **本轮范围未关闭 P0/P1/P2：0 项。**
- **G5 最终放行：待第八轮 CI `37139204468` 完整终态独立核对。**

本结论仅适用于上述冻结及本报告所述范围，不改写任何旧冻结结论，不宣称 G6–G8 或整体任务完成。
