import {createServer,request as proxy} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {CloudStore,createCloudServer} from '../dist-cloud-server/server.mjs';
const port=5320,origin='http://127.0.0.1:'+port,root=resolve('dist-cloud');
const folder=mkdtempSync(join(tmpdir(),'dnd-cloud-browser-')),store=new CloudStore(join(folder,'fixture.sqlite'));
const owner=store.provisionVerifiedAccount('local-fixture:owner','1234567'),editor=store.provisionVerifiedAccount('local-fixture:editor','2345678');
const ownerSession=store.issueVerifiedSession(owner.id),editorSession=store.issueVerifiedSession(editor.id);
const now=new Date().toISOString(),character={schemaVersion:1,id:crypto.randomUUID(),revision:1,name:'云端五页测试角色',player:'测试玩家',edition:'2024',createdAt:now,updatedAt:now,abilities:{str:14,dex:12,con:13,int:11,wis:10,cha:9},baseHp:20,identity:{gender:'',alignment:'中立',age:'25',description:'完整背景'},biography:{story:'云端五页故事'},selections:[],answers:{},reviewed:[],notes:'云端笔记',profile:{enabledSources:['PHB','XPHB'],optional:{feats:true,multiclass:false,legacy:false},exceptions:{}},runtime:{hp:17,tempHp:2,inspiration:0,resources:{custom:{current:2,max:9,name:'已消耗资源'}}},externalSnapshot:{unmapped:'原文保留'},automation:{protocol:2,rulesVersion:'equipment.1',defaultsVersion:1,enabled:false}};
const card=store.create(owner,character);store.grant(card.id,owner,editor.qq);
mkdirSync('evidence',{recursive:true});writeFileSync('evidence/cloud-fixture.json',JSON.stringify({owner,editor,ownerSession,editorSession,card}));
const api=createCloudServer(store,origin,{temporaryUpload:true});api.listen(5321,'127.0.0.1');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer((req,res)=>{
 const url=new URL(req.url,origin);
 if(url.pathname.startsWith('/api/')){const upstream=proxy('http://127.0.0.1:5321'+req.url,{method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;}
 const pathname=decodeURIComponent(url.pathname),file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+String.fromCharCode(92))&&!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
 if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':file.endsWith('sw.js')?'no-cache':'no-cache'});res.end(readFileSync(file));
});
server.listen(port,'127.0.0.1',()=>console.log('Isolated synthetic cloud preview '+origin));
const stop=()=>server.close(()=>api.close(()=>{store.close();process.exit(0);}));process.on('SIGTERM',stop);process.on('SIGINT',stop);
