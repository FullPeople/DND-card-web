import {spawnSync} from 'node:child_process';
// Compatibility command: domestic and downloadable standalone now share the same build.
for(const args of [['node_modules/typescript/bin/tsc','-b'],['node_modules/vite/bin/vite.js','build','--mode','standalone']]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
