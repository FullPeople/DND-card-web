import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
import {standalonePlugin} from './tools/standalonePlugin.ts';
function offlineShell(): Plugin {
  return { name: 'offline-app-shell', apply: 'build', generateBundle(_, bundle) {
    const files = [...new Set(['index.html', ...Object.keys(bundle).filter(name => !name.endsWith('.map'))])];
    const revision = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const PREFIX = 'dnd-card-shell:' + new URL('./', self.location.href).pathname + ':';
const CACHE = PREFIX + ${JSON.stringify(revision)};
const FILES = ${JSON.stringify([...files, 'favicon.svg', 'exe_icon.png'])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new URL(file, self.location.href).href)))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', event => { if (event.data === 'activate-update') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location.href).pathname)) return;
  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('index.html', self.location.href).href)))); return; }
  if (FILES.some(file => url.href === new URL(file, self.location.href).href)) event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreVary: true })) || fetch(event.request)));
});` });
  } };
}
export default defineConfig(({mode})=>({ plugins: [...(['standalone','automation-standalone'].includes(mode)?[standalonePlugin()]:[]),react(), offlineShell(),...(mode==='automation-standalone'?[{name:'automation-development',transformIndexHtml:(html:string)=>html.replace('DND 角色卡 · 单机版','DND 角色卡 · 自动化开发版')}]:[])], base: './', build:{target:['chrome109','edge109','firefox102','safari15.4'],outDir:mode==='automation-standalone'?'dist-automation':mode==='standalone'?'dist-standalone':'dist'},server: { watch:{ignored:['**/test-results*/**','**/evidence/**','**/.local-evidence/**']}, port: mode==='automation-standalone'?5190:5178, strictPort: true,host:'127.0.0.1' } }));
