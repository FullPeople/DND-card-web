import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,ABILITIES} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';
import {asiAllocationStatus,setAsiAllocation} from '../src/core/automation/asi';

function setup(){
 const entries=normalizeData({class:[{name:'战士',ENG_name:'Fighter',source:'XPHB',classFeatures:[4,6].map(n=>`属性值提升|战士|XPHB|${n}`)}],classFeature:[4,6].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'XPHB',className:'战士',classSource:'XPHB',level,entries:['你获得{@feat 属性值提升|XPHB}专长。']})),feat:[{name:'属性值提升',ENG_name:'Ability Score Improvement',source:'XPHB',category:'G',repeatable:true,prerequisite:[{level:4}],ability:[{choose:{from:[...ABILITIES],amount:2},hidden:true},{choose:{from:[...ABILITIES],count:2},hidden:true}],entries:[]},{name:'替代专长',source:'XPHB',category:'G',entries:[]}]},'asi-authored');
 const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'fighter',entry:entries.find(e=>e.kind==='class')!,level:6,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choices=sheetChoices(c,entries).filter(x=>x.id.includes(':class-typed-feat:')),feat=entries.find(e=>e.kind==='feat'&&e.english==='Ability Score Improvement')!;
 for(const choice of choices)setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncChoiceContent(c,entries);
 return {c,entries,choices,feat};
}
it('defaults to manual, then applies explicit independent grant allocations without editing base scores',()=>{
 const {c,choices}=setup(),before=JSON.stringify(c.abilities),runtime=JSON.stringify(c.runtime);
 expect(evaluate(c).abilities.str).toBe(10);expect(asiAllocationStatus(c,choices[0].id).eligible).toBe(true);
 setAsiAllocation(c,choices[0].id,{str:2});setAsiAllocation(c,choices[1].id,{str:1,dex:1});
 expect(evaluate(c).abilities).toMatchObject({str:13,dex:11});expect(new Set(c.asiAllocations!.bindings.map(x=>x.selectionId)).size).toBe(2);
 expect(JSON.stringify(c.abilities)).toBe(before);expect(JSON.stringify(c.runtime)).toBe(runtime);expect(evaluate(validateCharacter(JSON.parse(JSON.stringify(c)))) .abilities.str).toBe(13);
});
it.each([{str:3},{str:1},{str:1,dex:1,con:1},{str:2,dex:0},{oops:2},{str:-2},{str:1.5,dex:.5}])('rejects malformed allocation %j atomically',allocation=>{
 const {c,choices}=setup(),before=JSON.stringify(c);expect(()=>setAsiAllocation(c,choices[0].id,allocation as any)).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it('suspends overflow rather than truncating or editing scores, and supports withdrawal',()=>{
 const {c,choices}=setup();c.abilities.str=18;setAsiAllocation(c,choices[0].id,{str:2});expect(evaluate(c).abilities.str).toBe(20);
 expect(()=>setAsiAllocation(c,choices[1].id,{str:2})).toThrow();c.abilities.str=19;expect(evaluate(c).abilities.str).toBe(19);expect(asiAllocationStatus(c,choices[0].id).active).toBe(false);
 c.abilities.str=18;expect(evaluate(c).abilities.str).toBe(20);setAsiAllocation(c,choices[0].id,null);expect(evaluate(c).abilities.str).toBe(18);
});
it('preserves allocations through replacement, archive and restore, downgrade, off and source disable',()=>{
 const {c,choices,entries}=setup();setAsiAllocation(c,choices[0].id,{str:2});setAsiAllocation(c,choices[1].id,{dex:2});const intent=JSON.stringify(c.asiAllocations);
 setSheetChoiceSlot(c,choices[0].id,0,entries.find(e=>e.name==='替代专长')!.id,entries);syncChoiceContent(c,entries);expect(evaluate(c).abilities.str).toBe(10);
 setSheetChoiceSlot(c,choices[0].id,0,entries.find(e=>e.kind==='feat'&&e.english==='Ability Score Improvement')!.id,entries);syncChoiceContent(c,entries);expect(evaluate(c).abilities.str).toBe(12);
 c.selections.find(e=>e.id==='fighter')!.level=4;syncFeatures(c,entries);expect(evaluate(c).abilities).toMatchObject({str:12,dex:10});c.selections.find(e=>e.id==='fighter')!.level=6;syncFeatures(c,entries);expect(evaluate(c).abilities.dex).toBe(12);
 c.automation!.enabled=false;expect(evaluate(c).abilities.str).toBe(10);c.automation!.enabled=true;c.profile.enabledSources=[];expect(evaluate(c).abilities.str).toBe(10);expect(JSON.stringify(c.asiAllocations)).toBe(intent);
});
it.each(['english','shape','source','feature-english','feature-parent','feature-grant','feature-missing','answer','owner','copy','effects','choice-key'] as const)('rejects forged or unsupported %s',mode=>{
 const {c,choices}=setup(),row=c.selections.find(r=>r.requirementId===choices[0].id)!,feature=c.selections.find(r=>r.entry.kind==='feature'&&r.entry.raw.level===4)!;
 if(mode==='english')row.entry.english='Unknown';if(mode==='shape')row.entry.raw.ability=[{choose:{from:['str'],amount:2}}];if(mode==='source')row.entry.source='PHB';if(mode==='feature-english')feature.entry.english='Unknown';if(mode==='feature-parent')feature.parentId='missing';if(mode==='feature-grant')feature.grantKey='ref:fake';if(mode==='feature-missing')c.selections=c.selections.filter(r=>r!==feature);if(mode==='answer')c.answers[choices[0].id]=[];if(mode==='owner')c.selections[0].entry.english='Unknown';if(mode==='copy')row.entry.raw._copy={};if(mode==='effects')row.entry.effects=[{op:'add',target:'str',value:2}];if(mode==='choice-key')row.grantKey='choice:fake';
 expect(asiAllocationStatus(c,choices[0].id).eligible).toBe(false);expect(()=>setAsiAllocation(c,choices[0].id,{str:2})).toThrow();
});
it('preserves unsupported future intent but never executes or rewrites it',()=>{
 const {c,choices}=setup();(c as any).asiAllocations={version:2,future:{x:1}};const saved=JSON.stringify(c.asiAllocations);expect(evaluate(validateCharacter(JSON.parse(JSON.stringify(c)))).abilities.str).toBe(10);expect(()=>setAsiAllocation(c,choices[0].id,null)).toThrow();expect(JSON.stringify(c.asiAllocations)).toBe(saved);
});

it('accepts the actual browser fixture with its independently identified class snapshot',async()=>{
 const {asiAllocationData,asiAllocationFixture}=await import('./e2e/asiAllocationFixture');
 const c=asiAllocationFixture(),entries=normalizeData(asiAllocationData,'browser-fixture');syncFeatures(c,entries);
 const choices=sheetChoices(c,entries).filter(r=>r.id.includes(':class-typed-feat:'));expect(choices).toHaveLength(2);
 const feat=entries.find(e=>e.kind==='feat'&&e.english==='Ability Score Improvement')!;for(const choice of choices)setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncChoiceContent(c,entries);
 expect(asiAllocationStatus(c,choices[0].id).eligible).toBe(true);expect(asiAllocationStatus(c,choices[1].id).eligible).toBe(true);setAsiAllocation(c,choices[0].id,{str:2});expect(evaluate(c).abilities.str).toBe(18);
});
it('rejects malformed imported allocations and suppresses duplicate bindings without changing data',()=>{
 const {c,choices}=setup();setAsiAllocation(c,choices[0].id,{str:2});const malformed=structuredClone(c);malformed.asiAllocations!.bindings[0].allocation={str:3};expect(()=>validateCharacter(malformed)).toThrow();
 c.asiAllocations!.bindings.push(structuredClone(c.asiAllocations!.bindings[0]));const before=JSON.stringify(c);expect(evaluate(c).abilities.str).toBe(10);expect(asiAllocationStatus(c,choices[0].id).active).toBe(false);expect(JSON.stringify(c)).toBe(before);
});
it('retains unknown metadata on validation and protects derived consumers and manual overrides',()=>{
 const {c,choices}=setup();c.baseHp=20;setAsiAllocation(c,choices[0].id,{str:2});
 expect(evaluate(c).modifiers.str).toBe(1);expect(evaluate(c).skills.athletics.value).toBe(1);expect(evaluate(c).trace.str.join(' ')).toContain('显式分配 +2');
 (c.asiAllocations as any).futureNote='retained';expect((validateCharacter(JSON.parse(JSON.stringify(c))).asiAllocations as any).futureNote).toBe('retained');
});

it('uses identical saved-source semantics for UI status and engine after a card edition switch',()=>{
 const {c,choices}=setup();setAsiAllocation(c,choices[0].id,{str:2});c.edition='2014';expect(evaluate(c).abilities.str).toBe(12);expect(asiAllocationStatus(c,choices[0].id)).toMatchObject({eligible:true,active:true});setAsiAllocation(c,choices[0].id,{dex:2});expect(evaluate(c).abilities.dex).toBe(12);
});
it('does not execute excluded grants or cyclic ancestry',()=>{
 const {c,choices}=setup();setAsiAllocation(c,choices[0].id,{str:2});const id=c.asiAllocations!.bindings[0].selectionId;expect(evaluate(c,new Set([id])).abilities.str).toBe(10);c.selections[0].parentId=id;expect(evaluate(c).abilities.str).toBe(10);expect(asiAllocationStatus(c,choices[0].id).active).toBe(false);
});

it('does not let a later edit silently deactivate another valid grant at the cap',()=>{
 const {c,choices}=setup();c.abilities.str=18;setAsiAllocation(c,choices[1].id,{str:2});const before=JSON.stringify(c);expect(()=>setAsiAllocation(c,choices[0].id,{str:2})).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it('suspends stale allocations even before reconciliation and keeps them through disabled downgrade/reopen',()=>{
 const {c,choices,entries}=setup();setAsiAllocation(c,choices[1].id,{dex:2});c.selections[0].level=3;expect(evaluate(c).abilities.dex).toBe(10);c.automation!.enabled=false;syncFeatures(c,entries);const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.selections[0].level=6;restored.automation!.enabled=true;syncFeatures(restored,entries);expect(evaluate(restored).abilities.dex).toBe(12);
});
