import {test,expect,type Page,type Locator,type CDPSession} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {mockSource,suppressAnnouncement} from './fixtures';
import {performanceCards} from './performanceScenario';

type Sample={operation:string;iteration:number;phase:'first'|'warm';catalogLoading:boolean;feedbackMs:number|null;readyMs:number|null;longTasks:{at:number;duration:number}[];error?:string};
const samples:Sample[]=[],count=Number(process.env.PERF_SAMPLES||30),profile=process.env.PERF_PROFILE||'normal';
const output=resolve(process.env.PERF_TIMING_FILE||'../evidence/interaction-timing-current.json');
const corpusRoot=process.env.PERF_CORPUS_ROOT;
const corpusOrigin=process.env.PERF_SOURCE_ORIGIN;
const networkProfiles:Record<string,{latencyMs:number;downloadBitsPerSecond:number}>={standard150:{latencyMs:150,downloadBitsPerSecond:10000000},network150:{latencyMs:150,downloadBitsPerSecond:1000000},network300:{latencyMs:300,downloadBitsPerSecond:1000000}};
let corpusProof:{files:number;fulfilledFiles:number;indexSha256:string;unmatchedRequests:string[]}|undefined;
let startup:unknown,testFailure:string|undefined;
let cardScenario:unknown={count:1,mixture:'default empty card'};
let profiler:CDPSession|undefined;
async function stopProfiler(){if(!profiler)return;const session=profiler;profiler=undefined;const {profile}=await session.send('Profiler.stop'),bytes=JSON.stringify(profile);if(Buffer.byteLength(bytes)>100*1024*1024)throw Error('CPU evidence exceeds the per-run evidence budget');mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output+'.cpuprofile',bytes);}
function save(){
 const operations=[...new Set(samples.map(s=>s.operation))].map(operation=>{
  const rows=samples.filter(s=>s.operation===operation),warm=rows.filter(s=>s.phase==='warm'),values=warm.filter(s=>!s.error&&s.readyMs!==null).map(s=>s.readyMs!).sort((a,b)=>a-b);
  return {operation,samples:rows.length,failures:rows.filter(s=>s.error).length,first:rows.find(s=>s.phase==='first'),warmSamples:warm.length,warmReadyP95Ms:values.length?values[Math.ceil(values.length*.95)-1]:null,warmReadyMaxMs:values.at(-1)??null};
 });
 mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({at:new Date().toISOString(),profile,startup,testFailure,conditions:{browser:'isolated installed Edge',viewport:[1440,960],source:corpusRoot?'verified existing public corpus snapshot':'authored tiny fixture',corpusProof,cardScenario,accounts:'isolated synthetic fixture',network:networkProfiles[profile]||'loopback',sourceTransport:corpusOrigin?'verified public corpus over local HTTPS, subject to calibrated CDP throttling':'local fulfilled responses; source latency is not emulated by CDP',cpuRate:profile==='cpu4'?4:1,interactWhileLoading:process.env.PERF_INTERACT_EARLY==='1',captureCPU:process.env.PERF_CAPTURE_CPU==='1',buildRoot:process.env.CLOUD_PREVIEW_ROOT||'dist-cloud',contendingProcesses:process.env.PERF_CONTENTION||'unspecified',samplesRequested:count},boundary:'Software measurement only. Click capture to DOM readiness plus two animation frames; excludes automation transport. First sample is first opening in this context, not repeated cold-start P95. No real QQ, player room or device acceptance.',operations,samples},null,2));
}

test.afterEach(async({page},info)=>{try{startup=await page.evaluate(()=>(window as any).__startupSample);await stopProfiler();}catch{}testFailure=info.error?.message;save();});

