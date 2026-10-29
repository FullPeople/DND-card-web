import {expect,it} from 'vitest';
import {createServer} from 'node:http';
import {loopbackFetch,registerLoopbackServer} from './helpers/loopbackHttp';

it('keeps real HTTP bytes, cookies and status while leaving startup fetch protection unchanged',async()=>{
 const guard=(globalThis as any)[Symbol.for('dnd.offlineCatalogFetch.v1')],original=globalThis.fetch,unexpected=guard?.unexpected.length;
 const server=createServer((req,res)=>{const chunks:Buffer[]=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{res.writeHead(201,{'content-type':'application/json','set-cookie':['one=1; HttpOnly','two=2; HttpOnly']});res.end(JSON.stringify({method:req.method,body:Buffer.concat(chunks).toString('utf8'),csrf:req.headers['x-csrf-token']}));});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port,url=`http://127.0.0.1:${port}/authored`;
 try{
  await expect(loopbackFetch(url)).rejects.toThrow('registered');registerLoopbackServer(server);
  const response=await loopbackFetch(url,{method:'POST',headers:{'X-CSRF-Token':'authored-token'},body:'中文 sentinel'});
  expect(response.status).toBe(201);expect(await response.json()).toEqual({method:'POST',body:'中文 sentinel',csrf:'authored-token'});expect(response.headers.getSetCookie()).toHaveLength(2);expect(globalThis.fetch).toBe(original);if(guard)expect(guard.unexpected.length).toBe(unexpected);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
 await expect(loopbackFetch(url)).rejects.toThrow('registered');
});
it('rejects public, credential-bearing and unregistered destinations before sending requests',async()=>{
 for(const url of ['https://example.invalid/','http://127.0.0.1:1/','http://user:password@127.0.0.1:1/','https://127.0.0.1:1/'])await expect(loopbackFetch(url)).rejects.toThrow('registered');
});
