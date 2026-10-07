import {spawnSync} from 'node:child_process';
import {mkdirSync,cpSync,copyFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
for(const args of [
 ['node_modules/typescript/bin/tsc','-b'],
 ['node_modules/typescript/bin/tsc','-p','tsconfig.cloud.json'],
 ['node_modules/vite/bin/vite.js','build','--mode','standalone'],
 ['node_modules/vite/bin/vite.js','build','--config','vite.library.config.ts','--mode','cloud-library'],
 ['node_modules/vite/bin/vite.js','build','--config','vite.cloud.config.ts']
]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(result.error)throw result.error;if(result.status)process.exit(result.status);
}
const output=resolve('dist-cloud');
if(output!==join(process.cwd(),'dist-cloud'))throw new Error('Unexpected cloud build output');
rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});cpSync('dist-standalone',join(output,'card'),{recursive:true});cpSync('dist-library',join(output,'library'),{recursive:true});copyFileSync('public/cloud-home.html',join(output,'index.html'));
