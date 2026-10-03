以下完整重发最新技术追加报告正文，保留报告出具时的 CI 快照和“不通过”结论；不再附历史 CI 补充。本次未重新审计、未调用工具、未修改文件。

---

**G5 修复追加只读审计报告 · 冻结 `ffa8d58`**

**结论：不通过，runtime 不放行。** 原 F1–F4 的具体反例及追加的零值维护反例均已纠正，但本轮确认仍有 **1 项 P1、3 项 P2**。未发现 P0。这些技术问题独立于 CI；新冻结完整 CI 尚待补齐，不能以旧冻结的成功结果代替。

本报告追加于原正式审计报告之后，不改写 `29c2f23` 的原“不通过”结论，也不宣称 G6–G8 完成。

**一、范围与验证结果**

最终对象：

- Web：`/workspace/dnd-automation-g5-zero`，**`ffa8d58811d46dbbb6cb4f82b461d63115ac227a`**。
- 延续审阅：`29c2f23 → 8ad78e6 → ffa8d58`，没有重头审查整个项目。
- 原 Web 工作树保持 `8ad78e6c7b8574d2c4e295ccd674f74463aa68fc`。
- 数据冻结保持 `5f24e49380777d189fc4aefda712c780ac9bbc0f`。
- 本审计未修改文件、未实现修复、未委派、未推送，未运行浏览器或构建。

审计员实际执行：

| 验证 | 结果 |
|---|---|
| 从已入库原报告提取并原样运行 F1–F4 内存脚本 | 四个原反例均纠正 |
| 零值维护、修改图标后保存零值、JSON 重载及升级 | 债务保持 `5/4`，升级后当前次数均为 `0` |
| 七文件聚焦回归 | **67 通过／0 跳过／0 失败** |
| 本文新增边界反例 | 确认 D1–D4 |
| `git diff --check 29c2f23 HEAD` | 通过 |

七文件包括：

```text
tests/automation-ir-g5-findings.test.ts
tests/resources.test.ts
tests/classMigration.test.ts
tests/cardMigration.test.ts
tests/batchCardMigration.test.ts
tests/automation-ir-audit.test.ts
tests/transfers-feedback.test.ts
```

原发现的修复核对：

| 原发现 | 本次核对 |
|---|---|
| F1 同步副本截断溢出债务 | 原反例已纠正；enabled 的 class/card/batch 及 disabled-batch 均通过。关闭自动化的 class/card 仍有 D1。 |
| F2 显示短名导致资源换键 | 原反例已纠正，规范身份不变时新键稳定。唯一旧账本迁移、归档回放和所测歧义阻断通过；新键引入 D2、D3。 |
| F3 熟练加值 stackGroup／priority | 已纠正。grouped 熟练加值为 `2`，优先级案例为 `5`，`@prof` 消费结果一致，求值未修改角色。 |
| F4 IR 数据的 0.3 导出 | 原反例已纠正：生命骰面数 `8`、重量 `7`、三级法术保留；`manualSpellLevel` 生效。旧 0.3 输入的再次导出存在 D4。 |
| 追加零值维护漏洞 | **已纠正。** `setResource(...,0)` 保留溢出债务；feature、automatic、pact pool 归档一致。明确正值恢复及休息仍能降低债务。 |
| F5 尾随空白 | 已纠正。 |

**二、仍存在的技术发现**

**D1 · P1：关闭自动化后的职业／整卡同步，重新启用时补资源**

位置：

- [src/core/classMigration.ts:79](/workspace/dnd-automation-g5-zero/src/core/classMigration.ts:79)、[:83](/workspace/dnd-automation-g5-zero/src/core/classMigration.ts:83)
- [src/core/cardMigration.ts:158](/workspace/dnd-automation-g5-zero/src/core/cardMigration.ts:158)、[:159](/workspace/dnd-automation-g5-zero/src/core/cardMigration.ts:159)
- [src/core/resources.ts:11](/workspace/dnd-automation-g5-zero/src/core/resources.ts:11)、[:52](/workspace/dnd-automation-g5-zero/src/core/resources.ts:52)
- 对照已处理的 [src/core/batchCardMigration.ts:128](/workspace/dnd-automation-g5-zero/src/core/batchCardMigration.ts:128)。

