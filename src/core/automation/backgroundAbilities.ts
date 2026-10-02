import {ABILITIES,ABILITY_LABELS,type Ability,type Entry} from '../model';

export type BackgroundAbilityOption={value:string;label:string;abilities:Partial<Record<Ability,number>>};
export function backgroundAbilityValue(values:Partial<Record<Ability,number>>={}):string{return ABILITIES.filter(key=>!!values[key]).map(key=>`${key}:${values[key]}`).join('|');}

/** Enumerate only the declared fixed/from/weighted shapes supported by the old
 * background controls. Recording a choice does not alter the card's base scores. */
export function backgroundAbilityOptions(entry:Entry):BackgroundAbilityOption[]{
 const out=new Map<string,BackgroundAbilityOption>();
 if(!Array.isArray(entry.raw.ability))return [];
 for(const block of entry.raw.ability){
  if(!block||typeof block!=='object'||Object.keys(block).some(key=>key!=='choose'&&!ABILITIES.includes(key as Ability)))continue;
  const fixed=Object.fromEntries(ABILITIES.filter(key=>block[key]!==undefined).map(key=>[key,block[key]])) as Partial<Record<Ability,number>>;
  if(Object.values(fixed).some(value=>!Number.isSafeInteger(value)||Number(value)<0||Number(value)>10))continue;
  const choose=block.choose,from=choose?.weighted?.from??choose?.from??[],weights=choose?.weighted?.weights??(choose?Array.from({length:Math.min(6,choose.count??1)},()=>choose.amount??1):[]);
  if(choose&&(!Array.isArray(from)||!Array.isArray(weights)||weights.length<1||weights.length>6||from.some((key:unknown)=>!ABILITIES.includes(key as Ability))||new Set(from).size!==from.length||weights.some((value:unknown)=>!Number.isSafeInteger(value)||Number(value)<1||Number(value)>10)||weights.length>from.length||choose.count!==undefined&&(!Number.isSafeInteger(choose.count)||choose.count<1||choose.count>6)))continue;
  const emit=(values:Partial<Record<Ability,number>>)=>{const value=backgroundAbilityValue(values);if(!value||Object.values(values).some(n=>Number(n)>10))return;out.set(value,{value,label:ABILITIES.filter(key=>values[key]).map(key=>`${ABILITY_LABELS[key]} +${values[key]}`).join('、'),abilities:values});};
  const visit=(index:number,used:Ability[],values:Partial<Record<Ability,number>>)=>{if(index===weights.length){emit(values);return;}for(const key of from as Ability[])if(!used.includes(key))visit(index+1,[...used,key],{...values,[key]:(values[key]||0)+weights[index]});};
  visit(0,[],fixed);
 }
 return [...out.values()];
}
