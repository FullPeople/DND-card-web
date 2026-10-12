import {normalizeCatalogData} from './catalog';
import {hashCatalogJson} from './catalogHash';
self.onmessage=async(event:MessageEvent)=>{
 const {id,body,revision,packId,operation,prepare,chunked}=event.data;
 try{const resolved=prepare?(revision||await hashCatalogJson(body)):revision,entries=normalizeCatalogData(body,resolved,packId,operation);
  if(!chunked){self.postMessage({id,revision:resolved,entries});return;}
  // Bounded messages avoid deserializing an entire large rulebook in one UI task.
  for(let offset=0;offset<entries.length;offset+=64){self.postMessage({id,chunk:true,entries:entries.slice(offset,offset+64)});await new Promise<void>(resolve=>setTimeout(resolve,0));}
  self.postMessage({id,revision:resolved,entries:[]});
 }
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
