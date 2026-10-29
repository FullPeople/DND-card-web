import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import type {Entry,Ability} from '../../src/core/model';

// Pure immutable-source IO: no Character factory, state, engine, projection or
// generated evidence imports. Cached Entries must be cloned by consumers.
export const itemPassiveBonusInputPins=[
 {path:'items-base.json',sha256:'8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff',bytes:149813},
 {path:'items.json',sha256:'883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488',bytes:2458443},
 {path:'magicvariants.json',sha256:'4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d',bytes:190573}
] as const;
export type ItemPassiveBonusSourceCondition='worn'|'equipped-on-person'|'attuned-only';
export interface ItemPassiveBonusSpec {sourceIndex:number;name:string;english:string;source:string;page:number;sourceCondition:ItemPassiveBonusSourceCondition;acBonus:number;saveBonuses:Partial<Record<Ability,number>>;sourcePropertyRows:number;clauses:{path:string;utf8Sha256:string}[]}
export const itemPassiveBonusSpecs:readonly ItemPassiveBonusSpec[]=[
  {
    "sourceIndex": 453,
    "name": "防护斗篷",
    "english": "Cloak of Protection",
    "source": "DMG",
    "page": 159,
    "sourceCondition": "worn",
    "acBonus": 1,
    "saveBonuses": {
      "str": 1,
      "dex": 1,
      "con": 1,
      "int": 1,
      "wis": 1,
      "cha": 1
    },
    "sourcePropertyRows": 2,
    "clauses": [
      {
        "path": "item/453/entries/0",
        "utf8Sha256": "2b9d10e87f5d87ede0bac077d6c5d3958f574991d8e44fd9f6c098c0b78e2e3e"
      }
    ]
  },
  {
    "sourceIndex": 454,
    "name": "防护斗篷",
    "english": "Cloak of Protection",
    "source": "XDMG",
    "page": 245,
    "sourceCondition": "worn",
    "acBonus": 1,
    "saveBonuses": {
      "str": 1,
      "dex": 1,
      "con": 1,
      "int": 1,
      "wis": 1,
      "cha": 1
    },
    "sourcePropertyRows": 2,
    "clauses": [
      {
        "path": "item/454/entries/0",
        "utf8Sha256": "3768b9eba57860a2f9922d84e4d979955fd6a48b8e642d9c96135eaf5ba06b43"
      }
    ]
  },
  {
    "sourceIndex": 1794,
    "name": "防护戒指",
    "english": "Ring of Protection",
    "source": "DMG",
    "page": 191,
    "sourceCondition": "worn",
    "acBonus": 1,
    "saveBonuses": {
      "str": 1,
      "dex": 1,
      "con": 1,
      "int": 1,
      "wis": 1,
      "cha": 1
    },
    "sourcePropertyRows": 2,
    "clauses": [
      {
        "path": "item/1794/entries/0",
        "utf8Sha256": "4749a9fe120c4f47157073643e0b0c1a79a7e187537f087cb676060cdfb84806"
      }
    ]
  },
  {
    "sourceIndex": 1795,
    "name": "防护戒指",
    "english": "Ring of Protection",
    "source": "XDMG",
    "page": 294,
    "sourceCondition": "worn",
    "acBonus": 1,
    "saveBonuses": {
      "str": 1,
      "dex": 1,
      "con": 1,
      "int": 1,
      "wis": 1,
      "cha": 1
    },
    "sourcePropertyRows": 2,
    "clauses": [
      {
        "path": "item/1795/entries/0",
        "utf8Sha256": "653d46c515469923ba4d738f70af94c3961c09c794b8a27758ab8ee38a14c1ae"
      }
    ]
  },
  {
    "sourceIndex": 1840,
    "name": "星辰法袍",
    "english": "Robe of Stars",
    "source": "DMG",
    "page": 194,
    "sourceCondition": "worn",
    "acBonus": 0,
    "saveBonuses": {
      "str": 1,
      "dex": 1,
      "con": 1,
      "int": 1,
      "wis": 1,
      "cha": 1
    },
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/1840/entries/0",
        "utf8Sha256": "8f1fbab9480f85186b668923241482fd3fd2f566832d4811335579ebcd2ed96e"
      }
    ]
  },
  {
    "sourceIndex": 1841,
    "name": "星辰法袍",
    "english": "Robe of Stars",
    "source": "XDMG",
    "page": 297,
    "sourceCondition": "worn",
    "acBonus": 0,
    "saveBonuses": {
      "str": 1,
      "dex": 1,
      "con": 1,
      "int": 1,
      "wis": 1,
      "cha": 1
    },
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/1841/entries/0",
        "utf8Sha256": "9fe79e99a9a989edd3a51c116629a8a80f19a1d51767cc30d986aa6570acf07a"
      }
    ]
  },
  {
    "sourceIndex": 1157,
    "name": "三祷之坠（休眠）",
    "english": "Jewel of Three Prayers (Dormant)",
    "source": "CRCotN",
    "page": 213,
    "sourceCondition": "worn",
    "acBonus": 1,
    "saveBonuses": {},
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/1157/entries/1/entries/2/items/0",
        "utf8Sha256": "4dcfbaf319abee1bfe5080f1fc650f356484e094f93bbe38b729805b67eb1e28"
      }
    ]
  },
  {
    "sourceIndex": 2439,
    "name": "守望头盔",
    "english": "Watchful Helm",
    "source": "CM",
    "page": 183,
    "sourceCondition": "worn",
    "acBonus": 1,
    "saveBonuses": {},
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/2439/entries/0",
        "utf8Sha256": "e0b0b5d9dd8886c3f0138d5c7b9faee869682f837e0364e0065bd403fd186c8f"
      }
    ]
  },
  {
    "sourceIndex": 422,
    "name": "年表仪盘",
    "english": "Chronolometer",
    "source": "AI",
    "page": 220,
    "sourceCondition": "attuned-only",
    "acBonus": 0,
    "saveBonuses": {
      "int": 1
    },
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/422/entries/0",
        "utf8Sha256": "3cb2f3665dbb4d3da21e63a044a30ca6694c840ae862dcf04830c8196458b8b3"
      }
    ]
  },
  {
    "sourceIndex": 593,
    "name": "维度环",
    "english": "Dimensional Loop",
    "source": "AI",
    "page": 220,
    "sourceCondition": "attuned-only",
    "acBonus": 0,
    "saveBonuses": {
      "str": 1
    },
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/593/entries/0",
        "utf8Sha256": "19b6773ba0c314bd7417abc74315eedf45290e6122a01f89ae44376dde93a0f5"
      }
    ]
  },
  {
    "sourceIndex": 753,
    "name": "遥远齿轮",
    "english": "Far Gear",
    "source": "AI",
    "page": 221,
    "sourceCondition": "attuned-only",
    "acBonus": 0,
    "saveBonuses": {
      "cha": 1
    },
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/753/entries/0",
        "utf8Sha256": "75a0c2c97cd8a0c0867084fd7e9cabe3d96974579a07ace7a5fd278035a1964c"
      }
    ]
  },
  {
    "sourceIndex": 1875,
    "name": "回溯引擎",
    "english": "Rotor of Return",
    "source": "AI",
    "page": 221,
    "sourceCondition": "attuned-only",
    "acBonus": 0,
    "saveBonuses": {
      "con": 1
    },
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/1875/entries/0",
        "utf8Sha256": "5f7d1a2ff2aec9cc62a8ed61897e0b9b1f023f16e8b62852c36398b0956e0c03"
      }
    ]
  },
  {
    "sourceIndex": 2311,
    "name": "旅行表盘",
    "english": "Timepiece of Travel",
    "source": "AI",
    "page": 221,
    "sourceCondition": "attuned-only",
    "acBonus": 0,
    "saveBonuses": {
      "dex": 1
    },
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/2311/entries/0",
        "utf8Sha256": "85c2ddc047cbc138f27b53c4cdd0b9caa53c4961442e257d84ce8bae164d4b45"
      }
    ]
  },
  {
    "sourceIndex": 2453,
    "name": "星轮",
    "english": "Wheel of Stars",
    "source": "AI",
    "page": 222,
    "sourceCondition": "attuned-only",
    "acBonus": 0,
    "saveBonuses": {
      "wis": 1
    },
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/2453/entries/0",
        "utf8Sha256": "bd274538cd14e96cafcefc12e901775c98dd880c793be5424babb6ec6a312232"
      }
    ]
  },
  {
    "sourceIndex": 2492,
    "name": "铸铁塔",
    "english": "Wrought-Iron Tower",
    "source": "CoA",
    "page": 276,
    "sourceCondition": "attuned-only",
    "acBonus": 2,
    "saveBonuses": {
      "str": 2,
      "dex": 2,
      "con": 2,
      "int": 2,
      "wis": 2,
      "cha": 2
    },
    "sourcePropertyRows": 2,
    "clauses": [
      {
        "path": "item/2492/entries/4/entries/0",
        "utf8Sha256": "9c70954c0d6b3ad866921552260882568a35ca78df689322662a5f3f5e4a3b0b"
      }
    ]
  },
  {
    "sourceIndex": 1056,
    "name": "盾牌符文铸块",
    "english": "Ingot of the Skold Rune",
    "source": "SKT",
    "page": 234,
    "sourceCondition": "equipped-on-person",
    "acBonus": 1,
    "saveBonuses": {},
    "sourcePropertyRows": 1,
    "clauses": [
      {
        "path": "item/1056/entries/0",
        "utf8Sha256": "5ef62f12de73f9e71a43e45bcd116cc70605cbaf26a1e59a6b9f602ccdc20bbe"
      },
      {
        "path": "item/1056/entries/1/entries/0",
        "utf8Sha256": "a849d695cf8b57710d6af43a751ab3d53ed9a49ce9016eac9eea87a35867fb59"
      }
    ]
  }
];
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const itemPassiveBonusSnapshot=(value:unknown)=>digest(JSON.stringify(sorted(value)));
const fail:(code:string)=>never=code=>{throw Error('ITEM_PASSIVE_BONUS_SOURCE_'+code);};
function boundary(){const key=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,key),guard=(globalThis as any)[key];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_BOUNDARY');}
let originals:Record<string,any>|undefined;
function bodies():Record<string,any>{
 boundary();if(originals)return originals;const directory=process.env.ITEM_PASSIVE_BONUS_FROZEN_DIR;if(!directory)fail('FROZEN_DIRECTORY');const root=realpathSync(directory),index=JSON.parse(readFileSync(root+'/index.json','utf8')),out:Record<string,any>={};if(!Array.isArray(index.rows))fail('INDEX');
 for(const pin of itemPassiveBonusInputPins){const rows=index.rows.filter((r:any)=>r?.url==='https://5e.kiwee.top/data/'+pin.path);if(rows.length!==1||rows[0].sha256!==pin.sha256||!/^files\/[a-f0-9]{64}\.json$/.test(rows[0].path))fail('INPUT_PIN');const file=realpathSync(root+'/'+rows[0].path);if(!file.replaceAll('\\','/').startsWith(root.replaceAll('\\','/')+'/'))fail('INPUT_PATH');const bytes=readFileSync(file);if(bytes.length!==pin.bytes||digest(bytes)!==pin.sha256)fail('INPUT_BYTES');const body=JSON.parse(bytes.toString('utf8'));if(digest(JSON.stringify(body))!==pin.sha256)fail('INPUT_CANONICAL');out[pin.path]=body;}
 return originals=out;
}
const cache:Partial<Record<'canonical'|'app',Entry[]>>={};
function select(entries:Entry[]):Entry[]{return itemPassiveBonusSpecs.map(spec=>{const matches=entries.filter(e=>e.kind==='item'&&e.raw._category==='item'&&e.name===spec.name&&e.english===spec.english&&e.source===spec.source.toUpperCase()&&e.page===spec.page);if(matches.length!==1)fail('UNIQUE_FULL_HEADER');const entry=matches[0];if(entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity||entry.raw.reqAttune!==true||entry.effects?.length||entry.choices?.length)fail('UNEXPECTED_SOURCE_SHAPE');return entry;});}
export function itemPassiveBonusEntries(form:'canonical'|'app'='canonical'):Entry[]{
 boundary();if(form!=='canonical'&&form!=='app')fail('FORM');if(cache[form])return cache[form]!;const source=bodies();
 if(!cache.canonical)cache.canonical=select(normalizeCatalogData(structuredClone(source['items.json']),itemPassiveBonusInputPins[1].sha256,'kiwee'));
 if(form==='canonical')return cache.canonical;
 // Exact current App catalog.ts equipment accumulation and final batch order.
 // Path-prefixed, sorted revisions are transport metadata, not guessed hashes.
 const equipment=Object.assign({},...itemPassiveBonusInputPins.map(pin=>structuredClone(source[pin.path]))),revision=itemPassiveBonusInputPins.map(pin=>'data/'+pin.path+':'+pin.sha256).sort().join('|'),merged=new Map(cache.canonical.map(entry=>[entry.id,entry]));
 const wanted=new Set(cache.canonical.map(entry=>entry.id));for(const operation of ['normalize','magicItems'] as const)for(const entry of normalizeCatalogData(equipment,revision,'kiwee',operation))if(wanted.has(entry.id))merged.set(entry.id,entry);
 return cache.app=select([...merged.values()]);
}
export function itemPassiveBonusFind(idOrSourceIndex:string|number=453,form:'canonical'|'app'='canonical'):Entry{
 const canonical=itemPassiveBonusEntries(),at=typeof idOrSourceIndex==='number'?itemPassiveBonusSpecs.findIndex(spec=>spec.sourceIndex===idOrSourceIndex):canonical.findIndex(entry=>entry.id===idOrSourceIndex);if(at<0)fail('UNREVIEWED_IDENTITY');return itemPassiveBonusEntries(form)[at];
}
const overlapGroups:Record<number,string>={453:'cloak-protection-editions',454:'cloak-protection-editions',1794:'ring-protection-editions',1795:'ring-protection-editions',1840:'robe-stars-editions',1841:'robe-stars-editions'};
let evidence:ReturnType<typeof buildEvidence>|undefined;
function buildEvidence(){
 const source=bodies()['items.json'],canonical=itemPassiveBonusEntries(),app=itemPassiveBonusEntries('app');
 const rules=itemPassiveBonusSpecs.map((spec,index)=>{
  const raw=source.item[spec.sourceIndex],entry=canonical[index],final=app[index];if(raw.name!==spec.name||raw.ENG_name!==spec.english||raw.source!==spec.source||raw.page!==spec.page||raw.reqAttune!==true||raw._copy||entry.id!==final.id)fail('SOURCE_IDENTITY');
  for(const clause of spec.clauses){let node:any=source;for(const key of clause.path.split('/'))node=node[key];if(typeof node!=='string'||digest(node)!==clause.utf8Sha256)fail('CLAUSE');}
  const ac=raw.bonusAc===undefined?0:Number(raw.bonusAc),save=raw.bonusSavingThrow===undefined?0:Number(raw.bonusSavingThrow);if(ac!==spec.acBonus||Object.values(spec.saveBonuses).some(value=>value!==save)||!Number.isSafeInteger(ac)||!Number.isSafeInteger(save)||raw.bonusAbilityCheck!==undefined||raw.bonusSpellAttack!==undefined)fail('NUMERIC_SOURCE');
  return {id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,revision:entry.revision,page:entry.page??null,category:entry.raw._category,sourceIndex:spec.sourceIndex,fullNormalizedSnapshotSha256:itemPassiveBonusSnapshot(entry),forms:([{form:'canonical',entry},{form:'app',entry:final}]as const).map(({form,entry:e})=>({form,revision:e.revision,completeSnapshotSha256:itemPassiveBonusSnapshot(e),canonicalReboundSnapshotSha256:itemPassiveBonusSnapshot({...e,id:entry.id,revision:entry.revision})})),requiresAttunement:true,sourceCondition:spec.sourceCondition,projectionPolicy:{overlapGroup:overlapGroups[spec.sourceIndex]??null,overlapHoldReason:'unreviewed-simultaneous-cross-edition-effect-stacking'},acBonus:spec.acBonus,saveBonuses:spec.saveBonuses,sourcePropertyRows:spec.sourcePropertyRows,clauses:spec.clauses,input:{url:'https://5e.kiwee.top/data/items.json',sha256:itemPassiveBonusInputPins[1].sha256},wholeEntryCompletionCredit:0};
 });
 if(rules.length!==16||new Set(rules.map(r=>r.id)).size!==16||rules.reduce((n,r)=>n+r.sourcePropertyRows,0)!==21||rules.filter(r=>r.sourceCondition==='worn').length!==8||rules.filter(r=>r.sourceCondition==='attuned-only').length!==7||rules.filter(r=>r.sourceCondition==='equipped-on-person').length!==1)fail('COUNTS');
 return {schemaVersion:1,scope:'source-qualified flat passive item AC and saving-throw branches only',sourceProseIncluded:false,wholeEntryCompletionCredit:0,newReportWitnessCredit:0,inputs:itemPassiveBonusInputPins.map(pin=>({url:'https://5e.kiwee.top/data/'+pin.path,sha256:pin.sha256,bytes:pin.bytes})),counts:{owners:16,sourcePropertyRows:21,completeOwnerForms:32,worn:8,attunedOnly:7,equippedOnPerson:1},normalization:{canonical:'complete original items.json through installed normalizeCatalogData',app:'exact catalog.ts final equipment accumulation plus normalize then magicItems, sorted path-prefixed source revisions',noPayloadRepair:true},rules,held:{carriedOnlySourceIndices:[2220,2221,1920],carriedOnlyOwners:3,carriedOnlyPropertyRows:5,spellAttackOriginalRecords:53,otherConditionalBranches:'not admitted; no armor/shield/activation/aura/orbit/curse/stage/variant policy guessed'}};
}
export function itemPassiveBonusSourceEvidence(){return evidence??=buildEvidence();}
