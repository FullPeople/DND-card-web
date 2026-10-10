import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {mkdirSync,statfsSync} from 'node:fs';
import {isIP} from 'node:net';
import {dirname} from 'node:path';
import {CloudError,CloudStore} from './store';
import {createQQAuth,type QQConfig} from './qq';
import {parseFile} from '../../src/core/validation';
import {pluginAccess} from './plugin';
export {CloudStore} from './store';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const policy={freeSlots:10,qqLogin:'pending',publicDirectory:false};
export function canonicalIP(value:string){
  if(value.startsWith('::ffff:')&&isIP(value.slice(7))===4)value=value.slice(7);
  const family=isIP(value);if(!family)throw new CloudError(400,'client_ip','无法识别上传 IP，请稍后重试。');
  return family===6?new URL('http://['+value+']/').hostname.slice(1,-1):value;
}
export interface CloudServerOptions {temporaryUpload?:boolean;accountPrivate?:boolean;pluginOrigins?:string[];trustedLoopbackProxy?:boolean;freeBytes?:()=>number;qq?:QQConfig}
async function body(request:IncomingMessage):Promise<Record<string,unknown>> {
  if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']||''))throw new CloudError(415,'json_required','请求必须使用 JSON。');
  let size=0;const parts:Buffer[]=[];
  for await(const part of request){size+=part.length;if(size>20_100_000)throw new CloudError(413,'too_large','单次上传不能超过 20 MB。');parts.push(part);}
  try {const value=parseFile(Buffer.concat(parts).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value as Record<string,unknown>;}
  catch {throw new CloudError(400,'invalid_json','JSON 格式不正确或包含不允许的字段。');}
}
const equal=(a:string,b:string)=>{const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);};
export function createCloudServer(store:CloudStore,origin='https://dnd.center',options:CloudServerOptions={}){
  if(options.accountPrivate&&options.temporaryUpload)throw Error('Private account mode cannot enable temporary anonymous uploads');
  const qq=createQQAuth(store,origin,options.qq),qqLogin=qq.ready?'ready':'pending';
  const plugin=pluginAccess(store,origin,options.pluginOrigins);
  const currentPolicy={permissionsVersion:1,accountLibrariesPrivate:true,accountPrivate:options.accountPrivate===true,quotaScope:'account',temporaryUpload:false,...(options.temporaryUpload?{freeSlots:10,quotaScope:'ip',publicDirectory:true,temporaryUpload:true,unsafeStorage:true}:policy),qqLogin,qqOAuthSupported:true};
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
      plugin.cors(request,response);
      if(method==='OPTIONS'){response.writeHead(204);response.end();return;}
      if(await qq.handle(request,response,url))return;
      const token=request.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('dnd_cloud='))?.slice('dnd_cloud='.length);
      const session=request.headers.authorization?plugin.session(request):request.headers.origin&&request.headers.origin!==origin?undefined:store.session(token);
      const temporaryToken=request.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('dnd_temporary='))?.slice('dnd_temporary='.length);
      let temporaryOwner=store.temporarySession(temporaryToken);
      if(await plugin.handle(request,response,url,session,token,()=>body(request),(status,value)=>send(response,status,value)))return;
      const claim=/^\/api\/cards\/([A-Z]{6})\/claim$/.exec(url.pathname);
      if(claim&&method==='POST'){
        if(!session||!temporaryOwner||request.headers.origin!==origin||request.headers['x-csrf-token']!==session.csrf)throw new CloudError(403,'owner_only','请用原上传浏览器登录后迁移。');
        const data=await body(request);if(data.confirmClaim!==true)throw new CloudError(400,'confirmation_required','请确认迁移至当前账号。');
        return send(response,200,store.claimTemporary(claim[1],session.account,temporaryOwner,data.revision));
      }
      const clientIP=()=>{
        const socketIP=canonicalIP(request.socket.remoteAddress||'');
        if(options.trustedLoopbackProxy){
          if(socketIP!=='127.0.0.1'&&socketIP!=='::1')throw new CloudError(403,'proxy_required','请通过本站访问。');
          const header=request.headers['x-real-ip'];if(typeof header!=='string')throw new CloudError(400,'client_ip','缺少上传 IP。');return canonicalIP(header);
        }
        return socketIP;
      };
      if(method==='GET'&&(url.pathname==='/api/'||url.pathname==='/api/health'))return send(response,200,{ok:true,service:'dnd-card-cloud',version:'1.0.273',...currentPolicy});
      if(method==='GET'&&url.pathname==='/api/session'){
        if(options.temporaryUpload&&!session){
          if(!temporaryOwner){const issued=store.issueTemporarySession();temporaryOwner=issued.owner;response.setHeader('Set-Cookie','dnd_temporary='+issued.token+'; Path=/api/; '+(origin.startsWith('https:')?'Secure; ':'')+'HttpOnly; SameSite=Strict; Max-Age=31536000');}
          return send(response,200,{authenticated:false,qqLogin,temporaryUpload:true,uploadOwner:{id:temporaryOwner.id},csrf:temporaryOwner.csrf,slots:store.temporarySlots(clientIP())});
        }
        return send(response,200,{authenticated:!!session,qqLogin,libraryMode:'account',...(session?{account:{id:session.account.id,qq:session.account.qq,...store.qqProfile(session.account.id)},csrf:session.csrf,slots:store.slots(session.account)}:{})});
      }
      if(method==='GET'&&url.pathname==='/api/policy')return send(response,200,currentPolicy);
      const cardMatch=/^\/api\/cards\/([^/]+)(?:\/(editors)(?:\/([^/]+))?)?$/.exec(url.pathname);
      if(cardMatch&&!UUID.test(cardMatch[1])&&!/^[A-Z]{6}$/.test(cardMatch[1]))throw new CloudError(404,'not_found','没有找到这张云端角色卡。');
      if(method==='GET'&&cardMatch&&!cardMatch[2]){
        const card=store.read(cardMatch[1],session?.account,temporaryOwner);
        if((session||options.accountPrivate)&&store.isTemporaryCard(card.id)&&card.role!=='owner')throw new CloudError(404,'not_found','没有找到这张云端角色卡。');
        return send(response,200,card);
      }
      if(method==='GET'&&url.pathname==='/api/cards'&&session){const cards=store.list(session.account);return send(response,200,{cards,mine:cards,temporary:temporaryOwner?store.listTemporary(temporaryOwner):[],slots:store.slots(session.account),total:cards.length,hasMore:false});}
      if(method==='GET'&&url.pathname==='/api/cards'&&options.temporaryUpload&&!options.accountPrivate){
        const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||50);
        if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new CloudError(400,'pagination','分页参数无效。');
        return send(response,200,{...store.publicDirectory(offset,limit,session?.account,temporaryOwner),mine:[...(session?store.list(session.account):[]),...(temporaryOwner?store.listTemporary(temporaryOwner):[])],slots:session?store.slots(session.account):store.temporarySlots(clientIP())});
      }
      if(!['/api/cards','/api/logout','/api/slots'].includes(url.pathname)&&!cardMatch)throw new CloudError(404,'not_found','接口不存在。');
      if(!session&&!temporaryOwner)throw new CloudError(401,'login_required',qqLogin==='ready'?'请先使用 QQ 登录，再读取或保存自己的卡库。':'QQ 登录暂不可用，请保留本机角色备份。');
      if(method!=='GET'){
        if(request.headers.origin!==origin&&!request.headers.authorization)throw new CloudError(403,'origin','请在本站发起操作。');
        if(typeof request.headers['x-csrf-token']!=='string'||!equal(request.headers['x-csrf-token'],(session||temporaryOwner)!.csrf))throw new CloudError(403,'csrf','浏览器状态已改变，请刷新卡库后重试。本机草稿保留。');
      }
      if(temporaryOwner&&(options.temporaryUpload||cardMatch&&store.isTemporaryCard(cardMatch[1]))&&(!session||cardMatch&&store.isTemporaryCard(cardMatch[1]))){
        if(method==='GET'&&url.pathname==='/api/slots')return send(response,200,store.temporarySlots(clientIP()));
        if(cardMatch?.[2])throw new CloudError(503,'qq_pending','QQ 登录接入前，暂不开放编辑授权。');
        if(method==='POST'&&url.pathname==='/api/cards'||method==='PUT'&&cardMatch){
          const data=await body(request);
          if(data.confirmUpload!==true||data.confirmPublicTemporary!==true)throw new CloudError(400,'confirmation_required','必须明确确认：QQ 登录接入前，所有卡片不会安全保存，所有人都可以在云端看到所有卡。');
          if(options.freeBytes&&options.freeBytes()<128*1024*1024)throw new CloudError(507,'storage_full','服务器存储空间不足，请保留本机完整 JSON 备份。');
          return send(response,method==='POST'?201:200,method==='POST'?store.createTemporary(temporaryOwner,clientIP(),data.character):store.updateTemporary(cardMatch![1],temporaryOwner,data.revision,data.character));
        }
        if(method==='DELETE'&&cardMatch){store.deleteTemporary(cardMatch[1],temporaryOwner,(await body(request)).revision);return send(response,200,{ok:true});}
        throw new CloudError(405,'method','此接口不支持该操作。');
      }
      if(!session)throw new CloudError(401,'login_required','请刷新卡库。');
      if(url.pathname==='/api/cards'&&method==='GET')return send(response,200,{cards:store.list(session.account),slots:store.slots(session.account)});
      if(url.pathname==='/api/slots'&&method==='GET')return send(response,200,store.slots(session.account));
      if(url.pathname==='/api/logout'&&method==='POST'){store.logout(token!);response.setHeader('Set-Cookie','dnd_cloud=; Path=/api/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');return send(response,200,{ok:true});}
      if(url.pathname==='/api/cards'&&method==='POST'){const data=await body(request);if(data.confirmUpload!==true)throw new CloudError(400,'confirmation_required','需要明确确认上传完整角色卡。');if(options.freeBytes&&options.freeBytes()<128*1024*1024)throw new CloudError(507,'storage_full','服务器存储空间不足，请保留本机完整 JSON 备份。');return send(response,201,store.create(session.account,data.character));}
      if(cardMatch){const [,id,editors,qq]=cardMatch;
        if(!editors&&method==='PUT'){const data=await body(request);if(data.confirmUpload!==true)throw new CloudError(400,'confirmation_required','需要明确确认保存完整角色卡。');return send(response,200,store.update(id,session.account,data.revision,data.character));}
        if(!editors&&method==='DELETE'){const data=await body(request);store.delete(id,session.account,data.revision);return send(response,200,{ok:true});}
        if(editors&&!qq&&method==='POST'){const data=await body(request);return send(response,200,data.accountId?store.grantAccount(id,session.account,data.accountId):store.grant(id,session.account,data.qq));}
        if(editors&&qq&&method==='DELETE')return send(response,200,UUID.test(qq)?store.grantAccount(id,session.account,qq,true):store.grant(id,session.account,qq,true));
      }
      throw new CloudError(405,'method','此接口不支持该操作。');
    } catch(error){const failure=error instanceof CloudError?error:new CloudError(500,'internal','云端服务暂时无法完成操作。本机草稿保留。');if(!(error instanceof CloudError))console.error('Cloud request failed:',error instanceof Error?error.name:'unknown');if(!response.headersSent)send(response,failure.status,{error:failure.code,message:failure.message});else response.end();}
  });
  server.requestTimeout=30_000;server.headersTimeout=15_000;return server;
}

