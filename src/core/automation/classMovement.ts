import type {Character,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {armorType} from './equipment';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './classMovementEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type ClassMovementMode='swim'|'climb';
export type ClassMovementRule=typeof evidence.rules[number];
export interface ClassMovementGrant {selectionId:string;entryId:string;ownerId:string;ownerEntryId:string;source:string;ownerLevel:number;walkingBonus:number;relativeModes:ClassMovementMode[]}
export interface ClassMovementProjection {walkingBonus:number;trace:string[];issues:Issue[];grants:ClassMovementGrant[];relativeModes:ClassMovementMode[]}
export interface ClassMovementModeProjection {modes:Partial<Record<ClassMovementMode,number>>;trace:string[];issues:Issue[]}
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const validId=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=2000&&!value.includes('\0');
const validMode=(value:unknown):value is ClassMovementMode=>value==='swim'||value==='climb';
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const classMovementSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));
function family(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english);return matches.length===1?matches[0].id:undefined;
}
/** Complete feature proof, not a name dispatcher or standalone entitlement. */
export function classMovementRule(entry:Entry):ClassMovementRule|undefined{
 const id=family(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='feature'||!validId(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!=='classFeature'||entry.raw._category!==rule.category||entry.raw.className!==rule.className||entry.raw.classSource!==rule.classSource||entry.raw.level!==rule.level||entry.raw._copy||entry.raw._unresolvedParent)return;
 try{const hash=classMovementSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.completeSnapshotSha256===hash))return rule;}catch{/* Unknown complete payloads remain unchanged and unproved. */}
}
function ownerFamily(entry:Entry,rule:ClassMovementRule):boolean{
 const proof=rule.owner;return !!entry&&(entry.id===proof.id||entry.packId===proof.packId&&entry.source===proof.source&&entry.name===proof.name&&entry.english===proof.english);
}
function ownerProof(entry:Entry,rule:ClassMovementRule):boolean{
 const proof=rule.owner;
 if(!ownerFamily(entry,rule)||entry.kind!=='class'||!validId(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==proof.id&&canonical.has(entry.id)||entry.packId!==proof.packId||entry.source!==proof.source||entry.edition!==proof.edition||entry.name!==proof.name||entry.english!==proof.english||(entry.page??null)!==proof.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!=='class'||entry.raw._copy||entry.raw._unresolvedParent)return false;
 try{return proof.forms.some(form=>form.completeSnapshotSha256===classMovementSnapshot({...entry,id:proof.id,revision:proof.revision}));}catch{return false;}
}
function available(c:Character,entry:Entry,canonicalId:string){return c.profile.enabledSources.includes(entry.source)&&(entry.dependencies||[]).every(source=>c.profile.enabledSources.includes(source))&&!c.profile.disabledEntries?.some(id=>id===entry.id||id===canonicalId);}
function held(entry:Entry){return !!entry&&typeof entry==='object'&&evidence.holds.flatMap(group=>group.features).some(proof=>proof.id===entry.id||proof.packId===entry.packId&&proof.source===entry.source&&proof.name===entry.name&&proof.english===entry.english);}

/** Pure owned native class-feature projection. It never attaches a grant,
 * rewrites a class or uses total character/child level for the Monk table.
 * Existing saved-source availability is independent of card display edition. */
export function projectClassMovement(c:Character,providedActive?:readonly Selection[]):ClassMovementProjection{
 const out:ClassMovementProjection={walkingBonus:0,trace:[],issues:[],grants:[],relativeModes:[]},live=activeEffectSelections(c),candidates=c.selections.filter(row=>family(row.entry)||held(row.entry));
 const warn=(row:Selection,code:string,message:string)=>{out.issues.push({id:`class-movement:${code}:${row.id}`,selectionId:row.id,severity:'warning',message});out.trace.push(message);};
 for(const feature of candidates){
  const rule=classMovementRule(feature.entry);
  if(!rule){warn(feature,held(feature.entry)?'held':'unproved',held(feature.entry)?'此可选替换特性的真实选择尚未核实；普通自动挂接不证明替换选择，不计本批职业移动。':'此职业移动特性的完整来源、身份或版本尚未核实；原记录与手工效果保留。');continue;}
  if(!automationEnabled(c)){warn(feature,'paused','职业移动暂停：自动化关闭或协议未知；原归属、步行和手工记录保留。');continue;}
  const owners=c.selections.filter(row=>row.entry.kind==='class'&&ownerFamily(row.entry,rule)),owner=owners[0];
  if(owners.length!==1||!owner||!Object.hasOwn(owner,'id')||!validId(owner.id)||owner.parentId!==undefined||owner.grantKey!==undefined||owner.requirementId!==undefined||!ownerProof(owner.entry,rule)||!Number.isSafeInteger(owner.level)||owner.level<rule.minLevel||owner.level>20){warn(feature,'owner','当前没有唯一、完整且达到该来源等级的根职业；不借用其他职业或总等级。');continue;}
  const ref=rule.owner.declaredReference.ref,refs=owner.entry.raw.classFeatures;
  if(!Object.hasOwn(feature,'id')||!validId(feature.id)||feature.parentId!==owner.id||feature.grantKey!==rule.grantKey||rule.grantKey!==`ref:${ref}`||!Array.isArray(refs)||!refs.some(block=>(typeof block==='string'?block:block?.classFeature)===ref)||c.dismissedFeatures?.includes(`${owner.id}|${rule.grantKey}`)||c.selections.filter(row=>family(row.entry)===rule.id).length!==1){warn(feature,'grant','来源职业、声明引用、父项、挂接键或撤回状态不一致；未把手工副本当作职业授予。');continue;}
  if(!available(c,owner.entry,rule.owner.id)||!available(c,feature.entry,rule.id)){warn(feature,'source','职业或特性的来源、实际依赖或规范／别名身份停用；职业移动暂停，原记录保留。');continue;}
  if(!live.includes(owner)||!live.includes(feature)||providedActive&&(!providedActive.includes(owner)||!providedActive.includes(feature))){warn(feature,'inactive','职业和特性当前未共同生效；外部列表不能授权替代归属。');continue;}
  // Physical wearing is retained even when an item's effect source or entry is
  // disabled. Reading that condition does not grant the item's effects or AC.
  const worn=c.selections.filter(row=>row.entry.kind==='item'&&row.equipped&&row.quantity>0),types=worn.map(row=>row.entry.raw&&typeof row.entry.raw==='object'?armorType(row.entry):undefined),unknownArmor=worn.some((row,index)=>!types[index]&&(row.entry.raw?.armor===true||row.entry.raw?._customType==='armor'));
  const blocked=unknownArmor||(rule.walkingPolicy==='no-heavy-armor'?types.includes('HA'):rule.walkingPolicy==='no-armor-and-no-shield'?types.some(type=>type!==undefined):true);
  const modes=rule.relativeModes.filter(validMode) as ClassMovementMode[],levelBonuses=(rule as {levelBonuses?:number[]}).levelBonuses;
  const bonus=levelBonuses?.[owner.level-1]??rule.walkingBonus;
  if(!Number.isSafeInteger(bonus)||bonus===null||bonus<0){warn(feature,'unproved','此职业自身等级的移动表或数值尚未核实；未推定加值。');continue;}
  if(blocked)warn(feature,'equipment',unknownArmor?'当前穿戴护甲分类不明确；这部分步行加值暂停，其他手工数据不变。':rule.walkingPolicy==='no-heavy-armor'?'当前穿戴重甲；只暂停此步行加值，独立核实的关联移动模式不受该条件限制。':'当前穿戴护甲或使用盾牌；无甲移动的步行加值暂停。');
  if(blocked&&!modes.length)continue;
  const walkingBonus=blocked?0:bonus;out.walkingBonus+=walkingBonus;
  for(const mode of modes)if(!out.relativeModes.includes(mode))out.relativeModes.push(mode);
  out.grants.push({selectionId:feature.id,entryId:rule.id,ownerId:owner.id,ownerEntryId:rule.owner.id,source:rule.source,ownerLevel:owner.level,walkingBonus,relativeModes:modes});
  if(walkingBonus)out.trace.push(`${rule.name} · ${rule.source}：所属职业 ${owner.entry.name} ${owner.level} 级，条件已核实，步行速度 +${walkingBonus} 尺。`);
 }
 return out;
}

/** Resolve Ranger's independently declared modes only after the caller's final
 * walking math. Reauthenticate current ownership instead of trusting a supplied
 * marker. No wall, water-surface, map or turn execution is implied. */
export function projectClassMovementModes(c:Character,finalWalking:number,providedActive?:readonly Selection[]):ClassMovementModeProjection{
 const current=projectClassMovement(c,providedActive),out:ClassMovementModeProjection={modes:{},trace:[],issues:current.issues};
 if(!current.relativeModes.length)return out;
 if(typeof finalWalking!=='number'||!Number.isFinite(finalWalking)||finalWalking<0){const message='当前最终步行结果无效或为负；职业关联速度暂停，不修补步行或退回基础值。';out.issues.push({id:'class-movement:walking-context',severity:'warning',message});out.trace.push(message);return out;}
 for(const mode of current.relativeModes)out.modes[mode]=finalWalking;
 for(const grant of current.grants.filter(row=>row.relativeModes.length))out.trace.push(`${rules.get(grant.entryId)!.name} · ${grant.source}：游泳与攀爬速度均等于当前最终步行 ${finalWalking} 尺；仅投影数值，地图、地形及其他条件仍需手工处理。`);
 return out;
}
