import React from 'react';
import {createRoot} from 'react-dom/client';
import {DMConsole} from '../../src/ui/WorkbenchConsole';
import {WorkbenchMonster} from '../../src/ui/Workbench';
import {EntryDragProvider,EntryDraggable} from '../../src/ui/DragEntry';
import {newCharacter} from '../../src/core/model';
import {previewInventory} from '../../src/core/inventory';

const condition={id:'poisoned',name:'中毒',english:'Poisoned',kind:'condition',source:'XPHB',edition:'both',packId:'test',revision:'1',entries:['测试状态'],raw:{}};
const item={...condition,id:'rope',kind:'item',name:'旅人绳索',entries:['测试绳索'],raw:{weight:2,value:100}};
const makeCard=(id,kind='character')=>({id,itemId:kind==='monster'?id:'token-'+id,kind,name:kind==='monster'?'试验怪物':'角色'+id,locked:false,write:true,inScene:true,conditions:[],resources:[{id:'fuel',name:'能量',type:'number',current:3,max:6}],stats:{health:12,'max health':20,'temporary health':0,'armor class':12}});
window.cards=[makeCard('hero0'),makeCard('hero1')];window.monsters=[makeCard('beast','monster')];
window.cards[0].conditions=[{id:'prone',name:'倒地'}];
window.requests=[];
window.inventory={revision:1,publicId:'public:room',silent:false,containers:Object.fromEntries(['public:room','card:hero0','card:hero1','monster:beast'].map(id=>[id,{id,name:id==='public:room'?'公共仓库':'背包',kind:id.startsWith('public:')?'public':id.startsWith('monster:')?'monster':'character',write:true,revision:1,columns:4,items:id==='public:room'?[{id:'stock-rope',kind:'item',name:item.name,entry:item,quantity:2,slot:0,revision:1}]:[]}]))};
let sequence=1;
window.emit=(type,rest={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'drag180',type,...rest}}));
window.refresh=()=>{window.emit('catalog',{sequence:++sequence,role:'GM',enabled:{inventory:true},cards:window.cards,monsters:window.monsters,inventory:window.inventory});if(window.harnessMode==='monster')window.renderMode('monster');};
window.addEventListener('message',event=>{
 const request=event.data;if(event.source!==window||!request.requestId||request.type==='ack')return;
 window.requests.push(request);
 if(request.type==='inventory'){
  window.inventory=previewInventory(window.inventory,request.operation);
  window.emit('ack',{requestId:request.requestId,ok:true,result:{inventory:window.inventory}});window.refresh();return;
 }
 if(request.type==='condition'){
  const find=id=>[...window.cards,...window.monsters].find(card=>(card.kind==='monster'?card.itemId:'card:'+card.id)===id),card=find(request.itemId);
  if(card){if(request.action==='add')card.conditions.push(request.condition);else card.conditions=card.conditions.filter(row=>row.id!==request.condition.id);if(request.action==='transfer')find(request.to)?.conditions.push(request.condition);}
  window.emit('ack',{requestId:request.requestId,ok:true,result:{snapshots:[...window.cards,...window.monsters].map(card=>({sequence:++sequence,state:{...card,key:card.id,cardId:card.kind==='character'?card.id:undefined,role:'GM',pinned:false,slug:''}}))}});window.refresh();return;
 }
 window.emit('ack',{requestId:request.requestId,ok:true,result:{}});
});
const root=createRoot(document.getElementById('test-root'));
window.renderMode=mode=>{window.harnessMode=mode;root.render(<EntryDragProvider character={newCharacter()} receive={()=>{}} editing><div className="drag180-sources"><EntryDraggable id="wiki-condition" entry={condition}>中毒条目</EntryDraggable><EntryDraggable id="wiki-item" entry={item}>绳索条目</EntryDraggable></div>{mode==='monster'?<section className="sheet-pane mobile-active" style={{height:'900px'}}><WorkbenchMonster target={{...window.monsters[0],key:'beast',role:'GM',slug:'beast'}} raw={{name:'试验怪物',source:'CUSTOM',str:12,dex:10,con:10,int:6,wis:10,cha:5}} online onLink={()=>{}}/></section>:<DMConsole navigate={()=>{}}/>}</EntryDragProvider>);};
window.renderMode('overview');window.emit('ready');window.refresh();
