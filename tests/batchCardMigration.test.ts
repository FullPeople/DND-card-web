import {irFixture} from './helpers/irFixture';
import {irCharacter as newCharacter} from './helpers/irFixture';
import {describe,it,expect} from 'vitest';
import {type Character,type Entry,type Kind,type Selection} from '../src/core/model';
import {planBatchCardMigration,suggestedBatchRoots} from '../src/core/batchCardMigration';
import {migrationStillCurrent} from '../src/core/classMigration';
import {spellState} from '../src/core/characterDetails';
import {readCharacter} from '../src/core/validation';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {newAutomationState} from '../src/core/automation/state';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
const entry=(id:string,kind:Kind,edition:'2014'|'2024',raw:Entry['raw']={}):Entry=>(irFixture({id,kind,edition,raw,name:id.split(':')[0],english:id.split(':')[0],source:edition==='2014'?'PHB':'XPHB',packId:'fixture',revision:'1',entries:['原创批量迁移验收']}));
const row=(id:string,entry:Entry,extra:Partial<Selection>={}):Selection=>({id,entry,quantity:1,level:1,equipped:false,...extra});
const identity={id:'batch-copy',now:'2026-10-02T00:00:00Z'};
function fixture(){
 const cls24=entry('Mage:24','class','2024',{hd:{faces:6},classFeatures:['Recovery|Mage|XPHB|1','OldOnly|Mage|XPHB|1'],casterProgression:'full'}),cls14=entry('Mage:14','class','2014',{hd:{faces:6},classFeatures:['Recovery|Mage|PHB|1','NewOnly|Mage|PHB|1'],casterProgression:'full'});
 const f24=entry('Recovery:24','feature','2024',{className:'Mage',classSource:'XPHB',level:1}),f14=entry('Recovery:14','feature','2014',{className:'Mage',classSource:'PHB',level:1}),oldOnly=entry('OldOnly:24','feature','2024',{className:'Mage',classSource:'XPHB',level:1}),newOnly=entry('NewOnly:14','feature','2014',{className:'Mage',classSource:'PHB',level:1}),spell24=entry('Light:24','spell','2024',{level:0}),spell14=entry('Light:14','spell','2014',{level:0});
 const c=newCharacter();c.name='Original';c.edition='2014';c.profile.enabledSources=['PHB','XPHB'];c.automation=newAutomationState();c.selections=[row('mage',cls24),row('recovery',f24,{parentId:'mage',grantKey:'ref:Recovery|Mage|XPHB|1'}),row('old-only',oldOnly,{parentId:'mage',grantKey:'ref:OldOnly|Mage|XPHB|1'}),row('manual-spell',spell24)];
 const catalog=[cls24,cls14,f24,f14,oldOnly,newOnly,spell24,spell14];return {c,catalog,cls14,f14,spell14};
}
describe('one-review rule migration',()=>{
 it('reconciles all linked features and ordinary spells when switching 2024 class to 2014',()=>{
  const {c,catalog}=fixture(),before=structuredClone(c),roots=suggestedBatchRoots(c,catalog),review=planBatchCardMigration(c,catalog,roots,{},identity),copy=review.plan.card;
  expect(roots.mage).toBe('Mage:14');expect(copy.selections.find(s=>s.id==='mage')?.entry.source).toBe('PHB');expect(copy.selections.find(s=>s.id==='recovery')).toMatchObject({entry:{id:'Recovery:14'},parentId:'mage',grantKey:'ref:Recovery|Mage|PHB|1'});
  expect(copy.selections.some(s=>s.id==='old-only')).toBe(false);expect(copy.selections.some(s=>s.entry.id==='NewOnly:14')).toBe(true);expect(copy.selections.find(s=>s.id==='manual-spell')?.entry.id).toBe('Light:14');expect(review.plan.removed).toContain('OldOnly');expect(review.retained).toEqual([]);expect(c).toEqual(before);
  const selections=structuredClone(copy.selections);syncFeatures(copy,catalog);expect(copy.selections).toEqual(selections);
 });
 it('preserves custom and ambiguous rows by default and unchecks only selected records',()=>{
  const {c,catalog}=fixture();const custom={...entry('Recovery:custom','feature','2024'),source:'CUSTOM',raw:{_custom:true}};
  c.selections.push(row('custom',custom,{parentId:'mage'}),row('orphan',entry('Unmatched:24','spell','2024')));c.selections.push(row('child',entry('Child:custom','item','2024'),{parentId:'custom',quantity:4,equipped:true}));
  const roots=suggestedBatchRoots(c,catalog),a=planBatchCardMigration(c,catalog,roots,{},identity),b=planBatchCardMigration(c,catalog,roots,{custom:false},identity),undo=planBatchCardMigration(c,catalog,roots,{},identity);
  expect(a.retained.map(r=>r.row.id)).toEqual(expect.arrayContaining(['custom','orphan','child']));expect(a.plan.card.selections.find(s=>s.id==='custom')?.entry).toEqual(custom);expect(a.plan.card.selections.find(s=>s.id==='custom')?.parentId).toBeUndefined();
  expect(b.plan.card.selections.some(s=>s.id==='custom')).toBe(false);expect(b.plan.card.selections.find(s=>s.id==='child')).toMatchObject({quantity:4,equipped:true});expect(b.plan.card.selections.find(s=>s.id==='child')?.parentId).toBeUndefined();expect(undo.plan).toEqual(a.plan);
 });
 it('retains manual decisions, spent resources, equipment and currency through persistence and repeat review',()=>{
  const {c,catalog}=fixture();c.answers={'recovery:option':['selected']};c.adjustments=[{id:'manual',reason:'玩家修正',target:'ac',value:2}];c.proficiencies={arcana:true};c.runtime.resources.manual={name:'Used',current:1,max:5};c.runtime.resources['spell-slot:1']={name:'一级',current:0,max:2};c.spellSettings={...spellState(c),capacityAdjustment:0,prepared:['manual-spell']};
  const item=entry('Claimed:24','item','2024');c.selections.push(row('owned',item,{parentId:'mage',grantKey:'equipment:0:_:0',quantity:3,equipped:true,attuned:true}));c.inventory={view:'grid',order:['owned'],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:2,pp:0},grantedCoins:{'mage|equipment:0':50}};
  const review=()=>planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity),a=review(),b=review();expect(a.plan).toEqual(b.plan);const restored=readCharacter(JSON.parse(JSON.stringify(a.plan.card))).character;
  expect(restored.answers).toEqual(c.answers);expect(restored.adjustments).toEqual(c.adjustments);expect(restored.proficiencies).toEqual(c.proficiencies);expect(restored.spellSettings?.prepared).toContain('manual-spell');expect(restored.runtime.resources.manual.current).toBe(1);expect(restored.runtime.resources['spell-slot:1'].current).toBe(0);expect(restored.inventory?.coins.gp).toBe(2);expect(restored.selections.find(s=>s.id==='owned')).toMatchObject({quantity:3,equipped:true,attuned:true});
  syncAutoResources(restored);syncFeatures(restored,catalog);expect(restored.inventory?.coins.gp).toBe(2);expect(restored.runtime.resources.manual.current).toBe(1);
 });
 it('does not reintroduce explicitly dismissed declarations across editions',()=>{
  const {c,catalog}=fixture();c.selections=c.selections.filter(s=>s.id!=='recovery');c.dismissedFeatures=['mage|ref:Recovery|Mage|XPHB|1'];const {plan}=planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity);expect(plan.card.selections.some(s=>s.entry.name==='Recovery')).toBe(false);syncFeatures(plan.card,catalog,{owners:new Set(['mage']),refresh:true});expect(plan.card.selections.some(s=>s.entry.name==='Recovery')).toBe(false);
 });
 it('reconciles generated source spells together, retaining use history and separate manual spell copies',()=>{
  const {c,catalog,cls14}=fixture();c.edition='2024';c.selections[0].entry.raw.additionalSpells=[{innate:{'1':{daily:{'1':['Light|XPHB']}}}}];Object.assign(c.selections[0].entry,irFixture(c.selections[0].entry));cls14.raw.additionalSpells=[{innate:{'1':{daily:{'1':['Light|PHB']}}}}];Object.assign(cls14,irFixture(cls14));syncSourceSpells(c,catalog);const generated=c.selections.find(s=>s.grantKey?.startsWith('source-spell:'))!;expect(generated).toBeDefined();const oldKey='innate-spell:'+generated.id;c.runtime.resources[oldKey].current=0;c.edition='2014';
  const {plan}=planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity);expect(plan.card.selections.some(s=>s.id===generated.id)).toBe(false);expect(plan.card.dismissedFeatures||[]).not.toContain('mage|'+generated.grantKey);expect(plan.card.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(2);expect(plan.card.selections.find(s=>s.id==='manual-spell')?.entry.source).toBe('PHB');expect(Object.values(plan.card.runtime.sourceSpellSpent||{})).toContain(1);expect(Object.entries(plan.card.runtime.resources).filter(([id])=>id.startsWith('innate-spell:')).every(([,r])=>r.current===0)).toBe(true);
 });
 it('does not mutate during review, rejects stale apply fingerprints, and resets changed-root results',()=>{
  const {c,catalog}=fixture(),before=structuredClone(c);const yes=planBatchCardMigration(c,catalog,{mage:'Mage:14'},{},identity),back=planBatchCardMigration(c,catalog,{mage:''},{},identity);expect(c).toEqual(before);expect(back.plan.card.selections.find(s=>s.id==='mage')?.entry.source).toBe('XPHB');expect(migrationStillCurrent(yes.plan,c)).toBe(true);c.notes='new edit';expect(migrationStillCurrent(yes.plan,c)).toBe(false);
 });
});

