import {test,expect,type Page,type CDPSession} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {mockSource,suppressAnnouncement} from '../tests/e2e/fixtures';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';

// All data are original software fixtures. No player card or publisher snapshot.
async function records(page:Page){return page.evaluate(async()=>{const req=indexedDB.open('dnd-card-standalone');await new Promise<void>((resolve,reject)=>{req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});const db=req.result;try{return await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}});}
async function setup(page:Page,catalog:number,mode:'a4'|'screen'){
 const baseline=test.info().project.name==='baseline',noticeVersion=baseline?process.env.DND_PERF_BASELINE_NOTICE_VERSION:undefined;
 if(baseline)expect(noticeVersion).toMatch(/^\d+\.\d+\.\d+/);
 await mockSource(page,{displayMode:mode});await suppressAnnouncement(page,noticeVersion);
 await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:{spell:Array.from({length:catalog},(_,i)=>({name:`原创资料法术${i}`,ENG_name:`Authored Spell ${i}`,source:'XPHB',level:i%10,entries:['原创性能夹具条目，不是公开出版物。']}))},headers:{'access-control-allow-origin':'*'}}));
 const characters=Array.from({length:12},(_,i)=>{const c=newCharacter();c.name=i===0?'短名':`角色${i} - ${'很长的角色名称'.repeat(i%3===0?5:1)}`;c.automation=newAutomationState();c.runtime.resources.manual={name:'自定义资源',current:3,max:7};c.selections=Array.from({length:20},(_,j)=>({id:`sel-${i}-${j}`,entry:{id:`entry-${i}-${j}`,name:`原创特性${j}`,english:`Authored feature ${j}`,kind:'feature',edition:'2024',source:'XPHB',revision:'1',packId:'fixture',entries:['原创卡面性能测试，不带自动化声明。'],raw:{}} as Entry,level:1,quantity:1,equipped:false}));return c;});
 await page.addInitScript(characters=>{localStorage.setItem('dnd-card:editing','true');const r=indexedDB.open('dnd-card-standalone',1);r.onupgradeneeded=()=>{r.result.createObjectStore('documents');r.result.createObjectStore('cache');};r.onsuccess=()=>{const db=r.result,tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),read=store.get('workspace');read.onsuccess=()=>{if(!read.result)store.put({schemaVersion:1,characters,activeId:characters[0].id,packs:[]},'workspace');};tx.oncomplete=()=>db.close();};},characters);
 const spells=page.waitForResponse(r=>r.url().endsWith('/data/spells/spells-test.json')&&r.status()===200);
 await page.goto('/');await spells;await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.waitForTimeout(400);
 await expect(page.locator('.announcement')).toBeHidden();
 return (await records(page)).characters;
}
async function instrument(page:Page){await page.evaluate(()=>{
 const w=window as any;const m:any=w.__dropMetrics={operation:'idle',inputs:[],longtasks:[],phases:[],saveStatus:[]};
 const mark=(name:string)=>{const start=performance.now();m.phases.push({name,start});performance.mark(`perf232:${name}`);return start;};w.__dropMark=mark;
 new PerformanceObserver(list=>m.longtasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:false});
 const events=new WeakMap<Event,any>();
 window.addEventListener('input',e=>{if((e.target as HTMLElement)?.getAttribute('aria-label')!=='角色姓名')return;const entry={start:performance.now(),length:(e.target as HTMLInputElement).value.length} as any;m.inputs.push(entry);events.set(e,entry);performance.mark('perf232:name-input');requestAnimationFrame(()=>{entry.firstRaf=performance.now()-entry.start;requestAnimationFrame(()=>entry.twoRaf=performance.now()-entry.start);});},true);
 window.addEventListener('input',e=>{const entry=events.get(e);if(entry)entry.dispatch=performance.now()-entry.start;});
 window.addEventListener('pointerup',()=>{if(m.operation!=='drop')return;mark('pointerup-capture');requestAnimationFrame(()=>{mark('drop-first-raf');requestAnimationFrame(()=>mark('drop-two-raf'));});},true);
 window.addEventListener('pointerup',()=>{if(m.operation==='drop')mark('pointerup-bubble');});
 let seenClass=false,lastStatus='';new MutationObserver(()=>{if(m.operation==='drop'&&!seenClass&&document.querySelector('.identity-class')?.textContent?.includes('测试法师')){seenClass=true;mark('class-dom-observed');}const status=document.querySelector('.save-status')?.textContent||'';if(status!==lastStatus){lastStatus=status;m.saveStatus.push({operation:m.operation,start:performance.now(),text:status});}}).observe(document.querySelector('.app-shell')||document.body,{subtree:true,childList:true,characterData:true});
});}
async function begin(page:Page,operation:string){await page.evaluate(operation=>{(window as any).__dropMetrics.operation=operation;(window as any).__dropMark(`${operation}-runner-start`);},operation);}
async function stopProfile(client:CDPSession,file:string){const {profile}=await client.send('Profiler.stop');writeFileSync(test.info().outputPath(file),JSON.stringify(profile));}
async function finishTrace(client:CDPSession){const done=new Promise<any>(resolve=>client.once('Tracing.tracingComplete',resolve));await client.send('Tracing.end');const {stream}=await done;let text='';try{for(;;){const chunk=await client.send('IO.read',{handle:stream});text+=chunk.base64Encoded?Buffer.from(chunk.data,'base64').toString('utf8'):chunk.data;if(chunk.eof)break;}}finally{await client.send('IO.close',{handle:stream});}writeFileSync(test.info().outputPath('timeline.json.gz'),gzipSync(text));}
function stats(values:number[]){const sorted=values.slice().sort((a,b)=>a-b);return {count:sorted.length,p50:sorted[Math.floor(sorted.length*.5)]??null,p95:sorted[Math.floor(sorted.length*.95)]??null,max:sorted.at(-1)??null};}

