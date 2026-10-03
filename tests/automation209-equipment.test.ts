import {irFixture} from './helpers/irFixture';
import {irCharacter as newCharacter,normalizeFixtureData as normalizeData} from './helpers/irFixture';
import {describe,it,expect} from 'vitest';
import {type Character,type Selection} from '../src/core/model';

import {evaluate} from '../src/core/engine';
import {newAutomationState,setAutomationEnabled} from '../src/core/automation/state';
import {equipSelection,reconcileEquipping} from '../src/core/automation/equipment';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';

function character(edition:'2014'|'2024'='2024'){
 const c=newCharacter(edition);c.automation=newAutomationState();c.abilities.dex=16;c.training={armor:'轻甲、中甲、重甲、盾牌'};return c;
}
function item(c:Character,id:string,type:string,ac:unknown,extra:Record<string,unknown>={}):Selection{
 const [entry]=normalizeData({item:[{name:id,ENG_name:'Fixture '+id,source:c.edition==='2024'?'XPHB':'PHB',type,ac,...extra}]},'authored-test');
 const row={id,entry,quantity:1,level:1,equipped:false};c.selections.push(row);return row;
}
describe('generic equipment automation on the 208 baseline',()=>{
 it.each([['LA',11,14],['MA',14,16],['HA',16,16]])('replaces the default formula for %s armor and removes independently from a shield',(type,base,expected)=>{
  const c=character();item(c,'armor',type,base);item(c,'shield','S',2);
  expect(evaluate(c).ac).toBe(13);equipSelection(c,'armor',true);expect(evaluate(c).ac).toBe(expected);
  equipSelection(c,'shield',true);expect(evaluate(c).ac).toBe(expected+2);
  equipSelection(c,'armor',false);expect(evaluate(c).ac).toBe(15);equipSelection(c,'shield',false);expect(evaluate(c).ac).toBe(13);
 });
 it('does not silently choose the larger unarmored value; medium armor retains negative Dexterity',()=>{
  const c=character();c.abilities.dex=30;item(c,'heavy','HA|XPHB',16);equipSelection(c,'heavy',true);expect(evaluate(c).ac).toBe(16);
  item(c,'medium','MA',14);c.abilities.dex=6;equipSelection(c,'medium',true);expect(evaluate(c).ac).toBe(12);expect(c.selections[0].equipped).toBe(false);
 });
 it('equips one armor and one shield per action while preserving quantities and manual-mode marks',()=>{
  const c=character();item(c,'first','MA',14);item(c,'second','HA',18);item(c,'shield-a','S',2);item(c,'shield-b','S',2).quantity=5;
  equipSelection(c,'first',true);equipSelection(c,'shield-a',true);equipSelection(c,'second',true);equipSelection(c,'shield-b',true);
  expect(c.selections.filter(r=>r.equipped).map(r=>r.id)).toEqual(['second','shield-b']);expect(evaluate(c).ac).toBe(20);expect(c.selections[3].quantity).toBe(5);
  setAutomationEnabled(c,false);equipSelection(c,'first',true);expect(c.selections[1].equipped).toBe(true);expect(evaluate(c).ac).toBe(13);
 });
 it('reconciles only explicit new equip intents; importing conflicting marks does not mutate or guess',()=>{
  const c=character();item(c,'one','LA',11).equipped=true;item(c,'two','HA',18);
  const draft=structuredClone(c);draft.selections[1].equipped=true;reconcileEquipping(c,draft);expect(draft.selections[0].equipped).toBe(false);
  c.selections[1].equipped=true;const snapshot=JSON.stringify(c);expect(evaluate(c).issues.some(i=>i.id==='equipment-conflict:armor')).toBe(true);expect(JSON.stringify(c)).toBe(snapshot);
 });
 it('treats missing shield training differently in 2014 and 2024 without reading display names',()=>{
  for(const edition of ['2014','2024'] as const){const c=character(edition);c.training={armor:''};item(c,'not-called-shield','S',2);equipSelection(c,'not-called-shield',true);expect(evaluate(c).ac).toBe(edition==='2014'?15:13);c.training.armor='shields';expect(evaluate(c).ac).toBe(15);}
 });
 it('reads fixed class training and honors explicit manual removal and disabled sources',()=>{
  const c=character();delete c.training;
  const [entry]=normalizeData({class:[{name:'原创职业',source:'XPHB',startingProficiencies:{armor:['light','shield']},hd:{faces:8}}]},'authored-test');
  c.selections.push({id:'class',entry,quantity:1,level:1,equipped:false});item(c,'shield','S',2);equipSelection(c,'shield',true);expect(evaluate(c).ac).toBe(15);
  c.training={armor:''};expect(evaluate(c).ac).toBe(13);delete c.training;c.profile.disabledEntries=[entry.id];expect(evaluate(c).ac).toBe(13);
 });
 it('keeps base armor without attunement, suspends magic bonuses, and explains unknown formulas',()=>{
  const c=character();const row=item(c,'magic','MA',14,{bonusAc:'+1',reqAttune:true});equipSelection(c,row.id,true);expect(evaluate(c).ac).toBe(16);
  row.attuned=true;expect(evaluate(c).ac).toBe(17);row.entry.raw.bonusAc='@unsupported';Object.assign(row.entry,irFixture(row.entry));expect(evaluate(c).ac).toBe(16);expect(evaluate(c).issues.some(i=>i.id==='armor-data:magic')).toBe(true);
 });
 it('disabling the first class never upgrades multiclass training to another class starting training',()=>{
  const c=character();delete c.training;c.profile.optional.multiclass=true;
  const entries=normalizeData({class:[{name:'First fixture',source:'XPHB',startingProficiencies:{armor:[]}},{name:'Second fixture',source:'XPHB',startingProficiencies:{armor:['shield']},multiclassing:{proficienciesGained:{armor:[]}}}]},'authored-test');
  c.selections=entries.map((entry,i)=>({id:'class-'+i,entry,quantity:1,level:1,equipped:false}));item(c,'shield','S',2);equipSelection(c,'shield',true);c.profile.disabledEntries=[entries[0].id];expect(evaluate(c).ac).toBe(13);
 });
 it('retains absolute manual overrides and offsets through JSON without granting resources during evaluation',()=>{
  const c=character();item(c,'armor','HA',16);equipSelection(c,'armor',true);c.adjustments=[{id:'manual',target:'ac',value:18,reason:'DM'}];c.sheetBonuses={ac:3};c.runtime.resources={charge:{max:3,current:1}};
  const before=JSON.stringify(c);expect(evaluate(c).ac).toBe(21);expect(evaluate(c).ac).toBe(21);expect(JSON.stringify(c)).toBe(before);
  const loaded=readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;expect(loaded.automation).toEqual(c.automation);expect(evaluate(loaded).ac).toBe(21);expect(loaded.runtime.resources.charge.current).toBe(1);
  setAutomationEnabled(loaded,false);expect(evaluate(loaded).ac).toBe(21);expect(loaded.abilities.dex).toBe(16);
 });
 it('preserves unfamiliar automation without executing or overwriting it, and rejects malformed known state',()=>{
  const c=character();item(c,'armor','HA',18).equipped=true;c.automation={protocol:999,opaque:{future:'keep'}};
  const restored=readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;expect(restored.automation).toEqual(c.automation);expect(evaluate(restored).ac).toBe(13);expect(evaluate(restored).issues.some(i=>i.id==='automation-protocol')).toBe(true);
  expect(()=>setAutomationEnabled(restored,true)).toThrow(/协议/);c.automation={protocol:2,enabled:'yes' as any,rulesVersion:'equipment.1'};expect(()=>readCharacter(c)).toThrow(/自动化/);
 });
});

it('recognizes dragged shield category references through repeated evaluation and backup restore',()=>{
 const c=character();c.training={armor:'{@itemProperty 盾牌|XPHB|显示标签}'};item(c,'shield','S',2);equipSelection(c,'shield',true);
 expect(evaluate(c).ac).toBe(15);expect(evaluate(c).ac).toBe(15);
 const restored=readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;expect(restored.training).toEqual(c.training);expect(evaluate(restored).ac).toBe(15);
 restored.training!.armor='';expect(evaluate(restored).ac).toBe(13);
});
