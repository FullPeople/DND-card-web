import {newCharacter as blankCharacter,skillKey,type Entry,type Character,type Edition} from '../../src/core/model';
import {initializeAutomation} from '../../src/core/automation/state';
import {normalizeData as normalizeCatalogue} from '../../src/data/catalog';
import {createIdentity,containsCjk} from '../../src/data/automation/identity';
import type {Mechanics} from '../../src/data/automation/protocol';
import {deriveStructured,makeContext} from './structured-models.generated.js';
/** Test authoring boundary only. The frozen independent data deriver is never
 * imported by application code. Numerical expectations remain independently authored. */
const ascii=(value:unknown)=>{const text=String(value||'Fixture');return containsCjk(text)?`Fixture ${[...new TextEncoder().encode(text)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}`:text;};
function material(entry:Entry,context:Entry[]=[]){
 const raw:Entry['raw']={...entry.raw,name:entry.name,ENG_name:entry.english,source:entry.source,entries:entry.raw.entries||entry.entries,...(entry.raw.hd?.faces?{hd:{number:1,...entry.raw.hd}}:{})};
 const kind=entry.raw._category||(entry.kind==='feature'?raw.className?raw.subclassShortName?'subclassFeature':'classFeature':'optionalfeature':entry.kind);
 const source=/^[A-Z0-9][A-Z0-9_:-]*$/.test(entry.source.toUpperCase())?entry.source.toUpperCase():'CUSTOM';
 const parent=context.find(candidate=>candidate.kind==='class'&&candidate.source===(raw.classSource||source)&&[candidate.name,candidate.english,candidate.raw.name].includes(raw.className));
 const classEnglish=parent?.english||entry.automation?.identity.classEngName||raw.className;
 const identity=createIdentity({kind,source,engName:ascii(entry.english||entry.name),packId:'fixture_'+ascii(entry.packId).replace(/[^a-zA-Z0-9_-]/g,'_'),...(raw.className?{classEngName:ascii(classEnglish),classSource:raw.classSource||source}:{}),...(raw.subclassShortName?{subclassEngShortName:ascii(raw.subclassShortName),subclassSource:raw.subclassSource||source}:{}),...(['classFeature','subclassFeature','optionalfeature'].includes(kind)&&raw.level!==undefined?{level:raw.level}:{})});
 return {identity,raw,namespace:'authored-test',files:['fixture'],edition:({'PHB':'2014','DMG':'2014','XPHB':'2024','XDMG':'2024'} as Record<string,Entry['edition']>)[source]||entry.edition,expansion:'fixture'};
}
function fixtureContext(entry:Entry,context:Entry[]){
 const rows=context.map(candidate=>material(candidate,context));
 const declare=(name:string,source:string,kind:Entry['kind'],raw:Entry['raw']={})=>{
  source=source.toUpperCase();
  if(rows.some(candidate=>candidate.identity.source===source&&(candidate.identity.kind===kind||kind==='feature'&&['classFeature','subclassFeature','optionalfeature'].includes(candidate.identity.kind)||kind==='item'&&['baseitem','magicvariant','itemGroup'].includes(candidate.identity.kind))&&[candidate.raw.name,candidate.raw.ENG_name,candidate.identity.engName].includes(name)))return;
  rows.push(material({id:`declared:${kind}:${source}:${name}`,kind,name,english:name,source,edition:entry.edition,packId:entry.packId,revision:'fixture',entries:[],raw},context));
 };
 // Author-declared references have identities even when their body has not been
 // loaded. This keeps loading tests about references, rather than raw fallback.
 for(const candidate of context){
  for(const cls of [...(candidate.raw.classes?.fromClassList||[]),...(candidate.raw.classes?.fromClassListVariant||[])])declare(cls.name,cls.source||'PHB','class');
  for(const [source,classes]of Object.entries(candidate.raw._spellClasses||{}))for(const name of Object.keys(classes as object))declare(name,source,'class');
  const spellRefs=(value:unknown):void=>{if(typeof value==='string'&&!value.includes('=')&&value.trim()){const [name,source]=value.split('#')[0].split('|');declare(name,source||'PHB','spell',{level:0});}else if(Array.isArray(value))value.forEach(spellRefs);else if(value&&typeof value==='object')Object.values(value).forEach(spellRefs);};
  for(const block of candidate.raw.additionalSpells||[])for(const group of ['known','prepared','innate','expanded'])spellRefs(block[group]);
  for(const feat of candidate.raw.feats||[])for(const [ref,yes]of Object.entries(feat))if(yes===true){const [name,source]=ref.split('|');declare(name,source||candidate.source,'feat');}
  for(const ref of [...(candidate.raw.classFeatures||[]),...(candidate.raw.subclassFeatures||[])]){const uid=typeof ref==='string'?ref:ref.classFeature||ref.subclassFeature;if(!uid)continue;const parts=uid.split('|'),sub=parts.length>=6,source=sub?parts[6]||parts[4]||'PHB':parts[4]||parts[2]||'PHB',level=Number(parts[sub?5:3]);if(Number.isInteger(level))declare(parts[0],source,'feature',{className:parts[1],classSource:parts[2]||'PHB',level,...(sub?{subclassShortName:parts[3],subclassSource:parts[4]||'PHB'}:{})});}
  for(const block of candidate.raw.startingEquipment?.defaultData||candidate.raw.startingEquipment||[])for(const items of Object.values(block||{}) as unknown[][])if(Array.isArray(items))for(const item of items){const ref=typeof item==='string'?item:(item as any)?.item;if(typeof ref==='string'){const [name,source]=ref.split('|');declare(name,source||'PHB','item');}}
  if(candidate.raw.baseItem){const [name,source]=candidate.raw.baseItem.split('|');declare(name,source||'PHB','item');}
 }
 return makeContext(rows);
}
export function irFixture(entry:Entry,override?:Mechanics,context:Entry[]=[entry],prepared?:ReturnType<typeof fixtureContext>):Entry{
 const row=material(entry,context),derived=deriveStructured(row,prepared||fixtureContext(entry,context));
 const mechanics:Mechanics={...derived.mechanics,...override};
 const effectTargets=new Set((entry.effects||[]).flatMap(effect=>effect.op==='proficiency'?[]:[effect.target==='speed'?'speed.walk':effect.target]));
 if(effectTargets.size)mechanics.modifiers=(mechanics.modifiers||[]).filter(modifier=>!effectTargets.has(modifier.target));
 for(const effect of entry.effects||[]){
  if(effect.op==='proficiency')(mechanics.grants||=[]).push({type:'skillProficiency',fixed:[skillKey(effect.skill)]});
  else {(mechanics.modifiers||=[]).push({target:effect.target==='speed'?'speed.walk':effect.target,op:effect.op,value:effect.value});}
 }
 const options:NonNullable<Entry['automationOptions']>={};
 for(const choice of entry.choices||[]){const from=choice.options||choice.refs||[],skills=!choice.kind&&from.every(value=>['athletics','acrobatics','arcana','history','nature','religion','perception'].includes(skillKey(value)));if(!from.length)continue;(mechanics.grants||=[]).push({type:skills?'skillProficiency':'feature',key:`custom:${choice.id}`,choose:{count:choice.count,from},origin:`rulePackChoice:${choice.kind||'option'}`});options[`custom:${choice.id}`]={label:choice.label,options:Object.fromEntries(from.map(reference=>[reference,{label:choice.optionLabels?.[reference]||reference,reference}]))};}
 const hasMechanics=Object.keys(mechanics).length>0,unsupported=derived.unsupported;
 return {...entry,...(entry.kind==='item'&&entry.raw.attackBonus!==undefined&&typeof entry.raw.dmg1==='string'?{manualWeapon:{attack:entry.raw.attackBonus,damage:entry.raw.dmg1}}:{}),automationOptions:options,automationVersion:'fixture-ir-1',automation:{identity:row.identity,edition:row.edition,verdict:unsupported.length?'unsupported':hasMechanics?'automated':'noMechanics',provenance:[{layer:'structured',ref:'authored-fixture-model'}],...(hasMechanics?{mechanics}:{}),unsupported,...(!hasMechanics&&!unsupported.length?{reasonCode:'narrative' as const}:{}),...(entry.raw.featureType?{tags:{featureTypes:entry.raw.featureType}}:{})}};
}
export function normalizeFixtureData(...args:Parameters<typeof normalizeCatalogue>):Entry[]{
 const entries=normalizeCatalogue(...args),inline:Entry[]=[];
 const walk=(owner:Entry,values:unknown[],path:string):unknown[]=>values.map((node:any,index)=>{
  if(!node||typeof node!=='object')return node;const here=`${path}:${index}`;
  if(node.type==='options'&&Number.isInteger(node.count)&&Array.isArray(node.entries))return {...node,entries:node.entries.map((part:any,i:number)=>{
   if(!part?.name||part.classFeature||part.subclassFeature||part.optionalfeature)return part;
   const name=`${ascii(owner.english||owner.name)} option ${here} ${i}`,entry:Entry={...owner,id:`${owner.id}#option:${here}:${i}`,kind:'feature',name:part.name,english:name,entries:part.entries||[],raw:{_category:'optionalfeature',entries:part.entries||[]},effects:part.effects,choices:part.choices};inline.push(entry);return {optionalfeature:`${name}|${owner.source}`};
  })};
  return {...node,...(Array.isArray(node.entries)?{entries:walk(owner,node.entries,here)}:{})};
 });
 const authored=entries.map(entry=>({...entry,raw:{...entry.raw,...(Array.isArray(entry.raw.entries)?{entries:walk(entry,entry.raw.entries,'entries')}:{})}}));
 const all=[...authored,...inline],contexts=new Map<string,ReturnType<typeof fixtureContext>>();return all.map(entry=>{const key=JSON.stringify([entry.packId,entry.edition]);if(!contexts.has(key))contexts.set(key,fixtureContext(entry,all));return irFixture(entry,undefined,all,contexts.get(key));});
}
export function irCharacter(edition:Edition='2024'):Character{const c=blankCharacter(edition);initializeAutomation(c);return c;}
