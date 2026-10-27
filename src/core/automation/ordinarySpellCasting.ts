import {ABILITIES,selectionAllowed,type Character,type Entry,type RuntimeResource,type Selection} from '../model';
import {casterProfiles,cantripCapacity,type CasterProfile} from '../spellcastingRules';
import {profilePreparation} from '../preparation';
import {spellState} from '../characterDetails';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {syncAutoResources} from '../resources';
import {sourceTextSha256} from './sourceTextSha256';
import {spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
import evidence from './ordinarySpellCastingEvidence.json' with {type:'json'};
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const ordinaryCastingSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted({raw:entry.raw,entries:entry.entries,effects:entry.effects,choices:entry.choices,dependencies:entry.dependencies})));
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(evidence.canonicalIds);
/** Full catalog snapshot proof, not a name, slot marker, cached grant or revision. */
export function ordinaryCastingRule(entry:Entry){
 if(!entry||!['spell','class','subclass'].includes(entry.kind)||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._copy||entry.raw._unresolvedParent||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000)return;
 const same=(r:typeof evidence.rules[number])=>r.kind===entry.kind&&r.source===entry.source&&r.packId===entry.packId&&r.edition===entry.edition&&r.name===entry.name&&r.english===entry.english&&r.page===(entry.page??null);
 const exact=rules.get(entry.id),matches=exact?[exact]:canonical.has(entry.id)?[]:evidence.rules.filter(same);
 const candidates=matches.filter(same);if(candidates.length!==1)return;const rule=candidates[0];if(rule.snapshotSha256!==ordinaryCastingSnapshot(entry))return;return rule;
}
/** Reserve source-qualified class identities before any legacy raw decoder.
 * A foreign same-name/source-pack domain is not this family. */
export function ordinaryCastingClassContextMalformed(c:Character):boolean{
 return c.selections.some(({entry})=>{
  if(!['class','subclass'].includes(entry.kind))return false;
  const known=rules.has(entry.id)||canonical.has(entry.id)||evidence.rules.some(r=>['class','subclass'].includes(r.kind)&&r.packId===entry.packId&&r.name===entry.name&&r.english===entry.english&&(r.source===entry.source||r.source===entry.raw?.source));
  return known&&!ordinaryCastingRule(entry);
 });
}
const key=(v:unknown)=>String(v??'').trim().toLowerCase();
/** Direct base-class access only: variant/optional and expanded lists remain held. */
export function ordinaryDirectBaseClassList(entry:Entry,profile:CasterProfile):boolean{
 const names=[profile.owner.entry.name,profile.owner.entry.english,profile.owner.entry.raw.name,profile.owner.entry.raw.ENG_name].map(key),source=key(profile.owner.entry.source),raw=entry.raw;
 const matches=(row:any)=>row&&key(row.source||'PHB')===source&&[row.name,row.ENG_name].some(n=>names.includes(key(n)));
 if(Array.isArray(raw.classes?.fromClassList)&&raw.classes.fromClassList.some(matches))return true;
 const lookup=raw._spellClasses;if(lookup&&typeof lookup==='object'&&!Array.isArray(lookup))for(const [book,classes] of Object.entries(lookup))if(key(book)===source&&classes&&typeof classes==='object'&&!Array.isArray(classes))for(const [name,definition] of Object.entries(classes)){if(!names.includes(key(name)))continue;const d=definition as any;if(d===true||d&&typeof d==='object'&&!Array.isArray(d)&&!d.definedInSource&&!d.isVariant)return true;}
 return false;
}
function allowed(c:Character,entry:Entry){const proof=ordinaryCastingRule(entry);return !!proof&&selectionAllowed(c,entry)&&c.profile.enabledSources.includes(proof.source)&&(entry.dependencies||[]).every(id=>c.profile.enabledSources.includes(id))&&!c.profile.disabledEntries?.some(id=>id===entry.id||id===proof.id)&&(proof.edition==='both'||proof.edition===c.edition);}
function profiles(c:Character):CasterProfile[]{
 const active=activeEffectSelections(c),ids=new Set(active.map(s=>s.id));
 const baseView={...c,selections:c.selections.filter(s=>s.entry.kind==='class')};
 return casterProfiles(baseView).filter(p=>p.owner.entry.packId==='kiwee'&&p.casting.id===p.owner.id&&ids.has(p.owner.id)&&ids.has(p.casting.id)&&Number.isSafeInteger(p.owner.level)&&p.owner.level>=1&&p.owner.level<=20&&allowed(c,p.owner.entry)&&allowed(c,p.casting.entry)&&ABILITIES.includes(p.casting.entry.raw.spellcastingAbility)&&['full','half','1/2','artificer','third','1/3','pact'].includes(p.casting.entry.raw.casterProgression)&&c.selections.filter(s=>s.entry.kind==='class'&&ordinaryCastingRule(s.entry)?.id===ordinaryCastingRule(p.owner.entry)?.id).length===1&&(()=>{const rule=ordinaryCastingRule(p.casting.entry)!;return p.casting.entry.kind!=='subclass'||rule.minLevel!==null&&p.owner.level>=rule.minLevel;})());
}
function exactlyAllocated(ids:unknown,id:string,capacity:number){return Array.isArray(ids)&&ids.every(v=>typeof v==='string')&&ids.filter(v=>v===id).length===1&&ids.indexOf(id)<capacity&&new Set(ids.filter(Boolean)).size===ids.filter(Boolean).length;}
function ready(c:Character,row:Selection,p:CasterProfile):boolean{
 if(c.spellSettings?.modeOverride)return false;const base=row.entry.raw.level;if(!Number.isSafeInteger(base)||base<0||base>9||base>p.maxLevel||!ordinaryDirectBaseClassList(row.entry,p))return false;
 if(base===0)return exactlyAllocated(c.spellSettings?.cantrips?.[p.owner.id],row.id,cantripCapacity(p));
 const ids=c.spellSettings?.classSpells?.[p.owner.id];if(!Array.isArray(ids))return false;
 if(p.mode==='known'){const n=p.casting.entry.raw.spellsKnownProgression?.[p.owner.level-1]??p.casting.entry.raw.preparedSpellsProgression?.[p.owner.level-1];return Number.isSafeInteger(n)&&n>=0&&exactlyAllocated(ids,row.id,n);}
 if(!exactlyAllocated(ids,row.id,10000))return false;
 const n=profilePreparation(c,p),state=spellState(c);if(n===undefined||!exactlyAllocated(state.prepared,row.id,state.capacity))return false;
 const ownPrepared=state.prepared.slice(0,state.capacity).filter(id=>ids.includes(id));return exactlyAllocated(ownPrepared,row.id,n);
}
/** Computes source-declared current capacities on a disposable class-only card.
 * Never adopts or repairs the real pools; all unknown class contexts hold payment. */
