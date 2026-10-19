import {ABILITIES,type Ability,type Character,type Entry,type Selection} from '../model';
import {matchesReference} from '../entryReferences';
import {backgroundAbilityOptions} from './backgroundAbilities';
import evidence from './classChoiceEvidence.json' with {type:'json'};

export const featAbilityChoiceId=(selectionId:string)=>`${selectionId}:feat-abilities`;
export const hasFeatAbilityAllocation=(c:Character,active:Selection[])=>active.some(selection=>{
 const saved=c.answers[featAbilityChoiceId(selection.id)];return saved?.length===1&&featAbilityOptions(selection.entry).some(option=>option.value===saved[0]);
});
/** Reviewed identity + exact numeric source shape, never a display-name heuristic.
 * The new answer namespace is explicit opt-in; old scores/answers are untouched. */
export function featAbilityOptions(entry:Entry){
 const rule=evidence.featAbilityAllocations.find(row=>matchesReference(entry,row.feat)&&entry.edition===row.edition);
 if(entry.kind!=='feat'||!rule||entry.raw._copy||entry.raw._unresolvedParent||entry.raw.repeatable!==true||entry.raw.category!=='G'||
  entry.effects?.some(effect=>effect.op!=='proficiency'&&ABILITIES.includes(effect.target as Ability)))return [];
 const blocks:unknown=entry.raw.ability;
 if(!Array.isArray(blocks)||blocks.length!==2)return [];
 const shapes=blocks.map(block=>{
  if(!block||typeof block!=='object'||Object.keys(block).some(key=>!['choose','hidden'].includes(key))||block.hidden!==undefined&&block.hidden!==true)return '';
  const choose=block.choose;
  if(!choose||typeof choose!=='object'||Object.keys(choose).some(key=>!['from','amount','count'].includes(key))||!Array.isArray(choose.from)||choose.from.length!==6||new Set(choose.from).size!==6||!choose.from.every((key:unknown)=>ABILITIES.includes(key as Ability)))return '';
  return `${choose.amount??1}:${choose.count??1}`;
 }).sort();
 if(shapes.join('|')!=='1:2|2:1')return [];
 return backgroundAbilityOptions({...entry,raw:{ability:blocks.map(({choose})=>({choose}))}});
}

/** Computes a capped innate increase for the evaluator's active sources.
 * The evaluator replays existing source/item operations without reordering. */
export function applyFeatAbilityAllocations(c:Character,active:Selection[],abilities:Record<Ability,number>,trace:Record<string,string[]>){
 for(const selection of active){
  const saved=c.answers[featAbilityChoiceId(selection.id)];if(saved?.length!==1)continue;
  const option=featAbilityOptions(selection.entry).find(option=>option.value===saved[0]);if(!option)continue;
  for(const ability of ABILITIES){
   const amount=Math.min(option.abilities[ability]||0,Math.max(0,20-abilities[ability]));
   if(amount){abilities[ability]+=amount;trace[ability].push(`${selection.entry.name} · ${selection.entry.source} +${amount}（上限 20）`);}
  }
 }
}
