import {spawnSync} from 'node:child_process';
import {cpSync,lstatSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkStandaloneCloudBuild} from './checkStandaloneCloudBuild.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(resolve(process.cwd())!==root)throw Error('Run the production frontend build from the checkout root');
for(const args of [
 ['node_modules/typescript/bin/tsc','-b'],
 ['node_modules/vite/bin/vite.js','build','--config','vite.standalone-cloud.config.ts','--mode','standalone'],
 ['node_modules/vite/bin/vite.js','build','--config','vite.library-cloud.config.ts','--mode','standalone'],
]){
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
checkStandaloneCloudBuild({root});
const output=resolve(root,'dist-cloud');
if(dirname(output)!==root||output!==join(root,'dist-cloud')||(existsSync(output)&&lstatSync(output).isSymbolicLink()))throw Error('Unsafe production staging directory');
rmSync(output,{recursive:true,force:true});
mkdirSync(output);
cpSync(join(root,'dist-standalone-cloud'),join(output,'card'),{recursive:true});
cpSync(join(root,'dist-library-cloud'),join(output,'library'),{recursive:true});
console.log(JSON.stringify(checkStandaloneCloudBuild({root,staged:true})));
