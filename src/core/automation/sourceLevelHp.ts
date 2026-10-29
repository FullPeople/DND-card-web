import type {Character,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './sourceLevelHpEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type SourceLevelHpRule=typeof evidence.rules[number];
type Component=typeof evidence.componentProofs[number];
export type SourceLevelHpLevelBasis='character-level'|'owning-class-level';
export interface SourceLevelHpAuthority {canEdit:boolean;gm:boolean}
export type SourceLevelHpIntent={kind:'confirm';confirmedManualHpExcluded:true}|{kind:'withdraw'};
export interface SourceLevelHpRequest {namespace:'source-level-hp';id:string;cardId:string;selectionId:string;sequence:number;revision:number;basis:string;intent:SourceLevelHpIntent}
export interface SourceLevelHpReceipt {id:string;sequence:number;selectionId:string;kind:'confirm'|'withdraw';fingerprint:string}
interface Binding {selectionId:string;canonicalEntryId:string;entryId:string;identityBasis:string;manualBasis:string}
interface Event {request:SourceLevelHpRequest;fingerprint:string;binding:Binding}
export interface SourceLevelHpRecord extends Binding {withdrawn:boolean;events:Event[]}
interface Store {version:1;sequence:number;records:SourceLevelHpRecord[];last?:SourceLevelHpReceipt}
export interface SourceLevelHpOffer {selectionId:string;entryId:string;canonicalEntryId:string;name:string;source:string;levelBasis:SourceLevelHpLevelBasis;level?:number;bonus?:number;eligible:boolean;active:boolean;confirmed:boolean;withdrawn:boolean;canConfirm:boolean;canWithdraw:boolean;reason?:string;basis:string;sequence:number;record?:SourceLevelHpRecord}
export type SourceLevelHpActionResult={status:'applied';receipt:SourceLevelHpReceipt;message:string}|{status:'rejected';message:string};
export interface SourceLevelHpGrant {selectionId:string;entryId:string;source:string;levelBasis:SourceLevelHpLevelBasis;level:number;perLevel:1;bonus:number;acknowledgementSequence:number}
export interface SourceLevelHpProjection {bonus:number;trace:string[];issues:Issue[];grants:SourceLevelHpGrant[]}
export const SOURCE_LEVEL_HP_ANSWER_KEY='source-level-hp:acknowledgements';
const roots=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const text=(value:unknown,max=2000):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max&&!value.includes('\0');
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const keys=(value:Record<string,any>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key))&&allowed.every(key=>Object.hasOwn(value,key));
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const sourceLevelHpSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));
const same=(a:unknown,b:unknown)=>sourceLevelHpSnapshot(a)===sourceLevelHpSnapshot(b);

/** Recognition protects these known native nodes from generic HP fallback. It
 * grants nothing, and never consumes a CUSTOM same-name entry as native source. */
function componentFamily(entry:Entry,proofs:readonly Component[]):Component|undefined{
 if(!entry||typeof entry!=='object')return;
 const exact=proofs.find(proof=>proof.id===entry.id);if(exact)return exact;
 // Another real catalog identity is never a transport alias for this family.
 if(canonical.has(entry.id)||!object(entry.raw))return;
 const raw=entry.raw,matches=proofs.filter(proof=>entry.kind===proof.kind&&entry.packId===proof.packId&&entry.source===proof.source&&entry.edition===proof.edition&&entry.name===proof.name&&entry.english===proof.english&&(entry.page??null)===proof.page&&raw._category===proof.category&&(raw.className??null)===proof.className&&(raw.classSource??null)===proof.classSource&&(raw.subclassShortName??null)===proof.subclassShortName&&(raw.subclassSource??null)===proof.subclassSource&&(raw.level??null)===proof.level&&(raw._classEdition??null)===proof.classEdition&&(raw.raceName??null)===proof.raceName&&(raw.raceSource??null)===proof.raceSource&&(raw._parentName??null)===proof.parentName&&(raw._parentSource??null)===proof.parentSource&&(raw._subraceName??null)===proof.subraceName&&(raw.shortName??null)===proof.shortName);return matches.length===1?matches[0]:undefined;
}
export function sourceLevelHpFamilyId(entry:Entry):string|undefined{return componentFamily(entry,evidence.componentProofs)?.id;}
export function sourceLevelHpIdentity(entry:Entry):boolean{return !!sourceLevelHpFamilyId(entry);}
function rootFamily(entry:Entry):SourceLevelHpRule|undefined{const proof=componentFamily(entry,evidence.rules);return proof&&roots.get(proof.id);}
/** Legacy HP exclusion only. The racial inline slot is the exact source clause
 * slot and actual syncFeatures-generated entry identity, not a name or broad
 * descendant rule. A genuine CUSTOM collision keeps its existing executor. */
