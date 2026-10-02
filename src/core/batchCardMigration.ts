import {classMatches,selectionAllowed,type Character,type Entry,type Selection,type Kind} from './model';
import {emptyMigrationChoices,finalizeCardMigration,migrationCandidates,migrationDraft,MIGRATION_ROOTS,suggestedMigrationTarget,unlinkedEntry} from './cardMigration';
import {supportedAutomation} from './automation/state';
import {matchesReference} from './entryReferences';
import {syncChoiceContent} from './automation/choices';
import {rememberFeatureResources} from './automation/featureResources';
import {rememberSourceEquipment} from './automation/sourceEquipment';
import {removeSelection,syncFeatures} from './sheet';
import {planSourceSpells,syncSourceSpells} from './automation/sourceSpells';
import {syncAutoResources,setResource} from './resources';
import {rememberSourceSpellUses} from './automation/sourceSpellState';

const custom=(e:Entry)=>e.source==='CUSTOM'||!!e.raw._custom;
const stable=(v:unknown):string=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const names=(e:Entry)=>[e.name,e.english,e.raw.name,e.raw.ENG_name].filter(Boolean).map(n=>String(n).normalize('NFKC').toLocaleLowerCase().replace(/[\s·•’']/g,''));
const sameName=(a:Entry,b:Entry)=>names(a).some(n=>names(b).includes(n));
const detach=(s:Selection)=>{delete s.parentId;delete s.grantKey;delete s.requirementId;};
const bubbles:Kind[]=['feature','feat','rule'];
function automaticTarget(c:Character,row:Selection,entries:Entry[],kinds:Kind[]=[row.entry.kind]):string{
 if(custom(row.entry))return '';
 let candidates=migrationCandidates(c,row,entries,kinds).filter(e=>selectionAllowed(c,e));
 // Native expansion identity cannot silently move to a different expansion.
 if(!unlinkedEntry(row.entry))candidates=candidates.filter(e=>e.source===row.entry.source||['PHB','XPHB'].includes(e.source)&&['PHB','XPHB'].includes(row.entry.source));
 const id=suggestedMigrationTarget(c,candidates,row.entry);
 return id&&entries.filter(e=>e.id===id&&!unlinkedEntry(e)&&kinds.includes(e.kind)&&selectionAllowed(c,e)).length===1?id:'';
}
export function suggestedBatchRoots(c:Character,entries:Entry[],overrides:Record<string,string>={}):Record<string,string>{
 const context=structuredClone(c),roots:Record<string,string>={};
 for(const kind of ['class','background','race','subclass','item'] as const)for(const row of context.selections.filter(s=>s.entry.kind===kind)){
  const id=overrides[row.id]??automaticTarget(context,row,entries);roots[row.id]=id;
  const entry=entries.find(e=>e.id===id);if(entry)row.entry=structuredClone(entry);
 }
 return roots;
}
export type BatchRetention={row:Selection;reason:string};
/** One review transaction. Never infer choice answers, refill resources, or claim equipment. */
export function planBatchCardMigration(original:Character,entries:Entry[],roots:Record<string,string>,keep:Record<string,boolean>,identity:{id:string;now:string}){
 const choices=emptyMigrationChoices();choices.roots={...roots};
 // Inventory is included in the batch without turning every stack into a separate step.
 for(const row of original.selections.filter(s=>s.entry.kind==='item'))choices.roots[row.id]??=automaticTarget(original,row,entries);
 const first=migrationDraft(original,entries,choices,1),mapped=new Set(Object.entries(choices.roots).filter(([,id])=>!!id).map(([id])=>id));
 const oldTemplate=structuredClone(original);oldTemplate.selections=oldTemplate.selections.filter(s=>MIGRATION_ROOTS.includes(s.entry.kind));oldTemplate.dismissedFeatures=[];
 syncFeatures(oldTemplate,[...original.selections.map(s=>s.entry),...entries],{owners:mapped,refresh:false,equipmentPreview:true});
 const oldDeclarations=oldTemplate.selections.filter(s=>s.parentId&&mapped.has(s.parentId)&&s.grantKey&&bubbles.includes(s.entry.kind)&&!s.grantKey.startsWith('choice:'));
 const taken=new Set<string>(),protectedRows=new Set<string>(),ambiguousRows=new Set<string>(),batchWarnings:string[]=[];
 for(const grant of first.grants){
  if(grant.row.grantKey?.startsWith('choice:'))continue;
  // A dismissed old declaration also stays dismissed across a rule edition change.
  const previous=oldDeclarations.filter(s=>s.parentId===grant.owner.id&&sameName(s.entry,grant.row.entry));
  const dismissed=previous.length===1&&original.dismissedFeatures?.includes(grant.owner.id+'|'+previous[0].grantKey);
  const matches=grant.matches.filter(s=>!taken.has(s.id)&&!custom(s.entry)&&!s.grantKey?.startsWith('choice:'));
  for(const row of grant.matches)if(custom(row.entry))protectedRows.add(row.id);
  const reference=grant.row.grantKey?.startsWith('ref:')?grant.row.grantKey.slice(4):grant.row.grantKey?.startsWith('feat:')?grant.row.grantKey.slice(5):undefined;
  const targetAmbiguous=!!reference&&new Set(entries.filter(e=>e.kind===grant.row.entry.kind&&matchesReference(e,reference)).map(e=>e.packId+'|'+e.id)).size>1;
  const ambiguous=matches.length>1||targetAmbiguous;for(const row of ambiguous?matches:[])ambiguousRows.add(row.id);
  if(ambiguous)batchWarnings.push('「'+grant.row.entry.name+'」存在多个来源或旧项，未自动任选或新增。');
  const match=matches.length===1?matches[0]:undefined;
  choices.grants[grant.key]={include:!dismissed&&!ambiguous,replaceId:!dismissed?match?.id:undefined};
  if(match&&!dismissed&&!ambiguous){taken.add(match.id);mapped.add(match.id);}
 }
 const draft=migrationDraft(original,entries,choices,2),card=draft.card,retained:BatchRetention[]=[],removed=new Set<string>(),detachedChoices=new Set<string>();
 const choicePreview=structuredClone(card);if(supportedAutomation(choicePreview))choicePreview.automation!.enabled=true;syncChoiceContent(choicePreview,entries);const survivingChoices=new Set(choicePreview.selections.filter(s=>s.grantKey?.startsWith('choice:')).map(s=>s.id));
 const retain=(row:Selection,reason:string)=>{if(!retained.some(s=>s.row.id===row.id))retained.push({row:structuredClone(row),reason});};
 const replace=(row:Selection,e:Entry)=>{if(stable(row.entry)!==stable(e))draft.changed.push(`${row.entry.name}（${row.entry.source}） → ${e.name}（${e.source}）`);row.entry=structuredClone(e);delete row.catalogReview;if(e.kind==='feature')row.section='features';else if(e.kind==='feat')row.section='heritage';else delete row.section;};
 for(const row of card.selections){
  if(mapped.has(row.id)||!original.selections.some(s=>s.id===row.id))continue;
  if(row.grantKey?.startsWith('choice:')&&!survivingChoices.has(row.id))detachedChoices.add(row.id);
  if(custom(row.entry)||protectedRows.has(row.id)){retain(row,'自定义内容，默认保留');continue;}
  if(ambiguousRows.has(row.id)){retain(row,'多个旧项对应同一来源，未自动任选或新增');continue;}
  if(MIGRATION_ROOTS.includes(row.entry.kind)){retain(row,'基础资料未替换，默认保留');continue;}
  if(row.grantKey?.startsWith('source-spell:'))continue;
  if(row.grantKey?.startsWith('choice:')&&!survivingChoices.has(row.id)){retain(row,'旧来源选择不再适用，保留内容及原选择记录');detachedChoices.add(row.id);continue;}
  const declaration=oldDeclarations.find(s=>s.parentId===row.parentId&&s.grantKey===row.grantKey&&s.entry.id===row.entry.id&&stable(s.entry)===stable(row.entry));
  if(declaration&&!row.grantKey?.startsWith('choice:')){
   const owner=card.selections.find(s=>s.id===row.parentId),refs=owner?.entry.raw[owner.entry.kind==='subclass'?'subclassFeatures':'classFeatures'];
   const missing=owner&&['class','subclass'].includes(owner.entry.kind)&&(!Array.isArray(refs)||refs.some(block=>{const ref=typeof block==='string'?block:block?.classFeature||block?.subclassFeature;return typeof ref==='string'&&names(row.entry).includes(ref.split('|')[0].normalize('NFKC').toLocaleLowerCase().replace(/[\s·•’']/g,''))&&!first.grants.some(g=>g.owner.id===owner.id&&g.row.grantKey==='ref:'+ref);}));
   if(missing)retain(row,'目标来源声明尚未完整载入，保留旧记录');else removed.add(row.id);continue;
  }
  // A source choice remains the player's choice. Preserve its association and answer.
  const kinds=unlinkedEntry(row.entry)&&bubbles.includes(row.entry.kind)?['feat','feature','rule','spell','item'] as Kind[]:[row.entry.kind];
  const id=automaticTarget(card,row,entries,kinds),entry=entries.find(e=>e.id===id);
  if(entry){
   // A class feature must still belong to the selected class/subclass, not another same-name source.
   const parent=row.parentId?card.selections.find(s=>s.id===row.parentId):undefined;
   if(entry.kind==='feature'&&parent?.entry.kind==='class'&&entry.raw.className&&!classMatches(entry,parent.entry)){retain(row,'与目标职业未唯一对应，默认保留');continue;}
   if(row.grantKey?.startsWith('choice:')&&row.entry.id!==entry.id){retain(row,'选择身份已变化，保留内容及原选择记录');detachedChoices.add(row.id);continue;}
   replace(row,entry);mapped.add(row.id);
  }else retain(row,'未找到唯一可用资料，默认保留');
 }
 // Reconcile only generated source spells with known replacement declarations.
 // Missing/unsupported source data is retained for the final grid, never treated as deletion.
 const sourcePlan=planSourceSpells({...card,selections:card.selections.filter(row=>!removed.has(row.id))},entries),oldSourcePlan=planSourceSpells(original,[...original.selections.map(s=>s.entry),...entries]);
 const changedOwners=new Set(card.selections.filter(s=>{const old=original.selections.find(o=>o.id===s.id);return old&&stable(old.entry)!==stable(s.entry);}).map(s=>s.id));
 for(const row of card.selections.filter(s=>s.grantKey?.startsWith('source-spell:'))){
  if(custom(row.entry)){retain(row,'自定义法术，默认保留');continue;}
  const old=oldSourcePlan.grants.find(g=>g.id===row.id&&g.key===row.grantKey&&g.owner.id===row.parentId);
  const desired=sourcePlan.grants.find(g=>g.id===row.id);
  if(desired){replace(row,desired.entry);continue;}
  const ownerId=row.parentId||'';
  if(old&&(changedOwners.has(ownerId)||removed.has(ownerId))&&!sourcePlan.issues.some(issue=>issue.selectionId===ownerId))removed.add(row.id);
  else retain(row,'来源法术声明待核对，保留原记录与消耗');
 }
 // Keep unrecognized training text; convert only unique same-category candidates.
 for(const t of draft.training){const id=suggestedMigrationTarget(card,t.candidates);if(id)choices.training[t.id]=id;}
 const training=migrationDraft(original,entries,{...emptyMigrationChoices(),training:choices.training},5).card.training;
 if(training)card.training=training;
 // Unchecking means only this reviewed record. Its unrelated/manual descendants survive.
 for(const item of retained)if(keep[item.row.id]===false){removed.add(item.row.id);if(item.row.parentId&&item.row.grantKey?.startsWith('source-spell:'))card.dismissedFeatures=[...new Set([...(card.dismissedFeatures||[]),item.row.parentId+'|'+item.row.grantKey])];}
 rememberSourceSpellUses(card);rememberFeatureResources(card);rememberSourceEquipment(card);
 for(const row of card.selections){
  if(removed.has(row.id))continue;
  if(detachedChoices.has(row.id))detach(row);
  if(row.parentId&&removed.has(row.parentId)||row.requirementId&&[...removed].some(id=>row.requirementId!.startsWith(id+':')))detach(row);
  // Old retained linked bubbles must not be wiped by the next routine root refresh.
  if(retained.some(s=>s.row.id===row.id)&&row.parentId&&mapped.has(row.parentId)&&!row.grantKey?.startsWith('choice:')&&!row.grantKey?.startsWith('source-spell:'))detach(row);
 }
 // removeSelection cascades class ownership by rule identity as well as parentId.
 // Isolate the reviewed removals so unchecked parents cannot delete retained children.
 const survivors=card.selections.filter(row=>!removed.has(row.id));
 card.selections=card.selections.filter(row=>removed.has(row.id));
 for(const id of removed)removeSelection(card,id,false);
 card.selections=survivors;
 draft.warnings.push(...batchWarnings,...sourcePlan.issues.map(issue=>issue.message));
 if(retained.length)draft.warnings.push(`自定义或未匹配内容 ${retained.length} 项，按下方勾选保留；未勾选项仅从同步副本移除。`);
 // Review all declared content even when automatic calculations are switched off.
 // Seed zero-use history before restoring that preference, so later enabling it
 // cannot turn this migration into a fresh resource/equipment grant.
 if(supportedAutomation(card)&&card.automation!.enabled===false){
  card.automation!.enabled=true;syncAutoResources(card,original);syncSourceSpells(card,entries);
  for(const [id,r] of Object.entries(card.runtime.resources))setResource(card,id,r.unlimited?(original.runtime.resources[id]?.current??0):Math.min(r.max,original.runtime.resources[id]?.current??0));
  rememberSourceSpellUses(card);rememberFeatureResources(card);card.automation!.enabled=false;
 }
 const plan=finalizeCardMigration(original,entries,card,draft.changed,draft.warnings,identity);
 return {plan,retained};
}
