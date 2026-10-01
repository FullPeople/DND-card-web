import type {Raw} from './model';

/** Correct the copied structured snapshot before rules or grants read it.
 * Only an unambiguous labelled package and one explicit GP amount are eligible.
 * Publisher/network snapshots and already claimed runtime possessions stay intact.
 */
export function correctSourceData(raw:Raw):Raw{
 const equipment=raw.startingEquipment;if(!equipment||!Array.isArray(equipment.defaultData)||equipment.defaultData.length!==1||!Array.isArray(equipment.entries))return raw;
 const text=equipment.entries.filter((v:unknown)=>typeof v==='string').join(' '),schemes=[...text.matchAll(/\(([a-z])\)/gi)];if(!schemes.length)return raw;
 let updated:Raw|undefined;
 for(const [groupIndex,group] of equipment.defaultData.entries()){
  if(!group||typeof group!=='object'||Array.isArray(group)||Array.isArray(group._)&&group._.some((v:Raw)=>v?.value!==undefined||v?.containsValue!==undefined))continue;
  for(const [key,items] of Object.entries(group)){if(key==='_'||!Array.isArray(items))continue;
   const at=schemes.findIndex(m=>m[1].toLowerCase()===key.toLowerCase());if(at<0||schemes.filter(m=>m[1].toLowerCase()===key.toLowerCase()).length!==1)continue;
   const section=text.slice(schemes[at].index!+3,schemes[at+1]?.index),values=[...section.matchAll(/(\d+(?:\.\d+)?)\s*GP\b/gi)],coins=items.map((v,i)=>({v,i})).filter(({v})=>v&&typeof v==='object'&&(v.value!==undefined||v.containsValue!==undefined));
   if(values.length!==1||coins.length!==1)continue;const amount=Number(values[0][1])*100,{v,i}=coins[0],field=v.value!==undefined?'value':'containsValue';
   if(!Number.isSafeInteger(amount)||amount<0||amount>100000000||Number(v[field])===amount)continue;
   updated||={...raw,startingEquipment:{...equipment,defaultData:structuredClone(equipment.defaultData)}};updated.startingEquipment.defaultData[groupIndex][key][i][field]=amount;
  }
 }
 return updated||raw;
}
