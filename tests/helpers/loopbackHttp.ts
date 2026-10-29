import {Server,request} from 'node:http';

// Real HTTP fixtures use a separate, registered loopback transport. The rule
// process's startup fetch denial is never retained, replaced or relaxed.
const listeners=new Map<string,Server>();
export function registerLoopbackServer(server:Server){
 const address=server.address();
 if(!(server instanceof Server)||!server.listening||!address||typeof address==='string'||address.address!=='127.0.0.1')throw Error('A listening authored IPv4 loopback server is required');
 const origin=`http://127.0.0.1:${address.port}`;listeners.set(origin,server);
 server.once('close',()=>{if(listeners.get(origin)===server)listeners.delete(origin);});
 return origin;
}
export async function loopbackFetch(input:RequestInfo|URL,init:RequestInit={}):Promise<Response>{
 const source=input instanceof Request?input:undefined,url=new URL(source?.url??String(input));
 const server=listeners.get(url.origin);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||!server?.listening)throw Error('Only a registered authored loopback listener may be requested');
 const method=init.method||source?.method||'GET',headers=new Headers(init.headers||source?.headers);
 const value=init.body??(source?.body?await source.arrayBuffer():undefined);
 let body:Buffer|undefined;
 if(value!==undefined&&value!==null){
  if(typeof value==='string')body=Buffer.from(value);
  else if(value instanceof URLSearchParams)body=Buffer.from(value.toString());
  else if(value instanceof ArrayBuffer)body=Buffer.from(value);
  else if(ArrayBuffer.isView(value))body=Buffer.from(value.buffer,value.byteOffset,value.byteLength);
  else if(value instanceof Blob)body=Buffer.from(await value.arrayBuffer());
  else throw Error('Unsupported authored loopback request body');
  if(!headers.has('content-length'))headers.set('content-length',String(body.length));
 }
 const signal=init.signal||source?.signal;
 const response=await new Promise<Response>((resolve,reject)=>{
  const abort=()=>pending.destroy(new DOMException('Aborted','AbortError'));
  const pending=request(url,{method,headers:Object.fromEntries(headers),agent:false},incoming=>{
   const chunks:Buffer[]=[];let length=0;
   incoming.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>32*1024*1024)pending.destroy(Error('Authored loopback response exceeds its byte bound'));else chunks.push(chunk);});
   incoming.on('error',reject);
   incoming.on('end',()=>{
    signal?.removeEventListener('abort',abort);const received=new Headers();
    for(let i=0;i<incoming.rawHeaders.length;i+=2)received.append(incoming.rawHeaders[i],incoming.rawHeaders[i+1]);
    const status=incoming.statusCode||500,bytes=[204,205,304].includes(status)?null:new Uint8Array(Buffer.concat(chunks));
    const result=new Response(bytes,{status,headers:received,statusText:incoming.statusMessage});
    Object.defineProperty(result,'url',{value:url.href,configurable:true});resolve(result);
   });
  });
  pending.on('error',error=>{signal?.removeEventListener('abort',abort);reject(error);});
  if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  pending.end(body);
 });
 // OAuth fixtures explicitly request manual redirects. No fixture may follow
 // a server response onto the public network or another listener.
 if([301,302,303,307,308].includes(response.status)&&init.redirect!=='manual')throw Error('Authored loopback redirects require explicit manual handling');
 return response;
}