触发路径：

1. 同身份职业拥有上限 5 的资源，耗尽为 `0/5，spent=5`。
2. 关闭自动化。
3. 显式同步同身份、不同 revision 的资料，新声明上限为 10。
4. 保存重载，再启用自动化。

职业同步和整卡同步因自动化关闭而跳过资源协调；`preserveMigrationResources` 处理的仍是旧上限。启用后新上限生效，旧债务仅为 5，于是得到 **`5/10`**，期间没有恢复或休息。

独立运行结果：

| 自动化状态 | 同步路径 | 同步后／启用前 | 重载启用后 |
|---|---|---|---|
| 开启 | class | `10/0/spent10` | `10/0/spent10` |
| 开启 | card | `10/0/spent10` | `10/0/spent10` |
| 开启 | batch | `10/0/spent10` | `10/0/spent10` |
| **关闭** | **class** | `5/0/spent5` | **`10/5/spent5`** |
| **关闭** | **card** | `5/0/spent5` | **`10/5/spent5`** |
| 关闭 | batch | `10/0/spent10` | `10/0/spent10` |

所有样本通过角色校验，原卡未修改。零值维护修复不会关闭这条路径，因为这里没有降低旧债务，而是同步时没有建立与新上限对应的消费状态。

复现：下文统一命令的 `MIGRATION` 输出。

**D2 · P2：同一职业下的不同物品实例，被合并为一个资源计数器**

位置：

- [src/core/automation/featureResources.ts:32](/workspace/dnd-automation-g5-zero/src/core/automation/featureResources.ts:32)
- [src/core/automation/featureResources.ts:38](/workspace/dnd-automation-g5-zero/src/core/automation/featureResources.ts:38)
- [src/core/automation/featureResources.ts:40](/workspace/dnd-automation-g5-zero/src/core/automation/featureResources.ts:40)

新资源身份对所有能找到父职业的条目都使用：

```text
[父职业 selection ID, 规范 identity.key]
```

因此，同一职业下两件同身份、不同 selection ID 的物品实例会产生相同资源键。随后按相同键去重，只保留一个 grant。

已用同一有效输入对照 `29c2f23` 和新实现：

```text
旧账本：
row1：max5/current0/spent5
row2：max5/current3/spent2
```

| 冻结 | grant 数量 | 协调后活动资源 |
|---|---:|---|
| `29c2f23` | 2 | row1 `0/5`；row2 `3/5` |
| `8ad78e6`、`ffa8d58` | **1** | 仅 row2 `3/5` |

旧 row1 债务仍可能留在归档中，但不再对应独立的活动资源。这里丢失的是物品实例之间的消费所有权，不能以“规范条目身份相同”视为同一份资源。

复现：下文统一命令的 `ITEMS` 输出。

**D3 · P2：旧资源键迁移未迁移隐藏及布局引用，用户隐藏的资源重新出现**

位置：

- [src/core/automation/featureResources.ts:75](/workspace/dnd-automation-g5-zero/src/core/automation/featureResources.ts:75)、[:76](/workspace/dnd-automation-g5-zero/src/core/automation/featureResources.ts:76)
- 消费端：[src/core/resourceWidgets.ts:185](/workspace/dnd-automation-g5-zero/src/core/resourceWidgets.ts:185)、[:219](/workspace/dnd-automation-g5-zero/src/core/resourceWidgets.ts:219)。

迁移新建 canonical 资源键并删除旧键，但 `quickbarLayout.hidden`、`order`、`widgets` 仍引用旧键。资源内部的 icon/order 保留，并不等于外部布局引用得到迁移。

对照结果：

```text
29c2f23：
beforeVisible=0
afterVisible=0
newKeyIsHidden=true
newKeyHasLayout=true

ffa8d58：
beforeVisible=0
afterVisible=1
newKeyIsHidden=false
newKeyHasLayout=false
oldKeyStillHasLayout=true
```

