import {defineConfig} from 'vite';
export default defineConfig({
 base:'/',cacheDir:'.cache/vite',publicDir:process.env.DND_HOME_PUBLIC||'public',
 worker:{format:'es'},
 server:{host:'127.0.0.1',port:5310,strictPort:true,proxy:{'/api':{target:'https://dnd.center',changeOrigin:true},'/card':{target:'https://dnd.center',changeOrigin:true}}},
 build:{outDir:'dist',emptyOutDir:true,copyPublicDir:false}
});
