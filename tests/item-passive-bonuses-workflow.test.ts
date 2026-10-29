import {createHash} from 'node:crypto';
import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import type {Entry,Selection} from '../src/core/model';
import {itemPassiveBonusEntries,itemPassiveBonusSnapshot} from './helpers/itemPassiveBonusSourceFixture';
import {itemPassiveBonusFixture} from './helpers/itemPassiveBonusFlowFixture';
// Hash the complete serialized state so a failure cannot print source bodies.
const snapshot=(c:unknown)=>createHash('sha256').update(JSON.stringify(c)).digest('hex');
function fixture(english='Cloak of Protection',source='DMG'){
 const matches=itemPassiveBonusEntries().filter(e=>e.english===english&&e.source===source);expect(matches).toHaveLength(1);return itemPassiveBonusFixture(matches[0].id);
}
beforeAll(()=>{itemPassiveBonusEntries();});
it('distinct source-qualified cloak and ring bonuses compose without duplicating proficiency or changing resources',()=>{
 const first=fixture(),second=fixture('Ring of Protection'),extra=structuredClone(second.owner);extra.id='second-passive-owner';first.c.selections.push(extra);
 const before=snapshot(first.c),d=evaluate(first.c);expect(d.ac).toBe(12);for(const save of Object.values(d.saves)){expect(save.value).toBe(2);expect(save.proficient).toBe(false);}expect(d.abilities).toEqual(first.c.abilities);expect(snapshot(first.c)).toBe(before);
 extra.attuned=false;expect(evaluate(first.c).ac).toBe(11);for(const save of Object.values(evaluate(first.c).saves))expect(save.value).toBe(1);extra.attuned=true;expect(evaluate(first.c).ac).toBe(12);
});
it('manual final AC and save totals override natural item bonuses while independent offsets remain additive',()=>{
 const f=fixture();f.c.adjustments=[{id:'authored-ac-final',target:'ac',value:20,reason:'Authored retained manual final total'},{id:'authored-save-final',target:'save:dex',value:14,reason:'Authored retained manual save total'}];f.c.sheetBonuses={ac:3};f.c.saveBonuses={dex:2};
 const before=snapshot(f.c),d=evaluate(f.c);expect(d.ac).toBe(23);expect(d.saves.dex.value).toBe(16);expect(d.saves.str.value).toBe(1);expect(d.trace.ac.join(' ')).toContain(f.entry.name);expect(d.trace['save:dex'].join(' ')).toContain('人工覆盖');expect(snapshot(f.c)).toBe(before);
});
it('native save/reopen and explicit equipment correction preserve stored entries and spent/manual state',()=>{
 const f=fixture();const bytes=snapshot(f.c),reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(f.c)).toBe(bytes);const before=snapshot(reopened);expect(evaluate(reopened).ac).toBe(11);expect(snapshot(reopened)).toBe(before);
 const owner=reopened.selections.find(s=>s.id===f.owner.id)!;owner.equipped=false;const off=snapshot(reopened);expect(evaluate(reopened).ac).toBe(10);expect(snapshot(reopened)).toBe(off);owner.equipped=true;expect(evaluate(reopened).ac).toBe(11);expect(reopened.runtime).toEqual(f.c.runtime);expect(reopened.notes).toBe(f.c.notes);expect(itemPassiveBonusSnapshot(owner.entry)).toBe(itemPassiveBonusSnapshot(f.owner.entry));
});
it('source disable and restoration suspend derived benefits without deleting retained ownership or values',()=>{
 const f=fixture();f.c.profile.enabledSources=f.c.profile.enabledSources.filter(s=>s!==f.entry.source);const off=snapshot(f.c);expect(evaluate(f.c).ac).toBe(10);for(const save of Object.values(evaluate(f.c).saves))expect(save.value).toBe(0);expect(snapshot(f.c)).toBe(off);f.c.profile.enabledSources.push(f.entry.source);expect(evaluate(f.c).ac).toBe(11);expect(evaluate(f.c,new Set([f.owner.id])).ac).toBe(10);expect(f.c.selections.find(s=>s.id===f.owner.id)===f.owner).toBe(true);
});
it('the independent existing generic armor route remains functional beside the new nonarmor source projection',()=>{
 const f=fixture();const entry:Entry={id:'authored:armor:passive-composition',name:'Authored retained armor',english:'Authored retained armor',kind:'item',packId:'authored',source:'PHB',edition:'2014',revision:'authored-1',entries:[],raw:{type:'MA',ac:14,bonusAc:'1'}};
 const armor:Selection={id:'authored-retained-armor',entry,quantity:1,level:1,equipped:true};f.c.profile.enabledSources.push('PHB');f.c.selections.push(armor);const before=snapshot(f.c);expect(evaluate(f.c).ac).toBe(16);expect(snapshot(f.c)).toBe(before);f.owner.attuned=false;expect(evaluate(f.c).ac).toBe(15);
});
it('unknown automation protocol remains opaque and grants no new passive benefit',()=>{
 const f=fixture();(f.c as any).automation={version:99,future:{opaque:['retained']}};const before=snapshot(f.c),d=evaluate(f.c);expect(d.ac).toBe(10);for(const save of Object.values(d.saves))expect(save.value).toBe(0);expect(snapshot(f.c)).toBe(before);expect(d.issues.some(i=>i.id==='automation-protocol')).toBe(true);
});
