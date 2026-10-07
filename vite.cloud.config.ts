import {defineConfig} from 'vite';
export default defineConfig({publicDir:false,build:{ssr:'server/cloud/server.ts',outDir:'dist-cloud-server',target:'node24',minify:false,rolldownOptions:{output:{entryFileNames:'server.mjs'}}}});
