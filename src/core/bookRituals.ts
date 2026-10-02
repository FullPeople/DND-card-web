import {type Character,type Selection} from './model';
import {activeSelections} from './automation/active';
import {matchesReference} from './entryReferences';
import {featureOwner} from './featureOwnership';
import {classSpellGroups} from './spellWorkspace';
import {spellOnClassList} from './spellcastingRules';

export interface BookRitualGroup {owner:Selection;source?:Selection;spells:Selection[];reason?:string}
export const BOOK_RITUAL_TIME='原施法时间 + 10 分钟；不消耗法术位，不能以仪式升环。';

/** Source-text adapter for an explicit book/preparation exception. Keep paragraphs
 * scoped to their own section and never infer permission from an option branch,
 * a feature name, a mention of rituals, or the spell's ritual tag alone. */
function explicitBookRitualSection(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 if(Array.isArray(value)){
  for(const paragraph of value.filter((v):v is string=>typeof v==='string')){
   const text=paragraph.replace(/\{@\w+ ([^{}]+)\}/g,(_,body:string)=>body.split('|')[2]||body.split('|')[0]);
   const book=/法术书|\bspellbook\b/i.test(text),ritual=/仪式|\britual\b/i.test(text),cast=/施展|施法|\bcast\b/i.test(text);
   const permission=/(?:可以|你能|you can)/i.test(text);
   // The exception must refer to these spells/rituals within this paragraph;
   // never borrow a cantrip exception or stitch adjacent strings together.
   const exception=text.split(/[。.!！？\n]/).some(clause=>
    /(?:不需要|不必|无需|不需)[^。.!\n]{0,16}(?:准备|预备)|(?:need not|needn['’]t|don['’]t need|do not need)[^.!\n]{0,60}prepared/i.test(clause)&&
    /法术|仪式|\bspell\b|\britual\b/i.test(clause)&&!/戏法|其他|另外|\bcantrips?\b|\bother spells?\b/i.test(clause));
   if(book&&ritual&&cast&&permission&&exception&&!/不能|不可|can['’]t|cannot/i.test(text))return true;
  }
  return value.some(v=>typeof v==='object'&&explicitBookRitualSection(v));
 }

 const object=value as Record<string,unknown>;
 if(object.type==='options')return false;
 return explicitBookRitualSection(object.entries)||explicitBookRitualSection(object.items);
}
function declaredFeature(owner:Selection,row:Selection):boolean{
 const refs=Array.isArray(owner.entry.raw.classFeatures)?owner.entry.raw.classFeatures:[];
 return refs.some((value:unknown)=>{const ref=typeof value==='string'?value:(value as {classFeature?:unknown})?.classFeature;return typeof ref==='string'&&matchesReference(row.entry,ref);});
}
/** Projection only: eligibility never prepares spells, allocates book slots, or
 * adds another copy. Old book allocations retain the existing workspace rules. */
export function bookRitualGroups(c:Character):BookRitualGroup[]{
 const active=activeSelections(c),activeIds=new Set(active.map(s=>s.id));
 return classSpellGroups(c).filter(g=>g.profile.pool==='book').map(({profile,ids})=>{
  const owner=profile.owner,custom=owner.entry.raw._custom||!['PHB','XPHB'].includes(owner.entry.source);
  const source=custom?undefined:active.find(row=>row.entry.kind==='feature'&&!row.entry.raw._custom&&['PHB','XPHB'].includes(row.entry.source)&&featureOwner(c,row)?.id===owner.id&&Number(row.entry.raw.level)>0&&Number(row.entry.raw.level)<=owner.level&&declaredFeature(owner,row)&&explicitBookRitualSection(row.entry.entries));
  if(!source)return {owner,spells:[],reason:'书内仪式资格尚未由已拥有的来源特性明确，需核对原文；未自动开放施法。'};
  const allocated=new Set(ids);
  const spells=c.selections.filter(row=>allocated.has(row.id)&&activeIds.has(row.id)&&row.entry.kind==='spell'&&row.entry.raw.meta?.ritual===true&&Number.isInteger(row.entry.raw.level)&&row.entry.raw.level>=1&&row.entry.raw.level<=profile.maxLevel&&!c.spellSettings?.special?.[row.id]&&spellOnClassList(row.entry,profile));
  return {owner,source,spells};
 });
}
export const bookRitualPaymentId=(ownerId:string)=>`book-ritual:${ownerId}`;
