import {defineConfig,mergeConfig} from 'vite';
import base from './vite.config';
import {cloudStageTwoProfile} from './tools/cloudStageTwoProfile';
export default defineConfig(async env=>mergeConfig(await (typeof base==='function'?base({...env,mode:'standalone'}):base),{
 plugins:[cloudStageTwoProfile()],base:'/cloud-lab/card/',
 build:{outDir:'.local-evidence/cloud-stage2/card',emptyOutDir:true},
}));
