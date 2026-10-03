import type {Entry,Issue,Selection} from '../model';
import {armorType,type ArmorType} from './equipment';

export interface FeatureArmorRule {
 selectionId:string;entryId:string;source:string;edition:Entry['edition'];revision:string;
 path:string;bonus:number;armorTypes:ArmorType[];
}
export interface FeatureArmorReport {bonus:number;trace:string[];issues:Issue[];rules:FeatureArmorRule[]}

/** Read only the source's own prose. An options block describes unchosen content,
 * and reference nodes describe another source; neither grants an effect here. */
function ownText(nodes:unknown,path='entries',excluded=new Set<string>()):Array<{text:string;path:string}>{
 if(excluded.has(path))return [];
 if(typeof nodes==='string')return [{text:nodes,path}];
 if(Array.isArray(nodes))return nodes.flatMap((value,index)=>ownText(value,`${path}:${index}`,excluded));
 if(!nodes||typeof nodes!=='object')return [];
 const node=nodes as Record<string,unknown>;
 if(node.type==='options'||String(node.type||'').startsWith('ref'))return [];
 return ['entries','items','entry'].flatMap(key=>node[key]===undefined?[]:ownText(node[key],`${path}:${key}`,excluded));
}
function plain(text:string){
 return text.replace(/\{@(?:variantrule|rule) ([^|}]+)(?:\|[^}]*)?\}/g,'$1').replace(/\{@(?:b|i) ([^}]+)\}/g,'$1').replace(/\s+/g,' ').trim();
}
/** Deliberately bounded rule family, selected by the whole mechanical sentence,
 * never by class/feature names. Extra conditions must remain unsupported rather
 * than granting an unconditional bonus. Chinese/English snapshots are supported. */
function armorBonus(text:string):number|undefined{
 const value=plain(text);
 const chinese=value.match(/^(?:当你)?(?:着装|穿着|穿戴)(?:轻甲[、，,]中甲或重甲|护甲|盔甲)(?:期间|时)[，,]\s*你的\s*(?:AC|护甲等级)(?:获得|具有)\s*\+(\d+)\s*加值[。.!]?$/i);
 const english=value.match(/^While (?:you are |you're )?wearing (?:light, medium, or heavy armor|armor), you (?:gain|have) (?:a )?\+(\d+) bonus to (?:your )?(?:AC|Armor Class)[.!]?$/i);
 const bonus=Number((chinese||english)?.[1]);return Number.isSafeInteger(bonus)&&bonus>0&&bonus<=100?bonus:undefined;
}
/** Used by the existing choice-coverage warning: supported armor sentences must
 * not be advertised as missing automation, but other unhandled text stays visible. */
export function unhandledFeatureArmorText(entry:Entry):string{return ownText(entry.entries).filter(row=>armorBonus(row.text)===undefined).map(row=>row.text).join(' ');}
export function evaluateFeatureArmor(active:Selection[]):FeatureArmorReport{
 const report:FeatureArmorReport={bonus:0,trace:[],issues:[],rules:[]},seen=new Set<string>();
 const worn=active.filter(row=>row.equipped&&row.quantity>0&&['LA','MA','HA'].includes(armorType(row.entry)||''));
 for(const row of active){
  const entry=row.entry;if(!['feature','feat','race','background'].includes(entry.kind)||seen.has(entry.id))continue;
  seen.add(entry.id);
  // Explicit effects remain authoritative; interpreting their accompanying prose
  // again would double an already supported custom rule.
  if(entry.effects?.some(effect=>effect.op!=='proficiency'&&effect.target==='ac'))continue;
  let unsupported=false;const bonuses=new Set<number>();
  const grantedPaths=new Set<string>();
  for(const child of active.filter(child=>child.parentId===row.id&&child.grantKey?.startsWith('inline:'))){
   const index=Number(child.grantKey!.slice(7)),block=entry.raw.entries?.[index];
   // readableEntries may prepend starting-equipment sections. Match the saved
   // block itself rather than confusing its raw index with its display index.
   if(block!==undefined)for(const [at,node] of entry.entries.entries())if(node===block||JSON.stringify(node)===JSON.stringify(block))grantedPaths.add(`entries:${at}`);
  }
  for(const {text,path} of ownText(entry.entries,'entries',grantedPaths)){
   const bonus=armorBonus(text);
   if(bonus===undefined){const prose=plain(text);if(/(?:你的\s*(?:AC|护甲等级)|\b(?:your (?:AC|Armor Class)|bonus to (?:your )?(?:AC|Armor Class))\b)/i.test(prose))unsupported=true;continue;}
   if(bonuses.has(bonus))continue;bonuses.add(bonus);
   const rule:FeatureArmorRule={selectionId:row.id,entryId:entry.id,source:entry.source,edition:entry.edition,revision:entry.revision,path,bonus,armorTypes:['LA','MA','HA']};report.rules.push(rule);
   // Ambiguous simultaneous body armor is not a confirmed wearing state. Shields
   // alone never satisfy this condition, including an untrained 2024 shield.
   if(worn.length===1){report.bonus+=bonus;report.trace.push(`${entry.name} · ${entry.source}：着装护甲 +${bonus}`);}
   else report.trace.push(`${entry.name} · ${entry.source}：${worn.length?'护甲穿戴冲突':'未着装护甲'}，条件加值未生效`);
  }
  if(unsupported)report.issues.push({id:`feature-ac-rule:${row.id}`,selectionId:row.id,severity:'warning',message:`${entry.name}：正文中的护甲等级规则尚未完整适配，请核对条件与调整值。`});
 }
 return report;
}
