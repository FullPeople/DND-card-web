import {selectionAllowed,uid,type Character,type Entry,type Selection} from './model';
import {spellState} from './characterDetails';
import {cantripCapacity,casterProfiles,spellOnClassList,spellUsesPreparation,type CasterProfile} from './spellcastingRules';
import {sourceSpellEnabled} from './automation/sourceSpellState';
import {knownSpellCapacity,sourceCapacity} from './spellCapacity';

export interface CantripGroup {id:string;name:string;profile?:CasterProfile;capacity:number;slots:string[]}
const ordinaryCantrips=(c:Character)=>c.selections.filter(s=>s.entry.kind==='spell'&&Number(s.entry.raw.level)===0&&!c.spellSettings?.special?.[s.id]);
export const hasClassLookup=(e:Entry)=>!!e.raw._spellClasses||!!e.raw.classes;

/** Old cards gain a read-only layout; opening the page never changes learned spells. */
export function cantripGroups(c:Character):CantripGroup[]{
 const capacity=(p:CasterProfile)=>Math.max(0,Math.min(100,cantripCapacity(p)+(c.spellSettings?.cantripCapacityAdjustments?.[p.owner.id]||0)));
 const profiles=casterProfiles(c).filter(p=>cantripCapacity(p)>0||capacity(p)>0||c.spellSettings?.cantrips?.[p.owner.id]!==undefined),rows=ordinaryCantrips(c),savedManual=c.spellSettings?.cantrips?.manual,assigned=new Set<string>(savedManual?.filter(Boolean));
 const groups:CantripGroup[]=profiles.map(profile=>{
  const saved=c.spellSettings?.cantrips?.[profile.owner.id];
  const slots=saved?saved.map(id=>rows.some(s=>s.id===id)?id:''):rows.filter(s=>!assigned.has(s.id)&&(spellOnClassList(s.entry,profile)||profiles.length===1&&!hasClassLookup(s.entry))).map(s=>s.id);
  slots.filter(Boolean).forEach(id=>assigned.add(id));
  return {id:profile.owner.id,name:profile.owner.entry.name,profile,capacity:capacity(profile),slots};
 });
 // Unselected spells in a saved group remain known, without returning to the active list.
 const remaining=rows.filter(s=>!assigned.has(s.id)&&!profiles.some(p=>c.spellSettings?.cantrips?.[p.owner.id]!==undefined&&(spellOnClassList(s.entry,p)||profiles.length===1&&!hasClassLookup(s.entry))));
 const saved=c.spellSettings?.cantrips?.manual;
 if(profiles.length&&remaining.length||saved?.length)groups.push({id:'manual',name:profiles.length?'其他戏法':'戏法',capacity:Math.max(0,Math.min(100,(saved?.length??remaining.length)+(c.spellSettings?.cantripCapacityAdjustments?.manual||0))),slots:saved?saved.map(id=>rows.some(s=>s.id===id)?id:''):remaining.map(s=>s.id)});
 return groups;
}

export function chooseCantrip(c:Character,entry:Entry,ownerId?:string,index?:number):{id?:string;error?:string}{
 if(entry.kind!=='spell'||Number(entry.raw.level)!==0)return {error:'这个位置只能放戏法。'};
 if(!selectionAllowed(c,entry))return {error:'此戏法的来源或版本未启用。'};
 const groups=cantripGroups(c),matching=groups.filter(g=>g.profile&&spellOnClassList(entry,g.profile));
 const group=ownerId?groups.find(g=>g.id===ownerId):matching.length===1?matching[0]:matching.length>1?undefined:(groups.find(g=>g.id==='manual')||(groups.length===1&&!hasClassLookup(entry)?groups[0]:undefined));
 if(!group)return {error:'请拖到对应职业的戏法格，明确它属于哪个职业。'};
 if(group.profile&&hasClassLookup(entry)&&!spellOnClassList(entry,group.profile))return {error:`此戏法不在${group.name}的法表中。`};
 const row=c.selections.find(s=>s.entry.id===entry.id&&s.entry.kind==='spell'&&!c.spellSettings?.special?.[s.id]);
 const current=row?group.slots.indexOf(row.id):-1;
 if(current>=0&&current<group.capacity&&index===undefined)return {id:row!.id};
 const limit=group.capacity;
 const target=index??Array.from({length:limit},(_,i)=>i).find(i=>!group.slots[i]);
 if(target===undefined||target<0||target>=limit)return {error:'戏法格已满；拖到已有戏法上可以替换，替换时机请按职业规则。'};
 const settings=c.spellSettings||=structuredClone(spellState(c));settings.cantrips||={};
 // Record the existing allocation first, so multiclass defaults cannot shift afterwards.
 for(const g of groups)settings.cantrips[g.id]??=[...g.slots];
 const slots=settings.cantrips[group.id];while(slots.length<=target)slots.push('');
 const stored=row||{id:uid(),entry:structuredClone(entry),quantity:1,level:1,equipped:false};if(!row)c.selections.push(stored);
 if(current>=0)[slots[current],slots[target]]=[slots[target],slots[current]];else slots[target]=stored.id;
 return {id:stored.id};
}

