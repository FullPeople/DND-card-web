/** App-shell caching is independent of rule-data snapshots and user documents. */
export async function registerOffline(onUpdate: (activate: () => void) => void): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    let rememberedWorker:ServiceWorker|undefined;
    const rememberUsed = () => {
      const worker=registration.active;if(!worker||worker===rememberedWorker)return;
      rememberedWorker=worker;worker.postMessage({type:'cache-used-assets',urls:performance.getEntriesByType('resource').map(row=>row.name)});
    };
    if(registration.active)rememberUsed();
    navigator.serviceWorker.addEventListener('controllerchange',rememberUsed);
    const announce = () => { if (registration.waiting) onUpdate(() => registration.waiting?.postMessage('activate-update')); };
    if (registration.waiting) announce();
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) announce();
      if(worker.state==='activated')rememberUsed();
    }); });
  } catch (error) { console.warn('Offline app shell unavailable:', error); }
}
