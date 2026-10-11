/** App-shell caching is independent of rule-data snapshots and user documents. */
export async function registerOffline(onUpdate: (activate: () => void) => void): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    // Embedded or controlled browsers can suppress registration. Do not leave
    // an asynchronous download observer behind without an available worker.
    if(!registration)return;
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
    // The page's HTML may already be the build the waiting worker installs:
    // navigation races the network past the old worker, so the visible page
    // is current while the worker behind it is not. Activating silently then
    // avoids a prompt whose "update" would change nothing visible.
    const ownBuild=()=>typeof document==='undefined'?'':document.querySelector('meta[name="dnd-card-build"]')?.getAttribute('content')||'';
    const revisionOf=(worker:ServiceWorker)=>new Promise<string>(resolve=>{let done=false;const finish=(value:string)=>{if(!done){done=true;resolve(value);}};
      try{const channel=new MessageChannel();channel.port1.onmessage=event=>finish(typeof event.data==='string'?event.data:'');worker.postMessage({type:'shell-revision'},[channel.port2]);}catch{finish('');}
      setTimeout(()=>finish(''),1500);});
    let announcing:ServiceWorker|undefined;
    const announce = async () => { const worker=registration.waiting;if(!worker||announcing===worker)return;announcing=worker;
      const own=ownBuild();if(own&&(await revisionOf(worker)).endsWith(':'+own)){if(registration.waiting===worker)worker.postMessage('activate-update');return;}
      if(registration.waiting===worker)onUpdate(() => registration.waiting?.postMessage('activate-update')); };
    if (registration.waiting) void announce();
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) void announce();
      if(worker.state==='activated')rememberUsed();
    }); });
  } catch (error) { console.warn('Offline app shell unavailable:', error); }
}