export function clearCantrip(c:Character,ownerId:string,index:number){
 const groups=cantripGroups(c),group=groups.find(g=>g.id===ownerId);if(!group||!group.slots[index])return false;
 const settings=c.spellSettings||=structuredClone(spellState(c));settings.cantrips||={};
 for(const g of groups)settings.cantrips[g.id]??=[...g.slots];settings.cantrips[ownerId][index]='';return true;
}

/** The overview and export use the exact same readiness as the spell page. */
export function spellIsReady(c:Character,row:Selection):boolean{
 if(row.entry.kind!=='spell'||!selectionAllowed(c,row.entry))return false;
 const special=c.spellSettings?.special?.[row.id];
 if(special){
  const owner=(id:string)=>{const s=c.spellSettings!.special![id];return s.sourceGrant?.ownerId||s.manualSource?.ownerId||'manual';};
  return sourceSpellEnabled(c,row.id)&&c.selections.filter(s=>c.spellSettings?.special?.[s.id]&&owner(s.id)===owner(row.id)).slice(0,sourceCapacity(c,owner(row.id)).total).some(s=>s.id===row.id);
 }
 if(spellUsesPreparation(c,row.entry,row.id)){const state=spellState(c);return state.prepared.slice(0,state.capacity).includes(row.id);}
 if(Number(row.entry.raw.level)===0&&cantripGroups(c).length)return cantripGroups(c).some(g=>g.slots.slice(0,g.capacity).includes(row.id));
 return knownActiveSpells(c).slice(0,knownSpellCapacity(c)).some(s=>s.id===row.id);
}

export function knownActiveSpells(c:Character){return c.selections.filter(s=>s.entry.kind==='spell'&&!c.spellSettings?.special?.[s.id]&&!spellUsesPreparation(c,s.entry,s.id)&&(Number(s.entry.raw.level)>0||!cantripGroups(c).length));}

/** Only active known-spell selections consume this allowance; a book/library is independent. */
export function chooseKnownSpell(c:Character,entry:Entry):{id?:string;error?:string}{
 const known=knownActiveSpells(c),old=known.find(s=>s.entry.id===entry.id);if(old&&known.indexOf(old)<knownSpellCapacity(c))return {id:old.id};
 if(knownActiveSpells(c).length>=knownSpellCapacity(c))return {error:'职业法术格已满，请调整上限或移除已有记录。'};
 return learnActiveSpell(c,entry);
}

export function ordinaryPrepared(c:Character):string[]{
 return spellState(c).prepared.map(id=>c.selections.some(s=>s.id===id&&s.entry.kind==='spell'&&spellUsesPreparation(c,s.entry,s.id))?id:'');
}

export function learnActiveSpell(c:Character,entry:Entry):{id?:string;error?:string}{
 if(entry.kind!=='spell'||!selectionAllowed(c,entry))return {error:'此法术的来源或版本未启用。'};
 const old=c.selections.find(s=>s.entry.id===entry.id&&!c.spellSettings?.special?.[s.id]);if(old)return {id:old.id};
 const row={id:uid(),entry:structuredClone(entry),quantity:1,level:1,equipped:false};c.selections.push(row);return {id:row.id};
}
