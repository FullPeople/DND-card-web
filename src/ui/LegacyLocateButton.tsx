import {useEffect,useRef,useState} from 'react';
import {LocateIcon} from './LocateButton';
const channel='full-suite-card-location/v1';
export function LegacyLocateButton(){
 const [available,setAvailable]=useState(false),[pending,setPending]=useState(false),request=useRef<string|undefined>(undefined),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.source!==parent||e.origin!==location.origin||e.data?.channel!==channel)return;setAvailable(e.data.available===true);if(e.data.requestId===request.current){clearTimeout(timer.current);setPending(false);request.current=undefined;if(e.data.error)window.dispatchEvent(new CustomEvent('workbench-error',{detail:String(e.data.error)}));}},query=()=>parent.postMessage({channel,type:'status'},location.origin);window.addEventListener('message',receive);query();return()=>{clearTimeout(timer.current);window.removeEventListener('message',receive);};},[]);
 return <button type="button" className="card-lock card-locate" aria-label="定位到角色" title={available?'定位到角色':'角色未在当前场景中绑定'} disabled={!available||pending} onClick={()=>{if(pending||!available)return;request.current=crypto.randomUUID();setPending(true);parent.postMessage({channel,type:'locate',requestId:request.current},location.origin);timer.current=setTimeout(()=>{request.current=undefined;setPending(false);},10000);}}><LocateIcon/></button>;
}
