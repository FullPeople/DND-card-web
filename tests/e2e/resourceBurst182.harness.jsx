import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../../src/ui/App';
import {SourceProvider} from '../../src/ui/SourceName';
import {DMConsole} from '../../src/ui/WorkbenchConsole';
import {EntryDragProvider} from '../../src/ui/DragEntry';
import {newCharacter} from '../../src/core/model';
import {evaluate} from '../../src/core/engine';
import {syncAutoResources} from '../../src/core/resources';
import {exportOwlbear} from '../../src/core/export';
import {expandChanges} from '../../src/platform/document-delta';
import {getWorkbench,workbenchCharacterId} from '../../src/platform/workbench';
import '../../src/ui/style.css';
import '../../src/ui/workspace.css';
import '../../src/ui/workbench.css';
import '../../src/ui/overview.css';
import '../../src/ui/library.css';
import '../../src/ui/cardAtmosphere.css';
import '../../src/ui/libraryRefine.css';
import '../../src/ui/characterPages.css';
import '../../src/ui/suiteTheme.css';
import '../../src/ui/responsive177.css';

const mode=new URLSearchParams(location.search).get('mode')||'overview';
const monster=mode==='monster';
const protocol='full-suite-workbench/v1',session='resource-burst182';
const target=monster?{key:'room:monster:goblin',cardId:'',itemId:'goblin',kind:'monster',name:'哥布林',write:true,role:'GM',locked:false,pinned:false,slug:''}:{key:'room:card:hero',cardId:'hero',itemId:'token-hero',kind:'character',name:'伊芙',write:true,role:'GM',locked:false,pinned:false,slug:''};
let sequence=0,revision=1;
let native=newCharacter();native.id=workbenchCharacterId(target);native.name=target.name;native.baseHp=30;native.runtime.hp=20;
native.runtime.resources={rage:{id:'rage',name:'怒气',type:'count',current:Number(new URLSearchParams(location.search).get('rage')||5),max:5},focus:{id:'focus',name:'战术点',type:'count',current:3,max:5}};
if(new URLSearchParams(location.search).has('caster')){
 native.selections.push({id:'class:mage',level:3,quantity:1,equipped:false,entry:{id:'class:mage',name:'测试法师',english:'Test Mage',kind:'class',source:'XPHB',edition:'2024',packId:'test',revision:'1',entries:['自动法术位同步测试职业。'],raw:{casterProgression:'full',spellcastingAbility:'int',hd:{faces:6},classTableGroups:[{rowsSpellProgression:[[2],[3],[4,2]]}]}}});
 syncAutoResources(native);
}
const clone=v=>structuredClone(v);
// Keep the host's legacy document independent from native. Save requests must
// update both via their real wire deltas; re-exporting here would mask omissions.
let legacyDocument=exportOwlbear(native,evaluate(native));
const inventory={revision:1,publicId:'public:room',access:'room',silent:false,containers:{'public:room':{id:'public:room',name:'公共仓库',kind:'public',revision:1,write:true,columns:4,capacity:20,items:Object.values(native.runtime.resources).map((r,i)=>({id:r.id,kind:'resource',name:r.name,quantity:r.current,max:r.max,type:r.type,locked:false,unlimited:false,slot:9000+i,revision:1}))}}};
const fixture=window.resource182={requests:[],pending:[],delayedAcks:[],notices:[],errors:[],history:[],samples:[],wireEvents:[]};
const send=(type,rest={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol,session,hostStarted:182,type,...rest}}));
function snapshot(){const document={...clone(legacyDocument),dnd_card_web:clone(native),_suiteRevision:revision};return {sequence:++sequence,state:{...target,...(!monster?{documentRevision:revision}:{}),resources:clone(Object.values(native.runtime.resources)),conditions:[],stats:{health:native.runtime.hp,'max health':30,'temporary health':0,'armor class':10}},...(!monster?{document}:{}),...(mode==='public'?{inventory:clone(inventory)}:{})};}
function choice(snap){return {...snap.state,id:monster?'goblin':'hero',inScene:true,player:'玩家',passive:12,coins:{gp:2}};}
function catalog(snap=snapshot(),stale=false){send('catalog',{sequence:stale?snap.sequence:++sequence,role:'GM',cards:mode==='public'||monster?[]:[choice(snap)],monsters:monster?[choice(snap)]:[],enabled:{inventory:mode==='public',resourceTracker:true},visibility:{wiki:true,monsters:true},...(mode==='public'?{inventory:clone(snap.inventory||inventory)}:{})});}
fixture.authority=()=>clone(native.runtime.resources);
fixture.slotState=()=>({resource:clone(native.runtime.resources['spell-slot:1']),settings:clone(native.spellSettings?.slots?.['1']),legacy:clone(legacyDocument.spellcasting.spell_slots['1'])});
fixture.stockAuthority=()=>clone(inventory);
fixture.workbench=()=>clone({resources:getWorkbench().cards[0]?.resources,document:getWorkbench().document});
fixture.showCard=()=>send('navigate');
fixture.confirmNext=(holdAck=false)=>{
 const request=fixture.pending.shift();if(!request)throw Error('No pending resource/save request');
 if(request.type==='inventory'){
  const op=request.operation,c=inventory.containers[op.container];
  if(op.expected[c.id]!==c.revision){const message='Host rejected stale inventory revision';fixture.errors.push(message);send('ack',{requestId:request.requestId,ok:false,message});return;}
  if(op.action!=='update')throw Error('Unexpected inventory action '+op.action);
  const row=c.items.find(r=>r.id===op.id),from=row.quantity;Object.assign(row,clone(op.patch));row.revision++;c.revision++;inventory.revision++;
  if(from!==row.quantity)fixture.notices.push({id:row.id,from,to:row.quantity,requestId:request.requestId});
  fixture.history.push(snapshot());const ack={requestId:request.requestId,ok:true,result:{inventory:clone(inventory),historyId:op.operationId}};if(holdAck)fixture.delayedAcks.push(ack);else send('ack',ack);return;
 }
 const before=clone(native.runtime.resources);
 if(request.type==='resource'){
  const live=native.runtime.resources[request.resourceId]||null;
  if(JSON.stringify(live)!==JSON.stringify(request.expected)){const message='Host rejected stale expected resource';fixture.errors.push(message);send('ack',{requestId:request.requestId,ok:false,message});return;}
  if(request.resource)native.runtime.resources[request.resourceId]=clone(request.resource);else delete native.runtime.resources[request.resourceId];
  legacyDocument=exportOwlbear(native,evaluate(native));
 }else{
  native=request.delta?expandChanges(native,request.delta.native,'after'):clone(request.native);
  legacyDocument=request.delta?expandChanges(legacyDocument,request.delta.legacy,'after'):clone(request.data);
 }
 for(const id of new Set([...Object.keys(before),...Object.keys(native.runtime.resources)])){const from=before[id]?.current,to=native.runtime.resources[id]?.current;if(from!==to)fixture.notices.push({id,from,to,requestId:request.requestId});}
 revision++;const snap=snapshot();fixture.history.push(clone(snap));fixture.wireEvents.push({type:'ack',requestId:request.requestId,resources:clone(snap.state.resources)});
 const ack={requestId:request.requestId,ok:true,result:{snapshot:snap}};
 if(holdAck)fixture.delayedAcks.push(ack);else send('ack',ack);
 return clone(snap);
};
fixture.deliverAck=()=>{const ack=fixture.delayedAcks.shift();if(!ack)throw Error('No delayed ACK');send('ack',ack);};
fixture.stale=(index,type='both')=>{const snap=clone(fixture.history[index]);if(!monster)snap.sequence=++sequence;if(type!=='catalog')send('selection',snap);if(type!=='selection')catalog(snap,monster);};
fixture.remote=(id,patch)=>{if(mode==='public'){const c=inventory.containers[inventory.publicId],row=c.items.find(r=>r.id===id);Object.assign(row,patch);row.revision++;c.revision++;inventory.revision++;}else{native.runtime.resources[id]={...native.runtime.resources[id],...patch};legacyDocument=exportOwlbear(native,evaluate(native));revision++;}const snap=snapshot();fixture.history.push(clone(snap));send('selection',snap);catalog(snap);};
fixture.refresh=()=>{const snap=snapshot();send('selection',snap);catalog(snap);};
window.addEventListener('workbench-error',event=>fixture.errors.push(typeof event.detail==='string'?event.detail:event.detail?.message));
window.addEventListener('message',event=>{
 const m=event.data;if(event.source!==window||m?.protocol!==protocol||m.session!==session)return;
 if(m.type==='ping'){send('pong');return;}
 if(m.type==='select'){send('selection',snapshot());send('navigate');return;}
 if(m.type!=='resource'&&m.type!=='save'&&m.type!=='inventory')return;
 fixture.requests.push(clone(m));fixture.pending.push(clone(m));fixture.wireEvents.push({type:m.type,resourceId:m.resourceId,resource:clone(m.resource),delta:clone(m.delta)});
});
const initial=snapshot();fixture.history.push(clone(initial));send('ready');catalog(initial);send('selection',initial);
if(mode==='card')createRoot(document.getElementById('test-root')).render(<SourceProvider><App/></SourceProvider>);
else {document.body.style.cssText='height:auto;overflow:auto';document.getElementById('test-root').style.cssText='width:1050px;padding:12px';createRoot(document.getElementById('test-root')).render(<SourceProvider><EntryDragProvider character={newCharacter()} receive={()=>{}}><DMConsole navigate={()=>{}}/></EntryDragProvider></SourceProvider>);}
const sample=()=>{fixture.samples.push({at:performance.now(),rows:[...document.querySelectorAll('.resource179-row')].map(row=>({name:row.querySelector('strong')?.textContent,value:row.querySelectorAll('.resource-pips button[aria-pressed=true]').length}))});if(fixture.samples.length>3000)fixture.samples.shift();requestAnimationFrame(sample);};requestAnimationFrame(sample);
fixture.ready=true;
