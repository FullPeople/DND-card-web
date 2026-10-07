import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {Entry,Raw} from '../../src/core/model';
import sourceLock from '../fixtures/equipment-ac-source.lock.json' with {type:'json'};

export {sourceLock};
/** Test-only bounded corpus. Never return prose or normalize the full catalogue. */
export function parseLockedEquipment(bytes:Uint8Array,lock=sourceLock):Entry[]{
 if(bytes.byteLength!==lock.bytes||createHash('sha256').update(bytes).digest('hex')!==lock.sha256)throw Error('Equipment source byte/hash lock mismatch');
 const body=JSON.parse(Buffer.from(bytes).toString('utf8')) as {baseitem?:Raw[]};
 if(!Array.isArray(body.baseitem))throw Error('Equipment source has no baseitem array');
 const selected=lock.entries.map(expected=>{
  const matches=body.baseitem!.filter(row=>row.source===expected.source&&(row.ENG_name||row.name)===expected.english);
  if(matches.length!==1)throw Error(`Equipment identity missing or duplicated: ${expected.id}`);
  const raw=matches[0];
  // Source fields only; strength, stealth, prices and all prose remain out of this AC test projection.
  if(raw.edition!==(expected.edition==='2014'?'classic':'one')||raw.type!==expected.type||raw.ac!==expected.ac||raw.page!==expected.page)throw Error(`Equipment structured fields differ: ${expected.id}`);
  const entry:Entry={id:expected.id,kind:'item',name:raw.name,english:raw.ENG_name||raw.name,source:raw.source,edition:expected.edition as '2014'|'2024',packId:'kiwee',revision:'sha256:'+lock.sha256,page:raw.page,entries:[],raw:{name:raw.name,ENG_name:raw.ENG_name,source:raw.source,edition:raw.edition,type:raw.type,ac:raw.ac,page:raw.page,_category:'baseitem'}};
  return entry;
 });
 if(selected.length!==6||new Set(selected.map(entry=>entry.id)).size!==6)throw Error('Equipment scope must contain exactly six distinct identities');
 return selected;
}
export function loadLockedEquipment(path:string):Entry[]{return parseLockedEquipment(readFileSync(path));}
