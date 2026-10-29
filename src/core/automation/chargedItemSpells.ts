import {selectionAllowed,type Character,type Entry,type Selection,type SpecialSpell} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled,supportedAutomation} from './state';
import {spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
import {itemChargeRequest,performItemChargeAction,validateItemChargeDebitState,itemChargeKnownStateVersion,type ItemChargeReceipt} from './itemChargeDebits';
import {sourceTextSha256} from './sourceTextSha256';
import {chargedItemSpellFamilyId,chargedItemSpellRule,chargedItemSpellPolicy,chargedItemSpellStoredRule,chargedItemSpellTargetRule,chargedItemSpellSourceSnapshot,type ChargedItemSpellRule,type ChargedItemSpellStatistics} from './chargedItemSpellSource';
import type {SpellActionRequest,SpellActionReceipt,SpellActionResult,SpellPayment} from './actions';

export interface ChargedItemSpellRecord {ownerId:string;entryId:string;canonicalEntryId:string;snapshotSha256:string;poolKey:string;policySha256:string;enabled:boolean;nonce:number}
export interface ChargedItemSpellState {version:number;sequence:number;records:ChargedItemSpellRecord[]}
export interface ChargedItemSpellMarker {version:number;branchKey:string;targetEntryId:string;targetScope:'self'|'spell';sourceActionTiming:'action'|'bonus-action'|'spell-default';castLevel:number;statistics:ChargedItemSpellStatistics;policySha256:string;nonce:number}
export interface ChargedItemSpellCastMarker extends ChargedItemSpellMarker {ownerId:string;chargeEventId:string;chargeFingerprint:string;chargeReceipt:ItemChargeReceipt;castBasis:string}
export interface ChargedItemSpellGrant {key:string;targetEntryId:string;targetName:string;targetScope:'self'|'spell';sourceActionTiming:'action'|'bonus-action'|'spell-default';castLevel:number;cost:1;minAfter:0|1;statistics:ChargedItemSpellStatistics}
export interface ChargedItemSpellOffer {ownerId:string;key:string;label:string;eligible:boolean;active:boolean;canConfirm:boolean;canWithdraw:boolean;reason?:string;basis:string;nonce:number;requiresAttunement:boolean;grants:ChargedItemSpellGrant[];record?:ChargedItemSpellRecord}
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const own=(v:unknown,keys:readonly string[]):v is Record<string,any>=>plain(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(v:unknown,max=2000):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a:unknown,b:unknown)=>chargedItemSpellSourceSnapshot(a)===chargedItemSpellSourceSnapshot(b);
const keyFor=(ownerId:string)=>`item-charge-debit:${encodeURIComponent(JSON.stringify([ownerId]))}`;
export const chargedItemSpellGrantKey=(key?:string)=>!!key?.startsWith('source-spell:item-charged/');
export const chargedItemSpellChildKey=(rule:ChargedItemSpellRule)=>`source-spell:item-charged/${encodeURIComponent(rule.branch.key)}`;
export const chargedItemSpellChildId=(ownerId:string,rule:ChargedItemSpellRule)=>`auto-spell:${ownerId}:${encodeURIComponent(chargedItemSpellChildKey(rule))}`;
const statsValid=(v:unknown)=>own(v,['kind'])&&v.kind==='none'||own(v,['kind','saveDC'])&&v.kind==='fixed-dc'&&integer(v.saveDC,1,30);
const markerKeys=['version','branchKey','targetEntryId','targetScope','sourceActionTiming','castLevel','statistics','policySha256','nonce']as const;
export function validateChargedItemSpellMarker(value:unknown):void{
 if(!plain(value)||!integer(value.version,1))throw Error('物品付费施法来源版本无效。');if(value.version!==1)return;
 if(!own(value,markerKeys)||!text(value.branchKey)||!text(value.targetEntryId)||!['self','spell'].includes(value.targetScope)||!['action','bonus-action','spell-default'].includes(value.sourceActionTiming)||!integer(value.castLevel,1,9)||!statsValid(value.statistics)||!sha(value.policySha256)||!integer(value.nonce,1))throw Error('物品付费施法来源证明无效。');
}
export function validateChargedItemSpellCastMarker(value:unknown):void{
 if(!plain(value)||!integer(value.version,1))throw Error('物品施法支付回执版本无效。');if(value.version!==1)return;
 if(!own(value,[...markerKeys,'ownerId','chargeEventId','chargeFingerprint','chargeReceipt','castBasis'])||!text(value.ownerId)||!sha(value.chargeEventId)||!sha(value.chargeFingerprint)||!sha(value.castBasis))throw Error('物品施法支付回执无效。');validateChargedItemSpellMarker(Object.fromEntries(markerKeys.map(key=>[key,value[key]])));
 const charge=value.chargeReceipt;if(!own(charge,['id','sequence','kind','before','after','actionKey','key','fingerprint'])||charge.id!==value.chargeEventId||!integer(charge.sequence)||charge.kind!=='debit'||!integer(charge.before,1,10000)||charge.after!==charge.before-1||charge.actionKey!==value.branchKey||charge.key!==keyFor(value.ownerId)||charge.fingerprint!==value.chargeFingerprint)throw Error('物品施法必须绑定完整且精确的一单位原始充能回执。');
}
export function validateChargedItemSpellState(value:unknown):void{
 if(value===undefined)return;if(!plain(value)||!integer(value.version,1))throw Error('物品付费施法确认版本无效。');if(value.version!==1)return;
 if(!own(value,['version','sequence','records'])||!integer(value.sequence)||!Array.isArray(value.records)||value.records.length>3000)throw Error('物品付费施法确认历史无效。');const ids=new Set<string>(),nonces=new Set<number>();
 for(const r of value.records){if(!own(r,['ownerId','entryId','canonicalEntryId','snapshotSha256','poolKey','policySha256','enabled','nonce'])||!text(r.ownerId)||!text(r.entryId)||!text(r.canonicalEntryId)||!sha(r.snapshotSha256)||!sha(r.policySha256)||r.poolKey!==keyFor(r.ownerId)||typeof r.enabled!=='boolean'||!integer(r.nonce,1,value.sequence)||ids.has(r.ownerId)||nonces.has(r.nonce))throw Error('物品付费施法实物归属无效。');ids.add(r.ownerId);nonces.add(r.nonce);}
}
function state(c:Character):ChargedItemSpellState|undefined{
 if(!supportedAutomation(c))return;const value=c.automation?.chargedItemSpells as ChargedItemSpellState|undefined;if(value===undefined)return {version:1,sequence:0,records:[]};try{validateChargedItemSpellState(value);return value.version===1?value:undefined;}catch{return;}
}
export const chargedItemSpellStateIssue=(c:Character)=>state(c)?undefined:'物品付费施法确认版本未知或记录损坏；保留原数据，只读。';
export function chargedItemSpellAuthorityReason(c:Character,authority?:SpellActionAuthority,resources:readonly string[]=[]){
 if(!authority||typeof authority!=='object'||!Object.hasOwn(authority,'canEdit')||authority.canEdit!==true)return '物品付费施法需要当前明确可编辑权限。';return spellActionAuthorityReason(c,authority,resources);
}
const sourceAllowed=(c:Character,e:Entry,id:string)=>selectionAllowed(c,e)&&c.profile.enabledSources.includes(e.source)&&(e.dependencies||[]).every(s=>c.profile.enabledSources.includes(s))&&!c.profile.disabledEntries?.some(s=>s===e.id||s===id)&&(e.edition==='both'||e.edition===c.edition);
function currentOwner(c:Character,id:string){const rows=c.selections.filter(row=>row.id===id);return rows.length===1?rows[0]:undefined;}
function storedRule(record:ChargedItemSpellRecord|undefined){return record&&chargedItemSpellStoredRule(record.canonicalEntryId,record.entryId,record.snapshotSha256,record.policySha256);}
function poolBinding(c:Character,ownerId:string,rule:ChargedItemSpellRule,owner?:Selection){
 const s=c.runtime.itemChargeDebits;try{validateItemChargeDebitState(s);}catch{return;}if(!s||!itemChargeKnownStateVersion(s.version))return;
 const rows=s.records.filter(r=>r.ownerId===ownerId);if(rows.length!==1)return;const record=rows[0],key=keyFor(ownerId),r=c.runtime.resources[key];
 if(record.key!==key||record.canonicalEntryId!==rule.id||record.snapshotSha256!==rule.fullNormalizedSnapshotSha256||record.capacity!==rule.capacity||owner&&record.entryId!==owner.entry.id||!r||r.max!==record.capacity||r.current!==record.initial-record.spent||r.unlimited!==undefined&&r.unlimited!==false||r.automatic!==undefined&&r.automatic!==false||r.featureGrant!==undefined||r.sourceSpellGrant!==undefined||r.limitedSourceUseGrant!==undefined||(r as any).recovery!==undefined||!plain(r.itemChargeDebitGrant)||r.itemChargeDebitGrant.key!==key)return;
 return {key,record,remaining:record.initial-record.spent,store:s};
}
function ownerReason(c:Character,owner:Selection|undefined,rule:ChargedItemSpellRule|undefined){
 if(!automationEnabled(c))return '自动计算未启用。';if(!owner||!rule)return '当前实物完整来源、版本或归属未核实。';
 if(!sourceAllowed(c,owner.entry,rule.id)||!activeEffectSelections(c).some(row=>row.id===owner.id)||!rule.branch.requiredSources.every(id=>c.profile.enabledSources.includes(id))||rule.branch.requiredCardEdition&&rule.branch.requiredCardEdition!==c.edition)return '物品来源、法术依赖或版本当前不可用。';
 if(c.selections.filter(row=>chargedItemSpellFamilyId(row.entry)===rule.id).length!==1||owner.quantity!==1)return '实物数量、重复声明或别名归属不唯一。';if(owner.equipped!==true)return '请先明确记录当前持用或穿戴。';if(rule.requiresAttunement&&owner.attuned!==true)return '此物品需要当前明确同调。';
}
export function chargedItemSpellTarget(c:Character,rule:ChargedItemSpellRule,catalog:Entry[]=[]):Entry|undefined{
 const entries=[...new Map([...catalog,...c.selections.map(row=>row.entry)].map(entry=>[entry.id,entry])).values()],matches=entries.filter(entry=>!!chargedItemSpellTargetRule(entry,rule.target.id)&&sourceAllowed(c,entry,rule.target.id)),canonical=matches.filter(entry=>entry.id===rule.target.id);return canonical.length===1?canonical[0]:matches.length===1?matches[0]:undefined;
}
function marker(rule:ChargedItemSpellRule,nonce:number):ChargedItemSpellMarker{return {version:1,branchKey:rule.branch.key,targetEntryId:rule.target.id,targetScope:rule.branch.targetScope,sourceActionTiming:rule.branch.sourceActionTiming,castLevel:rule.branch.castLevel,statistics:structuredClone(rule.branch.statistics),policySha256:rule.policySha256,nonce};}
function markerMatches(value:unknown,rule:ChargedItemSpellRule,record:ChargedItemSpellRecord,exactNonce=false):value is ChargedItemSpellMarker{
 try{validateChargedItemSpellMarker(value);}catch{return false;}if(!plain(value)||value.version!==1||!integer(value.nonce,1,record.nonce)||exactNonce&&value.nonce!==record.nonce)return false;return same(value,marker(rule,value.nonce));
}
function cachedChild(c:Character,row:Selection,rule:ChargedItemSpellRule,record:ChargedItemSpellRecord,exactNonce=false){
 const config=c.spellSettings?.special?.[row.id],g=config?.sourceGrant;
 return row.id===chargedItemSpellChildId(record.ownerId,rule)&&row.parentId===record.ownerId&&row.grantKey===chargedItemSpellChildKey(rule)&&row.quantity===1&&row.level===1&&!!chargedItemSpellTargetRule(row.entry,rule.target.id)&&!!config&&own(config,['mode','label','sourceGrant'])&&config.label==='已核实的物品付费施法'&&config.mode==='locked'&&!!g&&own(g,['ownerId','key','active','usage','canUseSlots','itemChargedSpell',...(Object.hasOwn(g,'reason')?['reason']:[])])&&typeof g.active==='boolean'&&(g.reason===undefined||typeof g.reason==='string')&&g.ownerId===record.ownerId&&g.key===row.grantKey&&g.usage==='check'&&g.canUseSlots===false&&markerMatches(g.itemChargedSpell,rule,record,exactNonce);
}
export function chargedItemSpellOwnedChild(c:Character,row:Selection){const record=state(c)?.records.find(r=>r.ownerId===row.parentId),rule=storedRule(record);return !!record&&!!rule&&cachedChild(c,row,rule,record);}
export function chargedItemSpellProtectedCollision(c:Character,row:Selection){if(!row.id.startsWith('auto-spell:'))return false;return c.selections.some(owner=>{if(owner.entry.kind!=='item')return false;const id=chargedItemSpellFamilyId(owner.entry),rule=id&&chargedItemSpellPolicy(id);return !!rule&&row.id===chargedItemSpellChildId(owner.id,rule)&&!chargedItemSpellOwnedChild(c,row);});}
export function chargedItemSpellChildCollision(c:Character,ownerId:string,rule:ChargedItemSpellRule){const rows=c.selections.filter(row=>row.id===chargedItemSpellChildId(ownerId,rule));if(!rows.length)return false;const record=state(c)?.records.find(r=>r.ownerId===ownerId);return rows.length!==1||!record||storedRule(record)?.id!==rule.id||!cachedChild(c,rows[0],rule,record);}
export function chargedItemSpellOffer(c:Character,ownerId:string,catalog:Entry[]=[],authority?:SpellActionAuthority):ChargedItemSpellOffer{
 const owner=currentOwner(c,ownerId),rule=owner&&chargedItemSpellRule(owner.entry),s=state(c),record=s?.records.find(r=>r.ownerId===ownerId),pool=rule&&poolBinding(c,ownerId,rule,owner),target=rule&&chargedItemSpellTarget(c,rule,catalog),bound=!!rule&&!!record&&record.entryId===owner?.entry.id&&record.canonicalEntryId===rule.id&&record.snapshotSha256===rule.fullNormalizedSnapshotSha256&&record.policySha256===rule.policySha256&&record.poolKey===pool?.key;
 const reason=!s?chargedItemSpellStateIssue(c):ownerReason(c,owner,rule)||(!pool||pool.record.withdrawn?'真实物品的当前已知充能历史尚未核实或已撤回；不初始化或恢复。':!target?'完整法术来源、唯一引用或目标版本当前不可用。':rule&&chargedItemSpellChildCollision(c,ownerId,rule)?'生成法术身份与手工或其他来源记录冲突；保留原记录，不接管。':record?.enabled&&!bound?'旧确认与当前实物不符，请先明确撤回。':undefined);
 const denied=chargedItemSpellAuthorityReason(c,authority,[record?.poolKey||pool?.key||keyFor(ownerId)]),eligible=!!s&&!reason,active=eligible&&bound&&record?.enabled===true;
 const grants:ChargedItemSpellGrant[]=rule?[{key:rule.branch.key,targetEntryId:rule.target.id,targetName:rule.target.name,targetScope:rule.branch.targetScope,sourceActionTiming:rule.branch.sourceActionTiming,castLevel:rule.branch.castLevel,cost:1,minAfter:rule.branch.minAfter,statistics:structuredClone(rule.branch.statistics)}]:[];
 const basis=chargedItemSpellSourceSnapshot([c.id,c.revision,c.edition,c.profile,c.automation?.enabled,s,owner,rule?.policySha256,target,pool?.record,pool&&c.runtime.resources[pool.key]]);
 return {ownerId,key:JSON.stringify(['item-charged',ownerId]),label:owner?.entry.name||record?.canonicalEntryId||'保留的物品付费施法',eligible,active,canConfirm:eligible&&!denied&&!active,canWithdraw:!!s&&!!record?.enabled&&!!storedRule(record)&&!denied,reason:denied||reason||(!active?'尚未明确确认当前实物的付费施法来源。':undefined),basis,nonce:record?.nonce||0,requiresAttunement:rule?.requiresAttunement===true,grants,record};
}
export function chargedItemSpellOffers(c:Character,catalog:Entry[]=[],authority?:SpellActionAuthority){const ids=new Set([...c.selections.filter(row=>!!chargedItemSpellFamilyId(row.entry)).map(row=>row.id),...(state(c)?.records.map(r=>r.ownerId)||[])]);return [...ids].map(id=>chargedItemSpellOffer(c,id,catalog,authority));}
export function chargedItemSpellObservedIntent(c:Character,ownerId:string){const record=state(c)?.records.find(r=>r.ownerId===ownerId),rule=storedRule(record);if(!record||!rule)return;const owners=c.selections.filter(row=>row.id===ownerId);if(owners.length>1||owners.length===1&&(owners[0].entry.id!==record.entryId||chargedItemSpellRule(owners[0].entry)?.id!==rule.id))return;return record;}
export function setChargedItemSpellIntent(c:Character,ownerId:string,intent:{confirmedGenuineOwnedItem:true}|null,catalog:Entry[]=[],authority?:SpellActionAuthority):void{
 const s=state(c),record=s?.records.find(r=>r.ownerId===ownerId),issue=chargedItemSpellAuthorityReason(c,authority,[record?.poolKey||keyFor(ownerId)]);if(issue)throw Error(issue);if(!s||!c.automation)throw Error(chargedItemSpellStateIssue(c)||'确认历史不可用。');
 if(intent!==null&&(!own(intent,['confirmedGenuineOwnedItem'])||intent.confirmedGenuineOwnedItem!==true))throw Error('必须明确确认本次真实持有的物品来源。');const offer=chargedItemSpellOffer(c,ownerId,catalog,authority);
 if(intent===null){if(!record?.enabled)return;if(!offer.canWithdraw)throw Error(offer.reason||'旧确认无法核实；保留原数据。');}else{if(offer.active)return;if(!offer.canConfirm)throw Error(offer.reason||'当前物品来源不能确认。');}
 if(s.sequence>=Number.MAX_SAFE_INTEGER)throw Error('物品施法确认序号已达到上限。');const next=structuredClone(s);next.sequence++;const previous=next.records.find(r=>r.ownerId===ownerId);
 if(intent===null){previous!.enabled=false;previous!.nonce=next.sequence;}else{const owner=currentOwner(c,ownerId)!,rule=chargedItemSpellRule(owner.entry)!,r:ChargedItemSpellRecord={ownerId,entryId:owner.entry.id,canonicalEntryId:rule.id,snapshotSha256:rule.fullNormalizedSnapshotSha256,poolKey:keyFor(ownerId),policySha256:rule.policySha256,enabled:true,nonce:next.sequence};if(previous)Object.assign(previous,r);else next.records.push(r);}
 c.automation.chargedItemSpells=next;
}
export function revokeChargedItemSpellOwners(c:Character,removed:ReadonlySet<string>){const s=state(c);if(!s||!c.automation)return;const next=structuredClone(s);let changed=false;for(const r of next.records)if(removed.has(r.ownerId)&&r.enabled&&storedRule(r)){if(next.sequence>=Number.MAX_SAFE_INTEGER)throw Error('物品施法确认序号已达到上限。');r.enabled=false;r.nonce=++next.sequence;changed=true;}if(changed)c.automation.chargedItemSpells=next;}
export function chargedItemSpellConfig(rule:ChargedItemSpellRule,record:ChargedItemSpellRecord,active:boolean,reason?:string):SpecialSpell{return {mode:'locked',label:'已核实的物品付费施法',sourceGrant:{ownerId:record.ownerId,key:chargedItemSpellChildKey(rule),active,usage:'check',canUseSlots:false,itemChargedSpell:marker(rule,record.nonce),...(reason?{reason}:{})}};}
export function chargedItemSpellReserved(c:Character,id:string,paymentId?:string){const row=c.selections.find(row=>row.id===id),g=c.spellSettings?.special?.[id]?.sourceGrant;return paymentId==='item-charge'||chargedItemSpellGrantKey(row?.grantKey)||chargedItemSpellGrantKey(g?.key)||g?.itemChargedSpell!==undefined;}
/** Low-level authentication deliberately never calls plan/enabled/payments. */
export function chargedItemSpellBinding(c:Character,id:string){
 const rows=c.selections.filter(row=>row.id===id),row=rows.length===1?rows[0]:undefined,g=c.spellSettings?.special?.[id]?.sourceGrant,record=state(c)?.records.find(r=>r.ownerId===row?.parentId),owner=record&&currentOwner(c,record.ownerId),rule=owner&&chargedItemSpellRule(owner.entry);
 if(!row||!g||g.active!==true||!record?.enabled||!rule||!cachedChild(c,row,rule,record,true)||ownerReason(c,owner,rule)||!sourceAllowed(c,row.entry,rule.target.id)||record.entryId!==owner!.entry.id||record.canonicalEntryId!==rule.id||record.snapshotSha256!==rule.fullNormalizedSnapshotSha256||record.policySha256!==rule.policySha256)return;
 const pool=poolBinding(c,record.ownerId,rule,owner);if(!pool||pool.record.withdrawn||record.poolKey!==pool.key)return;return {row,config:c.spellSettings!.special![id],record,owner:owner!,rule,pool};
}
export function chargedItemSpellBasis(c:Character,id:string){const current=chargedItemSpellBinding(c,id);return chargedItemSpellSourceSnapshot([c.id,c.revision,c.edition,c.profile,c.automation,c.runtime.itemChargeDebits,c.runtime.automationActions,current?.rule.policySha256,current?.row,current?.config,current?.pool&&c.runtime.resources[current.pool.key]]);}
export function chargedItemSpellPayment(c:Character,id:string,authority?:SpellActionAuthority):SpellPayment|undefined{
 const current=chargedItemSpellBinding(c,id);if(!current)return;const {rule,pool}=current,actions=c.runtime.automationActions,issue=chargedItemSpellAuthorityReason(c,authority,[pool.key])||(actions&&actions.version!==1||actions?.last?.itemChargedSpell&&actions.last.itemChargedSpell.version!==1?'动作历史版本尚未支持；保持只读。':undefined),available=!issue&&pool.remaining-1>=rule.branch.minAfter;
 return {id:'item-charge',label:`物品充能（消耗1；${pool.remaining} / ${rule.capacity}）`,level:rule.branch.castLevel,resourceId:pool.key,cost:1,available,targetEntryId:rule.target.id,targetScope:rule.branch.targetScope,sourceActionTiming:rule.branch.sourceActionTiming,statistics:structuredClone(rule.branch.statistics),...(!available?{reason:issue||(rule.branch.minAfter?'须保留至少1充能；末次耗尽尚未支持。':'物品充能不足；不会改用法术位。')}:{})};
}
export function chargedItemSpellStatistics(c:Character,id:string){return chargedItemSpellBinding(c,id)?.rule.branch.statistics;}
export const chargedItemSpellDebitId=(requestId:string,selectionId:string,branchKey:string,policySha256:string)=>sourceTextSha256(JSON.stringify(['charged-item-spell',requestId,selectionId,branchKey,policySha256]));
const chargedFingerprint=(q:SpellActionRequest)=>JSON.stringify([q.revision,q.selectionId,q.mode,q.paymentId,q.basis,q.targetScope,q.sourceActionTiming,q.chargedItemIntent]);
/** Observation authenticates BOTH actual receipts, not availability or current
 * activation: legitimate withdrawal/last-charge after payment still ACKs. */
export function chargedItemSpellBoundCastReceipt(c:Character,id:string,requestId?:string):SpellActionReceipt|undefined{
 const actions=c.runtime.automationActions,last=actions?.last,m=last?.itemChargedSpell,s=state(c);if(!actions||actions.version!==1||!last||!own(last,['id','sequence','fingerprint','selectionId','mode','level','resourceId','before','after','itemChargedSpell'])||last.selectionId!==id||requestId!==undefined&&last.id!==requestId||last.mode!=='cast'||last.sequence!==actions.sequence-1||!m)return;try{validateChargedItemSpellCastMarker(m);}catch{return;}if(m.version!==1)return;
 const record=s?.records.find(r=>r.ownerId===m.ownerId),rule=storedRule(record),rows=c.selections.filter(row=>row.id===id),row=rows.length===1?rows[0]:undefined,owner=record&&currentOwner(c,record.ownerId);
 if(!record||!rule||!row||!cachedChild(c,row,rule,record)||owner&&chargedItemSpellRule(owner.entry)?.id!==rule.id||!integer(m.nonce,1,record.nonce)||!markerMatches(Object.fromEntries(markerKeys.map(k=>[k,m[k]])),rule,record)||m.branchKey!==rule.branch.key||m.chargeEventId!==chargedItemSpellDebitId(last.id,id,rule.branch.key,rule.policySha256))return;
 const pool=poolBinding(c,record.ownerId,rule,owner),event=pool?.record.events.find(e=>e.id===m.chargeEventId);if(!pool||!event||event.kind!=='debit'||event.actionKey!==rule.branch.key||event.units!==undefined||event.before-event.after!==1||event.after<rule.branch.minAfter||last.resourceId!==pool.key||last.before!==event.before||last.after!==event.after||last.level!==rule.branch.castLevel||!same(m.chargeReceipt,{...event,key:pool.key,fingerprint:m.chargeFingerprint}))return;
 try{const fp=JSON.parse(last.fingerprint);if(!Array.isArray(fp)||fp.length!==8||!integer(fp[0])||fp[1]!==id||fp[2]!=='cast'||fp[3]!=='item-charge'||fp[4]!==m.castBasis||fp[5]!==rule.branch.targetScope||fp[6]!==rule.branch.sourceActionTiming||!own(fp[7],['confirmedCurrentItemCastValid'])||fp[7].confirmedCurrentItemCastValid!==true)return;}catch{return;}
 return last;
}
/** Narrow paid route. A fresh cast may never adopt an inner duplicate/no-op.
 * The entire independently checked charge-only candidate commits once together
 * with its cast receipt; generic owned-pool payment remains prohibited. */
export function performChargedItemSpellAction(c:Character,q:SpellActionRequest,authority?:SpellActionAuthority):SpellActionResult{
 const reject=(message:string):SpellActionResult=>({status:'rejected',message}),issue=chargedItemSpellAuthorityReason(c,authority);if(issue)return reject(issue);
 if(!plain(q))return reject('物品施法请求无效。');
 const current=chargedItemSpellBinding(c,q.selectionId);if(!current)return reject('物品付费施法来源、确认、目标或物理充能归属尚未核实。');const {record,rule,pool}=current,locked=chargedItemSpellAuthorityReason(c,authority,[pool.key]);if(locked)return reject(locked);
 if(!text(q.id,128)||!integer(q.sequence)||!integer(q.revision)||q.mode!=='cast'||q.paymentId!=='item-charge'||q.casterId!==undefined||q.rest!==undefined||q.limitedIntent!==undefined||!own(q.chargedItemIntent,['confirmedCurrentItemCastValid'])||q.chargedItemIntent.confirmedCurrentItemCastValid!==true||q.targetScope!==rule.branch.targetScope||q.sourceActionTiming!==rule.branch.sourceActionTiming||!sha(q.basis))return reject('请逐次核对当前实物、限定目标、来源动作与物品施法条件。');
 const actions=c.runtime.automationActions;if(actions&&actions.version!==1||actions?.last?.itemChargedSpell&&actions.last.itemChargedSpell.version!==1)return reject('动作历史版本尚未支持；未覆盖旧记录。');const fingerprint=chargedFingerprint(q);
 if(actions?.last?.id===q.id){const observed=chargedItemSpellBoundCastReceipt(c,q.selectionId,q.id);return observed&&observed.sequence===q.sequence&&observed.fingerprint===fingerprint&&observed.itemChargedSpell?.nonce===record.nonce?{status:'duplicate',receipt:observed,message:'此物品施法与充能扣费已共同记录，未重复支付。'}:reject('旧施法与充能回执不能同时核实；未采用旧付款。');}
 const sequence=actions?.sequence??0;if(q.sequence!==sequence||q.revision!==c.revision||q.basis!==chargedItemSpellBasis(c,q.selectionId)||sequence>=Number.MAX_SAFE_INTEGER)return reject('物品、法术、确认、余额或卡面已变化，请重新操作。');const payment=chargedItemSpellPayment(c,q.selectionId,authority);if(!payment?.available)return reject(payment?.reason||'当前来源不能支付本次施法。');
 try{
  const candidate=structuredClone(c),chargeId=chargedItemSpellDebitId(q.id,q.selectionId,rule.branch.key,rule.policySha256),chargeRequest=itemChargeRequest(candidate,record.ownerId,chargeId,{kind:'debit',actionKey:rule.branch.key}),paid=performItemChargeAction(candidate,chargeRequest,authority);if(paid.status!=='applied')return reject('本次必须产生全新的物品充能支出；未采用重复或无操作付款。');
  const expected=structuredClone(c),ledger=expected.runtime.itemChargeDebits!,r=ledger.records.find(r=>r.ownerId===record.ownerId)!;const event={id:chargeId,kind:'debit' as const,actionKey:rule.branch.key,before:pool.remaining,after:pool.remaining-1,sequence:ledger.sequence},chargeFingerprint=sourceTextSha256(JSON.stringify([chargeRequest.ownerId,chargeRequest.revision,chargeRequest.basis,chargeRequest.intent]));r.spent++;r.events.push(event);ledger.sequence++;ledger.last={...event,key:pool.key,fingerprint:chargeFingerprint};expected.runtime.resources[pool.key].current=event.after;
  if(!same(candidate,expected)||!same(paid.receipt,ledger.last))return reject('充能动作未产生唯一且完整的已核实支出；整笔未提交。');
  const receipt:SpellActionReceipt={id:q.id,sequence,fingerprint,selectionId:q.selectionId,mode:'cast',level:rule.branch.castLevel,resourceId:pool.key,before:pool.remaining,after:pool.remaining-1,itemChargedSpell:{...marker(rule,record.nonce),ownerId:record.ownerId,chargeEventId:chargeId,chargeFingerprint,chargeReceipt:structuredClone(paid.receipt),castBasis:q.basis}};
  candidate.runtime.automationActions={version:1,sequence:sequence+1,last:receipt};c.runtime=candidate.runtime;
  return {status:'applied',receipt,message:'已共同记录来源限定施法与1充能支出；法术效果、动作经济和恢复仍需人工处理。'};
 }catch{return reject('物品付款事务未完成；未提交充能或施法记录。');}
}
