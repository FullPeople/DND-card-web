import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const {chromium}=createRequire(new URL('../package.json',import.meta.url))('@playwright/test');
const label=process.argv[2]||'before',out='D:/Temp/DND-card-startup202',stubWiki=!process.argv.includes('--real-wiki');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-proxy-server']}),results=[];
try{
 for(const [mode,path] of [['standalone','/card/'],['suite','/suite-dev/workbench/#suite=cold-start-check&bridge=https%3A%2F%2Fobr.dnd.center'],...(process.argv.includes('--legacy')?[['legacy','/suite/card-viewer/?legacyViewer=1']]:[])]){
  console.log('Checking '+label+' '+mode);
  const context=await browser.newContext({viewport:{width:1280,height:960},locale:'zh-CN'});
  await context.addInitScript(({stubWiki})=>{
   // Isolate app-shell startup. Rule data is not needed to open the local card.
   const original=window.fetch;window.fetch=function(input,init){const url=new URL(typeof input==='string'?input:input instanceof Request?input.url:input.href,location.href);if(stubWiki&&['5e.kiwee.top','homebrew.kiwee.top'].includes(url.hostname))return Promise.resolve(new Response('{}',{headers:{'Content-Type':'application/json'}}));return original.call(this,input,init);};
   window.startupMeasure={fallbackAt:null,readyAt:null,longTasks:[]};
   const check=()=>{const state=window.startupMeasure;if(state.fallbackAt===null&&document.querySelector('[role=status]')?.textContent?.includes('正在读取角色卡'))state.fallbackAt=performance.now();if(state.readyAt===null&&document.querySelector('.app-shell,.player-viewer,.player-viewer-loading'))state.readyAt=performance.now();};new MutationObserver(check).observe(document,{subtree:true,childList:true});
   new PerformanceObserver(entries=>{window.startupMeasure.longTasks.push(...entries.getEntries().map(e=>({start:e.startTime,duration:e.duration})));}).observe({type:'longtask',buffered:true});
  },{stubWiki});
  const page=await context.newPage(),errors=[],headers=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',response=>{if(response.url().includes('/assets/'))headers.push({url:response.url(),status:response.status(),encoding:response.headers()['content-encoding']||'identity'});});
  for(const phase of ['cold','warm']){
   headers.length=0;errors.length=0;
   if(phase==='warm')await page.reload({waitUntil:'domcontentloaded',timeout:120000});
   else await page.goto('https://obr.dnd.center'+path,{waitUntil:'domcontentloaded',timeout:120000});
   await page.locator('.app-shell,.player-viewer,.player-viewer-loading').waitFor({timeout:120000});
   const metrics=await page.evaluate(()=>({url:location.href,...window.startupMeasure,navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).map(r=>({name:r.name,start:r.startTime,duration:r.duration,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize}))}));
   if(phase==='cold')await page.screenshot({path:join(out,label+'-'+mode+'.png')});
   results.push({mode,phase,metrics,headers:[...headers],errors:[...errors]});writeFileSync(join(out,label+'-browser.json'),JSON.stringify({results,ruleDataStubbed:stubWiki,realOwlbearRoom:false,legacyCharacterLoaded:false},null,2));
   console.log(JSON.stringify({mode,phase,readyMs:Math.round(metrics.readyAt),fallbackMs:Math.round(metrics.readyAt-(metrics.fallbackAt||0)),bytes:metrics.resources.reduce((sum,r)=>sum+r.transfer,0),errors}));
   if(phase==='cold'){await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();if(r?.installing)await new Promise(done=>{const worker=r.installing;worker.addEventListener('statechange',()=>{if(['installed','activated','redundant'].includes(worker.state))done();});setTimeout(done,45000);});});}
  }
  await context.close();
 }
}finally{await browser.close();}
