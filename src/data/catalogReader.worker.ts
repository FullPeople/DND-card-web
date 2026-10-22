import {loadCatalog} from './catalog';
import {catalogBatchBuffers,type CatalogReadRequest} from './catalogReaderProtocol';
const publish=self.postMessage.bind(self) as (message:unknown,transfer?:Transferable[])=>void;

let started=false,sequence=0,acknowledge:{sequence:number;resolve:()=>void}|undefined;
self.onmessage=async(event:MessageEvent<CatalogReadRequest|{type:'ack';sequence:number}>)=>{
 const request=event.data;
 if(request.type==='ack'){if(acknowledge?.sequence===request.sequence){const next=acknowledge;acknowledge=undefined;next.resolve();}return;}
 if(started||request.type!=='load')return;started=true;
 let delivery=Promise.resolve();
 const send=async(entries:Parameters<typeof catalogBatchBuffers>[0])=>{
  for(const buffer of catalogBatchBuffers(entries)){
   const id=++sequence;
   await new Promise<void>(resolve=>{acknowledge={sequence:id,resolve};publish({type:'batch',sequence:id,buffer},[buffer]);});
  }
 };
 try{
  await loadCatalog(entries=>{delivery=delivery.then(()=>send(entries));},value=>publish({type:'progress',value}),new AbortController().signal,request.refresh,request.base,value=>publish({type:'sources',value}),request.retryKeys);
  await delivery;publish({type:'done'});
 }catch(error){publish({type:'error',message:error instanceof Error?error.message:String(error)});}
};
