**G5 历史绑定修复技术复核：不通过，runtime 不放行。**

冻结已核实为 **`cc8ad07f1b120ae997eab691050c8c67dc808df0`**。本轮确认 **1 项 P1、1 项 P2，未确认 P0**。

四份原审计脚本及七文件 **113/0/0** 均通过；原 D2-R2 所列删除反例已纠正。但仍存在旧五段 class-scope 孤立回执加载后授满，以及协议 2 条目删除失败的边界。以下为完整追加报告，可原文入库，不替换此前报告。

**一、审计对象与边界**

| 项目 | 核实结果 |
|---|---|
| Web | `/workspace/dnd-automation-web` |
| Web 冻结 | `cc8ad07f1b120ae997eab691050c8c67dc808df0` |
| 比较基线 | `c993bbd4b128012665e658ed9e1f5bad7b8286c3` |
| 数据仓 | `/workspace/dnd5e-automation-data` |
| 数据冻结 | `5f24e49380777d189fc4aefda712c780ac9bbc0f` |
| 工作树 | 两仓审计前后 tracked 工作树均干净 |

本轮审查历史候选绑定、旧键兼容、实际删除前记录候选及新增消费路径，并回归原 F1–F4、zero、D1–D4、D2-R1、D2-R2。

未修改文件、未创建提交、未委派、未推送，未运行浏览器全套或共享目录构建。实验使用内存角色和 `esbuild write:false`，未写入测试文件。

**二、已经确认有效的修复**

| 范围 | 独立验证结果 |
|---|---|
| F1 迁移债务 | feature `spent5`、automatic `spent4` 在复制、重载及升回原等级后保留，余额均为零 |
| F2 资源身份 | 同规范身份改名不换键，消费债务保留 |
| F3 纯求值、stackGroup、优先级 | 原角色不变；不支持的同组效果不执行；优先级结果仍为 5 |
| F4 与 D4 导出 | IR 生命骰、重量、法术环阶及 0.3 显式交换字段保持正确 |
| zero | 重复设零不截断溢出债务 |
| D1 | class/card/batch × 开启/关闭六组均保持 `max10/current0/spent10` |
| D2 独立实例 | 两份旧独立账本分别恢复为 `5/0/spent5`、`5/3/spent2` |
| D3 | 隐藏资源仍隐藏，新键保留布局，旧布局键清除 |
| 原 D2-R1 | 两个卸装方向均保持阻断，旧回执保留 |
| 原 D2-R2 | 两种原脚本编码在删除父项及旧 owner 后均保持阻断；单持有项也不自动迁移 |

新增二十项回归均通过，包括两种编码的十六组删除组合、单持有项加载、旧孤立路径回执和非法绑定导入。

另外独立执行十二组正常账本对照：

- 键类型：旧物理实例键、新 canonical 物理实例键。
- 资源键：`uses`、`resource:0`、`charges:daily`。
- 删除前自动化：开启、暂停。
- 使用实际 `removeSelection` 删除父职业，再 JSON 重载。

十二组均保留两件物品各自的余额和债务：

```text
row1: current=0, spent=7
row2: current=3, spent=2
```

未被添加 `requiresReview` 或 `reviewKeys`。另一个暂停实验使用无法解析出当前数值的资源公式，候选记录仍成功保存，未执行公式求值或授予资源。

这些结果支持新版本内部生命周期修复有效，但不能覆盖下述两个问题。

**三、HB1 · P1：没有历史绑定的旧五段 class-scope 孤立回执仍导致无恢复授满**

位置：

- [featureResources.ts:17](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:17)：孤立物品只额外保留 `orphanPathTail`；`legacyClass` 仍依赖当前存在的父职业。
- [featureResources.ts:33](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:33)：能够识别旧多段编码，但识别本身没有建立失去父项后的候选关系。
- [featureResources.ts:41](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:41)、[:43](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:43)：没有 `reviewKeys` 且当前匹配失败时，即使回执已标记待核对，也不会阻断物品。
- [featureResources.ts:94](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:94)：孤立回执补偿仅比较旧路径末段与 `grantKey`。
- [featureResources.ts:95](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:95)、[:96](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:96)：五段 class-scope 匹配依赖 `legacyClass`，父职业已经删除时无法匹配。

旧编码：

```text
feature-resource:["row0","XPHB","XPHB","","Charges"]:uses
```

这类编码的末段是条目英文名 `Charges`，不是 `equipment:0:a:0`。因此，当前为旧路径孤立装备增加的尾段补偿不能覆盖它。

完整实际路径：

