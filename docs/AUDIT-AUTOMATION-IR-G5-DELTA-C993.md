**G5 所有权修复追加审计结论：不通过，runtime 不放行。**

冻结已核实为 **`c993bbd4b128012665e658ed9e1f5bad7b8286c3`**。本轮确认 **1 项未关闭 P1，未确认新增 P0 或 P2**：旧路径型资源账本虽然保留 `requiresReview=true`，但删除父职业后会失去对原持有实例的关联，仍然产生未经恢复的满额资源。

以下为完整技术复核报告，可原文入库。第六轮 CI 终态不包含在本次技术裁定中。

**一、对象、范围与执行边界**

| 项目 | 核实结果 |
|---|---|
| Web 目录 | `/workspace/dnd-automation-web` |
| Web 冻结 | `c993bbd4b128012665e658ed9e1f5bad7b8286c3` |
| 本轮比较基线 | `8c5d80355e619496b953a23ccfcbdc429f04dc64` |
| 数据目录 | `/workspace/dnd5e-automation-data` |
| 数据冻结 | `5f24e49380777d189fc4aefda712c780ac9bbc0f` |
| 工作树 | 审计开始及结束时，两仓 tracked 工作树均干净 |

本轮审查 `ownedResourceClaims`、旧键识别、歧义标记及新增生命周期测试，并回归此前 F1–F4、zero、D1–D4 和 D2-R1。未重新全面审查未变的数据产物。

未修改任何文件，未创建提交，未委派、未推送，未运行浏览器全套或共享目录构建。独立实验均在内存中执行。

**二、已经验证有效的修复**

三份此前入库审计报告中的原始脚本均在新冻结上原样执行，结果如下。

| 范围 | 实际结果 |
|---|---|
| F1 迁移溢出债务 | 复制及重载后仍保留 feature `spent5`、automatic `spent4`；升回原等级后余额均为零 |
| F2 资源身份 | 同规范身份改名不换键；原消费债务保留 |
| F3 纯求值、stackGroup、优先级 | 原对象不变；不支持的同组效果不执行；熟练加值优先级结果仍为 5 |
| F4 IR 导出 | 生命骰 8、物品重量 7、法术环阶及分类结果保持正确 |
| zero 重复设零 | 保留溢出债务，不通过零值维护恢复资源 |
| D1 三种同步路径 | class/card/batch × 开启/关闭六组均为 `max10/current0/spent10`，原卡不变 |
| D2 独立实例账本 | 两份旧独立账本分别保留 `5/0/spent5` 和 `5/3/spent2` |
| D3 隐藏及布局 | `beforeVisible=0、afterVisible=0`，新键保留隐藏和布局，旧键布局清除 |
| D4 0.3 交换 | 单件重量 7、数量 2、总重量 14；显式生命骰回归通过 |
| 原 D2-R1 卸装反例 | 两个方向重新装备后均无新 grant、无活动 feature 资源，旧归档回执仍存在 |

本轮新增十八项测试覆盖的 canonical 旧键暂停、重载及历史标记场景全部通过。

另独立执行了十组内存对照：canonical 旧键和更早的路径型旧键，分别经历两件物品同时卸装、取消同调、数量暂停、关闭整本来源、关闭自动化，再恢复并重载。十组均保持阻断和原 `spent5`。

还确认：

- `planFeatureResources` 在检查过程中不修改角色。
- 所有持有实例被移除后，已记录的归档债务和 `requiresReview=true` 仍保留。
- `requiresReview=false` 会被角色校验拒绝。
- 数量零仅作为协调中的瞬时边界验证；没有将其当成合法持久角色。

这些结果证明本次修复解决了原来的活动状态过滤漏洞，但尚未覆盖所有历史键编码。

**三、未关闭发现：D2-R2 · P1**

**更早的路径型旧账本在父职业删除后失去历史候选关联；歧义标记仍在，但不能阻止原候选物品获得满额资源。**

本项属于 D2-R1 修复尚未完整关闭的历史键边界，追加编号为 D2-R2。

文件位置：

- [featureResources.ts:16](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:16)：旧路径身份从当前父项及当前来源路径重新生成。
- [featureResources.ts:24](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:24)：`previousInstanceScope` 只识别 `feature-resource:ir-v1:` 编码。
- [featureResources.ts:62](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:62)：历史回执与当前重新生成的 claims 匹配。
- [featureResources.ts:65](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:65)、[:66](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:66)：即使已有 `requiresReview`，没有当前匹配项时仍直接跳过。
- [featureResources.ts:79](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:79)：更早的路径型回执依赖当前 `legacyKey` 或单个旧 `ownerId` 关联。
- [featureResources.ts:113](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:113)、[:114](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:114)：原候选失去回执关联后，以零债务创建满额资源。
- 实际生命周期入口：[sheet.ts:18](/workspace/dnd-automation-web/src/core/sheet.ts:18)、[:22](/workspace/dnd-automation-web/src/core/sheet.ts:22)。删除父项会保留已经交付的起始装备，并清除其 `parentId`。
- UI 删除入口：[App.tsx:151](/workspace/dnd-automation-web/src/ui/App.tsx:151)。

