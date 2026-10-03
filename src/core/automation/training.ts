import type {Character,Selection} from '../model';
import {equipmentTraining} from '../proficiencyText';
import {irMechanics,irGrantValues} from './ir';
import {automationEnabled} from './state';

/** Resolve category handles while preserving named item references and their source. */
function categoryDeclaration(value:string):string{
 const reference=value.match(/^\{@itemProperty ([^{}]+)\}$/);
 return reference?equipmentTraining(reference[1].split('|')[0])?.[0]||value:value;
}
/** Manual declarations replace inferred training, including an explicitly empty list. */
export function trainingDeclarations(c:Character,active:Selection[],group:'armor'|'weapons'):string[]{
 if(c.training?.[group]!==undefined)return c.training[group]!.split(/[,，、;；\n]+/).map(s=>s.trim()).filter(Boolean).map(categoryDeclaration);
 if(!automationEnabled(c))return [];
 const type=group==='armor'?'armorProficiency':'weaponProficiency';
 return active.flatMap(row=>{
  const model=irMechanics(row.entry);
  if(row.entry.kind==='item'&&(!row.equipped||model?.equipmentModel?.requiresAttunement&&!row.attuned))return [];
  return (model?.grants||[]).filter(grant=>grant.type===type).flatMap(grant=>irGrantValues(c,row,grant));
 }).map(categoryDeclaration);
}
