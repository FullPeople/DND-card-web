import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,realpathSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {rolldown} from 'rolldown';

export const nonunitOldReaderPins={revision:'4069886e1bfcab2fb7e2958eca8919601a13dd62',sourceTree:'03d4ab4759597059e6d501a5dcec911f65c6ef30',sourceFiles:619,packageSha256:'dc7334404f7417cb469be7a1e86d0861431c228334d5971373dcab686a780faf',lockSha256:'e4eaa83a394c731a3772466be039cfe7742b144a4e3af8221ceb73e64a6e115f'}as const;
const fail:(code:string)=>never=code=>{throw Error('NONUNIT_ITEM_CHARGE_OLD_SOURCE_'+code);};
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const gitObject=(type:string,bytes:Buffer)=>createHash('sha1').update(Buffer.concat([Buffer.from(type+' '+bytes.length+'\0'),bytes])).digest();
/** Rebuild the complete Git src tree from actual bytes, names and modes. This
 * accepts an immutable checkout OR a verified Git-object export, never a mere
 * claimed manifest/HEAD. No process, fetch, package install or catalog read. */
export function verifyNonunitOldReaderRoot():string{
 const directory=process.env.NONUNIT_ITEM_CHARGE_OLD_WEB_ROOT;if(!directory)fail('ROOT_REQUIRED');const root=realpathSync(directory);let files=0;
 function tree(directory:string):Buffer{
  const entries=readdirSync(directory).map(name=>{const path=join(directory,name),stat=lstatSync(path);if(stat.isSymbolicLink())fail('SYMLINK');if(stat.isDirectory())return{name,mode:'40000',object:tree(path),sort:Buffer.from(name+'/')};if(!stat.isFile()||(stat.mode&0o111)!==0)fail('MODE');files++;return{name,mode:'100644',object:gitObject('blob',readFileSync(path)),sort:Buffer.from(name)};}).sort((a,b)=>Buffer.compare(a.sort,b.sort));
  return gitObject('tree',Buffer.concat(entries.map(entry=>Buffer.concat([Buffer.from(entry.mode+' '+entry.name+'\0'),entry.object]))));
 }
 if(tree(join(root,'src')).toString('hex')!==nonunitOldReaderPins.sourceTree||files!==nonunitOldReaderPins.sourceFiles)fail('COMPLETE_SOURCE_TREE');
 if(hash(readFileSync(join(root,'package.json')))!==nonunitOldReaderPins.packageSha256||hash(readFileSync(join(root,'package-lock.json')))!==nonunitOldReaderPins.lockSha256||hash(readFileSync(new URL('../../package-lock.json',import.meta.url)))!==nonunitOldReaderPins.lockSha256)fail('LOCKED_PACKAGE');
 const guard=(globalThis as any)[Symbol.for('dnd.offlineCatalogFetch.v1')];if(!guard||globalThis.fetch!==guard.deny||guard.unexpected.length)fail('STARTUP_BOUNDARY');return root;
}
export async function loadNonunitOldReader(){
 const root=verifyNonunitOldReaderRoot(),scratch=mkdtempSync(join(tmpdir(),'nonunit-old-reader-')),input=join(scratch,'adapter.ts'),output=join(scratch,'adapter.mjs');
 writeFileSync(input,[`export {readCharacter} from ${JSON.stringify(join(root,'src/core/validation.ts'))};`,`export {exportCharacter} from ${JSON.stringify(join(root,'src/core/export.ts'))};`,`export {itemChargeOffers,itemChargeRequest,performItemChargeAction,assertItemChargeResourcesPreserved} from ${JSON.stringify(join(root,'src/core/automation/itemChargeDebits.ts'))};`].join('\n'),{mode:0o600,flag:'wx'});
 // Same documented Vitest compile context as source fixtures. No source/body,
 // identity, hash, rule, payment or assertion is rewritten by the bundler.
 const bundle=await rolldown({input,platform:'node',treeshake:true,transform:{define:{'import.meta.env.MODE':'"test"','import.meta.env.DEV':'false'}}});
 try{await bundle.write({file:output,format:'esm',codeSplitting:false});}finally{await bundle.close();}
 return import(/* @vite-ignore */ pathToFileURL(output).href);
}
