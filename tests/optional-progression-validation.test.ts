import {it,expect} from 'vitest';
import evidence from '../src/core/automation/classChoiceEvidence.json';
import {sourceProgressionCount} from '../src/core/automation/sourceClassChoices';
import {optionalChoiceSupport} from '../src/core/automation/classChoiceSupport';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {validateCharacter} from '../src/core/validation';

const reviewed=evidence.optionalProgressions.find(row=>row.owner==='Warlock|XPHB')!.progression;
const invalid:{name:string;value:unknown}[]=[
 {name:'reported truncated table',value:[1,3,null]},
 {name:'19 levels',value:reviewed.slice(0,19)},
 {name:'21 levels',value:[...reviewed,10]},
 ...[null,undefined,'10',-1,101,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1].map(value=>({name:`invalid future count ${String(value)}`,value:reviewed.map((n,i)=>i===19?value:n)})),
 {name:'invalid earlier level',value:reviewed.map((n,i)=>i===0?null:n)},
 {name:'a hole outside the current level',value:Object.assign(new Array(20),{1:3})},
];
function setup(progression:unknown=reviewed.slice()){
 const entries=normalizeData({class:[{name:'原创成长职业',ENG_name:'Warlock',source:'XPHB',optionalfeatureProgression:[{name:'原创学习记录',featureType:['EI'],progression}]}],optionalfeature:[{name:'原创学习选项',ENG_name:'Authored Learning Option',source:'XPHB',featureType:['EI'],entries:[]}]},'authored-progression-validation');
 const c=newCharacter();c.automation=newAutomationState();c.notes='手工记录保留';c.runtime.hp=3;c.selections=[{id:'owner',entry:entries.find(e=>e.kind==='class')!,level:2,quantity:1,equipped:false}];
 return {c,entries,owner:c.selections[0].entry,option:entries.find(e=>e.raw._category==='optionalfeature')!};
}

it.each(invalid)('rejects the whole array despite a valid level-two cell: $name',({value})=>{
 expect(sourceProgressionCount(value,2)).toBeUndefined();
 const {c,entries}=setup(value),before=JSON.stringify(c),choice=sheetChoices(c,entries).find(row=>row.sourceProgression==='optional')!;
 expect(choice.count).toBe(0);expect(choice.options).toEqual([]);expect(choice.selected).toEqual([]);
 expect(choice.support).toMatchObject({rule:'pending',execution:'unavailable',publication:'unverified'});
 expect(choice.hint).toContain('已有记录保留');expect(JSON.stringify(c)).toBe(before);
});

it.each([0,21,1.5,NaN])('rejects an invalid class level %s even for a complete array',at=>{
 expect(sourceProgressionCount(reviewed,at)).toBeUndefined();
});

it('keeps all complete reviewed quotas and the existing sparse object lookup',()=>{
 expect(reviewed.map((_,i)=>sourceProgressionCount(reviewed,i+1))).toEqual(reviewed);
 expect(sourceProgressionCount({'1':1,'4':3},2)).toBe(1);
 const {c,entries}=setup(),choice=sheetChoices(c,entries).find(row=>row.sourceProgression==='optional')!;
 expect(choice.count).toBe(3);expect(choice.slots).toEqual(['','','']);
 expect(choice.support).toMatchObject({rule:'verified',execution:'record-only',publication:'unverified'});
});

it('does not verify a complete source table that differs from reviewed evidence at another level',()=>{
 const changed=reviewed.map((n,i)=>i===19?n-1:n),{c,entries}=setup(changed),choice=sheetChoices(c,entries).find(row=>row.sourceProgression==='optional')!;
 expect(sourceProgressionCount(changed,2)).toBe(3);expect(choice.count).toBe(3);
 expect(choice.support).toMatchObject({rule:'source-declared',execution:'record-only',publication:'unverified'});
});

it('the support boundary independently rejects incomplete evidence even with a supplied matching current count',()=>{
 const {owner}=setup();
 expect(optionalChoiceSupport(owner,['EI'],3,2,[1,3,null])).toMatchObject({rule:'pending',execution:'unavailable'});
 expect(optionalChoiceSupport(owner,['EI'],3,2,{'2':3}).rule).toBe('source-declared');
});

it('retains existing answers and snapshots through invalidation, export/import and source repair without granting effects',()=>{
 const {c,entries,owner,option}=setup(),id='owner:class-optional:0';
 setSheetChoiceSlot(c,id,1,option.id,entries);syncChoiceContent(c,entries);
 const saved=structuredClone({answers:c.answers,snapshots:c.classChoiceSnapshots,abilities:c.abilities,runtime:c.runtime,notes:c.notes,selections:c.selections});
 owner.raw.optionalfeatureProgression[0].progression=[1,3,null];
 const imported=validateCharacter(JSON.parse(JSON.stringify(c))),before=JSON.stringify(imported);
 const blocked=sheetChoices(imported,[]).find(row=>row.id===id)!;
 expect(blocked.count).toBe(0);expect(blocked.slots).toEqual(['',option.id,'']);expect(blocked.selected).toEqual([]);expect(blocked.options).toEqual([]);
 expect(blocked.support).toMatchObject({rule:'pending',execution:'unavailable'});
 expect(()=>setSheetChoiceSlot(imported,id,1,option.id,entries)).toThrow();
 syncChoiceContent(imported,[]);expect(JSON.stringify(imported)).toBe(before);
 expect(imported.answers).toEqual(saved.answers);expect(imported.classChoiceSnapshots).toEqual(saved.snapshots);
 expect(imported.abilities).toEqual(saved.abilities);expect(imported.runtime).toEqual(saved.runtime);expect(imported.notes).toBe(saved.notes);expect(imported.selections).toHaveLength(1);
 imported.selections[0].entry.raw.optionalfeatureProgression[0].progression=reviewed.slice();
 const restored=sheetChoices(imported,[]).find(row=>row.id===id)!;
 expect(restored.count).toBe(3);expect(restored.selected).toEqual([option.id]);expect(restored.slots).toEqual(['',option.id,'']);
 syncChoiceContent(imported,[]);expect(imported.answers).toEqual(saved.answers);expect(imported.selections).toHaveLength(1);expect(imported.runtime).toEqual(saved.runtime);
});
