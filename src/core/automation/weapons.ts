import {ABILITY_LABELS,signed,type Character,type Derived,type Entry,type Issue} from '../model';
import {equipmentTraining} from '../proficiencyText';
import {matchesReference} from '../entryReferences';
import type {WeaponAttack} from '../weaponAttacks';
import {activeSelections} from './active';
import {automationEnabled} from './state';
import {trainingDeclarations} from './training';
import type {EquipmentOrigin} from './equipment';

export interface AutomaticWeaponAttack extends WeaponAttack {origin:EquipmentOrigin;modeLabel:string;trace:string[]}
const code=(value:unknown)=>String(value??'').split('|')[0].toUpperCase();
const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&/^[+-]?\d+$/.test(value.trim())?Number(value):undefined;
const damageTypes:Record<string,string>={B:'钝击',P:'穿刺',S:'挥砍',A:'强酸',C:'冷冻',F:'火焰',O:'力场',L:'闪电',N:'暗蚀',I:'毒素',Y:'心灵',R:'光耀',T:'雷鸣'};
export function weaponType(entry:Entry):'M'|'R'|undefined{const type=code(entry.raw.type);return entry.kind==='item'&&(type==='M'||type==='R')?type:undefined;}
function trained(entry:Entry,declared:string[]):boolean{
 const type=weaponType(entry),category=String(entry.raw.weaponCategory||'').toLowerCase();
 return declared.some(ref=>{
  const categoryRef=equipmentTraining(ref)?.[0];
  if(categoryRef)return categoryRef===category||categoryRef===`${category}-${type==='M'?'melee':'ranged'}`||categoryRef==='firearms'&&(entry.raw.firearm===true||(Array.isArray(entry.raw.property)?entry.raw.property:[]).some((p:unknown)=>code(p)==='AF'));
  const uid=ref.replace(/^\{@item ([^{}]+)\}$/,'$1');
  if(matchesReference(entry,uid))return true;
  const base=String(entry.raw.baseItem||'').split('|'),wanted=uid.split('|');
  return !!base[0]&&base[0].toLowerCase()===wanted[0].toLowerCase()&&(!wanted[1]||(base[1]||'PHB').toLowerCase()===wanted[1].toLowerCase());
 });
}
/** Derived actions only: evaluating never adds selections, spends ammunition or writes resources. */
export function automaticWeaponAttacks(c:Character,d:Derived):{attacks:AutomaticWeaponAttack[];issues:Issue[]}{
 const attacks:AutomaticWeaponAttack[]=[],issues:Issue[]=[];if(!automationEnabled(c))return {attacks,issues};
 const active=activeSelections(c),training=trainingDeclarations(c,active,'weapons');
 for(const row of active.filter(s=>s.equipped&&s.quantity>0&&weaponType(s.entry))){
  const entry=row.entry,raw=entry.raw,type=weaponType(entry),properties=new Set((Array.isArray(raw.property)?raw.property:[]).map(code));
  const issue=(key:string,message:string)=>issues.push({id:`weapon-${key}:${row.id}`,selectionId:row.id,severity:'warning',message:`${entry.name}：${message}`});
  const ability=properties.has('F')?(d.modifiers.str>=d.modifiers.dex?'str':'dex'):type==='M'?'str':'dex',mod=d.modifiers[ability],proficient=trained(entry,training);
  const enchanted=!raw.reqAttune||row.attuned;
  const bonus=(field:string)=>{if(raw[field]===undefined)return 0;const value=number(raw[field]);if(value===undefined||Math.abs(value)>100){issue(field,`${field} 加值未支持，需人工核对。`);return undefined;}return enchanted?value:0;};
  const generic=bonus('bonusWeapon'),attack=bonus('bonusWeaponAttack'),damage=bonus('bonusWeaponDamage');
  if(generic===undefined||attack===undefined||damage===undefined)continue;
  if(!enchanted)issue('attunement','未同调，暂不应用魔法命中与伤害加值。');
  if(!proficient)issue('training','未记录这件武器的熟练，命中不加熟练加值。');
  if(properties.has('S')||(Array.isArray(raw.property)?raw.property:[]).some((p:unknown)=>p&&typeof p==='object'))issue('special','特殊或带条件的武器属性尚未自动判定，请核对原文。');
  if(raw.attackBonus!==undefined){issue('manual','保留此条目的手写命中与伤害公式，未追加自动加值。');continue;}
  const attackBonus=mod+(proficient?d.proficiency:0)+generic+attack,damageBonus=mod+generic+damage;
  const modes=[{id:type==='R'&&properties.has('T')?'thrown':'main',label:type==='M'?'近战':properties.has('T')?'投掷':'远程',dice:raw.dmg1}];
  if(type==='M'&&properties.has('T'))modes.push({id:'thrown',label:'投掷',dice:raw.dmg1});
  if(type==='M'&&properties.has('V'))modes.push({id:'two-handed',label:'双手',dice:raw.dmg2});
  if((properties.has('2H')||properties.has('V'))&&active.some(s=>s.equipped&&s.quantity>0&&code(s.entry.raw.type)==='S'))issue('hands','双手攻击需要腾出持盾的手；使用方式由玩家确认。');
  if(properties.has('H'))issue('heavy','重型武器的属性或体型限制，以及战场优势劣势，需要人工确认。');
  for(const mode of modes){
   const dice=String(mode.dice??'').replace(/\s/g,'');
   if(!/^(?:\d+d\d+|\d+)(?:[+-]\d+)?$/i.test(dice)){issue(mode.id,`${mode.label}伤害格式未支持，未生成可掷骰攻击。`);continue;}
   attacks.push({key:`auto-weapon:${row.id}:${mode.id}`,name:`${entry.name} · ${mode.label}`,modeLabel:mode.label,entry,
    attack_bonus:attackBonus,damage:dice+(damageBonus?signed(damageBonus):''),damage_type:damageTypes[raw.dmgType]||raw.dmgType||'',
    origin:{selectionId:row.id,entryId:entry.id,source:entry.source,edition:entry.edition,revision:entry.revision,path:mode.id==='two-handed'?'raw.dmg2':'raw.dmg1'},
    trace:[`${entry.name} · ${entry.source} · ${entry.edition}`,`${ABILITY_LABELS[ability]} ${signed(mod)}${properties.has('F')?'（灵巧，取力量或敏捷较高者）':''}`,`命中：属性 ${signed(mod)} + 熟练 ${proficient?d.proficiency:0} + 武器 ${generic+attack} = ${signed(attackBonus)}`,`伤害：${dice} + 属性 ${mod} + 武器 ${generic+damage}`]});
  }
 }
 return {attacks,issues};
}
