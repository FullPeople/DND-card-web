import {projectItemCastingBonuses,type ItemCastingBonusContext} from './automation/itemCastingBonuses';
import {evaluateInfusions} from './automation/infusions';
import {activeSelections} from './automation/active';
import {type Character,type Selection,type SpellSettings,type Derived,type Ability,ABILITIES} from './model';
import {inferredSpellMode,casterProfiles} from './spellcastingRules';
import {preparationBase} from './preparation';
export function inventoryState(c:Character){return c.inventory||{view:'grid' as const,order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:0,pp:0}};}
export function spellState(c:Character,d?:Derived):SpellSettings{
 const profiles=casterProfiles(c).filter(p=>ABILITIES.includes(p.casting.entry.raw.spellcastingAbility));
 const casting=profiles.find(p=>p.owner.id===c.spellSettings?.abilityClassId)||profiles[0];
 const ability=casting?.casting.entry.raw.spellcastingAbility||c.spellSettings?.ability||'int';
 const slots=Object.fromEntries(Object.entries(c.runtime.resources).filter(([id])=>/^spell-slot:[1-9]$/.test(id)).map(([id,r])=>[id.split(':')[1],{max:r.max,used:Math.max(0,r.max-r.current)}]));
 const defaults:SpellSettings={mode:inferredSpellMode(c)||'prepared',ability,capacity:0,attackBonus:0,dcBonus:0,prepared:[],slots};
 const stored=c.spellSettings||defaults,base=preparationBase(c,d);
 const adjustment=stored.capacityAdjustment??(stored.capacity>0?stored.capacity-(base||0):0);
 return {...stored,ability:stored.abilityOverride?stored.ability:ability,capacityAdjustment:adjustment,capacity:Math.max(0,Math.min(100,(base||0)+adjustment)),mode:stored.modeOverride?stored.mode:inferredSpellMode(c)||stored.mode};
}
export type SpellValueRecipientContext=Omit<ItemCastingBonusContext,'ability'>;
/** Values and explanatory sources share one recipient context. Manual math and
 * infusion behavior retain their previous ownership; new item modifiers never
 * grant a class, spell, payment route or persistent state. */
export function spellValueDetails(c:Character,d:Derived,ability?:Ability,recipient?:SpellValueRecipientContext){
 const s=spellState(c,d),selectedAbility=ability||s.ability,mod=d.modifiers[selectedAbility]||0,infusion=evaluateInfusions(c,activeSelections(c));
 const item=projectItemCastingBonuses(c,{...recipient,ability:selectedAbility});
 return {values:{attack:mod+d.proficiency+s.attackBonus+infusion.spellAttack.bonus+item.attackBonus,dc:8+mod+d.proficiency+s.dcBonus+item.dcBonus},ability:selectedAbility,
  attackSourceTrace:[...infusion.spellAttack.trace,...item.attackTrace,...item.issues.map(issue=>issue.message)],
  dcSourceTrace:[...item.dcTrace,...item.issues.map(issue=>issue.message)],issues:item.issues};
}
// Preserve the public two-field result shape for all existing consumers.
export function spellValues(c:Character,d:Derived,ability?:Ability,recipient?:SpellValueRecipientContext){return spellValueDetails(c,d,ability,recipient).values;}
export function itemWeight(s:Selection){return typeof s.entry.raw.weight==='number'&&Number.isFinite(s.entry.raw.weight)?s.entry.raw.weight*s.quantity:undefined;}
export function carriedWeight(c:Character){const items=c.selections.filter(s=>s.entry.kind==='item');return {items:items.reduce((sum,s)=>sum+(itemWeight(s)||0),0),coins:Object.values(inventoryState(c).coins).reduce((sum,n)=>sum+n,0)/50,unknown:items.filter(s=>itemWeight(s)===undefined).length};}
