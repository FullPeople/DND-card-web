import {createRoot} from 'react-dom/client';
import {DMConsole} from '../../../src/ui/WorkbenchConsole';
import {EntryDragProvider} from '../../../src/ui/DragEntry';
import {SourceProvider} from '../../../src/ui/SourceName';
import {newCharacter} from '../../../src/core/model';
import {WIDGET_STYLES} from '../../../src/core/resourceWidgets';
import '../../../src/ui/style.css';
import '../../../src/ui/workspace.css';
import '../../../src/ui/workbench.css';
import '../../../src/ui/overview.css';
import '../../../src/ui/cardAtmosphere.css';
import '../../../src/ui/characterPages.css';
import '../../../src/ui/suiteTheme.css';
import '../../../src/ui/responsive177.css';
const key='compact-overview222',protocol='full-suite-workbench/v1',session='compact-overview222';
const make=()=>({id:'hero',itemId:'token-hero',kind:'character',name:'原创总览测试',write:true,locked:false,inScene:true,conditions:[],resources:[
 ...Array.from({length:9},(_,i)=>({id:`spell-slot:${i+1}`,name:`${i+1}环法术位`,current:i===0?3:2,max:i===0?4:3,type:'count'})),
 {id:'pact-slot:2',name:'2环契约位',current:1,max:2,type:'count'},
 {id:'food',name:'食物',current:4,max:8,type:'number'}, {id:'water',name:'饮水',current:5,max:10,type:'number'},
 {id:'focus',name:'专注',current:2,max:3,type:'count'},
],resourceWidgets:{'spell-slot:1':{x:0,y:0,w:8,h:5,page:0,style:'poolchips',color:'#436978'},'pact-slot:2':{x:0,y:0,w:4,h:2,page:0,style:'poolpips',color:'#8c5463',icon:'shield'},food:{x:0,y:0,w:6,h:3,page:0,style:'poolbars',color:'#527448',members:['food','water'],label:'远行物资'},focus:{x:0,y:0,w:3,h:2,page:0,style:'pips',color:'#926041',icon:'flame'}},stats:{health:20,'max health':30,'temporary health':0,'armor class':16},passive:14,coins:{gp:12}});
let card=JSON.parse(localStorage.getItem(key)||'null')||make(),sequence=0,role='GM';
const inventory={revision:1,publicId:'public:fixture',access:'room',silent:false,containers:{'public:fixture':{id:'public:fixture',name:'原创公共仓库',kind:'public',revision:1,write:true,columns:4,capacity:20,items:WIDGET_STYLES.map((style,i)=>({id:style,kind:'resource',name:`公共${i+1}`,quantity:style==='ready'?1:2,max:style==='ready'?1:3,type:'number',locked:false,unlimited:false,slot:9000+i,revision:1,presentation:{style,color:'#436978',icon:'leaf'}}))}}};
const send=(type:string,rest:Record<string,unknown>={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol,session,hostStarted:222,type,...rest}}));
const snapshot=()=>({sequence:++sequence,state:{...card,key:'room:card:hero',cardId:card.id,role,pinned:false,slug:''}});
function refresh(){send('catalog',{sequence:++sequence,role,cards:[card],monsters:[],enabled:{inventory:true,resourceTracker:true},inventory});}
const fixture=(window as any).overview222={requests:[] as any[],refresh,authority:()=>card,remote:(id:string,current:number)=>{card.resources.find((r:any)=>r.id===id).current=current;refresh();},readonly:()=>{role='PLAYER';card.write=false;refresh();}};
window.addEventListener('message',event=>{const m=event.data;if(event.source!==window||m?.protocol!==protocol||m.session!==session)return;if(m.type==='ping'){send('pong');return;}if(m.type!=='resource'&&m.type!=='inventory')return;fixture.requests.push(m);setTimeout(()=>{if(m.type==='resource'){card.resources=card.resources.map((r:any)=>r.id===m.resourceId?m.resource:r);localStorage.setItem(key,JSON.stringify(card));send('ack',{requestId:m.requestId,ok:true,result:{snapshot:snapshot()}});}else{const row=inventory.containers['public:fixture'].items.find(r=>r.id===m.operation.id)!;Object.assign(row,m.operation.patch);row.revision++;inventory.containers['public:fixture'].revision++;inventory.revision++;send('ack',{requestId:m.requestId,ok:true,result:{inventory}});}refresh();},500);});
createRoot(document.getElementById('root')!).render(<SourceProvider><EntryDragProvider character={newCharacter()} receive={()=>{}}><DMConsole navigate={()=>{}}/></EntryDragProvider></SourceProvider>);
send('ready');refresh();
const style=document.createElement('style');style.textContent='body{height:auto;overflow:auto}#root{padding:12px;max-width:900px;margin:auto}.dm-console{overflow:visible}.console-roster{grid-template-columns:minmax(0,370px)!important}.public-resources{max-width:700px}.public-resources+.resource-overview{margin-top:16px}';document.head.append(style);
