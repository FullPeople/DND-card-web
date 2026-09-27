import type {Character,Entry,Selection,Issue} from '../model';
import {equipmentTraining} from '../proficiencyText';
import {automationEnabled,supportedAutomation} from './state';

export type ArmorType='LA'|'MA'|'HA'|'S';
export interface EquipmentOrigin {selectionId:string;entryId:string;source:string;edition:Entry['edition'];revision:string;path:string}
export interface ArmorRule {origin:EquipmentOrigin;slot:'armor'|'shield';type:ArmorType;base:number;dexCap?:number;usesDex:boolean;bonus:number;attunementRequired:boolean}
export interface ArmorReport {base:number;bonus:number;trace:string[];issues:Issue[];rules:ArmorRule[]}
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())?Number(value):undefined;
export function armorType(entry:Entry):ArmorType|undefined{
 if(entry.kind!=='item')return;
 const type=String(entry.raw.type||'').split('|')[0].toUpperCase();
 return ['LA','MA','HA','S'].includes(type)?type as ArmorType:undefined;
}
/** Structured fields define a rule family. Display names never select behavior. */
export function armorRule(row:Selection):{rule?:ArmorRule;issues:Issue[]}{
 const type=armorType(row.entry);if(!type)return {issues:[]};
 const raw=row.entry.raw,base=finite(raw.ac),bonus=raw.bonusAc===undefined?0:finite(raw.bonusAc),issues:Issue[]=[];
 const issue=(message:string)=>issues.push({id:'armor-data:'+row.id,message:row.entry.name+'：'+message,severity:'warning',selectionId:row.id});
 if(base===undefined||base<0||base>100){issue('护甲基础数值未支持，请人工核对。');return {issues};}
 if(bonus===undefined||Math.abs(bonus)>100){issue('魔法 AC 加值未支持，未自动应用这部分。');}
 return {issues,rule:{origin:{selectionId:row.id,entryId:row.entry.id,source:row.entry.source,edition:row.entry.edition,revision:row.entry.revision,path:'raw.ac'},slot:type==='S'?'shield':'armor',type,base,usesDex:type==='LA'||type==='MA',...(type==='MA'?{dexCap:2}:{}),bonus:bonus!==undefined&&Math.abs(bonus)<=100?bonus:0,attunementRequired:!!raw.reqAttune}};
}
function declarations(value:unknown):string[]{
 if(typeof value==='string')return [value];
 if(Array.isArray(value))return value.flatMap(declarations);
 if(!value||typeof value!=='object')return [];
 // Choice/filter declarations require a recorded player choice, never a guess.
 const object=value as Record<string,unknown>;
 if(typeof object.proficiency==='string'&&!object.optional)return [object.proficiency];
 return Object.entries(object).flatMap(([key,v])=>v===true?[key]:[]);
}
export function armorTraining(c:Character,active:Selection[]):Set<string>{
 if(c.training?.armor!==undefined)return new Set(c.training.armor.split(/[,，、;；\n]+/).map(s=>equipmentTraining(s.trim())?.[0]).filter((s):s is NonNullable<typeof s>=>!!s));
 const classes=c.selections.filter(s=>s.entry.kind==='class');
 return new Set(active.flatMap(row=>{
  const raw=row.entry.raw;
  if(row.entry.kind==='item'&&(!row.equipped||raw.reqAttune&&!row.attuned))return [];
  const declared=row.entry.kind==='class'?(row.id===classes[0]?.id?raw.startingProficiencies:raw.multiclassing?.proficienciesGained):undefined;
  return [...declarations(declared?.armor??declared?.armorProficiencies),...declarations(raw.armorProficiencies)].map(s=>equipmentTraining(s)?.[0]).filter((s):s is NonNullable<typeof s>=>!!s);
 }));
}
/** Called only for an explicit equip action, in the same draft/undo transaction. */
export function equipSelection(c:Character,id:string,equipped:boolean):void{
 const selected=c.selections.find(s=>s.id===id);if(!selected)return;
 selected.equipped=equipped;const kind=armorType(selected.entry);
 if(automationEnabled(c)&&equipped&&kind){
  for(const other of c.selections){const otherKind=armorType(other.entry);if(other.id!==id&&otherKind&&(kind==='S')===(otherKind==='S'))other.equipped=false;}
  if(c.inventory?.displayEquipment)c.inventory.displayEquipment=c.inventory.displayEquipment.filter(key=>!c.selections.some(row=>row.id===key&&!row.equipped));
 }
}
/** Reconcile new equip intents, never normalize a saved card while reading it. */
export function reconcileEquipping(before:Character,after:Character):void{
 if(!automationEnabled(after))return;
 const newlyEquipped=after.selections.filter(row=>row.equipped&&!before.selections.find(old=>old.id===row.id)?.equipped);
 for(const row of newlyEquipped)equipSelection(after,row.id,true);
}
export function evaluateArmor(c:Character,active:Selection[],dex:number):ArmorReport{
 const result:ArmorReport={base:10+dex,bonus:0,trace:[`未着甲 10 + 敏捷 ${dex}`],issues:[],rules:[]};
 if(!automationEnabled(c))return result;
 const equipped=active.filter(row=>row.equipped&&row.quantity>0&&armorType(row.entry));
 const trainings=armorTraining(c,active);
 for(const slot of ['armor','shield'] as const){
  const rows=equipped.filter(row=>(armorType(row.entry)==='S'?'shield':'armor')===slot);
  if(rows.length>1){result.issues.push({id:'equipment-conflict:'+slot,severity:'error',message:`同时装备了多件${slot==='armor'?'护甲':'盾牌'}，请重新装备其中一件；冲突部分暂不自动计算。`});continue;}
  const row=rows[0];if(!row)continue;
  const converted=armorRule(row);result.issues.push(...converted.issues);if(!converted.rule)continue;
  const rule=converted.rule;result.rules.push(rule);
  const trained=trainings.has(({LA:'light',MA:'medium',HA:'heavy',S:'shield'} as const)[rule.type]);
  if(!trained){result.issues.push({id:'armor-training:'+row.id,selectionId:row.id,severity:'warning',message:row.entry.name+(slot==='shield'&&c.edition==='2024'?'：未记录盾牌训练，2024 规则下不计盾牌 AC。':'：未记录对应训练，相关检定和施法限制请人工核对。')});}
  if(slot==='shield'&&c.edition==='2024'&&!trained){result.trace.push(`${row.entry.name}：未训练，盾牌加值未生效`);continue;}
  const bonusAllowed=!rule.attunementRequired||row.attuned;
  const enchantment=bonusAllowed?rule.bonus:0;
  if(rule.bonus&&!bonusAllowed)result.issues.push({id:'armor-attunement:'+row.id,selectionId:row.id,severity:'warning',message:row.entry.name+'：未同调，魔法 AC 加值未生效；基础护甲仍按穿戴计算。'});
  if(slot==='armor'){
   const mod=rule.usesDex?Math.min(dex,rule.dexCap??Infinity):0;
   // Wearing armor replaces the default formula even when that lowers AC.
   result.base=rule.base+mod;result.trace=[`${row.entry.name} · ${row.entry.source}：${rule.base}${rule.usesDex?` + 敏捷 ${mod}`:''}，替代未着甲计算`];
   result.bonus+=enchantment;
  }else result.bonus+=rule.base+enchantment;
  if(slot==='shield'||enchantment)result.trace.push(`${row.entry.name}：${slot==='shield'?`盾牌 +${rule.base}`:''}${enchantment?` 魔法 ${enchantment>=0?'+':''}${enchantment}`:''}`);
 }
 return result;
}
export function automationCompatibilityIssue(c:Character):Issue|undefined{
 if(c.automation&&!supportedAutomation(c))return {id:'automation-protocol',severity:'warning',message:'此卡的自动化协议或规则版本尚未支持，已保留原始数据，暂按手动模式展示。'};
}
