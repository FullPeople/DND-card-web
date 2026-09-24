import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ResourceRow} from '../../src/ui/ResourceRow.tsx';
import {StatInput} from '../../src/ui/StatInput.tsx';

const root=createRoot(document.getElementById('test-root'));
let current=6,confirmed=6,hp=10;
const fixture=window.controls182={requests:[],reconciled:[]};
fixture.watchStat=()=>{fixture.statWrites=[];const input=document.querySelector('input[aria-label="生命值"]');const property=Object.getOwnPropertyDescriptor(input,'value');Object.defineProperty(input,'value',{...property,set(value){fixture.statWrites.push(String(value));property.set.call(this,value);}});};
const defer=(kind,value)=>new Promise((resolve,reject)=>fixture.requests.push({kind,value,resolve,reject}));
window.addEventListener('workbench-operation-reconciled',event=>fixture.reconciled.push(event.detail.requestId));
fixture.publish=(next={})=>{if('current' in next)current=next.current;if('confirmed' in next)confirmed=next.confirmed;if('hp' in next)hp=next.hp;render();};
fixture.finish=(index,result)=>fixture.requests[index].resolve(result);
fixture.fail=(index,uncertain=true)=>fixture.requests[index].reject(Object.assign(Error('测试确认尚未送达'),{uncertain,requestId:'controls182-'+index,statField:'health'}));
fixture.receipt=(index,kind,value)=>window.dispatchEvent(new CustomEvent('workbench-operation-result',{detail:{requestId:'controls182-'+index,ok:true,result:{snapshot:{state:kind==='resource'?{resources:[{id:'fuel',current:value}]}:{stats:{health:value}}}}}}));
function render(){flushSync(()=>root.render(<main>
 <ResourceRow resource={{id:'fuel',name:'法术点',type:'number',current,max:20}} confirmedCurrent={confirmed} enabled gm change={value=>defer('resource',value)}/>
 <label>生命值<StatInput value={hp} label="生命值" commit={value=>defer('stat',value)}/></label>
 <button id="outside">其他区域</button>
</main>));}
render();
