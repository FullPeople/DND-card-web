import {classMatches,type Character,type Selection,type ClassPoolMetadata,type SpecialSpell} from '../model';
import {activeSelections} from './active';
import {sourceOwnerIdentity} from './sourceSpellState';
import type {ResourceGrant} from './featureResources';

const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const label=(value:unknown)=>typeof value==='string'?value.replace(/\{@\w+ ([^|}]+)(?:[^}]*)}/g,'$1').replace(/<[^>]*>/g,'').replace(/\s/g,''):'';
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
export const validResourceCost=(value:unknown)=>typeof value==='string'&&/^[1-9]\d{0,4}$/.test(value)&&Number(value)<=10000;

/** Resolve ownership from the actual selection tree; ambiguous implicit classes stay unresolved. */
export function resourceClass(c:Character,owner:Selection):Selection|undefined{
 let current:Selection|undefined=owner;const seen=new Set<string>();
 while(current){
  if(seen.has(current.id))return undefined;seen.add(current.id);
  if(current.entry.kind==='class'){
   if(owner.entry.edition!=='both'&&current.entry.edition!=='both'&&owner.entry.edition!==current.entry.edition)return undefined;
   if(owner.entry.raw.className&&!classMatches(owner.entry,current.entry))return undefined;
   return current;
  }
  if(!current.parentId)break;
  current=c.selections.find(row=>row.id===current!.parentId);if(!current)return undefined;
 }
 const matches=c.selections.filter(row=>row.entry.kind==='class'&&classMatches(owner.entry,row.entry)&&
  (owner.entry.edition==='both'||row.entry.edition==='both'||owner.entry.edition===row.entry.edition));
 return matches.length===1?matches[0]:undefined;
}
export const sourceResourceBindingKey=(c:Character,owner:Selection,index:number,name:string)=>JSON.stringify([sourceOwnerIdentity(c,owner),'source-resource',index,name,resourceClass(c,owner)?.entry.id]);
export const classPoolKey=(c:Character,cls:Selection,column:string)=>`class-resource:${encodeURIComponent(JSON.stringify([sourceOwnerIdentity(c,cls),cls.entry.id,column]))}`;

export interface ResourceColumn {label:string;max:number;className:string}
export function resourceColumns(cls:Selection):ResourceColumn[]{
 const cells:{label:string;value:unknown}[]=[];
 for(const group of Array.isArray(cls.entry.raw.classTableGroups)?cls.entry.raw.classTableGroups:[]){
  if(!Array.isArray(group?.colLabels))continue;
  const values=Array.isArray(group.rows)?group.rows[cls.level-1]:undefined;
  for(const [index,raw] of group.colLabels.entries()){const name=label(raw);if(name&&name.length<=160)cells.push({label:name,value:Array.isArray(values)?values[index]:undefined});}
 }
 return cells.flatMap(cell=>{
  if(cells.filter(other=>same(other.label,cell.label)).length!==1)return [];
  const max=typeof cell.value==='number'?cell.value:typeof cell.value==='string'&&/^\d+$/.test(cell.value)?Number(cell.value):NaN;
  return Number.isSafeInteger(max)&&max>=0&&max<=10000?[{label:cell.label,max,className:cls.entry.name}]:[];
 });
}
function owns(c:Character,grant:ResourceGrant,cls:Selection){const row=c.selections.find(row=>row.id===grant.ownerId);return !!row&&resourceClass(c,row)?.id===cls.id;}

/** Class pools have their own lifecycle. Spell synchronization never creates or replenishes them. */
export function planClassResourcePools(c:Character,featureGrants:ResourceGrant[]):ResourceGrant[]{
 const active=new Set(activeSelections(c).map(row=>row.id)),requested=new Map<string,{cls:Selection;column:string}>();
 const request=(cls:Selection,column:string)=>requested.set(classPoolKey(c,cls,column),{cls,column});
 for(const owner of c.selections){
  if(!active.has(owner.id)||owner.entry.kind==='item')continue;
  const cls=resourceClass(c,owner),blocks=owner.entry.raw.additionalSpells;if(!cls||!active.has(cls.id)||!Array.isArray(blocks))continue;
  const index=blocks.length===1?0:c.automation?.spellSets?.[owner.id],block=Number.isInteger(index)?blocks[index!]:undefined;
  if(!object(block)||Object.keys(block).some(key=>!['name','ENG_name','ability','known','prepared','innate','expanded','resourceName'].includes(key))||typeof block.resourceName!=='string'||!block.resourceName.trim()||block.resourceName.length>160)continue;
  const hasResource=['known','prepared','innate'].some(kind=>object(block[kind])&&Object.values(block[kind]).some(value=>object(value)&&object(value.resource)&&Object.entries(value.resource).some(([cost,refs])=>validResourceCost(cost)&&Array.isArray(refs)&&refs.length)));
  if(!hasResource)continue;
  const chosen=c.automation?.spellResourceColumns?.[sourceResourceBindingKey(c,owner,index!,block.resourceName)],columns=resourceColumns(cls);
  if(chosen===undefined&&featureGrants.some(grant=>owns(c,grant,cls)&&same(label(grant.name),label(block.resourceName))))continue;
  const column=columns.find(column=>same(column.label,label(chosen??block.resourceName)));if(column)request(cls,column.label);
 }
 // Retiring a spell source does not retire an already established class pool.
 for(const [storedKey,resource] of Object.entries({...c.runtime.featureResourceArchive,...c.runtime.resources})){
  const metadata=resource.featureGrant?.classPool,cls=c.selections.find(row=>row.id===resource.featureGrant?.ownerId&&row.entry.kind==='class');
  if(metadata&&cls&&active.has(cls.id)&&metadata.entryId===cls.entry.id&&storedKey===classPoolKey(c,cls,metadata.label)&&resourceColumns(cls).some(column=>column.label===metadata.label))request(cls,metadata.label);
 }
 return [...requested].flatMap(([key,{cls,column}])=>{
  const value=resourceColumns(cls).find(row=>row.label===column);if(!value)return [];
  const classPool:ClassPoolMetadata={entryId:cls.entry.id,label:column};
  return [{key,ownerId:cls.id,name:column,max:value.max,recovery:{},origin:`${cls.entry.name} · ${cls.entry.source}`,classPool}];
 });
}

