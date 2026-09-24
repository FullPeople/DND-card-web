import {test,expect} from '@playwright/test';

test('a late confirmed inventory receipt enters undo history exactly once after an uncertain result',async({page})=>{
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await page.route('**/inventory-late181',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module">
 import {requestInventory,getWorkbench} from '/src/platform/workbench.ts';
 import {useActionHistory,travelHistory} from '/src/platform/actionHistory.ts';
 import React from '/node_modules/.vite-release182/deps/react.js';import ReactDOM from '/node_modules/.vite-release182/deps/react-dom_client.js';
 const protocol='full-suite-workbench/v1',session='late181',inventory={revision:1,publicId:'public:test',access:'test',silent:false,containers:{box:{id:'box',kind:'public',name:'仓库',revision:1,write:true,columns:4,capacity:20,items:[{id:'row',name:'物品',kind:'item',slot:0,quantity:1,revision:1}]}}};
 const emit=(type,data={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol,session,hostStarted:181,type,...data}}));
 let request;window.sent=0;window.undos=0;
 window.addEventListener('message',e=>{const m=e.data;if(m?.type!=='inventory'||m.protocol!==protocol)return;window.sent++;if(m.operation.action==='history'){window.undos++;emit('ack',{requestId:m.requestId,ok:true,result:{historyId:'undone',inventory:{...inventory,revision:3}}});return;}request=m;emit('ack',{requestId:m.requestId,ok:false,uncertain:true,message:'结果暂时未知'});});
 function View(){const history=useActionHistory();return React.createElement('button',{disabled:!history.undo,onClick:()=>travelHistory()},'撤销');}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(View));
 emit('ready');emit('catalog',{sequence:1,cards:[],monsters:[],role:'GM',enabled:{},inventory});
 window.start=()=>requestInventory({action:'move',container:'box',positions:[{id:'row',slot:5}],expected:{box:1}}).catch(e=>({uncertain:e.uncertain}));
 window.confirm=()=>{const next=structuredClone(inventory);next.revision=2;next.containers.box.revision=2;next.containers.box.items[0].slot=5;emit('ack',{requestId:request.requestId,ok:true,result:{historyId:request.operation.operationId,inventory:next}});};window.ready=true;
 </script>`}));
 await page.goto('/inventory-late181#suite=late181&bridge='+encodeURIComponent('http://127.0.0.1:5182'));await page.waitForFunction(()=>(window as any).ready);
 expect(await page.evaluate(()=>(window as any).start())).toEqual({uncertain:true});await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
 await page.evaluate(()=>{(window as any).confirm();(window as any).confirm();});await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
 // Busy state precedes delivery of the asynchronous postMessage request.
 await expect.poll(()=>page.evaluate(()=>({sent:(window as any).sent,undos:(window as any).undos}))).toEqual({sent:2,undos:1});
});
