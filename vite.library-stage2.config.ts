import {defineConfig,mergeConfig} from 'vite';
import base from './vite.library.config';
import {cloudStageTwoProfile} from './tools/cloudStageTwoProfile';
export default defineConfig(mergeConfig(base,{
 plugins:[cloudStageTwoProfile()],base:'/cloud-lab/library/',
 build:{outDir:'../.local-evidence/cloud-stage2/library',emptyOutDir:true},
}));
