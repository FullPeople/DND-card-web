import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,base:'./',server:{host:'127.0.0.1',port:5189,strictPort:true,cors:{origin:[/^https:\/\/(www\.)?owlbear\.rodeo$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]}},build:{outDir:'../dist-sync-prototype',emptyOutDir:true,rollupOptions:{input:{panel:root+'index.html',background:root+'background.html',card:root+'card.html',demo:root+'demo.html'}}}});
