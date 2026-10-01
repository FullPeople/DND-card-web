import {editionAllows,selectionAllowed,type Character,type Entry} from '../model';
import {cantripCapacity,casterProfiles,spellOnClassList} from '../spellcastingRules';
import {profilePreparation} from '../preparation';
import {assignClassSpell,cantripGroups,chooseCantrip,clearCantrip,classSpellGroups,learnActiveSpell} from '../spellWorkspace';
import {prepareSpellEntry,setPreparedSpell} from '../spells';
import type {SheetChoice} from './choices';
import {spellState} from '../characterDetails';

export type ClassSpellChoiceKind='cantrips'|'book'|'learned'|'prepared';
const count=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0&&n<=100?n:0;

/** A view of the existing spell workspace, not another list of saved answers. */
export function classSpellChoices(c:Character,catalog:Entry[]):SheetChoice[]{
 const entries=[...new Map([...catalog,...c.selections.map(s=>s.entry)].filter(e=>e.kind==='spell').map(e=>[e.id,e])).values()],out:SheetChoice[]=[],groups=classSpellGroups(c),cantrips=cantripGroups(c);
 for(const p of casterProfiles(c)){
  const raw=p.casting.entry.raw,ids=groups.find(g=>g.profile.owner.id===p.owner.id)?.ids||[],prepared=spellState(c).prepared.filter(id=>!id||ids.includes(id));
  const add=(kind:ClassSpellChoiceKind,label:string,capacity:number,selectedIds:string[],hint:string)=>{
   if(!capacity)return;
   const slots=selectedIds.map(id=>c.selections.find(s=>s.id===id)?.entry.id||'');
   const selected=[...new Set(slots.filter(Boolean))];
   const options=entries.filter(e=>editionAllows(e,c.edition)&&spellOnClassList(e,p)&&(kind==='cantrips'?Number(e.raw.level)===0:Number(e.raw.level)>0&&Number(e.raw.level)<=p.maxLevel)).filter(e=>kind!=='prepared'||p.pool!=='book'||ids.some(id=>c.selections.find(s=>s.id===id)?.entry.id===e.id)).sort((a,b)=>Number(a.raw.level)-Number(b.raw.level)||a.name.localeCompare(b.name,'zh-CN')).map(entry=>({value:entry.id,label:entry.name,entry,unavailable:selectionAllowed(c,entry)?undefined:'此法术来源尚未启用。'}));
   out.push({id:`${p.owner.id}:spells:${kind}`,ownerId:p.owner.id,label,count:capacity,options,selected,slots,complete:selected.length>=capacity,restricted:!!c.spellSettings?.modeOverride,channel:'spells',spellKind:kind,hint:c.spellSettings?.modeOverride?'施法模式已手动覆盖，请在法术页恢复“跟随职业”后选择。':hint});
  };
  add('cantrips','戏法',cantripCapacity(p,c),cantrips.find(g=>g.id===p.owner.id)?.slots||[],'戏法单独计数；选择会直接填入法术页的该职业戏法格。');
  if(p.maxLevel<1)continue;
  if(p.pool==='book'){
   const fixed=raw.spellsKnownProgressionFixed;
   const capacity=Array.isArray(fixed)&&fixed.slice(0,p.owner.level).every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)?count(fixed.slice(0,p.owner.level).reduce((n,v)=>n+v,0)):0;
   add('book','法术书',capacity,ids,'选择职业授予的法术书法术。额外抄录仍可在法术页记录；预备法术只能从书中选择。');
  }
  if(p.mode==='known')add('learned','职业法术',count(raw.spellsKnownProgression?.[p.owner.level-1]??raw.preparedSpellsProgression?.[p.owner.level-1]),ids,'按该职业的等级数量表选择。更换时机请按该职业原文；赠送法术另计。');
  else add('prepared','预备法术',count(profilePreparation(c,p)),prepared,p.pool==='book'?'先填写法术书，再从书中选择预备法术；取消预备会保留已学记录。':'从该职业法表选择预备法术；取消预备会保留已学记录。');
 }
 return out;
}

