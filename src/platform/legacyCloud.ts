export const LEGACY_CLOUD_CHANNEL='full-suite-card-cloud/v1';
export function legacyCloudRequest(method:string,args?:unknown):Promise<any>{
 if(parent===window)return Promise.reject(Error('此操作需要在枭熊角色卡面板中进行。'));
 return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();
  const finish=(error?:string,value?:unknown)=>{clearTimeout(timer);window.removeEventListener('message',receive);if(error)reject(Error(error));else resolve(value);};
  const receive=(event:MessageEvent)=>{if(event.source!==parent||event.origin!==location.origin||event.data?.channel!==LEGACY_CLOUD_CHANNEL||event.data.requestId!==requestId)return;finish(event.data.error,event.data.result);};
  const timer=setTimeout(()=>finish('房间操作未能及时确认，请重新读取后核对。'),35000);window.addEventListener('message',receive);parent.postMessage({channel:LEGACY_CLOUD_CHANNEL,requestId,method,args},location.origin);
 });
}
