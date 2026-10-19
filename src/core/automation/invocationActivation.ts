import type {Character,Entry} from '../model';
import {matchesReference} from '../entryReferences';
import type {SheetChoice} from './choices';
import evidence from './classChoiceEvidence.json';
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const only=(value:unknown,keys:string[])=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
export const invocationActivationChoiceId=(ownerId:string,entryId:string)=>`${ownerId}:invocation-activation:${entryId}`;
/** A reviewed identity plus the exact typed spell declaration. Publisher text
 * stays in the source snapshot; it is never parsed into executable effects. */
export function reviewedInvocationSpell(entry:Entry,known:Entry[]){
 const rule=evidence.invocationSpellActivations.find(rule=>entry.edition===rule.edition&&matchesReference(entry,rule.invocation));
 if(!rule||entry.kind!=='feature'||entry.raw._category!=='optionalfeature'||entry.raw._copy||entry.raw._unresolvedParent||entry.effects?.length||JSON.stringify(entry.raw.featureType)!=='["EI"]')return;
 const blocks=entry.raw.additionalSpells;
 if(!Array.isArray(blocks)||blocks.length!==1||!only(blocks[0],['innate'])||!only(blocks[0].innate,['_']))return;
 const refs=blocks[0].innate._;
 if(!Array.isArray(refs)||refs.length!==1||typeof refs[0]!=='string'||refs[0].split('|').length!==2)return;
 const savedFirst=new Map<string,Entry>();for(const row of known)if(row.kind==='spell'&&!savedFirst.has(row.id))savedFirst.set(row.id,row);
 const spells=[...savedFirst.values()].filter(row=>row.edition===rule.edition&&matchesReference(row,refs[0]));
 if(spells.length!==1||spells[0].raw.level!==1||spells[0].raw._unresolvedParent||!matchesReference(spells[0],rule.spell))return;
 return {...rule,spellEntry:spells[0]};
}
/** Learning remains record-only. An independent retained answer opts into the
 * single reviewed executable grant; old learned slots never activate silently. */
export function invocationActivationChoices(c:Character,known:Entry[],learnedChoices:SheetChoice[]):SheetChoice[]{
 if(c.edition!=='2024')return [];
 known=[...Object.values(c.classChoiceSnapshots||{}),...known];const out:SheetChoice[]=[];
 for(const learned of learnedChoices.filter(choice=>choice.sourceProgression==='optional'&&choice.support?.rule==='verified')){
  const owner=c.selections.find(row=>row.id===learned.ownerId),group=owner?.entry.raw.optionalfeatureProgression?.[Number(learned.id.split(':').at(-1))];
  if(!owner||owner.entry.edition!=='2024'||owner.entry.raw._copy||owner.entry.raw._unresolvedParent||JSON.stringify(group?.featureType)!=='["EI"]')continue;
  for(const value of learned.selected){
   const entry=learned.options.find(option=>option.value===value)?.entry;if(!entry)continue;const rule=reviewedInvocationSpell(entry,known);
   if(!rule||!matchesReference(owner.entry,rule.owner))continue;
   const id=invocationActivationChoiceId(owner.id,entry.id);if(out.some(choice=>choice.id===id))continue;
   const answers=c.answers[id]||[],selected=!learned.restricted&&answers.length===1&&answers[0]===entry.id?[entry.id]:[];
   out.push({id,ownerId:owner.id,label:`激活${entry.name}`,count:1,channel:'content',selected,complete:selected.length===1,restricted:learned.restricted,
    options:[{value:entry.id,label:`启用${entry.name}的来源施法`,entry,grant:entry}],
    hint:'显式启用后可对自身随意施放所赠法术，不消耗法术位。已有手工法术会保留；再次点击可取消。法术生效与护甲条件仍由玩家结算。'});
  }
 }
 return out;
}
