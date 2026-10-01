/** Let the browser paint the usable card before starting optional libraries. */
export function afterPaint(action:()=>void):()=>void {
 let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
 const frame=requestAnimationFrame(()=>{timer=setTimeout(()=>{if(!cancelled)action();},0);});
 return ()=>{cancelled=true;cancelAnimationFrame(frame);clearTimeout(timer);};
}
