import {openDB,type IDBPDatabase} from 'idb';

export const workspaceRecoveryKey='storage-recovery-required';
const stores=['documents','cache'] as const;
type Options={closed?:()=>void;blockedMs?:number};

// Every opener owns the same schema. A receipt read must never create an empty
// version-1 database before the workspace's initializer gets there.
function open(name:string,version:number|undefined,options:Options){
 let database:IDBPDatabase|undefined,timer:ReturnType<typeof setTimeout>|undefined,abandoned=false;
 return new Promise<IDBPDatabase>((resolve,reject)=>{
  const pending=openDB(name,version,{
   upgrade(db,oldVersion,_next,tx){
    const lostDocuments=oldVersion>0&&!db.objectStoreNames.contains('documents');
    for(const store of stores)if(!db.objectStoreNames.contains(store))db.createObjectStore(store);
    // Adding a missing store cannot recover its old contents. Require an
    // explicit backup restore instead of silently creating a new character.
    if(lostDocuments)void tx.objectStore('documents').put({fromVersion:oldVersion},workspaceRecoveryKey).catch(()=>{});
   },
   blocked(){timer??=setTimeout(()=>{abandoned=true;reject(Error('其他角色卡标签正在占用本机存储。请先备份并关闭其他标签，再重试；已有记录未覆盖。'));},options.blockedMs??5000);},
   blocking(){database?.close();options.closed?.();},
   terminated(){options.closed?.();},
  });
  pending.then(value=>{clearTimeout(timer);database=value;if(abandoned)value.close();else resolve(value);},error=>{clearTimeout(timer);reject(error);});
 });
}

/** Add missing stores only; never delete, clear or replace any existing store. */
export async function openWorkspaceDatabase(name:string,options:Options={}):Promise<IDBPDatabase>{
 for(let attempt=0;attempt<3;attempt++){
  const database=await open(name,undefined,options);
  if(stores.every(store=>database.objectStoreNames.contains(store)))return database;
  const version=database.version+1;database.close();
  try{return await open(name,version,options);}
  catch(error){if((error as {name?:string}).name!=='VersionError'||attempt===2)throw error;}
 }
 throw Error('本机存储暂时无法连接，请重试；已有记录未覆盖。');
}

/** A failed or superseded connection is retryable, rather than cached forever. */
export function workspaceConnection(name:string){
 let current:Promise<IDBPDatabase>|undefined;
 return()=>{
  if(!current){
   const pending=openWorkspaceDatabase(name,{closed:()=>{if(current===pending)current=undefined;}});
   current=pending;void pending.catch(()=>{if(current===pending)current=undefined;});
  }
  return current;
 };
}
