// Local-only public corpus delivery; real browser HTTP remains subject to CDP throttling.
import {createServer} from 'node:http';
import {createServer as createSecureServer} from 'node:https';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
const input=process.env.PERF_CORPUS_ROOT;if(!input)throw Error('PERF_CORPUS_ROOT must identify the verified public input cache');
const root=resolve(input),indexBytes=readFileSync(resolve(root,'index.json')),index=JSON.parse(indexBytes),files=new Map();
for(const [ordinal,row] of index.rows.entries()){
 const target=resolve(root,row.path);if(!target.startsWith(root+sep))throw Error('Input path leaves the public corpus cache');
 const body=Buffer.from(JSON.stringify(JSON.parse(readFileSync(target,'utf8'))));
 if(createHash('sha256').update(body).digest('hex')!==row.sha256)throw Error('Pinned source hash mismatch: '+row.url);
 files.set('/corpus/'+ordinal,{url:row.url,body,sha256:row.sha256});
}
const port=Number(process.env.PERF_SOURCE_PORT??0);if(!Number.isSafeInteger(port)||port<0||port>65535)throw Error('Invalid local corpus port');
const manifest={inputCount:files.size,indexSha256:createHash('sha256').update(indexBytes).digest('hex'),payloadBytes:[...files.values()].reduce((sum,row)=>sum+row.body.length,0),rows:[...files].map(([path,row])=>({path,url:row.url,sha256:row.sha256,bytes:row.body.length}))};
let served=0;
const handler=(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.end();return;}
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(path==='/harness'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Public corpus timing fixture</title>');return;}
 if(path==='/manifest'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(manifest));return;}
 const row=files.get(path);if(!row){res.writeHead(404);res.end();return;}
 served++;res.setHeader('Content-Type','application/json');res.setHeader('Content-Length',row.body.length);res.setHeader('ETag','"'+row.sha256+'"');res.end(row.body);
};
const tls=process.env.PERF_SOURCE_TLS_KEY&&process.env.PERF_SOURCE_TLS_CERT;
const server=tls?createSecureServer({key:readFileSync(process.env.PERF_SOURCE_TLS_KEY),cert:readFileSync(process.env.PERF_SOURCE_TLS_CERT)},handler):createServer(handler);
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({ready:true,port:server.address().port,tls:!!tls,inputCount:manifest.inputCount,indexSha256:manifest.indexSha256,payloadBytes:manifest.payloadBytes})));
const stop=()=>server.close(()=>{console.log(JSON.stringify({stopped:true,served}));process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
process.stdin.setEncoding('utf8');process.stdin.on('data',value=>{if(value.trim()==='stop')stop();});
