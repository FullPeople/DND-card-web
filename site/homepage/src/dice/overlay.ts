import {DiceRenderer} from './renderer';
import {mountAudioHost} from './audio-host';
import {CHANNEL,url,errorText,type Roll} from './types';
import './style.css';
import {materialCatalog} from './material-styles';
import {ResultBubbles} from './result-record';
export async function mountOverlay(container:HTMLElement,client:string){
  const audio=mountAudioHost(client);(window as any).__diceLabAudio=audio;
  // The result numbers use the same Cinzel variable font the native ships; canvas needs it loaded.
  const face=new FontFace('CinzelVariable',`url(${url('assets/fonts/Cinzel-Variable.ttf')})`,{weight:'400 900'});
  await face.load();document.fonts.add(face);
  const bus=new BroadcastChannel(`${CHANNEL}:local:${client}`);
  const response=await fetch(url('assets/catalog.json'));if(!response.ok)throw Error('加载骰子清单失败');
  const renderer=new DiceRenderer(container,materialCatalog(await response.json()),(event,detail)=>{bus.postMessage(event==='renderer-ready'?{type:'overlay-ready',detail}:{type:'renderer-event',event,detail})});
  const prepared=new Map<string,Roll>();
  const bubbles=new ResultBubbles(container);
  bus.onmessage=e=>{const p=e.data;try{
    if(p.type==='prepare'){prepared.set(p.roll.request.id,p.roll);bus.postMessage({type:'prepared',id:p.roll.request.id})}
    else if(p.type==='start'){const roll=prepared.get(p.id);if(!roll)throw Error('开播时缺少已验证轨迹');renderer.add(roll,p.at);prepared.delete(p.id)}
    else if(p.type==='discard')prepared.delete(p.id);
    else if(p.type==='clear')renderer.clear();
    else if(p.type==='quality')renderer.quality(p.value);
    else if(p.type==='reset-metrics')renderer.resetMetrics();
    else if(p.type==='result-bubble')bubbles.show(p.record,p.highlight===true);
  }catch(error){bus.postMessage({type:'renderer-event',event:'error',detail:{message:errorText(error)}})}};
  await audio.warmup();await renderer.init();return renderer;
}
if(location.pathname.endsWith('/overlay.html')){
  document.body.classList.add('overlay');
  const client=new URLSearchParams(location.search).get('client');
  if(!client)throw Error('缺少本地客户端身份');
  void mountOverlay(document.body,client).catch(error=>{new BroadcastChannel(`${CHANNEL}:local:${client}`).postMessage({type:'renderer-event',event:'error',detail:{message:errorText(error)}})});
}
