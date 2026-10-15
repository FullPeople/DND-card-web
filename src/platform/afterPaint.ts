/** Start optional downloads only after the card is actually uncovered. */
export function afterPaint(action:()=>void):()=>void {
 let cancelled=false,scheduled=false,finished=false,frame:number|undefined,timer:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined,idle:number|undefined;
 const clear=()=>{window.removeEventListener('dnd-card-startup',schedule);if(frame!==undefined)cancelAnimationFrame(frame);clearTimeout(timer);clearTimeout(deadline);if(idle!==undefined)window.cancelIdleCallback(idle);};
 const run=()=>{if(cancelled||finished)return;finished=true;clear();if(document.documentElement.dataset.cardStartup!=='cancelled')action();};
 const schedule=()=>{
  if(cancelled||scheduled)return;
  const phase=document.documentElement.dataset.cardStartup;
  if(phase&&phase!=='complete'&&phase!=='failed')return;
  scheduled=true;window.removeEventListener('dnd-card-startup',schedule);
  // Hidden tabs may never receive a frame or idle callback. Once startup has
  // completed, a bounded fallback can prepare modules without mounting them.
  deadline=setTimeout(run,1500);
  frame=requestAnimationFrame(()=>{if(cancelled||finished)return;timer=setTimeout(()=>{if(cancelled||finished)return;if('requestIdleCallback' in window)idle=window.requestIdleCallback(run,{timeout:1000});else run();},120);});
 };
 window.addEventListener('dnd-card-startup',schedule);schedule();
 return ()=>{cancelled=true;clear();};
}
