import type {Character,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {armorType} from './equipment';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './itemAffineHpEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type ItemAffineHpRule=typeof evidence.rules[number];
export type ItemAffineHpSourceCondition='attuned-only'|'worn-and-attuned';
export interface ItemAffineHpAuthority {canEdit:boolean;gm:boolean}
export type ItemAffineHpIntent={kind:'confirm';confirmedManualHpExcluded:true}|{kind:'withdraw'};
export interface ItemAffineHpRequest {namespace:'item-affine-hp';id:string;cardId:string;selectionId:string;sequence:number;revision:number;basis:string;intent:ItemAffineHpIntent}
export interface ItemAffineHpReceipt {id:string;sequence:number;selectionId:string;kind:'confirm'|'withdraw';fingerprint:string}
interface Binding {selectionId:string;canonicalEntryId:string;entryId:string;identityBasis:string;manualBasis:string}
interface Event {request:ItemAffineHpRequest;fingerprint:string;binding:Binding}
export interface ItemAffineHpRecord extends Binding {withdrawn:boolean;events:Event[]}
interface Store {version:1;sequence:number;records:ItemAffineHpRecord[];last?:ItemAffineHpReceipt}
export interface ItemAffineHpOffer {selectionId:string;entryId:string;canonicalEntryId:string;name:string;source:string;sourceCondition:ItemAffineHpSourceCondition;constant:number;perCharacterLevel:1;level?:number;bonus?:number;eligible:boolean;active:boolean;confirmed:boolean;withdrawn:boolean;canConfirm:boolean;canWithdraw:boolean;reason?:string;basis:string;sequence:number;record?:ItemAffineHpRecord}
export type ItemAffineHpActionResult={status:'applied';receipt:ItemAffineHpReceipt;message:string}|{status:'rejected';message:string};
export interface ItemAffineHpGrant {selectionId:string;entryId:string;source:string;sourceCondition:ItemAffineHpSourceCondition;constant:number;perCharacterLevel:1;level:number;bonus:number;acknowledgementSequence:number}
export interface ItemAffineHpProjection {bonus:number;trace:string[];issues:Issue[];grants:ItemAffineHpGrant[]}
export const ITEM_AFFINE_HP_ANSWER_KEY='item-affine-hp:acknowledgements';
const roots=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const text=(value:unknown,max=2000):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max&&!value.includes('\0');
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const keys=(value:Record<string,any>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key))&&allowed.every(key=>Object.hasOwn(value,key));
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const itemAffineHpSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));
const same=(a:unknown,b:unknown)=>itemAffineHpSnapshot(a)===itemAffineHpSnapshot(b);

/** Recognition reserves only a reviewed source domain. It cannot grant HP and
 * never captures a genuine CUSTOM same-name entry. Complete source fingerprints
 * independently authenticate canonical and actual cold-App forms below. */
export function itemAffineHpFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;
 const exact=roots.get(entry.id);if(exact)return exact.id;
 if(canonical.has(entry.id)||!object(entry.raw))return;
 const matches=evidence.rules.filter(rule=>entry.kind==='item'&&entry.packId===rule.packId&&entry.source===rule.source&&entry.edition===rule.edition&&entry.name===rule.name&&entry.english===rule.english&&(entry.page??null)===rule.page&&entry.raw._category===rule.category&&(entry.raw._variantIdentity??null)===rule.variantIdentity&&(entry.raw.baseItem??null)===rule.baseItem&&(entry.raw.type??null)===rule.type);
 return matches.length===1?matches[0].id:undefined;
}
export function itemAffineHpIdentity(entry:Entry):boolean{return !!itemAffineHpFamilyId(entry);}
function rootFamily(entry:Entry):ItemAffineHpRule|undefined{const id=itemAffineHpFamilyId(entry);return id?roots.get(id):undefined;}
function complete(entry:Entry,rule:ItemAffineHpRule):boolean{
 if(!entry||entry.kind!=='item'||!text(entry.id)||!text(entry.revision,4000)||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!object(entry.raw)||entry.raw._category!==rule.category||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._unresolvedVariant||entry.raw._versionBaseName||entry.raw.reqAttune!==true||(entry.raw._variantIdentity??null)!==rule.variantIdentity||(entry.raw.baseItem??null)!==rule.baseItem||(entry.raw.type??null)!==rule.type)return false;
 try{return rule.forms.some(form=>form.canonicalReboundSnapshotSha256===itemAffineHpSnapshot({...entry,id:rule.id,revision:rule.revision}));}catch{return false;}
}
export function itemAffineHpRule(entry:Entry):ItemAffineHpRule|undefined{const rule=rootFamily(entry);return rule&&complete(entry,rule)?rule:undefined;}
/** Bounded legacy exclusion for this exact source family only. It does not
 * suppress CUSTOM or unrelated generic item HP effects by names or numeric tags. */
