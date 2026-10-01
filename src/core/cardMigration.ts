import {editionAllows,selectionAllowed,classMatches,KIND_LABELS,SKILLS,ABILITY_LABELS,type Ability,type Character,type Entry,type Selection,type Kind} from './model';
import {syncFeatures,removeSelection} from './sheet';
import {featureOwner} from './featureOwnership';
import {legacyTraining} from './legacyTraining';
import {trainingCategory} from './training';
import {syncAutoResources,setResource} from './resources';
import {rememberSourceSpellUses} from './automation/sourceSpellState';
import {syncSourceSpells} from './automation/sourceSpells';
import {evaluate} from './engine';
import {spellState} from './characterDetails';
import {validateCharacter} from './validation';
import {classCompatibilityIssues,type ClassMigrationPlan} from './classMigration';

const stable=(v:unknown):string=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
const nameKey=(v:unknown)=>String(v??'').normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s·•’']/g,'');
const aliases=(e:Entry)=>[e.name,e.english,e.raw.name,e.raw.ENG_name,e.raw.shortName,e.raw.ENG_shortName].map(nameKey).filter(Boolean);
export const MIGRATION_ROOTS:Kind[]=['background','class','race','subclass','item'];
const bubbles:Kind[]=['feature','feat','rule'];
export const unlinkedEntry=(e:Entry)=>e.packId==='imported'||e.source==='IMPORTED'||e.source==='CUSTOM'||!!e.raw._custom;
export const reviewedLegacy=(row:Selection,edition:Character['edition'])=>row.catalogReview?.edition===edition&&row.catalogReview.entryId===row.entry.id&&row.catalogReview.source===row.entry.source&&row.catalogReview.kind===row.entry.kind;
export {cardMigrationIssues} from './cardMigrationIssues';

