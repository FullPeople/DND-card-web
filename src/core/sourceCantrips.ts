import {selectionAllowed,uid,type Character,type Entry,type Selection} from './model';
import {spellState} from './characterDetails';
import {sourceCapacity} from './spellCapacity';

export const cantripSourceKinds=['feat','race','background','feature','subclass'];
export const cantripSources=(c:Character)=>c.selections.filter(s=>cantripSourceKinds.includes(s.entry.kind));
export function sourceCantripRows(c:Character,ownerId:string):Selection[]{
 return c.selections.filter(s=>s.entry.kind==='spell'&&Number(s.entry.raw.level)===0&&c.spellSettings?.special?.[s.id]?.manualSource?.ownerId===ownerId);
}
/** The player records the allowance from the source text; never infer it from a name. */
export function chooseSourceCantrip(c:Character,entry:Entry,ownerId:string):{id?:string;error?:string}{
 if(entry.kind!=='spell'||Number(entry.raw.level)!==0)return {error:'来源赠送戏法栏只接受戏法，不是法术位或免费施放次数。'};
 return chooseSourceSpell(c,entry,ownerId);
}
export function chooseSourceSpell(c:Character,entry:Entry,ownerId:string):{id?:string;error?:string}{
 if(entry.kind!=='spell')return {error:'来源法术栏只接受法术。'};
 if(!selectionAllowed(c,entry))return {error:'此法术的来源或版本未启用。'};
 const owner=cantripSources(c).find(s=>s.id===ownerId);
 if(!owner&&ownerId!=='manual')return {error:'请先加入并选择赠送法术的专长、种族或特性来源。'};
 // Check the complete source chain, including a feature's parent class.
 let current:Selection|undefined=owner;const seen=new Set<string>();
 while(current){if(seen.has(current.id)||!selectionAllowed(c,current.entry))return {error:'赠送来源或其上级来源未启用，请先核对规则与扩展。'};seen.add(current.id);if(!current.parentId)break;current=c.selections.find(s=>s.id===current!.parentId);if(!current)return {error:'赠送来源的上级条目已移除，请先核对来源。'};}
 const rows=c.selections.filter(s=>c.spellSettings?.special?.[s.id]?.manualSource?.ownerId===ownerId),old=rows.find(s=>s.entry.id===entry.id);
 if(old)return {id:old.id};
 const capacity=sourceCapacity(c,ownerId).manual;
 if(rows.length>=capacity)return {error:'该来源的手动赠送法术数量已满；请核对来源原文，调整赠送数量或移除已有记录。'};
 if(c.selections.length>=3000)return {error:'角色条目数量已达到保存上限。'};
 const row:Selection={id:uid(),entry:structuredClone(entry),quantity:1,level:1,equipped:false,...(owner?{parentId:ownerId}:{})};
 const settings=c.spellSettings||=structuredClone(spellState(c));
 (settings.special||={})[row.id]={mode:'locked',label:'手动记录的来源赠送法术',manualSource:{ownerId}};
 c.selections.push(row);return {id:row.id};
}