export function itemAffineHpLegacyHpSelection(c:Character,row:Selection):boolean{return c.selections.includes(row)&&itemAffineHpIdentity(row.entry);}
function available(c:Character,entry:Entry,rule:ItemAffineHpRule){return !c.profile.disabledEntries?.some(id=>id===entry.id||id===rule.id)&&[entry.source,...(entry.dependencies||[])].every(source=>c.profile.enabledSources.includes(source));}

/** Only HP-related manual inputs. Level growth, current/temp HP, resource
 * balances, permissions, locks and unrelated edits are intentionally excluded. */
export function itemAffineHpManualBasis(c:Character):string{
 const effects=c.selections.flatMap(row=>{const hp=(row.entry.effects||[]).filter(effect=>effect.op!=='proficiency'&&effect.target==='hp');return hp.length?[{selectionId:row.id,parentId:row.parentId??null,entryId:row.entry.id,source:row.entry.source,packId:row.entry.packId,effects:hp}]:[];});
 return itemAffineHpSnapshot([c.baseHp,c.sheetBonuses?.hp,c.adjustments?.filter(row=>row.target==='hp'),c.hpProgression,effects]);
}
function mutationReason(c:Character,authority?:ItemAffineHpAuthority):string|undefined{
 if(!object(authority)||!Object.hasOwn(authority,'canEdit')||!Object.hasOwn(authority,'gm')||typeof Object.getOwnPropertyDescriptor(authority,'canEdit')?.value!=='boolean'||typeof Object.getOwnPropertyDescriptor(authority,'gm')?.value!=='boolean'||authority.canEdit!==true)return '当前实际编辑／主持人权限缺失或无效，未修改确认记录。';
 if(c.locked!==undefined&&typeof c.locked!=='boolean'||c.locked===true&&authority.gm!==true)return '当前角色卡已锁定，需要实际主持人权限才能修改确认记录。';
}
function validIntent(value:unknown):value is ItemAffineHpIntent{return object(value)&&(value.kind==='confirm'&&keys(value,['kind','confirmedManualHpExcluded'])&&value.confirmedManualHpExcluded===true||value.kind==='withdraw'&&keys(value,['kind']));}
function validRequest(value:unknown):value is ItemAffineHpRequest{return object(value)&&keys(value,['namespace','id','cardId','selectionId','sequence','revision','basis','intent'])&&value.namespace==='item-affine-hp'&&text(value.id,128)&&text(value.cardId)&&text(value.selectionId)&&integer(value.sequence)&&integer(value.revision)&&hash(value.basis)&&validIntent(value.intent);}
export function itemAffineHpRequestFingerprint(request:ItemAffineHpRequest):string{return itemAffineHpSnapshot(request);}
function validBinding(value:unknown):value is Binding{return object(value)&&keys(value,['selectionId','canonicalEntryId','entryId','identityBasis','manualBasis'])&&text(value.selectionId)&&text(value.canonicalEntryId)&&roots.has(value.canonicalEntryId)&&text(value.entryId)&&(!(value.entryId!==value.canonicalEntryId&&canonical.has(value.entryId)))&&hash(value.identityBasis)&&hash(value.manualBasis);}
function validateStore(value:unknown,cardId:string):asserts value is Store{
 if(!object(value)||value.version!==1||!integer(value.sequence,0,1000)||!Array.isArray(value.records)||value.records.length>100||Object.keys(value).some(key=>!['version','sequence','records','last'].includes(key)))throw Error('物品生命值来源确认记录结构无效。');
 const ids=new Set<string>(),sequences=new Set<number>(),owners=new Set<string>();let latest:ItemAffineHpReceipt|undefined;
 for(const record of value.records){
  if(!object(record)||Object.keys(record).some(key=>!['selectionId','canonicalEntryId','entryId','identityBasis','manualBasis','withdrawn','events'].includes(key))||!validBinding({selectionId:record.selectionId,canonicalEntryId:record.canonicalEntryId,entryId:record.entryId,identityBasis:record.identityBasis,manualBasis:record.manualBasis})||typeof record.withdrawn!=='boolean'||!Array.isArray(record.events)||record.events.length<1||record.events.length>1000||owners.has(record.selectionId))throw Error('物品生命值来源确认归属无效。');
  owners.add(record.selectionId);let binding:Binding|undefined,withdrawn=false,prior=-1;
  for(const event of record.events){
   if(!object(event)||!keys(event,['request','fingerprint','binding'])||!validRequest(event.request)||event.request.cardId!==cardId||!validBinding(event.binding)||event.binding.selectionId!==record.selectionId||event.binding.canonicalEntryId!==record.canonicalEntryId||event.request.selectionId!==record.selectionId||event.request.sequence<=prior||ids.has(event.request.id)||sequences.has(event.request.sequence)||event.fingerprint!==itemAffineHpRequestFingerprint(event.request)||event.request.intent.kind==='withdraw'&&(!binding||withdrawn||!same(binding,event.binding))||event.request.intent.kind==='confirm'&&binding&&!withdrawn&&same(binding,event.binding))throw Error('物品生命值来源确认历史无效。');
   ids.add(event.request.id);sequences.add(event.request.sequence);prior=event.request.sequence;
   if(event.request.intent.kind==='confirm'){binding=event.binding;withdrawn=false;}else withdrawn=true;
   const receipt={id:event.request.id,sequence:event.request.sequence,selectionId:record.selectionId,kind:event.request.intent.kind,fingerprint:event.fingerprint};if(!latest||receipt.sequence>latest.sequence)latest=receipt;
  }
  if(!binding||!same(binding,{selectionId:record.selectionId,canonicalEntryId:record.canonicalEntryId,entryId:record.entryId,identityBasis:record.identityBasis,manualBasis:record.manualBasis})||withdrawn!==record.withdrawn)throw Error('物品生命值来源确认历史与当前记录不一致。');
 }
 if(sequences.size!==value.sequence||[...sequences].some(sequence=>sequence>=value.sequence)||value.sequence===0&&(value.records.length||value.last!==undefined)||value.sequence>0&&(!latest||!object(value.last)||!keys(value.last,['id','sequence','selectionId','kind','fingerprint'])||!same(value.last,latest)))throw Error('物品生命值来源确认序号或回执无效。');
}
function saved(c:Character):{store?:Store;reason?:string}{
 const raw=c.answers[ITEM_AFFINE_HP_ANSWER_KEY];if(raw===undefined)return{store:{version:1,sequence:0,records:[]}};
 if(!Array.isArray(raw)||raw.length!==1||typeof raw[0]!=='string'||raw[0].length>400000)return{reason:'物品生命值来源确认记录无效，原数据保留且只读。'};
 try{const value=JSON.parse(raw[0]);if(object(value)&&integer(value.version,2))return{reason:'物品生命值来源确认版本尚未支持，原数据保留且只读。'};validateStore(value,c.id);return{store:value};}catch{return{reason:'物品生命值来源确认记录无效，原数据保留且只读。'};}
}
type Current={rule?:ItemAffineHpRule;row?:Selection;level?:number;bonus?:number;binding?:Binding;reason?:string};
/** Source ownership and loadout checks are independent from acknowledgement.
 * They are also used to find CURRENT-ELIGIBLE overlapping effects: an unattuned,
 * unavailable or otherwise invalid stored copy cannot cancel a valid owner. */
