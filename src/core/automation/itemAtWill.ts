import {selectionAllowed,type Character,type Entry,type Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled,supportedAutomation} from './state';
import {spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
import {ordinaryCastingRule} from './ordinarySpellCasting';
import {sourceTextSha256} from './sourceTextSha256';
import {itemAtWillFamilyId,itemAtWillRule,itemAtWillStoredRule,itemAtWillTargetHeader,type ItemAtWillRule} from './itemAtWillSource';
export {itemAtWillRule,itemAtWillIdentity} from './itemAtWillSource';
export type ItemAtWillTargetScope='self'|'spell';
export interface ItemAtWillRecord {ownerId:string;entryId:string;canonicalEntryId:string;snapshotSha256:string;enabled:boolean;nonce:number}
export interface ItemAtWillState {version:number;sequence:number;records:ItemAtWillRecord[]}
export interface ItemAtWillGrant {key:string;targetEntryId:string;targetScope:ItemAtWillTargetScope}
export interface ItemAtWillOffer {ownerId:string;key:string;label:string;eligible:boolean;active:boolean;canConfirm:boolean;canWithdraw:boolean;reason?:string;basis:string;nonce:number;requiresAttunement:boolean;grants:ItemAtWillGrant[];record?:ItemAtWillRecord}
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string'&&!!v.trim()&&v.length<=2000;
export function validateItemAtWillState(value:unknown):void{
 if(value===undefined)return;if(!plain(value)||!Number.isSafeInteger(value.version)||value.version<1)throw Error('物品随意施法确认记录无效。');if(value.version!==1)return;
 if(!Number.isSafeInteger(value.sequence)||value.sequence<0||!Array.isArray(value.records)||value.records.length>3000)throw Error('物品随意施法确认序号无效。');const ids=new Set<string>(),nonces=new Set<number>();
 for(const r of value.records){if(!plain(r)||!text(r.ownerId)||!text(r.entryId)||!text(r.canonicalEntryId)||typeof r.snapshotSha256!=='string'||!/^[a-f0-9]{64}$/.test(r.snapshotSha256)||typeof r.enabled!=='boolean'||!Number.isSafeInteger(r.nonce)||r.nonce<1||r.nonce>value.sequence||ids.has(r.ownerId)||nonces.has(r.nonce))throw Error('物品随意施法确认归属无效。');ids.add(r.ownerId);nonces.add(r.nonce);}
}
function state(c:Character):ItemAtWillState|undefined{if(c.automation&&!supportedAutomation(c))return;const s=c.automation?.itemAtWill;if(s===undefined)return {version:1,sequence:0,records:[]};try{validateItemAtWillState(s);return s.version===1?s:undefined;}catch{return;}}
export function itemAtWillStateIssue(c:Character):string|undefined{return state(c)?undefined:'物品随意施法确认版本未知或记录损坏，已保留且不会执行或覆盖。';}
const sourceAllowed=(c:Character,e:Entry,canonicalId:string)=>selectionAllowed(c,e)&&c.profile.enabledSources.includes(e.source)&&(e.dependencies||[]).every(s=>c.profile.enabledSources.includes(s))&&!c.profile.disabledEntries?.some(id=>id===e.id||id===canonicalId)&&(e.edition==='both'||e.edition===c.edition);
function currentOwner(c:Character,id:string){const rows=c.selections.filter(s=>s.id===id);return rows.length===1?rows[0]:undefined;}
function ownerReason(c:Character,owner:Selection|undefined,rule:ItemAtWillRule|undefined):string|undefined{
 if(!automationEnabled(c))return '自动计算未启用。';if(!owner||!rule)return '当前物品完整来源、身份或归属未通过核验。';
 if(!sourceAllowed(c,owner.entry,rule.id)||!activeEffectSelections(c).some(s=>s===owner))return '物品来源、版本或依赖当前不可用。';
 if(c.selections.filter(s=>itemAtWillFamilyId(s.entry)===rule.id).length!==1)return '同一来源物品有重复或别名归属，未任选一份。';
 if(owner.quantity!==1)return '只支持唯一一件实物；数量或堆叠归属待核对。';if(owner.equipped!==true)return '请先在背包中标记当前穿戴。';if(rule.requiresAttunement&&owner.attuned!==true)return '此物品需要当前明确同调标记。';
}
export function itemAtWillTarget(c:Character,rule:ItemAtWillRule,grant:ItemAtWillGrant,catalog:Entry[]=[]):Entry|undefined{
 const entries=[...new Map([...c.selections.map(s=>s.entry),...catalog].reverse().map(e=>[e.id,e])).values()];
 const matches=entries.filter(e=>itemAtWillTargetHeader(e,grant.targetEntryId)&&ordinaryCastingRule(e)?.id===grant.targetEntryId&&sourceAllowed(c,e,grant.targetEntryId));
 const canonical=matches.filter(e=>e.id===grant.targetEntryId);return canonical.length===1?canonical[0]:matches.length===1?matches[0]:undefined;
}
export const itemAtWillChildKey=(grant:ItemAtWillGrant)=>`source-spell:item-atwill/${encodeURIComponent(grant.key)}`;
export const itemAtWillChildId=(ownerId:string,grant:ItemAtWillGrant)=>`auto-spell:${ownerId}:${encodeURIComponent(itemAtWillChildKey(grant))}`;
/** A generated ID is not ownership. Never adopt a manual/imported collision or
 * overwrite its unrelated preparation/configuration while reconciling. */
export function itemAtWillChildCollision(c:Character,ownerId:string,grant:ItemAtWillGrant):boolean{
 const id=itemAtWillChildId(ownerId,grant),rows=c.selections.filter(s=>s.id===id);if(!rows.length)return false;if(rows.length!==1)return true;
 const row=rows[0],config=c.spellSettings?.special?.[id],g=config?.sourceGrant,key=itemAtWillChildKey(grant);
 return row.parentId!==ownerId||row.grantKey!==key||ordinaryCastingRule(row.entry)?.id!==grant.targetEntryId||!config||config.mode!=='locked'||config.manualSource!==undefined||config.max!==undefined||config.recovery!==undefined||!g||g.ownerId!==ownerId||g.key!==key||g.usage!=='free'||g.canUseSlots!==false||g.targetScope!==grant.targetScope||g.targetEntryId!==grant.targetEntryId||g.resourceKey!==undefined||g.resourceName!==undefined||g.resourceCost!==undefined||g.ability!==undefined||g.castLevel!==undefined;
}
export function itemAtWillOffer(c:Character,ownerId:string,catalog:Entry[]=[],authority?:SpellActionAuthority):ItemAtWillOffer{
 const owner=currentOwner(c,ownerId),rule=owner&&itemAtWillRule(owner.entry),s=state(c),record=s?.records.find(r=>r.ownerId===ownerId),grants=(rule?.grants||[]).map(g=>({key:g.key,targetEntryId:g.targetEntryId,targetScope:g.targetScope as ItemAtWillTargetScope}));
 const denied=spellActionAuthorityReason(c,authority),physical=ownerReason(c,owner,rule),binding=!!record&&!!rule&&record.entryId===owner?.entry.id&&record.canonicalEntryId===rule.id&&record.snapshotSha256===rule.fullNormalizedSnapshotSha256;
 const collision=grants.some(g=>itemAtWillChildCollision(c,ownerId,g));
 const missing=!!rule&&grants.some(g=>!itemAtWillTarget(c,rule,g,catalog));const reason=!s?itemAtWillStateIssue(c):physical||(collision?'生成的法术身份与手工或其他来源记录冲突，保留原记录且未接管。':!binding&&record?.enabled?'旧确认与当前实物不符，请先撤回旧确认。':missing?'法术完整来源或唯一引用当前不可用。':undefined);
 const eligible=!!s&&!reason,active=eligible&&binding&&record?.enabled===true;
 const basis=sourceTextSha256(JSON.stringify([c.id,c.edition,c.profile,c.automation?.enabled,owner,s?.sequence,record,grants.map(g=>[g,itemAtWillTarget(c,rule!,g,catalog)])]));
 return {ownerId,key:JSON.stringify(['item-atwill',ownerId]),label:owner?.entry.name||record?.canonicalEntryId||'保留的物品来源',eligible,active,canConfirm:eligible&&!denied&&!active,canWithdraw:!!s&&!!record?.enabled&&!denied,reason:denied||reason||(!active?'尚未明确确认当前实物的随意施法来源。':undefined),basis,nonce:record?.nonce||0,requiresAttunement:rule?.requiresAttunement===true,grants,record};
}
/** Source-owned observation for save feedback, including paused/orphan cleanup.
 * Structural version/nonce alone is not a successful confirmation receipt. */
export function itemAtWillObservedIntent(c:Character,ownerId:string):ItemAtWillRecord|undefined{
 const r=state(c)?.records.find(r=>r.ownerId===ownerId);if(!r||!itemAtWillStoredRule(r.canonicalEntryId,r.entryId,r.snapshotSha256))return;
 const owners=c.selections.filter(s=>s.id===ownerId);if(owners.length>1)return;if(owners.length===1){const rule=itemAtWillRule(owners[0].entry);if(!rule||owners[0].entry.id!==r.entryId||rule.id!==r.canonicalEntryId||rule.fullNormalizedSnapshotSha256!==r.snapshotSha256)return;}
 return r;
}
export function itemAtWillOffers(c:Character,catalog:Entry[]=[],authority?:SpellActionAuthority):ItemAtWillOffer[]{const ids=new Set([...c.selections.filter(s=>!!itemAtWillFamilyId(s.entry)).map(s=>s.id),...(state(c)?.records.map(r=>r.ownerId)||[])]);return [...ids].map(id=>itemAtWillOffer(c,id,catalog,authority));}
/** Fresh explicit physical-item intent only; no spell acquisition, quota or pool mutation. */
export function setItemAtWillIntent(c:Character,ownerId:string,intent:{confirmedGenuineOwnedItem:true}|null,catalog:Entry[]=[],authority?:SpellActionAuthority):void{
 const denied=spellActionAuthorityReason(c,authority);if(denied)throw Error(denied);const s=state(c);if(!s||!c.automation)throw Error(itemAtWillStateIssue(c)||'自动计算未启用。');
 const offer=itemAtWillOffer(c,ownerId,catalog,authority),old=s.records.find(r=>r.ownerId===ownerId);if(intent!==null&&(!plain(intent)||Object.keys(intent).length!==1||!Object.hasOwn(intent,'confirmedGenuineOwnedItem')||intent.confirmedGenuineOwnedItem!==true))throw Error('请明确确认当前真实持有物品。');
 if(intent===null){if(!old?.enabled)return;}else if(offer.active)return;else if(!offer.canConfirm)throw Error(offer.reason||'当前物品不能确认。');
 if(s.sequence>=Number.MAX_SAFE_INTEGER)throw Error('物品确认序号已达到上限。');const next=structuredClone(s);next.sequence++;const record=next.records.find(r=>r.ownerId===ownerId);
 if(intent===null){record!.enabled=false;record!.nonce=next.sequence;}else{const owner=currentOwner(c,ownerId)!,r=itemAtWillRule(owner.entry)!;const replacement:ItemAtWillRecord={ownerId,entryId:owner.entry.id,canonicalEntryId:r.id,snapshotSha256:r.fullNormalizedSnapshotSha256,enabled:true,nonce:next.sequence};if(record)Object.assign(record,replacement);else next.records.push(replacement);}
 c.automation.itemAtWill=next;
}
export function revokeItemAtWillOwners(c:Character,removed:ReadonlySet<string>):void{const s=state(c);if(!s||!c.automation)return;const next=structuredClone(s);let changed=false;for(const r of next.records)if(removed.has(r.ownerId)&&r.enabled){if(next.sequence>=Number.MAX_SAFE_INTEGER)throw Error('物品确认序号已达到上限。');r.enabled=false;r.nonce=++next.sequence;changed=true;}if(changed)c.automation.itemAtWill=next;}
export const itemAtWillGrantKey=(grantKey?:string)=>!!grantKey?.startsWith('source-spell:item-atwill/');
export function itemAtWillSpell(c:Character,id:string,authority?:SpellActionAuthority){
 const rows=c.selections.filter(s=>s.id===id),row=rows.length===1?rows[0]:undefined,cached=c.spellSettings?.special?.[id]?.sourceGrant;if(!row||row.entry.kind!=='spell'||!cached||!itemAtWillGrantKey(row.grantKey)||row.parentId!==cached.ownerId||row.grantKey!==cached.key)return;
 const offer=itemAtWillOffer(c,cached.ownerId,[],authority),owner=currentOwner(c,cached.ownerId),rule=owner&&itemAtWillRule(owner.entry);if(!offer.active||!rule)return;
 const grant=offer.grants.find(g=>cached.key===`source-spell:item-atwill/${encodeURIComponent(g.key)}`);if(!grant||ordinaryCastingRule(row.entry)?.id!==grant.targetEntryId||!sourceAllowed(c,row.entry,grant.targetEntryId)||cached.targetScope!==grant.targetScope||cached.targetEntryId!==grant.targetEntryId||cached.usage!=='free'||cached.canUseSlots!==false)return;
 return {offer,owner:owner!,rule,grant,row};
}
export function itemAtWillSpellBasis(c:Character,id:string):string{const current=itemAtWillSpell(c,id);return sourceTextSha256(JSON.stringify([current?.offer.basis,current?.offer.nonce,current?.grant,current?.row,c.spellSettings?.special?.[id]]));}
