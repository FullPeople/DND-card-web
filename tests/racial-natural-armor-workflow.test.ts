import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {createCustomEntry} from '../src/core/customEntries';
import {uid,type Character,type Derived,type Selection} from '../src/core/model';
import {activeEffectSelections} from '../src/core/automation/active';
import {evaluateArmor} from '../src/core/automation/equipment';
import {racialNaturalArmorFixture} from './helpers/racialNaturalArmorFlowFixture';
import {racialNaturalArmorSpecs,racialNaturalArmorSourceEvidence,racialNaturalArmorSnapshot as snapshot} from './helpers/racialNaturalArmorSourceFixture';
import {naturalArmorEquipmentSelection,naturalArmorEquipmentSourceProof} from './helpers/naturalArmorEquipmentSourceFixture';

beforeAll(()=>{racialNaturalArmorSourceEvidence();naturalArmorEquipmentSourceProof();});
const admitted=()=>{const keys=new Set(racialNaturalArmorSourceEvidence().rules.map(rule=>rule.key));return racialNaturalArmorSpecs.filter(spec=>keys.has(spec.key));};
const nativeBase=(f:ReturnType<typeof racialNaturalArmorFixture>,d:Derived)=>f.spec.policy.constant+(f.spec.policy.modifier==='none'?0:d.modifiers[f.spec.policy.modifier]);
const expected=(f:ReturnType<typeof racialNaturalArmorFixture>,d:Derived)=>f.spec.policy.operation==='alternative-base'?nativeBase(f,d):10+d.modifiers.dex+f.spec.policy.constant;
function gear(c:Character,type:'LA'|'HA'|'S',ac:number,extra:Record<string,unknown>={}){const entry=createCustomEntry({name:'Authored natural AC equipment '+type,type:'armor',body:'',raw:{type,ac,armor:type!=='S',...extra},edition:c.edition}),row:Selection={id:uid(),entry,level:1,quantity:1,equipped:true};c.profile.enabledSources=[...new Set([...c.profile.enabledSources,'CUSTOM'])];c.selections.push(row);return row;}
function originalGear(c:Character,key:'leather'|'plate'|'shield',form:'canonical'|'app'){const row=naturalArmorEquipmentSelection(key,form);c.profile.enabledSources=[...new Set([...c.profile.enabledSources,row.entry.source,...(row.entry.dependencies||[])])];c.selections.push(row);return row;}
function ordinary(c:Character,d:Derived){const armor=evaluateArmor(c,activeEffectSelections(c),d.modifiers.dex);return armor.base+armor.bonus+(c.sheetBonuses?.ac||0);}

it('all admitted innate canonical and actual App sources render one correct alternative base or explicit bonus, while native reopening preserves every stored value and manual final priority',()=>{
 expect(admitted().length).toBeGreaterThan(0);
 for(const form of ['canonical','app']as const)for(const spec of admitted())for(const manual of [false,true]){const f=racialNaturalArmorFixture(spec.key,form);if(manual)f.c.adjustments=[{id:'authored-final-ac',target:'ac',value:29,reason:'Authored final AC'}];const before=snapshot(f.c),d=evaluate(f.c);expect(d.abilities.dex).toBe(14);expect(d.abilities.con).toBe(16);expect(d.ac).toBe(manual?31:expected(f,d)+2);expect(d.trace.ac.some(row=>row.includes(f.entry.name))).toBe(true);expect(snapshot(f.c)).toBe(before);const reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(reopened)).toBe(before);expect(evaluate(reopened).ac).toBe(d.ac);expect(snapshot(reopened)).toBe(before);expect(reopened.runtime.hp).toBe(3);expect(reopened.runtime.tempHp).toBe(2);expect(reopened.runtime.resources.manual.current).toBe(1);}
 // Fixed17 is the source formula, not max(default10+Dex,17).
 for(const spec of admitted().filter(row=>row.policy.ignoresDex)){const f=racialNaturalArmorFixture(spec.key);f.c.abilities.dex+=16;const before=snapshot(f.c),d=evaluate(f.c);expect(d.abilities.dex).toBe(30);expect(d.ac).toBe(19);expect(snapshot(f.c)).toBe(before);}
});