// OAuth uses only Tencent's verified response. No public mock-login route exists.
if(process.env.DND_CLOUD_RUN==='1'){
  if(process.env.MOCK||process.env.QQ_MOCK)throw Error('Mock authentication is forbidden');
  const [major,minor]=process.versions.node.split('.').map(Number);if(major<24||major===24&&minor<9)throw Error('Node >=24.9 required');
  const path=process.env.DND_CLOUD_DB;if(!path||!path.startsWith('/'))throw Error('DND_CLOUD_DB must be an absolute persistent path');mkdirSync(dirname(path),{recursive:true});
  const mode=process.env.DND_CLOUD_MODE||'pending';if(!['pending','temporary-ip','account-private'].includes(mode))throw Error('Unsupported cloud mode');
  const origin=process.env.DND_CLOUD_ORIGIN||'https://dnd.center';
  if(!!process.env.QQ_APPID!==!!process.env.QQ_APPKEY)throw Error('Incomplete QQ configuration');
  const store=new CloudStore(path),server=createCloudServer(store,origin,{temporaryUpload:mode==='temporary-ip',accountPrivate:mode==='account-private',trustedLoopbackProxy:true,qq:process.env.QQ_APPID?{appId:process.env.QQ_APPID,appKey:process.env.QQ_APPKEY!,callback:process.env.QQ_CALLBACK||origin+'/api/auth/qq/callback'}:undefined,freeBytes:()=>{const disk=statfsSync(dirname(path));return disk.bavail*disk.bsize;}});
  server.listen(Number(process.env.DND_CLOUD_PORT||5014),'127.0.0.1',()=>console.log('DND card cloud ready'));
  const stop=()=>server.close(()=>{store.close();process.exit(0);});process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
