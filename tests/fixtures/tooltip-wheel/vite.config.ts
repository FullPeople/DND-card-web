import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// This fixture mounts KeywordPreview directly and produces no release evidence.
export default defineConfig({cacheDir:'.cache/tooltip-wheel-vite',plugins:[react()],optimizeDeps:{entries:['tests/fixtures/tooltip-wheel/index.html']},server:{host:'127.0.0.1',port:5481,strictPort:true}});
