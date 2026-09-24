import {useEffect,useRef,useState} from 'react';
export function SupporterEffect(){const [show,setShow]=useState(false),frame=useRef<HTMLIFrameElement>(null),state=useRef({visible:false,lang:'zh'});
 useEffect(()=>{const receive=(event:Event)=>{state.current={...state.current,...(event as CustomEvent).detail};setShow(state.current.visible);};window.addEventListener('suite-supporters',receive);return()=>window.removeEventListener('suite-supporters',receive);},[]);
 useEffect(()=>{if(!show)return;const update=()=>frame.current?.contentWindow?.postMessage({channel:'suite-supporter-effect',...state.current},location.origin);update();const timer=setInterval(update,500);return()=>clearInterval(timer);},[show]);
 return show?<iframe ref={frame} title="鸣谢特效" className="suite-supporter-effect" src={new URL('../workbench-panels/supporters.html?workbench=1',location.href.split('#')[0]).href} aria-hidden="true" tabIndex={-1}/>:null;
}
