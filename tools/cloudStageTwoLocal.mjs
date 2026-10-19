// Synthetic browser verification only. This file is never included in the lab.
import {createServer,request as proxy} from 'node:http';
import {readFileSync,writeFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,join,relative,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..'),out=join(root,'.local-evidence/cloud-stage2');mkdirSync(out,{recursive:true});
const {CloudStore,createCloudServer}=await import(pathToFileURL(join(out,'server/server.mjs')));
const store=new CloudStore(join(out,'local-'+crypto.randomUUID()+'.sqlite'));
const origin='http://127.0.0.1:5363',accounts=['甲','乙'].map(label=>{
 const account=store.provisionVerifiedAccount('stage-two-local:'+label);store.saveQQProfile(account.id,'测试'+label,'');
 for(let i=0;i<12;i++){
  const now=new Date().toISOString(),character={schemaVersion:1,id:crypto.randomUUID(),revision:1,name:`测试${label}角色${i+1}`,player:'本机测试',edition:'2024',createdAt:now,updatedAt:now,abilities:{str:12,dex:12,con:12,int:12,wis:12,cha:12},baseHp:30,identity:{gender:'',alignment:'',age:'',description:''},selections:[],answers:{},reviewed:[],notes:'独立测试内容。'.repeat(30000),profile:{enabledSources:['PHB','XPHB'],optional:{feats:true,multiclass:false,legacy:false},exceptions:{}},runtime:{hp:20,tempHp:2,inspiration:0,resources:{trial:{name:'测试药水',current:2,max:3}}}};
  if(i<10)store.create(account,character);
 }
 return store.issueVerifiedSession(account.id);
});
const api=createCloudServer(store,origin,{featuresEnabled:true,accountPrivate:true,qq:{appId:'123456789',appKey:'local-only-never-used',callback:origin+'/api/auth/qq/callback?cloud_lab=stage2',isolation:'stage2'}});
await new Promise(resolve=>api.listen(5364,'127.0.0.1',resolve));
const metrics=[],save=()=>writeFileSync(join(out,'local-http.json'),JSON.stringify({synthetic:true,realQQ:false,requests:metrics},null,2));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
 const url=new URL(req.url,origin);if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}
 if(url.pathname==='/__trial/enter'&&req.method==='POST'&&req.headers.origin===origin){
  const account=url.searchParams.get('account')==='b'?accounts[1]:accounts[0];res.writeHead(303,{'Set-Cookie':`dnd_cloud_lab2=${account.token}; Path=/cloud-lab/api/; HttpOnly; SameSite=Strict`,Location:'/cloud-lab/library/'});res.end();return;
 }
 if(url.pathname==='/__trial/metrics'){save();res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(metrics));return;}
 if(url.pathname==='/'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<meta charset="utf-8"><h1>独立卡库本机验证</h1><form method="post" action="/__trial/enter?account=a"><button>进入测试甲</button></form><form method="post" action="/__trial/enter?account=b"><button>进入测试乙</button></form>');return;
 }
 if(url.pathname.startsWith('/cloud-lab/api/')){
  const path='/api/'+url.pathname.slice('/cloud-lab/api/'.length)+url.search,start=performance.now(),row={method:req.method,path:url.pathname,status:0,ms:0};metrics.push(row);
  const upstream=proxy('http://127.0.0.1:5364'+path,{method:req.method,headers:req.headers},reply=>{row.status=reply.statusCode;res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);reply.on('end',()=>{row.ms=performance.now()-start;save();});});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
 }
 const part=/^\/cloud-lab\/(card|library)\/(.*)$/.exec(url.pathname);
 if(part){const base=join(out,part[1]),file=resolve(base,part[2]||'index.html');if(!relative(base,file).startsWith('..')&&existsSync(file)&&statSync(file).isFile()){res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(readFileSync(file));return;}}
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(5363,'127.0.0.1',resolve));save();console.log('STAGE_TWO_LOCAL http://127.0.0.1:5363/ (synthetic accounts only)');
const stop=()=>{save();server.closeAllConnections();server.close(()=>{api.closeAllConnections();api.close(()=>{store.close();process.exit(0);});});};process.on('SIGTERM',stop);process.on('SIGINT',stop);
