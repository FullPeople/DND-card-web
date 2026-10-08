import {openDB} from 'idb';
// Delete only bindings to the successfully deleted cloud card. Local characters,
// staged drafts and recovery documents remain untouched.
export async function forgetDeletedCloudCard(cloudId:string){
  const database=await openDB('dnd-card-standalone',1);
  try{
    const tx=database.transaction('documents','readwrite');
    for(const key of await tx.store.getAllKeys()){
      if(String(key).startsWith('cloud-binding:')&&(await tx.store.get(key))?.cloudId===cloudId){await tx.store.delete(key);await tx.store.delete('cloud-sync:'+String(key).slice(14));}
    }
    await tx.done;window.dispatchEvent(new Event('cloud-binding-changed'));
    if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('dnd-card-cloud');channel.postMessage(cloudId);channel.close();}
  }finally{database.close();}
}