1. 在 `c993` 资源实现下创建职业及两件同身份物品。
2. 物品保留旧编码所需的 `raw.className`、`raw.classSource`；保存五段 class-scope 合并账本 `max5/current0/spent5`，旧 owner 为 `row2`。
3. 执行协调，旧账本被标记 `requiresReview=true`。
4. 使用实际 `removeSelection` 删除 `row2`，再删除父职业 `row0`。
5. 已交付的 `row1` 保留，带原 `grantKey`；JSON 保存通过角色校验。旧回执没有后来新增的 `reviewKeys`。
6. 将这份实际生成的旧存档交给 `cc8` 校验并协调。
7. `row1` 得到 **`max5/current5/spent0`**，没有歧义提示；旧归档仍保存 `spent5/requiresReview=true`。

实际输出：

```text
ACTUAL_C993_SAVE:
holders=[{"id":"row1","grantKey":"equipment:0:a:0"}]
oldReceipt.ownerId="row2"
oldReceipt.spent=5
oldReceipt.requiresReview=true
oldReceipt.reviewKeys 未提供

CC8_LOADS_C993_SAVE:
grants=["row1"]
issues=[]
resources=[{"owner":"row1","max":5,"current":5,"spent":0}]
旧归档 spent5 / requiresReview=true 仍存在
```

同样的创建和删除操作全部在 `cc8` 中执行时，候选能够提前保存，重载后正确阻断：

```text
CC8_OWN_REMOVAL:
grants=[]
issues=["row1"]
resources=[]
旧回执 reviewKeys 同时保留原 row1、row2
```

因此，缺口明确位于**此前已经失去父项、没有绑定的新字段的旧存档兼容边界**。新版本删除路径有效，不能证明这些存档也已得到保护。

新增 [automation-ir-g5-findings.test.ts:142](/workspace/dnd-automation-web/tests/automation-ir-g5-findings.test.ts:142) 覆盖了无绑定的旧路径编码，但没有覆盖五段 class-scope 编码。HB1 仍违反无恢复重新授予资源的不变量，原 D2-R2 问题族不能完整关闭。

**四、HB2 · P2：协议 2 角色删除条目时，新历史扫描读取未经 IR 校验的数据并抛错**

位置：

- [featureResources.ts:86](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:86)：`rememberFeatureResources` 新增无条件调用 `rememberPendingOwnership`。
- [featureResources.ts:48](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:48)、[:38](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:38)：该调用进入全部持有条目的 IR 资源扫描，没有支持协议的门控。
- [featureResources.ts:21](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:21)：直接对 `irMechanics(...).resources` 调用 `.map`。
- [validation.ts:92](/workspace/dnd-automation-web/src/core/validation.ts:92)、[:115](/workspace/dnd-automation-web/src/core/validation.ts:115)：只有协议 3 才执行条目 IR 结构校验。
- [sheet.ts:19](/workspace/dnd-automation-web/src/core/sheet.ts:19)：实际删除条目前调用 `rememberFeatureResources`。

反例使用协议 2 角色，条目保留一个不符合 IR 3 结构的 `automation` 字段：

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

该字段不能作为有效 IR 3 执行，但协议 2 角色会通过现有 `validateCharacter`。在此前版本中，删除条目不会扫描它。

同一输入的前后对照：

```text
PROTOCOL2_C993:
validated=true
removed=true

PROTOCOL2_CC8:
validated=true
removed=false
TypeError: ((intermediate value) || []).map is not a function
```

这里没有自动资源，也没有旧消费回执；删除仍被无条件历史扫描阻断。不能用“此字段不是合法 IR 3”排除此反例，因为协议 2 的既有边界就是保留未执行的数据，而且角色入口实际接受了它。

本项是 `c993 → cc8` 的新增行为回归。影响范围是包含这类非 IR 3 结构字段的协议 2 存档，并非所有协议 2 角色。

**五、HB1、HB2 完整只读复现命令**

该命令在内存中分别加载前版和当前资源模块。此次 runtime delta 仅涉及 `featureResources.ts`；`model.ts` 的对应变更为类型字段。前版模块使用完整冻结 SHA 读取，其余运行文件未变。

命令不切换工作树、不写文件：

