import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {createCustomEntry} from '../src/core/customEntries';
import {activeEffectSelections} from '../src/core/automation/active';
import {evaluateArmor} from '../src/core/automation/equipment';
import {racialNaturalArmorRule} from '../src/core/automation/racialNaturalArmor';
import {racialNaturalArmorFixture} from './helpers/racialNaturalArmorFlowFixture';
import {racialNaturalArmorSourceEvidence,racialNaturalArmorSnapshot as snapshot} from './helpers/racialNaturalArmorSourceFixture';
import {naturalArmorEquipmentSelection,naturalArmorEquipmentSourceProof} from './helpers/naturalArmorEquipmentSourceFixture';

beforeAll(()=>{racialNaturalArmorSourceEvidence();naturalArmorEquipmentSourceProof();},30000);
const prose='While wearing armor, you gain a +7 bonus to your AC.';
function equip(f:ReturnType<typeof racialNaturalArmorFixture>){const row=naturalArmorEquipmentSelection('leather');f.c.selections.push(row);f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,row.entry.source])];return row;}

it('recognized innate-AC canonical and coherent-alias snapshots cannot regain rejected AC through legacy effects or prose',()=>{
 for(const transport of ['canonical','alias']as const)for(const route of ['effect','prose']as const){
  const f=racialNaturalArmorFixture('race/9');
  if(transport==='alias'){f.entry.id='authored-innate-ac-transport';f.entry.revision='authored-transport-revision';}
  expect(racialNaturalArmorRule(f.entry)?.id).toBe(f.rule.id);
  if(route==='effect')f.entry.effects=[{target:'ac',op:'set',value:99}];
  else{equip(f);f.entry.entries=[...f.entry.entries,prose];}
  expect(racialNaturalArmorRule(f.entry)).toBeUndefined();
  const before=snapshot(f.c),d=evaluate(f.c),armor=evaluateArmor(f.c,activeEffectSelections(f.c),d.modifiers.dex);
  expect.soft(d.ac).toBe(armor.base+armor.bonus+(f.c.sheetBonuses?.ac||0));
  expect(snapshot(f.c)).toBe(before);
 }
});

it('real CUSTOM same-name race effects and the established generic armor sentence retain their unrelated manual route',()=>{
 for(const route of ['effect','prose']as const){
  const f=racialNaturalArmorFixture('race/9');
  f.owner.entry=createCustomEntry({type:'race',name:f.entry.name,english:f.entry.english,body:route==='prose'?prose:''});
  if(route==='effect')f.owner.entry.effects=[{target:'ac',op:'set',value:99}];
  f.c.profile.enabledSources=[f.owner.entry.source];
  if(route==='prose')equip(f);
  expect(racialNaturalArmorRule(f.owner.entry)).toBeUndefined();
  const before=snapshot(f.c),d=evaluate(f.c),armor=evaluateArmor(f.c,activeEffectSelections(f.c),d.modifiers.dex);
  expect(d.ac).toBe((route==='effect'?99:armor.base+7)+armor.bonus+(f.c.sheetBonuses?.ac||0));
  expect(snapshot(f.c)).toBe(before);
 }
});
