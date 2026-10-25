import type {Character,Selection} from '../model';
import {evaluateAbilityAdvancements,type AdvancementBoundary} from './abilityAdvancements';
import {baseAbilityScores} from './baseAbilities';
import {activeEffectSelections} from './active';
import {reviewedArmorFeatIdentity,reviewedWeaponMasterIdentity,retainedModernArmorRule} from './reviewedFeatIdentity';
import {matchesReference} from '../entryReferences';
import {modernFeatEvidence} from './classChoiceSupport';
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
/** A retained modern automatic feat still follows its own declared source.
 * Manual records have no acquisition timestamp and cannot prove an earlier ASI
 * prerequisite; ordinary final equipment display retains their legal training. */
function modernTrainingAvailable(c:Character,row:Selection,active:Selection[],rule:NonNullable<ReturnType<typeof retainedModernArmorRule>>,before?:AdvancementBoundary):boolean{
 const classes=active.filter(value=>value.entry.kind==='class');
 if(!classes.length||classes.some(value=>!Number.isSafeInteger(value.level)||value.level<1||value.level>20)||classes.reduce((sum,value)=>sum+value.level,0)<4)return false;
 if(!row.requirementId&&!row.grantKey?.startsWith('choice:'))return !before;
 if(!rule.typedChoiceSupported)return false;
 const owner=active.find(value=>value.id===row.parentId),prefix=`${owner?.id}:class-typed-feat:`;
 if(!owner||owner.entry.kind!=='class'||owner.entry.edition!=='2024'||owner.entry.source!=='XPHB'||!row.requirementId?.startsWith(prefix)||row.grantKey!==`choice:${row.requirementId}:${row.entry.id}`||c.answers[row.requirementId]?.length!==1||c.answers[row.requirementId][0]!==row.entry.id)return false;
 if(owner.entry.raw._category!=='class'||owner.entry.raw.source!==owner.entry.source||owner.entry.raw.ENG_name!==owner.entry.english||owner.entry.raw._copy||owner.entry.raw._unresolvedParent||owner.entry.effects?.length||owner.entry.choices?.length||!['one',undefined].includes(owner.entry.raw.edition)||active.filter(value=>value.entry.kind==='class'&&value.entry.english===owner.entry.english&&value.entry.source===owner.entry.source&&value.entry.edition===owner.entry.edition).length!==1)return false;
 const featureId=row.requirementId.slice(prefix.length),sources=active.filter(value=>value.entry.id===featureId&&value.parentId===owner.id);
 if(sources.length!==1)return false;const source=sources[0];
 const raw=source.entry.raw;
 if(source.entry.kind!=='feature'||source.entry.edition!=='2024'||source.entry.source!=='XPHB'||raw._category!=='classFeature'||raw.source!=='XPHB'||raw.ENG_name!==source.entry.english||raw.className!==owner.entry.raw.name||raw.classSource!=='XPHB'||raw._copy||raw._unresolvedParent||source.entry.effects?.length||source.entry.choices?.length||raw.effects!==undefined||raw.choices!==undefined||!['one',undefined].includes(raw.edition)||raw._classEdition!==undefined&&raw._classEdition!=='2024')return false;
 if(!Array.isArray(owner.entry.raw.classFeatures)||!owner.entry.raw.classFeatures.some((value:unknown)=>{const ref=typeof value==='string'?value:value&&typeof value==='object'?(value as {classFeature?:unknown}).classFeature:undefined;return typeof ref==='string'&&source.grantKey===`ref:${ref}`&&matchesReference(source.entry,ref);})||active.filter(value=>value.parentId===owner.id&&value.entry.english===source.entry.english&&value.entry.source===source.entry.source&&value.entry.raw.level===raw.level).length!==1)return false;
 if(!modernFeatEvidence(owner.entry,source.entry)||source.entry.raw.level>owner.level||!armorSourceAvailable(c,source,active,before))return false;
 return !before||source.entry.raw.level<before.level;
}
/** Manual declarations replace inferred training, including an explicitly empty list. */
export function trainingDeclarations(c:Character,active:Selection[],group:'armor'|'weapons',reviewedArmor:string[]=[],before?:AdvancementBoundary):string[]{
 if(c.training?.[group]!==undefined)return c.training[group]!.split(/[,，、;；\n]+/).map(s=>s.trim()).filter(Boolean).map(categoryDeclaration);
 const first=c.selections.find(s=>s.entry.kind==='class'),field=group==='armor'?'armorProficiencies':'weaponProficiencies';
 const modern:{row:Selection;rule:NonNullable<ReturnType<typeof retainedModernArmorRule>>}[]=[];
 const declared=active.flatMap(row=>{
  const raw=row.entry.raw;
  if(group==='armor'&&!armorSourceAvailable(c,row,active,before))return [];
  // These reviewed feats need explicit owned consent. A manual drag (or edited
  // same-identity copy) is not an alternate automatic training grant.
  if(group==='weapons'&&reviewedWeaponMasterIdentity(row.entry))return [];
  if(group==='armor'&&reviewedArmorFeatIdentity(row.entry)){const rule=retainedModernArmorRule(row.entry);if(rule&&modernTrainingAvailable(c,row,active,rule,before))modern.push({row,rule});return [];}
  if(row.entry.kind==='item'&&(!row.equipped||raw.reqAttune&&!row.attuned))return [];
  const declared=row.entry.kind==='class'?(row.id===first?.id?raw.startingProficiencies:raw.multiclassing?.proficienciesGained):undefined;
  return [...declarations(declared?.[group]??declared?.[field]),...declarations(raw[field])];
 }).map(categoryDeclaration);
 const result=[...declared,...(group==='armor'?reviewedArmor:[])];
 // The three existing modern categories form a small acyclic chain. Never
 // derive prerequisite training from the candidate itself or an unknown rule.
 const pending=[...modern];let progressed=true;
 while(progressed&&pending.length){progressed=false;for(let index=0;index<pending.length;){const {rule}=pending[index];if(rule.requiredArmor&&!result.some(value=>equipmentTraining(value)?.[0]===rule.requiredArmor)){index++;continue;}result.push(...rule.armorTraining);pending.splice(index,1);progressed=true;}}
 return result;
}

