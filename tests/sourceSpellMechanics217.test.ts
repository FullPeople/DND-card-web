import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells,syncSourceSpells,setSourceSpellChoices} from '../src/core/automation/sourceSpells';
import {sourceSpellRestPlan,sourceSpellRestRequest,performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {changeSpecialSpellUses,specialSpellResource} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,name:id,english:id,kind,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创测试'],raw});
const catalog=[entry('alpha','spell',{level:1}),entry('beta','spell',{level:1})];
function setup(count='pbe',schedule='daily'){
 const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'owner',entry:entry('owner','class',{additionalSpells:[{innate:{'_':{[schedule]:{[count]:['alpha|XPHB','beta|XPHB']}}}}]}),level:5,quantity:1,equipped:false}];
 const choice=planSourceSpells(c,catalog).choices.find(x=>x.usageModes);if(choice)c.automation.spellUsageModes={[choice.key]:'shared'};
 syncSourceSpells(c,catalog);return c;
}
const grant=(c:ReturnType<typeof setup>)=>c.selections.find(s=>s.entry.kind==='spell')!;
it('PB each pools retain full spent history through decrease, repeated refresh, increase and import',()=>{
 const c=setup();expect(Object.values(c.runtime.resources).map(r=>r.max)).toEqual([3,3]);const id=grant(c).id;changeSpecialSpellUses(c,id,0);
 c.selections[0].level=1;syncSourceSpells(c,catalog);syncSourceSpells(c,catalog);const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;
 restored.selections[0].level=5;syncSourceSpells(restored,catalog);expect(restored.runtime.resources[specialSpellResource(id,restored)]).toMatchObject({max:3,current:0});
 restored.selections[0].level=9;syncSourceSpells(restored,catalog);expect(restored.runtime.resources[specialSpellResource(id,restored)]).toMatchObject({max:4,current:1});
});
it('PB shared pool remains shared and never refills on refresh or source disable',()=>{
 const c=setup('pb');expect(Object.keys(c.runtime.resources)).toHaveLength(1);changeSpecialSpellUses(c,grant(c).id,1);c.profile.enabledSources=[];syncSourceSpells(c,catalog);expect(sourceSpellRestPlan(c,'long').resources).toEqual([]);c.profile.enabledSources=['XPHB'];syncSourceSpells(c,catalog);expect(Object.values(c.runtime.resources)[0].current).toBe(1);
});
it('short rest excludes daily, long rest includes both; shared pool restored once, unrelated counters untouched',()=>{
 const c=setup('pb','rest');const pool=Object.keys(c.runtime.resources)[0];changeSpecialSpellUses(c,grant(c).id,0);c.runtime.resources.manual={max:5,current:1};c.runtime.resources['spell-slot:1']={max:2,current:0};
 const before=JSON.stringify(c);expect(sourceSpellRestPlan(c,'short').resources).toEqual([{resourceId:pool,before:0,after:3}]);expect(JSON.stringify(c)).toBe(before);
 const req=sourceSpellRestRequest(c,'short','rest1');expect(performSpellAction(c,req).status).toBe('applied');expect(c.runtime.resources.manual.current).toBe(1);expect(c.runtime.resources['spell-slot:1'].current).toBe(0);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;expect(performSpellAction(restored,req).status).toBe('duplicate');expect(restored.runtime.automationActions!.last!.recovered).toHaveLength(1);
 const daily=setup();changeSpecialSpellUses(daily,grant(daily).id,0);expect(sourceSpellRestPlan(daily,'short').resources).toHaveLength(0);expect(performSpellAction(daily,sourceSpellRestRequest(daily,'long','long')).status).toBe('applied');
});
it('malformed eligible counter aborts the entire batch and stale or reordered rest cannot replenish',()=>{
 const c=setup();const ids=Object.keys(c.runtime.resources);c.runtime.resources[ids[0]].current=0;c.runtime.resources[ids[1]].current=-1;const before=JSON.stringify(c);
 expect(performSpellAction(c,sourceSpellRestRequest(c,'long','invalid')).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
 c.runtime.resources[ids[1]].current=0;const stale=sourceSpellRestRequest(c,'long','stale');c.revision++;expect(performSpellAction(c,stale).status).toBe('rejected');const req=sourceSpellRestRequest(c,'long','valid');performSpellAction(c,req);performSpellAction(c,spellActionRequest(c,grant(c).id,'source','cast'));expect(performSpellAction(c,req).status).toBe('rejected');expect(c.runtime.resources[ids[0]].current).toBe(2);
});
it('explicit rest resets overflow debt while unsupported dynamic declarations stay visible',()=>{
 const c=setup();changeSpecialSpellUses(c,grant(c).id,0);c.selections[0].level=1;syncSourceSpells(c,catalog);performSpellAction(c,sourceSpellRestRequest(c,'long','recover'));c.selections[0].level=5;syncSourceSpells(c,catalog);expect(c.runtime.resources[specialSpellResource(grant(c).id,c)].current).toBe(3);
 for(const expression of ['halfPb','mod','wis']){const other=setup(expression);expect(grant(other)).toBeUndefined();expect(planSourceSpells(other,catalog).issues.some(i=>i.message.includes('次数公式未支持'))).toBe(true);}
});

it('explicit choose.from persists partial free choice, rejects outside identities, and never refills on choice switching',()=>{
 const c=setup();c.selections=c.selections.filter(x=>x.entry.kind!=='spell');c.runtime.resources={};c.spellSettings!.special={};
 c.selections[0].entry.raw.additionalSpells=[{innate:{'_':{daily:{pbe:[{choose:{from:['alpha|XPHB','beta|XPHB'],count:2}}]}}}}];
 const choice=planSourceSpells(c,catalog).choices.find(x=>x.spells)!;expect(choice.count).toBe(2);expect(grant(c)).toBeUndefined();
 const before=JSON.stringify(c);expect(()=>setSourceSpellChoices(c,choice.key,['alpha|PHB'],catalog)).toThrow();expect(JSON.stringify(c)).toBe(before);
 setSourceSpellChoices(c,choice.key,['alpha|XPHB'],catalog);syncSourceSpells(c,catalog);changeSpecialSpellUses(c,grant(c).id,0);
 setSourceSpellChoices(c,choice.key,['beta|XPHB'],catalog);syncSourceSpells(c,catalog);setSourceSpellChoices(c,choice.key,['alpha|XPHB'],catalog);syncSourceSpells(c,catalog);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;expect(restored.automation!.spellChoices![choice.key]).toEqual(['alpha|XPHB']);expect(restored.runtime.resources[specialSpellResource(grant(restored).id,restored)].current).toBe(0);
 expect(planSourceSpells(restored,catalog).issues.some(x=>x.message.includes('尚有 1 项未选'))).toBe(true);
});
it('choose.from keeps ambiguous usage ownership explicit and unsupported filters do not broaden grants',()=>{
 const c=setup();c.selections=c.selections.filter(x=>x.entry.kind!=='spell');c.selections[0].entry.raw.additionalSpells=[{innate:{'_':{daily:{pb:[{choose:{from:['alpha|XPHB','beta|XPHB'],count:2}}]}}}}];
 const usage=planSourceSpells(c,catalog).choices.find(x=>x.usageModes)!;expect(usage).toBeDefined();c.automation!.spellUsageModes={[usage.key]:'shared'};
 const choice=planSourceSpells(c,catalog).choices.find(x=>x.spells)!;setSourceSpellChoices(c,choice.key,['alpha|XPHB','beta|XPHB'],catalog);syncSourceSpells(c,catalog);const active=c.selections.filter(x=>x.entry.kind==='spell');expect(specialSpellResource(active[0].id,c)).toBe(specialSpellResource(active[1].id,c));
 c.selections[0].entry.raw.additionalSpells=[{known:{'_':[{choose:'level=0|class=Wizard'},{all:'level=0'}]}}];expect(planSourceSpells(c,catalog).grants).toHaveLength(0);expect(planSourceSpells(c,catalog).issues.length).toBeGreaterThan(0);
});

it('casting another spell while PB is lowered cannot erase the depleted pool overflow debt',()=>{
 const c=setup();const id=grant(c).id;changeSpecialSpellUses(c,id,0);c.selections[0].level=1;syncSourceSpells(c,catalog);
 const other=c.selections.filter(s=>s.entry.kind==='spell')[1];expect(performSpellAction(c,spellActionRequest(c,other.id,'source','other')).status).toBe('applied');
 c.selections[0].level=5;syncSourceSpells(c,catalog);expect(c.runtime.resources[specialSpellResource(id,c)].current).toBe(0);
});

it('a reduced choice limit retains invalid intent but disables grants until the player clears and reselects without refilling',()=>{
 const c=setup();c.selections=c.selections.filter(x=>x.entry.kind!=='spell');c.runtime.resources={};c.spellSettings!.special={};
 const declaration={choose:{from:['alpha|XPHB','beta|XPHB'],count:2}};
 c.selections[0].entry.raw.additionalSpells=[{innate:{'_':{daily:{pbe:[declaration]}}}}];
 const key=planSourceSpells(c,catalog).choices.find(x=>x.spells)!.key;setSourceSpellChoices(c,key,['alpha|XPHB','beta|XPHB'],catalog);syncSourceSpells(c,catalog);const id=grant(c).id;changeSpecialSpellUses(c,id,0);
 declaration.choose.count=1;syncSourceSpells(c,catalog);expect(c.automation!.spellChoices![key]).toHaveLength(2);expect(c.spellSettings!.special![id].sourceGrant!.active).toBe(false);expect(planSourceSpells(c,catalog).issues.some(x=>x.message.includes('当前声明不符'))).toBe(true);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;setSourceSpellChoices(restored,key,[],catalog);syncSourceSpells(restored,catalog);setSourceSpellChoices(restored,key,['alpha|XPHB'],catalog);syncSourceSpells(restored,catalog);expect(restored.runtime.resources[specialSpellResource(id,restored)].current).toBe(0);
});
