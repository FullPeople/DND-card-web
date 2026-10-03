import {selectionEffectsAllowed,type Character,type Entry} from '../core/model';
import {proficiencyText} from '../core/proficiencyText';
/** Training rows own literal references, not catalog snapshots. Reconstruct only
 * the empty fallback that Reference renders while a lookup is unavailable. */
export function ownedTrainingReference(c:Character,entry:Entry):Entry|undefined{
 if(entry.source!=='CUSTOM'||entry.packId!=='custom'||entry.edition!=='both'||entry.kind!=='feature'||!entry.id.startsWith('custom-reference:'))return;
 const records=['armor','weapons','tools','languages'].map(group=>{
  if(c.training?.[group]!==undefined)return c.training[group];
  const alternate=({armor:'armorProficiencies',weapons:'weaponProficiencies',tools:'toolProficiencies',languages:'languageProficiencies'} as Record<string,string>)[group];
  return c.selections.filter(row=>selectionEffectsAllowed(c,row.entry)).flatMap(({entry:{raw}})=>{
   const fixed=raw.startingProficiencies?.[group],extra=raw[alternate];
   return [...(Array.isArray(fixed)?fixed.filter((value:unknown):value is string=>typeof value==='string'):[]),...(Array.isArray(extra)?extra.flatMap(value=>Object.entries(value||{}).filter(([key,on])=>on===true&&key!=='choose').map(([key])=>key)):[])];
  }).map(value=>({common:'通用语',elvish:'精灵语'} as Record<string,string>)[value]||proficiencyText(value,c.edition==='2024'?'XPHB':'PHB',group)).join('、');
 });
 for(const value of records)for(const item of value.split(/[、\n；;]/).map(s=>s.trim()).filter(Boolean)){
  const tag=/\{@(\w+) ([^}]+)\}/.exec(item),reference=tag?.[2]||item;
  if(entry.id!=='custom-reference:'+reference)continue;
  return {id:entry.id,kind:'feature',name:item.replace(/\{@\w+ ([^}]+)\}/g,(_,body:string)=>body.split('|')[2]||body.split('|')[0]),english:'',source:'CUSTOM',packId:'custom',edition:'both',revision:'1',entries:[],raw:{_custom:true}};
 }
}
