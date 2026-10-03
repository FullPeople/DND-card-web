import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {gzipSync} from 'node:zlib';
const root=resolve(process.argv[2]||'dist-standalone'),port=Number(process.argv[3]||5292),cache=new Map();
createServer((req,res)=>{
 // A normal loopback-origin parent keeps the iframe fixture same-origin.
 // Never disable Chromium local-network checks for an opaque about:blank host.
 if(process.env.DND_STARTUP_HTTP_CACHE==='1'&&req.url==='/__startup-benchmark-host.html'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-cache'});res.end('<!doctype html><html><head><title>Startup benchmark host</title></head><body></body></html>');return;}
 const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!path.startsWith(root+sep)&&path!==root){res.writeHead(403);res.end();return;}
 const file=path===root?resolve(root,'index.html'):existsSync(path)&&statSync(path).isDirectory()?resolve(path,'index.html'):path;
 if(!existsSync(file)){res.writeHead(404);res.end();return;}
 const type={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.PNG':'image/png','.webp':'image/webp'}[extname(file)]||'application/octet-stream';
 const compress=/javascript|text\/|json|svg/.test(type)&&/gzip/.test(req.headers['accept-encoding']||'');
 const key=file+compress;let bytes=cache.get(key);if(!bytes){bytes=readFileSync(file);if(compress)bytes=gzipSync(bytes);cache.set(key,bytes);}
 res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':process.env.DND_STARTUP_HTTP_CACHE==='1'&&/\.(js|css|webp)$/.test(file)?'public, max-age=3600':'no-cache',...(compress?{'Content-Encoding':'gzip','Vary':'Accept-Encoding'}:{})});res.end(bytes);
}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/ ${root}`));