影响：同步之后，用户隐藏的资源重新出现在资源画布；原布局仍挂在已经不存在的旧资源键上。该结果由实际画布行筛选函数验证，本审计没有以浏览器截图代替或扩大此证据。

复现：下文统一命令的 `LAYOUT` 输出。

**D4 · P2：合法 0.3 输入的单件重量，在导入后再次导出时丢失**

位置：

- 导入：[src/core/validation.ts:237](/workspace/dnd-automation-g5-zero/src/core/validation.ts:237)
- 导出：[src/core/export.ts:35](/workspace/dnd-automation-g5-zero/src/core/export.ts:35)。

`importOwlbear` 将输入中明确提供的单件重量保存到条目 `raw.weight`，但没有产生对应的 IR／显式手动重量声明；修改后的导出只读取 IR，导致同一条交换链路不再保留原重量。

输入为合法 0.3 物品：重量 `7`、数量 `2`。

| 冻结 | 导入保存的重量 | 再次导出的单件重量 |
|---|---:|---:|
| `29c2f23` | 7 | 7 |
| `8ad78e6`、`ffa8d58` | 7 | **null** |

这是保留明确交换字段的问题，不涉及从上游正文推断机制。重量仍在原生角色快照里，但再次输出的 0.3 物品字段已经丢失。

该样本的 `total_weight` 在两版均为 0，属于此前已有的边界；本项新增回归仅指 **单件重量由 7 变为 null**，没有把旧问题错误归因于此次补丁。

复现：下文统一命令的 `EXCHANGE` 输出。

**三、测试、证据与 CI 边界**

本轮测试差异审查结果：

- `8ad78e6` 新增 10 项回归；`ffa8d58` 再新增 2 项零值维护／pact pool 回归。
- `transfers-feedback.test.ts` 只给自创手动法术增加 `manualSpellLevel=1`，原来源分离、预备／已知数组、快照及原对象断言保留。
- 未发现修改既有断言数值、skip、timeout 或 retry 来通过本次修复。
- `ffa8d58` 新增零值判断适用于资源编辑器保存零值的真实调用路径；审计内存实验也加入了修改图标后再保存零值的操作。

已核对日志：

| 范围 | 通过／跳过／失败 | 说明 |
|---|---|---|
| 审计员在 `ffa8d58` 的七文件聚焦验证 | **67/0/0** | 本次实际执行 |
| 主实施者 `ffa8d58` Node 22 全套 | **836/25/0** | `g5-zero-check22.log` |
| 主实施者 `ffa8d58` Node 24 全套 | **836/25/0** | `g5-zero-check24.log` |
| `8ad78e6` 真实资料五文件组合 | **68/0/0** | `g5-findings-actual.log`，不冒充此前另一组合的 76 项 |
| `8ad78e6` Node 22／24 单机审计 | `singlePlayer=true`、`multiplayerModules=[]` | 两份原始 JSON 已核对 |

`ffa8d58` 的严格类型、双构建、单机审计成功属于主实施者提供的验证回执；审计员未重复执行构建。

CI 分开记录：

- `29c2f23` 的第二轮 `37127675320`：此前已独立确认 verify＋17 个浏览器组全部成功，原文补充附后。
- `8ad78e6` 的第三轮 `37130672023`：本轮最后收到的主实施者回执仍有最后一组运行中，不能写成完整终态成功。
- **`ffa8d58` 尚未取得其自身完整 18 个任务的 CI 终态证据。**
- 数据公开候选及 main 的 `287/11/0＋14/0/0` 按用户提供回执记录；11 项外部 oracle 跳过不能写成无跳过。

即使后续 `ffa8d58` CI 全绿，D1–D4 仍需修复并独立复核。当前不满足 runtime 放行条件，G5 不放行，G6 不进入。

**四、完整只读复现命令**

以下命令在最终工作树运行；全部角色和打包结果仅存在于内存，不写文件、不启动服务。`ZERO` 是已修复对照，其余输出对应 D1–D4。

