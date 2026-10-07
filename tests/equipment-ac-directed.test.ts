import {describe,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {equipSelection} from '../src/core/automation/equipment';
import {setAutomationEnabled} from '../src/core/automation/state';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {equipmentAcCard} from './helpers/equipmentAcFixture';
import mechanisms from './fixtures/equipment-ac-mechanisms.json' with {type:'json'};

for(const edition of ['2014','2024'] as const)describe(`${edition} authored AC transitions with independently reviewed mechanism expectations`,()=>{
 it.each(mechanisms.armorCases)('hand-computed wear/remove matrix: $id',row=>{
  const c=equipmentAcCard(edition);c.abilities.dex=row.dexScore;
  expect(evaluate(c).ac).toBe(row.unarmored);equipSelection(c,'medium',true);expect(evaluate(c).ac).toBe(row.scale);
  equipSelection(c,'shield',true);expect(evaluate(c).ac).toBe(row.scaleWithTrainedShield);
  equipSelection(c,'heavy',true);expect(evaluate(c).ac).toBe(row.chainWithTrainedShield);expect(c.selections.find(s=>s.id==='medium')!.equipped).toBe(false);
  equipSelection(c,'shield',false);expect(evaluate(c).ac).toBe(row.chain);equipSelection(c,'heavy',false);expect(evaluate(c).ac).toBe(row.unarmored);
 });
 it('matches the explicit shield training matrix without imposing body-armor restrictions on a 2024 shield',()=>{
  for(const row of mechanisms.shieldCases.filter(row=>row.edition===edition)){
   const c=equipmentAcCard(edition);c.training!.armor=row.shieldTraining?'中甲、重甲、盾牌':'中甲、重甲';equipSelection(c,'heavy',true);equipSelection(c,'shield',true);
   const before=JSON.stringify(c),result=evaluate(c);expect(result.ac,row.id).toBe(row.chainWithShield);expect(JSON.stringify(c)).toBe(before);
   const warning=result.issues.find(i=>i.id==='armor-training:shield');expect(!!warning).toBe(!row.shieldTraining);
   if(edition==='2024'&&!row.shieldTraining)expect(warning!.message).not.toMatch(/劣势|施法/);
   expect(c.runtime.resources.manual.current).toBe(1);
  }
 });
 it('does not multiply a shield by quantity and refuses two equipped shield rows without mutating them',()=>{
  const c=equipmentAcCard(edition);equipSelection(c,'heavy',true);equipSelection(c,'shield',true);expect(evaluate(c).ac).toBe(18);
  c.selections.find(s=>s.id==='shield')!.quantity=0;expect(evaluate(c).ac).toBe(16);
  const shield=c.selections.find(s=>s.id==='shield')!;shield.quantity=9;c.selections.push({...structuredClone(shield),id:'duplicate-shield'});
  const before=JSON.stringify(c);expect(evaluate(c).ac).toBe(16);expect(evaluate(c).issues.some(i=>i.id==='equipment-conflict:shield')).toBe(true);expect(JSON.stringify(c)).toBe(before);
 });
 it('keeps imported armor conflicts visible until an explicit equip action resolves them',()=>{
  const c=equipmentAcCard(edition);c.selections.forEach(s=>s.equipped=true);const before=JSON.stringify(c);
  expect(evaluate(c).ac).toBe(15);expect(evaluate(c).issues.some(i=>i.id==='equipment-conflict:armor')).toBe(true);expect(JSON.stringify(c)).toBe(before);
  equipSelection(c,'heavy',true);expect(evaluate(c).ac).toBe(18);
 });
 it('preserves quantities, manual training and resources when an entry or source is disabled',()=>{
  const c=equipmentAcCard(edition);equipSelection(c,'heavy',true);equipSelection(c,'shield',true);const rows=structuredClone(c.selections);
  c.profile.disabledEntries=[c.selections.find(s=>s.id==='shield')!.entry.id];expect(evaluate(c).ac).toBe(16);
  c.profile.enabledSources=[];expect(evaluate(c).ac).toBe(13);expect(c.selections).toEqual(rows);
  c.profile.disabledEntries=[];c.profile.enabledSources=[edition==='2014'?'PHB':'XPHB'];expect(evaluate(c).ac).toBe(18);expect(c.training!.weapons).toBe('手工武器记录');expect(c.runtime.resources.manual.current).toBe(1);
 });
 it('retains hand offsets, legacy totals and consumed resources through opt-out and native save/read',()=>{
  const c=equipmentAcCard(edition);equipSelection(c,'heavy',true);equipSelection(c,'shield',true);c.sheetBonuses={ac:-2};expect(evaluate(c).ac).toBe(16);
  setAutomationEnabled(c,false);expect(evaluate(c).ac).toBe(11);setAutomationEnabled(c,true);
  c.adjustments=[{id:'manual-total',target:'ac',value:19,reason:'原创人工裁定'}];c.sheetBonuses.ac=2;
  const before=JSON.stringify(c);expect(evaluate(c).ac).toBe(21);expect(evaluate(c).ac).toBe(21);expect(JSON.stringify(c)).toBe(before);
  const saved=readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
  expect(evaluate(saved).ac).toBe(21);expect(saved.runtime).toEqual(c.runtime);expect(saved.answers).toEqual(c.answers);expect(saved.training).toEqual(c.training);expect(saved.inventory).toEqual(c.inventory);expect(saved.adjustments).toEqual(c.adjustments);
  setAutomationEnabled(saved,false);expect(evaluate(saved).ac).toBe(21);expect(saved.runtime.resources.manual.current).toBe(1);
 });
});
