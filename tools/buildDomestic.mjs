import {spawnSync} from 'node:child_process';
// Reuse standalone module isolation while keeping this layout out of other deployments.
for(const args of [['node_modules/typescript/bin/tsc','-b'],['node_modules/vite/bin/vite.js','build','--mode','standalone']]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,VITE_DOMESTIC_COMPACT:'true'}});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
