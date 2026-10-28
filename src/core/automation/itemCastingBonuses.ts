import {ABILITIES,selectionAllowed,type Ability,type Character,type Entry,type Issue,type Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {ordinaryCastingRule} from './ordinaryCastingIdentity';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './itemCastingBonusEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export interface ItemCastingBonusContext {ability:Ability;casterId?:string;sourceSelectionId?:string}
export type ItemCastingBonusRule=typeof evidence.rules[number];
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const itemCastingBonusSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));
export function itemCastingBonusFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const found=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english);return found.length===1?found[0].id:undefined;
}
/** Only two closed complete original/App forms authorize an item. No class
 * name, raw numeric tag, cached grant or generic holding flag can authorize it. */
export function itemCastingBonusRule(entry:Entry):ItemCastingBonusRule|undefined{
 const id=itemCastingBonusFamilyId(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='item'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==rule.category||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity||typeof entry.raw.reqAttune!=='string')return;
 try{const hash=itemCastingBonusSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.canonicalReboundSnapshotSha256===hash))return rule;}catch{/* Unproved source payload remains unchanged and inactive. */}
}
export interface ItemCastingBonusGrant {selectionId:string;entryId:string;source:string;casterId:string;scope:string;attackBonus:number;dcBonus:number;attunementOwnerIds:string[];snapshotSha256:string}
export interface ItemCastingBonusProjection {attackBonus:number;dcBonus:number;attackTrace:string[];dcTrace:string[];issues:Issue[];grants:ItemCastingBonusGrant[];resolvedCasterId?:string}
type ClassOwner={row:Selection;proof:NonNullable<ReturnType<typeof ordinaryCastingRule>>};
const validIdentity=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=2000&&!value.includes('\0');
const castingShape=(entry:Entry)=>!!(entry.raw.casterProgression||entry.raw.spellcastingAbility||entry.raw.preparedSpells||entry.raw.preparedSpellsProgression||entry.raw.spellsKnownProgression||entry.raw.classTableGroups?.some((g:any)=>g.rowsSpellProgression));
function available(c:Character,entry:Entry,proof:NonNullable<ReturnType<typeof ordinaryCastingRule>>){return selectionAllowed(c,entry)&&c.profile.enabledSources.includes(proof.source)&&(entry.dependencies||[]).every(source=>c.profile.enabledSources.includes(source))&&!c.profile.disabledEntries?.some(id=>id===entry.id||id===proof.id)&&(proof.edition==='both'||proof.edition===c.edition);}
/** Existing ordinary class proof/active/level/unique-owner policy. Physical
 * item quantity/root restrictions are deliberately NOT class prerequisites. */
function classOwners(c:Character,live:Selection[]):ClassOwner[]{
 return c.selections.flatMap(row=>{if(row.entry.kind!=='class')return [];const proof=ordinaryCastingRule(row.entry);return proof?.kind==='class'&&row.entry.packId==='kiwee'&&live.includes(row)&&available(c,row.entry,proof)&&Number.isSafeInteger(row.level)&&row.level>=1&&row.level<=20&&c.selections.filter(other=>other.entry.kind==='class'&&ordinaryCastingRule(other.entry)?.id===proof.id).length===1?[{row,proof}]:[];});
}
/** Pure numeric modifier projection. It creates no class/spell entitlement,
 * source grant, payment route, slot, resource, holding flag or persisted state. */