```bash
cd /workspace/dnd-automation-g5-zero
node --input-type=module <<'JS'
import {build} from '/workspace/dnd5e-automation-data/node_modules/esbuild/lib/main.js';

const source=String.raw`
import {newCharacter} from './src/core/model';
import {initializeAutomation} from './src/core/automation/state';
import {createIdentity} from './src/data/automation/identity';
import {validateCharacter,importOwlbear} from './src/core/validation';
import {evaluate} from './src/core/engine';
import {exportOwlbear} from './src/core/export';
import {syncAutoResources,setResource} from './src/core/resources';
import {planFeatureResources} from './src/core/automation/featureResources';
import {planClassMigration} from './src/core/classMigration';
import {planCardMigration,emptyMigrationChoices} from './src/core/cardMigration';
import {planBatchCardMigration} from './src/core/batchCardMigration';
import {resourceCanvasRows,normalizeWidget} from './src/core/resourceWidgets';

const entry=(kind,name,mechanics)=>({
  id:'audit:'+kind+':'+name,kind,name,english:name,packId:'kiwee',
  source:'XPHB',edition:'2024',revision:'1',entries:[],raw:{},
  automationVersion:'audit',
  automation:{
    identity:createIdentity({kind,source:'XPHB',engName:name}),
    edition:'2024',verdict:'automated',
    provenance:[{layer:'structured',ref:'audit-synthetic'}],
    mechanics,unsupported:[]
  }
});
const card=entries=>{
  const c=newCharacter();initializeAutomation(c);
  c.selections=entries.map((entry,i)=>({
    id:'row'+i,entry,level:1,quantity:1,equipped:true
  }));
  return c;
};
const resources=max=>({
  resources:[{
    key:'uses',max,recovery:[{period:'long',amount:'all'}]
  }]
});
const cls=max=>entry('class','Audit class',{
  classModel:{hitDie:8,casterProgression:'full'},...resources(max)
});
const balance=r=>({
  max:r.max,current:r.current,
  spent:r.featureGrant?.spent??r.automaticSpent
});
const replay=c=>validateCharacter(JSON.parse(JSON.stringify(c)));

{
  const c=card([cls({formula:'@class.level'})]);
  c.selections[0].level=5;
  syncAutoResources(c);
  const key=planFeatureResources(c).grants[0].key;
  setResource(c,key,0);
  setResource(c,'spell-slot:1',0);
  c.selections[0].level=1;
  syncAutoResources(c);
  validateCharacter(c);
  c.runtime.resources[key].icon='star';
  setResource(c,key,0);
  setResource(c,'spell-slot:1',0);
  const before=[
    balance(c.runtime.resources[key]),
    balance(c.runtime.resources['spell-slot:1'])
  ];
  const restored=replay(c);
  restored.selections[0].level=5;
  syncAutoResources(restored);
  validateCharacter(restored);
  console.log('ZERO',JSON.stringify({
    afterZero:before,
    afterRaise:[
      balance(restored.runtime.resources[key]),
      balance(restored.runtime.resources['spell-slot:1'])
    ]
  }));
}

for(const enabled of [true,false])
for(const mode of ['class','card','batch']){
  const e=cls({value:5}),c=card([e]);
  syncAutoResources(c);
  const key=planFeatureResources(c).grants[0].key;
  setResource(c,key,0);
  c.automation.enabled=enabled;
  validateCharacter(c);
  const before=JSON.stringify(c);
  const newer=structuredClone(e);
  newer.revision='2';
  newer.automation.mechanics.resources[0].max={value:10};
  const choices=emptyMigrationChoices();
  choices.roots={row0:e.id};
  const identity={id:'audit-copy',now:'2026-10-03T00:00:00Z'};
  const copy=mode==='class'
    ?planClassMigration(c,[newer],choices.roots,identity).card
    :mode==='card'
      ?planCardMigration(c,[newer],choices,identity).card
      :planBatchCardMigration(c,[newer],choices.roots,{},identity).plan.card;
  const beforeEnable=balance(copy.runtime.resources[key]);
  const restored=replay(copy);
  restored.automation.enabled=true;
  syncAutoResources(restored);
  validateCharacter(restored);
  console.log('MIGRATION',JSON.stringify({
    mode,enabled,
    originalUnchanged:before===JSON.stringify(c),
    beforeEnable,
    afterEnable:balance(restored.runtime.resources[key])
  }));
}

