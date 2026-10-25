import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {rolldown} from 'rolldown';

/** Exact accepted consumer before reviewed PHB2014 Skilled intents.
 * No checkout code or current src module is used as a substitute for a missing old object.
 * A shallow CI checkout may skip these tests, but the dedicated gate MUST set
 * REVIEWED_SKILLED_LEGACY_REQUIRED=1 after fetching this exact commit.
 * No second checkout, old node_modules, network call or source file is required.
 */
export const REVIEWED_SKILLED_LEGACY_COMMIT='52d5be10e161464d5e0846d1dc2202ea1169754b';
export const REVIEWED_SKILLED_LEGACY_SOURCE_TREE='4d40c102e1ecd0617c39dd9b33d711d34e9c5103';
const root=fileURLToPath(new URL('../../',import.meta.url));
const repository=root;
const git=(...args:string[])=>execFileSync('git',['--no-replace-objects',...args],{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
let missing:string|undefined;
try{
 if(git('rev-parse',`${REVIEWED_SKILLED_LEGACY_COMMIT}:src`).trim()!==REVIEWED_SKILLED_LEGACY_SOURCE_TREE)throw Error('old src tree does not match the frozen pre-skilled-feat source');
}catch(error){missing=error instanceof Error?error.message:String(error);}
if(missing&&process.env.REVIEWED_SKILLED_LEGACY_REQUIRED==='1')throw Error(`Required Skilled legacy consumer unavailable: ${missing}`);
export const reviewedSkilledLegacyUnavailable=missing;

export interface FrozenReviewedSkilledLegacy {
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
export async function frozenReviewedSkilledLegacy():Promise<FrozenReviewedSkilledLegacy>{
 if(missing)throw Error(`Exact legacy source missing: ${missing}`);
 const paths=new Set(git('ls-tree','-r','--name-only',REVIEWED_SKILLED_LEGACY_COMMIT,'--','src').trim().split('\n'));
 const contents=new Map<string,string>();
 const source=(path:string)=>{
  if(!paths.has(path))throw Error(`Not in frozen src tree: ${path}`);
  if(!contents.has(path))contents.set(path,git('show',`${REVIEWED_SKILLED_LEGACY_COMMIT}:${path}`));
  return contents.get(path)!;
 };
 const entry='reviewed-skilled-legacy-entry.ts';
 const entrySource=[
  ['validation','core/validation'],['transfer','core/transfers'],['exports','core/export'],
  ['runtime','core/runtimeCharacterEdit'],['display','core/displayCharacterEdit'],
  ['choices','core/automation/choices'],['engine','core/engine'],['storage','platform/storage'],
  ['recovery','platform/workspaceRecovery'],['history','platform/actionHistory'],
  ['rules','core/automation/reviewedFeats'],['sheet','core/sheet'],['training','core/automation/training'],['weapons','core/automation/weapons'],
 ].map(([name,path])=>`export * as ${name} from '/src/${path}.ts';`).join('\n');
 const bundle=await rolldown({
  input:entry,logLevel:'silent',transform:{define:{'import.meta.env':JSON.stringify({MODE:'test',PROD:false,DEV:false})}},
  plugins:[{name:'exact-pre-skilled-feat-git-objects',resolveId(specifier,importer){
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
  new Function('require','module','exports',output.output[0].code+`\n//# sourceURL=frozen-reviewed-skilled-${REVIEWED_SKILLED_LEGACY_COMMIT}.cjs`)(require,module,module.exports);
  return {...module.exports,source,sourceFiles:[...contents.keys()].sort()} as FrozenReviewedSkilledLegacy;
 }finally{await bundle.close();}
}
