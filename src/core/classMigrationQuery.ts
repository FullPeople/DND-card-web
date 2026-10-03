import {editionAllows,type Character,type Entry,type Selection} from './model';

/** Read-only compatibility checks must not pull migration transactions into first paint. */
const key=(value:string)=>value.trim().toLocaleLowerCase();
export const migrationFingerprint=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const sameClassSnapshot=(a:Entry,b:Entry)=>migrationFingerprint(a)===migrationFingerprint(b);
// Cache revisions, translated prose and display metadata do not change rules.
const classRuleKeys=['hd','proficiency','savingThrows','startingProficiencies','multiclassing','classFeatures','casterProgression','spellcastingAbility','preparedSpells','preparedSpellsProgression','preparedSpellsChange','spellsKnownProgression','spellsKnownProgressionFixed','cantripProgression','cantripChange','optionalfeatureProgression'] as const;
export const classRuleSnapshot=(e:Entry)=>({effects:e.effects,choices:e.choices,raw:Object.fromEntries(classRuleKeys.filter(k=>e.raw[k]!==undefined).map(k=>[k,e.raw[k]]))});
export const sameClassRules=(a:Entry,b:Entry)=>migrationFingerprint(classRuleSnapshot(a))===migrationFingerprint(classRuleSnapshot(b));
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
export const migrationStillCurrent=(plan:ClassMigrationPlan,current:Character)=>plan.originalFingerprint===migrationFingerprint(current);
