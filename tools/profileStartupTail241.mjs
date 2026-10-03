import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
// Never import an authenticated browser profile or storageState. Live Suite
// sampling deliberately omits the room hash; all cards/storage are new local
// fixtures and no scene, player, cloud document or deploy operation is invoked.
const out='.local-evidence/startup-tail241';mkdirSync(out,{recursive:true});
const preview=spawn(process.execPath,['tools/startupPreview.mjs','dist-standalone','5818'],{stdio:'pipe'});
await new Promise((resolve,reject)=>{preview.stdout.on('data',resolve);preview.on('error',reject);preview.on('exit',code=>reject(Error('preview exited '+code)));});
const baseline=process.env.STARTUP_BASELINE_DIR?spawn(process.execPath,['tools/startupPreview.mjs',process.env.STARTUP_BASELINE_DIR+'/dist-standalone','5819'],{stdio:'pipe'}):undefined;
if(baseline)await new Promise((resolve,reject)=>{baseline.stdout.on('data',resolve);baseline.on('error',reject);baseline.on('exit',code=>reject(Error('baseline preview exited '+code)));});
const browser=await chromium.launch({headless:true});const results=[];
const scenarios=[
 {name:'live-standalone-fresh-real',url:'https://obr.dnd.center/card/'},
 {name:'live-standalone-fresh-empty-fixture',url:'https://obr.dnd.center/card/',empty:true},
 {name:'live-standalone-saved-edit-real',url:'https://obr.dnd.center/card/',editing:true},
 {name:'live-suite-entry-fresh-real-no-room',url:'https://obr.dnd.center/suite-dev/workbench/'},
 {name:'local-241-64KiB-fresh-real',url:'http://127.0.0.1:5818/',slow:true},
 {name:'local-241-64KiB-fresh-empty-fixture',url:'http://127.0.0.1:5818/',slow:true,empty:true},
 {name:'local-241-64KiB-saved-edit-real',url:'http://127.0.0.1:5818/',slow:true,editing:true},
 ...(baseline?[{name:'local-230-64KiB-fresh-real',url:'http://127.0.0.1:5819/',slow:true},{name:'local-230-64KiB-fresh-empty-fixture',url:'http://127.0.0.1:5819/',slow:true,empty:true}]:[]),
];
try{for(const scenario of scenarios){
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:850}});const page=await context.newPage();const errors=[],requests=[],responses=[],pending=[];
 await context.addInitScript(({editing,empty})=>{
  const now=()=>performance.now(),events=[];window.__tailProfile={events,longTasks:[],initialEditing:localStorage.getItem('dnd-card:editing'),seededEditing:!!editing};
  const record=(name,detail)=>events.push({name,at:now(),detail});
  if(editing)localStorage.setItem('dnd-card:editing','true');
  for(const name of ['dnd-card-startup','dnd-card-stage','dnd-card-ready','dnd-card-failed','dnd-card-style-ready'])window.addEventListener(name,e=>record(name,e.detail));
  window.addEventListener('animationend',e=>{if(e.target?.classList.contains('startup-piece'))record('logo-layer-end',e.target.className);},true);
  const seen=new Set();new MutationObserver(()=>{for(const [name,selector] of [['app-mounted','.app-shell'],['paper-mounted','.paper'],['editor-enabled','.edit-mode-toggle:not([disabled])']]){if(!seen.has(name)&&document.querySelector(selector)){seen.add(name);record(name);}}}).observe(document,{subtree:true,childList:true,attributes:true});
  try{new PerformanceObserver(list=>window.__tailProfile.longTasks.push(...list.getEntries().map(x=>({at:x.startTime,duration:x.duration})))).observe({type:'longtask',buffered:true});}catch{}
  const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...args){record('idb-open-start',String(args[0]));const req=open.apply(this,args);req.addEventListener('success',()=>record('idb-open-end',String(args[0])));return req;};
  const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(key){const watch=this.name==='documents'&&key==='workspace';if(watch)record('workspace-read-start');const req=get.call(this,key);if(watch)req.addEventListener('success',()=>record('workspace-read-end',{exists:!!req.result,characters:req.result?.characters?.length||0}));return req;};
  if(empty){const original=fetch;window.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof Request?input.url:input.href,location.href);return ['5e.kiwee.top','homebrew.kiwee.top'].includes(u.hostname)?Promise.resolve(new Response('{}',{headers:{'content-type':'application/json'}})):original(input,init);};}
 },scenario);
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url().split('#')[0],type:r.resourceType(),at:Date.now()}));
 page.on('response',r=>{if(!['document','script','stylesheet'].includes(r.request().resourceType()))return;pending.push((async()=>{try{const bytes=await r.body();responses.push({url:r.url(),status:r.status(),type:r.request().resourceType(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),normalizedSha256:r.request().resourceType()==='document'?createHash('sha256').update(bytes.toString().replace(/\r\n/g,'\n')).digest('hex'):undefined,encoding:r.headers()['content-encoding'],cache:r.headers()['cache-control']});}catch{}})());});
 if(scenario.slow){const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:65536,uploadThroughput:655360});}
 const result={scenario,boundary:'Fresh isolated browser storage; live data unless explicitly empty fixture. Suite public entry has no real room connection.',errors,requests,responses};
 try{await page.goto(scenario.url,{waitUntil:'commit',timeout:90000});await page.waitForFunction(()=>['complete','failed'].includes(document.documentElement?.dataset.cardStartup)||(!document.getElementById('startup-intro')&&window.__tailProfile?.events.some(e=>e.name==='dnd-card-ready')),null,{timeout:90000});
  result.atCompletion=await page.evaluate(()=>({...window.__tailProfile,phase:document.documentElement.dataset.cardStartup||'legacy-ready',editingPreference:localStorage.getItem('dnd-card:editing'),navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,type:r.initiatorType,start:r.startTime,end:r.responseEnd,transfer:r.transferSize,encoded:r.encodedBodySize})),styles:Array.from(document.querySelectorAll('link[data-card-style]')).map(l=>({href:l.href,media:l.media,loaded:!!l.sheet}))}));
  await page.waitForTimeout(1000);result.afterOneSecond=await page.evaluate(()=>({events:window.__tailProfile.events,phase:document.documentElement.dataset.cardStartup||'legacy-ready',resources:performance.getEntriesByType('resource').map(r=>({url:r.name,type:r.initiatorType,start:r.startTime,end:r.responseEnd,transfer:r.transferSize,encoded:r.encodedBodySize})),notice:document.querySelector('.announcement-version')?.textContent}));
  await page.screenshot({path:`${out}/${scenario.name}.png`});
 }catch(e){result.error=String(e);try{result.failedState=await page.evaluate(()=>({profile:window.__tailProfile,phase:document.documentElement?.dataset.cardStartup,status:document.querySelector('#startup-message')?.textContent}));}catch{}}
 await Promise.race([Promise.allSettled(pending),new Promise(r=>setTimeout(r,5000))]);results.push(result);writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
 const events=result.atCompletion?.events||[],at=(name,detail)=>events.find(e=>e.name===name&&(detail===undefined||e.detail===detail))?.at,lastLogo=Math.max(...events.filter(e=>e.name==='logo-layer-end').map(e=>e.at),0);
 console.log(JSON.stringify({scenario:scenario.name,error:result.error,initialEditing:result.atCompletion?.initialEditing,playing:at('dnd-card-startup','playing'),lastLogo,waiting:at('dnd-card-startup','waiting'),ready:at('dnd-card-ready'),styles:at('dnd-card-style-ready'),fading:at('dnd-card-startup','fading'),complete:at('dnd-card-startup','complete'),tail:lastLogo?at('dnd-card-startup','fading')-lastLogo:undefined,errors}));
 await context.close();
}}finally{await browser.close();preview.kill();baseline?.kill();}
if(results.some(r=>r.error||!['complete','legacy-ready'].includes(r.atCompletion?.phase)))process.exitCode=1;