function ownerReason(c:Character,row:Selection,rule:ItemAffineHpRule,live:readonly Selection[]):string|undefined{
 if(c.selections.filter(candidate=>candidate.id===row.id).length!==1||!Object.hasOwn(row,'id')||!text(row.id)||Object.getOwnPropertyDescriptor(row,'quantity')?.value!==1||row.parentId!==undefined||row.grantKey!==undefined||row.requirementId!==undefined||row.quantity!==1||!live.includes(row))return '物品不是唯一有效的单件实物根记录，或当前归属未生效；数量不明确时保守暂停，不按数量复制加值。';
 if(!complete(row.entry,rule))return '物品完整来源、基础／模板合成、身份、版本或条款快照未通过核对。';
 if(!available(c,row.entry,rule))return '具体物品来源、实际依赖或规范／实例身份已停用；原物品和确认保留。';
 if(!Object.hasOwn(row,'attuned')||Object.getOwnPropertyDescriptor(row,'attuned')?.value!==true)return '此来源分支需要当前明确同调；未满足时不计物品生命值。';
 if(rule.sourceCondition==='worn-and-attuned'){
  if(!Object.hasOwn(row,'equipped')||Object.getOwnPropertyDescriptor(row,'equipped')?.value!==true||armorType(row.entry)!=='HA')return '此已核实来源分支需要当前明确穿戴且同调的重甲；未满足时不计物品生命值。';
  // Same live/equipped/positive-quantity armor-slot predicate as the existing
  // armor evaluator. A caller-provided subset cannot hide another worn armor.
  if(live.filter(other=>other.equipped&&other.quantity>0&&!!armorType(other.entry)&&armorType(other.entry)!=='S').length!==1)return '当前护甲槽存在穿戴冲突；暂停此物品生命值，不改写装备状态。';
 }
}
function current(c:Character,selectionId:string,providedActive?:readonly Selection[]):Current{
 const rows=c.selections.filter(row=>row.id===selectionId),row=rows[0],rule=row&&rootFamily(row.entry),out:Current={row,rule},hold=(reason:string)=>({...out,reason});
 if(rows.length!==1||!row||!rule)return hold('当前没有唯一可核对的完整实物来源根记录。');
 if(!automationEnabled(c))return hold('自动化关闭或协议未知，物品生命值暂停。');
 const live=activeEffectSelections(c),reason=ownerReason(c,row,rule,live);if(reason)return hold(reason);
 if(providedActive&&!providedActive.includes(row))return hold('外部列表不是当前真实来源归属，或未包含该实物；未授予物品生命值。');
 const overlaps=c.selections.filter(other=>{const candidate=itemAffineHpRule(other.entry);return candidate?.effectCohort===rule.effectCohort&&!ownerReason(c,other,candidate,live);});
 if(overlaps.length!==1)return hold('多个当前有效同类物品效果的叠加政策尚未核实；该重叠组暂停，不猜测相加或取最大值。');
 const classes=c.selections.filter(candidate=>candidate.entry.kind==='class'),classIds=new Set<string>(),classIdentities=new Set<string>();
 if(!classes.length||classes.some(candidate=>{
  const entry=candidate.entry,identity=itemAffineHpSnapshot([entry.packId,entry.source,entry.edition,entry.english||entry.name,entry.raw?._category??null]),invalid=!text(candidate.id)||!text(entry.id)||classIds.has(entry.id)||classIdentities.has(identity)||candidate.parentId!==undefined||candidate.grantKey!==undefined||candidate.requirementId!==undefined||!integer(candidate.level,1,20)||!live.includes(candidate)||providedActive&&!providedActive.includes(candidate);classIds.add(entry.id);classIdentities.add(identity);return invalid;
 }))return hold('角色总等级没有唯一、当前有效且数值明确的根职业，未猜测角色等级。');
 const level=classes.reduce((sum,candidate)=>sum+candidate.level,0);if(!integer(level,1,20))return hold('角色总等级超出已支持的 1–20 范围，未计算物品加值。');
 if(c.adjustments?.some(adjustment=>adjustment.target==='hp'&&typeof adjustment.reason==='string'&&!!adjustment.reason.trim()))return hold('已有手工最终生命值覆盖；新的物品加值暂缓，不猜测是否应加在最终值之上。');
 // Level/loadout/source switches are live preconditions, not a newly fabricated
 // consent. The independently stored binding remains exact physical owner +
 // complete source snapshot + manual HP basis, with no other consent namespace.
 const identity=[c.id,row.id,row.entry.id,row.entry.revision,rule.id,itemAffineHpSnapshot({...row.entry,id:rule.id,revision:rule.revision})];
 const binding:Binding={selectionId:row.id,canonicalEntryId:rule.id,entryId:row.entry.id,identityBasis:itemAffineHpSnapshot(identity),manualBasis:itemAffineHpManualBasis(c)};
 return{...out,level,bonus:rule.constant+level*rule.perCharacterLevel,binding};
}
export function itemAffineHpOffers(c:Character,authority?:ItemAffineHpAuthority,providedActive?:readonly Selection[]):ItemAffineHpOffer[]{
 const state=saved(c),store=state.store,records=store?.records||[],ids=[...new Set([...c.selections.filter(row=>rootFamily(row.entry)).map(row=>row.id),...records.map(record=>record.selectionId)])],permission=mutationReason(c,authority);
 return ids.map(selectionId=>{
  const value=current(c,selectionId,providedActive),record=records.find(record=>record.selectionId===selectionId),rule=value.rule||record&&roots.get(record.canonicalEntryId),withdrawn=record?.withdrawn===true,confirmed=!!record&&!withdrawn,identityChanged=!!record&&!!rule&&record.canonicalEntryId!==rule.id;
  const eligible=!!value.binding&&!identityChanged,active=!!store&&eligible&&confirmed&&same(value.binding,{selectionId:record!.selectionId,canonicalEntryId:record!.canonicalEntryId,entryId:record!.entryId,identityBasis:record!.identityBasis,manualBasis:record!.manualBasis});
  const reason=state.reason||value.reason||(identityChanged?'同实例来源身份已更换；旧确认保留，请使用正常替换入口重新核对。':withdrawn?'本来源确认已明确撤回；重开或重选不会自动确认。':!record?'尚未明确确认此来源未计入手工生命值。':!active?'来源归属或手工生命值输入已变化，请重新核对并明确确认。':undefined);
  const basis=itemAffineHpSnapshot([c.id,c.revision,selectionId,value.binding??null,value.level??null,value.reason??null,itemAffineHpManualBasis(c),c.selections.map(row=>[row.id,row.parentId??null,row.grantKey??null,row.requirementId??null,row.level,row.quantity,row.equipped,row.attuned??null,itemAffineHpSnapshot(row.entry)]),store??state.reason]);
  return{selectionId,entryId:value.row?.entry.id||record?.entryId||'',canonicalEntryId:rule?.id||record?.canonicalEntryId||'',name:value.row?.entry.name||rule?.name||'保留的物品生命值来源',source:value.row?.entry.source||rule?.source||'',sourceCondition:(rule?.sourceCondition||'attuned-only')as ItemAffineHpSourceCondition,constant:rule?.constant??0,perCharacterLevel:1,level:value.level,bonus:value.bonus,eligible:!!store&&eligible,active,confirmed,withdrawn,canConfirm:!!store&&!permission&&eligible&&!active&&store.sequence<1000,canWithdraw:!!store&&!permission&&!!record&&!withdrawn&&store.sequence<1000,reason:reason||permission,basis,sequence:store?.sequence??0,record};
 });
}
export function itemAffineHpOffer(c:Character,selectionId:string,authority?:ItemAffineHpAuthority):ItemAffineHpOffer|undefined{const matches=itemAffineHpOffers(c,authority).filter(offer=>offer.selectionId===selectionId);return matches.length===1?matches[0]:undefined;}
export function itemAffineHpRequest(c:Character,selectionId:string,id:string,intent:ItemAffineHpIntent):ItemAffineHpRequest{
 const offer=itemAffineHpOffer(c,selectionId);if(!offer||!validIntent(intent)||!text(id,128))throw Error('当前来源确认请求无法核对。');return{namespace:'item-affine-hp',id,cardId:c.id,selectionId,sequence:offer.sequence,revision:c.revision,basis:offer.basis,intent:structuredClone(intent)};
}
export function itemAffineHpReceipt(c:Character,id:string):ItemAffineHpReceipt|undefined{
 const state=saved(c),last=state.store?.last;if(!last||last.id!==id)return;const event=state.store!.records.flatMap(record=>record.events).find(event=>event.request.id===id);if(event?.request.cardId===c.id&&event.request.sequence===last.sequence&&event.request.selectionId===last.selectionId&&event.request.intent.kind===last.kind&&itemAffineHpRequestFingerprint(event.request)===last.fingerprint)return{...last};
}
/** Only this explicitly authorized action writes the owned answer namespace.
 * It never writes source/manual fields, current/temp HP, rolls or resources. */
