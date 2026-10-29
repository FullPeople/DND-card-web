import {selectionAllowed,type Character,type RuntimeResource,type Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
import {sourceTextSha256} from './sourceTextSha256';
import {itemChargeFamilyId,itemChargeRule,itemChargeRules,itemChargeSourceSnapshot,itemChargeVariablePolicy,itemChargeVariableRule,type ItemChargeRule,type ItemChargeVariableBranch} from './itemChargeDebitSource';
export {itemChargeRule,itemChargeIdentity} from './itemChargeDebitSource';
export interface ItemChargeEvent {id:string;sequence:number;kind:'acquire'|'debit'|'withdraw';before:number;after:number;actionKey?:string;units?:number;branchKey?:string;context?:Record<string,true>;policySha256?:string}
/** snapshotSha256 is the stable canonical complete-source proof anchor, not a literal transport or merged-form hash. */
export interface ItemChargeRecord {key:string;ownerId:string;entryId:string;canonicalEntryId:string;snapshotSha256:string;capacity:number;initial:number;spent:number;withdrawn:boolean;events:ItemChargeEvent[]}
export interface ItemChargeReceipt extends ItemChargeEvent {key:string;fingerprint:string}
export interface ItemChargeDebitState {version:number;sequence:number;records:ItemChargeRecord[];last?:ItemChargeReceipt}
export type ItemChargeIntent={kind:'acquire';knownRemaining:number;confirmedGenuineItem:true;confirmedKnownBalance:true}|{kind:'debit';actionKey:string}|{kind:'variable-debit';branchKey:string;cost:number;context:Record<string,true>}|{kind:'withdraw'};
export interface ItemChargeRequest {id:string;ownerId:string;sequence:number;revision:number;basis:string;intent:ItemChargeIntent}
export type ItemChargeResult={status:'applied'|'duplicate';receipt:ItemChargeReceipt;message:string}|{status:'rejected';message:string};
export interface ItemChargeVariableOffer {key:string;allowedCosts:number[];requiredContext:string[];minAfter:0|1;canDebit:boolean;reason?:string;manualBoundaries:string[]}
export interface ItemChargeOffer {ownerId:string;ownerName:string;source:string;key:string;capacity?:number;remaining?:number;initialized:boolean;withdrawn:boolean;eligible:boolean;canAcquire:boolean;canDebit:boolean;canWithdraw:boolean;reason?:string;debitReason?:string;basis:string;record?:ItemChargeRecord;actionKey?:string;cost?:1;minAfter?:0|1;manualBoundaries?:string[];fixedUnits?:Partial<Record<string,number|string>>|null;equipmentRequired?:boolean;requiresAttunement?:boolean;variableActions?:ItemChargeVariableOffer[]}
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&Number(n)>=min&&Number(n)<=max;
const text=(v:unknown,max=2000)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
const resourceKey=(ownerId:string)=>`item-charge-debit:${encodeURIComponent(JSON.stringify([ownerId]))}`;
const ownKeys=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>plain(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const variableFields=['units','branchKey','context','policySha256']as const;
const validContext=(value:unknown,branch:ItemChargeVariableBranch)=>ownKeys(value,branch.requiredContext)&&branch.requiredContext.every(key=>value[key]===true);
export const itemChargeKnownStateVersion=(version:unknown):version is 1|2=>version===1||version===2;
/** New routes require a present, own, current boolean; never read authority
 * from a request/card. The established fixed-one policy is unchanged. */
export function itemChargeVariableAuthorityReason(c:Character,authority?:SpellActionAuthority,resources:readonly string[]=[]):string|undefined{
 if(!authority||typeof authority!=='object'||!Object.hasOwn(authority,'canEdit')||authority.canEdit!==true)return '此来源记账需要当前明确可编辑权限。';
 return spellActionAuthorityReason(c,authority,resources);
}
export function itemChargeHasVariableHistory(c:Character):boolean{const rows=c.runtime.itemChargeDebits?.records;return Array.isArray(rows)&&rows.some(record=>plain(record)&&!!itemChargeVariablePolicy(record.canonicalEntryId));}
export function validateItemChargeDebitState(value:unknown):void{
 if(value===undefined)return;if(!plain(value)||!integer(value.version,1))throw Error('物品充能历史版本无效。');if(!itemChargeKnownStateVersion(value.version))return;
 if(!integer(value.sequence)||!Array.isArray(value.records)||value.records.length>3000)throw Error('物品充能历史无效。');const keys=new Set<string>(),ids=new Set<string>(),seqs=new Set<number>();let variableEvents=0;
 for(const r of value.records){
  if(!plain(r)||!text(r.ownerId)||!text(r.key,20000)||r.key!==resourceKey(r.ownerId)||keys.has(r.key)||!text(r.entryId)||!text(r.canonicalEntryId)||!/^[a-f0-9]{64}$/.test(r.snapshotSha256)||!integer(r.capacity,1,10000)||!integer(r.initial,0,r.capacity)||!integer(r.spent,0,r.initial)||typeof r.withdrawn!=='boolean'||!Array.isArray(r.events)||!r.events.length||r.events.length>10002)throw Error('物品充能归属或余额无效。');keys.add(r.key);let current=0,spent=0,withdrawn=false;const source=itemChargeRules().find(rule=>rule.id===r.canonicalEntryId);
  for(const [i,e] of r.events.entries()){
   if(!plain(e)||!text(e.id,128)||ids.has(e.id)||!integer(e.sequence)||seqs.has(e.sequence)||!integer(e.before,0,r.capacity)||!integer(e.after,0,r.capacity)||e.before!==current||!['acquire','debit','withdraw'].includes(e.kind)||i===0&&(e.kind!=='acquire'||e.after!==r.initial)||i>0&&(withdrawn||e.kind==='acquire')||e.kind!=='debit'&&e.actionKey!==undefined||e.kind==='withdraw'&&e.after!==e.before)throw Error('物品充能事件历史无效。');
   const variable=variableFields.some(key=>key in e);let units=0;
   if(variable){
    const policy=itemChargeVariablePolicy(r.canonicalEntryId),branch=policy?.branches.find(row=>row.key===e.branchKey);
    if(value.version!==2||e.kind!=='debit'||!ownKeys(e,['id','sequence','kind','before','after','actionKey',...variableFields])||!policy||!branch||r.snapshotSha256!==policy.fullNormalizedSnapshotSha256||r.capacity!==policy.capacity||e.policySha256!==policy.policySha256||e.actionKey!==branch.key||!integer(e.units,1,r.capacity)||!branch.allowedCosts.includes(e.units)||!validContext(e.context,branch)||e.after!==e.before-e.units||e.after<branch.minAfter)throw Error('来源分支充能单位或证明无效。');
    units=e.units;variableEvents++;
   }else if(e.kind==='debit'){
    if(!text(e.actionKey)||e.before<1||e.after!==e.before-1||source?.supported&&(e.actionKey!==source.action?.key||e.after<(source.action?.minAfter??0))||value.version===2&&!ownKeys(e,['id','sequence','kind','before','after','actionKey']))throw Error('物品固定费用历史无效。');units=1;
   }else if(value.version===2&&!ownKeys(e,['id','sequence','kind','before','after']))throw Error('物品充能事件字段尚未支持。');
   ids.add(e.id);seqs.add(e.sequence);current=e.after;spent+=units;if(e.kind==='withdraw')withdrawn=true;
  }
  if(spent!==r.spent||withdrawn!==r.withdrawn||current!==r.initial-r.spent)throw Error('物品充能历史与余额不一致。');
 }
 if(seqs.size!==value.sequence||[...seqs].some(n=>n>=value.sequence)||value.version===2&&!variableEvents)throw Error('物品充能事件序号或版本无效。');
 if(value.sequence>0&&value.last===undefined)throw Error('物品充能回执缺失。');if(value.last!==undefined){const l=value.last;if(!plain(l)||!keys.has(l.key)||!text(l.fingerprint,64)||!/^[a-f0-9]{64}$/.test(l.fingerprint)||l.sequence!==value.sequence-1||!ids.has(l.id))throw Error('物品充能回执无效。');const e=value.records.flatMap((r:any)=>r.events).find((e:any)=>e.sequence===l.sequence);if(!e||['id','sequence','kind','before','after','actionKey',...variableFields].some(k=>JSON.stringify(e[k])!==JSON.stringify(l[k]))||value.version===2&&!ownKeys(l,[...Reflect.ownKeys(e).map(String),'key','fingerprint']))throw Error('物品充能回执与历史不一致。');}
}
function state(c:Character):ItemChargeDebitState|undefined{const value=c.runtime.itemChargeDebits;if(value===undefined)return {version:1,sequence:0,records:[]};try{validateItemChargeDebitState(value);return itemChargeKnownStateVersion(value.version)?value:undefined;}catch{return;}}
/** A mutable marker or same-prefix manual counter never establishes ownership. */
export function ownedItemChargeResource(c:Character,id:string):boolean{const s=c.runtime.itemChargeDebits;return !!s&&Array.isArray(s.records)&&s.records.some(r=>plain(r)&&typeof r.ownerId==='string'&&r.key===id&&id===resourceKey(r.ownerId));}
const mechanical=(r:RuntimeResource|undefined)=>r&&[r.current,r.max,r.unlimited,r.automatic,r.featureGrant,r.sourceSpellGrant,r.limitedSourceUseGrant,r.itemChargeDebitGrant,(r as any).recovery];
export function assertItemChargeResourceEdit(c:Character,id:string,next:RuntimeResource|undefined){if(ownedItemChargeResource(c,id)&&JSON.stringify(mechanical(c.runtime.resources[id]))!==JSON.stringify(mechanical(next)))throw Error('物品充能由专属历史管理，不能手工修改、删除或恢复。');}
export function assertItemChargeResourcesPreserved(before:Character,after:Character){for(const id of Object.keys(before.runtime.resources))assertItemChargeResourceEdit(before,id,after.runtime.resources[id]);if(JSON.stringify(before.runtime.itemChargeDebits)!==JSON.stringify(after.runtime.itemChargeDebits))throw Error('仪表盘不能修改物品充能历史。');}
function mirror(c:Character,r:ItemChargeRecord){const m=c.runtime.resources[r.key];return !!m&&m.max===r.capacity&&m.current===r.initial-r.spent&&(m.unlimited===undefined||m.unlimited===false)&&(m.automatic===undefined||m.automatic===false)&&m.featureGrant===undefined&&m.sourceSpellGrant===undefined&&m.limitedSourceUseGrant===undefined&&(m as any).recovery===undefined&&plain(m.itemChargeDebitGrant)&&m.itemChargeDebitGrant.key===r.key;}
/** ACK proof is source/mirror binding, not current action eligibility. A
 * legitimate withdrawal remains acknowledgeable after withdrawn becomes true. */
export function itemChargeBoundReceipt(c:Character,ownerId:string):ItemChargeReceipt|undefined{
 const store=state(c),last=store?.last,record=store?.records.find(row=>row.ownerId===ownerId),owners=c.selections.filter(row=>row.id===ownerId),owner=owners.length===1?owners[0]:undefined,rule=owner&&itemChargeRule(owner.entry);
 if(!last||!record||!owner||!rule||owner.quantity!==1||last.key!==record.key||record.entryId!==owner.entry.id||record.canonicalEntryId!==rule.id||record.snapshotSha256!==rule.fullNormalizedSnapshotSha256||record.capacity!==rule.capacity||c.selections.filter(row=>itemChargeFamilyId(row.entry)===rule.id).length!==1||!mirror(c,record)||!record.events.some(event=>event.id===last.id&&event.sequence===last.sequence))return;
 return last;
}
function variableFamily(c:Character,ownerId:string){const owner=c.selections.find(row=>row.id===ownerId),rows=c.runtime.itemChargeDebits?.records,record=Array.isArray(rows)?rows.find(row=>plain(row)&&row.ownerId===ownerId):undefined,id=owner&&itemChargeFamilyId(owner.entry);return id&&itemChargeVariablePolicy(id)||record&&itemChargeVariablePolicy(record.canonicalEntryId)||undefined;}
function basis(c:Character,ownerId:string){const values:unknown[]=[c.id,c.revision,c.edition,c.profile,c.automation,c.runtime.itemChargeDebits,c.selections.map(s=>[s.id,s.entry.id,s.entry.kind,s.entry.source,s.entry.packId,s.entry.edition,s.entry.name,s.entry.english,itemChargeFamilyId(s.entry)?itemChargeSourceSnapshot(s.entry):undefined,s.parentId,s.grantKey,s.level,s.quantity,s.equipped,s.attuned]),c.runtime.resources[resourceKey(ownerId)]];const policy=variableFamily(c,ownerId);if(policy)values.push(policy.policySha256);return sourceTextSha256(JSON.stringify(values));}
function validOwner(c:Character,owner:Selection,rule:ItemChargeRule){return automationEnabled(c)&&(rule.supported||!!itemChargeVariableRule(owner.entry))&&(!rule.requiresAttunement||owner.equipped===true&&owner.attuned===true)&&owner.entry.kind==='item'&&owner.quantity===1&&selectionAllowed(c,owner.entry)&&c.profile.enabledSources.includes(rule.source)&&(owner.entry.dependencies||[]).every(id=>c.profile.enabledSources.includes(id))&&!c.profile.disabledEntries?.some(id=>id===owner.entry.id||id===rule.id)&&(rule.edition==='both'||rule.edition===c.edition)&&(rule.action?.requiredSources||[]).every(id=>c.profile.enabledSources.includes(id))&&(!rule.action?.requiredCardEdition||rule.action.requiredCardEdition===c.edition)&&activeEffectSelections(c).some(s=>s.id===owner.id)&&c.selections.filter(s=>s.id===owner.id).length===1&&c.selections.filter(s=>itemChargeFamilyId(s.entry)===rule.id).length===1;}
export function itemChargeStateIssue(c:Character):string|undefined{return c.runtime.itemChargeDebits!==undefined&&!state(c)?'物品充能历史版本或内容尚未支持；保留原记录，只读。':undefined;}
export function itemChargeOffers(c:Character,authority?:SpellActionAuthority):ItemChargeOffer[]{
 const s=state(c),result:ItemChargeOffer[]=[];
 const add=(ownerId:string,rule:ItemChargeRule|undefined,owner?:Selection,record?:ItemChargeRecord)=>{
  const key=resourceKey(ownerId);if(result.some(o=>o.key===key))return;record??=s?.records.find(r=>r.key===key);const currentRule=owner&&itemChargeRule(owner.entry),variable=owner&&itemChargeVariableRule(owner.entry),valid=!!rule&&!!owner&&!!currentRule&&currentRule.id===rule.id&&validOwner(c,owner,rule),bound=!!record&&record.entryId===owner?.entry.id&&record.canonicalEntryId===rule?.id&&record.snapshotSha256===rule?.fullNormalizedSnapshotSha256&&record.capacity===rule?.capacity,authorityReason=variableFamily(c,ownerId)?itemChargeVariableAuthorityReason(c,authority,[key]):spellActionAuthorityReason(c,authority,[key]),action=rule?.supported?rule.action:undefined;
  const reason=!s?'物品充能历史版本或内容未支持，保留原记录，只读。':authorityReason||(!rule?.supported&&!variable?'此物品的动作条件、计量单位或零点处理尚未适配。':!valid?rule?.requiresAttunement===true&&owner&&(owner.equipped!==true||owner.attuned!==true)?'此记账分支需要当前已装备／持用且已明确同调；不会自动同调。':'当前来源、数量、版本、归属或重复拥有声明不可用。':record&&!bound?'当前物品与原充能归属不一致，不重新绑定。':record&&!mirror(c,record)?'充能历史与计数镜像不一致；未修复或补发。':record?.withdrawn?'此物理实例已撤回，不重新初始化。':!record&&c.runtime.resources[key]?'此资源键已有记录，不接管手工计数。':undefined);
  const eligible=!!s&&valid&&bound&&!record?.withdrawn&&!!record&&mirror(c,record),debitReason=reason||(!eligible?'请先明确记录真实物品与当前已知余额。':action?.equipmentRequired&&owner?.equipped!==true?'此动作需要当前已装备／穿戴或持用该物品。':record!.initial-record!.spent<1+(action?.minAfter||0)?action?.minAfter===1?'余额必须保留至少1次；末次耗尽分支尚未支持。':'当前充能不足；本批不提供恢复。':undefined);
  const variableActions=variable?.branches.map(branch=>{const branchReason=reason||(!eligible?'请先明确记录真实物品与当前已知余额。':!branch.allowedCosts.some(cost=>cost<=record!.initial-record!.spent-branch.minAfter)?branch.minAfter===1?'余额必须保留至少1次；末次耗尽分支尚未支持。':'当前余额不足以记录任何来源费用；本批不恢复。':undefined);return{key:branch.key,allowedCosts:[...branch.allowedCosts],requiredContext:[...branch.requiredContext],minAfter:branch.minAfter,canDebit:eligible&&!branchReason,reason:branchReason,manualBoundaries:[...variable.manualBoundaries]};});
  result.push({ownerId,ownerName:owner?.entry.name||rule?.name||'保留的物品充能',source:rule?.source||'',key,capacity:rule?.capacity??record?.capacity,remaining:record?record.initial-record.spent:undefined,initialized:!!record,withdrawn:!!record?.withdrawn,eligible,canAcquire:!!s&&!authorityReason&&valid&&!record&&!c.runtime.resources[key],canDebit:!!action&&eligible&&!debitReason,canWithdraw:!!s&&!authorityReason&&!!record&&!record.withdrawn,reason,debitReason:variable?reason:debitReason,basis:basis(c,ownerId),record,...(action?{actionKey:action.key,cost:1,minAfter:action.minAfter as 0|1,manualBoundaries:action.manualBoundaries,fixedUnits:action.fixedUnits,equipmentRequired:action.equipmentRequired,...(rule?.requiresAttunement===true?{requiresAttunement:true}:{})}:{}),...(variable?{variableActions,equipmentRequired:true,requiresAttunement:true}:{})});
 };
 for(const owner of c.selections){const id=itemChargeFamilyId(owner.entry);if(id)add(owner.id,itemChargeRules().find(r=>r.id===id),owner);}
 if(s)for(const record of s.records)add(record.ownerId,itemChargeRules().find(r=>r.id===record.canonicalEntryId),c.selections.find(o=>o.id===record.ownerId),record);
 return result;
}
export function itemChargeRequest(c:Character,ownerId:string,id:string,intent:ItemChargeIntent):ItemChargeRequest{return {id,ownerId,sequence:c.runtime.itemChargeDebits?.sequence??0,revision:c.revision,basis:basis(c,ownerId),intent};}
function append(next:ItemChargeDebitState,r:ItemChargeRecord,event:Omit<ItemChargeEvent,'sequence'>,fingerprint:string){const e={...event,sequence:next.sequence};r.events.push(e);next.sequence++;next.last={...e,key:r.key,fingerprint};return next.last;}
export function performItemChargeAction(c:Character,q:ItemChargeRequest,authority?:SpellActionAuthority):ItemChargeResult{
 const reject=(message:string):ItemChargeResult=>({status:'rejected',message}),s=state(c),denied=spellActionAuthorityReason(c,authority);if(denied)return reject(denied);
 if(!s||!q||!text(q.id,128)||!text(q.ownerId)||!integer(q.sequence)||!integer(q.revision)||!plain(q.intent)||!['acquire','debit','variable-debit','withdraw'].includes(q.intent.kind))return reject('物品充能请求或历史版本无效。');const keys=q.intent.kind==='acquire'?['kind','knownRemaining','confirmedGenuineItem','confirmedKnownBalance']:q.intent.kind==='debit'?['kind','actionKey']:q.intent.kind==='variable-debit'?['kind','branchKey','cost','context']:['kind'];if(Object.keys(q.intent).length!==keys.length||keys.some(k=>!Object.hasOwn(q.intent,k))||q.intent.kind==='variable-debit'&&!ownKeys(q.intent,keys))return reject('物品充能确认格式无效。');
 if(q.intent.kind==='variable-debit'||variableFamily(c,q.ownerId)){const issue=itemChargeVariableAuthorityReason(c,authority,[resourceKey(q.ownerId)]);if(issue)return reject(issue);}
 const fingerprint=sourceTextSha256(JSON.stringify([q.ownerId,q.revision,q.basis,q.intent]));
 if(s.last?.id===q.id)return s.last.fingerprint===fingerprint&&s.last.sequence===q.sequence?{status:'duplicate',receipt:s.last,message:'此操作已记录，未重复扣除或领取。'}:reject('此操作编号已有其他用途。');
 if(q.sequence!==s.sequence||q.revision!==c.revision||q.basis!==basis(c,q.ownerId)||s.sequence>=Number.MAX_SAFE_INTEGER||s.records.some(r=>r.events.some(e=>e.id===q.id)))return reject('物品、装备或历史已变化，请重新核对。');const offer=itemChargeOffers(c,authority).find(o=>o.ownerId===q.ownerId);if(!offer)return reject('没有已核实的物品充能归属。');const next=structuredClone(s);let record=next.records.find(r=>r.key===offer.key),receipt:ItemChargeReceipt;
 if(q.intent.kind==='acquire'){
  if(!offer.canAcquire||q.intent.confirmedGenuineItem!==true||q.intent.confirmedKnownBalance!==true||!integer(q.intent.knownRemaining,0,offer.capacity!))return reject(offer.reason||'必须明确确认真实物品与当前已知余额（可为0），不会自动补满。');const owner=c.selections.find(o=>o.id===q.ownerId)!,rule=itemChargeRule(owner.entry)!;record={key:offer.key,ownerId:owner.id,entryId:owner.entry.id,canonicalEntryId:rule.id,snapshotSha256:rule.fullNormalizedSnapshotSha256,capacity:offer.capacity!,initial:q.intent.knownRemaining,spent:0,withdrawn:false,events:[]};next.records.push(record);receipt=append(next,record,{id:q.id,kind:'acquire',before:0,after:record.initial},fingerprint);c.runtime.resources[record.key]={name:`${owner.entry.name} · 充能记账`,max:record.capacity,current:record.initial,type:'count',itemChargeDebitGrant:{key:record.key}};
 }else if(q.intent.kind==='debit'){
  if(!offer.canDebit||!record||q.intent.actionKey!==offer.actionKey)return reject(offer.debitReason||'此固定费用动作当前不可用。');const before=record.initial-record.spent;record.spent++;receipt=append(next,record,{id:q.id,kind:'debit',actionKey:q.intent.actionKey,before,after:before-1},fingerprint);c.runtime.resources[record.key].current=before-1;
 }else if(q.intent.kind==='variable-debit'){
  const intent=q.intent,owner=c.selections.find(row=>row.id===q.ownerId),policy=owner&&itemChargeVariableRule(owner.entry),branch=policy?.branches.find(row=>row.key===intent.branchKey),action=offer.variableActions?.find(row=>row.key===intent.branchKey),cost=intent.cost;
  if(!record||!policy||!branch||!action?.canDebit||!integer(cost,1,record.capacity)||!branch.allowedCosts.includes(cost)||!validContext(intent.context,branch)||record.initial-record.spent-cost<branch.minAfter)return reject(action?.reason||'来源分支、整数费用、逐次条件或末次余额尚未核实。');
  const before=record.initial-record.spent;next.version=2;record.spent+=cost;receipt=append(next,record,{id:q.id,kind:'debit',actionKey:branch.key,before,after:before-cost,units:cost,branchKey:branch.key,context:structuredClone(intent.context),policySha256:policy.policySha256},fingerprint);
  // A permissively preserved v1 event may contain unknown historical fields.
  // Never strip them or commit an invalid v2 promotion; validate the complete
  // cloned candidate before touching either resource mirror or saved ledger.
  try{validateItemChargeDebitState(next);}catch{return reject('旧历史含本版本无法逐单位核实的字段；未升级、扣费或改写。');}
  c.runtime.resources[record.key].current=before-cost;
 }else{if(!offer.canWithdraw||!record)return reject(offer.reason||'当前没有可撤回的物品历史。');record.withdrawn=true;receipt=append(next,record,{id:q.id,kind:'withdraw',before:record.initial-record.spent,after:record.initial-record.spent},fingerprint);}
 c.runtime.itemChargeDebits=next;return {status:'applied',receipt,message:q.intent.kind==='acquire'?'已记录当前已知充能，未自动补满。':q.intent.kind==='debit'?'已记录来源证明的固定费用；动作、法术与效果仍由玩家处理。':q.intent.kind==='variable-debit'?'已记录来源限定分支与单位费用；未执行动作或效果。':'已撤回此物理实例，余额与历史保留。'};
}
export function revokeItemChargeOwners(c:Character,removed:ReadonlySet<string>){const s=state(c);if(!s)return;const next=structuredClone(s);let changed=false;for(const r of next.records)if(removed.has(r.ownerId)&&!r.withdrawn){r.withdrawn=true;let id=`item-removed-${next.sequence}`,n=0;while(next.records.some(row=>row.events.some(e=>e.id===id)))id=`item-removed-${next.sequence}-${++n}`;append(next,r,{id,kind:'withdraw',before:r.initial-r.spent,after:r.initial-r.spent},sourceTextSha256('explicit-item-removal'));changed=true;}if(changed)c.runtime.itemChargeDebits=next;}

