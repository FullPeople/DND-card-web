import {evaluateAbilityAdvancements} from './abilityAdvancements';
import {ABILITIES,selectionEffectsAllowed,type Ability,type Character,type Entry,type Issue,type Selection} from '../model';
import {matchesReference} from '../entryReferences';
import {automationEnabled} from './state';
import {baseAbilityScores} from './baseAbilities';
import {activeEffectSelections} from './active';
import asiEvidence from './asiEvidence.json' with {type:'json'};
import legacyAsiEvidence from './legacyAsiEvidence.json' with {type:'json'};
import evidence from './classChoiceEvidence.json' with {type:'json'};

export interface AsiBinding {kind?:'legacy-class';selectionId:string;choiceId:string;entryId:string;allocation:Partial<Record<Ability,number>>}
export interface AsiAllocationState {version:1;bindings:AsiBinding[]}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function validAllocation(value:unknown):value is AsiBinding['allocation']{
 if(!object(value))return false;const pairs=Object.entries(value);
 return pairs.every(([key,value])=>ABILITIES.includes(key as Ability)&&Number.isSafeInteger(value))&&
  (pairs.length===1&&pairs[0][1]===2||pairs.length===2&&pairs.every(([,value])=>value===1));
}
/** This is deliberately not a generic executor for raw.ability. Both reviewed
 * alternatives and canonical source identity must match; display labels cannot
 * authorize an otherwise unknown/custom feat. */
export function asiRule(entry:Entry):boolean{
 const r=entry.raw;
 if(entry.kind!=='feat'||entry.english!==asiEvidence.english||entry.source!==asiEvidence.source||entry.edition!=='2024'||r._category!=='feat'||r._copy||r._unresolvedParent||entry.effects?.length||entry.choices?.length||r.category!=='G'||r.repeatable!==true||JSON.stringify(r.prerequisite)!=='[{"level":4}]')return false;
 if(!Array.isArray(r.ability)||r.ability.length!==2)return false;
 return r.ability.every((row:unknown,index:number)=>{
  if(!object(row)||Object.keys(row).some(k=>!['choose','hidden'].includes(k))||row.hidden!==undefined&&row.hidden!==true||!object(row.choose))return false;
  const choice=row.choose;
  return Object.keys(choice).every(k=>['from','amount','count'].includes(k))&&Array.isArray(choice.from)&&choice.from.length===6&&new Set(choice.from).size===6&&ABILITIES.every(a=>choice.from instanceof Array&&choice.from.includes(a))&&
   (index===0?choice.amount===2&&(choice.count===undefined||choice.count===1):(choice.amount===undefined||choice.amount===1)&&choice.count===2);
 });
}
export const isSupportedAsi=asiRule;
// Saved source mechanics follow selectionEffectsAllowed, not the catalog's
// current creation-edition filter. Every ancestor must still exist and work.
function activeAsiSelections(c:Character):Selection[]{
 return c.selections.filter(row=>{let current:Selection|undefined=row;const seen=new Set<string>();while(current){if(seen.has(current.id)||!selectionEffectsAllowed(c,current.entry))return false;seen.add(current.id);if(!current.parentId)return true;current=c.selections.find(parent=>parent.id===current!.parentId);}return false;});
}

