import {irMechanics} from './ir';
import {ABILITIES,ABILITY_LABELS,type Ability,type Entry} from '../model';

export type BackgroundAbilityOption={value:string;label:string;abilities:Partial<Record<Ability,number>>};
export function backgroundAbilityValue(values:Partial<Record<Ability,number>>={}):string{return ABILITIES.filter(key=>!!values[key]).map(key=>`${key}:${values[key]}`).join('|');}

/** Enumerate only the declared fixed/from/weighted shapes supported by the old
 * background controls. Recording a choice does not alter the card's base scores. */
export function backgroundAbilityOptions(entry:Entry):BackgroundAbilityOption[]{
 const out=new Map<string,BackgroundAbilityOption>();
 const model=irMechanics(entry);if(!model)return [];
 const sets=[...new Set((model.grants||[]).filter(grant=>grant.type==='abilityScore').map(grant=>grant.setOption??0))];if(!sets.length)sets.push(0);
 for(const set of sets){
  const fixed:Partial<Record<Ability,number>>={};
  for(const modifier of model.modifiers||[])if(ABILITIES.includes(modifier.target as Ability)&&modifier.op==='add'&&typeof modifier.value==='number')fixed[modifier.target as Ability]=(fixed[modifier.target as Ability]||0)+modifier.value;
  const grants=(model.grants||[]).filter(grant=>grant.type==='abilityScore'&&(grant.setOption??0)===set);
  for(const grant of grants)for(const ability of grant.fixed||[])if(ABILITIES.includes(ability as Ability))fixed[ability as Ability]=(fixed[ability as Ability]||0)+(grant.amount||0);
  const choice=grants.find(grant=>grant.choose),from=choice?.choose?.from||[],weights=choice?.choose?.weights||[];
  const emit=(values:Partial<Record<Ability,number>>)=>{const value=backgroundAbilityValue(values);if(!value||Object.values(values).some(n=>Number(n)>10))return;out.set(value,{value,label:ABILITIES.filter(key=>values[key]).map(key=>`${ABILITY_LABELS[key]} +${values[key]}`).join('、'),abilities:values});};
  const visit=(index:number,used:Ability[],values:Partial<Record<Ability,number>>)=>{if(index===weights.length){emit(values);return;}for(const key of from as Ability[])if(!used.includes(key))visit(index+1,[...used,key],{...values,[key]:(values[key]||0)+weights[index]});};
  visit(0,[],fixed);
 }
 return [...out.values()];
}
