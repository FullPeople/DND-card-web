**G5 delta2 独立只读审计结论：不通过，runtime 不放行。**

本轮确认 **1 项 P1，未确认新增 P0 或 P2**。D1、D3、D4 的修复在本轮验证范围内通过；D2 已修复独立实例合并问题，但旧合并账本仍可通过卸装／重新装备绕过歧义阻断，产生未经恢复的满额资源。

以下为完整追加报告，可原文入库；不替换此前任何“不通过”报告。

**一、冻结对象与审计范围**

- Web：`/workspace/dnd-automation-web`
- 提交：`8c5d80355e619496b953a23ccfcbdc429f04dc64`
- 标签：`automation-g5-delta2-fix-20261003`
- 本轮比较基线：`ffa8d58811d46dbbb6cb4f82b461d63115ac227a`
- 数据冻结：`5f24e49380777d189fc4aefda712c780ac9bbc0f`，本轮未变。
- 本轮只审 D1–D4 修复及新增消费边界，沿用此前对未变产物的审查结论。
- 审计前后 tracked 工作树均干净。未修改文件、未实现、未委派、未推送，未运行浏览器全套或构建。
- 实验使用当前 Web 源码，在内存中打包和执行；未使用仍停留在 `ffa8d58` 的 zero 工作树。

**二、修复逐项复核**

| 项目 | 本轮结论 | 独立验证结果 |
|---|---|---|
| 原 F1–F4 | 既有反例保持纠正 | 原报告脚本原样执行：迁移保留溢出债务；改名不换资源身份；纯求值与优先级结果正确；IR 导出字段正确 |
| zero 零值维护 | 保持修复 | 重复设零后保留 `spent5/4`，升回原等级仍为 `current0/0` |
| D1 暂停自动化后的同步 | **通过** | class/card/batch × 开启/关闭六组，均保持 `max10/current0/spent10`，原卡不变 |
| D2 物品实例及旧账本 | **不通过，部分修复** | 不同 selection ID 已产生独立资源；两份旧独立账本正确迁移。但旧合并账本存在下述 P1 |
| D3 隐藏及布局引用 | **通过** | 原反例 `beforeVisible=0、afterVisible=0`；新键保留隐藏和布局，旧键布局删除；分组成员、页、样式及重载回归通过 |
| D4 0.3 显式交换字段 | **通过** | 重量 `7 × 2` 再导出为单件 `7`、总重 `14`；新增数量三件回归保留总重 `21`；显式单职业生命骰保留 |

D1 对应 [state.ts:10](/workspace/dnd-automation-web/src/core/automation/state.ts:10)、[classMigration.ts:79](/workspace/dnd-automation-web/src/core/classMigration.ts:79)、[cardMigration.ts:159](/workspace/dnd-automation-web/src/core/cardMigration.ts:159)。独立异常实验确认：协议 3 暂停状态在回调抛错后恢复为 `false`；协议 2 在回调期间及结束后均未被启用。

D3 对应 [featureResources.ts:66](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:66)，实际画布消费端验证隐藏状态，不以资源对象内部保留样式替代外部引用验证。

D4 对应 [validation.ts:88](/workspace/dnd-automation-web/src/core/validation.ts:88)、[validation.ts:226](/workspace/dnd-automation-web/src/core/validation.ts:226)、[validation.ts:239](/workspace/dnd-automation-web/src/core/validation.ts:239)、[characterDetails.ts:19](/workspace/dnd-automation-web/src/core/characterDetails.ts:19)、[export.ts:30](/workspace/dnd-automation-web/src/core/export.ts:30)、[export.ts:35](/workspace/dnd-automation-web/src/core/export.ts:35)。`manualHitDie` 的新增消费限于交换输出，没有接入自动生命骰资源生成。重量和生命骰回归均验证修改 `raw` 不改变显式保存值。

**三、未关闭发现：D2-R1 · P1**

