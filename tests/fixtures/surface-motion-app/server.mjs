import {createServer} from 'node:http';
import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.SURFACE_MOTION_BUILD||'dist-standalone-cloud');
const expected=process.env.SURFACE_MOTION_SOURCE||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert(/^[a-f0-9]{40}$/.test(expected),'An exact formal build source SHA is required');
const profile=JSON.parse(await readFile(path.join(root,'cloud-profile.json'),'utf8'));
assert.equal(profile.cloudFeaturesEnabled,true);assert.equal(profile.accountLibrariesPrivate,true);assert.equal(profile.apiBase,'/api/');
const manifests=(await readdir(path.join(root,'assets'))).filter(file=>/^automation-progress-[^.]+\.json$/.test(file));
assert.equal(manifests.length,1);
const manifest=JSON.parse(await readFile(path.join(root,'assets',manifests[0]),'utf8'));
assert.equal(manifest.build.sourceCommit,expected,'Build must match its explicitly selected source');assert.equal(manifest.build.mode,'standalone');
const html=await readFile(path.join(root,'index.html'),'utf8');
const shellBuildId=html.match(/name="dnd-card-build" content="([a-f0-9]{12})"/)?.[1];assert(shellBuildId);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.wasm':'application/wasm'};
const counters={session:0,otherApi:0,write:0};
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5490');
 const respond=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Motion-Build':shellBuildId});res.end(req.method==='HEAD'?undefined:typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));};
 if(!['GET','HEAD'].includes(req.method)){counters.write++;respond(403,{error:'local_browser_test_no_writes'});return;}
 if(url.pathname==='/api/session'){counters.session++;respond(200,{authenticated:false,localBrowserTest:true});return;}
 if(url.pathname.startsWith('/api/')){counters.otherApi++;respond(403,{error:'local_browser_test_no_cloud_forwarding'});return;}
 if(url.pathname==='/__motion/status'){respond(200,{sourceCommit:manifest.build.sourceCommit,shellBuildId,profile,counters,cloudForwarding:false});return;}
 if(url.pathname==='/__motion/blank'){respond(200,'<!doctype html><meta charset="utf-8"><title>Disposable authored test</title>','text/html; charset=utf-8');return;}
 if(!url.pathname.startsWith('/card/')){respond(404,{error:'not_found'});return;}
 const file=path.resolve(root,decodeURIComponent(url.pathname.slice(6))||'index.html');
 if(!file.startsWith(root+path.sep)){respond(403,{error:'outside_build'});return;}
 try{if(!(await stat(file)).isFile())throw Error('not a file');respond(200,await readFile(file),types[path.extname(file)]||'application/octet-stream');}
 catch{respond(404,{error:'not_found'});}
}).listen(5490,'127.0.0.1',()=>console.log(`Actual formal cloud build ${expected} at 127.0.0.1:5490; no cloud forwarding`));
