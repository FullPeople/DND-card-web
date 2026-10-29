import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import type {Entry} from '../../src/core/model';

export const racialMovementPin={url:'https://5e.kiwee.top/data/races.json',sha256:'a9289aaafcc24674d632b3daafc93eace5bf4496c66c9f5482a6baf304473712',bytes:451902};
const swimClauseSha256='979cf80221c17fdebedfe9d82a3ff88643e4a759fdbef8c67cdb8b19dcc522a7';
type Spec={id:string;mode:'swim'|'climb';baseFeet:number;sourcePath:string;clausePath:string;clauseSha256:string;requiredSources:string[]};
export const racialMovementSpecs:Spec[]=[
 {id:'kiwee:race:vgm:lizardfolk::::::',mode:'swim',baseFeet:30,sourcePath:'race/106',clausePath:'race/106/entries/2/entries/0',clauseSha256:swimClauseSha256,requiredSources:['VGM']},
 {id:'kiwee:race:psz:merfolk::::::',mode:'swim',baseFeet:30,sourcePath:'race/112',clausePath:'race/112/entries/4/entries/0',clauseSha256:swimClauseSha256,requiredSources:['PSZ']},
 {id:'kiwee:race:vgm:triton::::::',mode:'swim',baseFeet:30,sourcePath:'race/149',clausePath:'race/149/entries/2/entries/0',clauseSha256:swimClauseSha256,requiredSources:['VGM']},
 {id:'kiwee:race:mot:triton::::::',mode:'swim',baseFeet:30,sourcePath:'race/147',clausePath:'race/149/entries/2/entries/0',clauseSha256:swimClauseSha256,requiredSources:['MOT','VGM']},
 {id:'kiwee:race:mtf:elf%20(sea)::::::%E7%B2%BE%E7%81%B5',mode:'swim',baseFeet:30,sourcePath:'subrace/19',clausePath:'subrace/19/entries/1/entries/0',clauseSha256:'cb44613a28ac55056a878772b1edf30a351f45d54b5e8d628df1f60f149d4fd2',requiredSources:['MTF','PHB']},
 {id:'kiwee:race:eepc:genasi%20(water)::::::%E5%85%83%E7%B4%A0%E8%A3%94',mode:'swim',baseFeet:30,sourcePath:'subrace/30',clausePath:'subrace/30/entries/2/entries/0',clauseSha256:swimClauseSha256,requiredSources:['EEPC']},
 ...[
  ['kiwee:race:psx:merfolk%20(ixalan%3B%20blue)::::::%E4%BA%BA%E9%B1%BC','subrace/73',['PSX','PSZ']],
  ['kiwee:race:psx:merfolk%20(ixalan%3B%20green)::::::%E4%BA%BA%E9%B1%BC','subrace/74',['PSX','PSZ']],
  ['kiwee:race:psz:merfolk%20(zendikar%3B%20cosi%20creed)::::::%E4%BA%BA%E9%B1%BC','subrace/75',['PSZ']],
  ['kiwee:race:psz:merfolk%20(zendikar%3B%20emeria%20creed)::::::%E4%BA%BA%E9%B1%BC','subrace/76',['PSZ']],
  ['kiwee:race:psz:merfolk%20(zendikar%3B%20ula%20creed)::::::%E4%BA%BA%E9%B1%BC','subrace/77',['PSZ']],
 ].map(([id,sourcePath,requiredSources])=>({id:id as string,mode:'swim' as const,baseFeet:30,sourcePath:sourcePath as string,clausePath:'race/112/entries/4/entries/0',clauseSha256:swimClauseSha256,requiredSources:requiredSources as string[]})),
 {id:'kiwee:race:vgm:tabaxi::::::',mode:'climb',baseFeet:20,sourcePath:'race/141',clausePath:'race/141/entries/4/entries/0',clauseSha256:'35e8adc6175a3b8614cb36195fd9eee2a22769d9fc914398b8704b1657ca65f8',requiredSources:['VGM']},
];
export const racialMovementHeldSpecs=[
 ...['kiwee:race:dmg:aarakocra::::::','kiwee:race:dmg:bullywug::::::','kiwee:race:dmg:kuo-toa::::::','kiwee:race:dmg:lizardfolk::::::','kiwee:race:dmg:merfolk::::::','kiwee:race:aag:giff::::::','kiwee:race:aag:hadozee::::::','kiwee:race:oga:grung::::::','kiwee:race:lr:locathah::::::'].map(id=>({id,holdCode:'source-movement-clause-absent'})),
 ...['kiwee:race:eepc:aarakocra::::::','kiwee:race:mpmm:aarakocra::::::','kiwee:race:psa:aven::::::','kiwee:race:psd:aven::::::','kiwee:race:psa:aven%20(hawk-headed)::::::%E8%89%BE%E6%96%87','kiwee:race:psa:aven%20(ibis-headed)::::::%E8%89%BE%E6%96%87','kiwee:race:lfl:faerie::::::','kiwee:race:lfl:faerie%3B%20lorwyn::::::','kiwee:race:lfl:faerie%3B%20shadowmoor::::::','kiwee:race:mpmm:fairy::::::','kiwee:race:wbtw:fairy::::::','kiwee:race:scc:owlin::::::','kiwee:race:psx:siren::::::','kiwee:race:psz:kor::::::','kiwee:race:scag:tiefling%20(variant%3B%20winged)::::::%E6%8F%90%E5%A4%AB%E6%9E%97'].map(id=>({id,holdCode:'armor-or-encumbrance-condition'})),
 {id:'kiwee:race:scag:variant%3B%20aquatic%20elf%20descent%3B%20swim%20speed::::::%E5%8D%8A%E7%B2%BE%E7%81%B5',holdCode:'trait-replacement-choice'},
 ...['kiwee:race:rhw:dhampir::::::','kiwee:race:vrgr:dhampir::::::','kiwee:race:mpmm:lizardfolk::::::','kiwee:race:mpmm:sea%20elf::::::','kiwee:race:mpmm:tabaxi::::::','kiwee:race:mpmm:triton::::::','kiwee:race:mpmm:genasi%20(water)::::::%E5%85%83%E7%B4%A0%E8%A3%94'].map(id=>({id,holdCode:'nonfixed-speed-relation'})),
];
export const racialMovementDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const racialMovementSnapshot=(entry:Entry)=>{const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(key=>v[key]!==undefined).map(key=>[key,sorted(v[key])])):v;return racialMovementDigest(sorted(entry));};
let cached:Entry[]|undefined;
export function racialMovementOriginal(){
 const marker=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,marker),guard=(globalThis as any)[marker];
 if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)throw Error('Mandatory process-startup offline fetch boundary required');
 const directory=process.env.RACIAL_MOVEMENT_FROZEN_DIR;if(!directory)throw Error('Mandatory RACIAL_MOVEMENT_FROZEN_DIR required');
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),rows=index.rows.filter((row:any)=>row.url===racialMovementPin.url&&row.sha256===racialMovementPin.sha256);
 if(rows.length!==1)throw Error('Exact original racial movement pin required');
 const bytes=readFileSync(`${directory}/${rows[0].path}`),body=JSON.parse(bytes.toString('utf8'));
 if(bytes.length!==racialMovementPin.bytes||createHash('sha256').update(bytes).digest('hex')!==racialMovementPin.sha256||racialMovementDigest(body)!==racialMovementPin.sha256)throw Error('Original racial movement byte/canonical SHA mismatch');
 for(const spec of racialMovementSpecs){const clause=spec.clausePath.split('/').reduce((value:any,key)=>value?.[key],body);if(typeof clause!=='string'||createHash('sha256').update(clause).digest('hex')!==spec.clauseSha256)throw Error('Exact reviewed original movement clause required');}
 return body;
}
export function racialMovementAllEntries():Entry[]{if(!cached)cached=normalizeCatalogData(racialMovementOriginal(),racialMovementPin.sha256,'kiwee');return cached;}
export function racialMovementEntries():Entry[]{
 const all=racialMovementAllEntries(),selected=racialMovementSpecs.map(spec=>{const matches=all.filter(entry=>entry.id===spec.id);if(matches.length!==1)throw Error('Unique exact normalized racial movement entry required');const entry=matches[0];if(entry.kind!=='race'||entry.raw._copy||entry.raw._unresolvedParent||entry.raw.speed?.[spec.mode]!==spec.baseFeet)throw Error('Reviewed fixed movement form changed');return entry;});
 if(selected.length!==12||new Set(selected.map(entry=>entry.id)).size!==12)throw Error('Exact12 source-owned fixed movement entries required');return selected;
}
