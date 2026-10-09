import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncAutoResources,setResource} from '../src/core/resources';
import {planSourceSpells,syncSourceSpells,setSourceResourceColumn} from '../src/core/automation/sourceSpells';
import {spellPayments,spellActionRequest,performSpellAction,sourceSpellRestPlan} from '../src/core/automation/actions';
import {readCharacter} from '../src/core/validation';
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,kind,name:id,english:id,source:'XPHB',edition:'2024',packId:'authored',revision:'fixture',entries:[],raw});
const spell=entry('原创光焰','spell',{level:1});
function setup({name='原创星火',cost='2',explicit=false}:{name?:string;cost?:string;explicit?:boolean}={}){
 const c=newCharacter();c.automation=newAutomationState();
 c.selections=[{id:'class',entry:entry('原创导引者','class',{classTableGroups:[{colLabels:['原创星火'],rows:Array.from({length:20},(_,i)=>[i+1])}]}),level:6,quantity:1,equipped:false},{id:'owner',parentId:'class',entry:entry('原创引火法','feature',{additionalSpells:[{ability:'wis',resourceName:name,innate:{3:{resource:{[cost]:['原创光焰|XPHB']}}}}]}),level:3,quantity:1,equipped:false}];
 if(explicit)c.selections.push({id:'points',parentId:'class',entry:entry('原创点数来源','feature',{resources:[{name:'原创星火',max:9,recovery:'long'}]}),level:1,quantity:1,equipped:false});
 syncAutoResources(c);syncSourceSpells(c,[spell]);return c;
}
const row=(c:ReturnType<typeof setup>)=>c.selections.find(row=>row.grantKey?.includes('/resource/'))!;
const pool=(c:ReturnType<typeof setup>)=>Object.entries(c.runtime.resources).find(([,value])=>value.name==='原创星火')!;
const request=(c:ReturnType<typeof setup>,id='cast')=>spellActionRequest(c,row(c).id,'resource',id);
it('an actual source declaration offers the declared point cost without creating another counter or mutating state',()=>{
 const c=setup(),[key]=pool(c),before=JSON.stringify(c);
 expect(row(c)).toBeDefined();expect(c.spellSettings!.special![row(c).id].sourceGrant).toMatchObject({resourceName:'原创星火',resourceCost:2,resourceKey:key,usage:'resource',active:true,canUseSlots:false});
 expect(spellPayments(c,row(c).id).options).toMatchObject([{id:'resource',resourceId:key,cost:2,available:true}]);expect(JSON.stringify(c)).toBe(before);expect(Object.keys(c.runtime.resources)).toHaveLength(1);
});
it('a class-owned explicit feature pool is used directly and source synchronization never resets it',()=>{
 const c=setup({explicit:true}),[key]=pool(c);expect(c.runtime.resources[key].max).toBe(9);
 expect(performSpellAction(c,request(c)).status).toBe('applied');syncSourceSpells(c,[spell]);syncAutoResources(c);expect(c.runtime.resources[key].current).toBe(7);expect(Object.keys(c.runtime.resources)).toHaveLength(1);
});
it('payment, duplicate requests, native restore and level changes conserve spent points',()=>{
 const c=setup(),[key]=pool(c),first=request(c);expect(performSpellAction(c,first).status).toBe('applied');expect(c.runtime.resources[key].current).toBe(4);
 const paid=JSON.stringify(c);expect(performSpellAction(c,first).status).toBe('duplicate');expect(JSON.stringify(c)).toBe(paid);
 const restored=readCharacter(JSON.parse(paid)).character;expect(performSpellAction(restored,first).status).toBe('duplicate');syncSourceSpells(restored,[spell]);restored.selections[0].level=8;syncAutoResources(restored);expect(restored.runtime.resources[key]).toMatchObject({max:8,current:6});
});
it('insufficient points reject the entire operation and never fall back to free casts or slots',()=>{
 const c=setup(),[key]=pool(c);setResource(c,key,1);c.runtime.resources['spell-slot:1']={max:2,current:2};
 expect(spellPayments(c,row(c).id).options).toMatchObject([{id:'resource',available:false,cost:2}]);const before=JSON.stringify(c);
 for(const paymentId of ['resource','source','free','slot:spell-slot:1'])expect(performSpellAction(c,{...request(c,paymentId),paymentId}).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
});
it('a spell cannot restore the external point pool as if it owned a daily counter',()=>{
 const c=setup(),[key]=pool(c);setResource(c,key,1);const before=JSON.stringify(c);
 expect(sourceSpellRestPlan(c,'long').resources).toEqual([]);expect(performSpellAction(c,{...request(c),mode:'restore',paymentId:'source'}).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
});
it('different resource names require a validated player choice that survives native import',()=>{
 const c=setup({name:'Authored Sparks'});expect(row(c)).toBeUndefined();const choice=planSourceSpells(c,[spell]).choices.find(choice=>choice.resourceColumns)!;const before=JSON.stringify(c);
 expect(()=>setSourceResourceColumn(c,choice.key,'其他列',[spell])).toThrow();expect(JSON.stringify(c)).toBe(before);
 setSourceResourceColumn(c,choice.key,'原创星火',[spell]);syncAutoResources(c);syncSourceSpells(c,[spell]);expect(row(c)).toBeDefined();const [key]=pool(c);performSpellAction(c,request(c));const restored=readCharacter(c).character;syncAutoResources(restored);syncSourceSpells(restored,[spell]);expect(restored.runtime.resources[key].current).toBe(4);
});
it.each(['0','-1','2e','1d4','2.5','10001'])('unsupported source cost %s remains manual without any free grant',cost=>{
 const c=setup({cost});expect(row(c)).toBeUndefined();expect(planSourceSpells(c,[spell]).issues.length).toBeGreaterThan(0);expect(pool(c)).toBeUndefined();
});
it.each(['usage','cost','key'])('tampered cached %s cannot authorize a different payment',field=>{
 const c=setup(),grant=c.spellSettings!.special![row(c).id].sourceGrant!;
 if(field==='usage')grant.usage='free';if(field==='cost')grant.resourceCost=1;if(field==='key')grant.resourceKey='feature-resource:unowned:0';const before=JSON.stringify(c);
 expect(spellPayments(c,row(c).id).options).toEqual([]);expect(performSpellAction(c,request(c)).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
});
it('changes to source cost and disabled sources reject stale payments while keeping class points',()=>{
 const c=setup(),[key]=pool(c),first=request(c);c.selections[1].entry.raw.additionalSpells[0].innate[3].resource={3:['原创光焰|XPHB']};const before=JSON.stringify(c);expect(performSpellAction(c,first).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
 syncSourceSpells(c,[spell]);const active=c.selections.find(selection=>selection.entry.kind==='spell'&&c.spellSettings?.special?.[selection.id].sourceGrant?.active)!;
 expect(spellPayments(c,active.id).options).toMatchObject([{id:'resource',cost:3}]);expect(performSpellAction(c,spellActionRequest(c,active.id,'resource','new-cost')).status).toBe('applied');expect(c.runtime.resources[key].current).toBe(3);
 c.profile.disabledEntries=[c.selections[1].entry.id];syncSourceSpells(c,[spell]);syncAutoResources(c);expect(c.runtime.resources[key].current).toBe(3);expect(spellPayments(c,active.id).options).toEqual([]);
});
it('payment immediately archives spent points and a restored pool cannot replenish them',()=>{
 const c=setup(),[key]=pool(c);expect(performSpellAction(c,request(c)).status).toBe('applied');
 expect(c.runtime.featureResourceArchive?.[key]).toMatchObject({current:4,featureGrant:{spent:2}});
 delete c.runtime.resources[key];syncAutoResources(c);expect(c.runtime.resources[key]).toMatchObject({current:4,max:6,featureGrant:{spent:2}});
});
it('removing the class and source preserves an importable spent archive without usable spell payments',()=>{
 const c=setup(),[key]=pool(c),spellId=row(c).id;performSpellAction(c,request(c));c.selections=c.selections.filter(selection=>selection.entry.kind==='spell');syncAutoResources(c);syncSourceSpells(c,[spell]);
 expect(c.runtime.resources[key]).toBeUndefined();expect(c.runtime.featureResourceArchive?.[key].current).toBe(4);expect(spellPayments(c,spellId).options).toEqual([]);
 const restored=readCharacter(c).character;expect(restored.runtime.featureResourceArchive?.[key].current).toBe(4);expect(spellPayments(restored,spellId).options).toEqual([]);
});
it('a retired archive cannot be imported as an active resource spell',()=>{
 const c=setup(),spellId=row(c).id;c.selections=c.selections.filter(selection=>selection.entry.kind==='spell');syncAutoResources(c);syncSourceSpells(c,[spell]);c.spellSettings!.special![spellId].sourceGrant!.active=true;
 expect(()=>readCharacter(c)).toThrow(/资源归属/);
});
it('a point pool of another class cannot be substituted through native JSON',()=>{
 const c=setup(),other=structuredClone(c.selections[0]);other.id='other-class';other.entry.id='其他导引者';c.selections.push(other);
 const source=structuredClone(c.selections[1]);source.id='other-owner';source.parentId=other.id;c.selections.push(source);syncAutoResources(c);
 const otherKey=Object.entries(c.runtime.resources).find(([,r])=>r.featureGrant?.ownerId===other.id)![0];c.spellSettings!.special![row(c).id].sourceGrant!.resourceKey=otherKey;
 expect(()=>readCharacter(c)).toThrow(/资源归属/);
});
it('arbitrary external pool keys and nonpositive imported costs fail validation',()=>{
 const c=setup(),id=row(c).id,original=structuredClone(c.spellSettings!.special![id].sourceGrant!);
 c.spellSettings!.special![id].sourceGrant!.resourceKey='manual-counter';expect(()=>readCharacter(c)).toThrow(/资源归属/);
 c.spellSettings!.special![id].sourceGrant=original;c.spellSettings!.special![id].sourceGrant!.resourceCost=0;expect(()=>readCharacter(c)).toThrow(/资源声明/);
});
