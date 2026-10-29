import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportOwlbear,exportReview} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {removeSelection} from '../src/core/sheet';
import {runtimeValueEdit} from '../src/core/runtimeCharacterEdit';
import {setInfusionTarget} from '../src/core/automation/infusions';
import {racialResistanceFixture} from './helpers/racialResistanceFlowFixture';
import {racialResistanceSpecs,racialResistanceHeldEntries,racialResistanceSourceEvidence,racialResistanceSnapshot as snapshot} from './helpers/racialResistanceSourceFixture';
import {itemResistanceBonusFixture} from './helpers/itemResistanceBonusFlowFixture';
import {attunedInfusionFixture} from './e2e/attunedInfusionFixture';

beforeAll(()=>{racialResistanceSourceEvidence();});
const sorted=(values:readonly string[]|undefined)=>[...(values||[])].sort();
const admittedSpecs=()=>{const keys=new Set(racialResistanceSourceEvidence().rules.map(rule=>rule.key));return racialResistanceSpecs.filter(spec=>keys.has(spec.key));};

it('every admitted complete racial source owns only its fixed types in canonical and App routes, survives native reopening, and leaves the full manual character unchanged',()=>{
 expect(admittedSpecs().length).toBeGreaterThan(0);
 for(const form of ['canonical','app']as const)for(const spec of admittedSpecs()){const f=racialResistanceFixture(spec.key,form),before=snapshot(f.c),d=evaluate(f.c);expect(sorted(d.resistances)).toEqual(sorted(spec.resistances));expect(new Set(d.resistances).size).toBe(spec.resistances.length);expect(d.trace.resistances.some(row=>row.includes(f.entry.name))).toBe(true);expect(d.issues.some(issue=>issue.id.startsWith('racial-resistance:'))).toBe(false);expect(snapshot(f.c)).toBe(before);
  const reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(reopened)).toBe(before);expect(sorted(evaluate(reopened).resistances)).toEqual(sorted(spec.resistances));expect(snapshot(reopened)).toBe(before);expect(Object.hasOwn(reopened,'resistances')).toBe(false);expect(reopened.runtime.hp).toBe(3);expect(reopened.runtime.tempHp).toBe(2);expect(reopened.runtime.resources.manual.current).toBe(1);
 }
});

it('current source, canonical and transport identities, unique root ownership and explicit held snapshots revoke only the new derived resistance without deleting stored choices',()=>{
 for(const mode of ['source','entry','automation','future','duplicate','parent','forged','removed']as const){const f=racialResistanceFixture();if(mode==='source')f.c.profile.enabledSources=[];if(mode==='entry')f.c.profile.disabledEntries=[f.entry.id];if(mode==='automation')f.c.automation!.enabled=false;if(mode==='future')f.c.automation!.protocol=999;if(mode==='duplicate')f.c.selections.push({...structuredClone(f.owner),id:'authored-other-race-root'});if(mode==='parent')f.owner.parentId='authored-absent-parent';if(mode==='forged')f.entry.raw.resist=['force'];if(mode==='removed')removeSelection(f.c,f.owner.id);const before=snapshot(f.c);expect(evaluate(f.c).resistances).toEqual([]);expect(snapshot(f.c)).toBe(before);const reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(reopened)).toBe(before);expect(evaluate(reopened).resistances).toEqual([]);expect(snapshot(reopened)).toBe(before);expect(reopened.runtime.hp).toBe(3);expect(reopened.runtime.tempHp).toBe(2);expect(reopened.runtime.resources.manual.current).toBe(1);}
 // Malformed duplicate selection IDs are an engine hold and a native-import
 // rejection, not a saveable alternate owner form.
 const duplicateId=racialResistanceFixture();duplicateId.c.selections.push(structuredClone(duplicateId.owner));const duplicateBefore=snapshot(duplicateId.c);expect(evaluate(duplicateId.c).resistances).toEqual([]);expect(()=>readCharacter(exportCharacter(duplicateId.c))).toThrow();expect(snapshot(duplicateId.c)).toBe(duplicateBefore);
 for(const disabled of ['canonical','alias']as const){const f=racialResistanceFixture(),canonicalId=f.entry.id;f.entry.id='authored-racial-resistance-transport-alias';const active=snapshot(f.c);expect(sorted(evaluate(f.c).resistances)).toEqual(sorted(f.spec.resistances));expect(snapshot(f.c)).toBe(active);f.c.profile.disabledEntries=[disabled==='canonical'?canonicalId:f.entry.id];const before=snapshot(f.c);expect(evaluate(f.c).resistances).toEqual([]);expect(snapshot(f.c)).toBe(before);}
 const collision=racialResistanceFixture();collision.entry.id=racialResistanceFixture(admittedSpecs()[1].key).entry.id;const collisionBefore=snapshot(collision.c);expect(evaluate(collision.c).resistances).toEqual([]);expect(snapshot(collision.c)).toBe(collisionBefore);
 const held=racialResistanceHeldEntries();expect(held.length).toBeGreaterThan(0);for(const entry of held){const f=racialResistanceFixture();f.owner.entry=structuredClone(entry);f.c.profile.enabledSources=[entry.source,...(entry.dependencies||[])];const before=snapshot(f.c),d=evaluate(f.c);expect(d.resistances).toEqual([]);expect(d.issues.some(issue=>issue.id.startsWith('racial-resistance:'))).toBe(true);expect(snapshot(f.c)).toBe(before);}
 // Re-enabling a source restores the projection, not HP or spent resources.
 const restored=racialResistanceFixture(),original=snapshot(restored.c);restored.c.profile.enabledSources=[];expect(evaluate(restored.c).resistances).toEqual([]);restored.c.profile.enabledSources=[restored.entry.source,...(restored.entry.dependencies||[])];expect(sorted(evaluate(restored.c).resistances)).toEqual(sorted(restored.spec.resistances));expect(snapshot(restored.c)).toBe(original);
});

