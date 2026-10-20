import {defineConfig,mergeConfig} from 'vite';
import base from './vite.config';
import {standaloneCloudProfile} from './tools/standaloneCloudProfile';
export default defineConfig(async env=>mergeConfig(await (typeof base==='function'?base({...env,mode:'standalone'}):base),{
 plugins:[standaloneCloudProfile()],base:'/card/',build:{outDir:'dist-standalone-cloud',emptyOutDir:true},
}));
