import {afterAll,afterEach,beforeAll,beforeEach,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const disk=vi.hoisted(()=>new Map<string,any>());
// The runner's process-startup preload owns the permanent rejecting baseline.
// No native fetch is retained, called, or restored by this test.
const network=vi.hoisted(()=>{const key=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,key),guard=(globalThis as any)[key];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||typeof guard.deny!=='function'||!Array.isArray(guard.unexpected)||globalThis.fetch!==guard.deny)throw Error('Offline catalog startup preload is required in this isolated worker.');return guard as {version:1;deny:typeof fetch;unexpected:string[]};});
vi.mock('../src/platform/storage',()=>({readCache:async(key:string)=>structuredClone(disk.get(key)),writeCache:async(key:string,value:any)=>{disk.set(key,structuredClone(value));}}));

import {loadCatalog,type LoadProgress} from '../src/data/catalog';
import {DEFAULT_SOURCE} from '../src/data/catalogSource';
import {DEFAULT_HOMEBREW} from '../src/data/homebrew';
import {CATALOG_SNAPSHOT_SCHEMA} from '../src/data/catalogSnapshot';
import {catalogBatchBuffers,decodeCatalogBatch} from '../src/data/catalogReaderProtocol';
import {cardCatalogEntries} from '../src/platform/standaloneCatalogPublication';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {evaluate} from '../src/core/engine';
import {itemAbilityFloorRule,itemAbilityFloorSnapshot} from '../src/core/automation/itemAbilityFloors';
import evidence from '../src/core/automation/itemAbilityFloorEvidence.json';

const pins=[
 {path:'data/items.json',sha256:'883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488',bytes:2458443},
 {path:'data/items-base.json',sha256:'8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff',bytes:149813},
 {path:'data/magicvariants.json',sha256:'4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d',bytes:190573},
];
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mergedRevision=pins.map(pin=>`${pin.path}:${pin.sha256}`).sort().join('|');
const bodies=new Map<string,unknown>();
// These are authored empty transport fixtures, not additional original inputs.
const emptyPaths=['data/bestiary/template.json','data/bestiary/legendarygroups.json','data/generated/gendata-variantrules.json','data/charcreationoptions.json','data/rewards.json','data/psionics.json','data/deities.json','data/cultsboons.json','data/bastions.json','data/tables.json','data/generated/gendata-tables.json','data/races.json','data/backgrounds.json','data/feats.json','data/optionalfeatures.json','data/conditionsdiseases.json','data/books.json','data/adventures.json','data/variantrules.json','data/actions.json','data/skills.json','data/senses.json','data/languages.json','data/generated/gendata-spell-source-lookup.json','data/class/fixture.json','data/spells/fixture.json','data/bestiary/fixture.json','data/spells/spells-phb.json','data/spells/spells-xphb.json'];
const fetchLocal=vi.fn(async(input:RequestInfo|URL)=>{
 if(typeof input!=='string'){network.unexpected.push(String(input));throw Error('Unexpected non-string catalog URL blocked offline.');}
 let key:string;try{const url=new URL(input);if(url.search||url.hash)throw Error('Unexpected URL suffix');key=url.origin+decodeURIComponent(url.pathname);}catch{network.unexpected.push(input);throw Error('Malformed catalog URL blocked offline.');}
 if(!bodies.has(key)){network.unexpected.push(input);throw Error('Unexpected catalog URL blocked offline.');}
 // No invented ETag: the real loader computes hashJson(body) and its own sorted,
 // path-prefixed final equipment revision from these verified original bodies.
 return new Response(JSON.stringify(bodies.get(key)));
});
let cold:Entry[]|undefined,coldDigest:string|undefined,controller:AbortController|undefined,pending:Promise<void>|undefined;

