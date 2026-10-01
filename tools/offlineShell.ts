import type {Plugin} from 'vite';
import {createHash} from 'node:crypto';
export function offlineShell(): Plugin {
  return { name: 'offline-app-shell', apply: 'build', generateBundle:{order:'post',handler(_, bundle) {
    const assets = Object.keys(bundle).filter(name => !name.endsWith('.map'));
    const first = new Set<string>(['index.html','favicon.svg']);
    const visit = (name:string) => {
      if(first.has(name))return;
      const chunk=bundle[name];if(!chunk)return;first.add(name);
      if(chunk.type==='chunk'){
        chunk.imports.forEach(visit);
        for(const css of (chunk as typeof chunk&{viteMetadata?:{importedCss:Set<string>}}).viteMetadata?.importedCss??[])first.add(css);
      }
    };
    for(const chunk of Object.values(bundle))if(chunk.type==='chunk'&&(chunk.isEntry||/\/ui\/(App|PlayerViewer)\.tsx$/.test(chunk.facadeModuleId?.replaceAll('\\','/')||'')))visit(chunk.fileName);
    const files=[...first];
    const html=bundle['index.html'];
    const revision = createHash('sha256').update('on-demand-shell-v4:'+JSON.stringify(assets)).update(html?.type==='asset'?html.source:'').digest('hex').slice(0, 12);
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const PREFIX = 'dnd-card-shell:' + new URL('./', self.location.href).pathname + ':';
const CACHE = PREFIX + ${JSON.stringify(revision)};
const FILES = ${JSON.stringify(files)};
const ASSETS = new Set(${JSON.stringify([...assets,'favicon.svg','exe_icon.png'])}.map(file=>new URL(file,self.location.href).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new URL(file, self.location.href).href)))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', event => {
  if (event.data === 'activate-update') self.skipWaiting();
  if(event.data?.type==='cache-used-assets'&&Array.isArray(event.data.urls))event.waitUntil(caches.open(CACHE).then(async cache=>{
    // First-visit tools may finish before this worker takes control. Backfill
    // those used files only, and never cache documents or arbitrary URLs.
    for(const url of new Set(event.data.urls.filter(url=>ASSETS.has(url)))){
      if(await cache.match(url,{ignoreVary:true}))continue;
      try{const response=await fetch(url);if(response.ok)await cache.put(url,response);}catch{}
    }
  }));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location.href).pathname)) return;
  if (event.request.mode === 'navigate') {
    const network = fetch(event.request);
    event.waitUntil(network.then(() => {}, () => {}));
    event.respondWith(caches.open(CACHE).then(async cache => {
      const saved = await cache.match(new URL('index.html', self.location.href).href);
      if (!saved) return network;
      let timer;
      try { return await Promise.race([network.then(response => response.ok ? response : saved, () => saved), new Promise(resolve => { timer = setTimeout(() => resolve(saved), 1500); })]); }
      finally { clearTimeout(timer); }
    })); return;
  }
  if (ASSETS.has(url.href)) {
    // Cache a deferred tool when it is actually requested; installation must
    // not download every editor, dictionary and Wiki renderer in parallel.
    const response=caches.open(CACHE).then(async cache => {
      const saved=await cache.match(event.request,{ignoreVary:true});if(saved)return saved;
      const fresh=await fetch(event.request);if(fresh.ok)await cache.put(event.request,fresh.clone());return fresh;
    });
    event.respondWith(response);event.waitUntil(response.then(()=>{},()=>{}));
  }
});` });
  } } };
}
