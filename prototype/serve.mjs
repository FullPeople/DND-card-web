// Static-file preview only. Character updates never pass through this server.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./site/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 const origin=req.headers.origin||'';
 if(/^https:\/\/(www\.)?owlbear\.rodeo$/.test(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');}
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405);res.end();return;}
 try{const pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname),file=resolve(root,'.'+(pathname==='/'?'/demo.html':pathname));
  if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.writeHead(200);res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'5189 端口已被使用；如果已启动原型，直接打开下面的地址。':error);console.error('http://127.0.0.1:5189/demo.html');process.exitCode=1;});
server.listen(5189,'127.0.0.1',()=>console.log('原型已启动。\n模拟台：http://127.0.0.1:5189/demo.html\n枭熊安装：http://127.0.0.1:5189/manifest.json\n请保留本窗口；Ctrl+C 关闭。'));
