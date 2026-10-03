import {editionAllows,selectionAllowed,classMatches,type Character,type Entry,type Selection} from './model';
import {syncFeatures} from './sheet';
import {syncAutoResources,setResource} from './resources';
import {rememberSourceSpellUses} from './automation/sourceSpellState';
import {syncSourceSpells} from './automation/sourceSpells';
import {evaluate} from './engine';
import {spellState} from './characterDetails';
import {validateCharacter} from './validation';

const key=(value:string)=>value.trim().toLocaleLowerCase();
const stable=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const sameClassSnapshot=(a:Entry,b:Entry)=>stable(a)===stable(b);
// Cache revisions, translated prose and display metadata do not change rules.
const classRuleKeys=['hd','proficiency','savingThrows','startingProficiencies','multiclassing','classFeatures','casterProgression','spellcastingAbility','preparedSpells','preparedSpellsProgression','preparedSpellsChange','spellsKnownProgression','spellsKnownProgressionFixed','cantripProgression','cantripChange','optionalfeatureProgression'] as const;
export const classRuleSnapshot=(e:Entry)=>e.automation?{automation:{identity:e.automation.identity,verdict:e.automation.verdict,mechanics:e.automation.mechanics,unsupported:e.automation.unsupported}}:({effects:e.effects,choices:e.choices,raw:Object.fromEntries(classRuleKeys.filter(k=>e.raw[k]!==undefined).map(k=>[k,e.raw[k]]))});
export const sameClassRules=(a:Entry,b:Entry)=>stable(classRuleSnapshot(a))===stable(classRuleSnapshot(b));
export type ClassReview={row:Selection;status:'current'|'updated'|'unlinked'|'edition'|'unavailable'|'custom';suggested?:Entry;message:string};

const classCatalogCache=new WeakMap<Entry[],Map<string,Entry[]>>();
function editionClasses(catalog:Entry[],edition:Character['edition']){let cache=classCatalogCache.get(catalog);if(!cache){cache=new Map();classCatalogCache.set(catalog,cache);}let rows=cache.get(edition);if(!rows){rows=catalog.filter(e=>e.kind==='class'&&editionAllows(e,edition)&&!e.raw._custom);cache.set(edition,rows);}return rows;}
/** Suggestions require source identity or a unique English identity. Chinese
 * labels and the old name-only casting hydration are never migration authority. */
export function reviewClasses(c:Character,catalog:Entry[]):ClassReview[]{
 const classes=editionClasses(catalog,c.edition);
 return c.selections.filter(s=>s.entry.kind==='class').map(row=>{
  const e=row.entry;
  if(e.raw._custom)return {row,status:'custom',message:'自定义职业，可保留原样，也可手动选择目标资料。'};
  const exact=classes.filter(target=>target.id===e.id&&target.source===e.source&&target.packId===e.packId);
  if(exact.length===1){const current=sameClassRules(e,exact[0]);return {row,status:current?'current':'updated',suggested:exact[0],message:current?'与当前职业规则一致。':'该职业的规则声明已更新，可核对后同步。'};}
  const english=key(e.english),matches=english&&/[a-z]/i.test(english)?classes.filter(target=>key(target.english)===english):[];
  const preferred=matches.filter(target=>target.source===(c.edition==='2014'?'PHB':'XPHB'));
  // A native source identity must not silently jump to another expansion.
  const candidates=e.packId==='imported'?(preferred.length?preferred:matches):matches.filter(target=>target.source===e.source||['PHB','XPHB'].includes(e.source)&&['PHB','XPHB'].includes(target.source));
  const suggested=candidates.length===1?candidates[0]:undefined;
  const status=e.packId==='imported'?'unlinked':!editionAllows(e,c.edition)?'edition':'unavailable';
  const message=status==='unlinked'?'旧卡尚未关联当前职业资料。':status==='edition'?`职业来源与 ${c.edition} 规则不同。`:'当前资料库中未找到这份职业资料；请先确认来源已加载。';
  return {row,status,suggested,message:message+(suggested?' 已找到可供确认的目标。':' 请手动选择，或保留原样。')};
 });
}
/** Missing downloads are not evidence of an incompatible class. A matching
 * imported name is a candidate, not proof that its old snapshot was migrated. */
export function classCompatibilityIssues(c:Character,catalog:Entry[]):ClassReview[]{
 return reviewClasses(c,catalog).filter(review=>{
  const e=review.row.entry;
  if(review.status==='current')return false;
  const kept=review.row.catalogReview;
  if(['custom','unlinked'].includes(review.status)&&kept?.edition===c.edition&&kept.entryId===e.id&&kept.source===e.source&&kept.kind===e.kind)return false;
  if(review.status==='edition'&&editionAllows(e,c.edition,c.profile.optional.legacy))return false;
  if(review.status==='unavailable')return catalog.some(target=>target.kind==='class'&&target.source===e.source);
  // A matching display name is only a candidate, never proof of completed migration.
  if(review.status==='unlinked')return true;
  return true;
 });
}
export type ClassMigrationPlan={card:Character;originalId:string;originalRevision:number;originalFingerprint:string;changed:string[];added:string[];removed:string[];refreshed:string[];resources:string[];stats:string[];warnings:string[]};
export const migrationStillCurrent=(plan:ClassMigrationPlan,current:Character)=>plan.originalFingerprint===stable(current);

