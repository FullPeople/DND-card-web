import {afterEach,beforeAll,beforeEach,it,expect,vi} from 'vitest';
const disk=vi.hoisted(()=>new Map<string,any>());
// A mandatory process-startup preload, not this test module, establishes the
// permanent rejecting baseline. Missing worker inheritance fails before reads.
const network=vi.hoisted(()=>{const key=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,key),guard=(globalThis as any)[key];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||typeof guard.deny!=='function'||!Array.isArray(guard.unexpected)||globalThis.fetch!==guard.deny)throw Error('Offline catalog startup preload is required in this isolated worker.');return guard as {version:1;deny:typeof fetch;unexpected:string[]};});
vi.mock('../src/platform/storage',()=>({readCache:async(key:string)=>structuredClone(disk.get(key)),writeCache:async(key:string,v:any)=>{disk.set(key,structuredClone(v));}}));
import {loadCatalog} from '../src/data/catalog';
import {DEFAULT_HOMEBREW} from '../src/data/homebrew';
import {DEFAULT_SOURCE} from '../src/data/catalogSource';
import {itemChargeInput,itemChargeSnapshot} from './helpers/itemChargeDebitFixture';
import evidence from '../src/core/automation/attunedItemChargeDebitEvidence.json';
import {itemChargeRule} from '../src/core/automation/itemChargeDebits';
import type {Entry} from '../src/core/model';
const primary=evidence.rules.find(r=>r.supported&&r.packId==='kiwee')!,brew=evidence.rules.find(r=>r.supported&&r.packId==='kiwee-homebrew'),targets=[primary,...(brew?[brew]:[])];
let cold:Entry[]|undefined,controller:AbortController|undefined,pending:Promise<void>|undefined;
const bodies=new Map<string,unknown>();
const brewPath=brew?decodeURIComponent(new URL(brew.input.url).pathname).slice(1):undefined;
const emptyPaths=['data/bestiary/template.json','data/bestiary/legendarygroups.json','data/generated/gendata-variantrules.json','data/magicvariants.json','data/charcreationoptions.json','data/rewards.json','data/psionics.json','data/deities.json','data/cultsboons.json','data/bastions.json','data/tables.json','data/generated/gendata-tables.json','data/races.json','data/backgrounds.json','data/feats.json','data/items-base.json','data/optionalfeatures.json','data/conditionsdiseases.json','data/books.json','data/adventures.json','data/variantrules.json','data/actions.json','data/skills.json','data/senses.json','data/languages.json','data/generated/gendata-spell-source-lookup.json','data/class/fixture.json','data/spells/fixture.json','data/bestiary/fixture.json','data/spells/spells-phb.json','data/spells/spells-xphb.json'];
// Only these pinned bodies and authored empty known loader paths may resolve.
// Unexpected URLs are recorded AND asserted, since loadCatalog catches errors.
const fetchLocal=vi.fn(async(input:RequestInfo|URL)=>{
 if(typeof input!=='string'){network.unexpected.push(String(input));throw Error('Unexpected non-string catalog URL blocked offline.');}
 let key:string;try{const url=new URL(input);if(url.search||url.hash)throw Error('Unexpected URL suffix');key=url.origin+decodeURIComponent(url.pathname);}catch{network.unexpected.push(input);throw Error('Malformed catalog URL blocked offline.');}
 if(!bodies.has(key)){network.unexpected.push(input);throw Error('Unexpected catalog URL blocked offline.');}
 return new Response(JSON.stringify(bodies.get(key)),{headers:{etag:'opaque-attuned-transport'}});
});
beforeAll(()=>{
 expect(globalThis.fetch).toBe(network.deny);expect(network.unexpected).toEqual([]);expect(typeof Response).toBe('function');disk.clear();
 for(const path of emptyPaths)bodies.set(`${DEFAULT_SOURCE}/${path}`,{});
 for(const category of ['class','spells','bestiary'])bodies.set(`${DEFAULT_SOURCE}/data/${category}/index.json`,{fixture:'fixture.json'});
 bodies.set(`${DEFAULT_SOURCE}/data/items.json`,itemChargeInput(primary.input.url,primary.input.sha256));
 bodies.set(`${DEFAULT_HOMEBREW}/_generated/index-sources.json`,brew?{TEST:brewPath}:{});
 if(brew)bodies.set(`${DEFAULT_HOMEBREW}/${brewPath}`,itemChargeInput(brew.input.url,brew.input.sha256));
});
beforeEach(()=>{expect(globalThis.fetch).toBe(network.deny);expect(network.unexpected).toEqual([]);controller=new AbortController();vi.stubGlobal('fetch',fetchLocal);fetchLocal.mockClear();});
afterEach(async()=>{try{controller?.abort();await pending?.catch(()=>{});}finally{pending=undefined;vi.unstubAllGlobals();expect(globalThis.fetch).toBe(network.deny);expect(network.unexpected).toEqual([]);}});
async function read(){expect(globalThis.fetch).toBe(fetchLocal);const rows=new Map<string,Entry>();pending=loadCatalog(batch=>batch.forEach(e=>rows.set(e.id,e)),()=>{},controller!.signal);await pending;return [...rows.values()];}
function prove(rows:Entry[]){for(const expected of targets){const row=rows.find(e=>e.id===expected.id)!;expect(row).toBeDefined();expect(row.revision).toContain('opaque-attuned-transport');const before=itemChargeSnapshot(row);expect(itemChargeRule(row)?.id).toBe(expected.id);expect(itemChargeSnapshot(row)).toBe(before);}}
it('actual cold loader authenticates exact attuned source without trusting transport revision',async()=>{cold=await read();prove(cold);});
it('actual warm parsed cache preserves the same strict attuned source snapshots without fetching',async()=>{expect(cold?.length).toBeGreaterThan(0);const warm=await read();expect(itemChargeSnapshot(warm)).toBe(itemChargeSnapshot(cold));expect(fetchLocal).not.toHaveBeenCalled();prove(warm);});
it('actual raw-cache rebuild preserves exact attuned source snapshots without fetching',async()=>{expect(cold?.length).toBeGreaterThan(0);for(const key of disk.keys())if(key.startsWith('wiki-normalized-'))disk.delete(key);const rebuilt=await read();expect(itemChargeSnapshot(rebuilt)).toBe(itemChargeSnapshot(cold));expect(fetchLocal).not.toHaveBeenCalled();prove(rebuilt);});
