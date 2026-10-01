/** App-shell caching is independent of rule-data snapshots and user documents. */
export async function registerOffline(onUpdate: (activate: () => void) => void): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    let rememberedWorker:ServiceWorker|undefined;
    const rememberedUrls=new Set<string>();
    const rememberUsed = (entries:PerformanceEntry[]=performance.getEntriesByType('resource')) => {
      const worker=registration.active;if(!worker)return;
      if(worker!==rememberedWorker){rememberedWorker=worker;rememberedUrls.clear();}
      const urls=entries.map(row=>row.name).filter(url=>!rememberedUrls.has(url));
      urls.forEach(url=>rememberedUrls.add(url));
      if(urls.length)worker.postMessage({type:'cache-used-assets',urls});
    };
    // A tool can start before activation and finish afterwards. Its request
    // never crossed the worker, and the activation snapshot did not contain it.
    try{new PerformanceObserver(list=>rememberUsed(list.getEntries())).observe({entryTypes:['resource']});}catch{/* Later controlled requests still cache through the worker. */}
    if(registration.active)rememberUsed();
    navigator.serviceWorker.addEventListener('controllerchange',()=>rememberUsed());
    const announce = () => { if (registration.waiting) onUpdate(() => registration.waiting?.postMessage('activate-update')); };
    if (registration.waiting) announce();
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) announce();
      if(worker.state==='activated')rememberUsed();
    }); });
  } catch (error) { console.warn('Offline app shell unavailable:', error); }
}