export function sourceLevelHpLegacyHpSelection(c:Character,row:Selection):boolean{
 if(sourceLevelHpFamilyId(row.entry))return true;
 if(!c.selections.includes(row)||row.entry.kind!=='feature')return false;
 return evidence.rules.some(rule=>rule.kind==='race'&&row.entry.packId===rule.packId&&row.entry.source===rule.source&&row.entry.edition===rule.edition&&(row.entry.page??null)===rule.page&&rule.clauses.some(clause=>{
  const slot=clause.role==='maximum-hp'&&clause.expectedCompleteEntryPath.match(/^raw\/entries\/(\d+)\/entries\/0$/);if(!slot)return false;
  // A canonical generated source identity stays protected after orphaning or
  // parent/grant metadata damage. This is a hold, never row adoption or a grant.
  if(row.entry.id===`${rule.id}#trait:${slot[1]}`)return true;
  return c.selections.some(parent=>rootFamily(parent.entry)?.id===rule.id&&row.entry.id===`${parent.entry.id}#trait:${slot[1]}`);
 }));
}
function complete(entry:Entry,proof:Component):boolean{
 if(!entry||entry.kind!==proof.kind||!text(entry.id)||!text(entry.revision,4000)||entry.id!==proof.id&&canonical.has(entry.id)||entry.packId!==proof.packId||entry.source!==proof.source||entry.edition!==proof.edition||entry.name!==proof.name||entry.english!==proof.english||(entry.page??null)!==proof.page||!object(entry.raw)||entry.raw._category!==proof.category||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._versionBaseName)return false;
 try{return proof.forms.some(form=>form.canonicalReboundSnapshotSha256===sourceLevelHpSnapshot({...entry,id:proof.id,revision:proof.revision}));}catch{return false;}
}
export function sourceLevelHpRule(entry:Entry):SourceLevelHpRule|undefined{const rule=rootFamily(entry);return rule&&complete(entry,rule)?rule:undefined;}
function available(c:Character,entry:Entry,proof:Component){return !c.profile.disabledEntries?.some(id=>id===entry.id||id===proof.id)&&proof.requiredSources.every(source=>c.profile.enabledSources.includes(source));}

/** Only HP-related manual inputs. Level growth, current/temp HP, resource
 * balances, permissions, locks and unrelated edits are intentionally excluded. */
