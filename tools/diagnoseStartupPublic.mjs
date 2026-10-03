// Read-only production samples. Fresh browser contexts, no authentication,
// user profiles, room fragments, private cards, or scene/document mutations.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const origin='https://obr.dnd.center';
const out='.local-evidence/startup-public';mkdirSync(out,{recursive:true});
const report={sampledAt:new Date().toISOString(),boundary:'Read-only public HTTP and isolated browser storage. No login or real Owlbear room. Browser warm navigation reuses the cold context; HTTP warm samples reuse a connection, not a browser cache.',http:[],assets:[],browsers:[]};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const save=()=>writeFileSync(join(out,'results.json'),JSON.stringify(report,null,2)+'\n');

function transfer(url,encoding='gzip',repeat=false){
 const dir=mkdtempSync(join(tmpdir(),'startup-public-'));
 try{
  const args=[],count=repeat?2:1;
  for(let i=0;i<count;i++){
   if(i)args.push('--next');
   args.push('--silent','--show-error','--max-time','45','--compressed','--header',`Accept-Encoding: ${encoding}`,'--dump-header',join(dir,`headers${i}`),'--output',join(dir,`body${i}`),'--write-out','%{json}\n',url);
  }
  const rows=execFileSync('curl',args,{encoding:'utf8',timeout:100000,maxBuffer:1024*1024}).trim().split('\n').map(JSON.parse);
  return rows.map((row,i)=>{
   const body=readFileSync(join(dir,`body${i}`)),header=readFileSync(join(dir,`headers${i}`),'utf8').trim().split(/\r?\n\r?\n/).at(-1),headers={};
   for(const line of header.split(/\r?\n/).slice(1)){const at=line.indexOf(':');if(at>0)headers[line.slice(0,at).toLowerCase()]=line.slice(at+1).trim();}
   return {url,encodingRequested:encoding,connectionSample:i?'reused':'new',status:row.http_code,httpVersion:row.http_version,newConnections:row.num_connects,timingSeconds:{dns:row.time_namelookup,connect:row.time_connect,tls:row.time_appconnect,ttfb:row.time_starttransfer,total:row.time_total},transferredBytes:row.size_download,decodedBytes:body.length,decodedSha256:digest(body),headers,body};
  });
 }finally{rmSync(dir,{recursive:true,force:true});}
}
const publicRow=({body,...row})=>row;
const entries=['/card/','/suite-dev/workbench/','/suite-dev/card-viewer/'];
for(const path of [...entries,'/card/release.json','/suite-dev/manifest-dev.json']){
 try{
  const samples=transfer(origin+path,'gzip',true);report.http.push(...samples.map(publicRow));
  if(path.endsWith('.json'))try{report.http.at(-2).release=JSON.parse(samples[0].body);}catch{}
  if(entries.includes(path)&&samples[0].status===200){
   const html=samples[0].body.toString();
   const names=[...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+\.(?:js|css))"/g)].map(m=>m[1]);
   for(const name of [...new Set(names)]){
    const url=new URL(name,origin+path).href;
    if(new URL(url).origin!==origin)continue;
    const gzip=transfer(url,'gzip',true),identity=transfer(url,'identity')[0];
    report.assets.push({url,gzip:gzip.map(publicRow),identity:publicRow(identity),sameDecodedContent:gzip.every(row=>row.decodedSha256===identity.decodedSha256),immutable:gzip.every(row=>/max-age=31536000/.test(row.headers['cache-control']||'')&&/immutable/.test(row.headers['cache-control']||'')),gzipDelivered:gzip.every(row=>row.headers['content-encoding']==='gzip'),variesByEncoding:gzip.every(row=>/accept-encoding/i.test(row.headers.vary||''))});
   }
  }
 }catch(error){report.http.push({url:origin+path,error:String(error)});}
 save();
}
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
 for(const path of entries){
  const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage();
  await context.addInitScript(()=>{
   window.__startupPublic={events:[],longTasks:[]};
   for(const name of ['dnd-card-startup','dnd-card-stage','dnd-card-ready','dnd-card-failed','dnd-card-style-ready'])window.addEventListener(name,event=>window.__startupPublic.events.push({name,at:performance.now(),detail:event.detail}));
   window.addEventListener('animationend',event=>{if(event.target?.classList.contains('startup-piece'))window.__startupPublic.events.push({name:'logo-layer-end',at:performance.now()});},true);
   try{new PerformanceObserver(list=>window.__startupPublic.longTasks.push(...list.getEntries().map(entry=>({at:entry.startTime,duration:entry.duration})))).observe({type:'longtask',buffered:true});}catch{}
  });
  for(const cache of ['cold','warm']){
   const errors=[],row={url:origin+path,cache};const record=error=>errors.push(error.message);page.on('pageerror',record);
   try{
    await page.goto(row.url,{waitUntil:'commit',timeout:90000});
    await page.waitForFunction(()=>['complete','failed'].includes(document.documentElement?.dataset.cardStartup),null,{timeout:90000});
    Object.assign(row,await page.evaluate(()=>({phase:document.documentElement.dataset.cardStartup,events:window.__startupPublic.events,longTasks:window.__startupPublic.longTasks,navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),resources:performance.getEntriesByType('resource').filter(entry=>/\.(?:js|css)(?:\?|$)/.test(entry.name)).map(entry=>({url:entry.name,type:entry.initiatorType,start:entry.startTime,responseStart:entry.responseStart,end:entry.responseEnd,transfer:entry.transferSize,encoded:entry.encodedBodySize})),version:document.querySelector('.announcement-version')?.textContent,editingPreference:localStorage.getItem('dnd-card:editing'),paperPresent:!!document.querySelector('.paper')})));
    await page.screenshot({path:join(out,path.replaceAll('/','_')+cache+'.png')});
   }catch(error){row.error=String(error);}
   row.errors=errors;report.browsers.push(row);save();page.off('pageerror',record);
   console.log(JSON.stringify({url:row.url,cache,phase:row.phase,error:row.error,completeMs:row.events?.find(event=>event.name==='dnd-card-startup'&&event.detail==='complete')?.at,readyMs:row.events?.find(event=>event.name==='dnd-card-ready')?.at,errors}));
  }
  await context.close();
 }
}finally{await browser.close();save();}
if(report.http.some(row=>row.error||row.status!==200)||report.assets.some(row=>!row.sameDecodedContent||!row.immutable||!row.gzipDelivered||!row.variesByEncoding)||report.browsers.some(row=>row.error||row.phase!=='complete'||row.errors.length))process.exitCode=1;