const receipt=(ownerId,current)=>({
  name:'Audit counter',max:5,current,
  featureGrant:{
    ownerId,ruleMax:5,spent:5-current,
    recovery:{long:'all'},origin:'audit'
  }
});

{
  const c=card([entry('class','Audit class',{
    classModel:{hitDie:8},...resources({value:5})
  })]);
  const legacy='feature-resource:'+JSON.stringify(['row0'])+':uses';
  c.runtime.resources[legacy]=receipt('row0',2);
  c.runtime.featureResourceArchive={
    [legacy]:structuredClone(c.runtime.resources[legacy])
  };
  c.quickbarLayout={
    order:['resource:'+legacy],
    hidden:['resource:'+legacy],
    widgets:{
      [legacy]:normalizeWidget({page:2,x:6,y:2,w:4,h:2})
    }
  };
  validateCharacter(c);
  const beforeVisible=resourceCanvasRows(c).length;
  syncAutoResources(c);
  validateCharacter(c);
  const key=planFeatureResources(c).grants[0].key;
  console.log('LAYOUT',JSON.stringify({
    beforeVisible,
    afterVisible:resourceCanvasRows(c).length,
    newKeyIsHidden:c.quickbarLayout.hidden.includes('resource:'+key),
    newKeyHasLayout:!!c.quickbarLayout.widgets[key],
    oldKeyStillHasLayout:!!c.quickbarLayout.widgets[legacy]
  }));
}

{
  const owner=entry('class','Audit class',{classModel:{hitDie:8}});
  const item=entry('item','Audit item',{
    equipmentModel:{category:'other'},...resources({value:5})
  });
  const c=card([owner,item,structuredClone(item)]);
  c.selections[1].parentId=c.selections[2].parentId='row0';
  for(const [id,current]of [['row1',0],['row2',3]]){
    const key='feature-resource:'+JSON.stringify([id])+':uses';
    c.runtime.resources[key]=receipt(id,current);
    (c.runtime.featureResourceArchive||={})[key]=
      structuredClone(c.runtime.resources[key]);
  }
  validateCharacter(c);
  const before=Object.values(c.runtime.resources)
    .filter(r=>r.featureGrant)
    .map(r=>({owner:r.featureGrant.ownerId,...balance(r)}));
  syncAutoResources(c);
  validateCharacter(c);
  console.log('ITEMS',JSON.stringify({
    before,
    grantCount:planFeatureResources(c).grants.length,
    after:Object.values(c.runtime.resources)
      .filter(r=>r.featureGrant)
      .map(r=>({owner:r.featureGrant.ownerId,...balance(r)}))
  }));
}

{
  const input={
    schema_version:'0.3',
    identity:{character_name:'Audit exchange'},
    abilities:Object.fromEntries(
      ['str','dex','con','int','wis','cha'].map(a=>[a,{total:10}])
    ),
    inventory:{
      items:[{name:'Audit item',weight:7,quantity:2,equipped:false}],
      coins:{},total_weight:14
    }
  };
  const c=importOwlbear(input),out=exportOwlbear(c,evaluate(c));
  console.log('EXCHANGE',JSON.stringify({
    schema:out.schema_version,
    importedRawWeight:c.selections[0].entry.raw.weight,
    quantity:out.inventory.items[0].quantity,
    exportedItemWeight:out.inventory.items[0].weight,
    totalWeight:out.inventory.total_weight
  }));
}
`;

const r=await build({
  stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},
  bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'
});
await import(
  'data:text/javascript;base64,'+
  Buffer.from(r.outputFiles[0].text).toString('base64')
);
JS
```

聚焦回归命令：

```bash
cd /workspace/dnd-automation-g5-zero
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