export function sourceLevelHpManualBasis(c:Character):string{
 const effects=c.selections.flatMap(row=>{const hp=(row.entry.effects||[]).filter(effect=>effect.op!=='proficiency'&&effect.target==='hp');return hp.length?[{selectionId:row.id,parentId:row.parentId??null,entryId:row.entry.id,source:row.entry.source,packId:row.entry.packId,effects:hp}]:[];});
 return sourceLevelHpSnapshot([c.baseHp,c.sheetBonuses?.hp,c.adjustments?.filter(row=>row.target==='hp'),c.hpProgression,effects]);
}
function mutationReason(c:Character,authority?:SourceLevelHpAuthority):string|undefined{
 if(!object(authority)||!Object.hasOwn(authority,'canEdit')||!Object.hasOwn(authority,'gm')||typeof Object.getOwnPropertyDescriptor(authority,'canEdit')?.value!=='boolean'||typeof Object.getOwnPropertyDescriptor(authority,'gm')?.value!=='boolean'||authority.canEdit!==true)return '当前实际编辑／主持人权限缺失或无效，未修改确认记录。';
 if(c.locked!==undefined&&typeof c.locked!=='boolean'||c.locked===true&&authority.gm!==true)return '当前角色卡已锁定，需要实际主持人权限才能修改确认记录。';
}
function validIntent(value:unknown):value is SourceLevelHpIntent{return object(value)&&(value.kind==='confirm'&&keys(value,['kind','confirmedManualHpExcluded'])&&value.confirmedManualHpExcluded===true||value.kind==='withdraw'&&keys(value,['kind']));}
function validRequest(value:unknown):value is SourceLevelHpRequest{return object(value)&&keys(value,['namespace','id','cardId','selectionId','sequence','revision','basis','intent'])&&value.namespace==='source-level-hp'&&text(value.id,128)&&text(value.cardId)&&text(value.selectionId)&&integer(value.sequence)&&integer(value.revision)&&hash(value.basis)&&validIntent(value.intent);}
export function sourceLevelHpRequestFingerprint(request:SourceLevelHpRequest):string{return sourceLevelHpSnapshot(request);}
function validBinding(value:unknown):value is Binding{return object(value)&&keys(value,['selectionId','canonicalEntryId','entryId','identityBasis','manualBasis'])&&text(value.selectionId)&&text(value.canonicalEntryId)&&roots.has(value.canonicalEntryId)&&text(value.entryId)&&(!(value.entryId!==value.canonicalEntryId&&canonical.has(value.entryId)))&&hash(value.identityBasis)&&hash(value.manualBasis);}
function validateStore(value:unknown,cardId:string):asserts value is Store{
 if(!object(value)||value.version!==1||!integer(value.sequence,0,1000)||!Array.isArray(value.records)||value.records.length>100||Object.keys(value).some(key=>!['version','sequence','records','last'].includes(key)))throw Error('生命值来源确认记录结构无效。');
 const ids=new Set<string>(),sequences=new Set<number>(),owners=new Set<string>();let latest:SourceLevelHpReceipt|undefined;
 for(const record of value.records){
  if(!object(record)||Object.keys(record).some(key=>!['selectionId','canonicalEntryId','entryId','identityBasis','manualBasis','withdrawn','events'].includes(key))||!validBinding({selectionId:record.selectionId,canonicalEntryId:record.canonicalEntryId,entryId:record.entryId,identityBasis:record.identityBasis,manualBasis:record.manualBasis})||typeof record.withdrawn!=='boolean'||!Array.isArray(record.events)||record.events.length<1||record.events.length>1000||owners.has(record.selectionId))throw Error('生命值来源确认归属无效。');
  owners.add(record.selectionId);let binding:Binding|undefined,withdrawn=false,prior=-1;
  for(const event of record.events){
   if(!object(event)||!keys(event,['request','fingerprint','binding'])||!validRequest(event.request)||event.request.cardId!==cardId||!validBinding(event.binding)||event.binding.selectionId!==record.selectionId||event.binding.canonicalEntryId!==record.canonicalEntryId||event.request.selectionId!==record.selectionId||event.request.sequence<=prior||ids.has(event.request.id)||sequences.has(event.request.sequence)||event.fingerprint!==sourceLevelHpRequestFingerprint(event.request)||event.request.intent.kind==='withdraw'&&(!binding||withdrawn||!same(binding,event.binding))||event.request.intent.kind==='confirm'&&binding&&!withdrawn&&same(binding,event.binding))throw Error('生命值来源确认历史无效。');
   ids.add(event.request.id);sequences.add(event.request.sequence);prior=event.request.sequence;
   if(event.request.intent.kind==='confirm'){binding=event.binding;withdrawn=false;}else withdrawn=true;
   const receipt={id:event.request.id,sequence:event.request.sequence,selectionId:record.selectionId,kind:event.request.intent.kind,fingerprint:event.fingerprint};if(!latest||receipt.sequence>latest.sequence)latest=receipt;
  }
  if(!binding||!same(binding,{selectionId:record.selectionId,canonicalEntryId:record.canonicalEntryId,entryId:record.entryId,identityBasis:record.identityBasis,manualBasis:record.manualBasis})||withdrawn!==record.withdrawn)throw Error('生命值来源确认历史与当前记录不一致。');
 }
 if(sequences.size!==value.sequence||[...sequences].some(sequence=>sequence>=value.sequence)||value.sequence===0&&(value.records.length||value.last!==undefined)||value.sequence>0&&(!latest||!object(value.last)||!keys(value.last,['id','sequence','selectionId','kind','fingerprint'])||!same(value.last,latest)))throw Error('生命值来源确认序号或回执无效。');
}
function saved(c:Character):{store?:Store;reason?:string}{
 const raw=c.answers[SOURCE_LEVEL_HP_ANSWER_KEY];if(raw===undefined)return{store:{version:1,sequence:0,records:[]}};
 if(!Array.isArray(raw)||raw.length!==1||typeof raw[0]!=='string'||raw[0].length>400000)return{reason:'生命值来源确认记录无效，原数据保留且只读。'};
 try{const value=JSON.parse(raw[0]);if(object(value)&&integer(value.version,2))return{reason:'生命值来源确认版本尚未支持，原数据保留且只读。'};validateStore(value,c.id);return{store:value};}catch{return{reason:'生命值来源确认记录无效，原数据保留且只读。'};}
}
type Current={rule?:SourceLevelHpRule;row?:Selection;level?:number;bonus?:number;binding?:Binding;reason?:string};
function current(c:Character,selectionId:string,providedActive?:readonly Selection[]):Current{
 const rows=c.selections.filter(row=>row.id===selectionId),row=rows[0],rule=row&&rootFamily(row.entry),out:Current={row,rule};
 const hold=(reason:string)=>({...out,reason});
 if(rows.length!==1||!row||!rule)return hold('当前没有唯一可核对的完整来源根记录。');
 if(!automationEnabled(c))return hold('自动化关闭或协议未知，来源生命值暂停。');
 if(!text(row.id)||!complete(row.entry,rule))return hold('来源完整身份、版本、条款或快照未通过核对。');
 if(!available(c,row.entry,rule))return hold('来源、实际依赖或规范／实例身份已停用。');
 const live=activeEffectSelections(c),active=(selection:Selection)=>live.includes(selection)&&(!providedActive||providedActive.includes(selection));
 if(!active(row))return hold('当前真实来源归属未生效，外部列表不能代替当前归属。');
 const identity:unknown[]=[c.id,row.id,row.entry.id,row.entry.revision,rule.id,sourceLevelHpSnapshot({...row.entry,id:rule.id,revision:rule.revision})];
 let level:number;
 if(rule.levelBasis==='character-level'){
  if(row.entry.kind!=='race'||c.selections.filter(candidate=>candidate.entry.kind==='race').length!==1||row.parentId!==undefined||row.grantKey!==undefined||row.requirementId!==undefined)return hold('种族必须是唯一有效的完整根记录，不合并重复种族或别名。');
  const classes=c.selections.filter(candidate=>candidate.entry.kind==='class'),classIds=new Set<string>();
  if(!classes.length||classes.some(candidate=>{const proof=componentFamily(candidate.entry,evidence.componentProofs.filter(proof=>proof.kind==='class')),id=proof?.id||candidate.entry.id;const invalid=!text(candidate.id)||!text(id)||classIds.has(id)||candidate.parentId!==undefined||candidate.grantKey!==undefined||candidate.requirementId!==undefined||!integer(candidate.level,1,20)||!active(candidate);classIds.add(id);return invalid;}))return hold('角色总等级没有唯一、当前有效且数值明确的根职业，未猜测等级。');
  level=classes.reduce((sum,candidate)=>sum+candidate.level,0);if(!integer(level,1,20))return hold('角色总等级超出已支持范围，未计算本来源加值。');
 }else{
  if(!('owner'in rule)||!rule.owner||!('topFeature'in rule)||!rule.topFeature||!('hpFeature'in rule)||!rule.hpFeature||!('references'in rule)||!rule.references)return hold('原生子职声明链尚未核实。');
  const owners=c.selections.filter(candidate=>componentFamily(candidate.entry,[rule.owner!])?.id===rule.owner!.id),owner=owners[0];
  if(owners.length!==1||!owner||owner.entry.kind!=='class'||!text(owner.id)||owner.parentId!==undefined||owner.grantKey!==undefined||owner.requirementId!==undefined||!complete(owner.entry,rule.owner)||!available(c,owner.entry,rule.owner)||!active(owner)||!integer(owner.level,rule.minLevel,20))return hold('没有唯一完整且达到该原生来源等级的所属职业，未借用其他职业或总等级。');
  if(row.entry.kind!=='subclass'||row.parentId!==owner.id||row.grantKey!==undefined||row.requirementId!==undefined||c.selections.filter(candidate=>candidate.entry.kind==='subclass'&&(candidate.parentId===owner.id||candidate.entry.raw?.className===rule.className&&candidate.entry.raw?.classSource===rule.classSource)).length!==1)return hold('原生子职与当前所属职业的父项或唯一归属不一致。');
  const reference=rule.references[0],nested=rule.references[1],tops=c.selections.filter(candidate=>candidate.parentId===row.id&&candidate.grantKey===reference.grantKey),top=tops[0];
  if(tops.length!==1||!top||!text(top.id)||top.requirementId!==undefined||!complete(top.entry,rule.topFeature)||!available(c,top.entry,rule.topFeature)||!active(top)||c.selections.filter(candidate=>componentFamily(candidate.entry,[rule.topFeature!])?.id===rule.topFeature!.id).length!==1||c.dismissedFeatures?.some(key=>key===`${row.id}|${reference.grantKey}`||key===`${top.id}|${nested.grantKey}`||key===`${row.id}|${nested.grantKey}`))return hold('声明的顶层子职授予不唯一、已撤回或来源不完整；手动拖入的同名生命值特性不能授权。');
  if(!rule.hpFeature.requiredSources.every(source=>c.profile.enabledSources.includes(source))||c.profile.disabledEntries?.includes(rule.hpFeature.id))return hold('声明的生命值目标来源或规范身份已停用。');
  identity.push(owner.id,owner.entry.id,owner.entry.revision,sourceLevelHpSnapshot({...owner.entry,id:rule.owner.id,revision:rule.owner.revision}),top.id,top.entry.id,top.entry.revision,sourceLevelHpSnapshot({...top.entry,id:rule.topFeature.id,revision:rule.topFeature.revision}));level=owner.level;
 }
 if(c.adjustments?.some(adjustment=>adjustment.target==='hp'&&typeof adjustment.reason==='string'&&!!adjustment.reason.trim()))return hold('已有手工最终生命值覆盖；新的来源加值暂缓，不猜测是否应加在最终值之上。');
 const binding:Binding={selectionId:row.id,canonicalEntryId:rule.id,entryId:row.entry.id,identityBasis:sourceLevelHpSnapshot(identity),manualBasis:sourceLevelHpManualBasis(c)};
 return{...out,level,bonus:level,binding};
}
export function sourceLevelHpOffers(c:Character,authority?:SourceLevelHpAuthority,providedActive?:readonly Selection[]):SourceLevelHpOffer[]{
 const state=saved(c),store=state.store,records=store?.records||[],ids=[...new Set([...c.selections.filter(row=>rootFamily(row.entry)).map(row=>row.id),...records.map(record=>record.selectionId)])],permission=mutationReason(c,authority);
 return ids.map(selectionId=>{
  const value=current(c,selectionId,providedActive),record=records.find(record=>record.selectionId===selectionId),rule=value.rule||record&&roots.get(record.canonicalEntryId),withdrawn=record?.withdrawn===true,confirmed=!!record&&!withdrawn,identityChanged=!!record&&!!rule&&record.canonicalEntryId!==rule.id;
  const eligible=!!value.binding&&!identityChanged,active=!!store&&eligible&&confirmed&&same(value.binding,{selectionId:record!.selectionId,canonicalEntryId:record!.canonicalEntryId,entryId:record!.entryId,identityBasis:record!.identityBasis,manualBasis:record!.manualBasis});
  const reason=state.reason||value.reason||(identityChanged?'同实例来源身份已更换；旧确认保留，请使用正常替换入口重新核对。':withdrawn?'本来源确认已明确撤回；重开或重选不会自动确认。':!record?'尚未明确确认此来源未计入手工生命值。':!active?'来源归属或手工生命值输入已变化，请重新核对并明确确认。':undefined);
  const basis=sourceLevelHpSnapshot([c.id,c.revision,selectionId,value.binding??null,value.level??null,value.reason??null,sourceLevelHpManualBasis(c),c.selections.filter(row=>row.id===selectionId).map(row=>[row.id,row.parentId??null,row.grantKey??null,row.requirementId??null,sourceLevelHpSnapshot(row.entry)]),store??state.reason]);
  return{selectionId,entryId:value.row?.entry.id||record?.entryId||'',canonicalEntryId:rule?.id||record?.canonicalEntryId||'',name:value.row?.entry.name||rule?.name||'保留的生命值来源',source:value.row?.entry.source||rule?.source||'',levelBasis:(rule?.levelBasis||'character-level')as SourceLevelHpLevelBasis,level:value.level,bonus:value.bonus,eligible:!!store&&eligible,active,confirmed,withdrawn,canConfirm:!!store&&!permission&&eligible&&!active&&store.sequence<1000,canWithdraw:!!store&&!permission&&!!record&&!withdrawn&&store.sequence<1000,reason:reason||permission,basis,sequence:store?.sequence??0,record};
 });
}
export function sourceLevelHpOffer(c:Character,selectionId:string,authority?:SourceLevelHpAuthority):SourceLevelHpOffer|undefined{const matches=sourceLevelHpOffers(c,authority).filter(offer=>offer.selectionId===selectionId);return matches.length===1?matches[0]:undefined;}
export function sourceLevelHpRequest(c:Character,selectionId:string,id:string,intent:SourceLevelHpIntent):SourceLevelHpRequest{
 const offer=sourceLevelHpOffer(c,selectionId);if(!offer||!validIntent(intent)||!text(id,128))throw Error('当前来源确认请求无法核对。');return{namespace:'source-level-hp',id,cardId:c.id,selectionId,sequence:offer.sequence,revision:c.revision,basis:offer.basis,intent:structuredClone(intent)};
}
export function sourceLevelHpReceipt(c:Character,id:string):SourceLevelHpReceipt|undefined{
 const state=saved(c),last=state.store?.last;if(!last||last.id!==id)return;const event=state.store!.records.flatMap(record=>record.events).find(event=>event.request.id===id);if(event?.request.cardId===c.id&&event.request.sequence===last.sequence&&event.request.selectionId===last.selectionId&&event.request.intent.kind===last.kind&&sourceLevelHpRequestFingerprint(event.request)===last.fingerprint)return{...last};
}
/** Only this explicitly authorized action writes the owned answer namespace.
 * It never writes source/manual fields, current/temp HP, rolls or resources. */
