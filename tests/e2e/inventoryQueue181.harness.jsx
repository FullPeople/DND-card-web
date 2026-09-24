
 import {requestInventory,getWorkbench,useWorkbench} from '../../src/platform/workbench.ts';
 import React from 'react';
 import ReactDOM from 'react-dom/client';
 const {createRoot}=ReactDOM;
 const protocol='full-suite-workbench/v1',session='inventory-queue181';let sequence=0;
 const row=(id,slot)=>({id,slot,name:id,kind:'item',quantity:2,revision:1});
 let authority={revision:1,access:'test',publicId:'public:test',silent:false,containers:{'card:one':{id:'card:one',name:'背包',kind:'card',write:true,revision:1,columns:4,capacity:24,items:[row('rope',0),row('rations',1)]}}};
 const emit=(type,data={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol,session,hostStarted:181,type,...data}}));
 const catalog=()=>emit('catalog',{sequence:++sequence,role:'GM',cards:[],monsters:[],enabled:{},inventory:structuredClone(authority)});
 window.calls=[];window.moveSamples=[];window.receipts=[];window.firstAccepted=false;
 window.addEventListener('message',async e=>{const m=e.data;if(m?.protocol!==protocol||m.type!=='inventory')return;const op=m.operation,c=authority.containers['card:one'];window.calls.push(structuredClone(op));
  if(op.expected[c.id]!==c.revision)throw Error('stale container expectation '+op.expected[c.id]+' != '+c.revision);
  for(const p of op.positions){const r=c.items.find(r=>r.id===p.id);if(op.observedSlots[p.id]!==r.slot)throw Error('stale move observation');r.slot=p.slot;r.revision++;}c.revision++;authority.revision++;
  const receipt=structuredClone(authority);window.receipts.push(receipt);
  if(window.calls.length===1){window.firstAccepted=true;await new Promise(r=>setTimeout(r,90));c.items.find(r=>r.id==='rope').quantity=37;c.revision++;authority.revision++;catalog();await new Promise(r=>setTimeout(r,30));}
  if(window.pauseAck)await new Promise(resolve=>window.releaseAck=resolve);
  emit('ack',{requestId:m.requestId,ok:true,result:{inventory:receipt}});
 });
 function View(){const s=useWorkbench(),c=s.inventory?.containers['card:one'];return React.createElement('output',null,c?c.items.map(r=>r.id+':'+r.slot+':'+r.quantity).join('|'):'loading');}
 createRoot(document.getElementById('root')).render(React.createElement(View));emit('ready');catalog();
 window.move=slot=>{const c=getWorkbench().inventory.containers['card:one'];return requestInventory({action:'move',container:c.id,expected:{[c.id]:c.revision},positions:[{id:'rope',slot}]}).then(()=>({ok:true}),e=>({ok:false,message:e.message}));};
 const sample=()=>{const row=getWorkbench().inventory?.containers['card:one']?.items.find(r=>r.id==='rope');if(row)window.moveSamples.push({slot:row.slot,quantity:row.quantity});requestAnimationFrame(sample);};sample();
 window.run=async()=>{const one=window.move(5);while(!window.firstAccepted)await new Promise(r=>setTimeout(r,1));const two=window.move(9);await Promise.all([one,two]);return getWorkbench().inventory;};
 window.replay=()=>{emit('catalog',{sequence:++sequence,role:'GM',cards:[],monsters:[],enabled:{},inventory:window.receipts[0]});};
 window.switchScope=()=>{authority=structuredClone(authority);authority.publicId='public:another-scene';authority.access='new-access';authority.containers['card:one'].items.find(r=>r.id==='rope').slot=2;catalog();};window.value=()=>getWorkbench().inventory;window.ready=true;
