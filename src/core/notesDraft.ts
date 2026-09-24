export type NotesDocument={revision:number;text:string};
export type NotesBackup={text:string;base:string};
export type NotesSnapshot={text:string;loaded:boolean;status:string;error:string;blocked:boolean};
type NotesIO={read:()=>Promise<NotesDocument>;write:(value:{text:string;expected:number})=>Promise<NotesDocument>};
type BackupIO={read:()=>NotesBackup|undefined;write:(value:NotesBackup)=>void};
const conflict='笔记在另一页面发生了变化。本地内容已保留。';

/** One controller owns the draft and its save chain across component mounts.
 * A late save advances only the base; it never replaces newer editor text. */
export function notesDraftController(io:NotesIO,backup:BackupIO,autosaveMs:number|null=450){
 let snapshot:NotesSnapshot={text:'',loaded:false,status:'',error:'',blocked:false},base='',revision=0,generation=0;
 let pendingText:string|undefined,saving:Promise<void>|undefined,reading:Promise<void>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const listeners=new Set<()=>void>();
 const publish=(patch:Partial<NotesSnapshot>)=>{snapshot={...snapshot,...patch};listeners.forEach(listener=>listener());};
 const persist=()=>{try{backup.write({text:snapshot.text,base});}catch(error){publish({error:'本地笔记备份未能保存：'+String(error)});}};
 const validate=(value:NotesDocument)=>{if(!value||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.text!=='string'||value.text.length>500000)throw Error('笔记响应无效');return value;};
 function confirmed(remote:NotesDocument,sent:string){revision=remote.revision;base=sent;pendingText=undefined;publish({status:snapshot.text===base?'已保存':'',error:'',blocked:false});persist();}
 function failed(error:unknown){publish({status:'',error:String(error),blocked:true});if(snapshot.loaded)persist();}
 function flush():Promise<void>{
  clearTimeout(timer);if(saving)return saving;if(reading||!snapshot.loaded||snapshot.blocked||snapshot.text===base)return Promise.resolve();
  saving=(async()=>{
   while(snapshot.loaded&&!snapshot.blocked&&snapshot.text!==base){
    const sent=snapshot.text;pendingText=sent;publish({status:'保存中',error:''});
    try{const value=validate(await io.write({text:sent,expected:revision}));if(value.text!==sent)throw Error('笔记保存回执内容不一致');confirmed(value,sent);}
    catch(error){
     // A failed response is not proof that the write failed. Read back before
     // allowing another write with the old revision.
     try{const remote=validate(await io.read());if(remote.text===sent||remote.text===snapshot.text){confirmed(remote,remote.text);continue;}failed(remote.text!==base?conflict:error);}
     catch{failed(error);}
     break;
    }
   }
  })().finally(()=>{saving=undefined;});return saving;
 }
 function change(text:string){if(text.length>500000)return;generation++;publish({text,status:''});persist();clearTimeout(timer);if(autosaveMs!==null)timer=setTimeout(()=>void flush(),autosaveMs);}
 function load():Promise<void>{
  if(snapshot.loaded)return snapshot.text===base&&!saving?retry():Promise.resolve();if(reading)return reading;publish({status:'读取中',error:''});
  reading=(async()=>{try{
   const remote=validate(await io.read());let draft:NotesBackup|undefined;try{draft=backup.read();}catch{}
   const dirty=draft&&typeof draft.text==='string'&&typeof draft.base==='string'&&draft.text!==draft.base?draft:undefined;
   revision=remote.revision;base=dirty?dirty.base:remote.text;
   if(dirty&&dirty.text!==remote.text){publish({text:dirty.text,loaded:true,status:'',blocked:dirty.base!==remote.text,error:dirty.base!==remote.text?conflict:''});}
   else{base=remote.text;publish({text:remote.text,loaded:true,status:'',error:'',blocked:false});}
   persist();
  }catch(error){failed(error);}})().finally(()=>{reading=undefined;if(snapshot.loaded&&!snapshot.blocked&&snapshot.text!==base)void flush();});return reading;
 }
 function retry():Promise<void>{
  if(!snapshot.loaded)return load();if(reading)return reading;clearTimeout(timer);
  reading=(async()=>{if(saving)await saving;publish({status:'核对中',error:''});try{
   const remote=validate(await io.read());
   if(snapshot.text===base&&pendingText===undefined){publish({text:remote.text});confirmed(remote,remote.text);return;}
   if(remote.text===snapshot.text||pendingText!==undefined&&remote.text===pendingText){confirmed(remote,remote.text);return;}
   if(remote.text!==base){failed(conflict);return;}
   revision=remote.revision;publish({status:'',blocked:false,error:''});
  }catch(error){failed(error);}})().finally(()=>{reading=undefined;});
  return reading.then(()=>flush());
 }
 function replaceFromRemote():Promise<void>{
  if(reading)return reading;clearTimeout(timer);const started=generation;
  reading=(async()=>{if(saving)await saving;publish({status:'读取中',error:''});try{
   const remote=validate(await io.read());
   if(generation!==started){failed('读取期间笔记有新编辑。本地内容已保留。');return;}
   base=remote.text;revision=remote.revision;pendingText=undefined;generation++;publish({text:remote.text,loaded:true,status:'',blocked:false,error:''});persist();
  }catch(error){failed(error);}})().finally(()=>{reading=undefined;});return reading;
 }
 return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);},change,load,flush,retry,replaceFromRemote};
}
