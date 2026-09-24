import {test,expect} from '@playwright/test';

test('character batches issued around ACK settlement all wake and finish without a lost subsequent save',async({page})=>{
 await page.route('**/save-race179',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Save queue boundary test</title><script type="module">
 import {patchWorkbenchStats,workbenchCharacterId} from '/src/platform/workbench.ts';
 import {newCharacter} from '/src/core/model.ts';
 import {evaluate} from '/src/core/engine.ts';
 import {exportOwlbear} from '/src/core/export.ts';
 import {expandChanges} from '/src/platform/document-delta.ts';
 const protocol='full-suite-workbench/v1',session='save-race179';let sequence=0;const docs=new Map(),targets=new Map(),requests=[],timings=[];
 const emit=(type,rest={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol,session,hostStarted:179,type,...rest}}));
 window.addEventListener('message',e=>{const m=e.data;if(e.source!==window||m.protocol!==protocol||m.type!=='save')return;requests.push(m);const started=performance.now(),target=targets.get(m.key),previous=docs.get(m.key),nextNative=m.delta?expandChanges(previous.dnd_card_web,m.delta.native,'after'):m.native;
 const next={...exportOwlbear(nextNative,evaluate(nextNative)),dnd_card_web:nextNative,_suiteRevision:previous._suiteRevision+1};docs.set(m.key,next);
 setTimeout(()=>{timings.push({key:m.key,delay:performance.now()-started});emit('ack',{requestId:m.requestId,ok:true,result:{snapshot:{sequence:++sequence,state:{...target,documentRevision:next._suiteRevision,stats:{health:nextNative.runtime.hp,'max health':30}},document:next}}});},target.delay);
 });
 emit('ready');
 window.runCase=async(index,delay)=>{const target={key:'r:card:'+index,itemId:'card:'+index,cardId:String(index),kind:'character',name:'Race '+index,role:'GM',write:true,documentRevision:1,stats:{health:1,'max health':30},resources:[],delay};targets.set(target.key,target);const before=newCharacter();before.id=workbenchCharacterId(target);before.baseHp=30;before.runtime.hp=1;const doc={...exportOwlbear(before,evaluate(before)),dnd_card_web:before,_suiteRevision:1};docs.set(target.key,doc);emit('selection',{sequence:++sequence,state:target,document:doc});
 const after=structuredClone(before);after.runtime.hp=2;after.revision++;const first=patchWorkbenchStats(before,after,evaluate(before),evaluate(after),target),start=requests.length;
 while(requests.length===start)await new Promise(r=>setTimeout(r,1));
 // The second edit starts just before/after the first receipt, and its debounce
 // can expire on either side of the previous promise's cleanup microtasks.
 await new Promise(r=>setTimeout(r,index%3===0?delay:index%3===1?Math.max(0,delay-5):delay+5));
 const last=structuredClone(after);last.runtime.hp=3;last.revision++;const second=patchWorkbenchStats(after,last,evaluate(after),evaluate(last),target);
 await Promise.race([Promise.all([first,second]),new Promise((_,reject)=>setTimeout(()=>reject(Error('save wake lost at case '+index)),1500))]);
 const n=requests.filter(r=>r.key===target.key).length;if(n!==2||docs.get(target.key).dnd_card_web.runtime.hp!==3)throw Error('wrong save count/value '+index+': '+n);return {requests:n,hp:docs.get(target.key).dnd_card_web.runtime.hp};};
 window.harnessReady=true;
 </script>`}));
 await page.goto('/save-race179#suite=save-race179&bridge='+encodeURIComponent(String(test.info().project.use.baseURL)));await page.waitForFunction(()=>(window as any).harnessReady);
 const results=[];for(let i=0;i<20;i++)results.push(await page.evaluate(async({i,delay})=>(window as any).runCase(i,delay),{i,delay:[0,25,79,81,120][i%5]}));expect(results).toEqual(Array.from({length:20},()=>({requests:2,hp:3})));
});
