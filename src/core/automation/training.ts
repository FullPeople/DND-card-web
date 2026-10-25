import type {Character,Selection} from '../model';
import {evaluateAbilityAdvancements,type AdvancementBoundary} from './abilityAdvancements';
import {baseAbilityScores} from './baseAbilities';
import {activeEffectSelections} from './active';
import {reviewedArmorFeatIdentity} from './reviewedFeatIdentity';
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
/** An inherited declaration keeps the time and availability of every source
 * ancestor. Unlevelled children cannot launder a future/self/dismissed grant. */
function armorSourceAvailable(c:Character,row:Selection,active:Selection[],before?:AdvancementBoundary):boolean{
 let current:Selection|undefined=row;const seen=new Set<string>(),levels:number[]=[];
 while(current){
  const raw=current.entry.raw;
  if(seen.has(current.id)||before?.selectionId===current.id||current.parentId&&c.dismissedFeatures?.includes(`${current.parentId}|${current.grantKey}`))return false;
  seen.add(current.id);
  if(before&&raw.level!==undefined&&(!Number.isSafeInteger(raw.level)||raw.level>=before.level))return false;
  if(raw._category==='classFeature'||raw._category==='subclassFeature'){
   if(!Number.isSafeInteger(raw.level)||raw.level<1)return false;
   levels.push(raw.level);
  }
  if(current.entry.kind==='class')return Number.isSafeInteger(current.level)&&current.level>=1&&current.level<=20&&levels.every(level=>level<=current!.level);
  if(!current.parentId)return levels.length===0;
  const parentId:string=current.parentId;current=active.find(parent=>parent.id===parentId);
 }
 return false;
}
/** Manual declarations replace inferred training, including an explicitly empty list. */
export function trainingDeclarations(c:Character,active:Selection[],group:'armor'|'weapons',reviewedArmor:string[]=[],before?:AdvancementBoundary):string[]{
 if(c.training?.[group]!==undefined)return c.training[group]!.split(/[,，、;；\n]+/).map(s=>s.trim()).filter(Boolean).map(categoryDeclaration);
 const first=c.selections.find(s=>s.entry.kind==='class'),field=group==='armor'?'armorProficiencies':'weaponProficiencies';
 const declared=active.flatMap(row=>{
  const raw=row.entry.raw;
  if(group==='armor'&&!armorSourceAvailable(c,row,active,before))return [];
  // These reviewed feats need explicit owned consent. A manual drag (or edited
  // same-identity copy) is not an alternate automatic training grant.
  if(group==='armor'&&reviewedArmorFeatIdentity(row.entry))return [];
  if(row.entry.kind==='item'&&(!row.equipped||raw.reqAttune&&!row.attuned))return [];
  const declared=row.entry.kind==='class'?(row.id===first?.id?raw.startingProficiencies:raw.multiclassing?.proficienciesGained):undefined;
  return [...declarations(declared?.[group]??declared?.[field]),...declarations(raw[field])];
 }).map(categoryDeclaration);
 return [...declared,...(group==='armor'?reviewedArmor:[])];
}

/** Single effective projection for equipment, prerequisites and sheet display.
 * A supplied boundary includes only earlier authenticated advancements. */
export function effectiveTrainingDeclarations(c:Character,active:Selection[]=activeEffectSelections(c),group:'armor'|'weapons'='armor',before?:AdvancementBoundary):string[]{
 const safe=new Set(activeEffectSelections(c).map(row=>row.id));active=active.filter(row=>safe.has(row.id));
 if(group!=='armor'||c.training?.armor!==undefined)return trainingDeclarations(c,active,group,[],before);
 const reviewed=evaluateAbilityAdvancements(c,baseAbilityScores(c,active).abilities,active,before).reviewed;
 return trainingDeclarations(c,active,group,reviewed.armorTraining,before);
}
