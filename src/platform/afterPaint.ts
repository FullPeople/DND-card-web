/** Let the browser paint the usable card before starting optional libraries. */
export function afterPaint(action:()=>void):()=>void {
 let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
 const frame=requestAnimationFrame(()=>{timer=setTimeout(()=>{if(!cancelled)action();},0);});
 return ()=>{cancelled=true;cancelAnimationFrame(frame);clearTimeout(timer);};
}

/** Optional code/data/cache downloads must not compete with logo decoding or
 * its compositor animation. A committed workspace is still covered until the
 * startup lifecycle finishes, so one animation frame alone is insufficient. */
export function afterStartupPaint(action:()=>void):()=>void {
 let cancelPaint:(()=>void)|undefined,cancelled=false;
 const start=()=>{if(cancelled||cancelPaint)return;window.removeEventListener('dnd-card-startup',observe);cancelPaint=afterPaint(action);};
 const settled=()=>['complete','failed'].includes(document.documentElement.dataset.cardStartup||'');
 const observe=()=>{if(settled())start();};
 if(!document.getElementById('startup-intro')||settled())start();
 else window.addEventListener('dnd-card-startup',observe);
 return ()=>{cancelled=true;window.removeEventListener('dnd-card-startup',observe);cancelPaint?.();};
}
