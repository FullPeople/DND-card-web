import {ownedSpellLevel,irMechanics} from './automation/ir';
import type {Character} from './model';
import {casterProfiles} from './spellcastingRules';

export const boundedCapacity=(value:number)=>Math.max(0,Math.min(100,Math.trunc(value)||0));
export function knownSpellCapacity(c:Character){
 const base=casterProfiles(c).filter(p=>p.mode==='known').reduce((sum,p)=>sum+Number(irMechanics(p.casting.entry)?.classModel?.knownProgression?.[p.owner.level-1]??irMechanics(p.casting.entry)?.classModel?.preparedProgression?.[p.owner.level-1]??0),0);
 return boundedCapacity(base+(c.spellSettings?.knownCapacityAdjustment||0));
}
/** Render exactly the allowance; retain overflow separately without erasing choices. */
export function capacitySlots(ids:string[],capacity:number){
 const slots=Array.from({length:boundedCapacity(capacity)},(_,i)=>ids[i]||'');
 const overflow=ids.slice(slots.length).filter(Boolean);
 return {slots,overflow};
}
export function sourceCapacity(c:Character,ownerId:string){
 const specials=c.spellSettings?.special||{};
 const fixed=c.selections.filter(s=>s.entry.kind==='spell'&&specials[s.id]&&!specials[s.id].manualSource&&(specials[s.id].sourceGrant?.ownerId||'manual')===ownerId).length;
 const total=boundedCapacity(fixed+(c.spellSettings?.sourceCantripCapacities?.[ownerId]||0)+(c.spellSettings?.sourceCapacityAdjustments?.[ownerId]||0));
 return {fixed,total,manual:Math.max(0,total-fixed)};
}