**旧合并账本的歧义只按当前活动 grant 判断，卸下一件物品即可解除阻断；重新装备后获得满额资源。**

具体位置：

- [featureResources.ts:16](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:16)、[featureResources.ts:19](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:19)：先过滤不活动、未装备或未满足同调条件的实例。
- [featureResources.ts:45](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:45)：旧回执歧义仅针对过滤后的 `grants` 判断。
- [featureResources.ts:56](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:56)：匹配 `previousKey` 时直接接受，不检查旧回执的实例所有者。
- [featureResources.ts:63](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:63)：唯一匹配也仅以当前 grant 集合判断。
- [featureResources.ts:88](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:88)、[featureResources.ts:94](/workspace/dnd-automation-web/src/core/automation/featureResources.ts:94)：将旧回执迁给当前唯一活动实例，然后删除旧资源及归档键。
- 实际 UI 入口：[App.tsx:154](/workspace/dnd-automation-web/src/ui/App.tsx:154) 的装备复选框；编辑后的资源协调位于 [App.tsx:549](/workspace/dnd-automation-web/src/ui/App.tsx:549)。

完整触发过程：

1. 同一职业拥有两件同身份物品 `row1`、`row2`，两者均已装备。
2. 保存的旧 canonical 合并账本为 `max5/current0/spent5`，`featureGrant.ownerId='row2'`。该角色通过 `validateCharacter`。
3. 首次协调正确报告歧义：没有新 grant，旧消费回执保存在归档中。
4. 仅卸下 `row2`。两件物品仍属于角色，未删除任何实例、未恢复、未休息。
5. 再次协调只看到活动的 `row1`，将旧 `row2` 回执迁给 `row1`，删除旧合并回执；歧义提示消失。
6. 保存、重载并重新装备 `row2`。
7. `row2` 没有剩余回执可恢复，被初始化为 **`max5/current5/spent0`**。

独立输出：

| 阶段 | 活动资源 | 歧义提示 |
|---|---|---|
| 两件装备，初次协调 | 无；旧 `spent5` 留在归档 | 2 条 |
| 卸下旧 owner `row2` | `row1: max5/current0/spent5` | 0 条 |
| 重载并重新装备 `row2` | `row1: 5/0/spent5`；**`row2: 5/5/spent0`** | 0 条 |

另一个方向也已验证：先卸下 `row1`，再重新装备，同样产生新的 `5/5/spent0` 资源。两种情况下，旧合并回执最终均已删除。

这不是主动恢复。活动状态的变化不能证明旧合并账本已经获得唯一的历史归属。当前实现把“目前只有一件启用”当成“历史上唯一所属实例”，因而绕过了明确要求的歧义阻断，并重新授予次数。

新增测试 [automation-ir-g5-findings.test.ts:97](/workspace/dnd-automation-web/tests/automation-ir-g5-findings.test.ts:97) 覆盖的是已经建立独立新账本后的同调生命周期；[:100](/workspace/dnd-automation-web/tests/automation-ir-g5-findings.test.ts:100) 覆盖旧独立账本。它们没有覆盖“旧合并回执＋部分实例暂停＋重新启用”的组合。

**四、D2-R1 完整只读复现命令**

以下命令仅在内存中创建角色和打包结果，不写文件、不启动服务，也不修改实际角色数据。

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
      key:'uses',max:{value:5},
      recovery:[{period:'long',amount:'all'}]
    }]
  });
  const c=newCharacter();
  initializeAutomation(c);
  c.selections=[cls,item,structuredClone(item)].map((entry,i)=>({
    id:'row'+i,entry,level:1,quantity:1,equipped:true,
    ...(i?{parentId:'row0'}:{})
  }));

  const key=planFeatureResources(c).grants[0].previousKey;
  c.runtime.resources[key]={
    max:5,current:0,
    featureGrant:{
      ownerId:'row2',ruleMax:5,spent:5,
      recovery:{long:'all'},origin:'old merged'
    }
  };
  validateCharacter(c);
  return {c,key};
};