it('a real racial source unions and deduplicates with the retained typed Ring and Resistant Armor without turning resistance into automatic HP arithmetic or exported defenses',()=>{
 const spec=admittedSpecs().find(row=>row.resistances.length===1&&row.resistances[0]==='cold')!;expect(!!spec).toBe(true);const f=racialResistanceFixture(spec.key),ring=itemResistanceBonusFixture(1752),old=attunedInfusionFixture(),armor=old.options.find(row=>row.english==='Resistant Armor')!;
 f.c.selections.push(structuredClone(ring.owner),...structuredClone(old.c.selections));f.c.answers={...f.c.answers,...structuredClone(old.c.answers)};f.c.classChoiceSnapshots=structuredClone(old.c.classChoiceSnapshots);f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,...ring.c.profile.enabledSources,...old.c.profile.enabledSources])];setInfusionTarget(f.c,old.choiceId,armor.id,'attuned-item-0',{damageType:'fire'});f.c.baseHp=20;f.c.runtime.hp=9;const original=structuredClone(f.c),before=snapshot(f.c),intent=snapshot(f.c.infusions),d=evaluate(f.c);expect(sorted(d.resistances)).toEqual(['acid','cold','fire']);expect(d.trace.resistances.some(row=>row.includes(f.entry.name))).toBe(true);expect(d.trace.resistances.some(row=>row.includes(ring.entry.name))).toBe(true);expect(d.trace.resistances.some(row=>row.includes('Resistant Armor')||row.includes('抗性护甲'))).toBe(true);expect(snapshot(f.c)).toBe(before);
 const duplicate=structuredClone(original);setInfusionTarget(duplicate,old.choiceId,armor.id,'attuned-item-0',{damageType:'cold'});const duplicateBefore=snapshot(duplicate);expect(sorted(evaluate(duplicate).resistances)).toEqual(['acid','cold']);expect(snapshot(duplicate)).toBe(duplicateBefore);
 removeSelection(f.c,f.owner.id);const removed=snapshot(f.c);expect(sorted(evaluate(f.c).resistances)).toEqual(['acid','fire']);expect(snapshot(f.c.infusions)).toBe(intent);expect(snapshot(f.c)).toBe(removed);
 const hp=structuredClone(original),expected=structuredClone(original);expected.runtime.hp=5;runtimeValueEdit('hp',hp.runtime.hp-4)(hp);expect(snapshot(hp)).toBe(snapshot(expected));expect(sorted(evaluate(hp).resistances)).toEqual(['acid','cold','fire']);expect(hp.runtime.hp).toBe(5);expect(hp.runtime.tempHp).toBe(2);expect(hp.runtime.resources.manual.current).toBe(1);expect(snapshot(readCharacter(exportCharacter(hp)).character)).toBe(snapshot(expected));
 const exported=exportOwlbear(original,d),review=exportReview(original,d);expect(exported.defenses).toEqual({resistances:[],immunities:[],advantages:[],disadvantages:[]});expect(exported.export_warnings.some(row=>row.includes('cold')&&row.includes('伤害结算仍需手动'))).toBe(true);expect(review.includes('cold')).toBe(true);expect(review.includes('伤害结算仍需手动')).toBe(true);expect(snapshot(original)).toBe(before);
});
