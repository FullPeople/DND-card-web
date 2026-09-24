import './style.css';
import {adapter} from './adapter';
import {discover,originOf,packet,send,valid} from './protocol';
const status=document.querySelector<HTMLElement>('#status')!,open=document.querySelector<HTMLButtonElement>('#open')!,target=document.querySelector<HTMLInputElement>('#target')!;
target.value=new URL('./card.html',location.href).href;
let background:Window|null=null,itemId:string|undefined,child:Window|null=null,session='';const nonce=crypto.randomUUID();
function note(text:string,error=false){status.textContent=text;status.dataset.state=error?'error':'connected';}
window.addEventListener('message',e=>{if(e.origin!==location.origin||!valid(e.data))return;const m=e.data;
 if(m.type==='background'&&m.nonce===nonce){background=e.source as Window;open.disabled=!itemId;note(itemId?'后台已就绪。':'请在枭熊选择一个棋子。');}
 if(e.source!==background||m.session!==session)return;
 if(m.type==='permitted'){note('已打开独立窗口，可以关闭本面板。');}
 if(m.type==='permit-error'){note(String(m.message),true);child?.close();}
});
discover(window.parent,packet('discover',{nonce}),location.origin);
const discovery=setInterval(()=>{if(!background)discover(window.parent,packet('discover',{nonce}),location.origin);},700);
adapter().then(async runtime=>{async function selected(){try{itemId=await runtime.selected();if(itemId){const value=await runtime.read(itemId);document.querySelector('#token')!.textContent=value.name;note(background?'后台已就绪。':'正在寻找常驻后台…');}else{document.querySelector('#token')!.textContent='请选择一个棋子';note('请在枭熊选择一个棋子。');}open.disabled=!background||!itemId;}catch(e){itemId=undefined;open.disabled=true;note(String(e),true);}}runtime.onChange(()=>void selected());await selected();}).catch(e=>note(String(e),true));
open.onclick=()=>{
 if(!background||!itemId)return;const origin=originOf(target.value);if(!origin){note('请使用 HTTPS 地址或本机测试地址。',true);return;}
 session=crypto.randomUUID();const url=new URL(target.value);url.hash=new URLSearchParams({session,bridge:location.origin}).toString();
 // Must remain synchronous with the user's click to retain popup activation.
 child=window.open(url.href,'_blank','popup,width=600,height=820');
 if(!child){note('浏览器拦截了窗口，请允许此站点打开弹窗后重试。',true);return;}
 send(background,'permit',{session,itemId,target:url.href},location.origin);note('正在建立独立窗口连接…');
};
window.addEventListener('pagehide',()=>clearInterval(discovery));