it('physical body armor conditions and plain comparisons never stack formulas, held enchanted or conflicting states preserve existing armor math, and an authorized shield is counted once',()=>{
 for(const form of ['canonical','app']as const)for(const spec of admitted()){const f=racialNaturalArmorFixture(spec.key,form);f.c.training={armor:'轻甲、中甲、重甲、盾牌'};originalGear(f.c,'shield',form);const before=snapshot(f.c),d=evaluate(f.c);expect(d.ac).toBe(expected(f,d)+2+2);expect(snapshot(f.c)).toBe(before);}
 for(const form of ['canonical','app']as const)for(const spec of admitted().filter(row=>row.policy.operation==='alternative-base'))for(const key of ['leather','plate']as const){const f=racialNaturalArmorFixture(spec.key,form),body=originalGear(f.c,key,form),before=snapshot(f.c),d=evaluate(f.c),plain=ordinary(f.c,d),higher=spec.policy.wearing==='natural-if-worn-lower';expect(d.ac).toBe(higher?Math.max(plain,nativeBase(f,d)+2):plain);expect(snapshot(f.c)).toBe(before);expect(body.equipped).toBe(true);
  if(spec.policy.wearing==='no-body-armor'){f.c.profile.enabledSources=f.c.profile.enabledSources.filter(source=>source!==body.entry.source);const paused=snapshot(f.c),d=evaluate(f.c);expect(d.ac).toBe(ordinary(f.c,d));expect(f.c.selections.find(row=>row.id===body.id)!.equipped).toBe(true);expect(snapshot(f.c)).toBe(paused);}
 }
 const comparison=admitted().find(spec=>spec.policy.wearing==='natural-if-worn-lower')!;expect(!!comparison).toBe(true);
 for(const mode of ['enchanted','unknown','conflict']as const){const f=racialNaturalArmorFixture(comparison.key),body=gear(f.c,'LA',11,mode==='enchanted'?{bonusAc:1}:{});if(mode==='unknown')delete body.entry.raw.ac;if(mode==='conflict')gear(f.c,'HA',18);const before=snapshot(f.c),d=evaluate(f.c);expect(d.ac).toBe(ordinary(f.c,d));expect(d.issues.some(issue=>issue.id.startsWith('racial-natural-armor:'))).toBe(true);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.resources.manual.current).toBe(1);}
});

it('source, canonical and transport opt-outs or invalid root authority withdraw only the natural contribution while independent manual final AC and sheet offsets stay intact',()=>{
 for(const mode of ['source','canonical','automation','future','parent','duplicate','forged']as const)for(const manual of [false,true]){const f=racialNaturalArmorFixture();if(manual){f.c.adjustments=[{id:'authored-final-ac',target:'ac',value:29,reason:'Authored final AC'}];f.c.sheetBonuses!.ac=3;}if(mode==='source')f.c.profile.enabledSources=[];if(mode==='canonical')f.c.profile.disabledEntries=[f.entry.id];if(mode==='automation')f.c.automation!.enabled=false;if(mode==='future')f.c.automation!.protocol=999;if(mode==='parent')f.owner.parentId='authored-absent-parent';if(mode==='duplicate')f.c.selections.push({...structuredClone(f.owner),id:'authored-second-race-root'});if(mode==='forged')f.entry.raw.authoredNaturalAc=99;const before=snapshot(f.c),d=evaluate(f.c);expect(d.ac).toBe(manual?32:10+d.modifiers.dex+2);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);}
 for(const disabled of ['canonical','alias']as const){const f=racialNaturalArmorFixture(),canonical=f.entry.id;f.entry.id='authored-natural-armor-alias';f.entry.revision='authored-transport-only';const before=snapshot(f.c),d=evaluate(f.c);expect(d.ac).toBe(expected(f,d)+2);expect(snapshot(f.c)).toBe(before);f.c.profile.disabledEntries=[disabled==='canonical'?canonical:f.entry.id];const paused=snapshot(f.c),off=evaluate(f.c);expect(off.ac).toBe(10+off.modifiers.dex+2);expect(snapshot(f.c)).toBe(paused);}
});