async function measure(page:Page,operation:string,iteration:number,trigger:Locator,feedback:string,ready:string){
 await page.evaluate(({feedback,ready})=>{
  const w=window as any;w.__interactionSample={start:null,feedbackMs:null,readyMs:null,longTasks:[],done:false,catalogLoading:!!document.querySelector('.wiki-header-actions button[title="重新检查上游资料"][disabled]')};
  const row=w.__interactionSample,visible=(selector:string)=>{const e=document.querySelector(selector);if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[hidden]');};
  const observe=new PerformanceObserver(list=>{if(row.start!==null)for(const e of list.getEntries())if(e.startTime+e.duration>=row.start)row.longTasks.push({at:e.startTime-row.start,duration:e.duration});});observe.observe({type:'longtask'});
  const begin=()=>{
   row.start=performance.now();row.catalogLoading=!!document.querySelector('.wiki-header-actions button[title="重新检查上游资料"][disabled]');const tick=()=>{if(row.cancelled){observe.disconnect();return;}if(row.feedbackMs===null&&visible(feedback))row.feedbackMs=performance.now()-row.start;
    if(visible(ready))requestAnimationFrame(()=>requestAnimationFrame(()=>{row.readyMs=performance.now()-row.start;row.done=true;observe.disconnect();}));else requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  };document.addEventListener('click',begin,{once:true,capture:true});
 },{feedback,ready});
 let error:string|undefined;
 try{await trigger.click();await page.waitForFunction(()=>(window as any).__interactionSample?.done,null,{timeout:15000});}catch(e){error=String(e);}
 const measured=await page.evaluate(()=>{const row=(window as any).__interactionSample;row.cancelled=true;return {feedbackMs:row.feedbackMs,readyMs:row.readyMs,longTasks:row.longTasks,catalogLoading:row.catalogLoading};});
 samples.push({operation,iteration,phase:iteration===0?'first':'warm',...measured,...(error?{error}:{})});save();if(error)throw Error(operation+': '+error);
}

test('record first and thirty warm interaction samples without real account or card writes',async({page,context})=>{
 expect(Number.isSafeInteger(count)&&count>=1&&count<=100).toBeTruthy();expect(['normal','standard150','network150','network300','cpu4'].includes(profile)).toBeTruthy();
 if(networkProfiles[profile]&&!corpusOrigin)throw Error('Network corpus measurements require calibrated real HTTPS delivery');
 if(corpusOrigin){const origin=new URL(corpusOrigin);if(origin.protocol!=='https:'||origin.hostname!=='127.0.0.1'||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Corpus transport must use a local HTTPS origin');}
 const f=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));
 await context.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);
 await mockSource(page);await suppressAnnouncement(page);
 await context.addInitScript(()=>{
  const w=window as any;w.__startupSample={paperMs:null,catalogMs:null,longTasks:[]};const row=w.__startupSample;
  new PerformanceObserver(list=>row.longTasks.push(...list.getEntries().map(e=>({at:e.startTime,duration:e.duration})))).observe({type:'longtask'});
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
   const scenario=await performanceCards(adapterPath,entries,Number(process.env.PERF_CARD_COUNT),avatarData);cardScenario=scenario.summary;
   await page.goto('/');await page.evaluate(async cards=>{const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open('dnd-card-standalone',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};request.onsuccess=()=>resolve(request.result);});try{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:cards,activeId:cards[Math.min(1,cards.length-1)].id,packs:[]},'workspace');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}},scenario.cards);
  }
 }
 if(profile!=='normal'){
  const cdp=await context.newCDPSession(page);if(profile==='cpu4')await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  if(networkProfiles[profile]){const network=networkProfiles[profile];await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:network.latencyMs,downloadThroughput:network.downloadBitsPerSecond/8,uploadThroughput:network.downloadBitsPerSecond/8});}
 }
 if(process.env.PERF_CAPTURE_CPU==='1'){profiler=await context.newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
 await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();if(process.env.PERF_INTERACT_EARLY!=='1')await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled({timeout:networkProfiles[profile]?600000:90000});await expect(page.getByRole('button',{name:'账号',exact:true})).toBeVisible();startup=await page.evaluate(()=>(window as any).__startupSample);
 if(process.env.PERF_INTERACT_EARLY!=='1')await stopProfiler();
 const pages=[['特性','.features-page-grid'],['背景','.biography-grid'],['法术','.paper.page-3 .sheet-details'],['背包','.stock-board']] as const;
 for(const [label,selector] of pages)for(let i=0;i<=count;i++){
  await page.getByRole('tab',{name:/主要/}).click();await expect(page.locator('.paper.page-0')).toBeVisible();
  await measure(page,'sheet-'+label,i,page.locator(`[data-sheet-tab="${label}"]`),`.paper.page-${label==='特性'?1:label==='背景'?2:label==='法术'?3:4}`,selector);
 }
 const dialogs:{name:string;feedback?:string;ready:string;close:()=>Locator}[]=[
  {name:'规则与扩展',ready:'dialog[open] .settings-section',close:()=>page.getByRole('button',{name:'关闭弹窗',exact:true})},
  {name:'角色簿',ready:'dialog[open] .book-list',close:()=>page.getByRole('button',{name:'关闭弹窗',exact:true})},
  {name:'公告',ready:'.announcement[open] .announcement-faq',close:()=>page.locator('.announcement-foot .primary')},
  {name:'调色盘',ready:'.palette-drawer.is-open .palette-drawer-body',close:()=>page.getByRole('button',{name:'关闭调色盘',exact:true})},
  {name:'账号',feedback:'.qq-account-dialog[open]',ready:'.qq-account-dialog[open] .qq-card-picker-list > div',close:()=>page.getByRole('button',{name:'关闭账号弹窗',exact:true})},
 ];
 for(const item of dialogs)for(let i=0;i<=count;i++){
  await measure(page,'dialog-'+item.name,i,page.getByRole('button',{name:item.name,exact:true}),item.feedback||item.ready,item.ready);await item.close().click();await expect(page.locator(item.ready)).not.toBeVisible();
 }
 for(let i=0;i<=count;i++){
  await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();await page.locator('.catalog-row').first().click();await expect(page.locator('.entry-detail')).toHaveAttribute('data-entry-kind','spell');
  await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'职业',exact:true}).click();
  await measure(page,'wiki-entry',i,page.locator('.catalog-row').first(),'.entry-detail[data-entry-kind="class"]','.entry-detail[data-entry-kind="class"] .document-prose');
 }
 expect(samples.every(s=>s.readyMs!==null&&!s.error)).toBeTruthy();
});
