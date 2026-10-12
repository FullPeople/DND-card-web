import {test,expect,type Page,type Locator,type CDPSession} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {mockSource,suppressAnnouncement} from './fixtures';
import {performanceCards} from './performanceScenario';

type Sample={operation:string;iteration:number;phase:'first'|'warm';catalogLoading:boolean;inputDelayMs:number|null;feedbackMs:number|null;readyMs:number|null;longTasks:{at:number;duration:number}[];error?:string};
const samples:Sample[]=[],count=Number(process.env.PERF_SAMPLES||30),profile=process.env.PERF_PROFILE||'normal';
const output=resolve(process.env.PERF_TIMING_FILE||'../evidence/interaction-timing-current.json');
const corpusRoot=process.env.PERF_CORPUS_ROOT;
const corpusOrigin=process.env.PERF_SOURCE_ORIGIN;
const profileInteractions=process.env.PERF_PROFILE_PHASE==='interactions';
const networkProfiles:Record<string,{latencyMs:number;downloadBitsPerSecond:number}>={standard150:{latencyMs:150,downloadBitsPerSecond:10000000},network150:{latencyMs:150,downloadBitsPerSecond:1000000},network300:{latencyMs:300,downloadBitsPerSecond:1000000}};
let corpusProof:{files:number;fulfilledFiles:number;indexSha256:string;unmatchedRequests:string[]}|undefined;
let startup:unknown,testFailure:string|undefined;
let cardScenario:unknown={count:1,mixture:'default empty card'};
let cloudScenario:{activeUploaded:boolean;setupCompletedMs?:number;boundary:string}={activeUploaded:false,boundary:'Synthetic fixture account; no real QQ authentication'};
let profiler:CDPSession|undefined;
let tracer:CDPSession|undefined;
let browserVersion='unknown';
async function stopTrace(){
 if(!tracer)return;const session=tracer;tracer=undefined;
 const complete=new Promise<{stream:string}>((resolve,reject)=>session.once('Tracing.tracingComplete',event=>event.stream?resolve({stream:event.stream}):reject(Error('Timeline stream was not returned'))));await session.send('Tracing.end');const {stream}=await complete;
 const destination=output+'.trace.json';mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(destination,'');let size=0;
 try{for(;;){const chunk=await session.send('IO.read',{handle:stream,size:1048576}),data=chunk.base64Encoded?Buffer.from(chunk.data,'base64'):Buffer.from(chunk.data);size+=data.length;if(size>100*1024*1024)throw Error('Timeline exceeds the per-run evidence budget');(await import('node:fs')).appendFileSync(destination,data);if(chunk.eof)break;}}
 finally{await session.send('IO.close',{handle:stream});await session.detach();}
}
async function stopProfiler(){if(!profiler)return;const session=profiler;profiler=undefined;const {profile}=await session.send('Profiler.stop'),bytes=JSON.stringify(profile);if(Buffer.byteLength(bytes)>100*1024*1024)throw Error('CPU evidence exceeds the per-run evidence budget');mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output+'.cpuprofile',bytes);}
function save(){
 const operations=[...new Set(samples.map(s=>s.operation))].map(operation=>{
  const rows=samples.filter(s=>s.operation===operation),warm=rows.filter(s=>s.phase==='warm'),values=warm.filter(s=>!s.error&&s.readyMs!==null).map(s=>s.readyMs!).sort((a,b)=>a-b);
  return {operation,samples:rows.length,failures:rows.filter(s=>s.error).length,first:rows.find(s=>s.phase==='first'),warmSamples:warm.length,warmReadyP95Ms:values.length?values[Math.ceil(values.length*.95)-1]:null,warmReadyMaxMs:values.at(-1)??null};
 });
 mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({at:new Date().toISOString(),profile,startup,testFailure,conditions:{browser:'isolated '+(process.env.PERF_BROWSER||(process.env.CI?'chromium':'chrome')),browserVersion,viewport:[1440,960],source:corpusRoot?'verified existing public corpus snapshot':'authored tiny fixture',corpusProof,cardScenario,cloudScenario,extendedControls:process.env.PERF_EXTENDED_CONTROLS==='1',accounts:'isolated synthetic fixture',network:networkProfiles[profile]||'loopback',sourceTransport:corpusOrigin?'verified public corpus over local HTTPS, subject to calibrated CDP throttling':'local fulfilled responses; source latency is not emulated by CDP',cpuRate:profile==='cpu4'?4:1,interactWhileLoading:process.env.PERF_INTERACT_EARLY==='1',captureCPU:process.env.PERF_CAPTURE_CPU==='1',captureTimeline:process.env.PERF_CAPTURE_TIMELINE==='1',buildRoot:process.env.CLOUD_PREVIEW_ROOT||'dist-cloud',contendingProcesses:process.env.PERF_CONTENTION||'unspecified',samplesRequested:count},boundary:'Software measurement only. Trusted pointer-down creation to DOM readiness plus two animation frames, including input dispatch delay; falls back to click timestamp if no pointer-down occurred. Excludes automation transport/actionability waiting. Event Timing separately records browser event processing/paint. First sample is first opening in this context, not repeated cold-start P95. No real QQ, player room or device acceptance.',operations,samples},null,2));
}

