import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
import {enableStandaloneCloud} from './tools/standaloneCloudProfile.ts';

const root=resolve(import.meta.dirname,'switch-lab');
export default defineConfig({
 root,base:'/card-switch-lab/',publicDir:false,
 plugins:[{
  name:'isolated-switch-lab-read-views',enforce:'pre',
  // Match the formal standalone view caches; the page CSP forbids all API
  // connections, and no App/cloud providers or storage adapters are mounted.
  transform(code,id){
   const path=id.replaceAll('\\','/').split('?')[0];
   if(path.endsWith('/src/cloud/availability.ts'))return enableStandaloneCloud(code);
   if(path.endsWith('/src/ui/sheetDisplay.ts'))return {code:"export * from '"+resolve(root,'sheetDisplay.ts').replaceAll('\\','/')+"';",map:null};
  },
 },react()],
 build:{outDir:resolve(import.meta.dirname,'dist-switch-lab'),emptyOutDir:true,target:['chrome109','edge109','firefox102','safari15.4']},
 server:{host:'127.0.0.1',port:5484,strictPort:true,fs:{allow:[resolve(root,'..')]},watch:{ignored:['**/.local-evidence/**','**/test-results*/**']}},
 preview:{host:'127.0.0.1',port:5484,strictPort:true},
});
