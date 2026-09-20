/** App-shell caching is independent of rule-data snapshots and user documents. */
export async function registerOffline(onUpdate: (activate: () => void) => void): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    const announce = () => { if (registration.waiting) onUpdate(() => registration.waiting?.postMessage('activate-update')); };
    if (registration.waiting) announce();
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) announce();
    }); });
  } catch (error) { console.warn('Offline app shell unavailable:', error); }
}