function eligibleModernGrant(c:Character,choiceId:string,active=activeAsiSelections(c)):{row:Selection;level:number}|undefined{
 if(!automationEnabled(c))return;
 const safe=new Set(activeAsiSelections(c).map(row=>row.id));active=active.filter(row=>safe.has(row.id));
 const rows=active.filter(row=>row.requirementId===choiceId&&asiRule(row.entry));if(rows.length!==1)return;
 const row=rows[0],owner=active.find(parent=>parent.id===row.parentId);
 if(!owner||owner.entry.kind!=='class'||owner.entry.edition!=='2024'||owner.entry.source!=='XPHB'||owner.entry.raw._copy||owner.entry.raw._unresolvedParent||!Number.isSafeInteger(owner.level)||owner.level<4||owner.level>20||!selectionEffectsAllowed(c,owner.entry)||!selectionEffectsAllowed(c,row.entry)||row.grantKey!==`choice:${choiceId}:${row.entry.id}`||c.answers[choiceId]?.length!==1||c.answers[choiceId][0]!==row.entry.id)return;
 const prefix=`${owner.id}:class-typed-feat:`;if(!choiceId.startsWith(prefix))return;
 const featureId=choiceId.slice(prefix.length),features=active.filter(r=>r.parentId===owner.id&&r.entry.id===featureId&&r.entry.kind==='feature');if(features.length!==1)return;
 const feature=features[0],raw=feature.entry.raw;
 if(feature.entry.english!=='Ability Score Improvement'||feature.entry.source!=='XPHB'||feature.entry.edition!=='2024'||raw._category!=='classFeature'||raw._copy||raw._unresolvedParent||feature.entry.effects?.length||!selectionEffectsAllowed(c,feature.entry)||!Number.isSafeInteger(raw.level)||raw.level>owner.level||c.dismissedFeatures?.includes(`${owner.id}|${feature.grantKey}`))return;
 const reviewed=evidence.modernFeatChoices.find(record=>record.owner===`${owner.entry.english}|${owner.entry.source}`&&record.level===raw.level&&matchesReference(feature.entry,record.feature));if(!reviewed)return;
 const refs=Array.isArray(owner.entry.raw.classFeatures)?owner.entry.raw.classFeatures:[];
 const declared=refs.some((r:unknown)=>{const ref=typeof r==='string'?r:object(r)?r.classFeature:undefined;return typeof ref==='string'&&feature.grantKey===`ref:${ref}`&&matchesReference(feature.entry,ref);});
 if(!declared||!feature.entry.entries.some(node=>typeof node==='string'&&[...node.matchAll(/\{@feat ([^}]+)\}/g)].some(match=>match[1].split('|').length===2&&match[1].split('|')[1]==='XPHB'&&matchesReference(row.entry,match[1]))))return;
 return {row,level:raw.level};
}
/** Legacy ASI is the class feature itself, not a synthetic feat grant. */
export function legacySourceIdentity(owner:Selection,feature:Selection,choiceId:string):boolean{
 const e=feature.entry,r=e.raw;
 if(owner.entry.kind!=='class'||owner.entry.edition!=='2014'||!['PHB','TCE'].includes(owner.entry.source)||owner.entry.raw._copy||owner.entry.raw._unresolvedParent||e.kind!=='feature'||!(e.edition==='2014'||e.edition==='both'&&e.source==='TCE'&&r._classEdition==='2014')||e.source!==owner.entry.source||e.english!=='Ability Score Improvement'||r._category!=='classFeature'||r._copy||r._unresolvedParent||r.ability!==undefined||e.effects?.length||e.choices?.length||feature.parentId!==owner.id||choiceId!==`${owner.id}:class-legacy-feat:${e.id}`)return false;
 if(!legacyAsiEvidence.profiles.some(row=>row.owner===`${owner.entry.english}|${owner.entry.source}`&&row.level===r.level&&matchesReference(e,row.feature)))return false;
 return Array.isArray(owner.entry.raw.classFeatures)&&owner.entry.raw.classFeatures.some((raw:unknown)=>{const ref=typeof raw==='string'?raw:object(raw)?raw.classFeature:undefined;return typeof ref==='string'&&feature.grantKey===`ref:${ref}`&&matchesReference(e,ref);});
}
/** The source grant is independent of which legacy alternative was selected. */
export function eligibleLegacySource(c:Character,choiceId:string,active=activeAsiSelections(c)):{row:Selection;owner:Selection;level:number}|undefined{
 if(!automationEnabled(c))return;
 const safe=new Set(activeAsiSelections(c).map(row=>row.id));active=active.filter(row=>safe.has(row.id));
 const candidates=active.flatMap(row=>{const owner=active.find(parent=>parent.id===row.parentId);return owner&&legacySourceIdentity(owner,row,choiceId)&&Number.isSafeInteger(owner.level)&&owner.level>=row.entry.raw.level&&owner.level<=20&&!c.dismissedFeatures?.includes(`${owner.id}|${row.grantKey}`)?[{row,owner,level:row.entry.raw.level}]:[];});
 if(candidates.length!==1)return;const grant=candidates[0];
 // An imported alias cannot turn one declared source feature into two slots.
 if(active.filter(row=>row.entry.kind==='class'&&row.entry.english===grant.owner.entry.english&&row.entry.source===grant.owner.entry.source&&row.entry.edition===grant.owner.entry.edition).length!==1)return;
 if(active.filter(row=>row.parentId===grant.owner.id&&(row.grantKey===grant.row.grantKey||row.entry.kind==='feature'&&row.entry.english===grant.row.entry.english&&row.entry.source===grant.row.entry.source&&row.entry.raw.level===grant.level)).length!==1)return;
 return grant;
}
function eligibleLegacyGrant(c:Character,choiceId:string,active=activeAsiSelections(c)):{row:Selection;level:number;kind:'legacy-class'}|undefined{
 const grant=eligibleLegacySource(c,choiceId,active);
 if(grant&&c.answers[choiceId]?.length===1&&c.answers[choiceId][0]===`${grant.owner.entry.id}#legacy-ability-record`)return {row:grant.row,level:grant.level,kind:'legacy-class'};
}
function eligibleGrant(c:Character,choiceId:string,active=activeAsiSelections(c)):{row:Selection;level:number;kind?:'legacy-class'}|undefined{
 return eligibleModernGrant(c,choiceId,active)||eligibleLegacyGrant(c,choiceId,active);
}
/** Display support only. Actual mutation and execution independently authenticate
 * the live source-feature grant and explicitly chosen manual plan. */