export function sourceResourcePool(c:Character,owner:Selection,index:number,name:string,grants:ResourceGrant[]):{grant?:ResourceGrant;key:string;columns:ResourceColumn[];reason?:string}{
 const cls=resourceClass(c,owner),key=sourceResourceBindingKey(c,owner,index,name),columns=cls?resourceColumns(cls):[];
 if(!cls||!activeSelections(c).some(row=>row.id===cls.id))return {key,columns,reason:'资源缺少唯一且已启用的所属职业。'};
 const chosen=c.automation?.spellResourceColumns?.[key];
 const matches=grants.filter(grant=>owns(c,grant,cls)&&(chosen!==undefined?grant.classPool?.label===chosen:same(label(grant.name),label(name))));
 if(matches.length!==1)return {key,columns,reason:matches.length?'资源声明不唯一，请分别核对次数归属。':chosen!==undefined?'已保存的资源列无法匹配，记录保留；请重新选择。':'尚未找到来源对应的职业资源，请选择实际使用的次数表列。'};
 return {key,columns,grant:matches[0]};
}

/** Imported links may preserve retired pools, but cannot redirect payment into another class. */
export function validateSourceResourceLink(c:Character,grant:NonNullable<SpecialSpell['sourceGrant']>):void{
 const owner=c.selections.find(row=>row.id===grant.ownerId),cls=owner&&resourceClass(c,owner),key=grant.resourceKey!,pool=c.runtime.resources[key]||c.runtime.featureResourceArchive?.[key];
 const poolOwner=c.selections.find(row=>row.id===pool?.featureGrant?.ownerId),poolClass=poolOwner&&resourceClass(c,poolOwner);
 const invalid=()=>{throw Error('来源法术资源归属无效。');};
 if(cls&&poolClass&&cls.id!==poolClass.id)invalid();
 if(key.startsWith('class-resource:')){
  const metadata=pool?.featureGrant?.classPool,archive=c.runtime.featureResourceArchive?.[key];
  if(metadata&&pool===archive&&!grant.active&&(!poolOwner||poolOwner.entry.kind==='class')){
   const identity=poolOwner?sourceOwnerIdentity(c,poolOwner):JSON.stringify([pool!.featureGrant!.ownerId]);
   if(key===`class-resource:${encodeURIComponent(JSON.stringify([identity,metadata.entryId,metadata.label]))}`)return;
  }
  if(pool?.featureGrant?.classPool&&poolOwner){if(poolOwner.entry.kind!=='class'||pool.featureGrant.classPool.entryId!==poolOwner.entry.id||classPoolKey(c,poolOwner,pool.featureGrant.classPool.label)!==key)invalid();return;}
  if(pool)invalid();
  const index=grant.key.match(/^source-spell:(\d+)\//)?.[1];
  if(!owner||!cls||index===undefined)invalid();
  const column=c.automation?.spellResourceColumns?.[sourceResourceBindingKey(c,owner!,Number(index),grant.resourceName!)]??grant.resourceName!;
  if(!resourceColumns(cls!).some(row=>row.label===column)||classPoolKey(c,cls!,column)!==key)invalid();
 }else if(key.startsWith('feature-resource:')){
  if(!pool?.featureGrant)invalid();
  if(!poolOwner)return; // Preserve a retired owner; runtime re-derives a usable binding before spending.
  const index=key.match(/:(\d+)$/)?.[1];if(index===undefined)invalid();
  const raw=poolOwner.entry.raw,identity=poolClass&&raw.className?JSON.stringify([poolClass.id,poolOwner.entry.source,raw.classSource,raw.subclassShortName||'',poolOwner.entry.english]):sourceOwnerIdentity(c,poolOwner);
  if(key!==`feature-resource:${identity}:${index}`)invalid();
 }else invalid();
}
