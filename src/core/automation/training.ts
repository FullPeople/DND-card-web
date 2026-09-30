import type {Character,Selection} from '../model';
import {equipmentTraining} from '../proficiencyText';

function declarations(value:unknown):string[]{
 if(typeof value==='string')return [value];
 if(Array.isArray(value))return value.flatMap(declarations);
 if(!value||typeof value!=='object')return [];
 const object=value as Record<string,unknown>;
 if(typeof object.proficiency==='string'&&!object.optional)return [object.proficiency];
 return Object.entries(object).flatMap(([key,v])=>v===true?[key]:[]);
}
/** Resolve category handles while preserving named item references and their source. */
function categoryDeclaration(value:string):string{
 const reference=value.match(/^\{@itemProperty ([^{}]+)\}$/);
 return reference?equipmentTraining(reference[1].split('|')[0])?.[0]||value:value;
}
/** Manual declarations replace inferred training, including an explicitly empty list. */
export function trainingDeclarations(c:Character,active:Selection[],group:'armor'|'weapons'):string[]{
 if(c.training?.[group]!==undefined)return c.training[group]!.split(/[,，、;；\n]+/).map(s=>s.trim()).filter(Boolean).map(categoryDeclaration);
 const first=c.selections.find(s=>s.entry.kind==='class'),field=group==='armor'?'armorProficiencies':'weaponProficiencies';
 return active.flatMap(row=>{
  const raw=row.entry.raw;
  if(row.entry.kind==='item'&&(!row.equipped||raw.reqAttune&&!row.attuned))return [];
  const declared=row.entry.kind==='class'?(row.id===first?.id?raw.startingProficiencies:raw.multiclassing?.proficienciesGained):undefined;
  return [...declarations(declared?.[group]??declared?.[field]),...declarations(raw[field])];
 }).map(categoryDeclaration);
}
