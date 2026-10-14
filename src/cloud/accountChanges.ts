import {announceCloudSessionChange,cloudChangeNotice,subscribeCloudSessionChanges} from './api';
import {cloudFeaturesEnabled} from './availability';
import {watchCloudChanges} from './changeWatch';

type RecordEntry={callbacks:Set<()=>Promise<void>>;stop:()=>void};
const records=new Map<string,RecordEntry>();
/** One account wait per page, shared by the book, library and QQ picker. */
export function subscribeAccountChanges(account:string,changed:()=>Promise<void>){
 if(!cloudFeaturesEnabled)return()=>{};
 let alive=true;const callback=()=>alive?changed():Promise.resolve();
 let record=records.get(account);
 if(!record){
  const callbacks=new Set<()=>Promise<void>>([callback]);
  const watcher=watchCloudChanges({scope:()=>account,account:()=>account,active:()=>document.visibilityState==='visible'&&navigator.onLine,request:cloudChangeNotice,changed:async()=>{await Promise.all([...callbacks].map(run=>run()));},failed:error=>{if((error as {status?:number}).status===401)announceCloudSessionChange();}});
  const wake=()=>watcher.wake(),stopSession=subscribeCloudSessionChanges(wake);
  window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
  record={callbacks,stop(){watcher.stop();stopSession();window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);}};records.set(account,record);
 }else record.callbacks.add(callback);
 const held=record;
 return()=>{alive=false;held.callbacks.delete(callback);if(!held.callbacks.size){held.stop();if(records.get(account)===held)records.delete(account);}};
}