beforeAll(()=>{
 expect(globalThis.fetch).toBe(network.deny);expect(network.unexpected).toEqual([]);expect(typeof Worker).toBe('undefined');expect(typeof Response).toBe('function');
 const directory=process.env.ITEM_ABILITY_FLOOR_FROZEN_DIR;if(!directory)throw Error('Mandatory ITEM_ABILITY_FLOOR_FROZEN_DIR required');
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8'));disk.clear();
 for(const path of emptyPaths)bodies.set(`${DEFAULT_SOURCE}/${path}`,{});
 for(const category of ['class','spells','bestiary'])bodies.set(`${DEFAULT_SOURCE}/data/${category}/index.json`,{fixture:'fixture.json'});
 bodies.set(`${DEFAULT_HOMEBREW}/_generated/index-sources.json`,{});
 for(const pin of pins){
  const url=`${DEFAULT_SOURCE}/${pin.path}`,rows=index.rows.filter((row:any)=>row.url===url&&row.sha256===pin.sha256);expect(rows,url).toHaveLength(1);
  const bytes=readFileSync(`${directory}/${rows[0].path}`),body=JSON.parse(bytes.toString('utf8'));expect(bytes.length,url).toBe(pin.bytes);expect(createHash('sha256').update(bytes).digest('hex'),url).toBe(pin.sha256);expect(digest(body),url).toBe(pin.sha256);bodies.set(url,body);
 }
 expect(pins.reduce((total,pin)=>total+pin.bytes,0)).toBe(2798829);expect(evidence.rules).toHaveLength(18);
});
beforeEach(()=>{expect(globalThis.fetch).toBe(network.deny);expect(network.unexpected).toEqual([]);controller=new AbortController();vi.stubGlobal('fetch',fetchLocal);fetchLocal.mockClear();});
afterEach(async()=>{try{controller?.abort();await pending?.catch(()=>{});}finally{pending=undefined;vi.unstubAllGlobals();expect(globalThis.fetch).toBe(network.deny);expect(network.unexpected).toEqual([]);}});
afterAll(()=>{disk.clear();bodies.clear();expect(globalThis.fetch).toBe(network.deny);expect(network.unexpected).toEqual([]);});

async function read(){
 const entries=new Map<string,Entry>();let progress:LoadProgress|undefined;
 // Use the real loader, real JSON worker transport codec, and App's last-write-
 // wins Map. This is a composition seam check, not a mounted App/browser test.
 pending=loadCatalog(batch=>{for(const buffer of catalogBatchBuffers(batch))for(const entry of decodeCatalogBatch(buffer))entries.set(entry.id,entry);},value=>{progress=value;},controller!.signal);
 await pending;expect(progress).toBeDefined();expect(progress!.failed).toEqual([]);expect(progress!.paused).toBeUndefined();expect(progress!.done).toBe(progress!.total);expect(network.unexpected).toEqual([]);
 return [...entries.values()];
}
function prove(entries:Entry[]){
 const catalog=cardCatalogEntries(entries,{packs:[],custom:[],author:false,monsters:false});
 for(const rule of evidence.rules){
  const matches=catalog.filter(entry=>entry.id===rule.id);expect(matches,rule.id).toHaveLength(1);const actual=matches[0],before=digest(actual);
  expect(actual.revision,rule.id).toBe(mergedRevision);expect(itemAbilityFloorSnapshot({...actual,id:rule.id,revision:rule.revision}),rule.id).toBe(rule.fullNormalizedSnapshotSha256);expect(itemAbilityFloorRule(actual)?.id,rule.id).toBe(rule.id);expect(digest(actual)).toBe(before);
  const c=newCharacter(rule.edition==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[rule.source];c.notes='Authored composition sentinel';c.runtime.hp=3;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};c.selections.push({id:'composition-owner',entry:structuredClone(actual),quantity:1,level:1,equipped:true,attuned:true});
  const saved=digest(c),derived=evaluate(c);expect(derived.abilities[rule.ability as 'str'|'con'|'int'],rule.id).toBe(rule.floor);expect(c.abilities[rule.ability as 'str'|'con'|'int']).toBe(10);expect(digest(c)).toBe(saved);
 }
}
it('cold real loader composes only the three original equipment inputs and authenticates all18 complete snapshots',async()=>{
 cold=await read();coldDigest=digest(cold);expect(new Set(fetchLocal.mock.calls.map(call=>String(call[0])))).toEqual(new Set(bodies.keys()));expect(fetchLocal).toHaveBeenCalledTimes(bodies.size);prove(cold);
});
it('warm parsed cache preserves the same strict final equipment entries without fetching',async()=>{
 expect(cold?.length).toBeGreaterThan(0);expect(coldDigest).toBeDefined();const warm=await read();expect(digest(warm)).toBe(coldDigest);expect(fetchLocal).not.toHaveBeenCalled();prove(warm);
});
it('raw-cache rebuild preserves the same strict final equipment entries without fetching',async()=>{
 expect(cold?.length).toBeGreaterThan(0);const snapshots=[...disk.keys()].filter(key=>key.startsWith(CATALOG_SNAPSHOT_SCHEMA+':'));expect(snapshots).toHaveLength(1);for(const key of snapshots)disk.delete(key);
 const rebuilt=await read();expect(digest(rebuilt)).toBe(coldDigest);expect(fetchLocal).not.toHaveBeenCalled();prove(rebuilt);
});