export function performItemAffineHpAction(c:Character,request:ItemAffineHpRequest,authority?:ItemAffineHpAuthority):ItemAffineHpActionResult{
 const rejected=(message:string):ItemAffineHpActionResult=>({status:'rejected',message}),permission=mutationReason(c,authority);if(permission)return rejected(permission);
 if(!validRequest(request))return rejected('来源确认请求结构无效，未修改。');const state=saved(c),store=state.store;if(!store)return rejected(state.reason!);
 if(request.cardId!==c.id||request.revision!==c.revision||request.sequence!==store.sequence||store.records.some(record=>record.events.some(event=>event.request.id===request.id)))return rejected('请求已过期或重复，未再次执行。');
 const offer=itemAffineHpOffer(c,request.selectionId,authority);if(!offer||offer.basis!==request.basis)return rejected('来源归属、手工生命值输入或确认基线已变化，未执行。');
 if(request.intent.kind==='confirm'?!offer.canConfirm:!offer.canWithdraw)return rejected(offer.reason||'本来源当前不能执行该确认操作。');
 const prior=store.records.find(record=>record.selectionId===request.selectionId),value=current(c,request.selectionId),binding=request.intent.kind==='confirm'?value.binding:prior&&{selectionId:prior.selectionId,canonicalEntryId:prior.canonicalEntryId,entryId:prior.entryId,identityBasis:prior.identityBasis,manualBasis:prior.manualBasis};if(!binding)return rejected('当前来源确认绑定无效，未执行。');
 const fingerprint=itemAffineHpRequestFingerprint(request),event:Event={request:structuredClone(request),fingerprint,binding:{...binding}},record:ItemAffineHpRecord={...binding,withdrawn:request.intent.kind==='withdraw',events:[...(prior?.events||[]),event]},receipt:ItemAffineHpReceipt={id:request.id,sequence:request.sequence,selectionId:request.selectionId,kind:request.intent.kind,fingerprint},next:Store={version:1,sequence:store.sequence+1,records:[...store.records.filter(record=>record.selectionId!==request.selectionId),record],last:receipt};
 try{validateStore(next,c.id);}catch{return rejected('来源确认历史不一致，原记录保留。');}
 const encoded=JSON.stringify(next);if(encoded.length>400000)return rejected('确认记录已达到可安全读取的大小上限，原记录保留。');
 c.answers={...c.answers,[ITEM_AFFINE_HP_ANSWER_KEY]:[encoded]};return{status:'applied',receipt,message:request.intent.kind==='confirm'?'已记录当前明确确认；只投影生命值上限，不恢复生命值。':'已明确撤回本来源确认；历史与当前生命值、资源保留。'};
}
export function projectItemAffineHp(c:Character,providedActive?:readonly Selection[]):ItemAffineHpProjection{
 const out:ItemAffineHpProjection={bonus:0,trace:[],issues:[],grants:[]},offers=itemAffineHpOffers(c,undefined,providedActive);
 if(!offers.length){const reason=saved(c).reason;if(reason){const message=`${reason} 当前没有可核对的来源根记录；原确认数据、生命值和资源保留。`;out.trace.push(message);out.issues.push({id:'item-affine-hp:state',severity:'warning',message});}}
 for(const offer of offers){
  if(!offer.active||offer.level===undefined||offer.bonus===undefined){const message=`${offer.name}：${offer.reason||'当前来源确认未生效。'} 当前／临时生命值、手工最终值和资源保留。`;out.trace.push(message);out.issues.push({id:`item-affine-hp:held:${offer.selectionId}`,selectionId:offer.selectionId,severity:'warning',message});continue;}
  const acknowledgementSequence=offer.record!.events.filter(event=>event.request.intent.kind==='confirm').at(-1)!.request.sequence;out.bonus+=offer.bonus;out.grants.push({selectionId:offer.selectionId,entryId:offer.canonicalEntryId,source:offer.source,sourceCondition:offer.sourceCondition,constant:offer.constant,perCharacterLevel:1,level:offer.level,bonus:offer.bonus,acknowledgementSequence});out.trace.push(`${offer.name} · ${offer.source}：已明确核对未计入手工生命值，${offer.sourceCondition==='attuned-only'?'当前同调':'当前穿戴且同调'}，常数 ${offer.constant} + 当前角色总等级 ${offer.level} × 1 = 生命值上限 +${offer.bonus}；不治疗、不补发或恢复资源。`);
 }
 return out;
}
