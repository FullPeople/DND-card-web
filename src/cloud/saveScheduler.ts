import type {Character} from '../core/model';

/** App owns immutable snapshots. Cache by object, never by ID or revision. */
export function snapshotHasher(hash:(character:Character)=>Promise<string>){
 const cache=new WeakMap<Character,Promise<string>>();
 return (character:Character)=>{
  let pending=cache.get(character);
  if(!pending){pending=hash(character).catch(error=>{cache.delete(character);throw error;});cache.set(character,pending);}
  return pending;
 };
}

/** Keep edits across a quick card switch; opening a book is not an edit. */
export function cloudSaveScheduler(sync:(id:string)=>Promise<void>,delay=650){
 let previous=new Map<string,Character>(),started=false,selected:string|undefined,enabled=false;
 let timer:ReturnType<typeof setTimeout>|undefined,running=false;
 const dirty=new Set<string>();
 const checked=new WeakSet<Character>();
 function schedule(){
  clearTimeout(timer);timer=undefined;
  if(!enabled||running||!dirty.size)return;
  timer=setTimeout(()=>{timer=undefined;void flush();},delay);
 }
 async function flush(){
  if(running||!enabled)return;
  running=true;
  try{
   const batch=[...dirty];
   for(const id of batch){
    if(!enabled)break;
    if(!dirty.delete(id)||!previous.has(id))continue;
    checked.add(previous.get(id)!);
    // The sync engine owns failure receipts and uncertain-write recovery.
    try{await sync(id);}catch{/* A later explicit retry rechecks the receipt. */}
   }
  }finally{running=false;schedule();}
 }
 return {
  observe(characters:Character[],activeId?:string){
   const next=new Map(characters.map(card=>[card.id,card]));
   if(!started){for(const card of characters)if(!activeId||card.id===activeId)dirty.add(card.id);started=true;}
   else for(const card of characters)if(previous.get(card.id)!==card)dirty.add(card.id);
   if(activeId&&activeId!==selected&&next.has(activeId)&&!checked.has(next.get(activeId)!))dirty.add(activeId);
   for(const id of dirty)if(!next.has(id))dirty.delete(id);
   previous=next;selected=activeId;schedule();
  },
  enable(value:boolean){enabled=value;schedule();},
 };
}
