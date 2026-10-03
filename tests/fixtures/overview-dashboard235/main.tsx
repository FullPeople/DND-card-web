import {createRoot} from 'react-dom/client';
import {DMConsole} from '../../../src/ui/WorkbenchConsole';
import {EntryDragProvider} from '../../../src/ui/DragEntry';
import {SourceProvider} from '../../../src/ui/SourceName';
import {newCharacter,type Character} from '../../../src/core/model';
import {evaluate} from '../../../src/core/engine';
import {exportLinkedOwlbear} from '../../../src/core/export';
import {expandChanges} from '../../../src/platform/document-delta';
import '../../../src/ui/style.css';
import '../../../src/ui/workspace.css';
import '../../../src/ui/workbench.css';
import '../../../src/ui/overview.css';
import '../../../src/ui/cardAtmosphere.css';
import '../../../src/ui/characterPages.css';
import '../../../src/ui/suiteTheme.css';
import '../../../src/ui/responsive177.css';
const key='overview-dashboard235',protocol='full-suite-workbench/v1',session='overview-dashboard235';
function make(){const c=newCharacter();c.id='authored235';c.name='原创资源布局测试';c.runtime.resources={focus:{name:'专注',current:3,max:5,type:'count'},'spell-slot:1':{name:'1环法术位',current:2,max:4,type:'count'},'spell-slot:2':{name:'2环法术位',current:1,max:3,type:'count'}};c.quickbarLayout={order:[],hidden:[],attacks:{x:0,y:0,w:4,h:6,page:0,style:'segments',resourceArea:true,split:.4},widgets:{focus:{x:8,y:0,w:4,h:3,page:0,style:'ring',contentScale:1.2},'spell-slot:1':{x:0,y:0,w:7,h:4,page:0,style:'poolpips'}}};return c;}
let c:Character=JSON.parse(localStorage.getItem(key)||'null')||make(),sequence=0,write=true,fail=false;
const send=(type:string,rest:Record<string,unknown>={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol,session,hostStarted:235,type,...rest}}));
const document=()=>({...exportLinkedOwlbear(c,evaluate(c)),_suiteRevision:c.revision});
const card=()=>({id:'hero',itemId:'token-hero',kind:'character',name:c.name,write,locked:false,inScene:true,conditions:[],resources:Object.entries(c.runtime.resources).map(([id,r])=>({...r,id})),stats:{health:10,'max health':20,'temporary health':0,'armor class':10},resourceWidgets:c.quickbarLayout?.widgets,resourceAttacks:c.quickbarLayout?.attacks,resourceHidden:c.quickbarLayout?.hidden,classSummary:c.selections.filter(row=>row.entry.kind==='class'),documentRevision:c.revision});
function refresh(){send('catalog',{sequence:++sequence,role:'PLAYER',cards:[card()],monsters:[],enabled:{resourceTracker:true},visibility:{wiki:true,monsters:true}});}
const fixture=(window as any).dashboard235={requests:[] as any[],authority:()=>structuredClone(c),remote:()=>{c.runtime.resources.focus.current=1;c.notes='远端编辑保留';c.revision++;refresh();},readonly:()=>{write=false;refresh();},fail:()=>{fail=true;}};
window.addEventListener('message',event=>{const m=event.data;if(event.source!==window||m?.protocol!==protocol||m.session!==session)return;if(m.type==='ping'){send('pong');return;}if(!['readCard','save','resource'].includes(m.type))return;fixture.requests.push(m);setTimeout(()=>{if(m.type==='readCard'){send('ack',{requestId:m.requestId,ok:true,result:{document:document()}});return;}if(fail){fail=false;send('ack',{requestId:m.requestId,ok:false,message:'测试保存失败，草稿保留'});return;}if(m.type==='save')c=m.delta?expandChanges(c,m.delta.native,'after'):m.native;else {c.runtime.resources[m.resourceId]={...m.resource};c.revision++;}localStorage.setItem(key,JSON.stringify(c));send('ack',{requestId:m.requestId,ok:true,result:{snapshot:{sequence:++sequence,state:{...card(),key:'room:card:hero',cardId:'hero',role:'PLAYER',pinned:false,slug:''},document:document()}}});refresh();},100);});
createRoot(globalThis.document.getElementById('root')!).render(<SourceProvider><EntryDragProvider character={newCharacter()} receive={()=>{}}><DMConsole navigate={()=>{}}/></EntryDragProvider></SourceProvider>);send('ready');refresh();
const style=globalThis.document.createElement('style');style.textContent='body{height:auto;overflow:auto}#root{padding:12px;max-width:900px;margin:auto}.dm-console{overflow:visible}.console-roster{grid-template-columns:minmax(0,450px)!important}';globalThis.document.head.append(style);
