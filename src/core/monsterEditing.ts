import {parseFile} from './validation';
import type {Raw} from './model';
const object=(value:unknown):value is Raw=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Update the ordinary value while preserving conditional AC, HP and speed data. */
export function monsterNumber(raw:Raw,key:string):number|undefined{
 const value=key==='ac'?(Array.isArray(raw.ac)?raw.ac[0]:raw.ac):key==='hp'?raw.hp:key.startsWith('speed.')?(typeof raw.speed==='number'&&key==='speed.walk'?raw.speed:raw.speed?.[key.slice(6)]):raw[key];
 const n=object(value)?value[key==='ac'?'ac':key==='hp'?'average':'number']:value;
 return typeof n==='number'?n:undefined;
}
export function setMonsterNumber(raw:Raw,key:string,value:number):Raw{
 if(key==='ac'){
  const rows=Array.isArray(raw.ac)?[...raw.ac]:raw.ac===undefined?[]:[raw.ac];
  rows[0]=object(rows[0])?{...rows[0],ac:value}:value;return {...raw,ac:rows};
 }
 if(key==='hp')return {...raw,hp:object(raw.hp)?{...raw.hp,average:value}:{average:value}};
 if(key.startsWith('speed.')){const field=key.slice(6),speed:Raw=object(raw.speed)?{...raw.speed}:{...(typeof raw.speed==='number'?{walk:raw.speed}:{})};speed[field]=object(speed[field])?{...speed[field],number:value}:value;return {...raw,speed};}
 return {...raw,[key]:value};
}
export function validateMonsterDraft(value:unknown):Raw{
 if(!object(value)||typeof value.name!=='string'||!value.name.trim())throw new Error('怪物名称不能为空。');
 if(value.name.length>300)throw new Error('怪物名称最多 300 字。');
 for(const key of ['str','dex','con','int','wis','cha','passive','pb'])if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<0||value[key]>1000))throw new Error(`${key} 需要 0–1000 的数值。`);
 for(const key of ['trait','action','bonus','reaction','legendary','mythic','spellcasting'])if(value[key]!==undefined&&!Array.isArray(value[key]))throw new Error(`${key} 需要条目数组。`);
 return value;
}
export function parseMonsterDraft(text:string):Raw{
 if(text.length>2_000_000)throw new Error('怪物 JSON 超过 2 MB。');
 return validateMonsterDraft(parseFile(text));
}