type CatalogIndex={rows:Entry[];names:Map<string,Entry[]>;ids:Map<string,Entry[]>};
const indexes=new WeakMap<Entry[],CatalogIndex>();
function index(entries:Entry[]):CatalogIndex{
 let cached=indexes.get(entries);if(cached)return cached;
 const rows=entries.filter(e=>!unlinkedEntry(e)),names=new Map<string,Entry[]>(),ids=new Map<string,Entry[]>();
 for(const e of rows){for(const name of new Set(aliases(e))){const list=names.get(name)||[];list.push(e);names.set(name,list);}const list=ids.get(e.id)||[];list.push(e);ids.set(e.id,list);}
 cached={rows,names,ids};indexes.set(entries,cached);return cached;
}
export function migrationCandidates(c:Character,row:Selection,entries:Entry[],kinds:Kind[]=[row.entry.kind]):Entry[]{
 const catalog=index(entries),matches=new Map<string,Entry>();
 const consider=(e:Entry)=>{if(kinds.includes(e.kind)&&editionAllows(e,c.edition)&&!matches.has(e.id)&&!(e.kind==='rule'&&e.raw._category==='size'))matches.set(e.id,e);};
 for(const e of catalog.ids.get(row.entry.id)||[])consider(e);
 for(const alias of aliases(row.entry))for(const e of catalog.names.get(alias)||[])consider(e);
 const parent=row.parentId?c.selections.find(s=>s.id===row.parentId):undefined;
 return [...matches.values()].filter(e=>e.kind!=='subclass'||!parent||unlinkedEntry(parent.entry)||classMatches(e,parent.entry)).sort((a,b)=>Number(selectionAllowed(c,b))-Number(selectionAllowed(c,a))||a.source.localeCompare(b.source)||a.id.localeCompare(b.id));
}
/** Recommend only; the wizard keeps every explicit choice, including custom. */
export function suggestedMigrationTarget(c:Character,candidates:Entry[],current?:Entry):string{
 const books=c.edition==='2024'?['XPHB','XDMG','XMM']:['PHB','DMG','MM'];
 const coreBooks=['PHB','DMG','MM','XPHB','XDMG','XMM'];
 const available=candidates.filter(e=>selectionAllowed(c,e)&&editionAllows(e,c.edition)&&(!coreBooks.includes(e.source)||books.includes(e.source)));
 const same=available.filter(e=>e.id===current?.id&&e.source===current.source&&e.packId===current.packId&&e.edition===current.edition&&e.kind===current.kind);
 if(same.length===1)return same[0].id;
 // A matching core handbook takes priority over ambiguous expansion names.
 // Two different entries from the same preferred book still need a decision.
 for(const source of books){const rows=available.filter(e=>e.source===source);if(rows.length)return rows.length===1?rows[0].id:'';}
 return available.length===1?available[0].id:'';
}
export function migrationOptions(c:Character,entries:Entry[],kinds:Kind[],query:string):Entry[]{
 const q=nameKey(query);return index(entries).rows.filter(e=>kinds.includes(e.kind)&&editionAllows(e,c.edition)&&(!q||aliases(e).some(n=>n.includes(q)))).slice(0,100);
}
export type GrantChoice={include:boolean;replaceId?:string};
export type MigrationChoices={roots:Record<string,string>;grants:Record<string,GrantChoice>;extras:Record<string,string>;keep:Record<string,boolean>;spells:Record<string,string>;training:Record<string,string>};
export const emptyMigrationChoices=():MigrationChoices=>({roots:{},grants:{},extras:{},keep:{},spells:{},training:{}});
export type GrantReview={key:string;row:Selection;owner:Selection;matches:Selection[]};
export type TrainingReview={id:string;group:string;text:string;candidates:Entry[]};
export type MigrationDraft={card:Character;grants:GrantReview[];extraRows:Selection[];leftovers:Selection[];spellRows:Selection[];training:TrainingReview[];warnings:string[];changed:string[]};
function target(c:Character,entries:Entry[],id:string,kinds:Kind[]):Entry{
 const matches=(index(entries).ids.get(id)||[]).filter(e=>kinds.includes(e.kind)&&editionAllows(e,c.edition));
 if(matches.length!==1)throw Error('所选资料无法唯一确定或不属于当前规则版本，请重新选择。');
 if(!selectionAllowed(c,matches[0]))throw Error('「'+matches[0].name+'」的来源未启用，请先在规则与扩展中开启。');
 return matches[0];
}
const markKept=(row:Selection,c:Character)=>{row.catalogReview={edition:c.edition,entryId:row.entry.id,source:row.entry.source,kind:row.entry.kind};};
function replace(row:Selection,e:Entry,changed:string[]){changed.push(row.entry.name+' → '+e.name+' · '+KIND_LABELS[e.kind]+' · '+e.source);row.entry=structuredClone(e);delete row.catalogReview;if(e.kind==='feat')row.section='heritage';else if(e.kind==='feature')row.section='features';else delete row.section;}
function clearAssociation(row:Selection){delete row.parentId;delete row.grantKey;delete row.requirementId;}
function trainingRows(c:Character,entries:Entry[]):TrainingReview[]{
 const result:TrainingReview[]=[];
 for(const [group,value] of Object.entries({...legacyTraining(c.externalSnapshot),...c.training}))for(const [i,text] of value.split(/[,，、;；\n]+/).map(x=>x.trim()).filter(Boolean).entries()){
  const reference=text.match(/^\{@\w+ ([^{}]+)\}$/),name=reference?reference[1].split('|')[0]:text;
  const candidates=(index(entries).names.get(nameKey(name))||[]).filter(e=>editionAllows(e,c.edition)&&trainingCategory(e)===group);
  result.push({id:group+':'+i,group,text,candidates:[...new Map(candidates.map(e=>[e.id,e])).values()]});
 }
 return result;
}
/** Each stage runs on a copy; only the final explicit confirmation persists. */
export function migrationDraft(original:Character,entries:Entry[],choices:MigrationChoices,through=5):MigrationDraft{
 const card=structuredClone(original),changed:string[]=[],warnings:string[]=[],owners=new Set<string>(),consumed=new Set<string>();
 for(const row of card.selections.filter(s=>MIGRATION_ROOTS.includes(s.entry.kind))){
  const id=choices.roots[row.id];if(!id)continue;
  replace(row,target(card,entries,id,[row.entry.kind]),changed);consumed.add(row.id);
  if(row.entry.kind!=='item')owners.add(row.id);
 }
 const classes=card.selections.filter(s=>s.entry.kind==='class');
 const classKeys=classes.filter(s=>!unlinkedEntry(s.entry)).map(s=>s.entry.packId+'|'+s.entry.id+'|'+s.entry.source);
 if(new Set(classKeys).size!==classKeys.length)throw Error('多个职业不能替换为同一个职业，请分别核对兼职。');
 for(const sub of card.selections.filter(s=>s.entry.kind==='subclass'&&!unlinkedEntry(s.entry))){
  const matching=classes.filter(s=>classMatches(sub.entry,s.entry));
  if(matching.length===1){sub.parentId=matching[0].id;sub.level=matching[0].level;}
  else if(choices.roots[sub.id])throw Error('子职「'+sub.entry.name+'」与所选职业不匹配，请返回选择正确职业或保留原记录。');
 }
 // Generate declarations separately; generating new content never deletes old bubbles.
 const template=structuredClone(card);template.selections=template.selections.filter(s=>MIGRATION_ROOTS.includes(s.entry.kind));
 syncFeatures(template,entries,{owners,refresh:true});
 const grants:GrantReview[]=template.selections.filter(s=>s.parentId&&owners.has(s.parentId)&&s.grantKey&&!s.grantKey.startsWith('source-spell:')&&bubbles.includes(s.entry.kind)).map(row=>{
  const key=row.parentId+'|'+row.grantKey,owner=card.selections.find(s=>s.id===row.parentId)!;
  const exact=card.selections.filter(s=>s.parentId===row.parentId&&s.grantKey===row.grantKey);
  const names=new Set(aliases(row.entry));
  const matches=exact.length?exact:card.selections.filter(s=>bubbles.includes(s.entry.kind)&&(!s.parentId||s.parentId===row.parentId)&&aliases(s.entry).some(n=>names.has(n)));
  return {key,row,owner,matches};
 });
 // A sync is not a new grant of starting cash or equipment. Record receipts for refresh.
 if(template.inventory?.grantedCoins){card.inventory||=structuredClone(template.inventory);card.inventory.grantedCoins={...card.inventory.grantedCoins,...template.inventory.grantedCoins};card.inventory.coins=structuredClone(original.inventory?.coins||{cp:0,sp:0,ep:0,gp:0,pp:0});}
 const equipment=template.selections.filter(s=>s.entry.kind==='item'&&s.parentId&&owners.has(s.parentId)&&s.grantKey);
 const sameItem=(a:Entry,b:Entry)=>a.id===b.id&&a.packId===b.packId&&a.source===b.source&&a.edition===b.edition;
 // The template may delete an old grant or reuse its key for a different item.
 // Keep that owned stack independent; a later normal sync must not delete it or
 // silently replace the player's reviewed item. Exact surviving grants retain
 // their association so a deliberate later removal still creates its receipt.
 for(const owned of card.selections.filter(s=>s.entry.kind==='item'&&s.parentId&&owners.has(s.parentId)&&s.grantKey)){
  const declaration=equipment.find(s=>s.id===owned.id);
  if(declaration&&sameItem(owned.entry,declaration.entry))continue;
  clearAssociation(owned);
  warnings.push('「'+owned.entry.name+'」保留为独立已有物品：原赠品关系已不再适用，数量和装备状态不变。');
 }
 for(const row of equipment){
  const existing=card.selections.find(s=>s.id===row.id);
  if(existing&&sameItem(existing.entry,row.entry)){existing.parentId=row.parentId;existing.grantKey=row.grantKey;}
  else card.dismissedFeatures=[...new Set([...(card.dismissedFeatures||[]),row.parentId+'|'+row.grantKey])];
 }
 for(const owner of card.selections.filter(s=>owners.has(s.id))){
  const refs=owner.entry.raw[owner.entry.kind==='subclass'?'subclassFeatures':'classFeatures'];
  for(const block of Array.isArray(refs)?refs:[]){const ref=typeof block==='string'?block:block?.classFeature||block?.subclassFeature;if(typeof ref!=='string')continue;const level=Number(ref.split('|')[owner.entry.kind==='subclass'?5:3]);if(level>owner.level)continue;if(!grants.some(g=>g.owner.id===owner.id&&g.row.grantKey==='ref:'+ref))warnings.push('「'+owner.entry.name+'」的声明内容未载入或已主动移除：'+ref.split('|')[0]+'。');}
 }
 if(through>=2){let generated=0;const taken=new Set<string>();for(const grant of grants){
  const choice=choices.grants[grant.key];
  if(!choice?.include){card.dismissedFeatures=[...new Set([...(card.dismissedFeatures||[]),grant.key])];continue;}
  card.dismissedFeatures=card.dismissedFeatures?.filter(k=>k!==grant.key);
  let row=choice.replaceId?card.selections.find(s=>s.id===choice.replaceId):undefined;
  if(choice.replaceId&&(!row||!grant.matches.some(s=>s.id===row!.id)||taken.has(row.id)))throw Error('同一个旧气泡不能被替换两次，请重新核对来源内容。');
  if(row){replace(row,grant.row.entry,changed);consumed.add(row.id);taken.add(row.id);}
  else {let id:string;do{id='migration-grant:'+(++generated);}while(card.selections.some(s=>s.id===id));row={...structuredClone(grant.row),id};card.selections.push(row);consumed.add(id);}
  row.parentId=grant.owner.id;row.grantKey=grant.row.grantKey;delete row.requirementId;row.section=row.entry.kind==='feat'?'heritage':'features';
 }}
 const extraRows=card.selections.filter(s=>bubbles.includes(s.entry.kind)&&!consumed.has(s.id)&&(unlinkedEntry(s.entry)||!!s.parentId&&owners.has(s.parentId)));
 if(through>=3)for(const row of extraRows){const id=choices.extras[row.id];if(id){const e=target(card,entries,id,['feat','feature','rule','spell','item']);clearAssociation(row);replace(row,e,changed);consumed.add(row.id);
   if(e.kind==='feature'){const parent=featureOwner(card,row);if(parent)row.parentId=parent.id;}
  }}
 const leftovers=extraRows.filter(s=>!consumed.has(s.id));
 if(through>=4)for(const row of leftovers){if(choices.keep[row.id]===false){for(const child of card.selections.filter(s=>s.parentId===row.id))clearAssociation(child);removeSelection(card,row.id);}else if(row.parentId&&owners.has(row.parentId)){clearAssociation(row);}}
 const spellRows=card.selections.filter(s=>s.entry.kind==='spell'&&!consumed.has(s.id)),training=trainingRows(original,entries);
 if(through>=5){
  for(const row of spellRows){const id=choices.spells[row.id];if(id)replace(row,target(card,entries,id,['spell']),changed);}
  for(const group of ['armor','weapons','tools','languages']){const rows=training.filter(t=>t.group===group);if(!rows.length)continue;(card.training||={})[group]=rows.map(t=>{const id=choices.training[t.id];if(!id)return t.text;const e=target(card,entries,id,['item','rule','feature']);if(trainingCategory(e)!==t.group)throw Error('熟练项目标类别不同，请重新核对。');return '{@'+(e.raw._category==='language'?'language':e.raw._category==='itemProperty'?'itemProperty':e.raw._category==='itemMastery'?'itemMastery':'item')+' '+e.name+'|'+e.source+'}';}).join('、');}
 }
 return {card,grants,extraRows,leftovers,spellRows,training,warnings,changed};
}
export function planCardMigration(original:Character,entries:Entry[],choices:MigrationChoices,identity:{id:string;now:string}):ClassMigrationPlan{
 const {card,changed,warnings}=migrationDraft(original,entries,choices,5);
 for(const row of card.selections)if(unlinkedEntry(row.entry))markKept(row,card);
 rememberSourceSpellUses(card);syncAutoResources(card,original);syncSourceSpells(card,entries);
 for(const [id,r] of Object.entries(card.runtime.resources))setResource(card,id,r.unlimited?(original.runtime.resources[id]?.current??0):Math.min(r.max,original.runtime.resources[id]?.current??0));
 rememberSourceSpellUses(card);
 const old=new Map(original.selections.map(s=>[s.id,s])),current=new Map(card.selections.map(s=>[s.id,s]));
 const added=card.selections.filter(s=>!old.has(s.id)).map(s=>s.entry.name+' · '+KIND_LABELS[s.entry.kind]),removed=original.selections.filter(s=>!current.has(s.id)).map(s=>s.entry.name),refreshed=card.selections.filter(s=>old.has(s.id)&&stable(s.entry)!==stable(old.get(s.id)!.entry)).map(s=>s.entry.name);
 const resources=[...new Set([...Object.keys(original.runtime.resources),...Object.keys(card.runtime.resources)])].flatMap(id=>{const a=original.runtime.resources[id],b=card.runtime.resources[id];return stable(a)===stable(b)?[]:[(b?.name||a?.name||id)+'：'+(a?a.current+'/'+a.max:'无')+' → '+(b?b.current+'/'+b.max:'移除（原卡保留）')];});
 const before=evaluate(original),after=evaluate(card);
 const stats=([['等级',before.level,after.level],['生命值上限',before.maxHp,after.maxHp],['护甲等级',before.ac,after.ac],['熟练加值',before.proficiency,after.proficiency],['预备法术上限',spellState(original).capacity,spellState(card).capacity]] as const).filter(([,a,b])=>a!==b).map(([label,a,b])=>label+'：'+a+' → '+b);
 if(original.adjustments?.length)warnings.push('旧卡保留原有数值修正；替换规则后请核对数值依据，避免把手动总值重复计算。');
 const remaining=card.selections.filter(s=>unlinkedEntry(s.entry));if(remaining.length)warnings.push('已确认保留 '+remaining.length+' 项自定义或旧内容；这些内容不会被伪装成资料库规则。');
 if(classCompatibilityIssues(card,entries).length)warnings.push('仍有职业规则差异，所选保留内容不会被强制替换。');
 card.id=identity.id;card.name=original.name+'（资料同步副本）';card.revision=1;card.createdAt=card.updatedAt=identity.now;
 validateCharacter(card);
 return {card,originalId:original.id,originalRevision:original.revision,originalFingerprint:stable(original),changed,added,removed,refreshed,resources,stats,warnings};
}
/** Skills/saves have canonical IDs and are retained, never inferred/reset by a new class. */
export function retainedProficiencies(c:Character):string[]{return Object.entries(c.proficiencies||{}).filter(([,v])=>v).map(([key])=>SKILLS[key]?.name||(ABILITY_LABELS[key.replace('save:','') as Ability]||key.replace('save:',''))+'豁免').concat(Object.keys(c.expertise||{}).filter(k=>c.expertise![k]).map(k=>(SKILLS[k]?.name||k)+'专精'));}
