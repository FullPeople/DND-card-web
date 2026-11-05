import type {Character,Entry,Selection} from '../model';
import {automationEnabled,supportedAutomation} from './state';
import {activeEffectSelections} from './active';
import {ordinaryCastingRule} from './ordinaryCastingIdentity';
import {itemCastingBonusSnapshot as hash} from './itemCastingBonuses';
import {spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
import ownedEvidence from './arcaneGrimoireEvidence.json' with {type:'json'};
// Freeze module-owned certificates, never player/catalog data.
function deepFreeze<T>(value:T):T{if(value&&typeof value==='object'){for(const x of Object.values(value))deepFreeze(x);Object.freeze(value);}return value;}
const evidence=deepFreeze(ownedEvidence),namespaceKey='arcaneGrimoireHolding';
export interface GrimoireHoldingOwner {entryId:string;revision:string;snapshotSha256:string;held:boolean}
export interface GrimoireHoldingState {version:1;characterId:string;owners:Record<string,GrimoireHoldingOwner>}
export interface GrimoireHoldingOffer {selectionId:string;name:string;basis:string;held:boolean;active:boolean;canSet:boolean;canWithdraw:boolean;reason?:string;rank?:number}
const exact=(v:unknown,keys?:string[]):v is Record<string,any>=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
 const own=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);
 return own.every(k=>typeof k==='string'&&'value'in descriptors[k]&&descriptors[k].enumerable)&&(!keys||own.length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));
};
export function grimoireHoldingDataSafe(v:unknown,seen=new Set<object>(),depth=0):boolean{
 if(v===null||v===undefined||typeof v==='string'||typeof v==='boolean')return true;
 if(typeof v==='number')return Number.isFinite(v);
 if(typeof v!=='object'||depth>80||seen.has(v)||Object.getOwnPropertySymbols(v).length)return false;
 if(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
 const descriptors=Object.entries(Object.getOwnPropertyDescriptors(v));if(descriptors.some(([key,d])=>!('value'in d)||!d.enumerable&&!(Array.isArray(v)&&key==='length')))return false;
 seen.add(v);const valid=descriptors.every(([,d])=>grimoireHoldingDataSafe(d.value,seen,depth+1));seen.delete(v);return valid;
}
const id=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=4000&&!v.includes('\0');
const ownerValid=(v:unknown):v is GrimoireHoldingOwner=>exact(v,['entryId','revision','snapshotSha256','held'])&&id(v.entryId)&&id(v.revision)&&typeof v.held==='boolean'&&typeof v.snapshotSha256==='string'&&/^[a-f0-9]{64}$/.test(v.snapshotSha256);
export function grimoireHoldingStateValid(v:unknown):v is GrimoireHoldingState{return exact(v,['version','characterId','owners'])&&v.version===1&&id(v.characterId)&&exact(v.owners)&&Object.keys(v.owners).length<=3000&&Object.entries(v.owners).every(([key,value])=>id(key)&&!['__proto__','constructor','prototype'].includes(key)&&ownerValid(value));}
export function validateGrimoireHolding(v:unknown){if(v===undefined)return;if(!exact(v)||!Number.isSafeInteger(v.version)||v.version<1)throw Error('秘典持握版本无效。');}
const namespace=(c:Character):unknown=>{const d=c.automation&&Object.getOwnPropertyDescriptor(c.automation,namespaceKey);return d&&'value'in d?d.value:d?null:undefined;};
export const arcaneGrimoireFamily=(e:Entry)=>grimoireHoldingDataSafe(e)&&exact(e)?evidence.rules.find(r=>r.id===e.id):undefined;
/** Complete exact form; raw bonus tags and names never authorize effects. */
export function arcaneGrimoireRule(e:Entry){
 if(!grimoireHoldingDataSafe(e))return;const r=arcaneGrimoireFamily(e);
 if(!r||e.kind!=='item'||e.packId!==r.packId||e.source!==r.source||e.edition!==r.edition||e.page!==r.page||e.name!==r.name||e.english!==r.english||!id(e.revision)||!exact(e.raw)||e.raw._copy||e.raw._unresolvedParent||e.raw._unresolvedVariant)return;
 return r.forms.some(f=>f.revision===e.revision&&f.snapshotSha256===hash(e))?r:undefined;
}
const wizardId='kiwee:class:phb:wizard::::::';
export function verifiedGrimoireWizard(c:Character):Selection|undefined{
 if(!grimoireHoldingDataSafe(c)||c.edition!=='2014')return;
 const live=activeEffectSelections(c),owners=c.selections.filter(s=>s.entry.kind==='class'&&ordinaryCastingRule(s.entry)?.id===wizardId);if(owners.length!==1)return;
 const s=owners[0];return live.includes(s)&&s.quantity===1&&s.parentId===undefined&&s.grantKey===undefined&&s.requirementId===undefined&&Number.isSafeInteger(s.level)&&s.level>=1&&s.level<=20&&s.entry.raw.spellcastingAbility==='int'&&c.profile.enabledSources.includes('PHB')&&!c.profile.disabledEntries?.includes(wizardId)&&!s.entry.dependencies?.some(source=>!c.profile.enabledSources.includes(source))?s:undefined;
}
const binding=(s:Selection):GrimoireHoldingOwner=>({entryId:s.entry.id,revision:s.entry.revision,snapshotSha256:hash(s.entry),held:true});
function bound(s:Selection,v:GrimoireHoldingOwner){if(!grimoireHoldingDataSafe(s.entry))return false;const b=binding(s);return b.entryId===v.entryId&&b.revision===v.revision&&b.snapshotSha256===v.snapshotSha256;}
const writable=(c:Character,a?:SpellActionAuthority)=>!!a&&a.canEdit===true&&!spellActionAuthorityReason(c,a);
export function grimoireHoldingOffers(c:Character,authority?:SpellActionAuthority):GrimoireHoldingOffer[]{
 if(!grimoireHoldingDataSafe(c))return [];
 const value=namespace(c),known=value===undefined||grimoireHoldingStateValid(value)&&value.characterId===c.id,state=grimoireHoldingStateValid(value)&&value.characterId===c.id?value:undefined,live=activeEffectSelections(c),wizard=verifiedGrimoireWizard(c);
 return c.selections.filter(s=>arcaneGrimoireFamily(s.entry)||state&&Object.hasOwn(state.owners,s.id)).map(s=>{
  const saved=state&&Object.hasOwn(state.owners,s.id)?state.owners[s.id]:undefined,rule=arcaneGrimoireRule(s.entry),owns=!!saved&&bound(s,saved),physical=!['__proto__','constructor','prototype'].includes(s.id)&&s.quantity===1&&s.parentId===undefined&&s.grantKey===undefined&&s.requirementId===undefined&&c.selections.filter(other=>other.id===s.id).length===1;
  const reason=!known?'持握版本、字段或角色归属未知；原记录保留。':state&&!saved&&Object.keys(state.owners).length>=3000?'持握记录已达保护上限；不删除旧记录或新增意图。':saved&&!owns?'持握意图与实物来源不一致；不自动迁移。':!automationEnabled(c)?'自动化暂停；持握意图保留。':!rule?'完整物品来源未核验；持握暂停。':!physical?'需要唯一单件实物根记录。':!live.includes(s)||!c.profile.enabledSources.includes('TCE')||!!s.entry.dependencies?.some(source=>!c.profile.enabledSources.includes(source))?'来源停用；意图保留。':!wizard?'本批只支持已核PHB2014法师路线（技术限制，非书本规则）。':s.attuned!==true?'需要当前同调；装备不等于同调或持握。':undefined;
  const basis=known?hash({scope:'arcane-grimoire-holding-v1',character:c}):'';
  return {selectionId:s.id,name:s.entry.name,basis,held:!!saved?.held,active:!!saved?.held&&owns&&!reason,canSet:!reason&&writable(c,authority),canWithdraw:known&&supportedAutomation(c)&&!!saved&&owns&&saved.held&&writable(c,authority),reason,rank:rule?.rank};
 });
}
export interface GrimoireHoldingRequest {characterId:string;selectionId:string;basis:string;held:boolean}
export function grimoireHoldingRequest(c:Character,selectionId:string,held:boolean):GrimoireHoldingRequest{const offer=grimoireHoldingOffers(c).find(o=>o.selectionId===selectionId);if(!offer)throw Error('没有当前秘典持握入口。');return {characterId:c.id,selectionId,basis:offer.basis,held};}
export function performGrimoireHolding(c:Character,request:GrimoireHoldingRequest,authority:SpellActionAuthority):boolean{
 if(!grimoireHoldingDataSafe(c)||!exact(request,['characterId','selectionId','basis','held'])||request.characterId!==c.id||!id(request.selectionId)||typeof request.held!=='boolean'||!writable(c,authority))return false;
 const offer=grimoireHoldingOffers(c,authority).find(o=>o.selectionId===request.selectionId);if(!offer||offer.basis!==request.basis||!(request.held?offer.canSet:offer.canWithdraw)||!c.automation)return false;
 const row=c.selections.find(s=>s.id===request.selectionId)!,old=namespace(c);if(old!==undefined&&(!grimoireHoldingStateValid(old)||old.characterId!==c.id))return false;
 const state:GrimoireHoldingState=old===undefined?{version:1,characterId:c.id,owners:{}}:structuredClone(old as GrimoireHoldingState);
 Object.defineProperty(state.owners,row.id,{value:{...binding(row),held:request.held},writable:true,enumerable:true,configurable:true});c.automation[namespaceKey]=state;return true;
}
/** Check descriptors before a history merge can evaluate/drop an opaque key. */
export function assertGrimoireHistoryInput(c:Character){
 const a=Object.getOwnPropertyDescriptor(c,'automation');if(!a)return;if(!('value'in a))throw Error('未知自动化描述符不能被历史改写。');
 if(!a.value||typeof a.value!=='object')return;const own=Object.getOwnPropertyDescriptor(a.value,namespaceKey);if(!own)return;
 if(!a.enumerable||!('value'in own)||!own.enumerable||!grimoireHoldingDataSafe(own.value))throw Error('未知秘典持握描述符不能被历史求值或删除。');
}
export function assertGrimoireHoldingHistory(live:Character,next:Character,authority:SpellActionAuthority){
 assertGrimoireHistoryInput(live);assertGrimoireHistoryInput(next);const a=namespace(live),b=namespace(next);if(a===b||hash([a===undefined,a??null])===hash([b===undefined,b??null]))return;
 if(!grimoireHoldingDataSafe(live)||!grimoireHoldingDataSafe(next)||!supportedAutomation(live)||!supportedAutomation(next)||!writable(live,authority)||!writable(next,authority)||live.id!==next.id||a!==undefined&&(!grimoireHoldingStateValid(a)||a.characterId!==live.id)||b!==undefined&&(!grimoireHoldingStateValid(b)||b.characterId!==next.id))throw Error('未知、外来或无权限持握意图不能被历史覆盖。');
 for(const c of [live,next]){const state=namespace(c);if(!grimoireHoldingStateValid(state))continue;for(const [key,value]of Object.entries(state.owners)){const rows=c.selections.filter(s=>s.id===key);if(rows.length!==1||!bound(rows[0],value))throw Error('历史持握意图与当前实物不一致。');}}
}
