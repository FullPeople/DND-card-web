import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {WorkbenchBar} from '../../../src/ui/Workbench';
import {WorkbenchPanel} from '../../../src/ui/WorkbenchPanel';
import {useWorkbench} from '../../../src/platform/workbench';
import '../../../src/ui/style.css';
import '../../../src/ui/workbench.css';
import '../../../src/ui/suiteTheme.css';
// Same production navigation and iframe bridge; host replies are synthetic.
const w=window as any;let sequence=0,role='GM',sceneReady=true;
w.requests=[];w.presentations=[];w.hold=false;w.failNext=false;
const subscriptions=new Map<string,any>();
w.emit=(type:string,rest={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'text-effects-test',type,...rest}}));
w.reply=(request:any,result:any,error='')=>w.emit('ack',{requestId:request.requestId,ok:!error,...(error?{message:error}:{result})});
w.refresh=(next='GM')=>{role=next;w.emit('catalog',{sequence:++sequence,role,enabled:{musicBoard:true,dice:false},cards:[],monsters:[]});for(const r of subscriptions.values())if(r.args[0]==='player')w.emit('panelEvent',{panel:r.panel,instance:r.instance,event:'player',data:{role}});};
w.scene=(next:boolean)=>{sceneReady=next;for(const r of subscriptions.values())if(r.args[0]==='sceneReady')w.emit('panelEvent',{panel:r.panel,instance:r.instance,event:'sceneReady',data:next});};
function reply(request:any){
 const method=request.method,args=request.args||[];
 if(method==='init'){w.reply(request,{roomId:'synthetic-room',playerId:'synthetic-gm',preferences:{}});return;}
 if(method==='player.getConnectionId'){w.reply(request,'synthetic-connection');return;}
 if(method==='player.getRole'){w.reply(request,role);return;}
 if(method==='scene.isReady'){w.reply(request,sceneReady);return;}
 if(method==='subscribe'){subscriptions.set(request.instance+args[0],request);w.reply(request,true);return;}
 if(method==='dispose'){for(const[key,r]of subscriptions)if(r.instance===request.instance)subscriptions.delete(key);w.reply(request,true);return;}
 if(method==='broadcast.sendMessage'){
  if(w.hold){w.held=request;return;}if(w.failNext){w.failNext=false;w.reply(request,undefined,'模拟播放失败');return;}
  const data=args[1];if(!data.preview&&role!=='GM'){w.reply(request,undefined,'只有 DM 可以向房间播放');return;}
  if(data.action==='stop'){document.querySelector(`iframe[data-id="${data.id}"]`)?.remove();w.reply(request,{requestId:data.requestId,ok:true,id:data.id,preview:data.preview});return;}
  const now=Date.now(),config=data.config,total=w.textEffectDuration?w.textEffectDuration(config):config.enter+config.hold+config.exit,event={version:1,id:crypto.randomUUID(),sceneKey:crypto.randomUUID(),order:++sequence,issuedAt:now,startsAt:now+500,expiresAt:now+1000+total,config};
  document.querySelectorAll('.native-effect').forEach(el=>el.remove());
  const frame=document.createElement('iframe');frame.className='native-effect';frame.dataset.id=event.id;frame.title=data.preview?'自己的枭熊画面':'模拟房间画面';frame.src='/suite-dev/text-effect-display.html#'+encodeURIComponent(JSON.stringify({...event,modalId:'com.obr-suite/text-effects/display/'+event.id,reduced:false}));document.body.append(frame);setTimeout(()=>frame.remove(),event.expiresAt-now);
  w.presentations.push({preview:data.preview,event});w.reply(request,{requestId:data.requestId,ok:true,id:event.id,preview:data.preview,expiresAt:event.expiresAt});return;
 }
 w.reply(request,true);
}
w.release=()=>{w.hold=false;if(w.held){reply(w.held);w.held=undefined;}};
window.addEventListener('message',event=>{const r=event.data;if(event.source!==window||r.protocol!=='full-suite-workbench/v1'||r.session!=='text-effects-test')return;if(r.type==='ping'){w.emit('pong');return;}if(r.type!=='panelRpc'||!r.requestId)return;w.requests.push(r);reply(r);});
function Fixture(){const[page,setPage]=useState('console'),wb=useWorkbench();return <><WorkbenchBar online={wb.online} target={undefined} message="本地验证" page={page} change={setPage} save={()=>{}}/>{page==='textEffects'?<WorkbenchPanel panel="textEffects" close={()=>setPage('console')}/>:<p>本地验证：选择“文字演出”。</p>}</>;}
w.emit('ready');w.refresh();createRoot(document.getElementById('root')!).render(<Fixture/>);
