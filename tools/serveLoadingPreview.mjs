import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {gzipSync} from 'node:zlib';
const root=process.cwd(),port=Number(process.env.PORT||5320);
const home=resolve(process.env.DND_HOME_ROOT||'site/homepage');
const mounts=[...(process.env.DND_BASELINE_CARD_ROOT?[['/baseline-card/',resolve(process.env.DND_BASELINE_CARD_ROOT)]]:[]),['/card/',resolve(root,'dist-standalone')],['/wiki/',resolve(root,'dist-wiki')],['/',resolve(home,'dist')]];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4','.wasm':'application/wasm','.woff2':'font/woff2','.wav':'audio/wav'};
const compressed=new Map();
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  if(url.pathname==='/api/home/projects'){
   const response=await fetch('https://dnd.center/api/home/projects',{signal:AbortSignal.timeout(5000)});
   res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  let [prefix,folder]=mounts.find(([prefix])=>url.pathname.startsWith(prefix));
  let pathname=decodeURIComponent(url.pathname.slice(prefix.length));
  if(url.pathname.startsWith('/scene/')&&process.env.DND_HOME_PUBLIC){folder=resolve(process.env.DND_HOME_PUBLIC);pathname=decodeURIComponent(url.pathname.slice(1));}
  let path=resolve(folder,pathname||'index.html');
  if(path!==folder&&!path.startsWith(folder+sep)){res.writeHead(403);res.end();return;}
  if(existsSync(path)&&statSync(path).isDirectory())path=resolve(path,'index.html');
  if(!existsSync(path)&&prefix==='/'&&process.env.DND_HOME_PUBLIC){const assets=resolve(process.env.DND_HOME_PUBLIC),candidate=resolve(assets,pathname);if(candidate.startsWith(assets+sep)&&existsSync(candidate)&&statSync(candidate).isFile())path=candidate;}
  if(!existsSync(path)){res.writeHead(404);res.end('Not found');return;}
  let content=readFileSync(path);const extension=extname(path).toLowerCase();
  if(extension==='.html')content=Buffer.from(content.toString('utf8').replaceAll('https://dnd.center/card/','/card/').replaceAll('https://dnd.center/wiki/','/wiki/'));
  const headers={'Content-Type':types[extension]||'application/octet-stream','Cache-Control':extension==='.html'?'no-cache':/\/assets\//.test(url.pathname)?'public, max-age=31536000, immutable':'no-cache','Vary':'Accept-Encoding'};
  const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
  if(range){const start=Number(range[1]),end=Math.min(content.length-1,range[2]?Number(range[2]):content.length-1);if(start>end){res.writeHead(416);res.end();return;}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${content.length}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});res.end(req.method==='HEAD'?undefined:content.subarray(start,end+1));return;}
  let body=content;
  if(/gzip/.test(req.headers['accept-encoding']||'')&&['.html','.css','.js','.json','.svg','.wasm'].includes(extension)){
   const signature=path+':'+statSync(path).mtimeMs;
   if(!compressed.has(signature))compressed.set(signature,gzipSync(content));body=compressed.get(signature);headers['Content-Encoding']='gzip';
  }
  res.writeHead(200,{...headers,'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});res.end('本地预览未能读取这个资源。');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}/`));
