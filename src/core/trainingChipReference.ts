import type {Entry} from './model';
import {equipmentTraining} from './proficiencyText';

type ResolveReference=(reference:string,kind?:string)=>Entry|undefined;
/** Category aliases bind typed handles; explicit UIDs/captions and stored text stay intact. */
export function trainingChipReference(value:string,defaultKind:string,resolve?:ResolveReference,context?:{group:string;source:string}){
 const tag=/^\{@(\w+) ([^{}]+)\}$/.exec(value),kind=tag?.[1]||defaultKind,reference=tag?.[2]||value;
 const parts=reference.split('|'),category=context&&(kind==='itemProperty'||!tag&&!value.includes('|'))?equipmentTraining(parts[0]):undefined;
 if(context&&category&&category[3]===context.group){
  const source=parts[1]||context.source,edition=source.toUpperCase()==='PHB'?'2014':source.toUpperCase()==='XPHB'?'2024':undefined;
  // Explicit category ID prevents collisions with itemType rules, physical items or spells.
  const entry=edition?resolve?.(`entry:dnd-card.weapon-training:${edition}:${category[0]}`,'rule'):undefined;
  return {reference:tag?reference:`${category[1]}|${source}`,kind:'itemProperty',label:parts[2]||entry?.name||category[1],entry};
 }
 const entry=resolve?.(reference,kind);
 // Explicit source labels and user captions win. Unknown entries keep a readable
 // name until their catalog arrives, without guessing a translation or a source.
 const label=parts[2]||entry?.name||parts[0];
 return {reference,kind,label,entry};
}