/** The explicit new layer is exposed separately from ordinary training so a
 * consumer retaining an older edition filter never mistakes another domain's
 * ordinary declarations for newly authorized Weapon Master effects. */
export function reviewedWeaponTrainingDeclarations(c:Character,active:Selection[]=activeEffectSelections(c),before?:AdvancementBoundary):string[]{
 if(c.training?.weapons!==undefined||c.reviewedWeaponMaster?.version!==1)return [];
 const safe=new Set(activeEffectSelections(c).map(row=>row.id));active=active.filter(row=>safe.has(row.id));
 return evaluateAbilityAdvancements(c,baseAbilityScores(c,active).abilities,active,before).reviewed.weaponTraining;
}

/** Single effective projection for equipment, prerequisites and sheet display.
 * A supplied boundary includes only earlier authenticated advancements. */
export function effectiveTrainingDeclarations(c:Character,active:Selection[]=activeEffectSelections(c),group:'armor'|'weapons'='armor',before?:AdvancementBoundary):string[]{
 const safe=new Set(activeEffectSelections(c).map(row=>row.id));active=active.filter(row=>safe.has(row.id));
 if(c.training?.[group]!==undefined)return trainingDeclarations(c,active,group,[],before);
 if(group==='weapons')return [...trainingDeclarations(c,active,group,[],before),...reviewedWeaponTrainingDeclarations(c,active,before)];
 const reviewed=evaluateAbilityAdvancements(c,baseAbilityScores(c,active).abilities,active,before).reviewed;
 return trainingDeclarations(c,active,group,reviewed.armorTraining,before);
}
