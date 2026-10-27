// Test-only Node startup preload. Do not retain, call, or restore native fetch.
const marker=Symbol.for('dnd.offlineCatalogFetch.v1');
if(Object.hasOwn(globalThis,marker)){
 const prior=globalThis[marker];
 if(prior?.version!==1||globalThis.fetch!==prior.deny)throw Error('Offline catalog preload boundary was changed.');
}else{
 const unexpected=[];
 const deny=async input=>{unexpected.push(String(input));throw Error('Offline catalog process blocks all external fetch requests.');};
 Object.defineProperty(globalThis,'fetch',{value:deny,writable:true,configurable:true});
 Object.defineProperty(globalThis,marker,{value:Object.freeze({version:1,deny,unexpected}),writable:false,configurable:false});
}
