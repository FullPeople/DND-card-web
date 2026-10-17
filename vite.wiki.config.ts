import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {standalonePlugin} from './tools/standalonePlugin.ts';

export default defineConfig({
  plugins:[standalonePlugin(),react(),{name:'wiki-first-paint',apply:'build',transformIndexHtml:{order:'post',handler(html){return html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g,tag=>tag.replace(/>$/,` media="print" data-wiki-style onload="this.media='all';window.dispatchEvent(new Event('dnd-wiki-style-ready'))">`));}}}],
  root:'wiki',publicDir:'../public',base:'./',
  build:{outDir:'../dist-wiki',emptyOutDir:true,target:['chrome109','edge109','firefox102','safari15.4']},
  server:{host:'127.0.0.1',port:5199,strictPort:true,fs:{allow:['..']}}
});
