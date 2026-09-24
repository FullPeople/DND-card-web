import {notesDraftController,type NotesBackup} from '../core/notesDraft';
import {workbenchRequest} from './workbench';
const controllers=new Map<string,ReturnType<typeof notesDraftController>>();
function tabId(){try{let id=sessionStorage.getItem('full-suite-notes-tab');if(!id){id=crypto.randomUUID();sessionStorage.setItem('full-suite-notes-tab',id);}return id;}catch{return crypto.randomUUID();}}
const tab=tabId();
/** Session storage is authoritative for the tab. This also isolates duplicated
 * tabs, whose initial sessionStorage (including the tab ID) may be copied. */
export function getNotesController(){
 const session=new URLSearchParams(location.hash.slice(1)).get('suite')||'local',key='full-suite-notes:'+session;
 let controller=controllers.get(session);if(controller)return controller;
 const instance=crypto.randomUUID(),persistentKey=key+':'+tab;
 const rpc=(method:string,args:unknown[]=[])=>workbenchRequest('panelRpc',{panel:'notes',instance,method,args});
 const read=():NotesBackup|undefined=>{let value:string|null=null;try{value=sessionStorage.getItem(key);}catch{}if(!value)try{value=localStorage.getItem(persistentKey);}catch{}if(!value)return;try{return JSON.parse(value);}catch{return;}};
 const write=(value:NotesBackup)=>{const text=JSON.stringify(value);let stored=false,lastError:unknown;try{sessionStorage.setItem(key,text);stored=true;}catch(error){lastError=error;try{sessionStorage.removeItem(key);}catch{}}
  try{localStorage.setItem(persistentKey,text);stored=true;}catch(error){lastError=error;}if(!stored)throw lastError||Error('浏览器存储不可用');};
 controller=notesDraftController({read:()=>rpc('notes.read'),write:value=>rpc('notes.write',[value])},{read,write});controllers.set(session,controller);return controller;
}
