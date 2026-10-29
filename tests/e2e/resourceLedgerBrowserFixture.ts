import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {newCharacter} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
const evidence:{inputs:{url:string;sha256:string}[]}=JSON.parse(readFileSync(new URL('../../src/core/automation/ordinarySpellCastingEvidence.json',import.meta.url),'utf8'));
export const resourceProductPins=[
  {
    "path": "src/core/automation/actions.ts",
    "sha256": "c7907fc990721ff33723aa3a8f321f70deca312d8f38891013c03c896183bda0"
  },
  {
    "path": "src/core/automation/itemChargeDebitEvidence.json",
    "sha256": "4e3a7916994c541d56887a77936b33b18b55e2a3760505c1e0f7756bf187e44f"
  },
  {
    "path": "src/core/automation/itemChargeDebitSource.ts",
    "sha256": "d33066592bb14fde90709a071963710c5ec11d29a3c8b1a2dc4823d9a88304f0"
  },
  {
    "path": "src/core/automation/itemChargeDebits.ts",
    "sha256": "6b795fd0d976ee4a5c3f3ba6ff32f11aff9f6cd385af09bfbff7708ea509c0d8"
  },
  {
    "path": "src/core/automation/limitedSourceUseEvidence.json",
    "sha256": "8ded7fe5e8f9cb165c0be236a3bb5caf2c491cf3e78dedfa3676229218f594aa"
  },
  {
    "path": "src/core/automation/limitedSourceUseSource.ts",
    "sha256": "f8dc77c98858aa95190aff1fd08d084127076e7d5af4d9676aa398ad2aace69c"
  },
  {
    "path": "src/core/automation/limitedSourceUses.ts",
    "sha256": "4c952f4819441094246535d09e1dd5f83dd182730f322b92e5b514133c267b97"
  },
  {
    "path": "src/core/automation/ordinarySpellCasting.ts",
    "sha256": "7f1fe68331976718c9372631f0fac43ce6569e8156951e153e36fbe2e9e8bb53"
  },
  {
    "path": "src/core/automation/ordinarySpellCastingEvidence.json",
    "sha256": "2a7625e1954acea65d02bad96b5ddc025876dde9b9a7abe165d5499dcac621f5"
  },
  {
    "path": "src/core/automation/protectedResourceHistoryTravel.ts",
    "sha256": "849555175f14f8b9f65be12a95c47de5e1600c57672253e4ce14dffbc0b5bd94"
  },
  {
    "path": "src/core/automation/spellActionAuthority.ts",
    "sha256": "21c5e66e0c560669cc9d605d7505b06090200983ce533e3b473975a422c98856"
  },
  {
    "path": "src/ui/App.tsx",
    "sha256": "a5fed2a3820f65752d8511bea272259186bdf0d08b54dacaf1dc610dd9d463b7"
  },
  {
    "path": "src/ui/AutomationPanel.tsx",
    "sha256": "c93b3e63fd4f110c6638c7cd69d09aeb6b8c3dace4b72b64bdc58971ce49c0c0"
  },
  {
    "path": "src/ui/ItemChargeUseControl.tsx",
    "sha256": "cae9ef89f854f07e4a722468d738353cd2885384c258123e231dd876fcf22a4d"
  },
  {
    "path": "src/ui/LimitedSourceUseControl.tsx",
    "sha256": "2c4971bcabf0003dbef01acae991b41694c00c05a4fcb93d0f413a98fb24bbd2"
  },
  {
    "path": "src/ui/ResourceModuleEditor.tsx",
    "sha256": "446a5e5789e06a84be7a98c4699250bb71c4b2cf604999dd1d762a14f3eab94c"
  },
  {
    "path": "src/ui/ResourceWidgets.tsx",
    "sha256": "6202943117137cf146a90cb7d6f677dec47f1126ec74776bbd8a56d373161016"
  },
  {
    "path": "src/ui/SourceSpellActions.tsx",
    "sha256": "76e74e05a291e3ff95fb47723488596287a7aea1eafdee63f74df7ebc8832b52"
  },
  {
    "path": "src/ui/SpellActionFeedback.tsx",
    "sha256": "da64475b56560eb1644af1098c75e078539cdc882a6794ec45e1568ca4758bb0"
  },
  {
    "path": "src/ui/characterHistoryPatch.ts",
    "sha256": "22f4af48445e36db1f3f4c711aef63a3b73a4d6b89d7307c12730cb7fdb4ff97"
  },
  {
    "path": "src/core/automation/attunedItemChargeDebitEvidence.json",
    "sha256": "d3bf0e07b8c207f64abf4ef296295fc38e3419fd0685d79053761e97da0d9f96"
  },
  {
    "path": "src/core/automation/itemChargeCatalogFormsEvidence.json",
    "sha256": "2a4e054125d0a1dc2163e44d998b28aee8698fbff4dfb808353f620631a8f2a4"
  }
] as const;
export const resourceProductSetSha256=createHash('sha256').update(JSON.stringify(resourceProductPins)).digest('hex');
export function verifyResourceProductPins(){for(const pin of resourceProductPins)if(createHash('sha256').update(readFileSync(new URL('../../'+pin.path,import.meta.url))).digest('hex')!==pin.sha256)throw Error('Frozen resource product binding mismatch: '+pin.path);}
export const resourceBrowserPaths=['rewards.json','items.json','items-base.json','magicvariants.json','spells/spells-phb.json','generated/gendata-spell-source-lookup.json'] as const;
export const resourceBrowserInputs=resourceBrowserPaths.map(path=>{const rows=evidence.inputs.filter(row=>row.url==='https://5e.kiwee.top/data/'+path);if(rows.length!==1)throw Error('Exact resource input metadata required');return rows[0];});
export const resourceInputSetSha256=createHash('sha256').update(JSON.stringify([...resourceBrowserInputs].sort((a,b)=>a.url.localeCompare(b.url)))).digest('hex');
export function readResourceBrowserInputs(directory=process.env.ORDINARY_CASTING_FROZEN_DIR||process.env.REVIEWED_FEATS_FROZEN_DIR){if(!directory)throw Error('Resource App checks require exact frozen originals');const index=JSON.parse(readFileSync(directory+'/index.json','utf8')),bodies:Record<string,any>={};for(const path of resourceBrowserPaths){const expected=resourceBrowserInputs.find(row=>row.url==='https://5e.kiwee.top/data/'+path)!,rows=index.rows.filter((row:any)=>row.url===expected.url&&row.sha256===expected.sha256);if(rows.length!==1)throw Error('Resource input metadata mismatch');const body=JSON.parse(readFileSync(directory+'/'+rows[0].path,'utf8'));if(createHash('sha256').update(JSON.stringify(body)).digest('hex')!==expected.sha256)throw Error('Resource input body mismatch');bodies[path]=body;}return bodies;}
export const resourceEntryIds={limited:'kiwee:feature:dmg:charm%20of%20animal%20conjuring::::::',spell:'kiwee:spell:phb:conjure%20animals::::::',item:'kiwee:item:crcotn:earring%20of%20message::::::',attuned:'kiwee:item:dmg:trident%20of%20fish%20command::::::'} as const;
export function resourceBlankCharacter(){const c=newCharacter('2014');c.name='资源记账交互验收';c.automation=newAutomationState();c.profile.enabledSources=['DMG','PHB','CRCOTN'];c.notes='Authored resource accounting manual sentinel';c.runtime.hp=7;c.runtime.tempHp=3;c.baseHp=20;c.runtime.resources['resource-manual']={name:'Authored independent spent resource',max:7,current:2,locked:true};return c;}

/** Sanitized exact admitted route and closed full-entry normalization hashes. */
export const resourceAttunedProof={entryId:resourceEntryIds.attuned,english:'Trident of Fish Command',source:'DMG',packId:'kiwee',edition:'2014',capacity:3,actionKey:'cast-dominate-beast-swimming',minAfter:1,canonicalRevision:'883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488',canonicalSnapshotSha256:'4c2aff2a21aa6174af569b6c89add18c794cc162381e69cd97f4e3903474c9c0',mergedSnapshotSha256:'72b40cd1965958a8a396ab1becbfa1869330bda8a77d9a25615f257045bd9926'} as const;
