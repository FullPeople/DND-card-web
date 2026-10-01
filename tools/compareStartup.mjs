import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const savedCard=JSON.parse(readFileSync('.local-evidence/startup-character.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-proxy-server']});
const results=[];
try{
 for(const network of ['local','32KiB/s-150ms'])for(const [version,port] of [['227',5291],['228-local',5292]]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:960}});
  await context.addInitScript(card=>{
   localStorage.setItem('dnd-card:rules-setup:v1','done');
   localStorage.setItem('dnd-card-sheet-display','screen');
   const open=indexedDB.open('dnd-card-standalone',1);
   open.onupgradeneeded=()=>{open.result.createObjectStore('documents');open.result.createObjectStore('cache');};
   open.onsuccess=()=>{const db=open.result,tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:[card],activeId:card.id,packs:[]},'workspace');tx.oncomplete=()=>db.close();};
   window.startup228={cardAt:undefined,editableAt:undefined};
   const observer=new MutationObserver(()=>{
    if(!window.startup228.cardAt&&document.querySelector('.paper .identity-class'))window.startup228.cardAt=performance.now();
    const edit=document.querySelector('.edit-mode-toggle');
    if(!window.startup228.editableAt&&edit&&!edit.disabled){window.startup228.editableAt=performance.now();observer.disconnect();}
   });observer.observe(document,{subtree:true,childList:true,attributes:true});
   window.fetch=((original)=>(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof Request?input.url:input.href,location.href);
    return ['5e.kiwee.top','homebrew.kiwee.top'].includes(url.hostname)?Promise.resolve(new Response('{}',{headers:{'content-type':'application/json'}})):original(input,init);
   })(window.fetch.bind(window));
  },savedCard);
  const page=await context.newPage();
  if(network!=='local'){const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:32768,uploadThroughput:327680});}
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'commit'});
  await page.locator('.paper .identity-class').waitFor({timeout:90000});
  await page.waitForFunction(()=>!!window.startup228.editableAt,{},{timeout:90000});
  const displayedName=await page.getByRole('textbox',{name:'角色姓名',exact:true}).inputValue();
  if(displayedName!==savedCard.name)throw Error('Benchmark did not load the saved fixture');
  const metrics=await page.evaluate(()=>({...window.startup228,resources:performance.getEntriesByType('resource').filter(r=>r.responseEnd<=window.startup228.cardAt&&/\/(assets|index.html)/.test(r.name)).map(r=>({name:r.name.split('/').at(-1),bytes:r.encodedBodySize,end:r.responseEnd})),navigation:performance.getEntriesByType('navigation')[0].toJSON()}));
  const row={version,network,displayedName,...metrics,criticalBytes:metrics.resources.reduce((n,r)=>n+r.bytes,0),errors};results.push(row);
  console.log(JSON.stringify({version,network,cardMs:Math.round(row.cardAt),editableMs:Math.round(row.editableAt),criticalBytes:row.criticalBytes,errors}));
  writeFileSync('.local-evidence/comparison.json',JSON.stringify(results,null,2));await context.close();
 }
}finally{await browser.close();}
