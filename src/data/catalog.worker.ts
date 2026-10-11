import {normalizeCatalogData} from './catalog';
import {hashCatalogJson} from './catalogHash';
self.onmessage=async(event:MessageEvent)=>{
 const {id,body,revision,packId,operation,prepare}=event.data;
 try{const resolved=prepare?(revision||await hashCatalogJson(body)):revision;self.postMessage({id,revision:resolved,entries:normalizeCatalogData(body,resolved,packId,operation)});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