test.afterEach(async({page},info)=>{try{startup=await page.evaluate(()=>(window as any).__startupSample);await stopProfiler();await stopTrace();}catch(error){testFailure=String(error);}testFailure=info.error?.message||testFailure;save();});

async function measure(page:Page,operation:string,iteration:number,trigger:Locator,feedback:string,ready:string){
 await page.evaluate(({feedback,ready})=>{
  const w=window as any;w.__interactionSample={start:null,inputDelayMs:null,feedbackMs:null,readyMs:null,longTasks:[],done:false,catalogLoading:!!document.querySelector('.wiki-header-actions button[title="重新检查上游资料"][disabled]')};
  const row=w.__interactionSample,visible=(selector:string)=>{const e=document.querySelector(selector);if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[hidden]');};
  const observe=new PerformanceObserver(list=>{if(row.start!==null)for(const e of list.getEntries())if(e.startTime+e.duration>=row.start)row.longTasks.push({at:e.startTime-row.start,duration:e.duration});});observe.observe({type:'longtask'});
  document.addEventListener('pointerdown',event=>{row.start=event.timeStamp;row.inputDelayMs=Math.max(0,performance.now()-row.start);},{once:true,capture:true});
  const begin=(event:MouseEvent)=>{
   const handlerStart=performance.now();if(row.start===null){row.start=event.timeStamp;row.inputDelayMs=Math.max(0,handlerStart-row.start);}row.catalogLoading=!!document.querySelector('.wiki-header-actions button[title="重新检查上游资料"][disabled]');const tick=()=>{if(row.cancelled){observe.disconnect();return;}if(row.feedbackMs===null&&visible(feedback))row.feedbackMs=performance.now()-row.start;
    if(visible(ready))requestAnimationFrame(()=>requestAnimationFrame(()=>{row.readyMs=performance.now()-row.start;row.done=true;observe.disconnect();}));else requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  };document.addEventListener('click',begin,{once:true,capture:true});
 },{feedback,ready});
 let error:string|undefined;
 try{await trigger.click();await page.waitForFunction(()=>(window as any).__interactionSample?.done,null,{timeout:15000});}catch(e){error=String(e);}
 const measured=await page.evaluate(()=>{const row=(window as any).__interactionSample;row.cancelled=true;return {inputDelayMs:row.inputDelayMs,feedbackMs:row.feedbackMs,readyMs:row.readyMs,longTasks:row.longTasks,catalogLoading:row.catalogLoading};});
 samples.push({operation,iteration,phase:iteration===0?'first':'warm',...measured,...(error?{error}:{})});save();if(error)throw Error(operation+': '+error);
}

test('record bounded interaction samples using disposable cards and accounts',async({page,context,browser})=>{
 browserVersion=browser.version();
 expect(Number.isSafeInteger(count)&&count>=1&&count<=100).toBeTruthy();expect(['normal','standard150','network150','network300','cpu4'].includes(profile)).toBeTruthy();
 if(networkProfiles[profile]&&!corpusOrigin)throw Error('Network corpus measurements require calibrated real HTTPS delivery');
 if(corpusOrigin){const origin=new URL(corpusOrigin);if(origin.protocol!=='https:'||origin.hostname!=='127.0.0.1'||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Corpus transport must use a local HTTPS origin');}
 const f=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));
 await context.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);
 await mockSource(page);await suppressAnnouncement(page,process.env.PERF_ANNOUNCEMENT_VERSION);
 await context.addInitScript(()=>{
  const w=window as any;w.__startupSample={paperMs:null,catalogMs:null,longTasks:[],eventTimings:[]};const row=w.__startupSample;
  new PerformanceObserver(list=>row.longTasks.push(...list.getEntries().map(e=>({at:e.startTime,duration:e.duration})))).observe({type:'longtask'});
  if(PerformanceObserver.supportedEntryTypes.includes('event'))new PerformanceObserver(list=>{for(const e of list.getEntries() as PerformanceEventTiming[]){if(row.eventTimings.length===1000)row.eventTimings.shift();row.eventTimings.push({name:e.name,at:e.startTime,inputDelayMs:e.processingStart-e.startTime,processingMs:e.processingEnd-e.processingStart,durationMs:e.duration,interactionId:e.interactionId});}}).observe({type:'event',durationThreshold:16} as PerformanceObserverInit);
  const observer=new MutationObserver(()=>{if(row.paperMs===null&&document.querySelector('.paper'))row.paperMs=performance.now();if(row.catalogMs===null&&document.querySelector('.wiki-header-actions button[title="重新检查上游资料"]:not([disabled])')){row.catalogMs=performance.now();observer.disconnect();}});observer.observe(document,{subtree:true,childList:true,attributes:true});
 });
 if(corpusRoot){
  const indexBytes=readFileSync(resolve(corpusRoot,'index.json')),index=JSON.parse(indexBytes.toString()),bodies=new Map<string,string>(),paths=new Map<string,string>();
  for(const [ordinal,row] of index.rows.entries()){const body=JSON.parse(readFileSync(resolve(corpusRoot,row.path),'utf8')),json=JSON.stringify(body);expect(createHash('sha256').update(json).digest('hex'),row.url).toBe(row.sha256);bodies.set(row.url,json);paths.set(row.url,'/corpus/'+ordinal);}
  const fulfilled=new Set<string>();corpusProof={files:bodies.size,fulfilledFiles:0,indexSha256:createHash('sha256').update(indexBytes).digest('hex'),unmatchedRequests:[]};
  const source=async(route:any)=>{const url=route.request().url(),body=bodies.get(url);if(body===undefined&&!corpusProof!.unmatchedRequests.includes(url))corpusProof!.unmatchedRequests.push(url);if(body!==undefined){fulfilled.add(url);corpusProof!.fulfilledFiles=fulfilled.size;if(corpusOrigin){await route.continue({url:new URL(paths.get(url)!,corpusOrigin).href});return;}}await route.fulfill({body:body||'{}',contentType:'application/json',headers:{'access-control-allow-origin':'*'}});};
  await page.route('https://5e.kiwee.top/data/**',source);await page.route('https://homebrew.kiwee.top/**',source);
  if(process.env.PERF_CARD_COUNT){
   const adapterPath=process.env.PERF_CONSUMER_ADAPTER;if(!adapterPath)throw Error('A verified consumer adapter is required for complex card scenarios');
   const api=await import((await import('node:url')).pathToFileURL(resolve(adapterPath)).href),entries:any[]=[];
   for(const row of index.rows){const body=JSON.parse(bodies.get(row.url)!);entries.push(...api.normalizeCatalogData(row.url.includes('homebrew.kiwee')?api.homebrewBody(body):body,row.sha256,row.url.includes('homebrew.kiwee')?'kiwee-homebrew':'kiwee'));}
   const avatarData=process.env.PERF_AVATARS==='0'?undefined:await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const drawing=canvas.getContext('2d')!,pixels=drawing.createImageData(256,256);let seed=217;for(let i=0;i<pixels.data.length;i+=4){for(let channel=0;channel<3;channel++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i+channel]=seed>>>24;}pixels.data[i+3]=255;}drawing.putImageData(pixels,0,0);return canvas.toDataURL('image/png');});
   const kind=process.env.PERF_CARD_KIND||'mixed';if(!['mixed','typical','large'].includes(kind))throw Error('Invalid card kind');
   const scenario=await performanceCards(adapterPath,entries,Number(process.env.PERF_CARD_COUNT),avatarData,kind as 'mixed'|'typical'|'large');cardScenario=scenario.summary;
   await page.goto('/');await page.evaluate(async cards=>{const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open('dnd-card-standalone',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};request.onsuccess=()=>resolve(request.result);});try{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:cards,activeId:cards[Math.min(1,cards.length-1)].id,packs:[]},'workspace');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}},scenario.cards);
  }
 }
 if(profile!=='normal'){
  const cdp=await context.newCDPSession(page);if(profile==='cpu4')await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  if(networkProfiles[profile]){const network=networkProfiles[profile];await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:network.latencyMs,downloadThroughput:network.downloadBitsPerSecond/8,uploadThroughput:network.downloadBitsPerSecond/8});}
 }
 if(process.env.PERF_CAPTURE_CPU==='1'&&!profileInteractions){profiler=await context.newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
 if(process.env.PERF_CAPTURE_TIMELINE==='1'){tracer=await context.newCDPSession(page);await tracer.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.stack,v8.execute',transferMode:'ReturnAsStream'});}
 await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();if(process.env.PERF_INTERACT_EARLY!=='1')await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled({timeout:networkProfiles[profile]?600000:90000});await expect(page.getByRole('button',{name:'账号',exact:true})).toBeVisible();startup=await page.evaluate(()=>(window as any).__startupSample);
 if(process.env.PERF_CLOUD_ACTIVE==='1'){
  await page.getByRole('button',{name:'上传角色卡到云端',exact:true}).click();
  await page.getByRole('dialog',{name:'云端卡设置',exact:true}).getByRole('button',{name:'上传为我的云端卡',exact:true}).click();
  const confirmation=page.getByRole('dialog',{name:'保存到云端确认',exact:true});await confirmation.getByRole('checkbox').check();
  const posted=page.waitForResponse(response=>response.url().endsWith('/api/cards')&&response.request().method()==='POST');
  await confirmation.getByRole('button',{name:'确认保存到云端',exact:true}).click();expect((await posted).status()).toBe(201);
  await expect(confirmation).not.toBeVisible();await expect(page.getByRole('button',{name:'云端卡设置',exact:true})).toBeVisible();
  cloudScenario={activeUploaded:true,setupCompletedMs:await page.evaluate(()=>performance.now()),boundary:'Actual native cloud upload/receipt/polling against the isolated SQLite fixture; synthetic account and loopback API, not real QQ or production network'};
 }
 if(process.env.PERF_INTERACT_EARLY!=='1'&&!profileInteractions)await stopProfiler();
 if(process.env.PERF_CAPTURE_CPU==='1'&&profileInteractions){profiler=await context.newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
 const pages=[['特性','.features-page-grid'],['背景','.biography-grid'],['法术','.paper.page-3 .sheet-details'],['背包','.stock-board']] as const;
 for(const [label,selector] of pages)for(let i=0;i<=count;i++){
  await page.getByRole('tab',{name:/主要/}).click();await expect(page.locator('.paper.page-0')).toBeVisible();
  await measure(page,'sheet-'+label,i,page.locator(`[data-sheet-tab="${label}"]`),`.paper.page-${label==='特性'?1:label==='背景'?2:label==='法术'?3:4}`,selector);
 }
 const dialogs:{name:string;feedback?:string;ready:string;close:()=>Locator}[]=[
  {name:'规则与扩展',feedback:'dialog[open] .dialog-head',ready:'dialog[open] .settings-section',close:()=>page.getByRole('button',{name:'关闭弹窗',exact:true})},
  {name:'角色簿',feedback:'dialog[open] .dialog-head',ready:'dialog[open] .book-list',close:()=>page.getByRole('button',{name:'关闭弹窗',exact:true})},
  {name:'公告',feedback:'.announcement[open]',ready:'.announcement[open] .announcement-faq',close:()=>page.locator('.announcement-foot .primary')},
  {name:'调色盘',feedback:'.palette-drawer.is-open',ready:'.palette-drawer.is-open .palette-drawer-body',close:()=>page.getByRole('button',{name:'关闭调色盘',exact:true})},
  {name:'账号',feedback:'.qq-account-dialog[open]',ready:'.qq-account-dialog[open] .qq-card-picker-list > div',close:()=>page.getByRole('button',{name:'关闭账号弹窗',exact:true})},
 ];
 for(const item of dialogs)for(let i=0;i<=count;i++){
  await measure(page,'dialog-'+item.name,i,page.getByRole('button',{name:item.name,exact:true}),item.feedback||item.ready,item.ready);await item.close().click();await expect(page.locator(item.ready)).not.toBeVisible();
 }
 if(process.env.PERF_EXTENDED_CONTROLS==='1'){
  await page.getByRole('button',{name:'规则与扩展',exact:true}).click();
  const editions=page.getByRole('radiogroup',{name:'资料浏览版本',exact:true}),formats=page.getByRole('radiogroup',{name:'简写显示方式',exact:true});
  for(let i=0;i<=count;i++){
   await editions.getByRole('radio',{name:'2024',exact:true}).click();
   const selected='.library-display-settings [aria-label="资料浏览版本"] > [role="radio"]:nth-child(2)[aria-checked="true"]';
   await measure(page,'rules-view-2014',i,editions.getByRole('radio',{name:'2014',exact:true}),selected,selected);
   await formats.getByRole('radio',{name:'纯文本',exact:true}).click();
   const short='.library-display-settings [aria-label="简写显示方式"] > [role="radio"]:nth-child(2)[aria-checked="true"]';
   await measure(page,'source-display-short',i,formats.getByRole('radio',{name:'简写',exact:true}),short,short);
  }
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 }
 for(let i=0;i<=count;i++){
  await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();await page.locator('.catalog-row').first().click();await expect(page.locator('.entry-detail')).toHaveAttribute('data-entry-kind','spell');
  await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'职业',exact:true}).click();
  await measure(page,'wiki-entry',i,page.locator('.catalog-row').first(),'.entry-detail[data-entry-kind="class"]','.entry-detail[data-entry-kind="class"] .document-prose');
 }
 expect(samples.every(s=>s.readyMs!==null&&!s.error)).toBeTruthy();
});
