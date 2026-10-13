import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {sourceSpellEnabled,sourceSpellResourceEnabled,rememberSourceSpellUses} from '../src/core/automation/sourceSpellState';
import {changeSpecialSpellUses,specialSpellResource,setSpecialSpell} from '../src/core/specialSpells';
import {classPoolKey} from '../src/core/automation/sourceResourcePools';
import {syncAutoResources} from '../src/core/resources';
import {readCharacter,validateCharacter} from '../src/core/validation';
import {exportCharacter,exportOwlbear} from '../src/core/export';
import {evaluate} from '../src/core/engine';

const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,kind,name:id,english:id,source:'XPHB',edition:'2024',packId:'authored-lifecycle',revision:'1',entries:[],raw});
const spell=entry('Authored Gift Spell','spell',{level:1});
const feat=entry('Authored Spell Gift','feat',{category:'G',additionalSpells:[{innate:{'_':{daily:{'2':[spell.name+'|XPHB']}}}}]});
const alternate=entry('Authored Alternate','feat',{category:'G'});
function setup(kind:'class'|'race'){
 const c=newCharacter();c.automation=newAutomationState();c.notes='Unrelated authored notes';c.runtime.hp=7;
 const owner=entry('Authored Owner',kind,kind==='class'?{featProgression:[{name:'Authored choice',category:['G'],progression:{4:1}}]}:{});
 if(kind==='race')owner.choices=[{id:'gift',label:'Authored choice',kind:'feat',count:1,options:[feat.id,alternate.id]}];
 c.selections=[{id:'owner',entry:owner,level:4,quantity:1,equipped:false}];
 const catalog=[owner,feat,alternate,spell],choice=sheetChoices(c,catalog).find(row=>row.channel==='content')!;
 setSheetChoiceSlot(c,choice.id,0,feat.id,catalog);syncFeatures(c,catalog);syncSourceSpells(c,catalog);syncAutoResources(c);
 const gift=c.selections.find(row=>row.entry.kind==='feat')!,granted=c.selections.find(row=>row.entry.kind==='spell')!;
 changeSpecialSpellUses(c,granted.id,1);
 c.selections.push({id:'ordinary-copy',entry:structuredClone(spell),quantity:1,level:1,equipped:false});
 c.runtime.resources.unrelated={name:'Manual record',max:9,current:3};
 return {c,catalog,choice,gift,granted,key:specialSpellResource(granted.id,c)};
}
function edit(c:Character,catalog:Entry[],action:(draft:Character)=>void){
 const next=structuredClone(c);rememberSourceSpellUses(next);action(next);syncFeatures(next,catalog);syncSourceSpells(next,catalog);syncAutoResources(next,c);return next;
}
const roundtrip=(c:Character)=>readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
describe('source spells survive content-choice lifecycle and native persistence',()=>{
 it.each(['clear','replace','lower'] as const)('retains inactive class spell snapshots and spent uses after %s, reload and restoration',action=>{
  const {c,catalog,choice,gift,granted,key}=setup('class');validateCharacter(c);
  const next=edit(c,catalog,draft=>action==='lower'?draft.selections[0].level=3:setSheetChoiceSlot(draft,choice.id,0,action==='replace'?alternate.id:undefined,catalog));
  expect(next.classChoiceArchive?.[gift.id].selections.some(row=>row.id===granted.id)).toBe(true);
  expect(next.selections.some(row=>row.id===granted.id)).toBe(false);expect(sourceSpellEnabled(next,granted.id)).toBe(false);
  const restored=roundtrip(next);expect(restored.spellSettings!.special![granted.id]).toEqual(c.spellSettings!.special![granted.id]);
  expect(restored.runtime.resources[key].current).toBe(1);expect(exportOwlbear(restored,evaluate(restored)).spellcasting.always_known.some(row=>row.selectionId===granted.id)).toBe(false);
  const back=edit(restored,catalog,draft=>action==='lower'?draft.selections[0].level=4:setSheetChoiceSlot(draft,choice.id,0,feat.id,catalog));
  expect(roundtrip(back).selections.find(row=>row.id===granted.id)).toEqual(granted);expect(back.runtime.resources[key].current).toBe(1);
  expect(back.selections.some(row=>row.id==='ordinary-copy')).toBe(true);expect(back.notes).toBe(c.notes);expect(back.runtime.resources.unrelated).toEqual(c.runtime.resources.unrelated);
 });
 it.each(['clear','replace'] as const)('cleans only removed ordinary-choice spell settings after %s, keeping its spent ledger',action=>{
  const {c,catalog,choice,granted,key}=setup('race');validateCharacter(c);
  const next=edit(c,catalog,draft=>setSheetChoiceSlot(draft,choice.id,0,action==='replace'?alternate.id:undefined,catalog));
  expect(next.selections.some(row=>row.id===granted.id)).toBe(false);
  const restored=roundtrip(next);expect(restored.spellSettings!.special?.[granted.id]).toBeUndefined();expect(restored.runtime.resources[key]).toBeUndefined();
  expect(restored.selections.some(row=>row.id==='ordinary-copy')).toBe(true);expect(restored.runtime.resources.unrelated).toEqual(c.runtime.resources.unrelated);
  const back=edit(restored,catalog,draft=>setSheetChoiceSlot(draft,choice.id,0,feat.id,catalog));expect(roundtrip(back).runtime.resources[key].current).toBe(1);
 });
 it('keeps direct selection removal valid and rejects genuinely orphaned configurations',()=>{
  const {c,catalog,gift,granted}=setup('class');const removed=edit(c,catalog,draft=>removeSelection(draft,gift.id));
  expect(()=>roundtrip(removed)).not.toThrow();
  const corrupt=structuredClone(c);corrupt.selections=corrupt.selections.filter(row=>row.id!==granted.id);expect(()=>roundtrip(corrupt)).toThrow('固定与次数法术设置无效');
 });
 it.each([false,true])('preserves an archived manual spell configuration, manualSource=%s, without allowing use',linked=>{
  const {c,catalog,choice,gift}=setup('class');
  c.selections.push({id:'manual-gift',entry:structuredClone(spell),parentId:gift.id,level:1,quantity:1,equipped:false});
  setSpecialSpell(c,'manual-gift',{mode:'uses',max:3,...(linked?{manualSource:{ownerId:gift.id}}:{})});
  changeSpecialSpellUses(c,'manual-gift',1);validateCharacter(c);
  const next=roundtrip(edit(c,catalog,draft=>setSheetChoiceSlot(draft,choice.id,0,undefined,catalog)));
  const key=specialSpellResource('manual-gift',next);expect(next.runtime.resources[key].current).toBe(1);
  expect(sourceSpellEnabled(next,'manual-gift')).toBe(false);expect(sourceSpellResourceEnabled(next,key)).toBe(false);
  changeSpecialSpellUses(next,'manual-gift',3);expect(next.runtime.resources[key].current).toBe(1);
  const restored=roundtrip(edit(next,catalog,draft=>setSheetChoiceSlot(draft,choice.id,0,feat.id,catalog)));
  expect(restored.spellSettings!.special!['manual-gift']).toEqual(c.spellSettings!.special!['manual-gift']);expect(restored.runtime.resources[key].current).toBe(1);
 });
 it.each(['unknown-mode','bad-max','bad-recovery','invalid-archive','missing-spell','missing-manual-owner'] as const)('still rejects %s in archived spell records',kind=>{
  const {c,catalog,choice,granted,gift}=setup('class');
  const next=edit(c,catalog,draft=>setSheetChoiceSlot(draft,choice.id,0,undefined,catalog));
  const config=next.spellSettings!.special![granted.id];
  if(kind==='unknown-mode')config.mode='unknown' as any;
  if(kind==='bad-max')config.max=0;
  if(kind==='bad-recovery')config.recovery='instant' as any;
  if(kind==='invalid-archive')next.classChoiceArchive![gift.id].selections[1].parentId='unrelated';
  if(kind==='missing-spell')next.classChoiceArchive![gift.id].selections=next.classChoiceArchive![gift.id].selections.filter(row=>row.id!==granted.id);
  if(kind==='missing-manual-owner'){delete config.sourceGrant;config.manualSource={ownerId:'missing'};}
  expect(()=>roundtrip(next)).toThrow();
 });
 it('cleans archived spell settings when its original class is explicitly deleted',()=>{
  const {c,catalog,choice,granted,key}=setup('class');
  const parked=roundtrip(edit(c,catalog,draft=>setSheetChoiceSlot(draft,choice.id,0,undefined,catalog)));
  const removed=roundtrip(edit(parked,catalog,draft=>removeSelection(draft,'owner')));
  expect(removed.classChoiceArchive).toBeUndefined();expect(removed.spellSettings!.special?.[granted.id]).toBeUndefined();expect(removed.runtime.resources[key]).toBeUndefined();
  expect(removed.selections.some(row=>row.id==='ordinary-copy')).toBe(true);expect(removed.runtime.resources.unrelated).toEqual(c.runtime.resources.unrelated);
 });
 it('validates archived resource spell ownership against retained ancestry, rejecting another class pool',()=>{
  const {c,catalog,choice,granted,gift}=setup('class');
  const owner=c.selections[0],key=classPoolKey(c,owner,'Authored Points');
  owner.entry.raw.classTableGroups=[{colLabels:['Authored Points'],rows:[[3],[3],[3],[3]]}];
  c.runtime.resources[key]={name:'Authored Points',current:1,max:3,featureGrant:{ownerId:owner.id,ruleMax:3,manualMax:false,spent:2,recovery:{},origin:'Authored',classPool:{entryId:owner.entry.id,label:'Authored Points'}}};
  c.spellSettings!.special![granted.id]={mode:'locked',sourceGrant:{ownerId:gift.id,key:'source-spell:0/innate/_/resource/1',active:true,usage:'resource',resourceKey:key,resourceName:'Authored Points',resourceCost:1}};
  // Keep the archived source snapshot as it was saved before loading; no sync
  // may replace it with current catalog data during this validation regression.
  setSheetChoiceSlot(c,choice.id,0,undefined,catalog);syncFeatures(c,catalog);
  expect(()=>roundtrip(c)).not.toThrow();
  const other={...structuredClone(owner),id:'other-owner',entry:{...structuredClone(owner.entry),id:'other-class'}};c.selections.push(other);
  const otherKey=classPoolKey(c,other,'Authored Points');c.runtime.resources[otherKey]={...structuredClone(c.runtime.resources[key]),featureGrant:{...c.runtime.resources[key].featureGrant!,ownerId:other.id,classPool:{entryId:other.entry.id,label:'Authored Points'}}};
  c.spellSettings!.special![granted.id].sourceGrant!.resourceKey=otherKey;
  expect(()=>roundtrip(c)).toThrow('资源归属');
 });
 it('does not remove an independent source grant for the same spell when an ordinary choice is cleared',()=>{
  const {c,catalog,choice,granted}=setup('race');
  c.selections.push({id:'independent-source',entry:structuredClone(feat),level:1,quantity:1,equipped:false});syncSourceSpells(c,catalog);
  const other=c.selections.find(row=>row.parentId==='independent-source'&&row.entry.kind==='spell')!;
  changeSpecialSpellUses(c,other.id,0);const config=structuredClone(c.spellSettings!.special![other.id]),key=specialSpellResource(other.id,c);
  const next=roundtrip(edit(c,catalog,draft=>setSheetChoiceSlot(draft,choice.id,0,undefined,catalog)));
  expect(next.spellSettings!.special?.[granted.id]).toBeUndefined();expect(next.selections.find(row=>row.id===other.id)).toEqual(other);
  expect(next.spellSettings!.special![other.id]).toEqual(config);expect(next.runtime.resources[key].current).toBe(0);
 });
});
