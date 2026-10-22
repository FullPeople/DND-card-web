import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({cacheDir:process.env.CATALOG_PROGRESS_CACHE||'.cache/catalog-progress-vite',plugins:[react()],optimizeDeps:{entries:['tests/fixtures/catalog-progress/index.html']},server:{host:'127.0.0.1',port:Number(process.env.CATALOG_PROGRESS_PORT||5492),strictPort:true}});
