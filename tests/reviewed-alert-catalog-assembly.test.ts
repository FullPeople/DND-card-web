import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const disk=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('../src/platform/storage',()=>({readCache:vi.fn(async(key:string)=>{const value=disk.get(key);return value===undefined?undefined:structuredClone(value);}),writeCache:vi.fn(async(key:string,value:unknown)=>{disk.set(key,structuredClone(value));})}));
import {loadCatalog,normalizeData,normalizeCatalogData,DEFAULT_SOURCE,type LoadProgress} from '../src/data/catalog';
import {CATALOG_SNAPSHOT_SCHEMA} from '../src/data/catalogSnapshot';
import {DEFAULT_HOMEBREW,homebrewBody,homebrewPaths} from '../src/data/homebrew';
import {EQUIPMENT_TRAINING_ENTRIES} from '../src/data/weaponTraining';
import {SIZE_ENTRIES} from '../src/data/sizes';
import {cardCatalogEntries} from '../src/platform/standaloneCatalogPublication';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedAlertIntent,reviewedAlertRule,reviewedAlertStatus} from '../src/core/automation/reviewedAlert';
import {reviewedModernAlertRule} from '../src/core/automation/reviewedAlertSource';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';
import type {Entry,Raw,RulePack} from '../src/core/model';
import evidence from '../src/core/automation/reviewedAlertEvidence.json';
import {alertDirectory,alertFrozenInput,alertIntent,alertManualSnapshot,alertSnapshot,setupAlert} from './helpers/reviewedAlertCore';

if(process.env.REVIEWED_ALERT_FROZEN_REQUIRED==='1'&&!alertDirectory)throw Error('REVIEWED_ALERT_FROZEN_REQUIRED requires REVIEWED_FEATS_FROZEN_DIR with the exact private frozen corpus.');
type FrozenRow={url:string;path:string;sha256:string};
const basis={packs:[] as RulePack[],custom:[] as Entry[],author:false,monsters:false};

