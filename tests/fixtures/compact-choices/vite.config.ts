import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {standalonePlugin} from '../../../tools/standalonePlugin.ts';

// UI fixture server only. It issues no runtime-coverage or release certificate.
export default defineConfig({cacheDir:'.cache/compact-choices-vite',plugins:[standalonePlugin(),react(),{
  name:'ui-fixture-progress-unavailable',
  resolveId(id){if(id==='virtual:automation-progress')return '\0ui-fixture-progress-unavailable';},
  load(id){if(id==='\0ui-fixture-progress-unavailable')return `export const identity={sourceCommit:'',fingerprint:'',manifestSha256:'',mode:'ui-fixture'};export const manifestUrl='data:application/json,{}';`;},
}],server:{host:'127.0.0.1',port:5482,strictPort:true,watch:{ignored:['**/test-results*/**','**/evidence/**','**/.local-evidence/**']}}});
