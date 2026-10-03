import {ABILITIES,skillKey,SKILLS,type Entry} from './model';
import {createIdentity} from '../data/automation/identity';
import {parseFormula} from '../data/automation/formula';
import type {Mechanics,AutomationRecord,EquipmentModel} from '../data/automation/protocol';
/** Explicit player authoring boundary. This is never a publisher-data fallback. */
export function customIr(entry:Entry):Entry{
 const raw=entry.raw,mechanics:Mechanics={},unsupported:AutomationRecord['unsupported']=[],handled=new Set(['name','ENG_name','english']);
 const gap=(family:string)=>{if(!unsupported.some(item=>item.family===family))unsupported.push({code:'custom-declaration-pending',family});};
 const number=(key:string,max=1000000)=>{handled.add(key);const value=raw[key];if(value===undefined)return;if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max)return value;gap(key);};
 if(entry.kind==='item'){
  const category=({LA:'lightArmor',MA:'mediumArmor',HA:'heavyArmor',S:'shield',M:'weapon',R:'weapon'} as Record<string,string>)[raw.type]||'other';handled.add('type');
  const model:EquipmentModel={category};for(const key of ['weight','value'] as const){const value=number(key);if(value!==undefined)model[key]=value;}
  if(['lightArmor','mediumArmor','heavyArmor','shield'].includes(category)){const value=number('ac',100);if(value!==undefined)model.ac=value;if(category==='mediumArmor')model.dexCap=2;}
  if(category==='weapon'){
   model.weaponType=raw.type==='M'?'melee':'ranged';handled.add('weaponCategory');if(['simple','martial'].includes(raw.weaponCategory))model.weaponCategory=raw.weaponCategory;
   for(const [key,target]of [['dmg1','damage'],['dmg2','versatileDamage']] as const){handled.add(key);if(raw[key]!==undefined)try{parseFormula(raw[key]);model[target]=raw[key];}catch{gap('weapon');}}
   handled.add('property');if(raw.property!==undefined){if(Array.isArray(raw.property)&&raw.property.every((value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_-]+$/.test(value)))model.properties=raw.property;else gap('weapon');}
   handled.add('dmgType');const types:Record<string,string>={B:'bludgeoning',P:'piercing',S:'slashing',A:'acid',C:'cold',F:'fire',O:'force',L:'lightning',N:'necrotic',I:'poison',Y:'psychic',R:'radiant',T:'thunder'};if(types[raw.dmgType])model.damageType=types[raw.dmgType];else if(raw.dmgType!==undefined)gap('weapon');
  }
  mechanics.equipmentModel=model;
 }
 if(entry.kind==='class'){
  handled.add('hd');if([4,6,8,10,12].includes(raw.hd?.faces))mechanics.classModel={hitDie:raw.hd.faces};else if(raw.hd!==undefined)gap('hitDice');
  handled.add('proficiency');if(Array.isArray(raw.proficiency)&&raw.proficiency.every((value:unknown)=>ABILITIES.includes(value as any)))mechanics.grants=[{type:'savingThrow',fixed:raw.proficiency,scope:'firstClass'}];else if(raw.proficiency!==undefined)gap('savingThrow');
 }
 if(entry.kind==='race'){
  handled.add('speed');const value=typeof raw.speed==='number'?raw.speed:raw.speed?.walk;if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000)(mechanics.modifiers||=[]).push({target:'speed.walk',op:'set',value});else if(raw.speed!==undefined)gap('speed');
  handled.add('size');if(Array.isArray(raw.size)&&raw.size.length===1&&['T','S','M','L','H','G'].includes(raw.size[0]))(mechanics.modifiers||=[]).push({target:'size',op:'set',value:raw.size[0]});else if(raw.size!==undefined)gap('size');
 }
 if(entry.kind==='spell'){
  handled.add('level');if(Number.isInteger(raw.level)&&raw.level>=0&&raw.level<=9){mechanics.spellModel={level:raw.level};handled.add('school');if(typeof raw.school==='string'&&/^[A-Z]$/.test(raw.school))mechanics.spellModel.school=raw.school;}
 }
 for(const key of Object.keys(raw))if(!key.startsWith('_')&&!handled.has(key))gap('customRule');
 const present=Object.keys(mechanics).length>0;
 return {...entry,...(entry.kind==='item'&&['string','number'].includes(typeof raw.attackBonus)&&typeof raw.dmg1==='string'?{manualWeapon:{attack:raw.attackBonus,damage:raw.dmg1}}:{}),automationVersion:`custom:${entry.revision}`,automation:{identity:createIdentity({kind:entry.kind,source:'CUSTOM',packId:'custom',engName:`Custom entry ${entry.id}`}),edition:entry.edition,verdict:unsupported.length?'unsupported':present?'automated':'noMechanics',provenance:[{layer:'rulePack',ref:`custom/${entry.id}/${entry.revision}`}],...(present?{mechanics}:{}),unsupported,...(!present&&!unsupported.length?{reasonCode:'narrative' as const}:{})}};
}
