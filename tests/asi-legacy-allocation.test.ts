import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';
import {asiAllocationStatus,setAsiAllocation} from '../src/core/automation/asi';
export function legacySetup(){
 const entries=normalizeData({class:[{name:'战士',ENG_name:'Fighter',source:'PHB',classFeatures:[4,6].map(n=>`属性值提升|战士||${n}`)}],classFeature:[4,6].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'战士',classSource:'PHB',level,entries:[]})),feat:[{name:'替代专长',source:'PHB',entries:[]}]},'legacy-asi');
 const c=newCharacter();c.edition='2014';c.automation=newAutomationState();c.selections=[{id:'fighter',entry:entries.find(e=>e.kind==='class')!,level:6,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choices=sheetChoices(c,entries).filter(x=>x.id.includes(':class-legacy-feat:'));for(const choice of choices)setSheetChoiceSlot(c,choice.id,0,choice.options.find(o=>o.entry.raw._classAbilityRecord)!.value,entries);
 return {c,entries,choices};
}
it('legacy allocations remain opt-in per genuine source-feature instance and never grant a feat',()=>{
 const {c,choices}=legacySetup();expect(c.asiAllocations).toBeUndefined();expect(evaluate(c).abilities.str).toBe(10);expect(asiAllocationStatus(c,choices[0].id).eligible).toBe(true);
 const scores=JSON.stringify(c.abilities);setAsiAllocation(c,choices[0].id,{str:2});setAsiAllocation(c,choices[1].id,{dex:1,con:1});expect(evaluate(c).abilities).toMatchObject({str:12,dex:11,con:11});expect(c.selections.some(s=>s.entry.kind==='feat')).toBe(false);expect(JSON.stringify(c.abilities)).toBe(scores);expect(evaluate(validateCharacter(JSON.parse(JSON.stringify(c)))).abilities.str).toBe(12);
});
it('legacy cap and withdrawal are atomic and protect other grants',()=>{
 const {c,choices}=legacySetup();c.abilities.str=18;setAsiAllocation(c,choices[1].id,{str:2});const before=JSON.stringify(c);expect(()=>setAsiAllocation(c,choices[0].id,{str:2})).toThrow();expect(JSON.stringify(c)).toBe(before);c.abilities.str=19;expect(evaluate(c).abilities.str).toBe(19);setAsiAllocation(c,choices[1].id,null);expect(c.asiAllocations?.bindings).toHaveLength(0);
});
it('legacy alternative feat, source disable, global disable and dismiss suspend without changing intent',()=>{
 const {c,choices,entries}=legacySetup();setAsiAllocation(c,choices[0].id,{str:2});const saved=JSON.stringify(c.asiAllocations);const plan=choices[0].options.find(o=>o.entry.raw._classAbilityRecord)!.value;c.profile.optional.feats=true;setSheetChoiceSlot(c,choices[0].id,0,entries.find(e=>e.kind==='feat')!.id,entries);expect(evaluate(c).abilities.str).toBe(10);setSheetChoiceSlot(c,choices[0].id,0,plan,entries);expect(evaluate(c).abilities.str).toBe(12);c.profile.enabledSources=[];expect(evaluate(c).abilities.str).toBe(10);c.profile.enabledSources=['PHB'];c.automation!.enabled=false;expect(evaluate(c).abilities.str).toBe(10);c.automation!.enabled=true;expect(evaluate(c).abilities.str).toBe(12);removeSelection(c,c.asiAllocations!.bindings[0].selectionId);syncFeatures(c,entries);expect(evaluate(c).abilities.str).toBe(10);expect(JSON.stringify(c.asiAllocations)).toBe(saved);
});
it.each([false,true])('legacy downgrade preserves exact source tree and offline restore with automation disabled=%s',off=>{
 const {c,choices}=legacySetup();setAsiAllocation(c,choices[1].id,{dex:2});const id=c.asiAllocations!.bindings[0].selectionId,root=c.selections.find(r=>r.id===id)!;root.entry.entries.push('keep');c.notes='manual notes';c.runtime.resources.keep={current:3,max:5};c.selections.push({id:'manual-child',entry:{...root.entry,id:'manual',raw:{},english:'Manual',name:'Manual'},level:1,quantity:1,equipped:false,parentId:id});const tree=JSON.stringify(c.selections.filter(r=>r.id===id||r.parentId===id));c.automation!.enabled=!off;c.selections[0].level=4;syncFeatures(c,[]);expect(evaluate(c).abilities.dex).toBe(10);expect(c.selections.some(r=>r.id===id)).toBe(false);const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));reopened.automation!.enabled=true;reopened.selections[0].level=6;syncFeatures(reopened,[]);expect(evaluate(reopened).abilities.dex).toBe(12);expect(JSON.stringify(reopened.selections.filter(r=>r.id===id||r.parentId===id))).toBe(tree);expect(reopened.notes).toBe('manual notes');expect(reopened.runtime.resources.keep).toEqual({current:3,max:5});expect(syncFeatures(reopened,[])).toBe(false);
});
it.each(['owner','english','source','edition','copy','parent','grant','declared','answer','effects','choices','level','duplicate','binding-kind'] as const)('legacy identity fails closed for %s',mode=>{
 const {c,choices}=legacySetup();setAsiAllocation(c,choices[0].id,{str:2});const feature=c.selections.find(r=>r.id===c.asiAllocations!.bindings[0].selectionId)!;
 if(mode==='owner')c.selections[0].entry.english='Unknown';if(mode==='english')feature.entry.english='Unknown';if(mode==='source')feature.entry.source='TCE';if(mode==='edition')feature.entry.edition='2024';if(mode==='copy')feature.entry.raw._copy={};if(mode==='parent')feature.parentId='missing';if(mode==='grant')feature.grantKey='ref:fake';if(mode==='declared')c.selections[0].entry.raw.classFeatures=[];if(mode==='answer')c.answers[choices[0].id]=[];if(mode==='effects')feature.entry.effects=[{op:'add',target:'str',value:0}];if(mode==='choices')feature.entry.choices=[{} as any];if(mode==='level')c.selections[0].level=3;if(mode==='duplicate')c.selections.push({...feature,id:'duplicate'});if(mode==='binding-kind')delete (c.asiAllocations!.bindings[0] as any).kind;
 expect(evaluate(c).abilities.str).toBe(10);expect(asiAllocationStatus(c,choices[0].id).active).toBe(false);
});

