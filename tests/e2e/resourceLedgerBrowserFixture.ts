import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {newCharacter} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
const evidence:{inputs:{url:string;sha256:string}[]}=JSON.parse(readFileSync(new URL('../../src/core/automation/ordinarySpellCastingEvidence.json',import.meta.url),'utf8'));
export const resourceProductPaths=[
  "src/core/automation/actions.ts",
  "src/core/automation/itemChargeDebitEvidence.json",
  "src/core/automation/itemChargeDebitSource.ts",
  "src/core/automation/itemChargeDebits.ts",
  "src/core/automation/limitedSourceUseEvidence.json",
  "src/core/automation/limitedSourceUseSource.ts",
  "src/core/automation/limitedSourceUses.ts",
  "src/core/automation/ordinarySpellCasting.ts",
  "src/core/automation/ordinarySpellCastingEvidence.json",
  "src/core/automation/protectedResourceHistoryTravel.ts",
  "src/core/automation/spellActionAuthority.ts",
  "src/ui/App.tsx",
  "src/ui/AutomationPanel.tsx",
  "src/ui/ItemChargeUseControl.tsx",
  "src/ui/LimitedSourceUseControl.tsx",
  "src/ui/ResourceModuleEditor.tsx",
  "src/ui/ResourceWidgets.tsx",
  "src/ui/SourceSpellActions.tsx",
  "src/ui/SpellActionFeedback.tsx",
  "src/ui/characterHistoryPatch.ts",
  "src/core/automation/attunedItemChargeDebitEvidence.json",
  "src/core/automation/itemChargeCatalogFormsEvidence.json"
] as const;
// The complete replay ledger owns source revisions and file bytes; a second
// handwritten product lock must not remain on an ancestor after main is merged.
export function resourceProductBinding(report:{consumer:{revision:string;modules:{path:string;sha256:string}[]}}){
 if(!/^[a-f0-9]{40}$/.test(report.consumer.revision))throw Error('Resource consumer revision is not pinned');
 return resourceProductPaths.map(path=>{
  const rows=report.consumer.modules.filter(row=>row.path===path);
  if(rows.length!==1||!/^[a-f0-9]{64}$/.test(rows[0].sha256))throw Error('Resource product is missing or ambiguous in the replay ledger');
  return {path,sha256:rows[0].sha256};
 });
}
export const resourceProductPins=resourceProductBinding(JSON.parse(readFileSync(new URL('../../docs/data/automation-runtime-coverage.json',import.meta.url),'utf8')));
export const resourceProductSetSha256=createHash('sha256').update(JSON.stringify(resourceProductPins)).digest('hex');
export function verifyResourceProductPins(root=fileURLToPath(new URL('../../',import.meta.url))){for(const pin of resourceProductPins)if(createHash('sha256').update(readFileSync(join(root,pin.path))).digest('hex')!==pin.sha256)throw Error('Frozen resource product binding mismatch: '+pin.path);}
export const resourceBrowserPaths=['rewards.json','items.json','items-base.json','magicvariants.json','spells/spells-phb.json','generated/gendata-spell-source-lookup.json'] as const;
export const resourceBrowserInputs=resourceBrowserPaths.map(path=>{const rows=evidence.inputs.filter(row=>row.url==='https://5e.kiwee.top/data/'+path);if(rows.length!==1)throw Error('Exact resource input metadata required');return rows[0];});
export const resourceInputSetSha256=createHash('sha256').update(JSON.stringify([...resourceBrowserInputs].sort((a,b)=>a.url.localeCompare(b.url)))).digest('hex');
export function readResourceBrowserInputs(directory=process.env.ORDINARY_CASTING_FROZEN_DIR||process.env.REVIEWED_FEATS_FROZEN_DIR){if(!directory)throw Error('Resource App checks require exact frozen originals');const index=JSON.parse(readFileSync(directory+'/index.json','utf8')),bodies:Record<string,any>={};for(const path of resourceBrowserPaths){const expected=resourceBrowserInputs.find(row=>row.url==='https://5e.kiwee.top/data/'+path)!,rows=index.rows.filter((row:any)=>row.url===expected.url&&row.sha256===expected.sha256);if(rows.length!==1)throw Error('Resource input metadata mismatch');const body=JSON.parse(readFileSync(directory+'/'+rows[0].path,'utf8'));if(createHash('sha256').update(JSON.stringify(body)).digest('hex')!==expected.sha256)throw Error('Resource input body mismatch');bodies[path]=body;}return bodies;}
export const resourceEntryIds={limited:'kiwee:feature:dmg:charm%20of%20animal%20conjuring::::::',spell:'kiwee:spell:phb:conjure%20animals::::::',item:'kiwee:item:crcotn:earring%20of%20message::::::',attuned:'kiwee:item:dmg:trident%20of%20fish%20command::::::'} as const;
export function resourceBlankCharacter(){const c=newCharacter('2014');c.name='资源记账交互验收';c.automation=newAutomationState();c.profile.enabledSources=['DMG','PHB','CRCOTN'];c.notes='Authored resource accounting manual sentinel';c.runtime.hp=7;c.runtime.tempHp=3;c.baseHp=20;c.runtime.resources['resource-manual']={name:'Authored independent spent resource',max:7,current:2,locked:true};return c;}

/** Sanitized exact admitted route and closed full-entry normalization hashes. */
export const resourceAttunedProof={entryId:resourceEntryIds.attuned,english:'Trident of Fish Command',source:'DMG',packId:'kiwee',edition:'2014',capacity:3,actionKey:'cast-dominate-beast-swimming',minAfter:1,canonicalRevision:'883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488',canonicalSnapshotSha256:'4c2aff2a21aa6174af569b6c89add18c794cc162381e69cd97f4e3903474c9c0',mergedSnapshotSha256:'72b40cd1965958a8a396ab1becbfa1869330bda8a77d9a25615f257045bd9926'} as const;