```bash
cd /workspace/dnd-automation-web
node --input-type=module <<'JS'
import {build} from '/workspace/dnd5e-automation-data/node_modules/esbuild/lib/main.js';
import {execFileSync} from 'node:child_process';

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

export function makeHistorical(){
  const c=newCharacter();
  initializeAutomation(c);

  const cls=entry('class','Owner',{classModel:{hitDie:8}});
  const item=entry('item','Charges',{
    equipmentModel:{category:'other'},
    resources:[{
      key:'uses',
      max:{value:5},
      recovery:[{period:'long',amount:'all'}]
    }]
  });
  item.raw={className:'Owner',classSource:'XPHB'};

  c.selections=[cls,item,structuredClone(item)].map((entry,i)=>({
    id:'row'+i,entry,level:1,quantity:1,equipped:true,
    ...(i?{parentId:'row0',grantKey:'equipment:0:a:0'}:{})
  }));

  const key=planFeatureResources(c).grants[0].legacyKey;
  c.runtime.resources[key]={
    max:5,current:0,
    featureGrant:{
      ownerId:'row2',ruleMax:5,spent:5,
      recovery:{long:'all'},origin:'legacy class'
    }
  };

  syncAutoResources(c);
  removeSelection(c,'row2');
  removeSelection(c,'row0');

  return {
    key,
    c:validateCharacter(JSON.parse(JSON.stringify(c)))
  };
}

export function resume(saved){
  const c=validateCharacter(JSON.parse(JSON.stringify(saved.c)));
  syncAutoResources(c);
  return {
    grants:planFeatureResources(c).grants.map(g=>g.ownerId),
    issues:planFeatureResources(c).issues.map(i=>i.selectionId),
    resources:Object.values(c.runtime.resources)
      .filter(r=>r.featureGrant)
      .map(r=>({
        owner:r.featureGrant.ownerId,
        max:r.max,current:r.current,spent:r.featureGrant.spent
      })),
    old:c.runtime.featureResourceArchive[saved.key].featureGrant
  };
}

export function protocol2Removal(){
  const c=newCharacter();
  initializeAutomation(c);
  c.automation.protocol=2;
  c.selections=[{
    id:'row1',
    entry:entry('item','Opaque legacy',{}),
    level:1,quantity:1,equipped:true
  }];

  c.selections[0].entry.automation={
    verdict:'automated',
    mechanics:{resources:{key:'uses'}}
  };

  validateCharacter(c);
  try{
    removeSelection(c,'row1');
    return {validated:true,removed:c.selections.length===0};
  }catch(e){
    return {validated:true,removed:false,error:String(e)};
  }
}
`;

async function moduleAt(previous){
  const plugins=previous?[{
    name:'prior-feature-resources',
    setup(b){
      b.onLoad({
        filter:/\/src\/core\/automation\/featureResources\.ts$/
      },args=>({
        contents:execFileSync('git',[
          'show',
          'c993bbd4b128012665e658ed9e1f5bad7b8286c3:src/core/automation/featureResources.ts'
        ],{encoding:'utf8'}),
        loader:'ts',
        resolveDir:args.path.slice(0,args.path.lastIndexOf('/'))
      }));
    }
  }]:[];

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
    plugins,
    logLevel:'silent'
  });

  return import(
    'data:text/javascript;base64,'+
    Buffer.from(result.outputFiles[0].text).toString('base64')
  );
}

const before=await moduleAt(true);
const current=await moduleAt(false);
const saved=before.makeHistorical();

console.log('ACTUAL_C993_SAVE',JSON.stringify({
  key:saved.key,
  holders:saved.c.selections.map(s=>({
    id:s.id,parent:s.parentId,grantKey:s.grantKey
  })),
  receipt:saved.c.runtime.featureResourceArchive[saved.key].featureGrant
}));
console.log('CC8_LOADS_C993_SAVE',JSON.stringify(current.resume(saved)));
console.log(
  'CC8_OWN_REMOVAL',
  JSON.stringify(current.resume(current.makeHistorical()))
);
console.log('PROTOCOL2_C993',JSON.stringify(before.protocol2Removal()));
console.log('PROTOCOL2_CC8',JSON.stringify(current.protocol2Removal()));
JS
```

**六、原脚本与聚焦回归的复现命令**

四份原报告脚本原样执行：

```bash
cd /workspace/dnd-automation-web
node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

