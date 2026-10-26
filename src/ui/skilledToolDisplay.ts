import type {Character} from '../core/model';
import {equipmentTraining} from '../core/proficiencyText';
import {reviewedSkilledOptions,reviewedSkilledToolLabels} from '../core/automation/reviewedSkilled';
const normalized=(value:string)=>value.trim().toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ');
/** Deduplicate only the finite reviewed PHB kinds. This is display projection,
 * not a generic tool-choice executor or a rewrite of manual training text. */
export function appendReviewedSkilledTools(c:Character,existing:string[]):string[]{
 const additions=reviewedSkilledToolLabels(c);if(!additions.length)return existing;
 const options=reviewedSkilledOptions(c).filter(row=>row.choice.kind==='tool');
 const reference=(value:string)=>{
  const tag=/^\{@(?:item|itemProperty) ([^{}]+)\}$/.exec(value),[name,source]= (tag?.[1]||value).split('|');
  if((source|| (c.edition==='2024'?'XPHB':'PHB')).toUpperCase()!=='PHB')return;
  const category=equipmentTraining(name),match=options.find(row=>normalized(name)===normalized(row.entry.name)||normalized(name)===normalized(row.choice.reference.split('|')[0])||category&&equipmentTraining(row.entry.name)?.[0]===category[0]);
  return match?.choice.reference;
 };
 const present=new Set(existing.map(reference).filter(Boolean));
 return [...existing,...additions.flatMap(value=>{const option=options.find(row=>row.entry.name===value);if(!option||present.has(option.choice.reference))return [];const category=equipmentTraining(option.entry.name);return [category?`{@itemProperty ${category[1]}|PHB}`:`{@item ${option.choice.reference}|${option.entry.name}}`];})];
}
