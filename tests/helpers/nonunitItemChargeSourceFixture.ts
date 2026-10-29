import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {homebrewBody} from '../../src/data/homebrew';
import type {Entry} from '../../src/core/model';

// Pure original-source boundary: no Character, actor, state, engine or new
// evidence import. Only the selected nineteen identities are retained.
export const nonunitItemChargeInputPins=[
  {
    "url": "https://5e.kiwee.top/data/items.json",
    "sha256": "883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488",
    "bytes": 2458443
  },
  {
    "url": "https://homebrew.kiwee.top/class/Benjamin%20Huffman%3B%20%E6%8B%B3%E6%96%97%E5%A3%ABPugilist%20-%202014.json",
    "sha256": "0593dd1ff41efae5fe35732dac306d6af94f3393f8224493e1368bb7924b3b5a",
    "bytes": 122372
  },
  {
    "url": "https://homebrew.kiwee.top/collection/Darrington%20Press%3B%20%E5%A1%94%E5%B0%94%E5%A4%9A%E9%9B%B7%E6%88%98%E5%BD%B9%E8%AE%BE%E5%AE%9A%E9%9B%86%E9%87%8D%E5%88%B6%E7%89%88.json",
    "sha256": "9b5b07f9bdce7a1825beaabfed186e225c855511dd65d650dc4a3ad2d9b39b44",
    "bytes": 1609163
  },
  {
    "url": "https://homebrew.kiwee.top/collection/Griffin%20Macaulay%3B%20%E7%8B%AE%E9%B9%AB%E7%9A%84%E9%9E%8D%E4%B8%AD%E7%8F%8D%E5%AE%9D%E2%85%A1.json",
    "sha256": "3a0ebbb8eda1d4f327d64801ea55972d342b280c08821914a8f642e630a6e98e",
    "bytes": 2170330
  },
  {
    "url": "https://homebrew.kiwee.top/collection/Hit%20Point%20Press%3B%20%E8%B0%A6%E5%8D%91%E6%9E%97%E6%95%85%E4%BA%8B%E9%9B%86.json",
    "sha256": "58226d6315b3e17c0c9746dba4b248b1d620b11fa21b12cf9e6d3b151873de4d",
    "bytes": 1163416
  },
  {
    "url": "https://5e.kiwee.top/data/items-base.json",
    "sha256": "8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff",
    "bytes": 149813
  },
  {
    "url": "https://5e.kiwee.top/data/magicvariants.json",
    "sha256": "4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d",
    "bytes": 190573
  }
] as const;
const selectedIds=[
  "kiwee:item:tce:baba%20yaga's%20pestle::::::",
  "kiwee:item:toa:devlin's%20staff%20of%20striking::::::",
  "kiwee:item:dmg:pipes%20of%20the%20sewers::::::",
  "kiwee:item:xdmg:pipes%20of%20the%20sewers::::::",
  "kiwee:item:dmg:ring%20of%20the%20ram::::::",
  "kiwee:item:xdmg:ring%20of%20the%20ram::::::",
  "kiwee:item:dmg:staff%20of%20striking::::::",
  "kiwee:item:xdmg:staff%20of%20striking::::::",
  "kiwee:item:oota:stonespeaker%20crystal::::::",
  "kiwee-homebrew:item:sterlingvermin:club%20of%20unconsciousness::::::",
  "kiwee-homebrew:item:taldoreicampaignsettingreborn:cabal's%20ruin%20(awakened)::::::",
  "kiwee-homebrew:item:taldoreicampaignsettingreborn:cabal's%20ruin%20(dormant)::::::",
  "kiwee-homebrew:item:taldoreicampaignsettingreborn:cabal's%20ruin%20(exalted)::::::",
  "kiwee-homebrew:item:griffonssaddlebag2:helm%20of%20the%20justicars::::::",
  "kiwee-homebrew:item:griffonssaddlebag2:mageplate%20ring::::::",
  "kiwee-homebrew:item:griffonssaddlebag2:phoenix%20rocket%20sword::::::",
  "kiwee-homebrew:item:griffonssaddlebag2:wraps%20of%20the%20restless::::::",
  "kiwee-homebrew:item:humblewoodtales:fangs%20of%20guile::::::",
  "kiwee-homebrew:item:humblewoodtales:ring%20of%20the%20sky%20hunter::::::"
] as const;
const selected=new Set<string>(selectedIds);
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const nonunitItemChargeSnapshot=(entry:unknown)=>digest(sorted(entry));
const fail:(code:string)=>never=(code)=>{throw Error('NONUNIT_ITEM_CHARGE_SOURCE_'+code);};
function offlineBoundary(){
 const marker=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,marker),guard=(globalThis as any)[marker];
 if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_NETWORK_BOUNDARY');
}
let originals:Map<string,any>|undefined;
function bodies(){
 offlineBoundary();if(originals)return originals;
 const directory=process.env.NONUNIT_ITEM_CHARGE_FROZEN_DIR||process.env.ITEM_CHARGE_FROZEN_DIR;if(!directory)fail('FROZEN_DIRECTORY');
 const root=realpathSync(directory),index=JSON.parse(readFileSync(root+'/index.json','utf8')),verified=new Map<string,any>();if(!Array.isArray(index.rows))fail('INDEX');
 // Verify all seven exact original files before any normalization can start.
 for(const pin of nonunitItemChargeInputPins){
  const rows=index.rows.filter((row:any)=>row?.url===pin.url);if(rows.length!==1||rows[0].sha256!==pin.sha256||!/^files\/[a-f0-9]{64}\.json$/.test(rows[0].path))fail('INPUT_PIN');
  const file=realpathSync(root+'/'+rows[0].path);if(!file.startsWith(root+'/'))fail('INPUT_PATH');const bytes=readFileSync(file);
  if(bytes.length!==pin.bytes||createHash('sha256').update(bytes).digest('hex')!==pin.sha256)fail('INPUT_BYTES');const body=JSON.parse(bytes.toString('utf8'));if(digest(body)!==pin.sha256)fail('INPUT_CANONICAL');verified.set(pin.url,body);
 }
 originals=verified;return originals;
}
const cache:Partial<Record<'canonical'|'merged',Entry[]>>={};
let legacyControl:Entry|undefined;
const exact=(entries:Entry[])=>selectedIds.map(id=>{const matches=entries.filter(entry=>entry.id===id);if(matches.length!==1)fail('UNIQUE_SELECTED_IDENTITY');return matches[0];});
export function nonunitItemChargeEntries(form:'canonical'|'merged'='canonical'):Entry[]{
 offlineBoundary();if(form!=='canonical'&&form!=='merged')fail('FORM');if(cache[form])return cache[form]!;
 const inputs=bodies();
 if(!cache.canonical){
  const rows=nonunitItemChargeInputPins.slice(0,5).flatMap(pin=>{
   const homebrew=pin.url.startsWith('https://homebrew.kiwee.top/'),body=structuredClone(inputs.get(pin.url)),normalized=normalizeCatalogData(homebrew?homebrewBody(body):body,pin.sha256,homebrew?'kiwee-homebrew':'kiwee');
   if(pin.url==='https://5e.kiwee.top/data/items.json'){
    const control=normalized.filter(entry=>entry.id==='kiwee:item:dmg:wand%20of%20enemy%20detection::::::');
    if(control.length!==1||control[0].kind!=='item'||control[0].english!=='Wand of Enemy Detection'||control[0].source!=='DMG'||control[0].packId!=='kiwee')fail('UNIQUE_LEGACY_CONTROL');legacyControl=control[0];
   }
   return normalized.filter(entry=>selected.has(entry.id));
  });
  cache.canonical=exact(rows);
 }
 if(form==='canonical')return cache.canonical;
 const merged=new Map(cache.canonical.map(entry=>[entry.id,entry])),equipmentPins=['items-base.json','items.json','magicvariants.json'].map(path=>{const pin=nonunitItemChargeInputPins.find(row=>row.url==='https://5e.kiwee.top/data/'+path);if(!pin)fail('EQUIPMENT_PIN');return pin;});
 const equipment=Object.assign({},...equipmentPins.map(pin=>structuredClone(inputs.get(pin.url)))),revision=equipmentPins.map(pin=>pin.sha256).join('|');
 for(const operation of ['normalize','magicItems'] as const)for(const entry of normalizeCatalogData(equipment,revision,'kiwee',operation))if(selected.has(entry.id))merged.set(entry.id,entry);
 cache.merged=exact([...merged.values()]);return cache.merged;
}
export function nonunitItemChargeFind(id:string,form:'canonical'|'merged'='canonical'):Entry{
 if(!selected.has(id))fail('UNREVIEWED_IDENTITY');const rows=nonunitItemChargeEntries(form).filter(entry=>entry.id===id);if(rows.length!==1)fail('UNIQUE_SELECTED_IDENTITY');return rows[0];
}
/** One unchanged fixed-one control retained from the same native pass. It is
 * not an additional family owner, input, normalization operation or admission. */
export function nonunitItemChargeLegacyFind():Entry{
 nonunitItemChargeEntries();if(!legacyControl)fail('UNIQUE_LEGACY_CONTROL');return legacyControl;
}
