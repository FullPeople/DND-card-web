import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {CloudError,CloudStore} from './store';
import {parseFile} from '../../src/core/validation';
export {CloudStore} from './store';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const policy={freeSlots:10,permanentSlotPriceYuan:2,paymentAvailable:false,qqLogin:'pending',publicDirectory:false};
async function body(request:IncomingMessage):Promise<Record<string,unknown>> {
  if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']||''))throw new CloudError(415,'json_required','请求必须使用 JSON。');
  let size=0;const parts:Buffer[]=[];
  for await(const part of request){size+=part.length;if(size>20_100_000)throw new CloudError(413,'too_large','单次上传不能超过 20 MB。');parts.push(part);}
  try {const value=parseFile(Buffer.concat(parts).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value as Record<string,unknown>;}
  catch {throw new CloudError(400,'invalid_json','JSON 格式不正确或包含不允许的字段。');}
}
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function createCloudServer(store:CloudStore,origin='https://dnd.center'){
  const limits=new Map<string,{at:number;count:number}>();
  const send=(response:ServerResponse,status:number,value:unknown)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'});response.end(JSON.stringify(value));};
  const server=createServer(async(request,response)=>{
    try {
      const key=request.socket.remoteAddress||'unknown',now=Date.now();
      // Requests arrive through the loopback proxy. Global bounded rate guard
      // complements nginx's per-IP request limits without trusting XFF headers.
      let counter=limits.get(key);if(!counter||now-counter.at>60_000){counter={at:now,count:0};limits.set(key,counter);}if(++counter.count>3000)throw new CloudError(429,'rate_limit','请求过于频繁，请稍后再试。');
      if(limits.size>10000)for(const [ip,row] of limits)if(now-row.at>60_000)limits.delete(ip);
      const url=new URL(request.url||'/',origin),method=request.method||'GET';
      const token=request.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('dnd_cloud='))?.slice('dnd_cloud='.length);
      const session=store.session(token);
      if(method==='GET'&&(url.pathname==='/api/'||url.pathname==='/api/health'))return send(response,200,{ok:true,service:'dnd-card-cloud',version:'1.0.252',...policy});
      if(method==='GET'&&url.pathname==='/api/session')return send(response,200,{authenticated:!!session,qqLogin:'pending',...(session?{account:{id:session.account.id,qq:session.account.qq},csrf:session.csrf,slots:store.slots(session.account)}:{})});
      if(method==='GET'&&url.pathname==='/api/policy')return send(response,200,policy);
      if(url.pathname==='/api/auth/qq/login')throw new CloudError(503,'qq_pending','QQ 登录申请中，云端登录和保存暂不可用。在线车卡、本机保存及 JSON 导入导出可正常使用。');
      const cardMatch=/^\/api\/cards\/([^/]+)(?:\/(editors)(?:\/([^/]+))?)?$/.exec(url.pathname);
      if(cardMatch&&!UUID.test(cardMatch[1]))throw new CloudError(404,'not_found','没有找到这张云端角色卡。');
      if(method==='GET'&&cardMatch&&!cardMatch[2])return send(response,200,store.read(cardMatch[1],session?.account));
      if(!['/api/cards','/api/logout','/api/slots'].includes(url.pathname)&&!cardMatch)throw new CloudError(404,'not_found','接口不存在。');
      if(!session)throw new CloudError(401,'login_required','QQ 登录申请中，云端登录和保存暂不可用。');
      if(method!=='GET'){
        if(request.headers.origin!==origin)throw new CloudError(403,'origin','请在本站发起操作。');
        if(typeof request.headers['x-csrf-token']!=='string'||!equal(request.headers['x-csrf-token'],session.csrf))throw new CloudError(403,'csrf','登录状态已改变，请刷新卡库后重试。');
      }
      if(url.pathname==='/api/cards'&&method==='GET')return send(response,200,{cards:store.list(session.account),slots:store.slots(session.account)});
      if(url.pathname==='/api/slots'&&method==='GET')return send(response,200,store.slots(session.account));
      if(url.pathname==='/api/logout'&&method==='POST'){store.logout(token!);response.setHeader('Set-Cookie','dnd_cloud=; Path=/api/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');return send(response,200,{ok:true});}
      if(url.pathname==='/api/cards'&&method==='POST'){const data=await body(request);if(data.confirmUpload!==true)throw new CloudError(400,'confirmation_required','需要明确确认上传完整角色卡。');return send(response,201,store.create(session.account,data.character));}
      if(cardMatch){const [,id,editors,qq]=cardMatch;
        if(!editors&&method==='PUT'){const data=await body(request);if(data.confirmUpload!==true)throw new CloudError(400,'confirmation_required','需要明确确认保存完整角色卡。');return send(response,200,store.update(id,session.account,data.revision,data.character));}
        if(!editors&&method==='DELETE'){const data=await body(request);store.delete(id,session.account,data.revision);return send(response,200,{ok:true});}
        if(editors&&!qq&&method==='POST')return send(response,200,store.grant(id,session.account,(await body(request)).qq));
        if(editors&&qq&&method==='DELETE')return send(response,200,store.grant(id,session.account,qq,true));
      }
      throw new CloudError(405,'method','此接口不支持该操作。');
    } catch(error){const failure=error instanceof CloudError?error:new CloudError(500,'internal','云端服务暂时无法完成操作。本机草稿保留。');if(!(error instanceof CloudError))console.error('Cloud request failed:',error instanceof Error?error.name:'unknown');if(!response.headersSent)send(response,failure.status,{error:failure.code,message:failure.message});else response.end();}
  });
  server.requestTimeout=30_000;server.headersTimeout=15_000;return server;
}

// This service deliberately has no OAuth callback or public mock-login route.
if(process.env.DND_CLOUD_RUN==='1'){
  if(process.env.MOCK||process.env.QQ_MOCK||process.env.AUTH_MODE&&process.env.AUTH_MODE!=='pending')throw Error('Only pending QQ authentication is supported in this release');
  const [major,minor]=process.versions.node.split('.').map(Number);if(major<24||major===24&&minor<9)throw Error('Node >=24.9 required');
  const path=process.env.DND_CLOUD_DB;if(!path||!path.startsWith('/'))throw Error('DND_CLOUD_DB must be an absolute persistent path');mkdirSync(dirname(path),{recursive:true});
  const store=new CloudStore(path),server=createCloudServer(store,process.env.DND_CLOUD_ORIGIN||'https://dnd.center');
  server.listen(Number(process.env.DND_CLOUD_PORT||5014),'127.0.0.1',()=>console.log('DND card cloud ready; QQ authentication pending'));
  const stop=()=>server.close(()=>{store.close();process.exit(0);});process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