/** Explicit edits use the same selection IDs and references as the spell page. */
export function chooseClassSpell(c:Character,choice:SheetChoice,entry:Entry){
 const row=c.selections.find(s=>s.entry.id===entry.id&&s.entry.kind==='spell'&&!c.spellSettings?.special?.[s.id]),selected=choice.selected.includes(entry.id);
 if(!selected&&choice.selected.length>=choice.count)throw Error(`最多选择 ${choice.count} 项，请先取消一项。`);
 if(choice.spellKind==='cantrips'){
  if(selected){const group=cantripGroups(c).find(g=>g.id===choice.ownerId)!;clearCantrip(c,choice.ownerId,group.slots.indexOf(row!.id));}
  else {const result=chooseCantrip(c,entry,choice.ownerId);if(result.error)throw Error(result.error);}
 }else if(choice.spellKind==='prepared'){
  if(selected){setPreparedSpell(c,row!.id,false);}
  else if(!prepareSpellEntry(c,entry,undefined,choice.ownerId))throw Error('无法预备：普通预备格已满或施法模式已手动覆盖，请在法术页核对。');
 }else if(selected){
  // Freeze the legacy projection before removing one class's reference.
  assignClassSpell(c,row!.id,choice.ownerId);
  c.spellSettings!.classSpells![choice.ownerId]=c.spellSettings!.classSpells![choice.ownerId].map(id=>id===row!.id?'':id);
  if(choice.spellKind==='book'&&!Object.values(c.spellSettings!.classSpells!).some(ids=>ids.includes(row!.id)))setPreparedSpell(c,row!.id,false);
 }else {const result=learnActiveSpell(c,entry,choice.ownerId);if(result.error)throw Error(result.error);}
}

/** Replace references in place, preserving learned records and other classes. */
export function setClassSpellSlot(c:Character,choice:SheetChoice,index:number,entry?:Entry){
 const oldId=choice.slots?.[index],old=c.selections.find(s=>s.entry.id===oldId&&s.entry.kind==='spell'&&!c.spellSettings?.special?.[s.id]);
 if(entry?.id===oldId)return;
 if(choice.spellKind==='cantrips'){
  if(entry){const result=chooseCantrip(c,entry,choice.ownerId,index);if(result.error)throw Error(result.error);}
  else clearCantrip(c,choice.ownerId,index);
 }else if(choice.spellKind==='prepared'){
  if(!entry){if(old)setPreparedSpell(c,old.id,false);return;}
  const ids=classSpellGroups(c).find(g=>g.profile.owner.id===choice.ownerId)?.ids||[],prepared=spellState(c).prepared,positions=prepared.flatMap((id,i)=>!id||ids.includes(id)?[i]:[]),target=positions[index]??prepared.length+Math.max(0,index-positions.length);
  if(!old&&!choice.selected.includes(entry.id)&&choice.selected.length>=choice.count)throw Error(`最多选择 ${choice.count} 项。`);
  if(!prepareSpellEntry(c,entry,target,choice.ownerId))throw Error('无法预备：普通预备格已满或施法模式已手动覆盖。');
 }else {
  const ids=classSpellGroups(c).find(g=>g.profile.owner.id===choice.ownerId)?.ids||[],existing=c.selections.find(s=>s.entry.id===entry?.id&&s.entry.kind==='spell'&&!c.spellSettings?.special?.[s.id]);
  if(existing&&ids.includes(existing.id)){
   assignClassSpell(c,existing.id,choice.ownerId);const slots=c.spellSettings!.classSpells![choice.ownerId],from=slots.indexOf(existing.id),to=old?slots.indexOf(old.id):index;
   while(slots.length<=to)slots.push('');[slots[from],slots[to]]=[slots[to],slots[from]];return;
  }
  if(!old&&entry&&choice.selected.length>=choice.count)throw Error(`最多选择 ${choice.count} 项。`);
  if(old)chooseClassSpell(c,choice,old.entry);
  if(entry){const result=learnActiveSpell(c,entry,choice.ownerId);if(result.error)throw Error(result.error);const slots=c.spellSettings!.classSpells![choice.ownerId],at=slots.indexOf(result.id!);slots[at]='';while(slots.length<=index)slots.push('');slots[index]=result.id!;}
 }
}
