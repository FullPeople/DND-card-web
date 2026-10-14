import {cloudFeaturesEnabled,cloudDisabledError} from './availability';

/** Block every cloud API entry, including old links and saved login sessions. */
export function installCloudSuspension(target:Pick<typeof globalThis,'fetch'>,pageUrl:string){
 if(cloudFeaturesEnabled)return()=>{};
 const original=target.fetch,page=new URL(pageUrl);
 const guarded:typeof fetch=(input,init)=>{
  const value=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const url=new URL(value,page);
  if(url.pathname.startsWith('/api/')&&(url.origin===page.origin||url.origin==='https://dnd.center'))return Promise.reject(cloudDisabledError());
  return original.call(target,input,init);
 };
 target.fetch=guarded;
 return()=>{if(target.fetch===guarded)target.fetch=original;};
}
