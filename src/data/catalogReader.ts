import type {Entry} from '../core/model';
import type {SourceMeta} from '../core/sourceCatalog';
import type {LoadProgress} from './catalog';
import {DEFAULT_SOURCE} from './catalogSource';
import {decodeCatalogBatch,type CatalogReadRequest,type CatalogReadResponse} from './catalogReaderProtocol';

type Callbacks={batch:(entries:Entry[])=>void;progress:(value:LoadProgress)=>void;sources?:(value:Record<string,SourceMeta>)=>void};

/** A catalog worker owns optional cache I/O only. It never receives a character,
 * account session, cloud operation or permission to save a workspace. */
export function readCatalogInWorker(worker:Worker,request:CatalogReadRequest,callbacks:Callbacks,signal:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>{
  let finished=false,sequence=0,awaitingAck=false,timer:ReturnType<typeof setTimeout>|undefined;
  const finish=(error?:unknown)=>{if(finished)return;finished=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();error?reject(error):resolve();};
  const abort=()=>finish(signal.reason||new DOMException('Catalog loading aborted','AbortError'));
  worker.onmessage=(event:MessageEvent<CatalogReadResponse>)=>{
   if(finished)return;
   try{
    const message=event.data;
    if(message.type==='batch'){
     if(awaitingAck||message.sequence!==sequence+1)throw Error('Catalog batch order changed');
     callbacks.batch(decodeCatalogBatch(message.buffer));sequence=message.sequence;awaitingAck=true;
     // Let pending user input run before requesting another batch. Only one
     // batch can be in flight, including when the page is temporarily busy.
     const delivered=sequence;timer=setTimeout(()=>{if(!finished){awaitingAck=false;worker.postMessage({type:'ack',sequence:delivered});}},0);
    }else if(message.type==='progress')callbacks.progress(message.value);
    else if(message.type==='sources')callbacks.sources?.(message.value);
    else if(message.type==='done'){if(awaitingAck)throw Error('Catalog completed before delivery acknowledgement');finish();}
    else if(message.type==='error')finish(Error(message.message));
    else throw Error('Unknown catalog worker message');
   }catch(error){finish(error);}
  };
  worker.onerror=event=>{event.preventDefault?.();finish(Error('Catalog background reader unavailable'));};
  worker.onmessageerror=()=>finish(Error('Catalog background message unavailable'));
  if(signal.aborted){abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  try{worker.postMessage(request);}catch(error){finish(error);}
 });
}

export async function loadCatalog(onBatch:Callbacks['batch'],onProgress:Callbacks['progress'],signal:AbortSignal,refresh=false,base=DEFAULT_SOURCE,onSources?:Callbacks['sources'],retryKeys:readonly string[]=[]):Promise<void>{
 if(signal.aborted)return;
 try{
  const worker=new Worker(new URL('./catalogReader.worker.ts',import.meta.url),{type:'module'});
  await readCatalogInWorker(worker,{type:'load',refresh,base,retryKeys},{batch:onBatch,progress:onProgress,sources:onSources},signal);return;
 }catch(error){if(signal.aborted)throw error;}
 // Browsers or policies that deny workers retain the original reader and its
 // existing retry/cache rules. Optional cache failure still cannot lose data.
 return (await import('./catalog')).loadCatalog(onBatch,onProgress,signal,refresh,base,onSources,retryKeys);
}
