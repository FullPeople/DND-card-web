import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {rolldown} from 'rolldown';

/** Exact accepted consumer before reviewed PHB2014 Observant intents.
 * No checkout code or current src module is used as a substitute for a missing old object.
 * A shallow CI checkout may skip these tests, but the dedicated gate MUST set
 * REVIEWED_OBSERVANT_LEGACY_REQUIRED=1 after fetching this exact commit.
 * No second checkout, old node_modules, network call or source file is required.
 */
export const REVIEWED_OBSERVANT_LEGACY_COMMIT='0478305fb20ddc9b65538fc50d5740d622c1589c';
export const REVIEWED_OBSERVANT_LEGACY_SOURCE_TREE='b1095fa3401b0052131d635425739cc3782bf59c';
const root=fileURLToPath(new URL('../../',import.meta.url));
const repository=root;
const git=(...args:string[])=>execFileSync('git',['--no-replace-objects',...args],{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
let missing:string|undefined;
try{
 if(git('rev-parse',`${REVIEWED_OBSERVANT_LEGACY_COMMIT}:src`).trim()!==REVIEWED_OBSERVANT_LEGACY_SOURCE_TREE)throw Error('old src tree does not match the frozen pre-observant-feat source');
}catch(error){missing=error instanceof Error?error.message:String(error);}
if(missing&&process.env.REVIEWED_OBSERVANT_LEGACY_REQUIRED==='1')throw Error(`Required Observant legacy consumer unavailable: ${missing}`);
export const reviewedObservantLegacyUnavailable=missing;

export interface FrozenReviewedObservantLegacy {
 model:Pick<typeof import('../../src/core/model'),'newCharacter'>;
 catalog:Pick<typeof import('../../src/data/catalog'),'normalizeData'>;
 state:Pick<typeof import('../../src/core/automation/state'),'newAutomationState'>;
 linguist:typeof import('../../src/core/automation/reviewedLinguist');
 skilled:typeof import('../../src/core/automation/reviewedSkilled');
 validation:Pick<typeof import('../../src/core/validation'),'validateCharacter'|'readCharacter'|'parseFile'|'importOwlbear'>;
 transfer:Pick<typeof import('../../src/core/transfers'),'readCharacterTransfer'>;
 exports:Pick<typeof import('../../src/core/export'),'exportCharacter'|'exportCharacters'|'exportLinkedOwlbear'|'exportOwlbear'>;
 runtime:typeof import('../../src/core/runtimeCharacterEdit');
 display:typeof import('../../src/core/displayCharacterEdit');
 choices:Pick<typeof import('../../src/core/automation/choices'),'setSheetChoiceSlot'|'chooseSheetOption'|'sheetChoices'>;
 engine:Pick<typeof import('../../src/core/engine'),'evaluate'>;
 rules:typeof import('../../src/core/automation/reviewedFeats');
 sheet:typeof import('../../src/core/sheet');
 training:typeof import('../../src/core/automation/training');
 weapons:typeof import('../../src/core/automation/weapons');
 storage:Pick<typeof import('../../src/platform/storage'),'saveWorkspace'|'loadWorkspace'|'restoreBackup'>;
 recovery:typeof import('../../src/platform/workspaceRecovery');
 history:Pick<typeof import('../../src/platform/actionHistory'),'recordAction'|'travelHistory'>;
 source(path:string):string;
 sourceFiles:string[];
}

/** Bundle just the transitive old modules, directly from immutable git blobs.
 * This is not a reimplementation or text assertion of the legacy functions.
 * Platform MODE=test is the same non-network/local storage environment Vitest uses.
 */
export async function frozenReviewedObservantLegacy():Promise<FrozenReviewedObservantLegacy>{
 if(missing)throw Error(`Exact legacy source missing: ${missing}`);
 const paths=new Set(git('ls-tree','-r','--name-only',REVIEWED_OBSERVANT_LEGACY_COMMIT,'--','src').trim().split('\n'));
 const contents=new Map<string,string>();
 const source=(path:string)=>{
  if(!paths.has(path))throw Error(`Not in frozen src tree: ${path}`);
  if(!contents.has(path))contents.set(path,git('show',`${REVIEWED_OBSERVANT_LEGACY_COMMIT}:${path}`));
  return contents.get(path)!;
 };
 const entry='reviewed-observant-legacy-entry.ts';
 const entrySource=[
  ['model','core/model'],['catalog','data/catalog'],['state','core/automation/state'],['skilled','core/automation/reviewedSkilled'],['linguist','core/automation/reviewedLinguist'],
  ['validation','core/validation'],['transfer','core/transfers'],['exports','core/export'],
  ['runtime','core/runtimeCharacterEdit'],['display','core/displayCharacterEdit'],
  ['choices','core/automation/choices'],['engine','core/engine'],['storage','platform/storage'],
  ['recovery','platform/workspaceRecovery'],['history','platform/actionHistory'],
  ['rules','core/automation/reviewedFeats'],['sheet','core/sheet'],['training','core/automation/training'],['weapons','core/automation/weapons'],
 ].map(([name,path])=>`export * as ${name} from '/src/${path}.ts';`).join('\n');
 const bundle=await rolldown({
  input:entry,logLevel:'silent',transform:{define:{'import.meta.env':JSON.stringify({MODE:'test',PROD:false,DEV:false})}},
  plugins:[{name:'exact-pre-observant-feat-git-objects',resolveId(specifier,importer){
   if(specifier===entry)return entry;
   if(!specifier.startsWith('.')&&!specifier.startsWith('/src/'))return {id:specifier,external:true};
   const path=specifier.startsWith('/src/')?specifier.slice(1):posix.normalize(posix.join(posix.dirname(importer!),specifier));
   const found=[path,`${path}.ts`,`${path}.tsx`,`${path}/index.ts`].find(candidate=>paths.has(candidate));
   if(!found)throw Error(`Missing exact legacy import ${specifier} from ${importer}`);
   return found;
  },load(id){return id===entry?entrySource:source(id);}}],
 });
 try{
  const output=await bundle.generate({format:'cjs',exports:'named'});
  if(output.output.length!==1||output.output[0].type!=='chunk')throw Error('Legacy bundle must be one in-memory module');
  const module={exports:{}},require=createRequire(new URL('../../package.json',import.meta.url));
  new Function('require','module','exports',output.output[0].code+`\n//# sourceURL=frozen-reviewed-observant-${REVIEWED_OBSERVANT_LEGACY_COMMIT}.cjs`)(require,module,module.exports);
  return {...module.exports,source,sourceFiles:[...contents.keys()].sort()} as FrozenReviewedObservantLegacy;
 }finally{await bundle.close();}
}