it('keeps old declarations when the target feature has not loaded instead of treating absence as removal',()=>{
 const {c,catalog}=fixture(),partial=catalog.filter(e=>e.id!=='Recovery:14'),review=planBatchCardMigration(c,partial,suggestedBatchRoots(c,partial),{},identity);
 expect(review.plan.card.selections.find(s=>s.id==='recovery')?.entry.id).toBe('Recovery:24');expect(review.retained.find(r=>r.row.id==='recovery')?.reason).toContain('尚未完整载入');expect(review.plan.warnings.some(w=>w.includes('Recovery'))).toBe(true);
});
it('does not guess between duplicate imported feature records or add a third copy',()=>{
 const {c,catalog}=fixture();c.selections=c.selections.filter(s=>s.id!=='recovery');const old={...entry('Recovery:old','feature','2024'),packId:'imported',source:'IMPORTED',edition:'both' as const,raw:{}};c.selections.push(row('one',old),row('two',old));
 const {plan,retained}=planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity);expect(plan.card.selections.filter(s=>s.entry.name==='Recovery')).toHaveLength(2);expect(retained.map(r=>r.row.id)).toEqual(expect.arrayContaining(['one','two']));
});
it('unchecking a custom class does not cascade into a separately retained subclass',()=>{
 const c=newCharacter();const cls={...entry('CustomMage:24','class','2024'),raw:{_custom:true},source:'CUSTOM'},sub={...entry('Study:24','subclass','2024',{className:'CustomMage',classSource:'CUSTOM'}),source:'CUSTOM'};c.selections=[row('class',cls),row('sub',sub,{parentId:'class'})];
 const {plan}=planBatchCardMigration(c,[],{class:'',sub:''},{class:false},identity);expect(plan.card.selections.map(s=>s.id)).toEqual(['sub']);expect(plan.card.selections[0].parentId).toBeUndefined();
});
it('resolves subclass defaults against the newly selected parent and respects explicit keep',()=>{
 const {c,catalog}=fixture();const a=entry('Study:24','subclass','2024',{className:'Mage',classSource:'XPHB'}),b=entry('Study:14','subclass','2014',{className:'Mage',classSource:'PHB'});c.selections.push(row('sub',a,{parentId:'mage'}));catalog.push(a,b);expect(suggestedBatchRoots(c,catalog).sub).toBe(b.id);expect(suggestedBatchRoots(c,catalog,{mage:''}).sub).toBe('');
});
it('retains an ambiguous target declaration instead of choosing the first catalog row',()=>{
 const {c,catalog,f14}=fixture();catalog.push({...f14,id:'duplicate-source-feature'});const review=planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity);expect(review.plan.card.selections.find(s=>s.id==='recovery')?.entry.id).toBe('Recovery:24');expect(review.retained.some(r=>r.row.id==='recovery')).toBe(true);expect(review.plan.warnings.some(w=>w.includes('多个来源'))).toBe(true);
});
it.each([true,false])('preserves old manual choice content across a changed rule and later refresh (automation %s)',enabled=>{
 const {c,catalog}=fixture();c.automation!.enabled=enabled;const selected={...entry('Chosen:24','feat','2024'),source:'CUSTOM',raw:{_custom:true}};c.answers={'recovery:choose':['Chosen:24']};c.selections.push(row('chosen',selected,{parentId:'recovery',grantKey:'choice:recovery:choose:Chosen:24',requirementId:'recovery:choose'}));const before=structuredClone(c.answers),review=planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity);expect(review.plan.card.selections.find(s=>s.id==='chosen')?.entry).toEqual(selected);expect(review.plan.card.selections.find(s=>s.id==='chosen')?.grantKey).toBeUndefined();expect(review.plan.card.answers).toEqual(before);expect(review.plan.card.automation!.enabled).toBe(enabled);review.plan.card.automation!.enabled=true;syncFeatures(review.plan.card,catalog);expect(review.plan.card.selections.some(s=>s.id==='chosen')).toBe(true);
});
it('does not refill newly declared feature or source-spell resources when disabled automation is later enabled',()=>{
 const {c,catalog,f14,cls14}=fixture();c.automation!.enabled=false;f14.raw.resource={name:'New recovery',max:3,recovery:{long:'all'}};Object.assign(f14,irFixture(f14));cls14.raw.additionalSpells=[{innate:{'1':{daily:{'1':['Light|PHB']}}}}];Object.assign(cls14,irFixture(cls14));
 const {plan}=planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity);expect(plan.card.automation!.enabled).toBe(false);plan.card.automation!.enabled=true;syncAutoResources(plan.card);syncSourceSpells(plan.card,catalog);const resources=Object.entries(plan.card.runtime.resources).filter(([key,r])=>key.startsWith('innate-spell:')||!!r.featureGrant);expect(resources.length).toBeGreaterThanOrEqual(2);expect(resources.every(([,r])=>r.current===0)).toBe(true);
});
it('re-reviewing a persisted migrated card does not duplicate content or replenish resources',()=>{
 const {c,catalog}=fixture();const first=planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity).plan.card,restored=readCharacter(JSON.parse(JSON.stringify(first))).character,second=planBatchCardMigration(restored,catalog,suggestedBatchRoots(restored,catalog),{},{...identity,id:'second-copy'}).plan;
 expect(second.card.selections).toEqual(first.selections);expect(second.card.runtime.resources).toEqual(first.runtime.resources);expect(second.added).toEqual([]);expect(second.removed).toEqual([]);
});
it('retires generated spells of obsolete source features together with that feature',()=>{
 const {c,catalog}=fixture();c.edition='2024';const old=c.selections.find(row=>row.id==='old-only')!;old.entry.raw.additionalSpells=[{innate:{'1':{daily:{'1':['Light|XPHB']}}}}];Object.assign(old.entry,irFixture(old.entry));syncSourceSpells(c,catalog);const generated=c.selections.find(row=>row.grantKey?.startsWith('source-spell:'))!;expect(generated.parentId).toBe('old-only');c.edition='2014';const {plan}=planBatchCardMigration(c,catalog,suggestedBatchRoots(c,catalog),{},identity);expect(plan.card.selections.some(row=>row.id==='old-only'||row.id===generated.id)).toBe(false);expect(plan.card.selections.find(row=>row.id==='manual-spell')).toBeDefined();
});
it('keeps an explicitly unchecked ambiguous source spell removed when its catalog later resolves',()=>{
 const {c,catalog}=fixture();c.edition='2024';c.selections[0].entry.raw.additionalSpells=[{innate:{'1':{daily:{'1':['Light|XPHB']}}}}];Object.assign(c.selections[0].entry,irFixture(c.selections[0].entry));syncSourceSpells(c,catalog);const generated=c.selections.find(row=>row.grantKey?.startsWith('source-spell:'))!;c.runtime.resources['innate-spell:'+generated.id].current=0;const spell=catalog.find(e=>e.id==='Light:24')!,ambiguous=[...catalog,{...spell,id:'other-light',packId:'other-pack'}];const review=planBatchCardMigration(c,ambiguous,{mage:''},{[generated.id]:false},identity);expect(review.retained.some(r=>r.row.id===generated.id)).toBe(true);expect(review.plan.card.dismissedFeatures).toContain('mage|'+generated.grantKey);const restored=readCharacter(JSON.parse(JSON.stringify(review.plan.card))).character;syncSourceSpells(restored,catalog);expect(restored.selections.some(row=>row.id===generated.id)).toBe(false);
 const undo=planBatchCardMigration(c,ambiguous,{mage:''},{},identity);expect(undo.plan.card.selections.some(row=>row.id===generated.id)).toBe(true);expect(undo.plan.card.dismissedFeatures||[]).not.toContain('mage|'+generated.grantKey);
});
