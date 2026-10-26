import type {Character,Entry,RuntimeResource,Selection} from '../model';
import {matchesReference} from '../entryReferences';
import {activeSelections} from './active';
import {automationEnabled} from './state';

export interface RefuelingSlot {key:string;kind:'ordinary'|'pact';level:number;current:number;max:number;mirrorUsed?:number}

// Reviewed numerical metadata only. Exact frozen inputs are independently checked
// by refueling-slot-resolver.test.ts; no upstream rule prose is bundled here.
// class-artificer: c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7
// class-warlock: 34721a04db792923cf0a19fbab3f90616093d9f6519a7cfe6f81a9eb52e775d4
const artificerSlots=[[2,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],[4,2,0,0,0],[4,2,0,0,0],[4,3,0,0,0],[4,3,0,0,0],[4,3,2,0,0],[4,3,2,0,0],[4,3,3,0,0],[4,3,3,0,0],[4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],[4,3,3,2,0],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
const classRules={
 artificer:{english:'Artificer',name:'奇械师',source:'TCE',ability:'int',progression:'artificer',feature:'Spellcasting',subclasses:['Alchemist','Armorer','Artillerist','Battle Smith']},
 warlock:{english:'Warlock',name:'魔契师',source:'PHB',ability:'cha',progression:'pact',feature:'Pact Magic',subclasses:['The Archfey','The Fiend','The Great Old One']},
} as const;
type ClassRule=typeof classRules[keyof typeof classRules];
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const plain=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function reviewedEntry(entry:Entry,category:string){
 const raw=entry.raw;
 return raw._category===category&&entry.edition!=='2024'&&raw.edition!=='one'&&(raw._classEdition===undefined||raw._classEdition==='2014')&&
  !raw._copy&&!raw._unresolvedParent&&!raw._custom&&!raw._workbenchCustom&&raw._castingSource===undefined&&!entry.effects?.length&&!entry.choices?.length&&raw.effects===undefined&&raw.choices===undefined&&
  entry.source===raw.source&&entry.english===raw.ENG_name;
}
function parentIdentity(entry:Entry,rule:ClassRule){
 const raw=entry.raw;
 return raw.classSource===rule.source&&[rule.name,rule.english].some(name=>name===raw.className)&&
  ['classEnglish','classENG_name'].every(key=>raw[key]===undefined||raw[key]===rule.english);
}
function declaredFeatureRefs(owner:Selection,rule:ClassRule):string[]{
 const refs=owner.entry.raw.classFeatures;
 if(!Array.isArray(refs))return [];
 // Canonical English determines the feature identity; translated raw names are
 // retained only to resolve the actual source's declared grant reference.
 const sourceNames=rule.feature==='Spellcasting'?['Spellcasting','施法']:['Pact Magic','契约魔法'];
 return refs.flatMap((value:unknown)=>{
  const ref=typeof value==='string'?value:plain(value)?value.classFeature:undefined;
  if(typeof ref!=='string')return [];
  const parts=ref.split('|');
  return parts.length>=4&&parts.length<=5&&sourceNames.includes(parts[0])&&[rule.name,rule.english].some(name=>name===parts[1])&&
   (parts[2]||'PHB')===rule.source&&parts[3]==='1'&&(parts[4]||parts[2]||'PHB')===rule.source?[ref]:[];
 });
}
function validClass(owner:Selection,rule:ClassRule):boolean{
 const entry=owner.entry,raw=entry.raw;
 return !owner.parentId&&Number.isSafeInteger(owner.level)&&owner.level>=1&&owner.level<=20&&owner.quantity===1&&entry.kind==='class'&&
  entry.edition==='2014'&&reviewedEntry(entry,'class')&&entry.english===rule.english&&entry.source===rule.source&&
  raw.spellcastingAbility===rule.ability&&raw.casterProgression===rule.progression&&declaredFeatureRefs(owner,rule).length===1;
}
function validOrdinaryTable(owner:Selection):boolean{
 const groups=owner.entry.raw.classTableGroups;
 if(!Array.isArray(groups)||groups.some(group=>!plain(group)))return false;
 const tables=groups.filter(group=>group.rowsSpellProgression!==undefined);
 return tables.length===1&&same(tables[0].rowsSpellProgression,artificerSlots);
}
function pactAt(level:number){return {level:Math.min(5,Math.ceil(level/2)),max:level===1?1:level<11?2:level<17?3:4};}
function validPactTable(owner:Selection):boolean{
 const groups=owner.entry.raw.classTableGroups;
 if(!Array.isArray(groups)||groups.length!==1||!plain(groups[0]))return false;
 const group=groups[0];
 if(group.rowsSpellProgression!==undefined||!Array.isArray(group.colLabels)||group.colLabels[2]!=='法术位'||group.colLabels[3]!=='法术位环阶'||!Array.isArray(group.rows)||group.rows.length!==20)return false;
 return group.rows.every((row:unknown,index:number)=>{
  if(!Array.isArray(row)||row.length!==5||!Number.isSafeInteger(row[2])||typeof row[3]!=='string')return false;
  const expected=pactAt(index+1),match=/^\{@filter [^|{}]+\|spells\|level=([1-5])\|class=(?:魔契师|Warlock)\}$/.exec(row[3]);
  return row[2]===expected.max&&!!match&&Number(match[1])===expected.level;
 });
}
function actualFeature(c:Character,owner:Selection,rule:ClassRule,active:Set<string>):boolean{
 const refs=declaredFeatureRefs(owner,rule);
 const candidates=c.selections.filter(row=>{
  const entry=row.entry;
  return row.parentId===owner.id&&(entry.english===rule.feature||entry.raw.ENG_name===rule.feature||refs.some(ref=>row.grantKey===`ref:${ref}`));
 });
 // Even an inactive duplicate leaves ambiguous ownership. No read may choose an
 // arbitrary same-label grant or repair its provenance.
 if(candidates.length!==1)return false;
 const row=candidates[0],entry=row.entry;
 return active.has(row.id)&&row.quantity===1&&entry.kind==='feature'&&reviewedEntry(entry,'classFeature')&&entry.source===rule.source&&parentIdentity(entry,rule)&&entry.raw.level===1&&
  !entry.raw.subclassName&&!entry.raw.subclassShortName&&refs.some(ref=>row.grantKey===`ref:${ref}`&&!c.dismissedFeatures?.includes(`${owner.id}|ref:${ref}`)&&matchesReference({...entry,name:entry.raw.name},ref));
}
function validSubclasses(c:Character,owners:Selection[],active:Set<string>):boolean{
 const subclasses=c.selections.filter(row=>row.entry.kind==='subclass'),seen=new Set<string>();
 return subclasses.every(row=>{
  const owner=owners.find(owner=>owner.id===row.parentId),rule=owner?.entry.english==='Artificer'?classRules.artificer:classRules.warlock;
  if(!owner||seen.has(owner.id)||!active.has(row.id)||row.quantity!==1)return false;
  seen.add(owner.id);const entry=row.entry,raw=entry.raw;
  // These seven source-qualified subclasses do not change slot progression.
  // An unfamiliar source, orphan, or any proposed override remains manual.
  return reviewedEntry(entry,'subclass')&&entry.source===rule.source&&parentIdentity(entry,rule)&&
   rule.subclasses.some(name=>name===entry.english)&&owner.level>=(rule===classRules.artificer?3:1)&&
   raw.casterProgression===undefined&&raw.spellcastingAbility===undefined&&raw.classTableGroups===undefined&&raw.subclassTableGroups===undefined;
 });
}
function usablePool(pool:RuntimeResource|undefined,max:number):pool is RuntimeResource{
 return !!pool&&pool.automatic===true&&(pool.locked===undefined||pool.locked===false)&&(pool.unlimited===undefined||pool.unlimited===false)&&pool.featureGrant===undefined&&pool.sourceSpellGrant===undefined&&
  Number.isSafeInteger(pool.current)&&Number.isSafeInteger(pool.max)&&pool.max===max&&pool.current>=0&&pool.current<pool.max;
}

/** Enumerate current eligible pools without hydration, resource synchronization,
 * rest, allocation or repair. `automatic` describes present state only: it does
 * not prove that an older sync never adopted a formerly manual resource. */
export function resolveRefuelingSlots(c:Character,ownerId:string):{slots:RefuelingSlot[];reason?:string}{
 const unavailable=(reason:string)=>({slots:[] as RefuelingSlot[],reason});
 if(!automationEnabled(c)||c.locked)return unavailable('来源自动计算未启用或角色已锁定');
 if(new Set(c.selections.map(row=>row.id)).size!==c.selections.length)return unavailable('来源选择身份重复，法术位归属不明');
 const classes=c.selections.filter(row=>row.entry.kind==='class'),owner=classes.find(row=>row.id===ownerId),active=new Set(activeSelections(c).map(row=>row.id));
 if(!owner||!active.has(owner.id)||!validClass(owner,classRules.artificer)||!validOrdinaryTable(owner))return unavailable('需要真实 TCE 奇械师职业、施法授予和完整等级表');
 const others=classes.filter(row=>row.id!==ownerId),warlock=others[0];
 if(others.length>1||warlock&&(!active.has(warlock.id)||!validClass(warlock,classRules.warlock)||!validPactTable(warlock)))return unavailable('仅支持单职业奇械师或兼有唯一 PHB 魔契师；其他来源组合仍需手动');
 if(!validSubclasses(c,classes,active))return unavailable('子职来源、父级或施法进度尚未核对');
 const slots:RefuelingSlot[]=[];
 if(actualFeature(c,owner,classRules.artificer,active)){
  for(const [index,max] of artificerSlots[owner.level-1].entries()){
   const level=index+1,key=`spell-slot:${level}`,pool=c.runtime.resources[key],mirror=c.spellSettings?.slots?.[String(level)];
   if(level>3||!max||!usablePool(pool,max)||!mirror||!Number.isSafeInteger(mirror.max)||!Number.isSafeInteger(mirror.used)||mirror.max!==max||mirror.used!==max-pool.current)continue;
   slots.push({key,kind:'ordinary',level,current:pool.current,max,mirrorUsed:mirror.used});
  }
 }
 if(warlock&&actualFeature(c,warlock,classRules.warlock,active)){
  const {level,max}=pactAt(warlock.level),key=`pact-slot:${level}`,pool=c.runtime.resources[key];
  if(level<=3&&usablePool(pool,max))slots.push({key,kind:'pact',level,current:pool.current,max});
 }
 return slots.length?{slots}:unavailable('没有来源明确、当前自动且已消耗的 1 至 3 环法术位；手动、锁定、无限或不一致资源不修改');
}
