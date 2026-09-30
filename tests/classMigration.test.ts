import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry,type Character} from '../src/core/model';
import {reviewClasses,planClassMigration} from '../src/core/classMigration';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {newAutomationState} from '../src/core/automation/state';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {exportCharacter,exportOwlbear} from '../src/core/export';
import {evaluate} from '../src/core/engine';
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,kind,name:id,english:id,source:'XPHB',edition:'2024',revision:'2',packId:'test',entries:['原创迁移验收资料。'],raw});
const mage=entry('Test Mage','class',{hd:{faces:6},casterProgression:'full',spellcastingAbility:'int',preparedSpellsProgression:[2],classFeatures:['New Feature|Test Mage|XPHB|1']});
const feature=entry('New Feature','feature',{className:'Test Mage',classSource:'XPHB',level:1,additionalSpells:[{innate:{'_':{daily:{'1':['Gift|XPHB']}}}}]});
const gift=entry('Gift','spell',{level:1});
const add=(c:Character,e:Entry,id=e.id)=>c.selections.push({id,entry:structuredClone(e),level:1,quantity:1,equipped:false});
const identity={id:'synced-copy',now:'2026-09-30T00:00:00.000Z'};
describe('class migration review and durable copy',()=>{
 it('requires explicit mapping for Chinese-only and custom imports, ignores name-only hydration',()=>{
  const c=newCharacter(),old={...mage,id:'imported:class:法师',name:'同名',english:'同名',packId:'imported',source:'IMPORTED',raw:{_castingSource:{id:mage.id,source:'XPHB'}}};add(c,old);
  expect(reviewClasses(c,[{...mage,name:'同名'}])[0].suggested).toBeUndefined();
  c.selections[0].entry.english='Test Mage';expect(reviewClasses(c,[mage])[0].suggested?.id).toBe(mage.id);
  c.selections[0].entry.raw._custom=true;expect(reviewClasses(c,[mage])[0].status).toBe('custom');expect(reviewClasses(c,[mage])[0].suggested).toBeUndefined();
 });
 it('keeps 2014 and 2024 source identities separate and rejects ambiguous English matches',()=>{
  const c=newCharacter();add(c,{...mage,id:'old',source:'IMPORTED',packId:'imported'});
  const legacy={...mage,id:'legacy-mage',source:'PHB',edition:'2014' as const};
  expect(reviewClasses(c,[legacy,mage])[0].suggested?.source).toBe('XPHB');c.edition='2014';expect(reviewClasses(c,[legacy,mage])[0].suggested?.source).toBe('PHB');
  c.edition='2024';expect(reviewClasses(c,[mage,{...mage,id:'duplicate'}])[0].suggested).toBeUndefined();
  expect(()=>planClassMigration(c,[legacy],{old:legacy.id},identity)).toThrow(/唯一确定/);
 });
 it('refreshes declared class features in a copy, keeps unrelated choices and spent counters across refresh and round trips',()=>{
  const c=newCharacter();c.name='旧资料测试卡';c.automation=newAutomationState();add(c,{...mage,revision:'1',raw:{...mage.raw,preparedSpellsProgression:[1]}});
  add(c,{...feature,revision:'1',entries:['旧正文'],raw:{className:'Test Mage',classSource:'XPHB',level:1}});c.selections[1].parentId=mage.id;c.selections[1].grantKey='ref:New Feature|Test Mage|XPHB|1';
  add(c,entry('Manual','feature'));c.notes='保留玩家记录';c.answers={choice:['kept']};c.dismissedFeatures=['background|equipment:0:_:0'];c.runtime.hp=2;c.runtime.tempHp=3;
  syncAutoResources(c);c.runtime.resources['hit-die:6'].current=0;c.runtime.resources['spell-slot:1'].current=1;c.spellSettings!.slots['1'].used=1;c.runtime.resources.manual={name:'手动资源',current:1,max:3};
  const before=structuredClone(c),plan=planClassMigration(c,[mage,feature,gift],{[mage.id]:mage.id},identity);
  expect(c).toEqual(before);expect(plan.card.id).not.toBe(c.id);expect(plan.card.selections.find(s=>s.id===mage.id)?.level).toBe(1);expect(plan.refreshed).toEqual(['New Feature']);expect(plan.added).toContain('Gift');
  expect(plan.card.answers).toEqual(c.answers);expect(plan.card.dismissedFeatures).toEqual(c.dismissedFeatures);expect(plan.card.notes).toBe(c.notes);expect(plan.card.runtime.hp).toBe(2);expect(plan.card.runtime.tempHp).toBe(3);
  const restored=validateCharacter(exportCharacter(plan.card)),resources=structuredClone(restored.runtime.resources);syncFeatures(restored,[mage,feature,gift]);syncAutoResources(restored);syncSourceSpells(restored,[mage,feature,gift]);expect(restored.runtime.resources).toEqual(resources);
  expect(resources['hit-die:6'].current).toBe(0);expect(resources['spell-slot:1'].current).toBe(1);expect(resources.manual.current).toBe(1);expect(Object.entries(resources).filter(([id])=>id.startsWith('source-spell')||id.startsWith('innate')).map(([,r])=>r.current)).toEqual([0]);
  expect(reviewClasses(restored,[mage,feature,gift])[0].status).toBe('current');
 });
 it('rejects disabled targets and duplicate class mappings without mutating a card',()=>{
  const c=newCharacter();add(c,{...mage,id:'old',source:'IMPORTED',packId:'imported'});const before=JSON.stringify(c);c.profile.enabledSources=[];expect(()=>planClassMigration(c,[mage],{old:mage.id},identity)).toThrow(/未启用/);c.profile.enabledSources=['PHB','XPHB'];expect(JSON.stringify(c)).toBe(before);
  add(c,{...mage,id:'other'});expect(()=>planClassMigration(c,[mage],{old:mage.id,other:mage.id},identity)).toThrow(/同一份/);
 });
 it('converts an actual legacy schema 0.3 fixture using confirmed class mapping while preserving manual data',()=>{
  const source=newCharacter();source.runtime.hp=7;source.notes='旧卡笔记';add(source,mage);const legacy=exportOwlbear(source,evaluate(source));legacy.classes[0].name='旧卡法师';legacy.identity.character_name='旧格式验收卡';
  const imported=importOwlbear(legacy),id=imported.selections.find(s=>s.entry.kind==='class')!.id;
  expect(reviewClasses(imported,[mage])[0].suggested).toBeUndefined();const plan=planClassMigration(imported,[mage,feature,gift],{[id]:mage.id},identity);
  expect(plan.card.runtime.hp).toBe(7);expect(plan.card.externalSnapshot).toEqual(imported.externalSnapshot);expect(plan.card.selections.find(s=>s.id===id)?.entry).toEqual(mage);expect(validateCharacter(exportCharacter(plan.card))).toEqual(plan.card);
 });
});