function slotPlan(c:Character,eligible:CasterProfile[]):Map<string,number>{
 const classes=c.selections.filter(s=>s.entry.kind==='class'),activeIds=new Set(activeEffectSelections(c).map(s=>s.id));
 const noncaster=(s:Selection)=>s.entry.packId==='kiwee'&&activeIds.has(s.id)&&allowed(c,s.entry)&&Number.isSafeInteger(s.level)&&s.level>=1&&s.level<=20&&classes.filter(other=>ordinaryCastingRule(other.entry)?.id===ordinaryCastingRule(s.entry)?.id).length===1&&!s.entry.raw.casterProgression&&!s.entry.raw.spellcastingAbility&&!s.entry.raw.preparedSpells&&!s.entry.raw.preparedSpellsProgression&&!s.entry.raw.spellsKnownProgression&&!s.entry.raw.classTableGroups?.some((g:any)=>g.rowsSpellProgression);
 if(classes.some(s=>!eligible.some(p=>p.owner.id===s.id)&&!noncaster(s))||eligible.filter(p=>p.casting.entry.raw.casterProgression==='pact').length>1)return new Map();
 const disposable=structuredClone(c);disposable.selections=[...classes,...eligible.filter(p=>p.casting.id!==p.owner.id).map(p=>p.casting)].map(s=>structuredClone(s));disposable.runtime={hp:0,tempHp:0,inspiration:0,resources:{}};delete disposable.spellSettings;syncAutoResources(disposable);
 const hasOrdinary=eligible.some(p=>p.casting.entry.raw.casterProgression!=='pact');
 return new Map(Object.entries(disposable.runtime.resources).filter(([id])=>/^(?:spell|pact)-slot:[1-9]$/.test(id)&&(hasOrdinary||!id.startsWith('spell-slot:'))).map(([id,r])=>[id,r.max]));
}
function ownedPool(c:Character,id:string,r:RuntimeResource|undefined,max:number){if(!r||r.automatic!==true||r.unlimited||r.featureGrant||r.sourceSpellGrant||!Number.isSafeInteger(r.max)||r.max!==max||!Number.isSafeInteger(r.current)||r.current<0||r.current>max)return false;if(id.startsWith('spell-slot:')){const mirror=c.spellSettings?.slots[id.split(':')[1]];if(!mirror||mirror.max!==r.max||mirror.used!==r.max-r.current)return false;}return true;}
export interface OrdinarySpellPayment {id:string;label:string;level:number;resourceId?:string;cost:number;available:boolean;reason?:string;debits?:{resourceId:string;cost:number}[]}
export interface OrdinarySpellOffer {options:OrdinarySpellPayment[];casters:{id:string;name:string;ability:string}[];casterId?:string;requiresCaster?:boolean;reason?:string}
export function ordinarySpellOffer(c:Character,id:string,casterId?:string,authority?:SpellActionAuthority):OrdinarySpellOffer{
 const empty=(reason:string):OrdinarySpellOffer=>({options:[],casters:[],reason}),rows=c.selections.filter(s=>s.id===id),row=rows[0];
 if(!automationEnabled(c)||rows.length!==1||row.entry.kind!=='spell'||row.parentId||row.grantKey||row.requirementId||c.spellSettings?.special?.[id]||!allowed(c,row.entry))return empty('没有已核实的普通职业法术归属；来源或特殊法术不改走普通支付。');
 const contexts=c.selections.filter(s=>['class','subclass'].includes(s.entry.kind));
 if(!contexts.some(s=>s.entry.kind==='class')||contexts.some(s=>s.entry.packId!=='kiwee'||!allowed(c,s.entry)))return empty('职业快照尚未通过当前原生主职业来源核验；未知／已修改职业不自动解码或施法。');
 const active=activeEffectSelections(c);if(!active.some(s=>s.id===id))return empty('法术来源当前不可用。');
 const all=profiles(c),eligible=all.filter(p=>ready(c,row,p)),casters=eligible.map(p=>({id:p.owner.id,name:p.owner.entry.name,ability:p.casting.entry.raw.spellcastingAbility}));
 const resolved=casterId?eligible.find(p=>p.owner.id===casterId):eligible.length===1?eligible[0]:undefined,result:OrdinarySpellOffer={options:[],casters,requiresCaster:eligible.length>1,...(resolved?{casterId:resolved.owner.id}:{})};
 if(!resolved)return {...result,reason:eligible.length>1?'请选择本次施法所属的职业。':'当前没有明确拥有且已学习／预备的职业法术资格。'};
 const base=row.entry.raw.level,denied=spellActionAuthorityReason(c,authority);
 if(base===0){result.options.push({id:'ordinary:cantrip',label:'普通职业戏法（不消耗法术位；效果手动）',level:0,cost:0,available:!denied,...(denied?{reason:denied}:{})});return result;}
 for(const [resourceId,max] of slotPlan(c,all)){const level=Number(resourceId.split(':')[1]),r=c.runtime.resources[resourceId];if(level<base||!ownedPool(c,resourceId,r,max))continue;const reason=spellActionAuthorityReason(c,authority,[resourceId])||(r.current<1?'所选法术位不足。':undefined);result.options.push({id:`ordinary:${resourceId}`,label:`${level}环${resourceId.startsWith('pact-')?'契约':'普通法术'}位（${r.current} / ${r.max}；效果手动）`,level,resourceId,cost:1,available:!reason,...(reason?{reason}:{})});}
 return {...result,...(!result.options.length?{reason:'没有当前已核实的原生主职业自动法术位，或镜像不一致；子职／其他职业模型和手工池不会被接管。'}:{})};
}
export function ordinarySpellActionBasis(c:Character,id:string,casterId?:string):string{
 return sourceTextSha256(JSON.stringify(sorted([c.id,c.revision,c.edition,c.profile,c.automation,c.spellSettings,c.selections.map(s=>[s.id,s.entry.id,s.entry.kind,s.entry.source,s.entry.edition,s.entry.packId,s.entry.name,s.entry.english,ordinaryCastingSnapshot(s.entry),s.level,s.parentId,s.grantKey,s.requirementId]),Object.entries(c.runtime.resources).filter(([id])=>/^(?:spell|pact)-slot:[1-9]$/.test(id)),id,casterId])));
}
