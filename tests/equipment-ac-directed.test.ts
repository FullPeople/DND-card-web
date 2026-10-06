import {describe,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {equipSelection} from '../src/core/automation/equipment';
import {setAutomationEnabled} from '../src/core/automation/state';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {equipmentAcCard} from './helpers/equipmentAcFixture';

for(const edition of ['2014','2024'] as const)describe(`${edition} authored AC product-policy transitions (not rule-clause evidence)`,()=>{
 it.each([[6,8,12,14],[10,10,14,16],[16,13,16,18],[30,20,16,18]])('hand-computed wear/remove results at Dexterity %i',(dex,naked,medium,mediumShield)=>{
  const c=equipmentAcCard(edition);c.abilities.dex=dex;
  expect(evaluate(c).ac).toBe(naked);equipSelection(c,'medium',true);expect(evaluate(c).ac).toBe(medium);
  equipSelection(c,'shield',true);expect(evaluate(c).ac).toBe(mediumShield);
  equipSelection(c,'heavy',true);expect(evaluate(c).ac).toBe(18);expect(c.selections.find(s=>s.id==='medium')!.equipped).toBe(false);
  equipSelection(c,'shield',false);expect(evaluate(c).ac).toBe(16);equipSelection(c,'heavy',false);expect(evaluate(c).ac).toBe(naked);
 });
 it('keeps the current edition-specific untrained shield policy explicit',()=>{
  const c=equipmentAcCard(edition);c.training!.armor='';equipSelection(c,'shield',true);
  expect(evaluate(c).ac).toBe(edition==='2014'?15:13);expect(evaluate(c).issues.some(i=>i.id==='armor-training:shield')).toBe(true);
  c.training!.armor='盾牌';expect(evaluate(c).ac).toBe(15);expect(c.runtime.resources.manual.current).toBe(1);
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
