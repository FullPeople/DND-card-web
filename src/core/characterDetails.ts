import {automationEnabled} from './automation/state';
import {irMechanics,irSelectionActive,irModifierValue,applyIrNumber} from './automation/ir';
import {type Ability,type Character,type Selection,type SpellSettings,type Derived,ABILITIES} from './model';
import {inferredSpellMode,casterProfiles} from './spellcastingRules';
import {preparationBase} from './preparation';
export function inventoryState(c:Character){return c.inventory||{view:'grid' as const,order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:0,pp:0}};}
export function spellState(c:Character):SpellSettings{
 const profiles=casterProfiles(c).filter(p=>ABILITIES.includes(irMechanics(p.casting.entry)?.classModel?.spellcastingAbility as Ability));
 const casting=profiles.find(p=>p.owner.id===c.spellSettings?.abilityClassId)||profiles[0];
 const declared=casting?irMechanics(casting.casting.entry)?.classModel?.spellcastingAbility:undefined;
 const ability:Ability=ABILITIES.includes(declared as Ability)?declared as Ability:c.spellSettings?.ability||'int';
 const slots=Object.fromEntries(Object.entries(c.runtime.resources).filter(([id])=>/^spell-slot:[1-9]$/.test(id)).map(([id,r])=>[id.split(':')[1],{max:r.max,used:Math.max(0,r.max-r.current)}]));
 const defaults:SpellSettings={mode:inferredSpellMode(c)||'prepared',ability,capacity:0,attackBonus:0,dcBonus:0,prepared:[],slots};
 const stored=c.spellSettings||defaults,base=preparationBase(c);
 const adjustment=stored.capacityAdjustment??(stored.capacity>0?stored.capacity-(base||0):0);
 return {...stored,ability:stored.abilityOverride?stored.ability:ability,capacityAdjustment:adjustment,capacity:Math.max(0,Math.min(100,(base||0)+adjustment)),mode:stored.modeOverride?stored.mode:inferredSpellMode(c)||stored.mode};
}
export function spellValues(c:Character,d:Derived){const s=spellState(c),mod=d.modifiers[s.ability]||0;let attack=mod+d.proficiency+s.attackBonus,dc=8+mod+d.proficiency+s.dcBonus;if(automationEnabled(c))for(const row of c.selections)if(irSelectionActive(c,row)){const model=irMechanics(row.entry);if(row.entry.kind==='item'&&row.equipped&&row.quantity>0&&(!model?.equipmentModel?.requiresAttunement||row.attuned)){attack+=model?.equipmentModel?.spellAttackBonus||0;dc+=model?.equipmentModel?.spellDcBonus||0;}for(const modifier of model?.modifiers||[])if(['attack.spell','dc.spell'].includes(modifier.target))try{const amount=irModifierValue(c,row,modifier,d.abilities);if(typeof amount==='number'){if(modifier.target==='dc.spell')dc=applyIrNumber(dc,modifier,amount);else if(modifier.target==='attack.spell')attack=applyIrNumber(attack,modifier,amount);}}catch{}}return {attack,dc};}
export function itemWeight(s:Selection){return irMechanics(s.entry)?.equipmentModel?.weight!==undefined?irMechanics(s.entry)!.equipmentModel!.weight!*s.quantity:undefined;}
export function carriedWeight(c:Character){const items=c.selections.filter(s=>s.entry.kind==='item');return {items:items.reduce((sum,s)=>sum+(itemWeight(s)||0),0),coins:Object.values(inventoryState(c).coins).reduce((sum,n)=>sum+n,0)/50,unknown:items.filter(s=>itemWeight(s)===undefined).length};}
