import {irMechanics,irModifierValue,applyIrNumber} from './ir';
import {ABILITY_LABELS,signed,type Ability,type Character,type Derived,type Entry,type Issue} from '../model';
import {equipmentTraining} from '../proficiencyText';
import {matchesReference} from '../entryReferences';
import type {WeaponAttack} from '../weaponAttacks';
import {activeSelections} from './active';
import {automationEnabled} from './state';
import {trainingDeclarations} from './training';
import type {EquipmentOrigin} from './equipment';

export interface AutomaticWeaponAttack extends WeaponAttack {origin:EquipmentOrigin;modeLabel:string;trace:string[]}
const code=(value:unknown)=>String(value??'').split('|')[0].toUpperCase();
const damageTypes:Record<string,string>={bludgeoning:'钝击',piercing:'穿刺',slashing:'挥砍',acid:'强酸',cold:'冷冻',fire:'火焰',force:'力场',lightning:'闪电',necrotic:'暗蚀',poison:'毒素',psychic:'心灵',radiant:'光耀',thunder:'雷鸣'};
export function weaponType(entry:Entry):'M'|'R'|undefined{const type=irMechanics(entry)?.equipmentModel?.weaponType;return entry.kind==='item'&&type?(type==='melee'?'M':'R'):undefined;}
export function automaticWeaponAbility(entry:Entry,d:Derived):Ability{
 const finesse=(irMechanics(entry)?.equipmentModel?.properties||[]).some((p:unknown)=>code(p)==='F');
 return finesse?(d.modifiers.str>=d.modifiers.dex?'str':'dex'):weaponType(entry)==='M'?'str':'dex';
}
function trained(entry:Entry,declared:string[]):boolean{
 const type=weaponType(entry),category=String(irMechanics(entry)?.equipmentModel?.weaponCategory||'').toLowerCase();
 return declared.some(ref=>{
  const categoryRef=equipmentTraining(ref)?.[0];
  if(categoryRef)return categoryRef===category||categoryRef===`${category}-${type==='M'?'melee':'ranged'}`||categoryRef==='firearms'&&(irMechanics(entry)?.equipmentModel?.firearm===true||(irMechanics(entry)?.equipmentModel?.properties||[]).some((p:unknown)=>code(p)==='AF'));
  const uid=ref.replace(/^\{@item ([^{}]+)\}$/,'$1');
  if(matchesReference(entry,uid))return true;
  const base=irMechanics(entry)?.equipmentModel?.baseItem;if(!base)return false;
  const parts=base.split(':').map(decodeURIComponent),wanted=uid.split('|');return parts[3]===wanted[0].trim().toLowerCase()&&(!wanted[1]||parts[2]===wanted[1].trim().toLowerCase());
 });
}
/** Derived actions only: evaluating never adds selections, spends ammunition or writes resources. */
export function automaticWeaponAttacks(c:Character,d:Derived):{attacks:AutomaticWeaponAttack[];issues:Issue[]}{
 const attacks:AutomaticWeaponAttack[]=[],issues:Issue[]=[];if(!automationEnabled(c))return {attacks,issues};
 const active=activeSelections(c),training=trainingDeclarations(c,active,'weapons');
 for(const row of active.filter(s=>s.equipped&&s.quantity>0&&weaponType(s.entry))){
  const entry=row.entry,model=irMechanics(entry)!.equipmentModel!,type=weaponType(entry),properties=new Set((model.properties||[]).map(code));
  const issue=(key:string,message:string)=>issues.push({id:`weapon-${key}:${row.id}`,selectionId:row.id,severity:'warning',message:`${entry.name}：${message}`});
  const automaticAbility=automaticWeaponAbility(entry,d),ability=row.weaponAbility??automaticAbility,mod=d.modifiers[ability],proficient=trained(entry,training);
  const enchanted=!model.requiresAttunement||row.attuned;
  const attack=enchanted?model.attackBonus||0:0,damage=enchanted?model.damageBonus||0:0;
  if(!enchanted)issue('attunement','未同调，暂不应用魔法命中与伤害加值。');
  if(!proficient)issue('training','未记录这件武器的熟练，命中不加熟练加值。');
  if(properties.has('S'))issue('special','特殊或带条件的武器属性尚未自动判定，请核对原文。');
  if(entry.manualWeapon?.attack!==undefined||entry.automation?.unsupported.some(gap=>gap.family==='manualWeapon')){issue('manual','保留此条目的手写命中与伤害公式，未追加自动加值。');continue;}
  if(entry.automation?.unsupported.some(gap=>gap.code==='equipment-bonus'&&gap.ref?.startsWith('bonusWeapon'))){issue('bonus','武器加值未支持，未生成可掷骰攻击。');continue;}
  let attackBonus=mod+(proficient?d.proficiency:0)+attack,damageBonus=mod+damage;
  for(const owner of active)for(const modifier of irMechanics(owner.entry)?.modifiers||[])if(modifier.target===`attack.${type==='M'?'melee':'ranged'}`||modifier.target===`damage.${type==='M'?'melee':'ranged'}`)try{const value=irModifierValue(c,owner,modifier,d.abilities);if(typeof value==='number'){if(modifier.target.startsWith('attack.'))attackBonus=applyIrNumber(attackBonus,modifier,value);else damageBonus=applyIrNumber(damageBonus,modifier,value);}}catch{issue('formula','武器加值公式尚未绑定。');}
  const modes=[{id:type==='R'&&properties.has('T')?'thrown':'main',label:type==='M'?'近战':properties.has('T')?'投掷':'远程',dice:model.damage}];
  if(type==='M'&&properties.has('T'))modes.push({id:'thrown',label:'投掷',dice:model.damage});
  if(type==='M'&&properties.has('V'))modes.push({id:'two-handed',label:'双手',dice:model.versatileDamage});
  if((properties.has('2H')||properties.has('V'))&&active.some(s=>s.equipped&&s.quantity>0&&irMechanics(s.entry)?.equipmentModel?.category==='shield'))issue('hands','双手攻击需要腾出持盾的手；使用方式由玩家确认。');
  if(properties.has('H'))issue('heavy','重型武器的属性或体型限制，以及战场优势劣势，需要人工确认。');
  for(const mode of modes){
   const dice=String(mode.dice??'').replace(/\s/g,'');
   if(!/^(?:\d+d\d+|\d+)(?:[+-]\d+)?$/i.test(dice)){issue(mode.id,`${mode.label}伤害格式未支持，未生成可掷骰攻击。`);continue;}
   attacks.push({key:`auto-weapon:${row.id}:${mode.id}`,name:`${entry.name} · ${mode.label}`,modeLabel:mode.label,entry,
    attack_bonus:attackBonus,damage:dice+(damageBonus?signed(damageBonus):''),damage_type:damageTypes[model.damageType||'']||model.damageType||'',
    origin:{selectionId:row.id,entryId:entry.id,source:entry.source,edition:entry.edition,revision:entry.revision,path:mode.id==='two-handed'?'automation.mechanics.equipmentModel.versatileDamage':'automation.mechanics.equipmentModel.damage'},
    trace:[`${entry.name} · ${entry.source} · ${entry.edition}`,`${ABILITY_LABELS[ability]} ${signed(mod)}${row.weaponAbility?`（手动选择，自动为${ABILITY_LABELS[automaticAbility]}）`:properties.has('F')?'（灵巧，取力量或敏捷较高者）':'（自动）'}`,`命中：属性 ${signed(mod)} + 熟练 ${proficient?d.proficiency:0} + 武器 ${attack} = ${signed(attackBonus)}`,`伤害：${dice} + 属性 ${mod} + 武器 ${damage}`]});
  }
 }
 return {attacks,issues};
}
