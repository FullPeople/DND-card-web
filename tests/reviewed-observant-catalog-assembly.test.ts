import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const disk=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('../src/platform/storage',()=>({readCache:vi.fn(async(key:string)=>{const value=disk.get(key);return value===undefined?undefined:structuredClone(value);}),writeCache:vi.fn(async(key:string,value:unknown)=>{disk.set(key,structuredClone(value));})}));
import {loadCatalog} from '../src/data/catalog';
import {CATALOG_SNAPSHOT_SCHEMA} from '../src/data/catalogSnapshot';
import {EQUIPMENT_TRAINING_ENTRIES} from '../src/data/weaponTraining';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedObservantIntent,reviewedObservantRule,reviewedObservantStatus} from '../src/core/automation/reviewedObservant';
import {evaluate} from '../src/core/engine';
import {reviewedModernObservantRule} from '../src/core/automation/reviewedObservantSource';
import type {Entry} from '../src/core/model';
import {reviewedObservantSourceData,observantSourceAvailable} from './helpers/observantSourceFixture';
import {reviewedObservantFixture} from './e2e/reviewedObservantFixture';
import {canonicalJsonSha256} from './e2e/reviewedObservantArtifactPrivacy';
const base='https://observant-rules.test';
describe.skipIf(!observantSourceAvailable)('actual loader assembly with private exact Observant records',()=>{
 beforeEach(()=>{disk.clear();const data=reviewedObservantSourceData();vi.stubGlobal('fetch',vi.fn(async(url:string)=>{const path=new URL(url).pathname,body=path==='/data/class/index.json'?{observant:'class-observant.json'}:path.endsWith('/index.json')?{fixture:'empty.json'}:path==='/data/class/class-observant.json'?{class:data.class,classFeature:[...data.classFeature,{name:'观察力',ENG_name:'Observant',source:'PHB',className:'法师',classSource:'PHB',level:1,entries:['原创同名其他种类；不是专长。']}]}:path==='/data/feats.json'?{feat:data.feat}:{};return new Response(JSON.stringify(body),{headers:{etag:'observant-authored-shell-real-feat'}});}));});
 afterEach(()=>vi.unstubAllGlobals());
 async function read(){const entries=new Map<string,Entry>();let progress:any;await loadCatalog(rows=>rows.forEach(row=>entries.set(row.id,row)),value=>progress=value,new AbortController().signal,false,base);return{entries:[...entries.values()],progress};}
 function confirm(entries:Entry[]){const c=reviewedObservantFixture();syncFeatures(c,entries);const choice=sheetChoices(c,entries).find(row=>row.grantLevel===4)!,feat=entries.find(row=>row.english==='Observant'&&row.source==='PHB'&&row.kind==='feat')!;expect(reviewedObservantRule(feat)).toBeDefined();expect(entries.filter(row=>row.english==='Observant'&&row.kind==='feat')).toHaveLength(2);expect(reviewedModernObservantRule(entries.find(row=>row.kind==='feat'&&row.english==='Observant'&&row.source==='XPHB')!)).toBe(true);expect(entries.some(row=>row.english==='Observant'&&row.kind==='feature')).toBe(true);setSheetChoiceSlot(c,choice.id,0,feat.id,entries);setReviewedObservantIntent(c,choice.id,feat.id,{kind:'observant',ability:'int',confirmedManualAbilityExcluded:true,confirmedManualPassivesExcluded:true},entries);expect(reviewedObservantStatus(c,choice.id,feat.id).active).toBe(true);expect(evaluate(c)).toMatchObject({abilities:{int:20},passive:15,passiveInvestigation:20});}
 it('normal cold loader seeds every ordinary category and keeps both Observant edition identities without same-name feature poisoning',async()=>{const{entries,progress}=await read();expect(progress.failed).toEqual([]);expect(progress.done).toBe(progress.total);for(const seed of EQUIPMENT_TRAINING_ENTRIES)expect(entries.some(row=>row.id===seed.id)).toBe(true);confirm(entries);});
 it('the parsed normalized snapshot seam reopens the complete same catalog without reading or replacing source records',async()=>{const cold=await read();expect([...disk.keys()].some(key=>key.startsWith(CATALOG_SNAPSHOT_SCHEMA))).toBe(true);vi.mocked(fetch).mockClear();const warm=await read();expect(fetch).not.toHaveBeenCalled();expect(canonicalJsonSha256(warm.entries)).toBe(canonicalJsonSha256(cold.entries));expect(warm.progress.cached).toBe(warm.progress.total);confirm(warm.entries);});
});
