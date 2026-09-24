import './style.css';
import {packet,valid} from './protocol';
const bridge=document.querySelector<HTMLIFrameElement>('#bridge')!,panel=document.querySelector<HTMLIFrameElement>('#panel')!;
const base=new URL(location.href);base.hostname='127.0.0.1';const params=new URLSearchParams({demo:'1',parentOrigin:location.origin});
bridge.src=new URL(`background.html?${params}`,base).href;panel.src=new URL(`index.html?${params}`,base).href;
function send(type:string,extra:Record<string,unknown>={}){bridge.contentWindow?.postMessage(packet(type,extra),base.origin);}
document.getElementById('scene-write')!.onclick=()=>send('demo-edit',{hp:Number((document.getElementById('scene-hp') as HTMLInputElement).value)});
document.getElementById('hide-panel')!.onclick=()=>{panel.src='about:blank';};document.getElementById('show-panel')!.onclick=()=>{panel.src=new URL(`index.html?${params}`,base).href;};
document.getElementById('scene-gone')!.onclick=()=>send('demo-gone');document.getElementById('deny')!.onclick=()=>send('demo-deny');
window.addEventListener('message',e=>{if(e.source!==bridge.contentWindow||e.origin!==base.origin||!valid(e.data)||e.data.type!=='demo-state')return;document.getElementById('scene-state')!.textContent=`生命 ${e.data.hp} / ${e.data.max}`;});
