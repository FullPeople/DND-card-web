import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import type {Entry} from '../../src/core/model';

// Pure original-source boundary. Never import Character factories, automation
// state/engine or the evidence being generated/independently checked here.
export const optionalClassListInputPins={
 'class/class-bard.json':{sha256:'ac95dc8f1d795c0764ae6314e846d8efdcbbb4b42a8c721551265467885ed31c',bytes:117283},
 'class/class-cleric.json':{sha256:'011edfef6c76cd0f70143d83db3b5e8b9b0d31ca1557b4c0954bedc619615344',bytes:211422},
 'class/class-druid.json':{sha256:'71fca887392f6653f41d5900066cbe6fa1cac0280bb908257075925311e1ec2c',bytes:116030},
 'class/class-paladin.json':{sha256:'aa125ed2f15782924cf4d48677e1ff64c934076bbc4f66fa65f21ba797007b2e',bytes:134796},
 'class/class-ranger.json':{sha256:'a0e58735bc5f1ef9b260b88cf2c9778ffc0d367c0b132e72fadc95baf198310a',bytes:122674},
 'class/class-sorcerer.json':{sha256:'cc1c7c87b28903114e98310b00f6c820541a6f3458bd67e6badb79b014e4c670',bytes:140077},
 'class/class-warlock.json':{sha256:'34721a04db792923cf0a19fbab3f90616093d9f6519a7cfe6f81a9eb52e775d4',bytes:133330},
 'class/class-wizard.json':{sha256:'7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03',bytes:160486},
 'spells/spells-phb.json':{sha256:'e1f2221020cfb5d31995c99b78dc09435c9962476ef1cef81b52399e6df0263d',bytes:514953},
 'spells/spells-tce.json':{sha256:'f87123ff4970d6b39fb6260c24027bfd0bd720534c9f75d6c87d884470d28847',bytes:27448},
 'generated/gendata-spell-source-lookup.json':{sha256:'8b78d1ce68d080a760b41bc65e846755c98fa1a3916b70d3d5d0dc8f5af1b9a9',bytes:673279}
} as const;
export const optionalClassListSideSource={repository:'tjliqy/5etools-cn',revision:'5cc0bbe2c2b241a334e731af4448bdba2168e8bd',path:'data/book/book-tce.json',rawBytes:465199,gitBlobSha1:'a4b590a1e56a2ffc9cf731e7a2c5661b9f2ee73e',rawSha256:'0745f1a881ce2b9e25a13f66923821aa333e3df0622ce9135c273cfb4d62cf33',semanticSideSourceOnly:true,runtimeInputExtension:false} as const;
export const optionalClassListDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bytesHash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const optionalClassListSnapshot=(entry:Entry)=>optionalClassListDigest(sorted(entry));
const ordinarySnapshot=(entry:Entry)=>optionalClassListDigest(sorted({raw:entry.raw,entries:entry.entries,effects:entry.effects,choices:entry.choices,dependencies:entry.dependencies}));
const fail:(code:string)=>never=(code:string):never=>{throw Error('OPTIONAL_CLASS_LIST_SOURCE_'+code);};
export function optionalClassListOfflineBoundary(){
 const marker=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,marker),guard=(globalThis as any)[marker];
 if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_NETWORK_BOUNDARY');
 return guard;
}
let originals:Record<string,any>|undefined;
export function optionalClassListOriginals():Record<string,any>{
 optionalClassListOfflineBoundary();if(originals)return originals;
 const root=process.env.OPTIONAL_CLASS_LIST_FROZEN_DIR;if(!root)fail('FROZEN_DIRECTORY');const realRoot=realpathSync(root),index=JSON.parse(readFileSync(`${root}/index.json`,'utf8')),out:Record<string,any>={};
 for(const [path,pin]of Object.entries(optionalClassListInputPins)){
  const rows=index.rows.filter((r:any)=>r.url==='https://5e.kiwee.top/data/'+path);if(rows.length!==1||rows[0].sha256!==pin.sha256||!/^files\/[a-f0-9]{64}\.json$/.test(rows[0].path))fail('INPUT_PIN');
  const file=realpathSync(`${root}/${rows[0].path}`);if(!file.replaceAll('\\','/').startsWith(realRoot.replaceAll('\\','/')+'/'))fail('INPUT_PATH');const bytes=readFileSync(file);if(bytes.length!==pin.bytes||bytesHash(bytes)!==pin.sha256)fail('INPUT_BYTES');const body=JSON.parse(bytes.toString('utf8'));if(optionalClassListDigest(body)!==pin.sha256)fail('INPUT_CANONICAL');out[path]=body;
 }
 return originals=out;
}
let entries:Entry[]|undefined;
export function optionalClassListEntries():Entry[]{
 if(entries)return entries;const bodies=optionalClassListOriginals(),lookup=bodies['generated/gendata-spell-source-lookup.json'],lookupHash=optionalClassListInputPins['generated/gendata-spell-source-lookup.json'].sha256;
 return entries=Object.entries(optionalClassListInputPins).filter(([path])=>!path.startsWith('generated/')).flatMap(([path,pin])=>normalizeCatalogData(structuredClone(bodies[path]),pin.sha256,'kiwee').map(entry=>hydrateSpellLookup(entry,lookup,lookupHash)));
}
export function optionalClassListFind(kind:Entry['kind'],english:string,source='PHB'):Entry{
 const rows=optionalClassListEntries().filter(entry=>entry.kind===kind&&entry.english===english&&entry.source===source);if(rows.length!==1)fail('UNIQUE_NORMALIZED_HEADER');return rows[0];
}
const specs=[
 {english:'Bard',section:9,minLevel:1,count:15,blockId:'08d',blockPath:'data/1/entries/9/entries/1/entries/1',blockHash:'f196780628a1ffb9a46c60ed473cb5f6d96517a795b9fb1bbaacfa8be59d5fae',policyHash:'2723cf3587bea9d752522162425d7316f1b499a4df1db7dce5146fbf65536a70'},
 {english:'Cleric',section:10,minLevel:1,count:8,blockId:'09f',blockPath:'data/1/entries/10/entries/1/entries/2',blockHash:'6ee935a6869570ae5954672bd40e74270b84917e40c32d07ea515943891ecdbf',policyHash:'dfc9181615b14ca3d6cb8e90e6202f23109bc35cf80bf1de78919692fb4c5c7e'},
 {english:'Druid',section:11,minLevel:1,count:16,blockId:'0c0',blockPath:'data/1/entries/11/entries/1/entries/1',blockHash:'3a3ea80ab16e614391060df730ecfb174deb44635cbc158856d2d3bd694c90e5',policyHash:'355fec7dd80d8584bc76b0b1f517e9d96083940190d9a3bf03a19c9e115d4128'},
 {english:'Paladin',section:14,minLevel:2,count:5,blockId:'12f',blockPath:'data/1/entries/14/entries/1/entries/1',blockHash:'a2a87fee86299bf9fab1a21e7285b081a679f74589a458a0fb1652d212cddf8b',policyHash:'48a9e046480d6c154f000dc6031c788c86003e6d6917aeaff50acd8c8a885e3c'},
 {english:'Ranger',section:15,minLevel:2,count:14,blockId:'157',blockPath:'data/1/entries/15/entries/1/entries/4',blockHash:'4c045f014fa73d45e3c0ed0d01e79857f5e31a203ff02ad03a05dcb377440bf0',policyHash:'0e1ca1279a5fdd34677d72595ca74dc91850583993086c5d937be6272e76c3cc'},
 {english:'Warlock',section:18,minLevel:1,count:20,blockId:'19f',blockPath:'data/1/entries/18/entries/1/entries/1',blockHash:'06bdb067c3cc7646a1f74e991a619de23de6bdc4da01cab18c71af5a38a0721b',policyHash:'993595cf0f8f5f851519957e834e821bcdd4e53cb5757242ef0ab69a30df7d17'},
 {english:'Wizard',section:19,minLevel:1,count:23,blockId:'1be',blockPath:'data/1/entries/19/entries/1/entries/1',blockHash:'e3bfd3bb9431b98bdd1382d0fc72a83a81bf3bd1bfa9ba5db7cc4d6e7f0b0a03',policyHash:'955efca2438f4265b0d6877bfad164168f9b031e80b0f7c3c6466b5da24522f5'}
] as const;
export type OptionalClassListSourceAssociation={owner:Entry;target:Entry;minClassLevel:number;spellLevel:number;baseOverlap:boolean;sourceUid:string;sideBlockId:string;sideBlockPath:string};
type SideProof={owners:{entry:Entry;minLevel:number;sideSource:{blockId:string;blockPath:string;page:number;policyPath:string;policySha256:string;blockCanonicalSha256:string;levelClauseSha256:string;listClauseSha256:string}}[];associations:OptionalClassListSourceAssociation[];held:{ownerId:string;ownerEnglish:string;source:string;edition:string;targetIds:string[];reasonCode:string;conflictingClauseSha256:string}[];rawSpellClassesAbsent:boolean;lookupBaseDefinitionsSha256:string};
let sideProof:SideProof|undefined;
export function optionalClassListSideProof():SideProof{
 optionalClassListOfflineBoundary();if(sideProof)return sideProof;const path=process.env.OPTIONAL_CLASS_LIST_SIDE_SOURCE_FILE;if(!path)fail('SIDE_SOURCE_FILE');const bytes=readFileSync(path);
 if(bytes.length!==optionalClassListSideSource.rawBytes||bytesHash(bytes)!==optionalClassListSideSource.rawSha256||createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex')!==optionalClassListSideSource.gitBlobSha1)fail('SIDE_SOURCE_BYTES');
 const book=JSON.parse(bytes.toString('utf8')),at=(p:string)=>p.split('/').reduce((v:any,k)=>v?.[k],book),metadata=JSON.parse(readFileSync('src/core/automation/ordinarySpellCastingEvidence.json','utf8')),bodies=optionalClassListOriginals(),lookup=bodies['generated/gendata-spell-source-lookup.json'];
 const proof=(entry:Entry)=>{const r=metadata.rules.filter((r:any)=>r.id===entry.id&&r.kind===entry.kind&&r.source===entry.source&&r.name===entry.name&&r.english===entry.english&&r.edition===entry.edition&&r.packId===entry.packId&&r.page===(entry.page??null));if(r.length!==1||r[0].snapshotSha256!==ordinarySnapshot(entry)||entry.raw._copy||entry.raw._unresolvedParent)fail('EXISTING_CANONICAL_PROOF');};
 const owners:SideProof['owners']=[],associations:OptionalClassListSourceAssociation[]=[];
 for(const spec of specs){
  const entry=optionalClassListFind('class',spec.english),section=at(`data/1/entries/${spec.section}`),block=at(spec.blockPath),policyPath=`data/1/entries/${spec.section}/entries/1/entries/0`,policy=at(policyPath);proof(entry);
  if(entry.packId!=='kiwee'||entry.edition!=='2014'||entry.raw.edition!=='classic'||entry.raw._category!=='class'||entry.source!=='PHB'||section.ENG_name!==entry.english||section.name!==entry.name||block.id!==spec.blockId||block.ENG_name!==`Additional ${spec.english} Spells`||optionalClassListDigest(block)!==spec.blockHash||typeof policy!=='string'||bytesHash(policy)!==spec.policyHash)fail('EXACT_OWNER_BLOCK');
  const sideSource={blockId:spec.blockId,blockPath:spec.blockPath,page:block.page,policyPath,policySha256:spec.policyHash,blockCanonicalSha256:spec.blockHash,levelClauseSha256:bytesHash(block.entries[0]),listClauseSha256:bytesHash(block.entries[1])};owners.push({entry,minLevel:spec.minLevel,sideSource});const seen=new Set<string>(),refs=block.entries.filter((x:any)=>x&&typeof x==='object'&&x.type==='list').flatMap((list:any)=>list.items);
  for(const item of refs){const level=String(item).match(/\d/);if(!level)fail('TABLE_LEVEL');const spellLevel=Number(level[0]);for(const m of String(item).matchAll(/\{@spell ([^}]+)\}/g)){
   const parts=m[1].split('|');if(parts.length>2)fail('TARGET_UID');const [header,source='PHB']=parts,matched=optionalClassListEntries().filter(e=>e.kind==='spell'&&e.source.toUpperCase()===source.toUpperCase()&&[e.name,e.english].some(n=>n.toLowerCase()===header.toLowerCase()));if(matched.length!==1)fail('UNIQUE_TABLE_TARGET');const target=matched[0];proof(target);
   const row=lookup[target.source.toLowerCase()]?.[target.name.toLowerCase()]||lookup[target.source.toLowerCase()]?.[target.english.toLowerCase()],definition=row?.classVariant?.PHB?.[entry.name];if(optionalClassListDigest(definition)!==optionalClassListDigest({definedInSources:['TCE']})||target.raw._category!=='spell'||target.raw.level!==spellLevel||!Number.isSafeInteger(spellLevel)||spellLevel<0||spellLevel>9||seen.has(target.id))fail('TARGET_ASSOCIATION');seen.add(target.id);
   const base=row.class?.PHB?.[entry.name],baseOverlap=!!(base===true||base&&typeof base==='object'&&!base.definedInSource&&!base.isVariant);
   associations.push({owner:entry,target,minClassLevel:spec.minLevel,spellLevel,baseOverlap,sourceUid:m[1],sideBlockId:spec.blockId,sideBlockPath:spec.blockPath});
  }}
  if(seen.size!==spec.count)fail('OWNER_ASSOCIATION_COUNT');
 }
 const heldOwner=optionalClassListFind('class','Sorcerer'),heldBlock=at('data/1/entries/17/entries/1/entries/1');proof(heldOwner);if(optionalClassListDigest(heldBlock)!=='602c9abf4947e17c672718057e55136f6ccccb81372d0db877e028f663325685'||bytesHash(heldBlock.entries[1])!=='afed41aeb4226ad8c8a2370f2d27d8ff2a6e50601edc1373f7f3537b26b50895')fail('HELD_SOURCE_CONFLICT');
 const heldTargets=[...JSON.stringify(heldBlock.entries.filter((x:any)=>x&&typeof x==='object'&&x.type==='list')).matchAll(/\{@spell ([^}]+)\}/g)].map(m=>{const[h,s='PHB']=m[1].split('|'),rows=optionalClassListEntries().filter(e=>e.kind==='spell'&&e.source===s.toUpperCase()&&[e.name,e.english].some(n=>n.toLowerCase()===h.toLowerCase()));if(rows.length!==1)fail('HELD_TARGET');proof(rows[0]);return rows[0].id;});
 if(owners.length!==7||associations.length!==101||new Set(associations.map(a=>a.target.id)).size!==68||associations.filter(a=>a.baseOverlap).length!==8||new Set(heldTargets).size!==21)fail('FAMILY_COUNTS');
 const rawSpells=['spells/spells-phb.json','spells/spells-tce.json'].flatMap(p=>bodies[p].spell);if(rawSpells.length!==382||rawSpells.some(s=>s.classes!==undefined))fail('RAW_CLASSES_REPAIRED');
 return sideProof={owners,associations,held:[{ownerId:heldOwner.id,ownerEnglish:'Sorcerer',source:'PHB',edition:'2014',targetIds:heldTargets,reasonCode:'source-parent-header-versus-list-introduction-conflict',conflictingClauseSha256:'afed41aeb4226ad8c8a2370f2d27d8ff2a6e50601edc1373f7f3537b26b50895'}],rawSpellClassesAbsent:true,lookupBaseDefinitionsSha256:optionalClassListDigest(Object.entries(lookup).flatMap(([source,rows]:[string,any])=>Object.entries(rows).map(([name,row]:[string,any])=>({source,name,class:row.class}))))};
}
export const optionalClassListOwners=()=>optionalClassListSideProof().owners.map(row=>row.entry);
export const optionalClassListTargets=()=>[...new Map(optionalClassListSideProof().associations.map(row=>[row.target.id,row.target])).values()];
export const optionalClassListAssociations=()=>optionalClassListSideProof().associations;
