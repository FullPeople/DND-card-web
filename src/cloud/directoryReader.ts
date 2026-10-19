import {cloudCards as read,subscribeCloudSessionChanges,CloudRequestError} from './api';
import type {Directory} from './api';

// Share in-flight summaries, never stored results or authorization. Subscriptions
// exist only while a read is pending; account notifications reject stale reads.
export function directoryReader(reader:typeof read,subscribe:typeof subscribeCloudSessionChanges){
 const flights=new Map<string,Promise<Directory>>();let epoch=0,active=0,stop:(()=>void)|undefined;
 return function directory(offset=0,account?:string):Promise<Directory>{
  const key=JSON.stringify([epoch,offset,account]),old=flights.get(key);if(old)return old;
  if(!active++)stop=subscribe(()=>{epoch++;flights.clear();});const version=epoch;
  const task=reader(offset,account).then(rows=>{
   if(version!==epoch)throw new CloudRequestError(401,'account_changed','账号已改变，请重新读取当前账号的卡库。');
   return rows;
  }).finally(()=>{if(flights.get(key)===task)flights.delete(key);if(!--active){stop?.();stop=undefined;}});
  flights.set(key,task);return task;
 };
}
export const cloudDirectory=directoryReader(read,subscribeCloudSessionChanges);
