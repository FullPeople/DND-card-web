import type {Character} from './model';
/** Only the documented legacy identity fields are interpreted. The original
 * snapshot remains available; an explicit empty native field stays empty. */
export function legacyTraining(value:unknown):NonNullable<Character['training']>{
 const identity=(value as {identity?:Record<string,unknown>}|null)?.identity,result:NonNullable<Character['training']>={};
 if(!identity||typeof identity!=='object')return result;
 for(const [group,key] of [['armor','armor_proficiencies'],['weapons','weapon_proficiencies'],['tools','tool_proficiencies'],['languages','languages']]){
  const raw=identity[key];
  if(typeof raw==='string')result[group]=raw;
  else if(Array.isArray(raw))result[group]=raw.flatMap(v=>typeof v==='string'?[v]:v&&typeof v==='object'&&typeof v.name==='string'?[v.name]:[]).join('、');
 }
 return result;
}