export function performSourceLevelHpAction(c:Character,request:SourceLevelHpRequest,authority?:SourceLevelHpAuthority):SourceLevelHpActionResult{
 const rejected=(message:string):SourceLevelHpActionResult=>({status:'rejected',message}),permission=mutationReason(c,authority);if(permission)return rejected(permission);
 if(!validRequest(request))return rejected('来源确认请求结构无效，未修改。');const state=saved(c),store=state.store;if(!store)return rejected(state.reason!);
 if(request.cardId!==c.id||request.revision!==c.revision||request.sequence!==store.sequence||store.records.some(record=>record.events.some(event=>event.request.id===request.id)))return rejected('请求已过期或重复，未再次执行。');
 const offer=sourceLevelHpOffer(c,request.selectionId,authority);if(!offer||offer.basis!==request.basis)return rejected('来源归属、手工生命值输入或确认基线已变化，未执行。');
 if(request.intent.kind==='confirm'?!offer.canConfirm:!offer.canWithdraw)return rejected(offer.reason||'本来源当前不能执行该确认操作。');
 const prior=store.records.find(record=>record.selectionId===request.selectionId),value=current(c,request.selectionId),binding=request.intent.kind==='confirm'?value.binding:prior&&{selectionId:prior.selectionId,canonicalEntryId:prior.canonicalEntryId,entryId:prior.entryId,identityBasis:prior.identityBasis,manualBasis:prior.manualBasis};if(!binding)return rejected('当前来源确认绑定无效，未执行。');
 const fingerprint=sourceLevelHpRequestFingerprint(request),event:Event={request:structuredClone(request),fingerprint,binding:{...binding}},record:SourceLevelHpRecord={...binding,withdrawn:request.intent.kind==='withdraw',events:[...(prior?.events||[]),event]},receipt:SourceLevelHpReceipt={id:request.id,sequence:request.sequence,selectionId:request.selectionId,kind:request.intent.kind,fingerprint},next:Store={version:1,sequence:store.sequence+1,records:[...store.records.filter(record=>record.selectionId!==request.selectionId),record],last:receipt};
 try{validateStore(next,c.id);}catch{return rejected('来源确认历史不一致，原记录保留。');}
 const encoded=JSON.stringify(next);if(encoded.length>400000)return rejected('确认记录已达到可安全读取的大小上限，原记录保留。');
 c.answers={...c.answers,[SOURCE_LEVEL_HP_ANSWER_KEY]:[encoded]};return{status:'applied',receipt,message:request.intent.kind==='confirm'?'已记录当前明确确认；只投影生命值上限，不恢复生命值。':'已明确撤回本来源确认；历史与当前生命值、资源保留。'};
}
export function projectSourceLevelHp(c:Character,providedActive?:readonly Selection[]):SourceLevelHpProjection{
 const out:SourceLevelHpProjection={bonus:0,trace:[],issues:[],grants:[]},offers=sourceLevelHpOffers(c,undefined,providedActive);
 if(!offers.length){const reason=saved(c).reason;if(reason){const message=`${reason} 当前没有可核对的来源根记录；原确认数据、生命值和资源保留。`;out.trace.push(message);out.issues.push({id:'source-level-hp:state',severity:'warning',message});}}
 for(const offer of offers){
  if(!offer.active||offer.level===undefined||offer.bonus===undefined){const message=`${offer.name}：${offer.reason||'当前来源确认未生效。'} 当前／临时生命值、手工最终值和资源保留。`;out.trace.push(message);out.issues.push({id:`source-level-hp:held:${offer.selectionId}`,selectionId:offer.selectionId,severity:'warning',message});continue;}
  const acknowledgementSequence=offer.record!.events.filter(event=>event.request.intent.kind==='confirm').at(-1)!.request.sequence;out.bonus+=offer.bonus;out.grants.push({selectionId:offer.selectionId,entryId:offer.canonicalEntryId,source:offer.source,levelBasis:offer.levelBasis,level:offer.level,perLevel:1,bonus:offer.bonus,acknowledgementSequence});out.trace.push(`${offer.name} · ${offer.source}：已明确核对未计入手工生命值，${offer.levelBasis==='character-level'?'当前角色总等级':'当前所属术士等级'} ${offer.level} × 1 = 生命值上限 +${offer.bonus}；不治疗、不补发或恢复资源。`);
 }
 return out;
}