it.each(['PHB','TCE'] as const)('authenticates actual %s browser fixture source guard',async(source)=>{
 const {legacyAsiAllocationFixture,legacyAsiAllocationData}=await import('./e2e/asiAllocationFixture');const c=legacyAsiAllocationFixture(source),entries=normalizeData(legacyAsiAllocationData(source),'browser-fixture');syncFeatures(c,entries);const choices=sheetChoices(c,entries).filter(row=>row.id.includes(':class-legacy-feat:'));expect(choices.length).toBe(source==='PHB'?2:1);for(const choice of choices){setSheetChoiceSlot(c,choice.id,0,choice.options.find(option=>option.entry.raw._classAbilityRecord)!.value,entries);expect(asiAllocationStatus(c,choice.id).eligible).toBe(true);}setAsiAllocation(c,choices[0].id,{str:2});expect(evaluate(c).abilities.str).toBe(c.abilities.str+2);
});

it('withdrawing a parked allocation preserves the original feature tree for later unallocated restore',()=>{
 const {c,choices}=legacySetup();setAsiAllocation(c,choices[1].id,{dex:2});const id=c.asiAllocations!.bindings[0].selectionId;c.selections[0].level=4;syncFeatures(c,[]);setAsiAllocation(c,choices[1].id,null);const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));reopened.selections[0].level=6;syncFeatures(reopened,[]);expect(reopened.selections.some(row=>row.id===id)).toBe(true);expect(evaluate(reopened).abilities.dex).toBe(10);
});

it('does not replace a parked legacy instance on source-disabled upgrade with full catalog',()=>{
 const {c,entries,choices}=legacySetup();setAsiAllocation(c,choices[1].id,{dex:2});const id=c.asiAllocations!.bindings[0].selectionId;c.selections[0].level=4;syncFeatures(c,entries);c.profile.enabledSources=[];c.selections[0].level=6;syncFeatures(c,entries);expect(c.selections.some(row=>row.entry.raw.level===6)).toBe(false);c.profile.enabledSources=['PHB'];syncFeatures(c,entries);expect(c.selections.some(row=>row.id===id)).toBe(true);expect(evaluate(c).abilities.dex).toBe(12);
});

it('does not consume a malformed cyclic class owner while parking a legacy source',()=>{
 const {c,choices}=legacySetup();setAsiAllocation(c,choices[1].id,{dex:2});const id=c.asiAllocations!.bindings[0].selectionId;c.selections[0].parentId=id;c.selections[0].level=4;syncFeatures(c,[]);expect(c.selections.some(row=>row.id==='fighter')).toBe(true);expect(c.selections.some(row=>row.id===id)).toBe(true);expect(c.classChoiceArchive).toBeUndefined();expect(evaluate(c).abilities.dex).toBe(10);
});
