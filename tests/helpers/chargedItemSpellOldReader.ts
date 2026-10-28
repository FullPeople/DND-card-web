import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {rolldown} from 'rolldown';
import {verifyNonunitOldReaderRoot} from './nonunitItemChargeOldReader';

export const verifyChargedItemSpellOldReaderRoot=verifyNonunitOldReaderRoot;
let loaded:Promise<any>|undefined,scratch:string|undefined;
/** Actual immutable 406 code, not a simulated legacy payment implementation.
 * Complete Git tree/package/lock proof is shared with the preceding family. */
export function loadChargedItemSpellOldReader():Promise<any>{
 if(loaded)return loaded;
 loaded=(async()=>{
  const root=verifyNonunitOldReaderRoot();scratch=mkdtempSync(join(tmpdir(),'charged-item-old-reader-'));
  const input=join(scratch,'adapter.ts'),output=join(scratch,'adapter.mjs');
  writeFileSync(input,[
   `export {readCharacter} from ${JSON.stringify(join(root,'src/core/validation.ts'))};`,
   `export {exportCharacter} from ${JSON.stringify(join(root,'src/core/export.ts'))};`,
   `export {spellPayments,spellActionRequest,performSpellAction} from ${JSON.stringify(join(root,'src/core/automation/actions.ts'))};`,
   `export {sourceSpellEnabled} from ${JSON.stringify(join(root,'src/core/automation/sourceSpellState.ts'))};`
  ].join('\n'),{mode:0o600,flag:'wx'});
  const bundle=await rolldown({input,platform:'node',treeshake:true,transform:{define:{'import.meta.env.MODE':'"test"','import.meta.env.DEV':'false'}}});
  try{await bundle.write({file:output,format:'esm',codeSplitting:false});}finally{await bundle.close();}
  verifyNonunitOldReaderRoot();return import(/* @vite-ignore */ pathToFileURL(output).href);
 })();return loaded;
}
export function disposeChargedItemSpellOldReader(){
 try{verifyNonunitOldReaderRoot();}finally{if(scratch)rmSync(scratch,{recursive:true,force:true});}
}
