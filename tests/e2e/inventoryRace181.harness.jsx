import React from 'react';
import {createRoot} from 'react-dom/client';
import {WorkbenchInventory} from '../../src/ui/StockBoard';
import {EntryDragProvider} from '../../src/ui/DragEntry';
import {newCharacter} from '../../src/core/model';
import {previewInventory} from '../../src/core/inventory';
window.requests=[];window.held=[];window.errors=[];window.slotFrames=[];
window.inventory={revision:1,publicId:'public:room',silent:false,containers:{'card:hero':{id:'card:hero',name:'测试背包',kind:'card',write:true,revision:1,columns:4,capacity:24,items:[{id:'coin',kind:'currency',coin:'gp',name:'金币',quantity:6,slot:0,revision:1},{id:'silver',kind:'currency',coin:'sp',name:'银币',quantity:3,slot:1,revision:1}]}}};
let sequence=1;
window.emit=(type,rest={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:structuredClone({protocol:'full-suite-workbench/v1',session:'inventory181',type,...rest})}));
window.refresh=()=>window.emit('catalog',{sequence:++sequence,role:'GM',enabled:{inventory:true},cards:[],monsters:[],inventory:window.inventory});
window.addEventListener('workbench-error',event=>window.errors.push(event.detail));
window.addEventListener('message',event=>{const request=event.data;if(event.source!==window||!request.requestId||request.type==='ack')return;if(request.type==='inventory'){window.requests.push(request);window.held.push(request);}else window.emit('ack',{requestId:request.requestId,ok:true,result:{}});});
window.respondNext=(reject=false)=>{
 const request=window.held.shift();if(!request)throw Error('No held inventory request');const op=request.operation,c=window.inventory.containers[op.container];
 if(reject){window.emit('ack',{requestId:request.requestId,ok:false,message:'背包已被其他人修改，请重试'});return;}
 for(const move of op.positions||[]){const row=c.items.find(item=>item.id===move.id);if(!row||![op.observedSlots?.[move.id],move.slot].includes(row.slot))throw Error('Observed slot conflict in test host');}
 window.inventory=previewInventory(window.inventory,op);window.inventory.revision++;
 window.emit('ack',{requestId:request.requestId,ok:true,result:{inventory:window.inventory,historyId:op.operationId}});
};
window.remoteQuantity=()=>{const c=window.inventory.containers['card:hero'];c.items[0].quantity=11;c.items[0].revision++;c.items[1].quantity=9;c.revision++;window.inventory.revision++;window.refresh();};
new MutationObserver(()=>{const item=document.querySelector('[data-stock-id="coin"]');if(item)window.slotFrames.push(Number(item.getAttribute('data-stock-slot')));}).observe(document.getElementById('test-root'),{subtree:true,attributes:true,childList:true});
createRoot(document.getElementById('test-root')).render(<EntryDragProvider character={newCharacter()} receive={()=>{}}><WorkbenchInventory id="card:hero"/></EntryDragProvider>);
window.emit('ready');window.refresh();