/** Prepare a reviewable copy. No storage, browser APIs or mutation of the input. */
export function planClassMigration(original:Character,catalog:Entry[],choices:Record<string,string>,identity:{id:string;now:string}):ClassMigrationPlan{
 const card=structuredClone(original),owners=new Set<string>(),changed:string[]=[],warnings:string[]=[];
 for(const row of card.selections.filter(s=>s.entry.kind==='class')){
  const targetId=choices[row.id];if(!targetId)continue;
  const matches=catalog.filter(e=>e.id===targetId&&e.kind==='class'&&editionAllows(e,card.edition));
  if(matches.length!==1)throw Error(`「${row.entry.name}」的目标资料无法唯一确定，请重新选择。`);
  const target=matches[0];if(!selectionAllowed(card,target))throw Error(`「${target.name}」的来源未启用，请先在规则与扩展中调整。`);
  if(sameClassSnapshot(row.entry,target))continue;
  changed.push(`${row.entry.name}（${row.entry.source}） → ${target.name}（${target.source}） · ${row.level} 级`);
  row.entry=structuredClone(target);owners.add(row.id);
 }
 if(!owners.size)throw Error('请选择至少一项需要同步的职业资料。');
 const classIds=card.selections.filter(s=>s.entry.kind==='class').map(s=>`${s.entry.source}|${s.entry.id}`);
 if(new Set(classIds).size!==classIds.length)throw Error('多个职业不能同步为同一份职业资料；请分别核对兼职。');
 for(const row of card.selections.filter(s=>s.entry.kind==='subclass'&&s.parentId&&owners.has(s.parentId))){
  const parent=card.selections.find(s=>s.id===row.parentId)!;
  if(!classMatches(row.entry,parent.entry))warnings.push(`子职「${row.entry.name}」仍保留原记录，与目标职业的关联需手动核对。`);
 }
 rememberSourceSpellUses(card);
 syncFeatures(card,catalog,{owners,refresh:true});
 syncAutoResources(card,original);
 syncSourceSpells(card,catalog);
 // Migration is not a rest or a new grant of expendable resources. Preserve
 // the available count, clamp to a lower maximum, and start new counters at 0.
 for(const [id,resource] of Object.entries(card.runtime.resources))setResource(card,id,resource.unlimited?(original.runtime.resources[id]?.current??0):Math.min(resource.max,original.runtime.resources[id]?.current??0));
 rememberSourceSpellUses(card);
 const oldIds=new Set(original.selections.map(s=>s.id)),newIds=new Set(card.selections.map(s=>s.id));
 const added=card.selections.filter(s=>!oldIds.has(s.id)).map(s=>s.entry.name),removed=original.selections.filter(s=>!newIds.has(s.id)).map(s=>s.entry.name);
 const refreshed=card.selections.filter(s=>!owners.has(s.id)&&oldIds.has(s.id)&&!sameClassSnapshot(s.entry,original.selections.find(old=>old.id===s.id)!.entry)).map(s=>s.entry.name);
 const resources=[...new Set([...Object.keys(original.runtime.resources),...Object.keys(card.runtime.resources)])].flatMap(id=>{
  const before=original.runtime.resources[id],after=card.runtime.resources[id];
  return stable(before)===stable(after)?[]:[`${after?.name||before?.name||id}：${before?`${before.current}/${before.max}`:'无'} → ${after?`${after.current}/${after.max}`:'移除（原卡保留）'}`];
 });
 const beforeStats=evaluate(original),afterStats=evaluate(card);
 const stats=([['等级',beforeStats.level,afterStats.level],['生命值上限',beforeStats.maxHp,afterStats.maxHp],['护甲等级',beforeStats.ac,afterStats.ac],['熟练加值',beforeStats.proficiency,afterStats.proficiency],['预备法术上限',spellState(original).capacity,spellState(card).capacity]] as const).filter(([,a,b])=>a!==b).map(([label,a,b])=>`${label}：${a} → ${b}`);
 const retained=reviewClasses(card,catalog).filter(row=>row.status!=='current');
 if(retained.length)warnings.push(`仍保留 ${retained.length} 个未同步或自定义职业；这些内容继续按原记录使用。`);
 card.id=identity.id;card.name=`${original.name}（职业同步副本）`;card.revision=1;card.createdAt=card.updatedAt=identity.now;
 validateCharacter(card);
 return {card,originalId:original.id,originalRevision:original.revision,originalFingerprint:stable(original),changed,added,removed,refreshed,resources,stats,warnings};
}
