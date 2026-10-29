import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import type {Entry} from '../../src/core/model';

// Immutable source IO only. Consumers must clone cached entries before mutation.
export const relativeRacialMovementPin={url:'https://5e.kiwee.top/data/races.json',sha256:'a9289aaafcc24674d632b3daafc93eace5bf4496c66c9f5482a6baf304473712',bytes:451902}as const;
type Form='canonical'|'app';
type Header={id:string;kind:'race';name:string;english:string;source:string;edition:'both';packId:'kiwee';page:number;category:'race'|'subrace'};
export interface RelativeRacialMovementSpec {id:string;sourcePath:string;mode:'swim'|'climb';clausePath:string;clauseSha256:string;requiredSources:string[];header:Header;walkFeet:number;expectedSnapshotSha256:string;parentPath?:string}
const makeHeader=(id:string,name:string,english:string,source:string,page:number,category:'race'|'subrace'='race'):Header=>({id,kind:'race',name,english,source,edition:'both',packId:'kiwee',page,category});
const swimClauseSha256='ced322e9ab17945461319b2bf51e2f9606dc7f06d2f31276cd53511e265ed4cb';
export const relativeRacialMovementSpecs:readonly RelativeRacialMovementSpec[]=[
 {id:'kiwee:race:vrgr:dhampir::::::',sourcePath:'race/26',mode:'climb',clausePath:'race/26/entries/4/entries/0',clauseSha256:'9ad801c084a73eab5dd19a6ae8057207d96b2e2aca96ab4153075dc5dc4688b9',requiredSources:['VRGR'],header:makeHeader('kiwee:race:vrgr:dhampir::::::','半血裔','Dhampir','VRGR',16),walkFeet:35,expectedSnapshotSha256:'cb8dc00285292fd3f8e34a2fe67847e5c20e3a54366c379fc96eac06f1e2adea'},
 {id:'kiwee:race:mpmm:tabaxi::::::',sourcePath:'race/140',mode:'climb',clausePath:'race/140/entries/1/entries/0',clauseSha256:'f8e5437622807682ea08da1bacbeb047204c898b1c250e5f38bab245ea0d14d0',requiredSources:['MPMM'],header:makeHeader('kiwee:race:mpmm:tabaxi::::::','斑猫人','Tabaxi','MPMM',33),walkFeet:30,expectedSnapshotSha256:'6fe6f1eeaf2272169523e86ce04d66909602d0d755ccd55b59d07dd1de8fca6d'},
 {id:'kiwee:race:mpmm:lizardfolk::::::',sourcePath:'race/105',mode:'swim',clausePath:'race/105/entries/0/entries/0',clauseSha256:swimClauseSha256,requiredSources:['MPMM'],header:makeHeader('kiwee:race:mpmm:lizardfolk::::::','蜥蜴人','Lizardfolk','MPMM',26),walkFeet:30,expectedSnapshotSha256:'ceb6e6e0a7569e80932632ed5998e7a6418a16b4af9bffaa9f7fc8e0f14fc3f3'},
 {id:'kiwee:race:mpmm:sea%20elf::::::',sourcePath:'race/132',mode:'swim',clausePath:'race/132/entries/1/entries/0',clauseSha256:swimClauseSha256,requiredSources:['MPMM'],header:makeHeader('kiwee:race:mpmm:sea%20elf::::::','海精灵','Sea Elf','MPMM',30),walkFeet:30,expectedSnapshotSha256:'9d1c838fa650249af4c79d88cbb5f56f57543c955830316382b0cb6f88f7c85c'},
 {id:'kiwee:race:mpmm:triton::::::',sourcePath:'race/148',mode:'swim',clausePath:'race/148/entries/0/entries/0',clauseSha256:swimClauseSha256,requiredSources:['MPMM'],header:makeHeader('kiwee:race:mpmm:triton::::::','梭螺鱼人','Triton','MPMM',35),walkFeet:30,expectedSnapshotSha256:'5e3b6ab6c23fcc66fc75932c9c266c080c913d07d6e23f2932bf786536834eaa'},
 {id:'kiwee:race:mpmm:genasi%20(water)::::::%E5%85%83%E7%B4%A0%E8%A3%94',sourcePath:'subrace/34',mode:'swim',clausePath:'subrace/34/entries/0/entries/0',clauseSha256:swimClauseSha256,requiredSources:['MPMM'],header:makeHeader('kiwee:race:mpmm:genasi%20(water)::::::%E5%85%83%E7%B4%A0%E8%A3%94','元素裔（水）','Genasi (Water)','MPMM',17,'subrace'),walkFeet:30,expectedSnapshotSha256:'39d1f08ded0f169035a06fad56bb183995af177cd4d081f4c9e6db2cc85c5176',parentPath:'race/49'},
];
const heldSpecs=[
 {id:'kiwee:race:rhw:dhampir::::::',sourcePath:'race/25',mode:'climb' as const,walkFeet:35,header:makeHeader('kiwee:race:rhw:dhampir::::::','半血裔','Dhampir','RHW',28),expectedSnapshotSha256:'360eef49df3321b431739efc64f9abf45a5e82d261fa9e023a9212384726517f',reasonCode:'linked-speed-reference-not-explicit-walking'},
 {id:'kiwee:race:aag:giff::::::',sourcePath:'race/50',mode:'swim' as const,walkFeet:30,header:makeHeader('kiwee:race:aag:giff::::::','诘弗人','Giff','AAG',12),expectedSnapshotSha256:'fbb63e088fd1a77b290d58a98fcfe102cdf0c7ca7f882a2bbc6987602afc89e3',reasonCode:'source-movement-clause-absent'},
 {id:'kiwee:race:aag:hadozee::::::',sourcePath:'race/70',mode:'climb' as const,walkFeet:30,header:makeHeader('kiwee:race:aag:hadozee::::::','鼯猴人','Hadozee','AAG',13),expectedSnapshotSha256:'901c51d9f64f93a620b7348c55cacdccf20bacb663b24eeb54c95524c281a0ed',reasonCode:'source-movement-clause-absent'},
]as const;
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const relativeRacialMovementSnapshot=(value:unknown)=>digest(JSON.stringify(sorted(value)));
const fail:(code:string)=>never=code=>{throw Error('RELATIVE_RACIAL_MOVEMENT_SOURCE_'+code);};
const header=(entry:Entry)=>({id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,page:entry.page??null,category:entry.raw._category});
function boundary(){const key=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,key),guard=(globalThis as any)[key];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_BOUNDARY');}
let original:Record<string,any>|undefined;
const at=(value:any,path:string):any=>path.split('/').reduce((row,key)=>row?.[key],value);
function body():Record<string,any>{
 boundary();if(original)return original;const directory=process.env.RELATIVE_RACIAL_MOVEMENT_FROZEN_DIR;if(!directory)fail('FROZEN_DIRECTORY');const root=realpathSync(directory),index=JSON.parse(readFileSync(root+'/index.json','utf8'));if(!Array.isArray(index.rows))fail('INDEX');const rows=index.rows.filter((row:any)=>row?.url===relativeRacialMovementPin.url),expectedPath='files/'+relativeRacialMovementPin.sha256+'.json';
 if(rows.length!==1||rows[0].sha256!==relativeRacialMovementPin.sha256||rows[0].path!==expectedPath)fail('INPUT_PIN');const file=realpathSync(root+'/'+rows[0].path);if(!file.startsWith(root+'/'))fail('INPUT_PATH');const bytes=readFileSync(file);if(bytes.length!==relativeRacialMovementPin.bytes||digest(bytes)!==relativeRacialMovementPin.sha256)fail('INPUT_BYTES');const source=JSON.parse(bytes.toString('utf8'));if(digest(JSON.stringify(source))!==relativeRacialMovementPin.sha256)fail('INPUT_CANONICAL');
 // The exact transport and canonical JSON pins precede every clause check.
 for(const spec of relativeRacialMovementSpecs){const clause=at(source,spec.clausePath);if(typeof clause!=='string'||digest(clause)!==spec.clauseSha256)fail('SOURCE_CLAUSE');}
 for(const spec of [...relativeRacialMovementSpecs,...heldSpecs]){const raw=at(source,spec.sourcePath),subrace=spec.sourcePath==='subrace/34';if(!raw||raw._copy||raw._unresolvedParent||raw.source!==spec.header.source||raw.page!==spec.header.page||raw.name!==(subrace?'水':spec.header.name)||raw.ENG_name!==(subrace?'Water':spec.header.english)||raw.speed?.walk!==spec.walkFeet||raw.speed?.[spec.mode]!==true)fail('ORIGINAL_HEADER_OR_SPEED');}
 const water=at(source,'subrace/34'),parent=at(source,'race/49');if(parent?.name!=='元素裔'||parent.ENG_name!=='Genasi'||parent.source!=='MPMM'||parent.page!==16||parent.speed!==30||parent._copy||water.raceName!==parent.name||water.raceSource!==parent.source)fail('GENASI_PARENT');
 return original=source;
}
const cache:Partial<Record<Form,Entry[]>>={};
function allEntries(form:Form):Entry[]{
 boundary();if(form!=='canonical'&&form!=='app')fail('FORM');if(cache[form])return cache[form]!;
 // Two independent complete original-body normalizations, with the exact single
 // races transport revision. The actual App then hydrates each normalized row;
 // hydrateSpellLookup is a non-spell early return, not an equipment accumulator.
 const normalized=normalizeCatalogData(structuredClone(body()),relativeRacialMovementPin.sha256,'kiwee'),entries=form==='app'?normalized.map(entry=>hydrateSpellLookup(entry,{},'')):normalized;
 return cache[form]=[...relativeRacialMovementSpecs,...heldSpecs].map(spec=>{const matches=entries.filter(entry=>entry.id===spec.id);if(matches.length!==1)fail('UNIQUE_IDENTITY');const entry=matches[0];if(relativeRacialMovementSnapshot(header(entry))!==relativeRacialMovementSnapshot(spec.header)||entry.revision!==relativeRacialMovementPin.sha256||entry.raw._copy||entry.raw._unresolvedParent||entry.raw.speed?.walk!==spec.walkFeet||entry.raw.speed?.[spec.mode]!==true||relativeRacialMovementSnapshot(entry)!==spec.expectedSnapshotSha256)fail('COMPLETE_NORMALIZED_FORM');if(spec.sourcePath==='subrace/34'&&(entry.raw._parentName!=='元素裔'||entry.raw._parentSource!=='MPMM'||entry.raw._subraceName!=='水'))fail('COMPOSED_SUBRACE');return entry;});
}
export function relativeRacialMovementEntries(form:Form='canonical'):Entry[]{return allEntries(form).slice(0,relativeRacialMovementSpecs.length);}
export function relativeRacialMovementFind(idOrSourcePath:string=relativeRacialMovementSpecs[0].id,form:Form='canonical'):Entry{const index=relativeRacialMovementSpecs.findIndex(spec=>spec.id===idOrSourcePath||spec.sourcePath===idOrSourcePath);if(index<0)fail('UNREVIEWED_IDENTITY');return relativeRacialMovementEntries(form)[index];}
export function relativeRacialMovementHeldEntries(form:Form='canonical'):Entry[]{return allEntries(form).slice(relativeRacialMovementSpecs.length);}
const forms=(canonical:Entry,app:Entry)=>([{form:'canonical',entry:canonical},{form:'app',entry:app}]as const).map(({form,entry})=>({form,revision:entry.revision,completeSnapshotSha256:relativeRacialMovementSnapshot(entry),canonicalReboundSnapshotSha256:relativeRacialMovementSnapshot({...entry,id:canonical.id,revision:canonical.revision})}));
function buildEvidence(){
 const canonical=relativeRacialMovementEntries(),app=relativeRacialMovementEntries('app'),held=relativeRacialMovementHeldEntries(),heldApp=relativeRacialMovementHeldEntries('app');
 const rules=relativeRacialMovementSpecs.map((spec,index)=>{const entry=canonical[index],final=app[index];if(entry.id!==final.id)fail('FORM_IDENTITY');return{...header(entry),revision:entry.revision,sourcePath:spec.sourcePath,mode:spec.mode,relation:'equal-current-walking' as const,requiredSources:spec.requiredSources,fullNormalizedSnapshotSha256:relativeRacialMovementSnapshot(entry),forms:forms(entry,final),sourceClauses:[{path:spec.clausePath,utf8Sha256:spec.clauseSha256}],...(spec.parentPath?{parentSourcePath:spec.parentPath}:{}),wholeEntryCompletionCredit:0};});
 const holds=heldSpecs.map((spec,index)=>({...header(held[index]),revision:held[index].revision,sourcePath:spec.sourcePath,mode:spec.mode,rawModeValue:true,reasonCode:spec.reasonCode,fullNormalizedSnapshotSha256:relativeRacialMovementSnapshot(held[index]),forms:forms(held[index],heldApp[index])}));
 const verifiedRouteProofs=rules.reduce((sum,rule)=>sum+rule.forms.length,0),distinctNormalizedSnapshotForms=new Set(rules.flatMap(rule=>rule.forms.map(form=>form.completeSnapshotSha256))).size;
 if(rules.length!==6||new Set(rules.map(rule=>rule.id)).size!==6||verifiedRouteProofs!==12||holds.length!==3||new Set(holds.map(hold=>hold.id)).size!==3||rules.some(rule=>holds.some(hold=>hold.id===rule.id)))fail('COUNTS');
 return{schemaVersion:1,scope:'exact-six-source-qualified-relative-racial-movement',sourceProseIncluded:false,wholeEntryCompletionCredit:0,newReportWitnessCredit:0,inputs:[relativeRacialMovementPin],counts:{owners:6,verifiedRouteProofs,distinctNormalizedSnapshotForms,heldOwners:3},normalization:{canonical:'complete-original-races-body-through-installed-normalizeCatalogData',app:'independent-complete-original-races-body-normalize-then-real-hydrateSpellLookup',transportRevision:relativeRacialMovementPin.sha256,noPayloadRepair:true},policy:{relation:'equal-current-walking',walkingBaseline:'current-derived-walking-after-existing-scalars',doesNotModifyWalking:true,qualifiedArmorRestriction:'none',manualMechanisms:['dhampir-level-three-hands-free-wall-ceiling-climbing','dhampir-ancestral-legacy-retained-movement','conditional-and-world-movement-execution']},rules,holds};
}
let evidence:ReturnType<typeof buildEvidence>|undefined;
export function relativeRacialMovementSourceEvidence(){boundary();return evidence??=buildEvidence();}
