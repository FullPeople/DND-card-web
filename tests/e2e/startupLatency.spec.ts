import {test,expect,type Frame,type Page} from '@playwright/test';
import {ANNOUNCEMENT_KEY,announcementVersionFor} from '../../src/platform/announcement';
/** Controlled production-byte benchmark, not a live Owlbear room/ISP benchmark.
 * Avoid Playwright routing: it disables HTTP cache and invalidates warm results. */
for(const network of ['unthrottled','32KiB/s-150ms'] as const)test(`${network}: cold/warm production startup separates network, decode, app and animation`,async({page,context},info)=>{
 const iframe=info.project.name==='suite-iframe',base=info.project.use.baseURL!,url=iframe?`${base}/#suite=startup-benchmark&bridge=${encodeURIComponent(base)}`:base+'/';
 await context.addInitScript(({key,standalone,suite})=>{
  try{localStorage.setItem(key,standalone);localStorage.setItem(key+':suite',suite);localStorage.setItem('dnd-card:rules-setup:v1','done');}catch{}
  const original=window.fetch.bind(window);window.fetch=(input,init)=>{const href=typeof input==='string'?input:input instanceof Request?input.url:input.href;const url=new URL(href,location.href);return ['5e.kiwee.top','homebrew.kiwee.top'].includes(url.hostname)?Promise.resolve(new Response('{}',{headers:{'content-type':'application/json'}})):original(input,init);};
  (window as any).startupLongTasks=[];try{new PerformanceObserver(list=>(window as any).startupLongTasks.push(...list.getEntries().map(row=>({start:row.startTime,duration:row.duration})))).observe({type:'longtask',buffered:true});}catch{}
 },{key:ANNOUNCEMENT_KEY,standalone:announcementVersionFor('standalone'),suite:announcementVersionFor('suite')});
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
 if(network!=='unthrottled')await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:32768,uploadThroughput:327680});
 const results:any[]=[];
 for(const visit of ['cold','warm']){
  let view:Frame|Page=page;
  if(iframe){await page.goto(base+'/__startup-benchmark-host.html',{waitUntil:'domcontentloaded'});await page.setContent(`<iframe title="Suite startup fixture" src="${url}" style="border:0;width:100vw;height:98vh"></iframe>`,{waitUntil:'domcontentloaded'});const frame=await (await page.locator('iframe').elementHandle())!.contentFrame();if(!frame)throw Error('missing Suite fixture frame');view=frame;}
  else await page.goto(url,{waitUntil:'commit'});
  await view.waitForFunction(()=>document.documentElement?.dataset.cardStartup==='complete',null,{timeout:100000});await expect(view.locator('.app-shell')).toBeVisible();
  const metrics=await view.evaluate(()=>{
   const marks=Object.fromEntries(performance.getEntriesByType('mark').filter(r=>r.name.startsWith('dnd-card:')).map(r=>[r.name.replace('dnd-card:',''),r.startTime]));
   const resources=(performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(r=>r.startTime<marks.complete).map(r=>({name:new URL(r.name).pathname.split('/').at(-1),start:r.startTime,end:r.responseEnd,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize}));
   return {marks,navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),paints:performance.getEntriesByType('paint').map(r=>({name:r.name,at:r.startTime})),resources,longTasks:(window as any).startupLongTasks.filter((r:any)=>r.start<marks.complete)};
  });
  expect(metrics.marks['logo-decoded']).toBeGreaterThanOrEqual(metrics.marks.loading);expect(metrics.marks.fading).toBeGreaterThanOrEqual(metrics.marks['card-ready']);expect(metrics.marks.complete).toBeGreaterThan(metrics.marks.fading);expect(metrics.resources.filter(r=>/startup-logo|[1-4]\.optimized\.png/.test(r.name||''))).toHaveLength(4);
  expect(metrics.resources.filter(r=>/WikiUi-|catalog-|cardRuntime-|exe_icon\.png/.test(r.name||''))).toHaveLength(0);
  results.push({project:info.project.name,network,visit,boundary:'Synthetic local production server, gzip + HTTP cache; Suite Web entry in iframe; rule fetches empty; no real room/relay/ISP claim',...metrics});
  await info.attach(`${network}-${visit}.json`,{body:JSON.stringify(results.at(-1),null,2),contentType:'application/json'});
 }
 const transferred=(row:any)=>row.resources.reduce((n:number,r:any)=>n+r.transfer,0);expect(transferred(results[1])).toBeLessThan(transferred(results[0]));
 await info.attach('comparison.json',{body:JSON.stringify(results,null,2),contentType:'application/json'});
});
