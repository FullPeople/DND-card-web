import {planRacialAbilities} from '../racialAbilities';
import {numericExpression} from '../numericExpression';
import {type Character,type Selection,type Issue,type RuntimeResource,type Ability} from '../model';
import {parentClass} from '../featureOwnership';
import {automationEnabled} from './state';
import {selectionActive} from './choices';
import {sourceOwnerIdentity,rememberSourceSpellUses,sourceSpellResourceEnabled} from './sourceSpellState';
import {specialSpellResource} from '../spellResourceKeys';
import {planClassResourcePools} from './sourceResourcePools';

type Recovery={short?:number|'all';long?:number|'all'};
export type ResourceGrant={key:string;ownerId:string;name:string;max:number;formula?:string;recovery:Recovery;origin:string;classPool?:import('../model').ClassPoolMetadata};
const words:Record<string,number>={'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
const count=(v:string)=>/^\d+$/.test(v)?Number(v):words[v];
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const strings=(v:unknown,depth=0):string[]=>depth>12?[]:typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(n=>strings(n,depth+1)):plain(v)?[...strings(v.entries,depth+1),...strings(v.items,depth+1)]:[];
const clean=(v:unknown)=>String(v??'').replace(/\{@\w+ ([^|}]+)(?:[^}]*)}/g,'$1').replace(/<[^>]*>/g,'').replace(/\s/g,'');
function proseOnce(text:string){
 const periods=/(短(?:暂)?(?:休|歇)?(?:或|与|和|\/)长(?:休|歇)|长(?:休|歇)(?:或|与|和|\/)短(?:暂)?(?:休|歇)|(?:短|长)(?:暂)?(?:休|歇))/;
 const repeat=/(?:不能|无法|不可|不得|才能|才可以|方可)[^。；]{0,30}?(?:(?:再次|再度|重新|再)[^。；]{0,18}?(?:使用|施用|施放|施法|施展|释放|创造|创建|创作|召唤|唤出|显现|分享|启动|激活|受益|这么做|这样做|如此做)|(?:使用|施用)(?:本|此|该)特性)/;
 const marked=text.replace(/\{@quickref ([^}]+)}/g,(_,body:string)=>{const parts=body.split('|');return parts[4]||parts[0];});
 const cooldowns=clean(marked).split(/[。；]/).filter(clause=>repeat.test(clause)&&periods.test(clause));
 if(cooldowns.length>1&&cooldowns.some(clause=>/(?:使用|施用)(?:本|此|该)特性后|必须(?:在)?完成一次/.test(clause)))return {clause:cooldowns[0],issue:'该条目包含多项休息限制，次数归属尚未明确'};
 for(const clause of cooldowns){
  if(!/(?:使用|施用)(?:本|此|该)特性后|必须(?:在)?完成一次/.test(clause)||!repeat.test(clause))continue;
  const match=clause.match(periods);if(!match)continue;
  if(/对同一|同一(?:个)?(?:生物|目标)|(?:生物|目标)[，,]*(?:都|皆)?必须/.test(clause))return {clause,issue:'恢复按目标分别限制，尚未生成全局次数'};
  const delay=clause.match(/(\d+d\d+(?:[+-]\d+)?|[一二两三四五六七八九十\d]+)次(?:短|长)(?:暂)?(?:休|歇)/)?.[1];
  if(delay&&!['一','1'].includes(delay))return {clause,issue:'多次休息或随机冷却尚未适配'};
  return {clause,match};
 }
 return undefined;
}
function tableUses(row:Selection,cls:Selection|undefined,level:number):{max:number}|{issue:string}|undefined{
 const names=[row.entry.name,row.entry.english].filter(Boolean).map(name=>clean(name).toLowerCase());
 const labels=new Set(names.flatMap(name=>[name,`${name}次数`,`${name}使用次数`,`${name}施用次数`,`${name}uses`,`${name}s`]));
 const cells:unknown[]=[];
 for(const groups of [cls?.entry.raw.classTableGroups,cls?.entry.raw.subclassTableGroups])for(const group of Array.isArray(groups)?groups:[]){
  if(!Array.isArray(group?.colLabels))continue;
  const sourceRow=Array.isArray(group.rows)?group.rows[level-1]:undefined;
  for(const [i,label] of group.colLabels.entries())if(labels.has(clean(label).toLowerCase()))cells.push(Array.isArray(sourceRow)?sourceRow[i]:undefined);
 }
 if(!cells.length)return undefined;
 if(cells.length!==1)return {issue:'次数表格的对应列不唯一'};
 const cell=cells[0],max=typeof cell==='number'?cell:typeof cell==='string'&&/^\d+$/.test(cell)?Number(cell):NaN;
 return Number.isSafeInteger(max)&&max>=0&&max<=10000?{max}:{issue:'次数表格的数值尚未支持'};
}
function abilityModifier(c:Character,ability:Ability){let value=c.abilities[ability];for(const row of c.selections)if(row.entry.kind!=='background'&&selectionActive(c,row)){value+=planRacialAbilities(c,row).bonuses[ability]||0;for(const effect of row.entry.effects||[])if(effect.op!=='proficiency'&&effect.target===ability)value=effect.op==='set'?effect.value:value+effect.value;}return Math.floor((value-10)/2);}
function context(c:Character,row:Selection){const cls=row.entry.kind==='class'?row:parentClass(c,row)||(()=>{let p:Selection|undefined=row;const seen=new Set<string>();while(p?.parentId&&!seen.has(p.id)){seen.add(p.id);p=c.selections.find(s=>s.id===p!.parentId);if(p?.entry.kind==='class')return p;}return undefined;})();const classes=c.selections.filter(s=>s.entry.kind==='class'&&selectionActive(c,s)),total=classes.reduce((n,s)=>n+s.level,0);return {cls,classes,total,level:cls?.level||row.level,prof:2+Math.floor((Math.max(1,total)-1)/4)+(c.sheetBonuses?.proficiency||0)};}
function formulaText(c:Character,row:Selection,formula:string):string{
 const {cls,classes,total,level,prof}=context(c,row);
 return formula.replace(/@(?:abilities\.(?:str|dex|con|int|wis|cha)\.mod|classes\.[\w-]+\.levels|class\.level|details\.level|prof|level)(?![\w.])|@[\w.-]+/g,token=>{
  const ability=token.match(/^@abilities\.(str|dex|con|int|wis|cha)\.mod$/)?.[1] as Ability|undefined;
  if(ability)return String(abilityModifier(c,ability));
  if(token==='@prof')return String(prof);
  if(token==='@details.level')return String(total);
  if(token==='@level')return String(level);
  if(token==='@class.level'){if(!cls||!classes.includes(cls))throw Error('资源公式缺少已启用的所属职业');return String(cls.level);}
  const identifier=token.match(/^@classes\.([\w-]+)\.levels$/)?.[1];
  if(identifier){
   const matches=classes.filter(s=>[s.entry.raw.identifier,s.entry.raw.system?.identifier,s.entry.english,s.entry.raw.ENG_name].some(name=>typeof name==='string'&&name.trim().toLowerCase().replace(/\s+/g,'-')===identifier.toLowerCase()));
   if(matches.length!==1)throw Error('资源公式引用的职业缺失、未启用或不唯一');
   return String(matches[0].level);
  }
  throw Error('资源公式包含尚未适配的变量');
 });
}
function numericMax(c:Character,row:Selection,value:unknown){if(typeof value==='number')return value;if(typeof value==='string')return numericExpression(`=${formulaText(c,row,value)}`,0).value;throw Error('次数上限没有可计算的数值或公式');}
export function planFeatureResources(c:Character):{grants:ResourceGrant[];issues:Issue[]}{
 const grants:ResourceGrant[]=[],issues:Issue[]=[];if(!automationEnabled(c))return {grants,issues};
 for(const row of c.selections){
  if(!['feature','feat','race','background','class','subclass'].includes(row.entry.kind)||!selectionActive(c,row))continue;
  const raw=row.entry.raw,text=strings(row.entry.entries).join(' '),{cls,level}=context(c,row);
  const explicit=Array.isArray(raw.resources)?raw.resources:plain(raw.resource)?[raw.resource]:plain(raw.uses)?[{...raw.uses,name:row.entry.name,recovery:raw.uses.recovery||raw.uses.per}]:plain(raw.system?.uses)&&raw.system.uses.max!==undefined?[{...raw.system.uses,name:row.entry.name}]:[];
  let specs:any[]=explicit;
  if(!specs.length){
   const escaped=row.entry.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const use=text.match(new RegExp(`(?:可以|能够|能)(?:使用|施用)(?:(?:此|本|这项|该)(?:特性|能力)?|${escaped})(?:共计|总计|总共)?([一二两三四五六七八九十\\d]+)次`));
   const oncePlan=proseOnce(text),once=oncePlan?.match;
   if(oncePlan?.issue){issues.push({id:`resource-unadapted:${row.id}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：${oncePlan.issue}，请人工核对。`});continue;}
   if(use||once){
    const recovery:Recovery={};
    for(const [key,word] of [['short','短'],['long','长']] as const){
     const match=text.match(new RegExp(`${word}(?:暂)?(?:休|歇)[^。；，,]{0,90}?(?:恢复|重获|重新获得|再次使用|再度使用|重置)([^。；，,]*)`));
     if(match){const n=match[1].match(/([一二两三四五六七八九十\d]+)次/);recovery[key]=/所有|全部/.test(match[1])?'all':n?count(n[1]):'all';}
    }
    if(once){if(once[1].includes('短'))recovery.short='all';recovery.long='all';}
    if(recovery.short&&!recovery.long)recovery.long='all';
    let max=use?count(use[1]):1;
    for(const upgrade of text.matchAll(/第(\d+)级[^。；]{0,45}?(?:使用|施用)([一二两三四五六七八九十\d]+)次/g))if(level>=Number(upgrade[1]))max=Math.max(max,count(upgrade[2])||0);
    const table=tableUses(row,cls,level),unknownMaximum=!use&&oncePlan&&/(?:全部|所有|最大|允许的)(?:使用)?次数/.test(oncePlan.clause)&&!table;
    if(table&&'issue' in table||unknownMaximum){const message=table&&'issue' in table?table.issue:'次数上限未能从来源表格确定';issues.push({id:`resource-unadapted:${row.id}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：${message}，未生成资源。`});continue;}
    if(table&&'max' in table)max=table.max;
    const die=text.match(/\{@dice ([\dd+\- ]+)}/)?.[1];
    const formula=die&&cls&&(text.includes(`${cls.entry.name}职业等级`)||text.includes(`${cls.entry.name}等级`))?`${die} + @class.level`:undefined;
    specs=[{name:row.entry.name,max,recovery,formula}];
   }else if(/(?:恢复|重获).*(?:使用次数|次数)|(?:每|每次)(?:短|长)休/.test(text)&&row.entry.kind==='feature')issues.push({id:`resource-unadapted:${row.id}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：次数或恢复格式待适配，未生成资源。`});
  }
  for(const [index,spec] of specs.entries())try{
   const max=numericMax(c,row,spec.max??spec.value);if(!Number.isSafeInteger(max)||max<0||max>10000)throw Error('资源上限超出支持范围');
   let recovery:Recovery=plain(spec.recovery)?spec.recovery:{};
   if(['sr','short'].includes(spec.recovery))recovery={short:'all',long:'all'};else if(['lr','long'].includes(spec.recovery))recovery={long:'all'};
   else if(typeof spec.recovery==='string'&&spec.recovery!=='manual')throw Error('恢复周期尚未适配');
   if(Array.isArray(spec.recovery))for(const rule of spec.recovery){if(!['sr','lr'].includes(rule.period))throw Error('恢复周期尚未适配');if(!['recoverAll','formula'].includes(rule.type))throw Error('恢复方式尚未适配');const period=rule.period==='sr'?'short':'long';if(recovery[period]!==undefined)throw Error('同一周期的多项恢复规则尚未适配');const amount=rule.type==='recoverAll'?'all':numericMax(c,row,rule.formula);recovery[period]=amount;}
   for(const [key,value] of Object.entries(recovery))if(!['short','long'].includes(key)||value!=='all'&&(!Number.isSafeInteger(value)||Number(value)<0||Number(value)>10000))throw Error('恢复次数或周期无效');
   const identity=cls&&raw.className?JSON.stringify([cls.id,row.entry.source,raw.classSource,raw.subclassShortName||'',row.entry.english]):sourceOwnerIdentity(c,row);
   const grant={key:`feature-resource:${identity}:${index}`,ownerId:row.id,name:spec.name||row.entry.name,max,formula:typeof spec.formula==='string'?formulaText(c,row,spec.formula):undefined,recovery,origin:`${row.entry.name} · ${row.entry.source}`};
   const existing=grants.findIndex(g=>g.key===grant.key);if(existing<0)grants.push(grant);else if(grant.max>=grants[existing].max)grants[existing]=grant;
  }catch(error){issues.push({id:`resource:${row.id}:${index}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：${error instanceof Error?error.message:String(error)}，未执行资源规则。`});}
 }
 grants.push(...planClassResourcePools(c,grants));return {grants,issues};
}
export function rememberFeatureResources(c:Character){for(const [id,r] of Object.entries(c.runtime.resources))if(r.featureGrant){const spent=Math.max(0,r.max-r.current),old=c.runtime.featureResourceArchive?.[id];r.featureGrant.spent=r.featureGrant.spent===undefined?spent:old&&r.current===old.current&&r.max===old.max?Math.max(spent,r.featureGrant.spent):spent;(c.runtime.featureResourceArchive||={})[id]=structuredClone(r);}}
/** Own lifecycle and recovery only; preserve player-owned presentation and overrides. */
export function syncFeatureResources(c:Character){
 const before=JSON.stringify([c.runtime.resources,c.runtime.featureResourceArchive]);rememberFeatureResources(c);
 const needed=new Set<string>();
 for(const grant of planFeatureResources(c).grants){needed.add(grant.key);const old=c.runtime.resources[grant.key]||c.runtime.featureResourceArchive?.[grant.key];
  const manual=old?.featureGrant?.manualMax||!!old?.featureGrant&&old.max!==old.featureGrant.ruleMax;
  const max=manual?old!.max:grant.max,spent=old?old.featureGrant?.spent??Math.max(0,old.max-old.current):0;
  c.runtime.resources[grant.key]={...old,name:grant.name,type:old?.type||'count',icon:old?.icon||'gem',max,current:Math.max(0,max-spent),featureGrant:{ownerId:grant.ownerId,ruleMax:grant.max,manualMax:manual,spent,recovery:grant.recovery,formula:grant.formula,origin:grant.origin,classPool:grant.classPool}};
 }
 for(const [key,r] of Object.entries(c.runtime.resources))if(r.featureGrant&&!needed.has(key))delete c.runtime.resources[key];
 for(const [id,r] of Object.entries(c.runtime.resources))if(r.featureGrant)(c.runtime.featureResourceArchive||={})[id]=structuredClone(r);return before!==JSON.stringify([c.runtime.resources,c.runtime.featureResourceArchive]);
}
export function resourceRestRecovery(c:Character,key:string,kind:'short'|'long'):number|'all'|undefined{
 const r=c.runtime.resources[key];if(!r)return undefined;
  let recovery:number|'all'|undefined=r.featureGrant?.recovery[kind];
  if(!r.featureGrant){if(key.startsWith('pact-slot:')||kind==='long'&&key.startsWith('spell-slot:'))recovery='all';
   for(const [id,config] of Object.entries(c.spellSettings?.special||{}))if(config.mode==='uses'&&(config.recovery===kind||kind==='long'&&config.recovery==='short')&&key===specialSpellResource(id,c)&&sourceSpellResourceEnabled(c,key))recovery='all';}
 return recovery;
}
export function restedResourceValue(c:Character,key:string,kind:'short'|'long'){
 const r=c.runtime.resources[key],recovery=resourceRestRecovery(c,key,kind);if(!r)return 0;if(recovery===undefined)return r.current;if(recovery==='all')return r.max;
 return r.featureGrant?Math.max(0,r.max-Math.max(0,(r.featureGrant.spent??r.max-r.current)-recovery)):Math.min(r.max,r.current+recovery);
}
/** Explicit rest operation, never called by evaluation, refresh or reconciliation. */
export function restResources(c:Character,kind:'short'|'long'){
 for(const [key,r] of Object.entries(c.runtime.resources)){
  const recovery=resourceRestRecovery(c,key,kind);
  if(recovery!==undefined){const spent=r.featureGrant?.spent??r.max-r.current;r.current=restedResourceValue(c,key,kind);if(r.featureGrant)r.featureGrant.spent=recovery==='all'?0:Math.max(0,spent-recovery);if(key.startsWith('spell-slot:')&&c.spellSettings)c.spellSettings.slots[key.split(':')[1]]={max:r.max,used:r.max-r.current};}
 }
 rememberFeatureResources(c);rememberSourceSpellUses(c);
}
export function validateFeatureResourceState(runtime:Character['runtime']){
 const valid=(r:RuntimeResource)=>plain(r)&&Number.isSafeInteger(r.max)&&r.max>=0&&r.max<=99999&&Number.isSafeInteger(r.current)&&r.current>=0&&r.current<=r.max&&plain(r.featureGrant)&&typeof r.featureGrant.ownerId==='string'&&(r.featureGrant.manualMax===undefined||typeof r.featureGrant.manualMax==='boolean')&&(r.featureGrant.spent===undefined||Number.isSafeInteger(r.featureGrant.spent)&&r.featureGrant.spent>=0&&r.featureGrant.spent<=99999)&&(r.featureGrant.formula===undefined||typeof r.featureGrant.formula==='string'&&r.featureGrant.formula.length<=160)&&Number.isSafeInteger(r.featureGrant.ruleMax)&&r.featureGrant.ruleMax>=0&&r.featureGrant.ruleMax<=10000&&plain(r.featureGrant.recovery)&&Object.entries(r.featureGrant.recovery).every(([k,n])=>['short','long'].includes(k)&&(n==='all'||Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=10000))&&(r.featureGrant.classPool===undefined||plain(r.featureGrant.classPool)&&typeof r.featureGrant.classPool.entryId==='string'&&r.featureGrant.classPool.entryId.length>0&&r.featureGrant.classPool.entryId.length<=4000&&typeof r.featureGrant.classPool.label==='string'&&r.featureGrant.classPool.label.length>0&&r.featureGrant.classPool.label.length<=160);
 if(runtime.featureResourceArchive!==undefined&&(!plain(runtime.featureResourceArchive)||Object.keys(runtime.featureResourceArchive).length>10000||Object.values(runtime.featureResourceArchive).some(r=>!valid(r))))throw Error('职业资源历史记录无效。');
 for(const r of Object.values(runtime.resources))if(r.featureGrant&&!valid(r))throw Error('职业资源归属记录无效。');
}
