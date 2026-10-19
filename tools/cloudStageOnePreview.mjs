// Loopback-only synthetic accounts and a new disposable database; no QQ credentials.
import {createServer,request as proxy} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
const root=resolve(import.meta.dirname,'..'),out=join(root,'.local-evidence/cloud-stage1');
mkdirSync(out,{recursive:true});
await build({configFile:join(root,'vite.cloud.config.ts'),build:{outDir:join(out,'server'),emptyOutDir:true}});
await build({configFile:join(root,'vite.cloud-stage1.config.ts'),mode:'standalone'});
const {CloudStore,createCloudServer}=await import(pathToFileURL(join(out,'server/server.mjs')).href);
const store=new CloudStore(join(out,'trial-'+crypto.randomUUID()+'.sqlite'));
const owner=store.provisionVerifiedAccount('local-stage-one:owner','1234567');
store.saveQQProfile(owner.id,'本机测试账号','');
const issued=store.issueVerifiedSession(owner.id);
const now=new Date().toISOString();
const character={schemaVersion:1,id:crypto.randomUUID(),revision:1,name:'云端读写测试卡',player:'本机测试',edition:'2024',createdAt:now,updatedAt:now,abilities:{str:12,dex:12,con:12,int:12,wis:12,cha:12},baseHp:30,identity:{gender:'',alignment:'',age:'',description:''},selections:[],answers:{},reviewed:[],notes:'仅用于第一阶段本机读写。',profile:{enabledSources:['PHB','XPHB'],optional:{feats:true,multiclass:false,legacy:false},exceptions:{}},runtime:{hp:20,tempHp:2,inspiration:0,resources:{trial:{name:'测试药水',current:2,max:3}}}};
const seeded=store.create(owner,character),port=5361,apiPort=5362,origin='http://127.0.0.1:'+port;
const api=createCloudServer(store,origin,{featuresEnabled:true,accountPrivate:true});
await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(apiPort,'127.0.0.1',resolve);});
const requests=[];let mutations=0;const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const report=()=>({syntheticAccount:true,realQQ:false,publicChanged:false,seededCard:seeded.id,mutations,requests});
const save=()=>writeFileSync(join(out,'http-metrics.json'),JSON.stringify(report(),null,2));
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin);
  if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}
  if(url.pathname==='/__trial/start'&&req.method==='POST'){
   if(req.headers.origin!==origin){res.writeHead(403);res.end();return;}
   res.writeHead(303,{'Set-Cookie':`dnd_cloud=${issued.token}; Path=/api/; HttpOnly; SameSite=Strict`,'Location':'/card/?intro=0'});res.end();return;
  }
  if(url.pathname==='/__trial/metrics'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(report()));return;}
  if(url.pathname==='/'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   res.end('<!doctype html><meta charset="utf-8"><title>单机云端 · 第一阶段</title><style>body{max-width:660px;margin:10vh auto;padding:24px;font:17px/1.8 system-ui;background:#ededeb;color:#333}button{font:inherit;padding:10px 20px;background:#50525b;color:white;border:0}</style><h1>单机云端 · 第一阶段</h1><p>本机测试账号与独立数据库，不连接真实 QQ，不读取现有角色。</p><p>进入后，在“账号”中导入“云端读写测试卡”，修改数值后等待云端保存。刷新后可检查结果。</p><form method="POST" action="/__trial/start"><button>进入本机云端试验</button></form>');return;
  }
  if(url.pathname.startsWith('/api/')){
   const started=performance.now(),row={method:req.method,path:url.pathname,startedAt:Date.now(),status:0,ms:0};requests.push(row);
   const upstream=proxy('http://127.0.0.1:'+apiPort+req.url,{method:req.method,headers:req.headers},reply=>{
    row.status=reply.statusCode;res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);
    reply.on('end',()=>{row.ms=Math.round((performance.now()-started)*100)/100;if(['POST','PUT','DELETE'].includes(req.method)&&/\/api\/cards(?:\/|$)/.test(url.pathname)&&reply.statusCode<300)mutations++;save();});
   });upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
  }
  if(!url.pathname.startsWith('/card/')){res.writeHead(404);res.end();return;}
  const base=join(out,'site'),file=resolve(base,'.'+decodeURIComponent(url.pathname.slice('/card'.length))+(url.pathname.endsWith('/')?'index.html':''));
  if(relative(base,file).startsWith('..')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(readFileSync(file));
 }catch{res.writeHead(500);res.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
save();console.log('STAGE_ONE_PREVIEW '+origin+'/ (synthetic account; no public changes)');
const stop=()=>{save();server.closeAllConnections();server.close(()=>{api.closeAllConnections();api.close(()=>{store.close();process.exit(0);});});};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
