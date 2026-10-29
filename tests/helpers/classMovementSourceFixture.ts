import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import type {Entry} from '../../src/core/model';
import ordinaryEvidence from '../../src/core/automation/ordinarySpellCastingEvidence.json';

// Source IO only: never creates a character, repairs a payload, or evaluates rules.
// Callers must clone the retained complete entries before mutating them.
export const classMovementInputPins=[
 {inputPath:'class/class-barbarian.json',url:'https://5e.kiwee.top/data/class/class-barbarian.json',sha256:'23e2316b63e09a716519833a477f3452ec3ce229bd32c72374eb0c6673e5cb6f',bytes:103531},
 {inputPath:'class/class-monk.json',url:'https://5e.kiwee.top/data/class/class-monk.json',sha256:'17f8612781788c6b614fdafb81711cb537e0bdb8bec5d1da2f32864d6ec28dcb',bytes:120951},
 {inputPath:'class/class-ranger.json',url:'https://5e.kiwee.top/data/class/class-ranger.json',sha256:'a0e58735bc5f1ef9b260b88cf2c9778ffc0d367c0b132e72fadc95baf198310a',bytes:122674},
]as const;
type Form='canonical'|'app';
type InputPath=typeof classMovementInputPins[number]['inputPath'];
type Source='PHB'|'XPHB';
type SourceHeader={kind:'class'|'feature';name:string;english:string;source:Source;edition:'2014'|'2024';packId:'kiwee';page:number;category:'class'|'classFeature';className:string|null;classSource:Source|null;level:number|null};
export interface ClassMovementSpec {
 key:string;inputPath:InputPath;sourcePath:string;ownerSourcePath:string;reference:string;referencePath:string;grantKey:string;minLevel:number;
 walkingPolicy:'no-heavy-armor'|'no-armor-and-no-shield';walkingBonus:number|null;levelBonuses?:readonly number[];
 header:SourceHeader;ownerHeader:SourceHeader;clauses:readonly {path:string;utf8Sha256:string}[];
 tablePath?:string;tableCanonicalSha256?:string;tableColumnIndex?:number;relativeModes:readonly ('swim'|'climb')[];
}
const ownerHeader=(name:string,english:string,source:Source,page:number):SourceHeader=>({kind:'class',name,english,source,edition:source==='PHB'?'2014':'2024',packId:'kiwee',page,category:'class',className:null,classSource:null,level:null});
const featureHeader=(name:string,english:string,source:Source,page:number,className:string,level:number):SourceHeader=>({kind:'feature',name,english,source,edition:source==='PHB'?'2014':'2024',packId:'kiwee',page,category:'classFeature',className,classSource:source,level});
const monkBonuses=[0,10,10,10,10,15,15,15,15,20,20,20,20,25,25,25,25,30,30,30]as const;
export const classMovementSpecs:readonly ClassMovementSpec[]=[
 {key:'barbarian-phb',inputPath:'class/class-barbarian.json',sourcePath:'classFeature/8',ownerSourcePath:'class/0',reference:'快速移动|野蛮人||5',referencePath:'class/0/classFeatures/8',grantKey:'ref:快速移动|野蛮人||5',minLevel:5,walkingPolicy:'no-heavy-armor',walkingBonus:10,header:featureHeader('快速移动','Fast Movement','PHB',46,'野蛮人',5),ownerHeader:ownerHeader('野蛮人','Barbarian','PHB',46),relativeModes:[],clauses:[{path:'classFeature/8/entries/0',utf8Sha256:'0183f8d64a2e4a83b078e1285ba08397237480f84cb6d1ef13bee8c58e0f36de'}]},
 {key:'barbarian-xphb',inputPath:'class/class-barbarian.json',sourcePath:'classFeature/34',ownerSourcePath:'class/1',reference:'快速移动|野蛮人|XPHB|5',referencePath:'class/1/classFeatures/9',grantKey:'ref:快速移动|野蛮人|XPHB|5',minLevel:5,walkingPolicy:'no-heavy-armor',walkingBonus:10,header:featureHeader('快速移动','Fast Movement','XPHB',53,'野蛮人',5),ownerHeader:ownerHeader('野蛮人','Barbarian','XPHB',50),relativeModes:[],clauses:[{path:'classFeature/34/entries/0',utf8Sha256:'bd844e49e21027857fc9045331ec70ce43ecfc5da32a4343083914529d28ee2a'}]},
 {key:'monk-phb',inputPath:'class/class-monk.json',sourcePath:'classFeature/7',ownerSourcePath:'class/0',reference:'无甲移动|武僧||2',referencePath:'class/0/classFeatures/4',grantKey:'ref:无甲移动|武僧||2',minLevel:2,walkingPolicy:'no-armor-and-no-shield',walkingBonus:null,levelBonuses:monkBonuses,header:featureHeader('无甲移动','Unarmored Movement','PHB',76,'武僧',2),ownerHeader:ownerHeader('武僧','Monk','PHB',76),relativeModes:[],clauses:[{path:'classFeature/7/entries/0',utf8Sha256:'5d92fd226cc8d25c589a8e4dd878a7bea3a9e0c0bd7f5826087cbf75158cd991'},{path:'classFeature/7/entries/1',utf8Sha256:'180d6b5369c79ef591e1c9b59da3800202b37a79d1cb064d7e1d95e7c085d74b'}],tablePath:'class/0/classTableGroups/0',tableCanonicalSha256:'2826c39c03de7b054193bf981be8cb4faa9fa0a01d41089b893af670f9525288',tableColumnIndex:2},
 {key:'monk-xphb',inputPath:'class/class-monk.json',sourcePath:'classFeature/43',ownerSourcePath:'class/1',reference:'无甲移动|武僧|XPHB|2',referencePath:'class/1/classFeatures/3',grantKey:'ref:无甲移动|武僧|XPHB|2',minLevel:2,walkingPolicy:'no-armor-and-no-shield',walkingBonus:null,levelBonuses:monkBonuses,header:featureHeader('无甲移动','Unarmored Movement','XPHB',102,'武僧',2),ownerHeader:ownerHeader('武僧','Monk','XPHB',100),relativeModes:[],clauses:[{path:'classFeature/43/entries/0',utf8Sha256:'767d97e50a889f3fb5a45636f7749a9af96d48e59f674d60ae173935674b29d4'}],tablePath:'class/1/classTableGroups/0',tableCanonicalSha256:'c5d2eca7dfedeae7a1ca0b57b846c0603dd2843d1c56a2507f3efa9ecc3554c9',tableColumnIndex:2},
 {key:'ranger-xphb',inputPath:'class/class-ranger.json',sourcePath:'classFeature/39',ownerSourcePath:'class/1',reference:'越野|游侠|XPHB|6',referencePath:'class/1/classFeatures/8',grantKey:'ref:越野|游侠|XPHB|6',minLevel:6,walkingPolicy:'no-heavy-armor',walkingBonus:10,header:featureHeader('越野','Roving','XPHB',121,'游侠',6),ownerHeader:ownerHeader('游侠','Ranger','XPHB',118),clauses:[{path:'classFeature/39/entries/0',utf8Sha256:'f3c80c0fc05e4b124464adb9022ed83b52b2a3e35bcf1fb59277153ea010e887'}],relativeModes:['swim','climb']},
];
const heldSpecs=[
 {sourcePath:'classFeature/0',header:{kind:'feature',name:'熟练探险家',english:'Deft Explorer',source:'TCE',edition:'both',packId:'kiwee',page:56,category:'classFeature',className:'游侠',classSource:'PHB',level:1}},
 {sourcePath:'classFeature/13',header:{kind:'feature',name:'熟练探险家增效',english:'Deft Explorer Improvement',source:'TCE',edition:'both',packId:'kiwee',page:56,category:'classFeature',className:'游侠',classSource:'PHB',level:6}},
]as const;
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const classMovementSnapshot=(value:unknown)=>digest(JSON.stringify(sorted(value)));
const fail:(code:string)=>never=code=>{throw Error('CLASS_MOVEMENT_SOURCE_'+code);};
const at=(value:any,path:string):any=>path.split('/').reduce((row,key)=>row?.[key],value);
const header=(entry:Entry)=>({kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,page:entry.page??null,category:entry.raw._category,className:entry.raw.className??null,classSource:entry.raw.classSource??null,level:entry.raw.level??null});
function boundary(){const key=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,key),guard=(globalThis as any)[key];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_BOUNDARY');}
const originals=new Map<InputPath,Record<string,any>>();
function body(inputPath:InputPath):Record<string,any>{
 boundary();const cached=originals.get(inputPath);if(cached)return cached;
 const pin=classMovementInputPins.find(row=>row.inputPath===inputPath);if(!pin)fail('UNREVIEWED_INPUT');
 const directory=process.env.CLASS_MOVEMENT_FROZEN_DIR;if(!directory)fail('FROZEN_DIRECTORY');
 const root=realpathSync(directory),index=JSON.parse(readFileSync(root+'/index.json','utf8'));if(!Array.isArray(index.rows))fail('INDEX');
 const rows=index.rows.filter((row:any)=>row?.url===pin.url),expectedPath='files/'+pin.sha256+'.json';
 if(rows.length!==1||rows[0].sha256!==pin.sha256||rows[0].path!==expectedPath)fail('INPUT_PIN');
 const file=realpathSync(root+'/'+rows[0].path);if(!file.replaceAll('\\','/').startsWith(root.replaceAll('\\','/')+'/'))fail('INPUT_PATH');
 const bytes=readFileSync(file);if(bytes.length!==pin.bytes||digest(bytes)!==pin.sha256)fail('INPUT_BYTES');
 const source=JSON.parse(bytes.toString('utf8'));if(digest(JSON.stringify(source))!==pin.sha256)fail('INPUT_CANONICAL');
 for(const spec of classMovementSpecs.filter(row=>row.inputPath===inputPath)){
  for(const clause of spec.clauses){const value=at(source,clause.path);if(typeof value!=='string'||digest(value)!==clause.utf8Sha256)fail('SOURCE_CLAUSE');}
  for(const [path,expected]of [[spec.sourcePath,spec.header],[spec.ownerSourcePath,spec.ownerHeader]]as const){const raw=at(source,path);if(!raw||raw._copy||raw._unresolvedParent||raw.name!==expected.name||raw.ENG_name!==expected.english||raw.source!==expected.source||raw.page!==expected.page||(raw.className??null)!==expected.className||(raw.classSource??null)!==expected.classSource||(raw.level??null)!==expected.level)fail('ORIGINAL_HEADER');}
  const declared=at(source,spec.referencePath),reference=typeof declared==='string'?declared:declared?.classFeature;
  if(reference!==spec.reference||spec.grantKey!=='ref:'+reference||Number(reference.split('|')[3])!==spec.minLevel)fail('DECLARED_REFERENCE');
  if(spec.tablePath){const table=at(source,spec.tablePath);if(!spec.tablePath.startsWith(spec.ownerSourcePath+'/classTableGroups/')||classMovementSnapshot(table)!==spec.tableCanonicalSha256||table?.rows?.length!==20||spec.tableColumnIndex!==2||table.colLabels?.[2]!==spec.header.name)fail('OWN_TABLE');const values=table.rows.map((row:any)=>row?.[2]);if(values.some((value:any)=>value?.type!=='bonusSpeed'||!Number.isSafeInteger(value.value))||classMovementSnapshot(values.map((value:any)=>value.value))!==classMovementSnapshot(spec.levelBonuses))fail('TABLE_ROWS');}
 }
 if(inputPath==='class/class-ranger.json')for(const spec of heldSpecs){const raw=at(source,spec.sourcePath),expected=spec.header;if(!raw||raw._copy||raw._unresolvedParent||raw.name!==expected.name||raw.ENG_name!==expected.english||raw.source!==expected.source||raw.page!==expected.page||raw.className!==expected.className||raw.classSource!==expected.classSource||raw.level!==expected.level)fail('HELD_ORIGINAL_HEADER');}
 originals.set(inputPath,source);return source;
}
const cache:Partial<Record<Form,Entry[]>>={};
const heldCache:Partial<Record<Form,Entry[]>>={};
const ordinarySnapshot=(entry:Entry)=>classMovementSnapshot({raw:entry.raw,entries:entry.entries,effects:entry.effects,choices:entry.choices,dependencies:entry.dependencies});
function ordinaryOwner(entry:Entry){const matches=ordinaryEvidence.rules.filter(rule=>rule.id===entry.id&&rule.kind==='class'&&rule.name===entry.name&&rule.english===entry.english&&rule.source===entry.source&&rule.edition===entry.edition&&rule.packId===entry.packId&&rule.page===(entry.page??null));if(matches.length!==1||matches[0].snapshotSha256!==ordinarySnapshot(entry))fail('ORDINARY_OWNER_PROOF');return matches[0];}
function allEntries(form:Form):Entry[]{
 boundary();if(form!=='canonical'&&form!=='app')fail('FORM');if(cache[form])return cache[form]!;
 const owners:Entry[]=[],features:Entry[]=[],held:Entry[]=[];
 for(const pin of classMovementInputPins){
  // Each route independently normalizes each complete original with its own
  // exact transport revision. App hydration is the real non-spell early return.
  const normalized=normalizeCatalogData(structuredClone(body(pin.inputPath)),pin.sha256,'kiwee');
  const routed=form==='app'?normalized.map(entry=>hydrateSpellLookup(entry,{},'')):normalized;
  for(const spec of classMovementSpecs.filter(row=>row.inputPath===pin.inputPath))for(const [expected,target]of [[spec.ownerHeader,owners],[spec.header,features]]as const){
   const matches=routed.filter(entry=>classMovementSnapshot(header(entry))===classMovementSnapshot(expected));if(matches.length!==1)fail('UNIQUE_FULL_HEADER');
   const entry=matches[0];if(!entry.id||entry.revision!==pin.sha256||entry.raw._copy||entry.raw._unresolvedParent||routed.filter(row=>row.id===entry.id).length!==1)fail('COMPLETE_NORMALIZED_FORM');
   if(entry.kind==='class'){const prior=ordinaryOwner(entry);if(prior.inputSha256.length!==1||prior.inputSha256[0]!==pin.sha256)fail('ORDINARY_INPUT_PIN');}
   target.push(entry);
  }
  if(pin.inputPath==='class/class-ranger.json')for(const spec of heldSpecs){const matches=routed.filter(entry=>classMovementSnapshot(header(entry))===classMovementSnapshot(spec.header));if(matches.length!==1)fail('HELD_UNIQUE_FULL_HEADER');const entry=matches[0];if(!entry.id||entry.revision!==pin.sha256||entry.raw._copy||entry.raw._unresolvedParent||routed.filter(row=>row.id===entry.id).length!==1)fail('HELD_COMPLETE_NORMALIZED_FORM');held.push(entry);}
  // No unselected normalized entry survives this iteration.
 }
 const selected=[...owners,...features];if(owners.length!==5||features.length!==5||new Set(selected.map(entry=>entry.id)).size!==10)fail('SELECTED_COUNTS');
 if(held.length!==2||new Set(held.map(entry=>entry.id)).size!==2||held.some(entry=>selected.some(row=>row.id===entry.id)))fail('HELD_COUNTS');heldCache[form]=held;
 return cache[form]=selected;
}
export function classMovementEntries(form:Form='canonical'):Entry[]{return allEntries(form).slice();}
export function classMovementHeldEntries(form:Form='canonical'):Entry[]{allEntries(form);return heldCache[form]!.slice();}
const specIndex=(key:string)=>{const index=classMovementSpecs.findIndex(spec=>spec.key===key);if(index<0)fail('UNREVIEWED_KEY');return index;};
export function classMovementFind(key:string=classMovementSpecs[0].key,form:Form='canonical'):Entry{return allEntries(form)[5+specIndex(key)];}
export function classMovementOwner(key:string=classMovementSpecs[0].key,form:Form='canonical'):Entry{return allEntries(form)[specIndex(key)];}
const forms=(canonical:Entry,app:Entry)=>([{form:'canonical',entry:canonical},{form:'app',entry:app}]as const).map(({form,entry})=>({form,id:entry.id,revision:entry.revision,completeSnapshotSha256:classMovementSnapshot(entry)}));
function buildEvidence(){
 const rules=classMovementSpecs.map(spec=>{
  const entry=classMovementFind(spec.key),app=classMovementFind(spec.key,'app'),owner=classMovementOwner(spec.key),appOwner=classMovementOwner(spec.key,'app');
  if(entry.id!==app.id||owner.id!==appOwner.id)fail('FORM_IDENTITY');
  return{key:spec.key,id:entry.id,...header(entry),revision:entry.revision,inputPath:spec.inputPath,sourcePath:spec.sourcePath,reference:spec.reference,minLevel:spec.minLevel,grantKey:spec.grantKey,walkingPolicy:spec.walkingPolicy,walkingBonus:spec.walkingBonus,...(spec.levelBonuses?{levelBonuses:[...spec.levelBonuses]}:{}),fullNormalizedSnapshotSha256:classMovementSnapshot(entry),forms:forms(entry,app),owner:{id:owner.id,...header(owner),revision:owner.revision,sourcePath:spec.ownerSourcePath,fullNormalizedSnapshotSha256:classMovementSnapshot(owner),forms:forms(owner,appOwner),ordinarySnapshotSha256:ordinaryOwner(owner).snapshotSha256,declaredReference:{path:spec.referencePath,ref:spec.reference,grantKey:spec.grantKey}},sourceClauses:spec.clauses.map(clause=>({...clause})),...(spec.tablePath?{sourceTable:{path:spec.tablePath,canonicalSha256:spec.tableCanonicalSha256!,columnIndex:spec.tableColumnIndex!,rowCount:20,levelBonuses:[...spec.levelBonuses!]}}:{}),...(spec.relativeModes.length?{relativeModes:[...spec.relativeModes],relativeModeCondition:'independent-of-heavy-armor' as const,modeBaseline:'actual-final-walking-after-manual-total-and-sheet-offset' as const}:{relativeModes:[]}),wholeEntryCompletionCredit:0};
 });
 const routeForms=rules.flatMap(rule=>[...rule.forms,...rule.owner.forms]),verifiedRouteProofs=routeForms.length,distinctNormalizedSnapshotForms=new Set(routeForms.map(form=>form.completeSnapshotSha256)).size;
 if(rules.length!==5||verifiedRouteProofs!==20||distinctNormalizedSnapshotForms!==10)fail('EVIDENCE_COUNTS');
 const held=classMovementHeldEntries(),heldApp=classMovementHeldEntries('app'),heldFeatures=heldSpecs.map((spec,index)=>{const entry=held[index],app=heldApp[index];if(entry.id!==app.id)fail('HELD_FORM_IDENTITY');return{id:entry.id,...header(entry),revision:entry.revision,inputPath:'class/class-ranger.json',sourcePath:spec.sourcePath,fullNormalizedSnapshotSha256:classMovementSnapshot(entry),forms:forms(entry,app),reasonCode:'explicit-natural-explorer-replacement-choice-not-proven-by-current-auto-attachment'};});
 const heldRouteForms=heldFeatures.flatMap(feature=>feature.forms),heldProofCounts={features:heldFeatures.length,verifiedRouteProofs:heldRouteForms.length,distinctNormalizedSnapshotForms:new Set(heldRouteForms.map(form=>form.completeSnapshotSha256)).size};if(heldProofCounts.features!==2||heldProofCounts.verifiedRouteProofs!==4||heldProofCounts.distinctNormalizedSnapshotForms!==2)fail('HELD_EVIDENCE_COUNTS');
 return{schemaVersion:1,scope:'exact-five-native-class-movement-features',sourceProseIncluded:false,wholeEntryCompletionCredit:0,newReportWitnessCredit:0,inputs:classMovementInputPins.map(pin=>({...pin})),counts:{owners:5,features:5,verifiedRouteProofs,distinctNormalizedSnapshotForms,heldFeatures:2},heldProofCounts,normalization:{canonical:'each-complete-original-class-body-through-installed-normalizeCatalogData',app:'independent-each-complete-original-class-body-normalize-then-real-hydrateSpellLookup',transportRevision:'exact-single-input-sha256',noPayloadRepair:true},policy:{runtimeScope:'walking-projection-and-source-qualified-ranger-relative-modes-only',walkingBonusBaseline:'owning-class-level-only',rangerRelativeModeArmorRestriction:'none',rangerRelativeModeBaseline:'actual-final-walking-after-manual-total-and-sheet-offset',manualMechanisms:['wall-water-surface-execution','map-distance','turn-state','terrain','actions','resources','other-effects']},rules,holds:[{inputPath:'class/class-ranger.json',source:'TCE',sourcePaths:['classFeature/0','classFeature/13'],reasonCode:'explicit-natural-explorer-replacement-choice-not-proven-by-current-auto-attachment',genericSyncProvesReplacementChoice:false,features:heldFeatures}]};
}
let evidence:ReturnType<typeof buildEvidence>|undefined;
export function classMovementSourceEvidence(){boundary();return evidence??=buildEvidence();}