describe.skipIf(!alertDirectory)('full 229-input actual Alert catalog assembly and cache seams',()=>{
 let rows:FrozenRow[],bodies:Map<string,Raw>,cold:{entries:Entry[];progress:LoadProgress},coldHash:string,coldRequests:string[];
 async function read(){const entries=new Map<string,Entry>();let progress!:LoadProgress;await loadCatalog(batch=>batch.forEach(entry=>entries.set(entry.id,entry)),value=>progress=value,new AbortController().signal,false,DEFAULT_SOURCE);return {entries:[...entries.values()],progress};}
 function assembled(entries:Entry[]){return cardCatalogEntries(entries,basis);}
 function confirm(entries:Entry[]){
  const s=setupAlert(),catalog=assembled(entries);syncFeatures(s.c,catalog);const choice=sheetChoices(s.c,catalog).find(row=>row.id===s.choice.id)!,feat=catalog.find(row=>row.id===evidence.feat.entryId)!;expect(choice).toBeDefined();expect(reviewedAlertRule(feat)?.initiativeBonus).toBe(5);expect(reviewedModernAlertRule(catalog.find(row=>row.id===evidence.modern.entryId)!)).toBe(true);
  setSheetChoiceSlot(s.c,choice.id,0,feat.id,catalog);const manual=alertManualSnapshot(s.c),runtime=structuredClone(s.c.runtime);expect(evaluate(s.c).initiative).toBe(2);setReviewedAlertIntent(s.c,choice.id,feat.id,alertIntent(),catalog);expect(reviewedAlertStatus(s.c,choice.id,feat.id)).toMatchObject({eligible:true,active:true,initiativeBonus:5});expect(evaluate(s.c).initiative).toBe(7);expect(alertManualSnapshot(s.c)).toBe(manual);expect(s.c.runtime).toEqual(runtime);
  const reopened=validateCharacter(JSON.parse(JSON.stringify(exportCharacter(s.c))));syncFeatures(reopened,[]);expect(evaluate(reopened).initiative).toBe(7);expect(reopened.reviewedAlert).toEqual(s.c.reviewedAlert);expect(reopened.runtime).toEqual(runtime);return {s,catalog,feat,choice};
 }
 beforeAll(async()=>{
  rows=JSON.parse(readFileSync(`${alertDirectory}/index.json`,'utf8')).rows;expect(rows).toHaveLength(229);expect(new Set(rows.map(row=>row.url)).size).toBe(229);bodies=new Map();
  for(const row of rows){const body=JSON.parse(readFileSync(`${alertDirectory}/${row.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(body)).digest('hex')).toBe(row.sha256);bodies.set(row.url,body);}
  // Independently bind the reviewed inputs, rather than trusting only the index's own declarations.
  for(const [path,sha] of Object.entries({...evidence.inputs,...evidence.legacyClassInputs}))alertFrozenInput(path,sha);
  disk.clear();vi.stubGlobal('fetch',vi.fn(async(url:string)=>{const key=String(url),body=bodies.get(key);if(body===undefined)throw Error(`No exact frozen input for ${key}`);const row=rows.find(value=>value.url===key)!;return new Response(JSON.stringify(body),{headers:{etag:row.sha256}});}));
  cold=await read();coldHash=alertSnapshot(cold.entries);coldRequests=vi.mocked(fetch).mock.calls.map(call=>String(call[0]));
 },120000);
 afterAll(()=>{vi.unstubAllGlobals();disk.clear();});
 it('cold-loads and normalizes all 229 exact inputs, all ordinary categories, equipment seeds and supported homebrew namespaces',()=>{
  expect(cold.progress.failed).toEqual([]);expect(cold.progress.done).toBe(229);expect(cold.progress.total).toBe(229);expect(cold.progress.cached).toBe(0);expect(new Set(coldRequests)).toEqual(new Set(rows.map(row=>row.url)));expect(coldRequests).toHaveLength(229);
  for(const seed of EQUIPMENT_TRAINING_ENTRIES)expect(cold.entries.some(entry=>entry.id===seed.id)).toBe(true);
  const kinds=new Set(cold.entries.map(entry=>entry.kind));for(const kind of ['class','subclass','race','background','feat','spell','item','feature','condition','rule','monster'])expect(kinds.has(kind as Entry['kind'])).toBe(true);
  const brewIndex=bodies.get(`${DEFAULT_HOMEBREW}/_generated/index-sources.json`)!;expect(brewIndex).toBeDefined();const brewPaths=homebrewPaths(brewIndex);expect(brewPaths.length).toBeGreaterThan(0);
  for(const path of brewPaths){const url=`${DEFAULT_HOMEBREW}/${path.split('/').map(encodeURIComponent).join('/')}`,body=bodies.get(url)!;expect(body).toBeDefined();for(const expected of normalizeData(homebrewBody(structuredClone(body)),'assert-brew','kiwee-homebrew')){const actual=cold.entries.find(entry=>entry.id===expected.id);expect(actual?.packId,expected.id).toBe('kiwee-homebrew');expect(actual?.raw._homebrew,expected.id).toBe(expected.raw._homebrew);}}
  expect(cold.entries.filter(entry=>entry.kind==='feat'&&entry.english==='Alert').map(entry=>entry.id).sort()).toEqual([evidence.feat.entryId,evidence.modern.entryId].sort());
  console.info('Alert full frozen catalog metadata',JSON.stringify({inputs:rows.length,entries:cold.entries.length,homebrewInputs:brewPaths.length,homebrewEntries:cold.entries.filter(entry=>entry.packId==='kiwee-homebrew').length}));
 },120000);
 it('assembles real combined base/magic equipment and App filtering without any Alert name-based catalog pruning',()=>{
  const equipment=Object.assign({},...['items-base.json','items.json','magicvariants.json'].map(path=>structuredClone(bodies.get(`${DEFAULT_SOURCE}/data/${path}`)!))),specific=normalizeCatalogData(equipment,'assert-combined','kiwee','magicItems');expect(specific.length).toBeGreaterThan(0);
  const ids=new Set(cold.entries.map(entry=>entry.id));for(const expected of specific)expect(ids.has(expected.id)).toBe(true);expect(cold.entries.some(entry=>entry.revision.includes('data/items-base.json:')&&entry.revision.includes('data/items.json:')&&entry.revision.includes('data/magicvariants.json:'))).toBe(true);
  const standard=assembled(cold.entries);for(const seed of SIZE_ENTRIES)expect(standard.some(entry=>entry.id===seed.id)).toBe(true);expect(standard.some(entry=>entry.kind==='monster')).toBe(false);expect(cardCatalogEntries(cold.entries,{...basis,monsters:true}).filter(entry=>entry.kind==='monster').length).toBeGreaterThan(0);
  const noise=normalizeData({classFeature:[{name:'Authored unrelated feature',ENG_name:'Alert',source:'PHB',className:'Authored class',classSource:'PHB',level:1,entries:['Authored unrelated same-name feature.']}]},'authored-noise')[0],custom={...structuredClone(noise),id:'authored-custom-alert'},pack:RulePack={schemaVersion:1,id:'authored-pack',name:'Authored pack',version:'1',editions:['2014'],requires:[],conflicts:[],entries:[noise]};
  const withPacks=cardCatalogEntries(cold.entries,{...basis,packs:[pack],custom:[custom]});expect(withPacks.find(entry=>entry.id===noise.id)?.raw._customPack).toBe(true);expect(withPacks.some(entry=>entry.id===custom.id)).toBe(false);expect(cardCatalogEntries(cold.entries,{...basis,custom:[custom],author:true}).some(entry=>entry.id===custom.id)).toBe(true);
  const {s,catalog,feat,choice}=confirm([...cold.entries,noise]);expect(catalog.some(entry=>entry.id===noise.id&&entry.english==='Alert'&&entry.kind==='feature')).toBe(true);
  const corrupt={...structuredClone(noise),id:evidence.feat.entryId};const before=alertSnapshot(s.c);expect(()=>setReviewedAlertIntent(s.c,choice.id,feat.id,alertIntent(),[...catalog,corrupt])).toThrow('冲突');expect(alertSnapshot(s.c)).toBe(before);
 },120000);
 it('a cloned complete catalog confirms exactly initiative 7 while manual state, spent resources and offline snapshots are preserved',()=>{confirm(structuredClone(cold.entries));},120000);
 it('the parsed normalized catalogSnapshot seam opens the same complete catalog without fetching or replacing the source records',async()=>{
  expect([...disk.keys()].some(key=>key.startsWith(CATALOG_SNAPSHOT_SCHEMA))).toBe(true);vi.mocked(fetch).mockClear();const warm=await read();expect(fetch).not.toHaveBeenCalled();expect(warm.progress.cached).toBe(warm.progress.total);expect(warm.progress.failed).toEqual([]);expect(alertSnapshot(warm.entries)).toBe(coldHash);confirm(warm.entries);
 },120000);
 it('raw per-file caches rebuild the same full catalog after only the parsed snapshot is discarded, with no fetch and no source mutation',async()=>{
  for(const key of disk.keys())if(key.startsWith(CATALOG_SNAPSHOT_SCHEMA))disk.delete(key);vi.mocked(fetch).mockClear();const cached=await read();expect(fetch).not.toHaveBeenCalled();expect(cached.progress.failed).toEqual([]);expect(cached.progress.cached).toBe(229);expect(alertSnapshot(cached.entries)).toBe(coldHash);confirm(cached.entries);
 },120000);
});
