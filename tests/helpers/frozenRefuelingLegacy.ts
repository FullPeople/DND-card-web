import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {rolldown} from 'rolldown';

/** Exact verified charge-v1 consumer, before Radiant and refueling support.
 * No checkout code or current src module is used as a substitute for a missing old object.
 * A shallow CI checkout may skip these tests, but the dedicated gate MUST set
 * REFUELING_LEGACY_REQUIRED=1 after fetching this exact commit.
 * No second checkout, old node_modules, network call or source file is required.
 */
export const REFUELING_LEGACY_COMMIT='2f8bb8938c55a0f1a937efe95bdbf30222680f86';
export const REFUELING_LEGACY_SOURCE_TREE='48ac56b4d80be04303dcdf80f75b138a1da10fe0';
const root=fileURLToPath(new URL('../../',import.meta.url));
const repository=root;
const git=(...args:string[])=>execFileSync('git',['--no-replace-objects',...args],{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
let missing:string|undefined;
try{
 if(git('rev-parse',`${REFUELING_LEGACY_COMMIT}:src`).trim()!==REFUELING_LEGACY_SOURCE_TREE)throw Error('old src tree does not match the frozen charge-v1 source');
}catch(error){missing=error instanceof Error?error.message:String(error);}
if(missing&&process.env.REFUELING_LEGACY_REQUIRED==='1')throw Error(`Required infusion legacy consumer unavailable: ${missing}`);
export const refuelingLegacyUnavailable=missing;

export interface FrozenRefuelingLegacy {
 validation:Pick<typeof import('../../src/core/validation'),'validateCharacter'|'readCharacter'|'parseFile'|'importOwlbear'>;
 transfer:Pick<typeof import('../../src/core/transfers'),'readCharacterTransfer'>;
 exports:Pick<typeof import('../../src/core/export'),'exportCharacter'|'exportCharacters'|'exportLinkedOwlbear'|'exportOwlbear'>;
 charges:typeof import('../../src/core/automation/infusionCharges');
 runtime:typeof import('../../src/core/runtimeCharacterEdit');
 resources:Pick<typeof import('../../src/core/resources'),'setResource'|'syncAutoResources'>;
 infusions:Pick<typeof import('../../src/core/automation/infusions'),'setInfusionTarget'|'setInfusionHeld'|'reconcileInfusionHolding'|'infusionRule'>;
 choices:Pick<typeof import('../../src/core/automation/choices'),'setSheetChoiceSlot'>;
 engine:Pick<typeof import('../../src/core/engine'),'evaluate'>;
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
export async function frozenRefuelingLegacy():Promise<FrozenRefuelingLegacy>{
 if(missing)throw Error(`Exact legacy source missing: ${missing}`);
 const paths=new Set(git('ls-tree','-r','--name-only',REFUELING_LEGACY_COMMIT,'--','src').trim().split('\n'));
 const contents=new Map<string,string>();
 const source=(path:string)=>{
  if(!paths.has(path))throw Error(`Not in frozen src tree: ${path}`);
  if(!contents.has(path))contents.set(path,git('show',`${REFUELING_LEGACY_COMMIT}:${path}`));
  return contents.get(path)!;
 };
 const entry='refueling-legacy-entry.ts';
 const entrySource=[
  ['validation','core/validation'],['transfer','core/transfers'],['exports','core/export'],
  ['charges','core/automation/infusionCharges'],['runtime','core/runtimeCharacterEdit'],['resources','core/resources'],['infusions','core/automation/infusions'],
  ['choices','core/automation/choices'],['engine','core/engine'],['storage','platform/storage'],
  ['recovery','platform/workspaceRecovery'],['history','platform/actionHistory'],
 ].map(([name,path])=>`export * as ${name} from '/src/${path}.ts';`).join('\n');
 const bundle=await rolldown({
  input:entry,logLevel:'silent',transform:{define:{'import.meta.env':JSON.stringify({MODE:'test',PROD:false,DEV:false})}},
  plugins:[{name:'exact-charge-v1-git-objects',resolveId(specifier,importer){
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
  new Function('require','module','exports',output.output[0].code+`\n//# sourceURL=frozen-refueling-${REFUELING_LEGACY_COMMIT}.cjs`)(require,module,module.exports);
  return {...module.exports,source,sourceFiles:[...contents.keys()].sort()} as FrozenRefuelingLegacy;
 }finally{await bundle.close();}
}