for(const path of [
  'docs/AUDIT-AUTOMATION-IR-G5.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-FFA.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-8C5.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-C993.md'
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

独立聚焦验证：

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
Tests       113 passed (113)
```

**七、测试差异、原始统计及 standalone**

相对 `c993`，测试文件增加 `removeSelection` import，并追加二十项测试，findings 文件共五十八项。未发现改变既有断言数值、skip、timeout 或 retry。`git diff --check` 通过。

已核对：

| 范围 | 通过／跳过／失败 | 证据 |
|---|---:|---|
| 审计员本轮七文件 | **113/0/0** | 独立执行 |
| 主实施者七文件 | **113/0/0** | `g5-history-bindings-focused.log` |
| Node 22 全套 | **882/25/0** | `g5-history-bindings-check22.log` |
| Node 24 全套 | **882/25/0** | `g5-history-bindings-check24.log` |

Node 22/24 日志均包含 `tsc -b`、integrated 和 standalone 构建成功。两份审计 JSON 均为：

```text
singlePlayer=true
multiplayerModules=[]
```

上述构建由主实施者执行，本审计只读核对。十二组正常账本实验及其他内存实验单独记录，不并入 Vitest 总数；不同 Node 和不同执行者的结果也不相加。

**八、CI 边界**

- 第六轮 `37136767788` 对应 `c993`。本次用户回执及修复记录记载 **18/18 success**；本轮未重新审查其全部原始 CI 日志。
- 该结果不能计为 `cc8` 的 CI，也不能关闭本轮发现。
- `cc8` 第七轮已另行启动，本报告没有取得并核对其完整终态。
- 当前技术结论“不通过”由 HB1、HB2 的独立反例决定，不是因 CI 未结束。
- 后续第七轮全绿不能单独关闭这两项技术问题。

本轮不宣称 G5 放行，不宣称 G6–G8 完成。

**九、附录 I 八项清单**

| 清单 | 本轮结果 |
|---|---|
| 1. 名称分支 | 本次 runtime delta 未发现按职业、特性、物品名称新增执行分支 |
| 2. 纯求值、资源及债务 | 原纯求值和债务回归通过；**HB1 仍导致无恢复授满** |
| 3. 协议／覆盖层正文、CJK、长引用 | 生产数据、协议及覆盖层未变，沿用此前审查；测试夹具不计覆盖 |
| 4. 断言、skip、timeout、retry | 未发现削弱既有测试；新增测试遗漏无绑定五段 class-scope 存档及协议 2 不透明字段 |
| 5. 2014／2024 身份 | 规范身份协议未变，未发现新增跨版本合并 |
| 6. 0.3、standalone、旧卡边界 | 0.3 与 standalone 证据保持；**HB2 是协议 2 编辑回归** |
| 7. 原始统计 | 本地日志、独立测试、历史 CI 和待核第七轮分别记录 |
| 8. 九条 DoD | 整体仍未达底线，见下表 |

**十、§2.3 九条 DoD 对照**

未变项目沿用此前审计证据，本轮不冒充重新全面审查。

| DoD | 当前状态 |
|---|---|
| 1. 协议、示例与反例 | 协议基础已有证据；示例受限机制范围及 deferred 说明继续适用，不计作生产自动化覆盖 |
| 2. 完整流水线与版本锁 | 原报告列明的覆盖层叠加、`unsupported.json` 版本锁和完整生产流水线 CI 缺口，本轮未关闭 |
| 3. 核心覆盖 | **未达**。生产 18,789 条口径未变；指定核心 6,396 条仍全部 `needsAnnotation`，test-only samples 不计覆盖 |
| 4. 卡片接线 | 已有 IR／协议 3 接线证据；HB1 资源兼容缺口、HB2 旧协议编辑回归阻止 runtime 放行 |
| 5. 回归 | 本地严格类型、构建及统计已有；新冻结第七轮完整 CI 尚未独立核对 |
| 6. 解耦 | 沿用独立执行及共享 SHA 证据；十一项 oracle 跳过及原条文模块范围差异继续保留 |
| 7. 对外材料及草案 | 本轮不认定完成，属于后续阶段待办 |
| 8. 留痕 | 原报告及修复记录保留；本报告供主实施者原文入库 |
| 9. 独立审计 | 本轮 G5 技术结论为**不通过**；G8 未完成 |

G6 尚未开展本身不构成本轮 G5 缺陷。阶段待办、CI 证据缺口与确定的 runtime 问题分别记录。

**最终裁定**

`cc8ad07f1b120ae997eab691050c8c67dc808df0`：**不通过，runtime 不放行，不能据此放行 G5。**

未关闭发现：

- **HB1 · P1**：无 `reviewKeys` 的旧五段 class-scope 孤立存档加载后，原持有物品获得 `5/5、spent0`；旧债务仍在但未形成阻断。
- **HB2 · P2**：协议 2 中未经 IR 校验的数据被新增历史扫描读取，同一有效旧卡由可删除变为抛错、删除失败。

原四份脚本、113 项聚焦回归和十二组正常账本对照均通过，这些结果不覆盖上述两个已复现边界。第七轮 CI 保持单独待核。