export function isSupportedAsiChoice(c:Character,choiceId:string,entry:Entry):boolean{
 if(asiRule(entry))return true;
 if(entry.raw._classAbilityRecord!==true)return false;
 return c.selections.some(owner=>entry.id===`${owner.entry.id}#legacy-ability-record`&&[...c.selections,...Object.values(c.classChoiceArchive||{}).flatMap(a=>a.selections.slice(0,1))].some(feature=>legacySourceIdentity(owner,feature,choiceId)));
}
/** Only the explicitly allocated legacy feature tree may be parked. The
 * archive owns the original IDs, manual descendants and unchanged runtime. */
export function preserveLegacyAsiGrants(c:Character):boolean{
 // Preserve the preexisting unknown-ASI boundary. A known passive-feat intent
 // cannot authorize moving a tree whose ASI ownership version is unsupported.
 if(c.asiAllocations&&c.asiAllocations.version!==1)return false;
 let changed=false;
 const bindings=[...(c.asiAllocations?.version===1?c.asiAllocations.bindings.filter(row=>row.kind==='legacy-class'):[]),...(c.reviewedFeats?.version===1?c.reviewedFeats.bindings.map(row=>({selectionId:row.selectionId,choiceId:row.choiceId,entryId:undefined})):[])];
 for(const binding of bindings){
  const root=c.selections.find(row=>row.id===binding.selectionId),owner=root&&c.selections.find(row=>row.id===root.parentId);
  if(!root||!owner||binding.entryId!==undefined&&root.entry.id!==binding.entryId||!legacySourceIdentity(owner,root,binding.choiceId)||owner.level>=root.entry.raw.level)continue;
  if(c.classChoiceArchive?.[root.id])throw Error('职业属性提升保留身份冲突，请保留角色备份。');
  const tree:Selection[]=[root],ids=new Set([root.id]);for(let i=0;i<tree.length;i++)for(const row of c.selections)if(row.parentId===tree[i].id&&!ids.has(row.id)){ids.add(row.id);tree.push(row);}
  if(ids.has(owner.id))continue; // Malformed cycles must never archive their owner.
  c.classChoiceArchive={...c.classChoiceArchive,[root.id]:{choiceId:binding.choiceId,kind:'legacy-asi',parent:structuredClone(owner),selections:structuredClone(tree)}};
  c.selections=c.selections.filter(row=>!ids.has(row.id));changed=true;
 }
 for(const [id,archive] of Object.entries(c.classChoiceArchive||{})){
  const root=archive.selections[0],owner=c.selections.find(row=>row.id===root.parentId);
  if(archive.kind!=='legacy-asi'||!owner||!legacySourceIdentity(owner,root,archive.choiceId)||!Number.isSafeInteger(owner.level)||owner.level<root.entry.raw.level||owner.level>20||!activeAsiSelections(c).some(row=>row.id===owner.id)||!selectionEffectsAllowed(c,root.entry)||c.dismissedFeatures?.includes(`${owner.id}|${root.grantKey}`)||!archive.parent||owner.entry.id!==archive.parent.entry.id)continue;
  if(archive.selections.some(row=>c.selections.some(current=>current.id===row.id))||c.selections.some(row=>row.parentId===owner.id&&row.grantKey===root.grantKey))continue;
  c.selections.push(...structuredClone(archive.selections));delete c.classChoiceArchive![id];if(!Object.keys(c.classChoiceArchive!).length)delete c.classChoiceArchive;changed=true;
 }
 return changed;
}
export const asiGrantLevel=(c:Character,choiceId:string,active?:Selection[])=>eligibleGrant(c,choiceId,active)?.level;
export function evaluateAsiAllocations(c:Character,base:Record<Ability,number>,active?:Selection[],only?:AsiBinding){
 const bonuses=Object.fromEntries(ABILITIES.map(a=>[a,0])) as Record<Ability,number>,trace=Object.fromEntries(ABILITIES.map(a=>[a,[] as string[]])) as Record<Ability,string[]>;
 const issues:Issue[]=[],states=new Map<string,{active:boolean;reason?:string}>(),out={bonuses,trace,issues,states};
 if(!c.asiAllocations)return out;
 if(c.asiAllocations.version!==1){issues.push({id:'asi-version',severity:'warning',message:'此属性提升记录版本尚未支持，原记录保留且未生效。'});return out;}
 active??=activeAsiSelections(c);
 const bindings=c.asiAllocations.bindings;
 // Grant order, not click/import order, decides which earlier allocation fits
 // below the cap. A rejected allocation never silently spends fewer points.
 const ordered=[...bindings].sort((a,b)=>(eligibleGrant(c,a.choiceId,active)?.level??99)-(eligibleGrant(c,b.choiceId,active)?.level??99)||a.choiceId.localeCompare(b.choiceId));
 for(const binding of only?[only]:ordered){
  const grant=eligibleGrant(c,binding.choiceId,active);let reason:string|undefined;
  if(!automationEnabled(c))reason='自动化当前未启用';
  else if(!grant||grant.row.id!==binding.selectionId||grant.row.entry.id!==binding.entryId||grant.kind!==binding.kind)reason='本次职业授予、所选专长、等级或来源当前不可用';
  else if(!validAllocation(binding.allocation))reason='属性分配结构无效';
  else if(bindings.filter(b=>b.selectionId===binding.selectionId||b.choiceId===binding.choiceId).length!==1)reason='本次授予存在重复分配记录';
  else if(ABILITIES.some(a=>binding.allocation[a]!==undefined&&(!Number.isFinite(base[a])||base[a]+bonuses[a]+binding.allocation[a]!>20)))reason='本次分配将超过属性上限 20，请调整分配或手工基础值';
  states.set(binding.selectionId,{active:!reason,reason});
  if(reason){issues.push({id:`asi:${binding.selectionId}`,selectionId:binding.selectionId,severity:'warning',message:`属性提升暂不生效：${reason}；原记录保留。`});continue;}
  for(const ability of ABILITIES){const amount=binding.allocation[ability]||0;if(amount){bonuses[ability]+=amount;trace[ability].push(`${grant!.row.entry.name} · ${grant!.row.entry.source}（职业 ${grant!.level} 级）：显式分配 +${amount}`);}}
 }
 return out;
}
export interface AsiAllocationStatus {selectionId?:string;eligible:boolean;binding?:AsiBinding;active:boolean;reason?:string}
export function asiAllocationStatus(c:Character,choiceId:string):AsiAllocationStatus{
 if(c.asiAllocations&&c.asiAllocations.version!==1)return {eligible:false,active:false,reason:'此属性提升记录版本尚未支持，原记录保留。'};
 const grant=eligibleGrant(c,choiceId),binding=c.asiAllocations?.bindings.find(row=>row.choiceId===choiceId);
 const base=baseAbilityScores(c,activeEffectSelections(c)).abilities,state=binding?evaluateAbilityAdvancements(c,base).asi.states.get(binding.selectionId):undefined;
 return {selectionId:grant?.row.id,eligible:!!grant,binding,active:state?.active??false,reason:state?.reason||(!grant?'请先确认有效的职业授予和属性值提升专长。':undefined)};
}
/** Explicit intent only. Never write c.abilities or grant fresh points on load. */
export function setAsiAllocation(c:Character,choiceId:string,allocation:AsiBinding['allocation']|null):void{
 if(c.asiAllocations&&c.asiAllocations.version!==1)throw Error('此属性提升记录版本尚未支持，原记录保留。');
 const other=(c.asiAllocations?.bindings||[]).filter(row=>row.choiceId!==choiceId);
 if(allocation===null){if(c.asiAllocations)c.asiAllocations={...c.asiAllocations,version:1,bindings:other};return;}
 if(!validAllocation(allocation))throw Error('请选择一项属性 +2，或两项不同属性各 +1。');
 const grant=eligibleGrant(c,choiceId);if(!grant)throw Error('本次职业属性提升授予当前不可用。');
 const binding:AsiBinding={...(grant.kind?{kind:grant.kind}:{}),selectionId:grant.row.id,choiceId,entryId:grant.row.entry.id,allocation:{...allocation}},state:AsiAllocationState={...c.asiAllocations,version:1,bindings:[...other,binding]};
 const base=baseAbilityScores(c,activeEffectSelections(c)).abilities,allPlanned=evaluateAbilityAdvancements({...c,asiAllocations:state},base),planned=allPlanned.asi;
 if(!planned.states.get(binding.selectionId)?.active)throw Error(planned.states.get(binding.selectionId)?.reason||'此属性提升当前不能生效。');
 // A replacement cannot silently deactivate another previously valid grant.
 const allBefore=evaluateAbilityAdvancements(c,base),before=allBefore.asi;for(const old of other)if(before.states.get(old.selectionId)?.active&&!planned.states.get(old.selectionId)?.active)throw Error('本次分配会令另一项属性提升超过上限，请先调整原分配。');
 for(const [key,status] of allBefore.reviewed.states)if(status.active&&!allPlanned.reviewed.states.get(key)?.active)throw Error('本次分配会令已确认专长超过上限，请先调整原选择。');
 c.asiAllocations=state;
}
export function validateAsiAllocations(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw Error('属性提升记录版本无效。');
 if(value.version!==1)return;
 if(!Array.isArray(value.bindings)||value.bindings.length>100||value.bindings.some(row=>!object(row)||(row.kind!==undefined&&row.kind!=='legacy-class')||['selectionId','choiceId','entryId'].some(key=>typeof row[key]!=='string'||!(row[key] as string).length||(row[key] as string).length>2000)||!validAllocation(row.allocation)))throw Error('属性提升分配记录无效。');
}

