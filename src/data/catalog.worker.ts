import {normalizeCatalogData} from './catalog';
self.onmessage=(event:MessageEvent)=>{
 const {id,body,revision,packId,operation}=event.data;
 try{self.postMessage({id,entries:normalizeCatalogData(body,revision,packId,operation)});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
