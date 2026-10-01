import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {newCharacter,type Character} from '../../../src/core/model';
import {evaluate} from '../../../src/core/engine';
import {newAutomationState} from '../../../src/core/automation/state';
import {normalizeWidget} from '../../../src/core/resourceWidgets';
import {Quickbar} from '../../../src/ui/Quickbar';
import {ResourceDashboard,type DashboardViewport} from '../../../src/ui/ResourceDashboard';
import {ResourceModuleEditor} from '../../../src/ui/ResourceModuleEditor';
import {SheetEditContext} from '../../../src/ui/SheetEdit';
import '../../../src/ui/style.css';
import '../../../src/ui/workbench.css';
import '../../../src/ui/resource179.css';

const scenario=new URLSearchParams(location.search).get('scenario')||'default';
const key=`resource-dashboard220:${scenario}`;
function make(){
 const c=newCharacter();c.id='dashboard220-original-fixture';c.name='原创仪表盘验收';c.automation=newAutomationState();
 c.quickbarActions=[{id:'sword',name:'练习长剑',attack:'+5',damage:'1d8+3'},{id:'bow',name:'练习短弓',attack:'+4',damage:'1d6+2'}];
 c.runtime.resources={
  'spell-slot:1':{name:'1环法术位',current:3,max:4,type:'count'},
  'spell-slot:2':{name:'2环法术位',current:2,max:3,type:'count'},
  'spell-slot:3':{name:'3环法术位',current:1,max:2,type:'count'},
  'pact-slot:2':{name:'2环契约位',current:1,max:2,type:'count'},
  surge:{name:'动作如潮',current:3,max:5,type:'count'},
  focus:{name:'晨星专注',current:1,max:1,type:'count'},
  coins:{name:'冒险储备',current:1874,max:9999,unlimited:true,type:'number'},
 };
 c.spellSettings={ability:'int',attackBonus:0,dcBonus:0,mode:'prepared',capacity:0,prepared:[],slots:{'1':{max:4,used:1},'2':{max:3,used:1},'3':{max:2,used:1}}};
 c.quickbarLayout={order:[],hidden:[],attacks:normalizeWidget({x:0,y:0,w:3,h:6,page:0,style:'segments'}),widgets:{
  'spell-slot:1':normalizeWidget({x:3,y:0,w:9,h:2,page:0,style:'pool'}),
  'pact-slot:2':normalizeWidget({x:3,y:2,w:4,h:2,page:0,style:'pool'}),
  surge:normalizeWidget({x:7,y:2,w:5,h:2,page:0,style:'pips',color:'#527880',icon:'spark'}),
  focus:normalizeWidget({x:0,y:0,w:3,h:3,page:1,style:'ring'}),
  coins:normalizeWidget({x:3,y:0,w:4,h:3,page:1,style:'fraction'}),
 }};
 if(scenario==='empty'){c.baseHp=12;c.runtime.hp=3;c.runtime.resources={};c.quickbarLayout.widgets={};}
 if(scenario==='resize'){
  c.runtime.resources={probe:{name:'八点缩放样本',current:2,max:5,type:'number'}};
  c.quickbarLayout.widgets={probe:normalizeWidget({x:5,y:2,w:4,h:2,page:0,style:'segments',color:'#527880'})};
 }
 if(scenario==='interaction'){
  c.runtime.resources={alpha:{name:'左侧测试资源',current:2,max:5,type:'count'},beta:{name:'右侧测试资源',current:3,max:6,type:'count'},peer:{name:'另一页测试资源',current:4,max:8,type:'count'}};
  c.quickbarLayout.widgets={alpha:normalizeWidget({x:3,y:0,w:3,h:2,page:0,style:'segments',color:'#527880'}),beta:normalizeWidget({x:6,y:0,w:3,h:2,page:0,style:'pips',color:'#8a7652'}),peer:normalizeWidget({x:3,y:0,w:3,h:3,page:1,style:'diamond'})};
 }
 return c;
}
function restore(){try{return JSON.parse(localStorage.getItem(key)||'null') as Character||make();}catch{return make();}}
function Fixture(){
 const [c,setC]=useState(restore),state=useRef(c),[open,setOpen]=useState(false),[resource,setResource]=useState(''),[edits,setEdits]=useState(0);
 const [viewport,setViewport]=useState<DashboardViewport>({page:0,width:418,height:130});
 const dialog=useRef<HTMLDialogElement>(null);
 function edit(update:(draft:Character)=>void){const next=structuredClone(state.current);update(next);state.current=next;localStorage.setItem(key,JSON.stringify(next));setC(next);setEdits(count=>count+1);}
 useEffect(()=>{localStorage.setItem(key,JSON.stringify(state.current));const capture=(event:Event)=>setViewport((event as CustomEvent<DashboardViewport>).detail);const configure=(event:Event)=>setResource((event as CustomEvent<string>).detail);window.addEventListener('resource-canvas-page',capture);window.addEventListener('edit-character-resource',configure);return()=>{window.removeEventListener('resource-canvas-page',capture);window.removeEventListener('edit-character-resource',configure);};},[]);
 useEffect(()=>{if(open||resource)dialog.current?.showModal();else dialog.current?.close();},[open,resource]);
 const close=()=>{setOpen(false);setResource('');};
 return <main className="dashboard-fixture"><h1>资源仪表盘 · 实际组件交互</h1><button type="button" onClick={()=>{const next=make();state.current=next;setC(next);localStorage.setItem(key,JSON.stringify(next));}}>重置测试卡</button><SheetEditContext.Provider value={false}><div className="fixture-quickbar"><Quickbar c={c} d={evaluate(c)} edit={edit} inspect={()=>{}} manage={()=>setOpen(true)} manageQuickbar={()=>setOpen(true)}/></div><dialog className="dialog" aria-label={open?'仪表盘':'资源配置'} ref={dialog} onCancel={event=>{event.preventDefault();close();}}><div className="dialog-head"><h2>{open?'仪表盘':'资源配置'}</h2><button type="button" aria-label="关闭弹窗" onClick={close}>×</button></div><div className="dialog-body">{open?<ResourceDashboard c={c} d={evaluate(c)} edit={edit} inspect={()=>{}} disabled={false} gm={true} viewport={viewport}/>:resource?<ResourceModuleEditor c={c} id={resource} edit={edit} close={close} disabled={false} gm={true}/>:null}</div></dialog></SheetEditContext.Provider><output hidden id="fixture-data">{JSON.stringify(c)}</output><output hidden id="fixture-edits">{edits}</output><output hidden id="fixture-viewport">{JSON.stringify(viewport)}</output></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
const style=document.createElement('style');style.textContent=`body{margin:24px;background:#e0e2dc;font:14px system-ui}.dashboard-fixture{max-width:800px;margin:auto}.dashboard-fixture h1{font-size:18px}.dashboard-fixture>button{margin-bottom:14px}.fixture-quickbar{width:422px;max-width:100%;height:153px;background:#e9ece3;outline:2px solid #5b655d;border-radius:3px}.dashboard-fixture .dialog{padding:0;max-height:calc(100dvh - 24px)}.dashboard-fixture .dialog-head{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #b7c1b2;background:#f0f1eb}.dashboard-fixture .dialog-head h2{margin:0;font-size:18px}.dashboard-fixture .dialog-head button{font-size:19px;padding:0 6px}.dashboard-fixture .dialog-body{max-height:calc(100dvh - 92px);overflow:auto}@media(max-width:480px){body{margin:8px}.dashboard-fixture h1{font-size:16px}}`;document.head.append(style);