const snapshot=c=>({
  grants:planFeatureResources(c).grants.map(g=>g.ownerId),
  issues:planFeatureResources(c).issues.map(i=>i.message),
  resources:Object.values(c.runtime.resources)
    .filter(r=>r.featureGrant)
    .map(r=>({
      owner:r.featureGrant.ownerId,
      max:r.max,current:r.current,spent:r.featureGrant.spent
    })),
  archive:Object.keys(c.runtime.featureResourceArchive||{})
});

for(const disabled of ['row1','row2']){
  const {c,key}=make();

  console.log('AMBIGUOUS',disabled,JSON.stringify(snapshot(c)));
  syncAutoResources(c);
  console.log('BLOCKED',disabled,JSON.stringify(snapshot(c)));

  c.selections.find(r=>r.id===disabled).equipped=false;
  syncAutoResources(c);
  console.log('ONE_ACTIVE',disabled,JSON.stringify(snapshot(c)));

  const restored=validateCharacter(JSON.parse(JSON.stringify(c)));
  restored.selections.find(r=>r.id===disabled).equipped=true;
  syncAutoResources(restored);
  console.log(
    'BOTH_AGAIN',disabled,JSON.stringify(snapshot(restored)),
    'oldReceiptPresent',
    !!restored.runtime.featureResourceArchive?.[key]
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

`BOTH_AGAIN row2` 的关键实际结果为：

```text
row1: max=5, current=0, spent=5
row2: max=5, current=5, spent=0
issues=[]
oldReceiptPresent=false
```

**五、既有反例、测试差异及统计**

两份此前入库报告中的完整脚本，均在当前冻结源码上原样执行。复跑命令：

```bash
cd /workspace/dnd-automation-web
node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

for(const path of [
  'docs/AUDIT-AUTOMATION-IR-G5.md',
  'docs/AUDIT-AUTOMATION-IR-G5-DELTA-FFA.md'
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

独立聚焦验证命令：

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

实际结果：**7 文件，75 通过／0 跳过／0 失败**。

本轮测试 diff 仅调整所需 imports 并追加八项回归，findings 文件现有二十项。未发现削弱既有断言数值、增加 skip、延长 timeout 或增加 retry。此前 fixture authoring 契约没有在本次 delta 中被进一步放宽。

已核对主实施者原始日志，统计分别记录：

| 证据 | 通过／跳过／失败 |
|---|---|
| 审计员本轮七文件 | **75/0/0** |
| 主实施者最终五文件 | **66/0/0** |
| Node 22 冻结全套 | **844/25/0** |
| Node 24 冻结全套 | **844/25/0** |
| 首轮五文件失败留痕 | **44/0/20** |
| 第二轮五文件失败留痕 | **63/0/1** |
| 随后五文件中间结果 | **64/0/0** |

第二轮失败为 card 用例预期三个 grant、实际两个；最终冻结仍保留预期三个 grant 的断言，并已通过。失败日志未被最终成功统计覆盖。

原始证据位于 `evidence/automation-ir/g5-delta2-*`。Node 22/24 的冻结日志包含严格类型检查及 integrated／standalone 构建成功；对应审计 JSON 均为：

```text
singlePlayer=true
multiplayerModules=[]
```

这些构建由主实施者执行，本审计只读核对日志，没有在共享目录重复构建。不同配置、不同阶段和不同 Node 版本的数量不相加。

**六、CI 证据独立记录**

第四轮 `37131464955`：

- 已独立核对 `jobs.json`、`summary.json` 和全部十八份原始日志。
- verify 日志包含冻结 SHA `ffa8d58811d46dbbb6cb4f82b461d63115ac227a`。
- **verify＋17 个浏览器组，18/18 success**。
- 核对的三十七条通过／跳过／失败摘要行均能在对应原始日志中找到，未发现不一致。
- verify 为 **836/25/0**。
- 该结果属于 **ffa 冻结**，不能计作本轮 `8c5d803` 的完整 CI。

第五轮 `37133385767`：

- 本报告截至现有回执，**尚未取得完整终态证据**。
- 不宣称本轮完整 CI 已通过。
- 这是证据待补项，独立于已经复现的 P1。后续 CI 全绿也不能关闭 D2-R1。

数据仓公开候选及 main 的 CI 按此前回执记录为 `287/11/0＋14/0/0`；十一项外部 oracle 跳过继续单列，本轮未重新运行数据全套。

**七、附录 I 八项核对**

| 清单 | 本轮结论 |
|---|---|
| 1. 按职业／特性／物品名称执行分支 | 本次 runtime delta 未发现新增此类分支 |
| 2. 纯求值、资源恢复及 spent 回放 | 既有纯求值和债务反例保持纠正；**D2-R1 违反无恢复重新授予资源的不变量** |
| 3. 协议／覆盖层正文、CJK、超过十五词引用 | 数据、协议及覆盖层未变，沿用此前检查；未将本轮测试夹具算作生产覆盖 |
| 4. 断言、skip、timeout、retry | 本轮未发现既有契约被削弱；新增回归仍遗漏旧合并账本启停组合 |
| 5. 2014／2024 身份隔离 | 本次 delta 未修改规范身份协议，未发现新增跨版本合并 |
| 6. 0.3 导出及 standalone | 显式重量和生命骰交换修复通过；双 Node standalone 审计 JSON 已核对 |
| 7. 原始统计 | 本地、独立聚焦、前轮 CI 和本轮待补 CI 分开记录 |
| 8. 九条 DoD | 见下表；本轮仍不得宣称整体达到底线 |

**八、§2.3 九条 DoD 对照**

此处沿用此前审计对未变项目的证据，不将本次 delta 冒充完整重审。

| DoD | 本轮状态 |
|---|---|
| 1. 协议、示例和反例 | 已有协议基础证据；原示例的受限机制范围及 deferred 说明继续适用，不计作完整生产自动化覆盖 |
| 2. 完整流水线与所有产物版本锁 | 原报告所列覆盖层叠加、`unsupported.json` 版本锁及完整生产流水线 CI 缺口，本轮未关闭 |
| 3. 核心覆盖 | **未达**。生产 18,789 条口径未变；指定核心 6,396 条仍全部 `needsAnnotation`，test-only samples 不计覆盖 |
| 4. 卡片接线 | 协议 3 和 IR 接线修复已有证据；本轮确认的资源迁移 P1 阻止 runtime 放行 |
| 5. 回归 | 本地冻结统计及构建证据齐备；新冻结第五轮完整 CI 终态尚缺 |
| 6. 独立仓解耦 | 沿用独立执行和共享 SHA 证据；十一项 oracle 跳过及原文“一个身份模块”与十项共享文件的范围差异继续如实保留 |
| 7. 对外文档、脚本及 PR 草案 | 本轮不认定完成，后续阶段待办 |
| 8. 留痕 | 旧不通过报告、修复记录和失败日志保留；本追加报告由主实施者原文入库 |
| 9. 独立审计 | 本轮 G5 技术结论为**不通过**；G8 未完成 |

G6 尚未开展本身不构成本轮 G5 技术缺陷；上述阶段待办与 D2-R1 明确分开。

**最终裁定**

`8c5d80355e619496b953a23ccfcbdc429f04dc64`：**不通过，runtime 不放行，G5 不放行。**

阻挡项为 **D2-R1 · P1：旧合并资源账本可通过物品卸装／重新装备绕过歧义阻断，发生债务错配和未经恢复的满额授予**。D1、D3、D4 在本轮范围内关闭；新冻结 CI 终态另列待补，不影响当前技术否决。
