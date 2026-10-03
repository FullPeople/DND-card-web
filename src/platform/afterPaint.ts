/** Start optional downloads only after the card is actually uncovered. */
export function afterPaint(action:()=>void):()=>void {
 let cancelled=false,scheduled=false,frame:number|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const schedule=()=>{
  if(cancelled||scheduled)return;
  const phase=document.documentElement.dataset.cardStartup;
  if(phase&&phase!=='complete'&&phase!=='failed')return;
  scheduled=true;window.removeEventListener('dnd-card-startup',schedule);
  frame=requestAnimationFrame(()=>{timer=setTimeout(()=>{if(!cancelled)action();},0);});
 };
 window.addEventListener('dnd-card-startup',schedule);schedule();
 return ()=>{cancelled=true;window.removeEventListener('dnd-card-startup',schedule);if(frame!==undefined)cancelAnimationFrame(frame);clearTimeout(timer);};
}
