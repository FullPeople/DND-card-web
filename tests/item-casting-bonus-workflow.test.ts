import {beforeAll,expect,it} from 'vitest';
import type {Character,Selection} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {spellState,spellValues,spellValueDetails,type SpellValueRecipientContext} from '../src/core/characterDetails';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {itemCastingBonusFixture} from './helpers/itemCastingBonusFlowFixture';
import {itemCastingBonusClass,itemCastingBonusSourceEvidence,itemCastingBonusSnapshot as snapshot} from './helpers/itemCastingBonusSourceFixture';
beforeAll(()=>{itemCastingBonusSourceEvidence();});
function addClass(c:Character,role:Parameters<typeof itemCastingBonusClass>[0],id:string,level=5){const entry=structuredClone(itemCastingBonusClass(role,'2014')),row:Selection={id,entry,level,quantity:1,equipped:false};c.selections.push(row);for(const source of[entry.source,...(entry.dependencies||[])])if(!c.profile.enabledSources.includes(source))c.profile.enabledSources.push(source);c.profile.optional.multiclass=true;return row;}
function off(c:Character){const copy=structuredClone(c);for(const row of copy.selections)if(row.entry.kind==='item')row.attuned=false;return copy;}
function delta(c:Character,context?:SpellValueRecipientContext){const base=off(c),a=spellValues(c,evaluate(c),undefined,context),b=spellValues(base,evaluate(base),undefined,context);return{attack:a.attack-b.attack,dc:a.dc-b.dc};}
it('the public numerical API isolates same-CHA class owners and never borrows one through an invalid or ambiguous default',()=>{
 const f=itemCastingBonusFixture(3),warlock=addClass(f.c,'Warlock','warlock-recipient'),before=snapshot(f.c);
 expect(delta(f.c,{casterId:f.caster.id})).toEqual({attack:1,dc:1});expect(delta(f.c,{casterId:warlock.id})).toEqual({attack:0,dc:0});expect(delta(f.c)).toEqual({attack:1,dc:1});expect(snapshot(f.c)).toBe(before);
 f.c.spellSettings!.abilityClassId=warlock.id;expect(delta(f.c)).toEqual({attack:0,dc:0});f.c.spellSettings!.abilityClassId='missing-explicit-owner';expect(delta(f.c)).toEqual({attack:0,dc:0});
 const ambiguous=itemCastingBonusFixture(3),manual=addClass(ambiguous.c,'Warlock','authored-unproved-caster');manual.entry={...manual.entry,id:'authored:unproved-caster',packId:'authored',source:'MANUAL'};ambiguous.c.profile.enabledSources.push('MANUAL');delete ambiguous.c.spellSettings!.abilityClassId;const retained=snapshot(ambiguous.c);expect(delta(ambiguous.c)).toEqual({attack:0,dc:0});expect(delta(ambiguous.c,{casterId:ambiguous.caster.id})).toEqual({attack:1,dc:1});expect(snapshot(ambiguous.c)).toBe(retained);
});
it('all-your-spells recipient scope is separate from class attunement and does not require ordinary payment readiness',()=>{
 const f=itemCastingBonusFixture(1),druid=addClass(f.c,'Druid','druid-recipient');f.caster.entry=structuredClone(itemCastingBonusClass('Paladin','2014'));f.caster.level=1;f.c.spellSettings!.abilityClassId=druid.id;const before=snapshot(f.c);
 expect(delta(f.c,{casterId:druid.id})).toEqual({attack:1,dc:1});expect(delta(f.c)).toEqual({attack:1,dc:1});expect(Object.keys(f.c.runtime.resources)).toEqual(['manual']);expect(f.c.spellSettings!.slots).toEqual({});expect(snapshot(f.c)).toBe(before);
 f.c.profile.disabledEntries=[f.caster.entry.id];expect(delta(f.c,{casterId:druid.id})).toEqual({attack:0,dc:0});
});
it('native reopening, equipment/source withdrawal and restoration preserve preparation, offsets and spent manual balances',()=>{
 const f=itemCastingBonusFixture(17),reopened=readCharacter(exportCharacter(f.c)).character;const before=snapshot(reopened);expect(delta(reopened)).toEqual({attack:2,dc:2});expect(snapshot(reopened)).toBe(before);const owner=reopened.selections.find(row=>row.id===f.owner.id)!;
 owner.equipped=false;const unequipped=snapshot(reopened);expect(delta(reopened)).toEqual({attack:0,dc:0});expect(snapshot(reopened)).toBe(unequipped);owner.equipped=true;expect(delta(reopened)).toEqual({attack:2,dc:2});reopened.profile.enabledSources=reopened.profile.enabledSources.filter(source=>source!==f.entry.source);const restricted=snapshot(reopened);expect(delta(reopened)).toEqual({attack:0,dc:0});expect(snapshot(reopened)).toBe(restricted);reopened.profile.enabledSources.push(f.entry.source);expect(delta(reopened)).toEqual({attack:2,dc:2});expect(reopened.runtime.resources.manual).toEqual(f.c.runtime.resources.manual);expect(reopened.spellSettings!.attackBonus).toBe(7);expect(reopened.spellSettings!.dcBonus).toBe(11);expect(reopened.spellSettings!.prepared).toEqual([]);
});
it('manual mode and ability overrides retain their arithmetic while unsupported custom ability contexts hold only the new modifier',()=>{
 const f=itemCastingBonusFixture(3);f.c.spellSettings!.modeOverride=true;expect(delta(f.c)).toEqual({attack:1,dc:1});f.c.spellSettings!.abilityOverride=true;f.c.spellSettings!.ability='wis';f.c.abilities.wis=18;const before=snapshot(f.c),d=evaluate(f.c),values=spellValues(f.c,d),settings=spellState(f.c);
 expect(values.attack).toBe(d.modifiers.wis+d.proficiency+7);expect(values.dc).toBe(8+d.modifiers.wis+d.proficiency+11);expect(delta(f.c)).toEqual({attack:0,dc:0});expect(settings.ability).toBe('wis');expect(snapshot(f.c)).toBe(before);
});
it('values and source traces share recipient provenance while source-selected casts keep their original stat path and public result shape',()=>{
 const f=itemCastingBonusFixture(3),warlock=addClass(f.c,'Warlock','trace-warlock'),d=evaluate(f.c),before=snapshot(f.c),sorcerer=spellValueDetails(f.c,d,'cha',{casterId:f.caster.id}),other=spellValueDetails(f.c,d,'cha',{casterId:warlock.id});
 expect(Object.keys(spellValues(f.c,d)).sort()).toEqual(['attack','dc']);expect(sorcerer.values).toEqual(spellValues(f.c,d,'cha',{casterId:f.caster.id}));expect(sorcerer.values.attack-other.values.attack).toBe(1);expect(sorcerer.values.dc-other.values.dc).toBe(1);expect(sorcerer.attackSourceTrace.some(row=>row.includes(f.entry.name))).toBe(true);expect(sorcerer.dcSourceTrace.some(row=>row.includes(f.entry.name))).toBe(true);expect((d.trace.spellAttack||[]).some(row=>row.includes(f.entry.name))).toBe(false);expect(sorcerer.attackSourceTrace.some(row=>row.startsWith('手动调整'))).toBe(false);
 expect(delta(f.c,{sourceSelectionId:'authored-source-stat-context'})).toEqual({attack:0,dc:0});expect(snapshot(f.c)).toBe(before);
});