export function projectItemCastingBonuses(c:Character,context:ItemCastingBonusContext):ItemCastingBonusProjection{
 const out:ItemCastingBonusProjection={attackBonus:0,dcBonus:0,attackTrace:[],dcTrace:[],issues:[],grants:[]},items=c.selections.filter(row=>itemCastingBonusFamilyId(row.entry));if(!items.length)return out;
 const issue=(code:string,message:string,row?:Selection)=>out.issues.push({id:`item-casting-bonus:${code}${row?':'+row.id:''}`,...(row?{selectionId:row.id}:{}),severity:'warning',message});
 if(!automationEnabled(c)){issue('paused','装备施法加值暂停：自动化关闭或协议未知；原记录和手工值保留。');return out;}
 if(!context||typeof context!=='object'||Array.isArray(context)||!Object.hasOwn(context,'ability')||!ABILITIES.includes(context.ability)||Object.keys(context).some(key=>!['ability','casterId','sourceSelectionId'].includes(key))||Object.getOwnPropertySymbols(context).length||(['casterId','sourceSelectionId']as const).some(key=>key in context&&(!Object.hasOwn(context,key)||!validIdentity(context[key])))){issue('context','没有明确核实的当前施法归属；仅保留原有施法数值，不猜测装备加值。');return out;}
 if(Object.hasOwn(context,'sourceSelectionId')){issue('source-cast','来源／物品施法的统计政策保持独立；不借用普通职业装备加值。');return out;}
 const live=activeEffectSelections(c),owners=classOwners(c,live),casters=owners.filter(({row})=>ABILITIES.includes(row.entry.raw.spellcastingAbility)&&['full','half','1/2','artificer','third','1/3','pact'].includes(row.entry.raw.casterProgression));
 let recipient:ClassOwner|undefined;
 const requested=Object.hasOwn(context,'casterId')?context.casterId:c.spellSettings?.abilityClassId;
 if(requested!==undefined){if(typeof requested==='string'&&requested)recipient=casters.find(owner=>owner.row.id===requested);}
 else{
  // Never infer the sole *known* caster while another current unproved or
  // unsupported potential caster exists. Explicit valid contexts are separate.
  const unknown=live.some(row=>{
   if(!['class','subclass'].includes(row.entry.kind))return false;const proof=ordinaryCastingRule(row.entry);if(!proof)return true;
   if(!c.profile.enabledSources.includes(proof.source)||c.profile.disabledEntries?.some(id=>id===row.entry.id||id===proof.id))return false;
   return castingShape(row.entry)&&!casters.some(owner=>owner.row===row);
  });
  if(!unknown&&casters.length===1)recipient=casters[0];
 }
 if(!recipient||recipient.row.entry.raw.spellcastingAbility!==context.ability){issue('caster','当前职业施法归属或原生施法属性尚未核实；不按相同属性、首个职业或手动属性覆盖猜测装备加值。');return out;}
 out.resolvedCasterId=recipient.row.id;
 const eligible:{row:Selection;rule:ItemCastingBonusRule;qualifiers:ClassOwner[]}[]=[];
 for(const row of items){
  const rule=itemCastingBonusRule(row.entry);if(!rule){issue('unproved','此物品的完整来源、版本或身份未通过施法加值核对；原记录保留。',row);continue;}
  if(row.quantity!==1||row.parentId!==undefined||row.grantKey!==undefined||row.requirementId!==undefined||!live.includes(row)||c.selections.filter(other=>itemCastingBonusFamilyId(other.entry)===rule.id).length!==1){issue('owner','物品不是唯一有效的单件实物根记录；装备施法加值暂停。',row);continue;}
  if(!c.profile.enabledSources.includes(rule.source)||(row.entry.dependencies||[]).some(source=>!c.profile.enabledSources.includes(source))||c.profile.disabledEntries?.some(id=>id===row.entry.id||id===rule.id)){issue('source','物品来源或规范／别名身份当前停用；装备施法加值暂停。',row);continue;}
  if(!Object.hasOwn(row,'equipped')||row.equipped!==true||!Object.hasOwn(row,'attuned')||row.attuned!==true){issue('equipment','此受审路线需要当前明确穿戴且同调；装备不被解释为持握。',row);continue;}
  const qualifiers=owners.filter(owner=>rule.attunementRoleIds.includes(owner.proof.id));
  if(!qualifiers.length){issue('attunement-role','当前没有核实的来源职业满足此物品的同调资格；不以施法属性或法术位猜测职业。',row);continue;}
  if(rule.scope==='sorcerer-spells'&&!(rule.recipientRoleIds as readonly string[]).includes(recipient.proof.id)||rule.scope==='spells-using-charisma'&&context.ability!=='cha'){issue('scope','此来源的加值不适用于当前职业／施法属性；其他职业的加值不会因属性相同而借用。',row);continue;}
  if(!['all-your-spells','sorcerer-spells','spells-using-charisma'].includes(rule.scope)){issue('scope','来源施法加值范围未知，暂不计算。',row);continue;}
  eligible.push({row,rule,qualifiers});
 }
 for(const {row,rule,qualifiers}of eligible){
  if(rule.rankOverlapGroup&&eligible.some(other=>other.rule.id!==rule.id&&other.rule.rankOverlapGroup===rule.rankOverlapGroup)){issue('rank-overlap','受审配对的多个等阶同时有效，其叠加政策尚未受审；这部分自动加值暂停，原物品与手工调整保留。',row);continue;}
  const origin=`${rule.name} · ${rule.source}：当前穿戴且同调，职业资格与本次施法范围已核实`;
  out.attackBonus+=rule.attackBonus;out.dcBonus+=rule.dcBonus;out.attackTrace.push(`${origin}，法术攻击 +${rule.attackBonus}。`);out.dcTrace.push(`${origin}，法术豁免 DC +${rule.dcBonus}。`);
  out.grants.push({selectionId:row.id,entryId:rule.id,source:rule.source,casterId:recipient.row.id,scope:rule.scope,attackBonus:rule.attackBonus,dcBonus:rule.dcBonus,attunementOwnerIds:qualifiers.map(owner=>owner.row.id),snapshotSha256:itemCastingBonusSnapshot({...row.entry,id:rule.id,revision:rule.revision})});
 }
 return out;
}
