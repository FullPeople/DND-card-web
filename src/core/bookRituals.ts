import {irMechanics,irParentClass,irSelectionActive} from './automation/ir';
import {type Character,type Selection} from './model';
import {activeSelections} from './automation/active';
import {matchesReference} from './entryReferences';
import {featureOwner} from './featureOwnership';
import {classSpellGroups} from './spellWorkspace';
import {spellOnClassList} from './spellcastingRules';

export interface BookRitualGroup {owner:Selection;source?:Selection;spells:Selection[];reason?:string}
export const BOOK_RITUAL_TIME='原施法时间 + 10 分钟；不消耗法术位，不能以仪式升环。';

/** Projection only: eligibility never prepares spells, allocates book slots, or
 * adds another copy. Old book allocations retain the existing workspace rules. */
export function bookRitualGroups(c:Character):BookRitualGroup[]{
 const active=activeSelections(c),activeIds=new Set(active.map(s=>s.id));
 return classSpellGroups(c).filter(g=>g.profile.pool==='book').map(({profile,ids})=>{
  const owner=profile.owner;
  const source=active.find(row=>irSelectionActive(c,row)&&(row.id===owner.id||irParentClass(c,row)?.id===owner.id)&&irMechanics(row.entry)?.classModel?.ritualAccess==='book'&&(row.id===owner.id||(irMechanics(owner.entry)?.classModel?.classFeatures||[]).includes(row.entry.automation!.identity.key)));
  if(!source)return {owner,spells:[],reason:'书内仪式资格尚未由已拥有的来源特性明确，需核对原文；未自动开放施法。'};
  const allocated=new Set(ids);
  const spells=c.selections.filter(row=>allocated.has(row.id)&&activeIds.has(row.id)&&row.entry.kind==='spell'&&irMechanics(row.entry)?.spellModel?.ritual===true&&(irMechanics(row.entry)?.spellModel?.level??0)>=1&&(irMechanics(row.entry)?.spellModel?.level??10)<=profile.maxLevel&&!c.spellSettings?.special?.[row.id]&&spellOnClassList(row.entry,profile));
  return {owner,source,spells};
 });
}
export const bookRitualPaymentId=(ownerId:string)=>`book-ritual:${ownerId}`;
