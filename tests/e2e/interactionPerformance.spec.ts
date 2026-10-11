import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {mockSource,suppressAnnouncement} from './fixtures';

type Sample={operation:string;iteration:number;phase:'first'|'warm';feedbackMs:number|null;readyMs:number|null;longTasks:{at:number;duration:number}[];error?:string};
const samples:Sample[]=[],count=Number(process.env.PERF_SAMPLES||30),profile=process.env.PERF_PROFILE||'normal';
const output=resolve(process.env.PERF_TIMING_FILE||'../evidence/interaction-timing-current.json');
const corpusRoot=process.env.PERF_CORPUS_ROOT;
let corpusProof:{files:number;indexSha256:string;unmatchedRequests:string[]}|undefined;
function save(){
 const operations=[...new Set(samples.map(s=>s.operation))].map(operation=>{
  const rows=samples.filter(s=>s.operation===operation),warm=rows.filter(s=>s.phase==='warm'),values=warm.filter(s=>!s.error&&s.readyMs!==null).map(s=>s.readyMs!).sort((a,b)=>a-b);
  return {operation,samples:rows.length,failures:rows.filter(s=>s.error).length,first:rows.find(s=>s.phase==='first'),warmSamples:warm.length,warmReadyP95Ms:values.length?values[Math.ceil(values.length*.95)-1]:null,warmReadyMaxMs:values.at(-1)??null};
 });
 mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({at:new Date().toISOString(),profile,conditions:{browser:'isolated installed Edge',viewport:[1440,960],source:corpusRoot?'verified existing public corpus snapshot':'authored tiny fixture',corpusProof,accounts:'isolated synthetic fixture',network:profile==='network150'?{latencyMs:150,downloadBitsPerSecond:1000000}:'loopback',sourceTransport:'local fulfilled responses; source latency is not emulated by CDP',cpuRate:profile==='cpu4'?4:1,buildRoot:process.env.CLOUD_PREVIEW_ROOT||'dist-cloud',contendingProcesses:process.env.PERF_CONTENTION||'unspecified',samplesRequested:count},boundary:'Software measurement only. Click capture to DOM readiness plus two animation frames; excludes automation transport. First sample is first opening in this context, not repeated cold-start P95. No real QQ, player room or device acceptance.',operations,samples},null,2));
}

async function measure(page:Page,operation:string,iteration:number,trigger:Locator,feedback:string,ready:string){
 await page.evaluate(({feedback,ready})=>{
  const w=window as any;w.__interactionSample={start:null,feedbackMs:null,readyMs:null,longTasks:[],done:false};
  const row=w.__interactionSample,visible=(selector:string)=>{const e=document.querySelector(selector);if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[hidden]');};
  const observe=new PerformanceObserver(list=>{if(row.start!==null)for(const e of list.getEntries())if(e.startTime+e.duration>=row.start)row.longTasks.push({at:e.startTime-row.start,duration:e.duration});});observe.observe({type:'longtask'});
  const begin=()=>{
   row.start=performance.now();const tick=()=>{if(row.cancelled){observe.disconnect();return;}if(row.feedbackMs===null&&visible(feedback))row.feedbackMs=performance.now()-row.start;
    if(visible(ready))requestAnimationFrame(()=>requestAnimationFrame(()=>{row.readyMs=performance.now()-row.start;row.done=true;observe.disconnect();}));else requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  };document.addEventListener('click',begin,{once:true,capture:true});
 },{feedback,ready});
 let error:string|undefined;
 try{await trigger.click();await page.waitForFunction(()=>(window as any).__interactionSample?.done,null,{timeout:15000});}catch(e){error=String(e);}
 const measured=await page.evaluate(()=>{const row=(window as any).__interactionSample;row.cancelled=true;return {feedbackMs:row.feedbackMs,readyMs:row.readyMs,longTasks:row.longTasks};});
 samples.push({operation,iteration,phase:iteration===0?'first':'warm',...measured,...(error?{error}:{})});save();if(error)throw Error(operation+': '+error);
}

test('record first and thirty warm interaction samples without real account or card writes',async({page,context})=>{
 expect(Number.isSafeInteger(count)&&count>=1&&count<=100).toBeTruthy();expect(['normal','network150','cpu4'].includes(profile)).toBeTruthy();
 const f=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));
 await context.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);
 await mockSource(page);await suppressAnnouncement(page);
 if(corpusRoot){
  const indexBytes=readFileSync(resolve(corpusRoot,'index.json')),index=JSON.parse(indexBytes.toString()),bodies=new Map<string,string>();
  for(const row of index.rows){const body=JSON.parse(readFileSync(resolve(corpusRoot,row.path),'utf8')),json=JSON.stringify(body);expect(createHash('sha256').update(json).digest('hex'),row.url).toBe(row.sha256);bodies.set(row.url,json);}
  corpusProof={files:bodies.size,indexSha256:createHash('sha256').update(indexBytes).digest('hex'),unmatchedRequests:[]};
  const source=async(route:any)=>{const url=route.request().url(),body=bodies.get(url);if(body===undefined&&!corpusProof!.unmatchedRequests.includes(url))corpusProof!.unmatchedRequests.push(url);await route.fulfill({body:body||'{}',contentType:'application/json',headers:{'access-control-allow-origin':'*'}});};
  await page.route('https://5e.kiwee.top/data/**',source);await page.route('https://homebrew.kiwee.top/**',source);
 }
 if(profile!=='normal'){
  const cdp=await context.newCDPSession(page);if(profile==='cpu4')await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  if(profile==='network150'){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1000000/8,uploadThroughput:1000000/8});}
 }
 await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'账号',exact:true})).toBeVisible();
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