此次使用的旧键为：

```text
feature-resource:["row0","equipment:0:a:0"]:uses
```

这不是任意构造的未知格式。已只读核对 `29c2f23` 的资源代码，该版本通过 `sourceOwnerIdentity` 生成此类来源路径键；当前实现也将其作为 `legacyKey` 输出。

完整触发过程：

1. 职业 `row0` 下持有两件同身份物品 `row1`、`row2`，均带相同的 `equipment:0:a:0` 来源路径。
2. 保存旧路径型合并账本：`max5/current0/spent5`，旧 owner 为 `row2`。
3. 执行资源协调，正确识别两个候选并阻断，将旧回执保存为 `requiresReview=true`。
4. 通过实际 `removeSelection(c,'row0')` 删除父职业。已交付装备继续保留，父项关联被清除。
5. JSON 保存、重载并通过 `validateCharacter`。
6. 再次协调时，`row1` 的当前路径已变成自身实例路径，无法匹配原旧路径；它获得 **`max5/current5/spent0`**。

如果在删除父职业前还删除旧 owner `row2`，剩余 `row1` 同样获得满额资源，且所有歧义提示消失。旧归档中的 `spent5` 和 `requiresReview=true` 仍存在，但已经无法约束原候选实例。

独立对照结果：

| 旧键编码 | 删除操作 | 协调后的 feature 资源 | 歧义提示 |
|---|---|---|---|
| canonical | 仅删父职业 | 无新资源 | 保留两个候选提示 |
| canonical | 删旧 owner，再删父职业 | 无新资源 | 保留剩余候选提示 |
| **更早的路径型键** | **仅删父职业** | **row1：`5/5/spent0`** | 只剩 row2 提示 |
| **更早的路径型键** | **删旧 owner，再删父职业** | **row1：`5/5/spent0`** | **全部消失** |

上述过程没有休息、恢复、正数资源调整或新增物品。两件物品都是初次歧义检测时已经存在的持有实例。

同一编码缺口还有一个已验证表现：首次加载只剩一个持有实例时，canonical 旧键会被标记并阻断；更早的路径型键仍会自动迁移并删除旧回执：

```text
canonical:
grants=[]
oldArchivePresent=true
requiresReview=true

legacy-path:
grants=["row1"]
oldArchivePresent=false
row1 current=0, spent=5
```

后一结果本身没有立即补满，但不符合本次明确采用的“旧 class/path scope 不能证明历史归属，即使单件也阻断”契约。它与父项删除后授满属于同一历史键识别和关联缺口，本报告合并计为一项 P1。

新增测试 [automation-ir-g5-findings.test.ts:126](/workspace/dnd-automation-web/tests/automation-ir-g5-findings.test.ts:126) 使用的是 canonical `previousKey`；[:129](/workspace/dnd-automation-web/tests/automation-ir-g5-findings.test.ts:129) 验证特性冲突删除一个候选后保持标记。两者没有覆盖旧物品来源路径在实际删除父职业时发生变化的组合。

**四、完整只读复现命令**

以下命令仅使用内存角色和内存打包结果。四组主对照均调用应用实际的 `removeSelection`，不手工删除父项字段。

```bash
cd /workspace/dnd-automation-web
node --input-type=module <<'JS'
import {build} from '/workspace/dnd5e-automation-data/node_modules/esbuild/lib/main.js';

const source=String.raw`
import {newCharacter} from './src/core/model';
import {initializeAutomation} from './src/core/automation/state';
import {createIdentity} from './src/data/automation/identity';
import {validateCharacter} from './src/core/validation';
import {syncAutoResources} from './src/core/resources';
import {planFeatureResources} from './src/core/automation/featureResources';
import {removeSelection} from './src/core/sheet';

const entry=(kind,name,mechanics)=>({
  id:'audit:'+kind+':'+name,
  kind,name,english:name,packId:'kiwee',
  source:'XPHB',edition:'2024',revision:'1',
  entries:[],raw:{},automationVersion:'audit',
  automation:{
    identity:createIdentity({kind,source:'XPHB',engName:name}),
    edition:'2024',verdict:'automated',
    provenance:[{layer:'structured',ref:'audit-synthetic'}],
    mechanics,unsupported:[]
  }
});

