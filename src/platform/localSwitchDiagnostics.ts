const events:unknown[]=[];
export function switchDiagnostic(kind:string,detail:Record<string,unknown>={}){
 events.push({at:Math.round(performance.now()),kind,...detail});
 if(events.length>1000)events.shift();
 document.documentElement.dataset.switchDiagnostics=JSON.stringify(events);
}
let generation=0;
export function memoGeneration(){const id=++generation;switchDiagnostic('context',{id});return id;}
if(typeof PerformanceObserver!=='undefined')try{new PerformanceObserver(list=>{for(const row of list.getEntries())switchDiagnostic('longtask',{start:Math.round(row.startTime),ms:Math.round(row.duration)});}).observe({type:'longtask',buffered:true});}catch{}
