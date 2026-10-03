import {parseFormula} from '../../data/automation/formula';
import {irMechanics,reviewedRecord,irParentClass,irAbilityScores,irAmount,irRollFormula} from './ir';
import {type Character,type Selection,type Issue,type RuntimeResource} from '../model';
import {automationEnabled} from './state';
import {selectionActive} from './choices';
import {sourceOwnerIdentity,rememberSourceSpellUses,sourceSpellResourceEnabled} from './sourceSpellState';
import {specialSpellResource} from '../spellResourceKeys';

type Recovery={short?:number|'all';long?:number|'all'};
type ResourceClaim={key:string;ownerId:string;legacyKey:string;legacyClass?:[string,string,string,string];previousKey?:string;instance?:boolean;orphanPathTail?:string;canonicalIdentity:string;slot:string};
export type ResourceGrant=ResourceClaim&{name:string;max:number;formula?:string;recovery:Recovery;origin:string};
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function resourceClaim(c:Character,row:Selection,specKey:string):ResourceClaim{
 const cls=irParentClass(c,row),raw=row.entry.raw,record=row.entry.automation!,slot=/^resource:(\d+)$/.exec(specKey)?.[1]||specKey;
 const instance=row.entry.kind==='item',root=instance?JSON.stringify([row.id]):cls?.id||sourceOwnerIdentity(c,row);
 const legacyIdentity=cls&&raw.className?JSON.stringify([cls.id,row.entry.source,raw.classSource,raw.subclassShortName||'',row.entry.english]):sourceOwnerIdentity(c,row);
 return {key:`feature-resource:ir-v1:${JSON.stringify([root,record.identity.key])}:${slot}`,ownerId:row.id,legacyKey:`feature-resource:${legacyIdentity}:${slot}`,canonicalIdentity:record.identity.key,slot,...(instance?{instance:true,...(!row.parentId&&row.grantKey?{orphanPathTail:row.grantKey}:{}),previousKey:`feature-resource:ir-v1:${JSON.stringify([cls?.id||sourceOwnerIdentity(c,row),record.identity.key])}:${slot}`} :{}),...(cls&&record.identity.classEngName?{legacyClass:[cls.id,record.identity.source,record.identity.classSource||'',record.identity.engName] as [string,string,string,string]}:{})};
}
function ownedResourceClaims(c:Character):ResourceClaim[]{
 // Ownership does not disappear when effects, equipment or attunement pause.
 const claims=c.selections.flatMap(row=>(irMechanics(row.entry)?.resources||[]).map(spec=>resourceClaim(c,row,spec.key)));
 return [...new Map(claims.map(claim=>[claim.key,claim])).values()];
}
function previousInstanceScope(key:string,claim:ResourceClaim){
 const prefix='feature-resource:ir-v1:';
 if(!claim.instance||key===claim.key||!key.startsWith(prefix)||!key.endsWith(`:${claim.slot}`))return false;
 try{
  const parts=JSON.parse(key.slice(prefix.length,-claim.slot.length-1));if(!Array.isArray(parts)||parts.length!==2||parts[1]!==claim.canonicalIdentity)return false;
  try{const root=JSON.parse(parts[0]);if(Array.isArray(root)&&root.length===1&&typeof root[0]==='string')return false;}catch{}
  return true;
 }catch{return false;}
}
function legacyInstanceScope(key:string,claim:ResourceClaim){
 if(!claim.instance||!key.startsWith('feature-resource:')||key.startsWith('feature-resource:ir-v1:')||!key.endsWith(`:${claim.slot}`))return false;
 try{const path=JSON.parse(key.slice(17,-claim.slot.length-1));return Array.isArray(path)&&path.length>1&&path.every(part=>typeof part==='string');}catch{return false;}
}
function resourceOwnershipHistory(c:Character){
 const blocked=new Set<string>(),pending:Record<string,string[]>={},claims=ownedResourceClaims(c);
 for(const [key,r]of Object.entries({...c.runtime.featureResourceArchive,...c.runtime.resources})){
  if(!r.featureGrant)continue;
  const matches=claims.filter(claim=>r.featureGrant!.reviewKeys?.includes(claim.key)||claim.key===key||legacyResourceMatches(key,r,claim));
  const unresolved=r.featureGrant.requiresReview||matches.length>1||matches.some(claim=>previousInstanceScope(key,claim)||legacyInstanceScope(key,claim)||claim.instance&&key===claim.previousKey&&key!==claim.key);
  if(!unresolved||!matches.length)continue;
  pending[key]=matches.map(claim=>claim.key);for(const claim of matches)blocked.add(claim.key);
 }
 return {blocked,pending};
}
function rememberPendingOwnership(c:Character){
 for(const [key,keys]of Object.entries(resourceOwnershipHistory(c).pending)){
  const r=c.runtime.resources[key]||c.runtime.featureResourceArchive?.[key];if(!r?.featureGrant)continue;
  r.featureGrant.requiresReview=true;r.featureGrant.reviewKeys=[...new Set([...(r.featureGrant.reviewKeys||[]),...keys])];
  (c.runtime.featureResourceArchive||={})[key]=structuredClone(r);
 }
}
/** Only versioned declarative resources participate; never infer from source prose. */
export function planFeatureResources(c:Character):{grants:ResourceGrant[];issues:Issue[];pendingKeys?:string[]}{
 const grants:ResourceGrant[]=[],issues:Issue[]=[];if(!automationEnabled(c))return {grants,issues};
 for(const row of c.selections){
  if(!selectionActive(c,row))continue;
  for(const gap of row.entry.automation?.unsupported||[])if(['resources','resource','uses','charges'].includes(gap.family))issues.push({id:`resource-gap:${row.id}:${gap.code}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：资源声明未支持，未执行（${gap.code}）。`});
  const model=irMechanics(row.entry);if(!model)continue;
  if(row.entry.kind==='item'&&(!row.equipped||row.quantity<=0||model.equipmentModel?.requiresAttunement&&!row.attuned))continue;
  const cls=irParentClass(c,row),level=cls?.level||row.level,scores=irAbilityScores(c);
  for(const [index,spec] of (model.resources||[]).entries())try{
   const scaled=spec.scaling?.filter(point=>point.level<=level).at(-1)?.max??spec.max;
   const max=irAmount(c,row,scaled,scores);if(!Number.isSafeInteger(max)||max<0||max>10000)throw Error('资源上限超出支持范围');
   const recovery:Recovery={};
   for(const rule of spec.recovery){
    if(!['short','long'].includes(rule.period)){if(rule.period==='dawn')issues.push({id:`resource-recovery:${row.id}:${index}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：黎明恢复由玩家明确操作，休息不会触发。`});continue;}
    if(typeof rule.amount==='string'&&rule.amount!=='all'&&parseFormula(rule.amount).dice){issues.push({id:`resource-recovery:${row.id}:${index}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：恢复需要掷骰并手动记入，休息不会自动代掷。`});continue;}
    const value=rule.amount==='all'?'all':typeof rule.amount==='number'?rule.amount:irAmount(c,row,{formula:rule.amount},scores);
    if(value!=='all'&&(!Number.isSafeInteger(value)||value<0||value>10000))throw Error('恢复次数超出支持范围');recovery[rule.period as 'short'|'long']=value;
   }
   // Only the display label comes from the retained source snapshot. Maximum,
   // formula, recovery and resource identity above are exclusively IR values.
   const label=/^resource:\d+$/.test(spec.key)&&Array.isArray(row.entry.raw.resources)?row.entry.raw.resources[Number(spec.key.slice(9))]?.name:undefined;
   const grant:ResourceGrant={...resourceClaim(c,row,spec.key),name:typeof label==='string'&&label.length<=160?label:row.entry.name,max,...(spec.formula?{formula:irRollFormula(c,row,spec.formula)}:{}),recovery,origin:`${row.entry.name} · ${row.entry.source}`};
   const existing=grants.findIndex(g=>g.key===grant.key);if(existing<0)grants.push(grant);else if(grant.max>=grants[existing].max)grants[existing]=grant;
  }catch(error){issues.push({id:`resource:${row.id}:${index}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：${error instanceof Error?error.message:String(error)}，未执行资源规则。`});}
 }
 // Keep historical candidate bindings when current parent/source paths change.
 const {blocked,pending}=resourceOwnershipHistory(c),pendingKeys=Object.keys(pending);
 for(const grant of grants)if(blocked.has(grant.key))issues.push({id:`resource-ledger:${grant.ownerId}:${grant.slot}`,selectionId:grant.ownerId,severity:'warning',message:`${grant.name}：旧消费记录无法唯一关联，未重新授予次数，请手动核对。`});
 return {grants:grants.filter(grant=>!blocked.has(grant.key)),issues,...(pendingKeys.length?{pendingKeys}:{})};
}
export function rememberFeatureResources(c:Character){for(const [id,r] of Object.entries(c.runtime.resources))if(r.featureGrant){const spent=Math.max(0,r.max-r.current),old=c.runtime.featureResourceArchive?.[id];r.featureGrant.spent=r.featureGrant.spent===undefined?spent:old&&r.current===old.current&&r.max===old.max?Math.max(spent,r.featureGrant.spent):spent;(c.runtime.featureResourceArchive||={})[id]=structuredClone(r);}rememberPendingOwnership(c);}
const normalized=(value:unknown)=>String(value??'').normalize('NFKC').trim().toLowerCase();
function legacyResourceMatches(key:string,resource:RuntimeResource,grant:ResourceClaim){
 if(!resource.featureGrant||!key.startsWith('feature-resource:')||!key.endsWith(`:${grant.slot}`))return false;
 if(key===grant.key)return false;
 if(key===grant.previousKey||previousInstanceScope(key,grant))return true;
 if(key.startsWith('feature-resource:ir-v1:'))return false;
 if(key===grant.legacyKey||resource.featureGrant.ownerId===grant.ownerId)return true;
 if(grant.orphanPathTail&&legacyInstanceScope(key,grant)){try{if(JSON.parse(key.slice(17,-grant.slot.length-1)).at(-1)===grant.orphanPathTail)return true;}catch{}}
 if(!grant.legacyClass)return false;
 try{const parts=JSON.parse(key.slice(17,-grant.slot.length-1));return Array.isArray(parts)&&parts.length===5&&parts[0]===grant.legacyClass[0]&&[parts[1],parts[2],parts[4]].every((value,index)=>normalized(value)===normalized(grant.legacyClass![index+1]));}catch{return false;}
}
export function featureResourceReceipts(history:Record<string,RuntimeResource>,grant:ResourceGrant,grants:ResourceGrant[]){
 return Object.entries(history).filter(([key,r])=>!r.featureGrant?.requiresReview&&(key===grant.key||!grants.some(other=>other.key===key)&&legacyResourceMatches(key,r,grant)&&grants.filter(other=>legacyResourceMatches(key,r,other)).length===1));
}
function rekeyResourcePresentation(c:Character,oldKey:string,newKey:string){
 const replace=(value:string)=>value===oldKey?newKey:value===`resource:${oldKey}`?`resource:${newKey}`:value;
 const remap=(values:string[])=>[...new Set(values.map(replace))];
 if(c.quickbar)c.quickbar=remap(c.quickbar);
 const layout=c.quickbarLayout;if(!layout)return;
 layout.order=remap(layout.order);layout.hidden=remap(layout.hidden);
 if(layout.widgets){
  for(const [key,widget]of Object.entries(layout.widgets)){
   if(widget.members){widget.members=remap(widget.members);if(widget.members.length<2)delete widget.members;}
   const target=replace(key);if(target!==key){layout.widgets[target]??=widget;delete layout.widgets[key];}
  }
 }
}
/** Own lifecycle and recovery only; preserve player-owned presentation and overrides. */
export function syncFeatureResources(c:Character){
 if(!automationEnabled(c))return false;
 const before=JSON.stringify([c.runtime.resources,c.runtime.featureResourceArchive]);rememberFeatureResources(c);
 const needed=new Set<string>(),plan=planFeatureResources(c),grants=plan.grants;
 for(const grant of grants){needed.add(grant.key);
  const history={...c.runtime.featureResourceArchive,...c.runtime.resources};
  // A legacy key without a canonical identity is adopted only by one unique
  // matching grant. Merge duplicate receipts using the greatest consumption.
  const aliases=featureResourceReceipts(history,grant,grants).filter(([key])=>key!==grant.key);
  const candidates=[c.runtime.resources[grant.key]||c.runtime.featureResourceArchive?.[grant.key],...aliases.map(([,r])=>r)].filter((r):r is RuntimeResource=>!!r);
  const old=candidates[0];
  const manual=old?.featureGrant?.manualMax||!!old?.featureGrant&&old.max!==old.featureGrant.ruleMax;
  const max=manual?old!.max:grant.max,spent=Math.max(0,...candidates.map(r=>Math.max(r.featureGrant?.spent??0,r.max-r.current)));
  c.runtime.resources[grant.key]={...old,name:grant.name,type:old?.type||'count',icon:old?.icon||'gem',max,current:Math.max(0,max-spent),featureGrant:{ownerId:grant.ownerId,ruleMax:grant.max,manualMax:manual,spent,recovery:grant.recovery,formula:grant.formula,origin:grant.origin}};
  for(const [key]of aliases){rekeyResourcePresentation(c,key,grant.key);delete c.runtime.resources[key];delete c.runtime.featureResourceArchive?.[key];}
 }
 for(const [key,r] of Object.entries(c.runtime.resources))if(r.featureGrant&&!needed.has(key)&&(!c.selections.some(row=>row.id===r.featureGrant!.ownerId)||c.selections.some(row=>row.id===r.featureGrant!.ownerId&&reviewedRecord(row.entry))))delete c.runtime.resources[key];
 for(const [id,r] of Object.entries(c.runtime.resources))if(r.featureGrant)(c.runtime.featureResourceArchive||={})[id]=structuredClone(r);return before!==JSON.stringify([c.runtime.resources,c.runtime.featureResourceArchive]);
}
export function resourceRestRecovery(c:Character,key:string,kind:'short'|'long'):number|'all'|undefined{
 const r=c.runtime.resources[key];if(!r)return undefined;
  if(r.featureGrant&&!planFeatureResources(c).grants.some(grant=>grant.key===key))return undefined;
  let recovery:number|'all'|undefined=r.featureGrant?.recovery[kind];
  if(!r.featureGrant){if(r.automatic&&!automationEnabled(c))return undefined;if(key.startsWith('pact-slot:')||kind==='long'&&key.startsWith('spell-slot:'))recovery='all';
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
  if(recovery!==undefined){const spent=r.featureGrant?.spent??r.max-r.current;r.current=restedResourceValue(c,key,kind);if(r.featureGrant)r.featureGrant.spent=recovery==='all'?0:Math.max(0,spent-recovery);if(r.automatic){r.automaticSpent=recovery==='all'?0:Math.max(0,(r.automaticSpent??spent)-recovery);(c.runtime.automaticResourceArchive||={})[key]=structuredClone(r);if(/^pact-slot:[1-5]$/.test(key))c.runtime.automaticResourceArchive!['pact-slot:pool']=structuredClone(r);}if(key.startsWith('spell-slot:')&&c.spellSettings)c.spellSettings.slots[key.split(':')[1]]={max:r.max,used:r.max-r.current};}
 }
 rememberFeatureResources(c);rememberSourceSpellUses(c);
}
export function validateFeatureResourceState(runtime:Character['runtime']){
 const valid=(r:RuntimeResource)=>plain(r)&&Number.isSafeInteger(r.max)&&r.max>=0&&r.max<=99999&&Number.isSafeInteger(r.current)&&r.current>=0&&r.current<=r.max&&plain(r.featureGrant)&&typeof r.featureGrant.ownerId==='string'&&(r.featureGrant.requiresReview===undefined||r.featureGrant.requiresReview===true)&&(r.featureGrant.reviewKeys===undefined||r.featureGrant.requiresReview===true&&Array.isArray(r.featureGrant.reviewKeys)&&r.featureGrant.reviewKeys.length<=10000&&new Set(r.featureGrant.reviewKeys).size===r.featureGrant.reviewKeys.length&&r.featureGrant.reviewKeys.every(key=>typeof key==='string'&&key.startsWith('feature-resource:ir-v1:')&&key.length<=12000))&&(r.featureGrant.manualMax===undefined||typeof r.featureGrant.manualMax==='boolean')&&(r.featureGrant.spent===undefined||Number.isSafeInteger(r.featureGrant.spent)&&r.featureGrant.spent>=0&&r.featureGrant.spent<=99999)&&(r.featureGrant.formula===undefined||typeof r.featureGrant.formula==='string'&&r.featureGrant.formula.length<=160)&&Number.isSafeInteger(r.featureGrant.ruleMax)&&r.featureGrant.ruleMax>=0&&r.featureGrant.ruleMax<=10000&&plain(r.featureGrant.recovery)&&Object.entries(r.featureGrant.recovery).every(([k,n])=>['short','long'].includes(k)&&(n==='all'||Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=10000));
 if(runtime.featureResourceArchive!==undefined&&(!plain(runtime.featureResourceArchive)||Object.keys(runtime.featureResourceArchive).length>10000||Object.values(runtime.featureResourceArchive).some(r=>!valid(r))))throw Error('职业资源历史记录无效。');
 for(const r of Object.values(runtime.resources))if(r.featureGrant&&!valid(r))throw Error('职业资源归属记录无效。');
}