/** A typed ASI's feat is class-parented, so its source feature is not the
 * archived feat's parent. Recover that already saved declaration offline only
 * for the exact allocated selection instance, never from a display label. */
export function retainedAsiSourceFeature(c:Character,owner:Selection,ref:string):Entry|undefined{
 if(c.asiAllocations?.version!==1||owner.entry.kind!=='class'||owner.entry.source!=='XPHB'||owner.entry.edition!=='2024'||owner.entry.raw._copy||owner.entry.raw._unresolvedParent||!selectionEffectsAllowed(c,owner.entry)||!Number.isSafeInteger(owner.level)||owner.level<4||owner.level>20||c.dismissedFeatures?.includes(`${owner.id}|ref:${ref}`))return;
 if(!Array.isArray(owner.entry.raw.classFeatures)||!owner.entry.raw.classFeatures.some((raw:unknown)=>(typeof raw==='string'?raw:object(raw)?raw.classFeature:undefined)===ref))return;
 const snapshots=Object.values(c.classChoiceSnapshots||{}).filter(entry=>entry.kind==='feature'&&entry.english==='Ability Score Improvement'&&entry.source==='XPHB'&&entry.edition==='2024'&&entry.raw._category==='classFeature'&&!entry.raw._copy&&!entry.raw._unresolvedParent&&!entry.effects?.length&&selectionEffectsAllowed(c,entry)&&matchesReference(entry,ref)&&Number.isSafeInteger(entry.raw.level)&&entry.raw.level>=4&&entry.raw.level<=owner.level&&evidence.modernFeatChoices.some(record=>record.owner===`${owner.entry.english}|XPHB`&&record.level===entry.raw.level&&matchesReference(entry,record.feature)));
 if(snapshots.length!==1)return;const feature=snapshots[0],choiceId=`${owner.id}:class-typed-feat:${feature.id}`,bindings=c.asiAllocations.bindings.filter(binding=>binding.choiceId===choiceId);if(bindings.length!==1)return;
 const binding=bindings[0],rows=[...c.selections,...Object.values(c.classChoiceArchive||{}).filter(archive=>archive.choiceId===choiceId).flatMap(archive=>archive.selections.slice(0,1))].filter(row=>row.id===binding.selectionId);
 if(rows.length!==1)return;const row=rows[0];
 if(!asiRule(row.entry)||!selectionEffectsAllowed(c,row.entry)||row.parentId!==owner.id||row.requirementId!==choiceId||row.grantKey!==`choice:${choiceId}:${row.entry.id}`||row.entry.id!==binding.entryId||c.answers[choiceId]?.length!==1||c.answers[choiceId][0]!==row.entry.id||!validAllocation(binding.allocation))return;
 if(!feature.entries.some(node=>typeof node==='string'&&[...node.matchAll(/\{@feat ([^}]+)\}/g)].some(match=>match[1].split('|').length===2&&match[1].split('|')[1]==='XPHB'&&matchesReference(row.entry,match[1]))))return;
 return feature;
}
