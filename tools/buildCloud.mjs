import {spawnSync} from 'node:child_process';
import {mkdirSync,cpSync,copyFileSync} from 'node:fs';
for(const args of [
 ['node_modules/typescript/bin/tsc','-b'],
 ['node_modules/typescript/bin/tsc','-p','tsconfig.cloud.json'],
 ['node_modules/vite/bin/vite.js','build','--mode','standalone'],
 ['node_modules/vite/bin/vite.js','build','--config','vite.library.config.ts','--mode','cloud-library'],
 ['node_modules/vite/bin/vite.js','build','--config','vite.cloud.config.ts']
]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(result.error)throw result.error;if(result.status)process.exit(result.status);
}
mkdirSync('dist-cloud',{recursive:true});cpSync('dist-standalone','dist-cloud/card',{recursive:true});cpSync('dist-library','dist-cloud/library',{recursive:true});copyFileSync('public/cloud-home.html','dist-cloud/index.html');