// Profiled runs are deliberately separate from the three latency samples.
for(const mode of ['a4','screen'] as const)for(const catalog of [100,10000])for(const sample of [1,2,3,4])test(`${mode} 12 cards ${catalog} catalog ${sample===4?'profiled':'latency'} sample ${sample}`,async({page})=>{
 const profiled=sample===4,errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const original=await setup(page,catalog,mode);
 const client=await page.context().newCDPSession(page);await client.send('Emulation.setCPUThrottlingRate',{rate:4});await instrument(page);
 let tracing=false,profiling=false;
 try{
  if(profiled){await client.send('Profiler.enable');await client.send('Profiler.setSamplingInterval',{interval:1000});await client.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,v8',transferMode:'ReturnAsStream'});tracing=true;await client.send('Profiler.start');profiling=true;}
  await begin(page,'name');const name=page.getByRole('textbox',{name:'角色姓名',exact:true});await name.fill('');await name.pressSequentially('NameAgain',{delay:20});await expect(name).toHaveValue('NameAgain');await expect.poll(async()=>{const saved=await records(page);return saved.characters.find((c:any)=>c.id===saved.activeId)?.name;}).toBe('NameAgain');await page.waitForTimeout(150);
  await page.evaluate(()=>(window as any).__dropMark('name-persistence-confirmed-by-runner'));
  if(profiled){await stopProfile(client,'name.cpuprofile');profiling=false;}
  const row=page.locator('.catalog-row').filter({hasText:'测试法师'}).first(),target=page.locator('.identity-class');await row.scrollIntoViewIfNeeded();
  if(profiled){await client.send('Profiler.start');profiling=true;}
  await begin(page,'drop');await row.dragTo(target);await expect(target).toContainText('测试法师');
  await expect.poll(async()=>{const saved=await records(page);return saved.characters.find((c:any)=>c.id===saved.activeId)?.selections.some((s:any)=>s.entry.name==='初始特性');}).toBe(true);
  await page.evaluate(()=>(window as any).__dropMark('drop-persistence-confirmed-by-runner'));await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.waitForTimeout(200);
  if(profiled){await stopProfile(client,'class-drop.cpuprofile');profiling=false;await finishTrace(client);tracing=false;}
  const metrics=await page.evaluate(()=>(window as any).__dropMetrics),phases=metrics.phases as {name:string;start:number}[];
  const phase=(name:string)=>phases.find(p=>p.name===name)?.start;
  const start=phase('pointerup-capture');expect(start).toBeDefined();for(const key of ['pointerup-bubble','class-dom-observed','drop-first-raf','drop-two-raf','drop-persistence-confirmed-by-runner'])expect(phase(key),key).toBeDefined();
  expect(metrics.inputs.length).toBeGreaterThanOrEqual(9);expect(metrics.inputs.every((e:any)=>Number.isFinite(e.dispatch)&&Number.isFinite(e.twoRaf))).toBe(true);
  const saved=await records(page),active=saved.characters.find((c:any)=>c.id===saved.activeId);expect(active.runtime.resources.manual).toEqual(original[0].runtime.resources.manual);expect(saved.characters.slice(1)).toEqual(original.slice(1));expect(errors).toEqual([]);
  const nameEnd=phase('name-persistence-confirmed-by-runner')!,dropEnd=phase('drop-persistence-confirmed-by-runner')!;
  const result={build:test.info().project.name,baselineSha:process.env.DND_PERF_BASELINE_SHA,mode,cards:12,catalog,sample,profiled,cpuThrottle:4,browserVersion:page.context().browser()?.version(),limitations:['Two requestAnimationFrame callbacks are a frame-opportunity proxy, not measured presentation/INP.','Window capture-to-bubble bounds event dispatch, not React-only work.','Persistence confirmation includes runner/IndexedDB polling overhead.','Profiled samples have observer/profiler overhead and must not be pooled with unprofiled latency samples.','Fresh contexts repeat first class addition; no warm repeated add/remove or real-player claim.'],name:{dispatch:stats(metrics.inputs.map((e:any)=>e.dispatch)),twoRaf:stats(metrics.inputs.map((e:any)=>e.twoRaf)),latestInput:metrics.inputs.at(-1),longtasks:stats(metrics.longtasks.filter((e:any)=>e.start<nameEnd).map((e:any)=>e.duration))},drop:{fromPointerUp:Object.fromEntries(phases.filter(p=>p.start>=start!).map(p=>[p.name,p.start-start!])),longtasks:stats(metrics.longtasks.filter((e:any)=>e.start+e.duration>=start!&&e.start<=dropEnd).map((e:any)=>e.duration))},raw:metrics};
  writeFileSync(test.info().outputPath('metrics.json'),JSON.stringify(result,null,2));console.log('CLASS_DROP_PERF232 '+JSON.stringify({...result,raw:undefined}));
  await page.reload();await expect(name).toHaveValue('NameAgain');await expect(target).toContainText('测试法师');const reloaded=await records(page);expect(reloaded.characters.find((c:any)=>c.id===reloaded.activeId).runtime.resources.manual).toEqual(original[0].runtime.resources.manual);expect(reloaded.characters.slice(1)).toEqual(original.slice(1));
 }finally{if(profiling)await stopProfile(client,'interrupted.cpuprofile').catch(()=>{});if(tracing)await finishTrace(client).catch(()=>{});await client.detach();}
});
