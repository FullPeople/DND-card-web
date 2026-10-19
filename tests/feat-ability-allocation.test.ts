import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,ABILITIES} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,chooseSheetOption,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

// Authored metadata only. No publisher prose or player data.
function setup(){
 const entries=normalizeData({class:[{name:'Allocation Class',source:'XPHB',classFeatures:[4,6].map(n=>`Allocation Grant|Allocation Class|XPHB|${n}`)}],classFeature:[4,6].map(level=>({name:'Allocation Grant',source:'XPHB',className:'Allocation Class',classSource:'XPHB',level,entries:['{@feat Ability Score Improvement|XPHB}']})),feat:[{name:'Ability Score Improvement',source:'XPHB',category:'G',repeatable:true,prerequisite:[{level:4}],ability:[{choose:{from:[...ABILITIES],amount:2},hidden:true},{choose:{from:[...ABILITIES],count:2},hidden:true}],entries:[]},{name:'Alternative Feat',source:'XPHB',category:'G',entries:[]}]},'allocation-contract');
 const c=newCharacter('2024');c.automation=newAutomationState();c.abilities.str=16;c.abilities.dex=13;c.notes='Retain manual notes';c.runtime.hp=3;
 c.selections=[{id:'owner',entry:entries.find(e=>e.kind==='class')!,level:6,quantity:1,equipped:false}];
 const grants=sheetChoices(c,entries).filter(q=>q.sourceProgression==='feat'),asi=entries.find(e=>e.english==='Ability Score Improvement')!,alternative=entries.find(e=>e.english==='Alternative Feat')!;
 setSheetChoiceSlot(c,grants[0].id,0,asi.id,entries);syncChoiceContent(c,entries);
 const allocation=()=>sheetChoices(c,entries).find(q=>q.id.endsWith(':feat-abilities'))!;
 return {c,entries,grants,asi,alternative,allocation};
}
it('offers the 21 source allocations only after a chosen ASI, applying the confirmed allocation to derived values',()=>{
 const {c,entries,allocation}=setup(),base=JSON.stringify(c.abilities),runtime=JSON.stringify(c.runtime),choice=allocation();
 expect(choice).toBeDefined();expect(choice.options).toHaveLength(21);expect(evaluate(c).abilities.str).toBe(16);
 chooseSheetOption(c,choice.id,'str:2',entries);expect(evaluate(c).abilities.str).toBe(18);expect(evaluate(c).modifiers.str).toBe(4);expect(evaluate(c).skills.athletics.value).toBe(4);
 chooseSheetOption(c,choice.id,'str:1|dex:1',entries);expect(evaluate(c).abilities).toMatchObject({str:17,dex:14});expect(evaluate(c).ac).toBe(12);
 expect(JSON.stringify(c.abilities)).toBe(base);expect(JSON.stringify(c.runtime)).toBe(runtime);expect(c.notes).toBe('Retain manual notes');
});
it('persists offline, toggles off without residue, and never infers an allocation from old manual scores',()=>{
 const {c,entries,allocation}=setup(),id=allocation().id;c.abilities.str=18;
 expect(evaluate(validateCharacter(JSON.parse(JSON.stringify(c))))).toMatchObject({abilities:{str:18}});
 chooseSheetOption(c,id,'str:2',entries);const restored=validateCharacter(JSON.parse(JSON.stringify(c))),bytes=JSON.stringify(restored);
 expect(sheetChoices(restored,[]).find(q=>q.id===id)?.selected).toEqual(['str:2']);expect(evaluate(restored).abilities.str).toBe(20);expect(syncChoiceContent(restored,[])).toBe(false);expect(JSON.stringify(restored)).toBe(bytes);
 chooseSheetOption(restored,id,'str:2',[]);expect(evaluate(restored).abilities.str).toBe(18);expect(restored.answers[id]).toEqual([]);
});
it('parks an allocation with its grant through replacement and downgrade, without deleting manual children or answers',()=>{
 const {c,entries,grants,asi,alternative,allocation}=setup(),id=allocation().id;
 chooseSheetOption(c,id,'str:2',entries);const feat=c.selections.find(row=>row.entry.id===asi.id)!;
 c.selections.push({id:'manual-child',entry:{...alternative,id:'manual-child-entry',kind:'feature'},parentId:feat.id,level:1,quantity:1,equipped:false});
 setSheetChoiceSlot(c,grants[0].id,0,alternative.id,entries);syncChoiceContent(c,entries);expect(evaluate(c).abilities.str).toBe(16);expect(c.answers[id]).toEqual(['str:2']);
 setSheetChoiceSlot(c,grants[0].id,0,asi.id,entries);syncChoiceContent(c,entries);expect(evaluate(c).abilities.str).toBe(18);expect(c.selections.some(row=>row.id==='manual-child')).toBe(true);
 c.selections[0].level=3;syncChoiceContent(c,entries);expect(evaluate(c).abilities.str).toBe(16);expect(c.answers[id]).toEqual(['str:2']);
 c.selections[0].level=6;syncChoiceContent(c,entries);expect(evaluate(c).abilities.str).toBe(18);expect(c.selections.filter(row=>row.id===feat.id)).toHaveLength(1);
});
it('caps each score at 20 across independent repeatable grants and preserves scores already above 20',()=>{
 const {c,entries,grants,asi,allocation}=setup();c.abilities.str=19;chooseSheetOption(c,allocation().id,'str:2',entries);
 setSheetChoiceSlot(c,grants[1].id,0,asi.id,entries);syncChoiceContent(c,entries);const allocations=sheetChoices(c,entries).filter(q=>q.id.endsWith(':feat-abilities'));expect(allocations).toHaveLength(2);
 chooseSheetOption(c,allocations[1].id,'str:2',entries);expect(evaluate(c).abilities.str).toBe(20);c.abilities.str=22;expect(evaluate(c).abilities.str).toBe(22);
 c.profile.enabledSources=[];expect(evaluate(c).abilities.str).toBe(22);expect(c.answers[allocations[1].id]).toEqual(['str:2']);
});
it('rejects foreign, incomplete, explicit-effect, inherited and tampered allocations without activating raw ability metadata',()=>{
 const {c,entries,allocation}=setup(),choice=allocation();expect(choice).toBeDefined();const feat=c.selections.find(row=>row.entry.kind==='feat')!;
 for(const change of [{source:'PHB'},{name:'Unreviewed Improvement',english:'Unreviewed Improvement',raw:{...feat.entry.raw,name:'Unreviewed Improvement',ENG_name:'Unreviewed Improvement'}},{raw:{...feat.entry.raw,ability:[feat.entry.raw.ability[0]]}},{raw:{...feat.entry.raw,_copy:{name:'x'}}},{effects:[{op:'add' as const,target:'str',value:1}]}]){
  const trial=structuredClone(c),row=trial.selections.find(s=>s.id===feat.id)!;Object.assign(row.entry,change);expect(sheetChoices(trial,entries).filter(q=>q.id.endsWith(':feat-abilities'))).toHaveLength(0);
 }
 c.answers[choice.id]=['str:99'];expect(evaluate(c).abilities.str).toBe(16);c.answers[choice.id]=['str:2','dex:2'];expect(evaluate(c).abilities.str).toBe(16);
 expect(()=>chooseSheetOption(c,choice.id,'str:99',entries)).toThrow();
 c.answers[choice.id]=['str:2'];c.automation!.enabled=false;expect(evaluate(c).abilities.str).toBe(16);
});
it('disables only automatic increases when sources or automation are disabled, retaining the saved allocation',()=>{
 const {c,entries,allocation}=setup(),id=allocation().id;chooseSheetOption(c,id,'str:2',entries);
 c.profile.enabledSources=[];expect(evaluate(c).abilities.str).toBe(16);expect(sheetChoices(c,[]).find(q=>q.id===id)?.restricted).toBe(true);
 c.profile.enabledSources=['XPHB'];expect(evaluate(c).abilities.str).toBe(18);c.automation!.enabled=false;expect(evaluate(c).abilities.str).toBe(16);
 c.automation!.enabled=true;expect(evaluate(c).abilities.str).toBe(18);expect(c.answers[id]).toEqual(['str:2']);
});
const inputRoot=process.env.DND_AUTOMATION_INPUTS;
it('caps innate increases after racial bonuses and before an equipment score override',()=>{
 const {c,entries,allocation}=setup();c.abilities.str=17;
 const race=normalizeData({race:[{name:'Authored Race',source:'XPHB',ability:[{str:2}]}]},'asi-race')[0];c.selections.push({id:'race',entry:race,level:1,quantity:1,equipped:false});
 chooseSheetOption(c,allocation().id,'str:2',entries);expect(evaluate(c).abilities.str).toBe(20);
 const item={...race,id:'item-override',kind:'item' as const,raw:{},effects:[{op:'set' as const,target:'str',value:19}]};c.selections.push({id:'item',entry:item,level:1,quantity:1,equipped:true});expect(evaluate(c).abilities.str).toBe(19);
});
it.skipIf(!inputRoot)('uses the frozen XPHB Fighter grant and actual ASI metadata through saving and offline re-evaluation',()=>{
 const index=JSON.parse(readFileSync(join(inputRoot!,'index.json'),'utf8'));
 const bodies=['/data/feats.json','/data/class/class-fighter.json'].map(suffix=>{
  const row=index.rows.find((row:any)=>row.url.endsWith(suffix));expect(row).toBeDefined();const bytes=readFileSync(join(inputRoot!,row.path));
  expect(createHash('sha256').update(JSON.stringify(JSON.parse(bytes.toString('utf8')))).digest('hex')).toBe(row.sha256);return JSON.parse(bytes.toString('utf8'));
 });
 const entries=bodies.flatMap(body=>normalizeData(body,'frozen-asi-source')),c=newCharacter('2024');c.automation=newAutomationState();c.abilities.str=16;
 c.selections=[{id:'source-fighter',entry:entries.find(entry=>entry.kind==='class'&&entry.source==='XPHB')!,level:4,quantity:1,equipped:false}];
 const asi=entries.find(entry=>entry.kind==='feat'&&entry.english==='Ability Score Improvement'&&entry.source==='XPHB')!,grant=sheetChoices(c,entries).find(q=>q.id.includes(':class-typed-feat:'))!;
 expect(grant).toBeDefined();setSheetChoiceSlot(c,grant.id,0,asi.id,entries);syncChoiceContent(c,entries);
 const allocation=sheetChoices(c,entries).find(q=>q.id.endsWith(':feat-abilities'))!;expect(allocation.options).toHaveLength(21);chooseSheetOption(c,allocation.id,'str:2',entries);
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));expect(evaluate(restored).abilities.str).toBe(18);expect(sheetChoices(restored,[]).find(q=>q.id===allocation.id)!.selected).toEqual(['str:2']);
});
