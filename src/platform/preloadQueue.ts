export type PreloadTask={name:string;load:()=>Promise<unknown>};
export type PreloadResult={name:string;ok:boolean};
/** Download tools ahead of use without mounting hidden editors or monopolizing startup. */
export async function preloadModules(tasks:readonly PreloadTask[],report:(result:PreloadResult)=>void=()=>{},concurrency=2):Promise<void>{
 let cursor=0;
 const count=Math.max(1,Math.min(tasks.length,Math.floor(concurrency)||1));
 await Promise.all(Array.from({length:count},async()=>{
  while(cursor<tasks.length){const task=tasks[cursor++];let ok=true;
   try{await task.load();}catch{ok=false;}
   report({name:task.name,ok});
  }
 }));
}
