import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import type {Entry} from '../../src/core/model';

// Exact-source IO only. Consumers must clone the retained complete entries.
export const racialCarryingPin={url:'https://5e.kiwee.top/data/races.json',sha256:'a9289aaafcc24674d632b3daafc93eace5bf4496c66c9f5482a6baf304473712',bytes:451902}as const;
type Form='canonical'|'app';
type RawHeader={name:string;ENG_name:string;source:string;page:number;edition?:'one'};
type Clause={path:string;utf8Bytes:number;sha256:string;expectedCompleteEntryPath:string};
export interface RacialCarryingSpec {key:string;sourcePath:string;sourceIndex:number;header:RawHeader;rawSha256:string;size:readonly ['M'];sizeIncrement:1;scope:'carrying-capacity-only';sourceClause:Clause}
const sharedClause='50db3e1b7f716b77afd354c91ee4b648475b34e08edaa9b3e8e234310e942e3c';
const centaurClause='d22721bdcdd78409f6886512e86c2dcad3685f62524a916063be421cd8840ea6';
function spec(sourceIndex:number,name:string,english:string,source:string,page:number,rawSha256:string,traitIndex:number,utf8Bytes=105,sha256=sharedClause,edition?:'one'):RacialCarryingSpec{const key='race/'+sourceIndex;return{key,sourcePath:key,sourceIndex,header:{name,ENG_name:english,source,page,...(edition?{edition}:{})},rawSha256,size:['M'],sizeIncrement:1,scope:'carrying-capacity-only',sourceClause:{path:key+'/entries/'+traitIndex+'/entries/0',utf8Bytes,sha256,expectedCompleteEntryPath:'raw/entries/'+traitIndex+'/entries/0'}};}
// Fourteen source candidates only; normalized identities are discovered below.
export const racialCarryingSpecs:readonly RacialCarryingSpec[]=[
 spec(13,'熊地精','Bugbear','ERLW',25,'0067ca5c5166bb6c7ff6e103a61fa7426229bf31a6420f4549aa833720dd974e',5),
 spec(14,'熊地精','Bugbear','MPMM',8,'80d894d31438b01ef0edbeff9e11ad72bd6939e363dc76975a2dd74e44f07ab0',4),
 spec(15,'熊地精','Bugbear','VGM',119,'30b04b9dc2ca4b30005de122ebe58d90a8ce867f04177930c88bd37a112e0bdf',4),
 spec(17,'人马','Centaur','GGR',15,'56fd736d34747ec29a47df82c12c10dcb4aae39fb2e135939a8061dc51070b78',6,99,centaurClause),
 spec(19,'人马','Centaur','MPMM',9,'ef3392bfe4092321aec95ca72716421353e834a4d2c08498e1d73f76ef03d88f',2,99,centaurClause),
 spec(45,'费尔伯格人','Firbolg','MPMM',15,'cbf4a0ad58dc8c0e854cb7c516a38dbfa314c1f671567d7d7fdd13ae6e1dd78b',2),
 spec(46,'费尔伯格人','Firbolg','VGM',107,'d9ca7df8c3d90ae1d8e68bd092976b063804155781187d9dfece5e3c94dcd6da',4),
 spec(65,'歌利亚','Goliath','MPMM',21,'d141f667825f4e353c844e38c3976988688403905891ee00277f9f4c0af0ac49',0,153,'3c72bd2bca5bbdeebb2a3720c785bf60c0504bbad9aa14b715a2376901260fb5'),
 spec(66,'歌利亚','Goliath','VGM',108,'c6af3ee9e70bebb9836449ef00ae18dfd2627a6cfff4d8ef8020b34174b4afea',4),
 spec(67,'歌利亚','Goliath','XPHB',192,'a1638b44231efd8d05bf97b7bd6d9d4a84582e6f838e086ef80cc4c42a5fc530',2,176,'59b9e4d48de43b346cd7cf0209e46c98b1d5b139ef80b672668527e2a164cc97','one'),
 spec(109,'象族','Loxodon','GGR',17,'4c955812ee3c504ab66882d1b3140bbcfac958b5d740f534d83227384c73a62d',3),
 spec(120,'兽人','Orc','ERLW',31,'d392d270415fda3ac4b281b21670e5d001abb89599435b89f7351404d71f80ca',6),
 spec(121,'兽人','Orc','MPMM',28,'6a774d11028147af226fc842206d81aac3372d335676f08479e8dda55d935030',2),
 spec(122,'兽人','Orc','VGM',120,'1dec36cd92902745cd2d4476135a888db432b487676fdd3e7b0567691755f1d3',5),
];
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const racialCarryingSnapshot=(value:unknown)=>digest(JSON.stringify(sorted(value)));
const fail:(code:string)=>never=code=>{throw Error('RACIAL_CARRYING_SOURCE_'+code);};
const at=(value:any,path:string):any=>path.split('/').reduce((row,key)=>row?.[key],value);
function boundary(){const key=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,key),guard=(globalThis as any)[key];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_BOUNDARY');}
const rawHeader=(raw:Record<string,any>)=>({name:raw.name,ENG_name:raw.ENG_name,source:raw.source,page:raw.page,...(raw.edition===undefined?{}:{edition:raw.edition})});
const header=(entry:Entry)=>({id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,page:entry.page??null,category:entry.raw._category});
const expectedHeader=(spec:RacialCarryingSpec)=>({kind:'race',name:spec.header.name,english:spec.header.ENG_name,source:spec.header.source,edition:spec.header.edition==='one'||spec.header.source==='XPHB'?'2024':'both',packId:'kiwee',page:spec.header.page,category:'race'});
let original:Record<string,any>|undefined;
function body():Record<string,any>{
 boundary();if(original)return original;const directory=process.env.RACIAL_CARRYING_FROZEN_DIR;if(!directory)fail('FROZEN_DIRECTORY');const root=realpathSync(directory),index=JSON.parse(readFileSync(root+'/index.json','utf8'));if(!Array.isArray(index.rows))fail('INDEX');const rows=index.rows.filter((row:any)=>row?.url===racialCarryingPin.url),expectedPath='files/'+racialCarryingPin.sha256+'.json';if(rows.length!==1||rows[0].sha256!==racialCarryingPin.sha256||rows[0].path!==expectedPath)fail('INPUT_PIN');const file=realpathSync(root+'/'+rows[0].path);if(!file.startsWith(root+'/'))fail('INPUT_PATH');const bytes=readFileSync(file);if(bytes.length!==racialCarryingPin.bytes||digest(bytes)!==racialCarryingPin.sha256)fail('INPUT_BYTES');const source=JSON.parse(bytes.toString('utf8'));if(digest(JSON.stringify(source))!==racialCarryingPin.sha256)fail('INPUT_CANONICAL');
 for(const spec of racialCarryingSpecs){const raw=at(source,spec.sourcePath),clause=at(source,spec.sourceClause.path);if(!raw||Object.hasOwn(raw,'_copy')||raw._unresolvedParent||racialCarryingSnapshot(rawHeader(raw))!==racialCarryingSnapshot(spec.header)||racialCarryingSnapshot(raw)!==spec.rawSha256||racialCarryingSnapshot(raw.size)!==racialCarryingSnapshot(spec.size))fail('EXACT_DIRECT_MEDIUM_ORIGINAL');if(typeof clause!=='string'||Buffer.byteLength(clause,'utf8')!==spec.sourceClause.utf8Bytes||digest(clause)!==spec.sourceClause.sha256)fail('EXACT_QUALIFIED_CARRYING_CLAUSE');}
 return original=source;
}
type Hold={key:string;reasonCode:string;matchCount:number};
type Route={admitted:Map<string,Entry>;rejected:Hold[]};
const cache:Partial<Record<Form,Route>>={};
function route(form:Form):Route{
 boundary();if(form!=='canonical'&&form!=='app')fail('FORM');if(cache[form])return cache[form]!;
 // Each route independently normalizes the complete original with its exact
 // single-input revision. App hydration is the real non-spell early return.
 const normalized=normalizeCatalogData(structuredClone(body()),racialCarryingPin.sha256,'kiwee'),routed=form==='app'?normalized.map(entry=>hydrateSpellLookup(entry,{},'')):normalized,admitted=new Map<string,Entry>(),rejected:Hold[]=[];
 for(const spec of racialCarryingSpecs){const matches=routed.filter(entry=>{const{id,...actual}=header(entry);return racialCarryingSnapshot(actual)===racialCarryingSnapshot(expectedHeader(spec));});if(matches.length!==1){rejected.push({key:spec.key,reasonCode:'complete-normalized-direct-owner-header-not-unique',matchCount:matches.length});continue;}const entry=matches[0];if(!entry.id||entry.revision!==racialCarryingPin.sha256||Object.hasOwn(entry.raw,'_copy')||entry.raw._unresolvedParent||entry.raw._versionBaseName||routed.filter(row=>row.id===entry.id).length!==1||racialCarryingSnapshot(entry.raw.size)!==racialCarryingSnapshot(spec.size)){rejected.push({key:spec.key,reasonCode:'complete-normalized-direct-medium-owner-invalid-or-colliding',matchCount:matches.length});continue;}const clause=at(entry,spec.sourceClause.expectedCompleteEntryPath);if(typeof clause!=='string'||Buffer.byteLength(clause,'utf8')!==spec.sourceClause.utf8Bytes||digest(clause)!==spec.sourceClause.sha256){rejected.push({key:spec.key,reasonCode:'normalized-carrying-clause-not-exact',matchCount:matches.length});continue;}admitted.set(spec.key,entry);}
 // No unselected normalized entry survives this route.
 return cache[form]={admitted,rejected};
}
export function racialCarryingEntries(form:Form='canonical'):Entry[]{return[...route(form).admitted.values()];}
export function racialCarryingFind(key:string=racialCarryingSpecs[0].key,form:Form='canonical'):Entry{if(!racialCarryingSpecs.some(spec=>spec.key===key))fail('UNREVIEWED_KEY');const entry=route(form).admitted.get(key);if(!entry)fail('HELD_NORMALIZED_OWNER');return entry;}
const forms=(canonical:Entry,app:Entry)=>([{form:'canonical',entry:canonical},{form:'app',entry:app}]as const).map(({form,entry})=>({form,id:entry.id,revision:entry.revision,sha256:racialCarryingSnapshot(entry),completeSnapshotSha256:racialCarryingSnapshot(entry),canonicalReboundSnapshotSha256:racialCarryingSnapshot({...entry,id:canonical.id,revision:canonical.revision})}));
function buildEvidence(){
 const canonical=route('canonical'),app=route('app');if(racialCarryingSnapshot([...canonical.admitted.keys()])!==racialCarryingSnapshot([...app.admitted.keys()]))fail('ROUTE_ADMISSION_DISAGREEMENT');
 const rules=racialCarryingSpecs.filter(spec=>canonical.admitted.has(spec.key)).map(spec=>{const entry=canonical.admitted.get(spec.key)!,final=app.admitted.get(spec.key)!;if(entry.id!==final.id)fail('FORM_IDENTITY');return{key:spec.key,...header(entry),revision:entry.revision,fullNormalizedSnapshotSha256:racialCarryingSnapshot(entry),forms:forms(entry,final),requiredSources:[...new Set([entry.source,...(entry.dependencies||[])])],sizeIncrement:spec.sizeIncrement,scope:spec.scope,sourceProof:{path:spec.sourcePath,sourceIndex:spec.sourceIndex,rawSha256:spec.rawSha256,rawHeader:{...spec.header},sourceClause:{...spec.sourceClause},sourceSize:[...spec.size],directNoCopy:true},wholeEntryCompletionCredit:0};});
 const routeForms=rules.flatMap(rule=>rule.forms),counts={actualOwners:rules.length,verifiedRouteProofs:routeForms.length,distinctNormalizedSnapshotForms:new Set(routeForms.map(form=>form.sha256)).size,heldOwners:canonical.rejected.length};if(new Set(rules.map(rule=>rule.id)).size!==rules.length||counts.verifiedRouteProofs!==rules.length*2)fail('COUNTS');
 return{schemaVersion:1,scope:'source-qualified-direct-medium-racial-carrying-capacity-only',inputs:[{...racialCarryingPin}],sourceCandidateCounts:{owners:14},sourceProseIncluded:false,wholeEntryCompletionCredit:0,newReportWitnessCredit:0,counts,normalization:{canonical:'complete-original-races-body-through-installed-normalizeCatalogData',app:'independent-complete-original-races-body-normalize-then-real-hydrateSpellLookup',transportRevision:racialCarryingPin.sha256,noPayloadRepair:true},policy:{operation:'carrying-capacity-only',sizeIncrement:1,sourceSize:['M'],changesActualSize:false,manualMechanisms:['push-drag-lift','grapple-checks','skill-proficiency','temporary-size-changes','movement','other-effects']},rules,normalizationHolds:canonical.rejected};
}
let evidence:ReturnType<typeof buildEvidence>|undefined;
export function racialCarryingSourceEvidence(){boundary();return evidence??=buildEvidence();}
