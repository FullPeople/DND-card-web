import {selectionAllowed,type Character,type Entry,type Selection} from '../model';
import {casterProfiles} from '../spellcastingRules';
import {activeEffectSelections} from './active';
import {automationEnabled,supportedAutomation} from './state';
import {sourceTextSha256} from './sourceTextSha256';
import {spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
import {optionalClassListAssociation,optionalClassListExistingBase,optionalClassListHeldOwner,optionalClassListHeldTargetFamily,optionalClassListOwnerFamily,optionalClassListOwnerForId,optionalClassListOwnerRule,optionalClassListRuleAnchor,optionalClassListSnapshot,optionalClassListTargetCount,optionalClassListTargetRule,type OptionalClassListOwnerRule} from './optionalClassSpellListSource';

export interface OptionalClassListIntent {confirmedDmDiscussedInclusion:true;confirmedPlayerOptIn:true}
export interface OptionalClassListRecord extends OptionalClassListIntent {ownerId:string;entryId:string;canonicalEntryId:string;snapshotSha256:string;sourceRuleSha256:string;enabled:boolean;nonce:number}
export interface OptionalClassListState {version:number;sequence:number;records:OptionalClassListRecord[]}
export interface OptionalClassListOffer {ownerId:string;label:string;eligible:boolean;active:boolean;canConfirm:boolean;canWithdraw:boolean;reason?:string;basis:string;nonce:number;targetCount:number;record?:OptionalClassListRecord}
export interface OptionalClassListDecision {scoped:boolean;allowed:boolean;baseOverlap:boolean;reason?:string}
const plain=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const text=(value:unknown)=>typeof value==='string'&&!!value.trim()&&value.length<=2000;
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function validateOptionalClassListState(value:unknown):void{
 if(value===undefined)return;if(!plain(value)||!Number.isSafeInteger(value.version)||value.version<1)throw Error('可选职业法表确认记录无效。');if(value.version!==1)return;
 if(Object.keys(value).some(key=>!['version','sequence','records'].includes(key))||!Number.isSafeInteger(value.sequence)||value.sequence<0||!Array.isArray(value.records)||value.records.length>3000)throw Error('可选职业法表确认序号无效。');
 const owners=new Set<string>(),nonces=new Set<number>();for(const row of value.records){if(!plain(row)||Object.keys(row).some(key=>!['ownerId','entryId','canonicalEntryId','snapshotSha256','sourceRuleSha256','enabled','nonce','confirmedDmDiscussedInclusion','confirmedPlayerOptIn'].includes(key))||!text(row.ownerId)||!text(row.entryId)||!text(row.canonicalEntryId)||!hash(row.snapshotSha256)||!hash(row.sourceRuleSha256)||typeof row.enabled!=='boolean'||row.confirmedDmDiscussedInclusion!==true||row.confirmedPlayerOptIn!==true||!Number.isSafeInteger(row.nonce)||row.nonce<1||row.nonce>value.sequence||owners.has(row.ownerId)||nonces.has(row.nonce))throw Error('可选职业法表的归属、明确确认或撤回序号无效。');owners.add(row.ownerId);nonces.add(row.nonce);}
}
function state(c:Character):OptionalClassListState|undefined{if(!supportedAutomation(c))return;const value=c.automation?.optionalClassSpellLists;if(value===undefined)return {version:1,sequence:0,records:[]};try{validateOptionalClassListState(value);return value.version===1?value:undefined;}catch{return;}}
export function optionalClassListStateIssue(c:Character):string|undefined{return state(c)?undefined:'可选职业法表确认版本未知或记录损坏，原数据保留；不执行、覆盖或迁移为当前确认。';}
export function optionalClassListAuthorityReason(c:Character,authority:SpellActionAuthority):string|undefined{if(!authority||!Object.hasOwn(authority,'canEdit')||typeof authority.canEdit!=='boolean')return '需要当前明确的角色卡编辑权限，未修改可选职业法表。';return spellActionAuthorityReason(c,authority);}
function owner(c:Character,id:string){const rows=c.selections.filter(row=>row.id===id);return rows.length===1?rows[0]:undefined;}
function available(c:Character,entry:Entry,canonical:string){return selectionAllowed(c,entry)&&c.profile.enabledSources.includes(entry.source)&&(entry.dependencies||[]).every(source=>c.profile.enabledSources.includes(source))&&!c.profile.disabledEntries?.some(id=>id===entry.id||id===canonical);}
function ownerReason(c:Character,row:Selection|undefined,rule:OptionalClassListOwnerRule|undefined):string|undefined{
 if(!automationEnabled(c))return '自动计算当前暂停；原可选职业法表确认与手工法术记录保留。';
 if(!row||!rule||row.entry.kind!=='class'||row.parentId||row.grantKey||row.requirementId||row.quantity!==1||!Number.isSafeInteger(row.level)||row.level<rule.minLevel||row.level>20)return '需要已核对、达到来源等级且数量为一的完整原生 PHB2014 主职业根记录。';
 if(c.selections.filter(other=>other.entry.kind==='class'&&optionalClassListOwnerFamily(other.entry)?.id===rule.id).length!==1||!activeEffectSelections(c).includes(row))return '职业归属不唯一或当前未生效；不根据同名或旧快照重新关联确认。';
 if(!available(c,row.entry,rule.id)||!c.profile.enabledSources.includes('TCE'))return '职业、TCE 来源或规范／当前条目身份已停用；确认保留但不增加可选法表访问。';
 if(c.spellSettings?.modeOverride||!casterProfiles(c).some(profile=>profile.owner===row&&profile.casting===row))return '当前施法模式或职业上下文不属于已核对的原生主职业模型；请先核对“跟随职业”，手工模式保留。';
}
export function optionalClassListOffer(c:Character,ownerId:string,_catalog:Entry[],authority:SpellActionAuthority):OptionalClassListOffer{
 const current=owner(c,ownerId),s=state(c),record=s?.records.find(row=>row.ownerId===ownerId),rule=current&&optionalClassListOwnerRule(current.entry),family=current&&optionalClassListOwnerFamily(current.entry),held=current&&optionalClassListHeldOwner(current.entry),savedRule=record&&optionalClassListOwnerForId(record.canonicalEntryId);
 const reason=!s?optionalClassListStateIssue(c):held?'此术士可选法表的来源所属标题与引导段落冲突，21 项仍待核对；原有基础法表访问不受此确认控制。':ownerReason(c,current,rule),eligible=!!s&&!held&&!reason&&!!rule;
 const active=eligible&&!!record?.enabled&&record.entryId===current!.entry.id&&record.canonicalEntryId===rule!.id&&record.snapshotSha256===rule!.fullNormalizedSnapshotSha256&&record.sourceRuleSha256===optionalClassListRuleAnchor(rule!);
 const denied=optionalClassListAuthorityReason(c,authority),label=current?.entry.name||savedRule?.name||record?.canonicalEntryId||'保留的职业确认';
 const basis=sourceTextSha256(JSON.stringify([c.id,c.profile,c.automation,current,c.spellSettings?.modeOverride,c.selections.filter(row=>['class','subclass'].includes(row.entry.kind)),family?.sideSource,record]));
 return {ownerId,label,eligible,active,canConfirm:eligible&&!active&&!denied,canWithdraw:!!s&&!!record?.enabled&&!denied,reason:denied||reason||(!active?'尚未明确确认本职业经 DM 讨论后纳入且由玩家选择的可选法表。':undefined),basis,nonce:record?.nonce||0,targetCount:held?.targetIds.length||optionalClassListTargetCount(rule?.id||family?.id||savedRule?.id||''),record};
}
export function optionalClassListOffers(c:Character,catalog:Entry[],authority:SpellActionAuthority):OptionalClassListOffer[]{const ids=new Set([...c.selections.filter(row=>row.entry.kind==='class'&&(optionalClassListOwnerFamily(row.entry)||optionalClassListHeldOwner(row.entry))).map(row=>row.id),...(state(c)?.records.map(row=>row.ownerId)||[])]);return [...ids].map(id=>optionalClassListOffer(c,id,catalog,authority));}
export function optionalClassListObservedIntent(c:Character,ownerId:string):OptionalClassListRecord|undefined{return state(c)?.records.find(row=>row.ownerId===ownerId);}
export function optionalClassSpellListDecision(c:Character,entry:Entry,ownerId:string):OptionalClassListDecision{
 const current=owner(c,ownerId);if(!current)return {scoped:false,allowed:false,baseOverlap:false};
 const association=optionalClassListAssociation(current.entry,entry),held=optionalClassListHeldOwner(current.entry),heldTarget=held&&optionalClassListHeldTargetFamily(entry,held);
 if(!association&&!heldTarget)return {scoped:false,allowed:false,baseOverlap:false};
 if(association?.baseOverlap||heldTarget?.identityValid&&optionalClassListExistingBase(current.entry,entry))return {scoped:true,allowed:false,baseOverlap:optionalClassListExistingBase(current.entry,entry)};
 if(heldTarget)return {scoped:true,allowed:false,baseOverlap:false,reason:'术士来源段落冲突尚未受审；不开放新的可选法表资格。'};
 const target=optionalClassListTargetRule(entry),rule=optionalClassListOwnerRule(current.entry),offer=optionalClassListOffer(c,ownerId,[],{canEdit:true,gm:false});
 const allowed=!!association&&!!rule&&!!target&&offer.active&&available(c,entry,target.id);
 return {scoped:true,allowed,baseOverlap:false,...(!allowed?{reason:!target?'法术完整来源快照或规范身份未通过核对。':!available(c,entry,target.id)?'法术来源或规范／当前条目已停用。':offer.reason||'本职业可选法表确认尚未生效。'}:{})};
}
/** Optional-only route. Existing base membership is intentionally independent. */
export function optionalClassSpellListAccess(c:Character,entry:Entry,ownerId:string):boolean{return optionalClassSpellListDecision(c,entry,ownerId).allowed;}
export function setOptionalClassListIntent(c:Character,ownerId:string,intent:OptionalClassListIntent|null,catalog:Entry[],authority:SpellActionAuthority):void{
 const denied=optionalClassListAuthorityReason(c,authority);if(denied)throw Error(denied);const s=state(c);if(!s||!c.automation)throw Error(optionalClassListStateIssue(c)||'自动计算协议当前不可用。');
 if(intent!==null&&(!plain(intent)||Object.keys(intent).length!==2||!Object.hasOwn(intent,'confirmedDmDiscussedInclusion')||!Object.hasOwn(intent,'confirmedPlayerOptIn')||intent.confirmedDmDiscussedInclusion!==true||intent.confirmedPlayerOptIn!==true))throw Error('请分别明确确认已与 DM 讨论纳入本可选特性，以及本次由玩家选择。');
 const offer=optionalClassListOffer(c,ownerId,catalog,authority),old=s.records.find(row=>row.ownerId===ownerId);if(intent===null){if(!old?.enabled)return;}else if(offer.active)return;else if(!offer.canConfirm)throw Error(offer.reason||'当前职业可选法表不能确认。');
 if(s.sequence>=Number.MAX_SAFE_INTEGER)throw Error('可选职业法表确认序号已达到上限。');const next=structuredClone(s);next.sequence++;const stored=next.records.find(row=>row.ownerId===ownerId);
 if(intent===null){stored!.enabled=false;stored!.nonce=next.sequence;}else{const current=owner(c,ownerId)!,rule=optionalClassListOwnerRule(current.entry)!,replacement:OptionalClassListRecord={ownerId,entryId:current.entry.id,canonicalEntryId:rule.id,snapshotSha256:rule.fullNormalizedSnapshotSha256,sourceRuleSha256:optionalClassListRuleAnchor(rule),enabled:true,nonce:next.sequence,confirmedDmDiscussedInclusion:true,confirmedPlayerOptIn:true};if(stored)Object.assign(stored,replacement);else next.records.push(replacement);}
 c.automation.optionalClassSpellLists=next;
}
/** Internal deauthorization on the already-authorized removal path only. It
 * never confirms, creates records, changes spells or mutates unknown versions. */
export function revokeOptionalClassListOwners(c:Character,removed:ReadonlySet<string>):void{const s=state(c);if(!s||!c.automation)return;const next=structuredClone(s);let changed=false;for(const row of next.records)if(removed.has(row.ownerId)&&row.enabled){if(next.sequence>=Number.MAX_SAFE_INTEGER)throw Error('可选职业法表确认序号已达到上限。');row.enabled=false;row.nonce=++next.sequence;changed=true;}if(changed)c.automation.optionalClassSpellLists=next;}
