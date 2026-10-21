import {selectionEffectsAllowed,type Character,type Entry,type Selection} from '../model';
import {matchesReference} from '../entryReferences';
import {recordVersionIdentity} from '../entryRecordIdentity';
import {cantripGroups} from '../spellWorkspace';
import {spellOnClassList} from '../spellcastingRules';
import evidence from './learnedSpellPrerequisiteEvidence.json' with {type:'json'};

export type LearnedCantripCriteria={level:0;damage:true;attack?:readonly string[]};
const key=(value:unknown)=>String(value??'').trim().toLowerCase();
const damageTypes=new Set(['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder']);

function active(c:Character,row:Selection):boolean{
 const seen=new Set<string>();let current:Selection|undefined=row;
 while(current){
  if(seen.has(current.id)||!selectionEffectsAllowed(c,current.entry))return false;
  seen.add(current.id);if(!current.parentId)return true;
  current=c.selections.find(parent=>parent.id===current!.parentId);
 }
 return false;
}

/** Read the actual class allocation. Catalog membership, a prepared library
 * copy, an inactive/overflow slot or another class's spell is not knowledge. */
export function learnedCantripPrerequisite(c:Character,owner:Selection,criteria:LearnedCantripCriteria):string|undefined{
 if(owner.entry.kind!=='class'||!c.selections.some(row=>row.id===owner.id&&row.entry.id===owner.entry.id)||!active(c,owner)||
  !Number.isSafeInteger(owner.level)||owner.level<1||owner.level>20)return '所需职业当前不可用。';
 if(criteria.level!==0||criteria.damage!==true||criteria.attack&&(!criteria.attack.length||criteria.attack.some(type=>!['m','r','o'].includes(type))))return '此法术前置结构尚未核对。';
 const group=cantripGroups(c).find(group=>group.id===owner.id&&group.profile?.owner.id===owner.id);
 if(group?.profile)for(const id of group.slots.slice(0,group.capacity)){
  const row=c.selections.find(row=>row.id===id),entry=row?.entry;
  if(!row||!entry||entry.kind!=='spell'||entry.raw.level!==0||c.spellSettings?.special?.[row.id]||!active(c,row)||
   entry.edition!=='both'&&entry.edition!==owner.entry.edition||entry.raw._unresolvedParent||entry.raw._unresolvedCopy||
   !spellOnClassList(entry,group.profile))continue;
  const damage=entry.raw.damageInflict;
  if(!Array.isArray(damage)||!damage.length||!damage.every(type=>typeof type==='string'&&damageTypes.has(key(type))))continue;
  if(criteria.attack&&(!Array.isArray(entry.raw.spellAttack)||!entry.raw.spellAttack.some(type=>typeof type==='string'&&criteria.attack!.includes(key(type)))))continue;
  return;
 }
 return criteria.attack?'尚未在该职业的有效戏法格中找到已学、能以攻击检定造成伤害的戏法。':'尚未在该职业的有效戏法格中找到已学且能造成伤害的戏法。';
}

/** The source filter omits a semantic damage restriction. Supply it only for
 * reviewed source-qualified definitions with an unchanged full prerequisite.
 * No display-name/prose branch and no unknown-filter fallback is permitted. */
export function reviewedLearnedSpellPrerequisite(c:Character,entry:Entry,owner:Selection):string|undefined{
 const unknown='此法术前置仍需手动核对，不能由本入口确认。';
 if(entry.kind!=='feature'||entry.raw._category!=='optionalfeature'||entry.raw._copy||entry.raw._unresolvedParent||owner.entry.raw._unresolvedParent)return unknown;
 const proof=evidence.requirements.find(proof=>entry.edition===proof.edition&&owner.entry.edition===proof.edition&&matchesReference(entry,proof.entry)&&matchesReference(owner.entry,proof.owner));
 if(!proof||!Array.isArray(entry.raw.featureType)||entry.raw.featureType.length!==proof.featureType.length||
  !entry.raw.featureType.every((type:unknown,index:number)=>typeof type==='string'&&key(type)===key(proof.featureType[index]))||
  recordVersionIdentity(entry.raw.prerequisite)!==proof.prerequisiteSha256)return unknown;
 return learnedCantripPrerequisite(c,owner,{level:0,damage:true,attack:'attack' in proof.spell?proof.spell.attack:undefined});
}