const make=()=>{
  const cls=entry('class','Owner',{classModel:{hitDie:8}});
  const item=entry('item','Charges',{
    equipmentModel:{category:'other'},
    resources:[{
      key:'uses',
      max:{value:5},
      recovery:[{period:'long',amount:'all'}]
    }]
  });
  const c=newCharacter();
  initializeAutomation(c);
  c.selections=[cls,item,structuredClone(item)].map((entry,i)=>({
    id:'row'+i,entry,level:1,quantity:1,equipped:true,
    ...(i?{parentId:'row0',grantKey:'equipment:0:a:0'}:{})
  }));
  return c;
};

const snap=c=>({
  grants:planFeatureResources(c).grants.map(g=>g.ownerId),
  issues:planFeatureResources(c).issues.map(i=>i.selectionId),
  resources:Object.values(c.runtime.resources)
    .filter(r=>r.featureGrant)
    .map(r=>({
      owner:r.featureGrant.ownerId,
      current:r.current,
      spent:r.featureGrant.spent
    })),
  archive:Object.entries(c.runtime.featureResourceArchive||{})
    .map(([key,r])=>({
      key,
      owner:r.featureGrant.ownerId,
      spent:r.featureGrant.spent,
      review:r.featureGrant.requiresReview
    }))
});

for(const codec of ['canonical','legacy-path']){
  for(const deleteOwner of [false,true]){
    let c=make();
    const g=planFeatureResources(c).grants[0];
    const key=codec==='canonical'?g.previousKey:g.legacyKey;

    c.runtime.resources[key]={
      max:5,current:0,
      featureGrant:{
        ownerId:'row2',ruleMax:5,spent:5,
        recovery:{long:'all'},origin:'legacy'
      }
    };

    validateCharacter(c);
    syncAutoResources(c);
    console.log(
      'DETECTED',codec,deleteOwner,JSON.stringify(snap(c))
    );

    if(deleteOwner)removeSelection(c,'row2');
    removeSelection(c,'row0');

    c=validateCharacter(JSON.parse(JSON.stringify(c)));
    syncAutoResources(c);
    console.log(
      'PARENT_REMOVED',codec,deleteOwner,JSON.stringify(snap(c))
    );
  }
}

for(const codec of ['canonical','legacy-path']){
  const c=make();
  const g=planFeatureResources(c).grants[0];
  const key=codec==='canonical'?g.previousKey:g.legacyKey;

  c.runtime.resources[key]={
    max:5,current:0,
    featureGrant:{
      ownerId:'row2',ruleMax:5,spent:5,
      recovery:{long:'all'},origin:'legacy'
    }
  };

  c.selections.splice(2,1);
  validateCharacter(c);
  syncAutoResources(c);
  console.log(
    'SINGLE_AT_LOAD',codec,
    JSON.stringify({
      ...snap(c),
      oldArchivePresent:!!c.runtime.featureResourceArchive?.[key]
    })
  );
}
`;

const result=await build({
  stdin:{
    contents:source,
    resolveDir:process.cwd(),
    loader:'ts'
  },
  bundle:true,
  platform:'node',
  format:'esm',
  write:false,
  logLevel:'silent'
});

await import(
  'data:text/javascript;base64,'+
  Buffer.from(result.outputFiles[0].text).toString('base64')
);
JS
```

关键实际输出：

```text
PARENT_REMOVED legacy-path true

grants=["row1"]
issues=[]
resources=[{"owner":"row1","current":5,"spent":0}]

旧路径归档仍保留：
owner="row2"
spent=5
review=true
```

**五、回归命令、测试差异及原始统计**

三份既有脚本的原样复跑命令：

