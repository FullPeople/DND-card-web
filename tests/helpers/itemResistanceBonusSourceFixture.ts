import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import type {Entry} from '../../src/core/model';

// Pure immutable-source IO. No Character, actor, state, engine, projection or
// generated evidence imports. Consumers must clone returned cached Entries.
export const itemResistanceBonusInputPins=[
 {path:'items-base.json',sha256:'8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff',bytes:149813},
 {path:'items.json',sha256:'883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488',bytes:2458443},
 {path:'magicvariants.json',sha256:'4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d',bytes:190573}
]as const;
export type ItemResistanceBonusDamage='acid'|'cold'|'fire'|'force'|'lightning'|'necrotic'|'poison'|'psychic'|'radiant'|'thunder';
export interface ItemResistanceBonusClause {path:string;utf8Sha256:string}
export interface ItemResistanceBonusSpec {sourceIndex:number;name:string;english:string;source:'DMG'|'XDMG';page:number;resistance:ItemResistanceBonusDamage;clauses:readonly ItemResistanceBonusClause[]}
const dragonRows=[
 [213,214,'黑龙鳞甲','Black Dragon Scale Mail','acid','124587f4b0d5f08f891b46641aae98ba4507dfdd265b4ee04b299af230174793'],
 [253,254,'蓝龙鳞甲','Blue Dragon Scale Mail','lightning','6a9d2557d7f8a3ae9e33382997fdd23e5e4dbfe7e056eb110570e3e6c57c8ed3'],
 [309,310,'黄铜龙鳞甲','Brass Dragon Scale Mail','fire','0c242b12e1bd6504d3db9eeb186d6bc3f1e867a05a9cfc8dbe57a11ff9eb02bc'],
 [323,324,'青铜龙鳞甲','Bronze Dragon Scale Mail','lightning','6a9d2557d7f8a3ae9e33382997fdd23e5e4dbfe7e056eb110570e3e6c57c8ed3'],
 [495,496,'赤铜龙鳞甲','Copper Dragon Scale Mail','acid','124587f4b0d5f08f891b46641aae98ba4507dfdd265b4ee04b299af230174793'],
 [888,889,'金龙鳞甲','Gold Dragon Scale Mail','fire','0c242b12e1bd6504d3db9eeb186d6bc3f1e867a05a9cfc8dbe57a11ff9eb02bc'],
 [921,922,'绿龙鳞甲','Green Dragon Scale Mail','poison','71c1cf3266f1a71a87d59bcd900663d481c39d91463af345be4a26a036031a6d'],
 [1734,1735,'红龙鳞甲','Red Dragon Scale Mail','fire','0c242b12e1bd6504d3db9eeb186d6bc3f1e867a05a9cfc8dbe57a11ff9eb02bc'],
 [2036,2037,'银龙鳞甲','Silver Dragon Scale Mail','cold','cdb13a69c1b6c3fd45adf47a453149ce6ae5343a6c712ee68dc60990f8aedd8e'],
 [2463,2464,'白龙鳞甲','White Dragon Scale Mail','cold','cdb13a69c1b6c3fd45adf47a453149ce6ae5343a6c712ee68dc60990f8aedd8e']
]as const;
const ringRows=[
 [1752,1753,'强酸抗性戒指','Ring of Acid Resistance','acid'],
 [1759,1760,'寒冷抗性戒指','Ring of Cold Resistance','cold'],
 [1775,1776,'火焰抗性戒指','Ring of Fire Resistance','fire'],
 [1777,1778,'力场抗性戒指','Ring of Force Resistance','force'],
 [1785,1786,'闪电抗性戒指','Ring of Lightning Resistance','lightning'],
 [1789,1790,'暗蚀抗性戒指','Ring of Necrotic Resistance','necrotic'],
 [1792,1793,'毒素抗性戒指','Ring of Poison Resistance','poison'],
 [1796,1797,'心灵抗性戒指','Ring of Psychic Resistance','psychic'],
 [1799,1800,'光耀抗性戒指','Ring of Radiant Resistance','radiant'],
 [1821,1822,'雷鸣抗性戒指','Ring of Thunder Resistance','thunder']
]as const;
const clause=(path:string,utf8Sha256:string):ItemResistanceBonusClause=>({path,utf8Sha256});
export const itemResistanceBonusSpecs:readonly ItemResistanceBonusSpec[]=[
 ...dragonRows.map(([sourceIndex,,name,english,resistance,sha])=>({sourceIndex,name,english,source:'DMG' as const,page:165,resistance,clauses:[clause(`items.json/item/${sourceIndex}/entries/0`,sha)]})),
 ...dragonRows.map(([,sourceIndex,name,english,resistance])=>({sourceIndex,name,english,source:'XDMG' as const,page:254,resistance,clauses:[clause(`items.json/item/${sourceIndex}/entries/0`,'2c7bede1731a743c2baa406326a30dee53cfc38439efba7a1d0a2dd7011efd69'),clause('items-base.json/itemEntry/4/entriesTemplate/1','76cd5dada2c0a79a666230213f156a170677e73f6fdf42f1a82084f29b3b9426')]})),
 ...ringRows.map(([sourceIndex,,name,english,resistance])=>({sourceIndex,name,english,source:'DMG' as const,page:192,resistance,clauses:[clause(`items.json/item/${sourceIndex}/entries/0`,'1841c33949dfeac199457336f0541bdc6fac60e929fd51b4dbdfa796f051a6f6'),clause('items-base.json/itemEntry/10/entriesTemplate/0','f4123906ddc9ae5e0d710e98bdef60f9be8e84f64e83b5e34226ef12d9ea7510')]}))
];
const heldSpecs:readonly ItemResistanceBonusSpec[]=ringRows.map(([,sourceIndex,name,english,resistance])=>({sourceIndex,name,english,source:'XDMG' as const,page:294,resistance,clauses:[clause(`items.json/item/${sourceIndex}/entries/0`,'df6eeb6ee942d82c68ed2072fab58a89ab7234c35e9b8cfdc2d6a91125be3248'),clause('items-base.json/itemEntry/11/entriesTemplate/0','c789ee0ce14f51aa99d0016f8aa272acc190101e760261ca6c3e865dea19691b')]}));
const resistanceLabels:Record<ItemResistanceBonusDamage,string>={acid:'强酸',cold:'寒冷',fire:'火焰',force:'力场',lightning:'闪电',necrotic:'暗蚀',poison:'毒素',psychic:'心灵',radiant:'光耀',thunder:'雷鸣'};
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const itemResistanceBonusSnapshot=(value:unknown)=>digest(JSON.stringify(sorted(value)));
const fail:(code:string)=>never=code=>{throw Error('ITEM_RESISTANCE_BONUS_SOURCE_'+code);};
function boundary(){const key=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,key),guard=(globalThis as any)[key];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_BOUNDARY');}
let originals:Record<string,any>|undefined;
function bodies():Record<string,any>{
 boundary();if(originals)return originals;const directory=process.env.ITEM_RESISTANCE_BONUS_FROZEN_DIR;if(!directory)fail('FROZEN_DIRECTORY');const root=realpathSync(directory),index=JSON.parse(readFileSync(root+'/index.json','utf8')),bytesByPath:Record<string,Uint8Array>={},out:Record<string,any>={};if(!Array.isArray(index.rows))fail('INDEX');
 // Verify ALL THREE immutable transport pins before parsing source bodies or
 // invoking any normalization; there is no network, repair or fallback path.
 for(const pin of itemResistanceBonusInputPins){const rows=index.rows.filter((row:any)=>row?.url==='https://5e.kiwee.top/data/'+pin.path);if(rows.length!==1||rows[0].sha256!==pin.sha256||!/^files\/[a-f0-9]{64}\.json$/.test(rows[0].path))fail('INPUT_PIN');const file=realpathSync(root+'/'+rows[0].path);if(!file.startsWith(root+'/'))fail('INPUT_PATH');const bytes=readFileSync(file);if(bytes.length!==pin.bytes||digest(bytes)!==pin.sha256)fail('INPUT_BYTES');bytesByPath[pin.path]=bytes;}
 for(const pin of itemResistanceBonusInputPins){const body=JSON.parse(Buffer.from(bytesByPath[pin.path]).toString('utf8'));if(digest(JSON.stringify(body))!==pin.sha256)fail('INPUT_CANONICAL');out[pin.path]=body;}return originals=out;
}
const allSpecs=[...itemResistanceBonusSpecs,...heldSpecs];
const cache:Partial<Record<'canonical'|'app',Entry[]>>={};
function select(entries:Entry[]):Entry[]{return allSpecs.map(spec=>{const matches=entries.filter(entry=>entry.kind==='item'&&entry.raw._category==='item'&&entry.name===spec.name&&entry.english===spec.english&&entry.source===spec.source.toUpperCase()&&(entry.page??null)===spec.page);if(matches.length!==1)fail('UNIQUE_FULL_HEADER');const entry=matches[0];if(entry.packId!=='kiwee'||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity||entry.effects?.length||entry.choices?.length)fail('SOURCE_SHAPE');if(itemResistanceBonusSpecs.includes(spec)?entry.raw.reqAttune!==true:Object.hasOwn(entry.raw,'reqAttune'))fail('ATTUNEMENT_METADATA');return entry;});}
function allEntries(form:'canonical'|'app'):Entry[]{
 boundary();if(form!=='canonical'&&form!=='app')fail('FORM');if(cache[form])return cache[form]!;const source=bodies();if(!cache.canonical)cache.canonical=select(normalizeCatalogData(structuredClone(source['items.json']),itemResistanceBonusInputPins[1].sha256,'kiwee'));if(form==='canonical')return cache.canonical;
 // Exact actual App equipment accumulation and final batch order. Revisions
 // retain sorted path-prefixed source hashes; IDs are never guessed/repaired.
 const equipment=Object.assign({},...itemResistanceBonusInputPins.map(pin=>structuredClone(source[pin.path]))),revision=itemResistanceBonusInputPins.map(pin=>'data/'+pin.path+':'+pin.sha256).sort().join('|'),wanted=new Set(cache.canonical.map(entry=>entry.id)),merged=new Map(cache.canonical.map(entry=>[entry.id,entry]));
 for(const operation of ['normalize','magicItems']as const)for(const entry of normalizeCatalogData(equipment,revision,'kiwee',operation))if(wanted.has(entry.id))merged.set(entry.id,entry);return cache.app=select([...merged.values()]);
}
export function itemResistanceBonusEntries(form:'canonical'|'app'='canonical'):Entry[]{return allEntries(form).slice(0,itemResistanceBonusSpecs.length);}
export function itemResistanceBonusFind(idOrSourceIndex:string|number=213,form:'canonical'|'app'='canonical'):Entry{const canonical=itemResistanceBonusEntries(),index=typeof idOrSourceIndex==='number'?itemResistanceBonusSpecs.findIndex(spec=>spec.sourceIndex===idOrSourceIndex):canonical.findIndex(entry=>entry.id===idOrSourceIndex);if(index<0)fail('UNREVIEWED_IDENTITY');return itemResistanceBonusEntries(form)[index];}
export function itemResistanceBonusHeldEntries(form:'canonical'|'app'='canonical'):Entry[]{return allEntries(form).slice(itemResistanceBonusSpecs.length);}
const header=(entry:Entry)=>({id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,page:entry.page??null,category:entry.raw._category});
function verifyOriginal(spec:ItemResistanceBonusSpec,admitted:boolean){
 const source=bodies(),raw=source['items.json'].item[spec.sourceIndex];if(raw.name!==spec.name||raw.ENG_name!==spec.english||raw.source!==spec.source||raw.page!==spec.page||raw._copy||!Array.isArray(raw.resist)||raw.resist.length!==1||raw.resist[0]!==resistanceLabels[spec.resistance]||(admitted?raw.reqAttune!==true:Object.hasOwn(raw,'reqAttune')))fail('ORIGINAL_IDENTITY');
 for(const ref of spec.clauses){const [file,...keys]=ref.path.split('/');let value:any=source[file];for(const key of keys)value=value?.[key];if(typeof value!=='string'||digest(value)!==ref.utf8Sha256)fail('SOURCE_CLAUSE');}
}
const forms=(canonical:Entry,app:Entry)=>([{form:'canonical',entry:canonical},{form:'app',entry:app}]as const).map(({form,entry})=>({form,revision:entry.revision,completeSnapshotSha256:itemResistanceBonusSnapshot(entry),canonicalReboundSnapshotSha256:itemResistanceBonusSnapshot({...entry,id:canonical.id,revision:canonical.revision})}));
let evidence:ReturnType<typeof buildEvidence>|undefined;
function buildEvidence(){
 const canonical=itemResistanceBonusEntries(),app=itemResistanceBonusEntries('app'),held=itemResistanceBonusHeldEntries(),heldApp=itemResistanceBonusHeldEntries('app');
 const rules=itemResistanceBonusSpecs.map((spec,index)=>{verifyOriginal(spec,true);const entry=canonical[index],final=app[index];if(entry.id!==final.id)fail('FORM_IDENTITY');return{...header(entry),revision:entry.revision,sourceIndex:spec.sourceIndex,fullNormalizedSnapshotSha256:itemResistanceBonusSnapshot(entry),resistance:spec.resistance,requiresAttunement:true,sourceCondition:'worn' as const,forms:forms(entry,final),clauses:spec.clauses,input:{url:'https://5e.kiwee.top/data/items.json',sha256:itemResistanceBonusInputPins[1].sha256},wholeEntryCompletionCredit:0};});
 const holds=heldSpecs.map((spec,index)=>{verifyOriginal(spec,false);const entry=held[index],final=heldApp[index];if(entry.id!==final.id)fail('HELD_FORM_IDENTITY');return{...header(entry),revision:entry.revision,sourceIndex:spec.sourceIndex,resistance:spec.resistance,reasonCode:'missing-explicit-reqAttune-metadata-not-source-proof',rawPaths:[`items.json/item/${spec.sourceIndex}`],fullNormalizedSnapshotSha256:itemResistanceBonusSnapshot(entry),forms:forms(entry,final),clauses:spec.clauses};});
 if(rules.length!==30||new Set(rules.map(rule=>rule.id)).size!==30||holds.length!==10||new Set(holds.map(rule=>rule.id)).size!==10||rules.some(rule=>holds.some(hold=>hold.id===rule.id)))fail('COUNTS');
 return{schemaVersion:1,scope:'source-qualified worn attuned Dragon Scale Mail and typed DMG Ring damage-resistance branches only',sourceProseIncluded:false,wholeEntryCompletionCredit:0,newReportWitnessCredit:0,inputs:itemResistanceBonusInputPins.map(pin=>({url:'https://5e.kiwee.top/data/'+pin.path,sha256:pin.sha256,bytes:pin.bytes})),counts:{owners:30,completeOwnerForms:60,dragonScaleMail:20,typedDmgRings:10,heldXdmgRings:10},normalization:{canonical:'complete original items.json through installed normalizeCatalogData',app:'exact catalog.ts equipment accumulation plus normalize then magicItems, sorted path-prefixed source revisions',noPayloadRepair:true},rules,holds};
}
export function itemResistanceBonusSourceEvidence(){return evidence??=buildEvidence();}
