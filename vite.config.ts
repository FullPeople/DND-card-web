import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
function offlineShell(): Plugin {
  return { name: 'offline-app-shell', apply: 'build', generateBundle(_, bundle) {
    const files = [...new Set(['index.html', ...Object.keys(bundle).filter(name => !name.endsWith('.map'))])];
    const revision = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const PREFIX = 'dnd-card-shell:' + new URL('./', self.location.href).pathname + ':';
const CACHE = PREFIX + ${JSON.stringify(revision)};
const FILES = ${JSON.stringify([...files, 'favicon.svg'])};
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
export default defineConfig({ plugins: [react(), offlineShell()], base: './', server: { port: 5178, strictPort: true } });