```bash
cd /workspace/dnd-automation-web
node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

for(const path of [
  'docs/AUDIT-AUTOMATION-IR-G5.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-FFA.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-8C5.md'
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

本轮独立聚焦验证：

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

实际结果：**7 文件，93 通过／0 跳过／0 失败**。

已核对的统计：

| 验证范围 | 通过／跳过／失败 | 证据性质 |
|---|---:|---|
| 审计员本轮七文件 | **93/0/0** | 本次独立执行 |
| 主实施者最终六文件 | **89/0/0** | `g5-ownership-focused-final.log` |
| 主实施者首次六文件 | **85/0/4** | `g5-ownership-focused.log`，失败保留 |
| Node 22 全套 | **862/25/0** | `g5-ownership-check22.log` |
| Node 24 全套 | **862/25/0** | `g5-ownership-check24.log` |

首次四项失败的原文是“角色条目数量或等级不合法”。最终测试先验证瞬时 `quantity=0` 时的阻断，再恢复合法数量后进行 JSON 校验与重载；卡片数量校验没有放宽。

相对 `8c5d803`，测试文件仅追加十八项。本轮未发现修改既有断言数值、skip、timeout 或 retry。`git diff --check` 通过。

Node 22/24 日志均包含 `tsc -b`、integrated 和 standalone 构建成功。两份单机审计 JSON 均为：

```text
singlePlayer=true
multiplayerModules=[]
```

上述构建由主实施者执行，本审计只读核对原日志。七文件、六文件、双 Node、独立内存实验均分别记录，不相加为新的通过总数。

**六、CI 与技术结论的边界**

本轮没有把任何前一冻结的成功 CI 计入 `c993bbd`。

- 第五轮 `37133385767` 属于 `8c5d803`。本次修复记录记载其十八项任务成功；该历史结果不能关闭本轮反例。
- 第六轮按本次任务回执正在启动，本报告没有取得并核对其完整终态。
- 本次技术结论已经是“不通过”，原因是独立复现的 P1，不是 CI 尚未结束。
- 后续第六轮全绿也不能单独关闭 D2-R2。
- 本报告不宣称 G5 放行，更不宣称 G6–G8 完成。

数据仓冻结未变。此前公开 CI 的 `287/11/0＋14/0/0` 沿用既有证据口径，十一项外部 oracle 跳过继续单列；本轮未重跑数据全套。

**七、附录 I 八项核对**

| 清单 | 本轮结果 |
|---|---|
| 1. 按职业／特性／物品名称执行分支 | 本次 runtime delta 未发现新增此类分支 |
| 2. 纯求值、资源不补发、spent 回放 | 纯计划及此前债务反例通过；**D2-R2 仍违反无恢复重新授予资源的不变量** |
| 3. 协议／覆盖层 CJK、正文及超过十五词引用 | 生产数据、协议及覆盖层未变，沿用此前审查；未把测试夹具计入生产覆盖 |
| 4. 断言、skip、timeout、retry | 未发现削弱既有契约；新增测试遗漏旧路径键与实际父项删除的组合 |
| 5. 2014／2024 身份隔离 | 身份协议未变，未发现本次新增跨版本合并 |
| 6. 0.3 与 standalone | D4 等既有回归通过；双 Node 单机审计 JSON 已核对 |
| 7. 原始统计 | 本轮独立验证、主实施者日志、历史 CI 和待补第六轮分别记录 |
| 8. 九条 DoD | 整体仍未达底线，具体边界如下 |

**八、§2.3 九条 DoD 边界**

未变项目沿用此前审计证据，本轮不将其包装成重新全面验证。

| DoD | 当前证据与边界 |
|---|---|
| 1. 协议、真实示例及反例 | 协议基础已有证据；示例的受限机制范围及 deferred 说明继续适用，不冒充生产覆盖 |
| 2. 完整流水线及版本锁 | 原报告所列覆盖层叠加、`unsupported.json` 版本锁、完整生产流水线 CI 缺口，本轮未关闭 |
| 3. 核心覆盖 | **未达**。生产 18,789 条口径未变，指定核心 6,396 条仍全部 `needsAnnotation`；test-only reviewed samples 不计入 |
| 4. 卡片接线 | 已有协议 3 与 IR 接线证据；资源历史关联仍有本轮 P1，runtime 不放行 |
| 5. 回归 | 本地统计、严格类型及构建证据已有；本冻结第六轮完整 CI 尚未独立核对 |
| 6. 解耦 | 沿用独立执行及共享 SHA 证据；十一项 oracle 跳过，以及原条文“一个身份模块”与十项共享文件的范围差异继续如实保留 |
| 7. 对外资料与草案 | 本轮不认定完成，属于后续阶段待办 |
| 8. 留痕 | 原不通过报告、修复记录、失败日志均保留；本报告供主实施者原文入库 |
| 9. 独立审计 | 本轮 G5 技术结论为**不通过**；G8 未完成 |

G6 未开展本身不构成本轮 G5 缺陷。整体 DoD 待办、CI 证据缺口与本次确定的 runtime P1 分开记录。

**最终裁定**

`c993bbd4b128012665e658ed9e1f5bad7b8286c3`：**不通过，runtime 不放行。**

原 D2-R1 的 canonical 卸装反例已纠正；所有权修复仍未覆盖更早的路径型旧账本。**D2-R2 · P1** 已通过合法角色、实际删除函数和 JSON 重载独立复现：历史标记与债务保留，但原候选关联丢失，导致无恢复授满。

F1–F4、zero、D1、D3、D4 在本轮范围内未发现回归。第六轮 CI 终态另行处理，不提前混称 G5 放行。
