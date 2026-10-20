import {defineConfig,mergeConfig} from 'vite';
import base from './vite.library.config';
import {standaloneCloudProfile} from './tools/standaloneCloudProfile';
export default defineConfig(mergeConfig(base,{
 plugins:[standaloneCloudProfile()],base:'/library/',build:{outDir:'../dist-library-cloud',emptyOutDir:true},
}));
