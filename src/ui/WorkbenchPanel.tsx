import {applyTone,applyNightMode} from '../platform/tone';
import {useEffect,useMemo,useRef,useState} from 'react';
import {workbenchRequest,useWorkbench} from '../platform/workbench';
export function WorkbenchPanel({panel,close,section}:{section?:'features';panel:'settings'|'music'|'studio'|'table';close:()=>void}){
 const [tableMode,setTableMode]=useState<'full'|'compact'>('full');
 const ref=useRef<HTMLIFrameElement>(null),instance=useMemo(()=>crypto.randomUUID(),[]),wb=useWorkbench(),latestClose=useRef(close);latestClose.current=close;
 useEffect(()=>{
  const channel='workbench-panel-frame/v1';
  const receive=(event:MessageEvent)=>{
   if(event.source!==ref.current?.contentWindow||event.origin!==location.origin||event.data?.channel!==channel)return;
   const m=event.data;if(typeof m.night==='boolean'){applyNightMode(m.night);return;}if(m.tone){applyTone(m.tone);return;}if(m.method==='broadcast.sendMessage'&&m.args?.[0]==='com.obr-suite/supporter-overlay/visibility'){window.dispatchEvent(new CustomEvent('suite-supporters',{detail:m.args[1]}));ref.current?.contentWindow?.postMessage({channel,id:m.id,result:true},location.origin);return;}if(m.navigate){window.dispatchEvent(new CustomEvent('workbench-panel-navigate',{detail:m.navigate}));return;}if(m.close){latestClose.current();return;}if(m.error){window.dispatchEvent(new CustomEvent('workbench-error',{detail:m.error}));return;}if(typeof m.id!=='string'||typeof m.method!=='string')return;if(m.method==='broadcast.sendMessage'&&((panel==='music'&&m.args?.[1]?.type==='close')||(panel==='table'&&m.args?.[1]?.command?.type==='close'))){if(panel==='table')void workbenchRequest('panelRpc',{panel,instance,method:m.method,args:m.args}).catch(()=>{});ref.current?.contentWindow?.postMessage({channel,id:m.id,result:true},location.origin);latestClose.current();return;}
   if(panel==='table'&&m.method==='broadcast.sendMessage'&&m.args?.[1]?.command?.type==='display'){void workbenchRequest('panelRpc',{panel,instance,method:m.method,args:m.args}).then(()=>{ref.current?.contentWindow?.postMessage({channel,id:m.id,result:true},location.origin);setTableMode(m.args[1].command.mode==='compact'?'compact':'full');}).catch(error=>window.dispatchEvent(new CustomEvent('workbench-error',{detail:String(error)})));return;}
   if(panel==='settings'&&m.method==='broadcast.sendMessage'&&m.args?.[0]==='com.obr-suite/music-board:toggle'){ref.current?.contentWindow?.postMessage({channel,id:m.id,result:true},location.origin);window.dispatchEvent(new CustomEvent('workbench-panel-navigate',{detail:'music'}));return;}
   void workbenchRequest('panelRpc',{key:undefined,itemId:undefined,panel,instance,method:m.method,args:m.args}).then(result=>ref.current?.contentWindow?.postMessage({channel,id:m.id,result},location.origin)).catch(error=>ref.current?.contentWindow?.postMessage({channel,id:m.id,error:String(error)},location.origin));
  };
  const forward=(event:Event)=>{const m=(event as CustomEvent).detail;if(m.panel===panel&&m.instance===instance)ref.current?.contentWindow?.postMessage({channel,...m},location.origin);};
  window.addEventListener('message',receive);window.addEventListener('workbench-panel-event',forward);
  return()=>{if(panel==='settings')window.dispatchEvent(new CustomEvent('suite-supporters',{detail:{visible:false}}));window.removeEventListener('message',receive);window.removeEventListener('workbench-panel-event',forward);void workbenchRequest('panelRpc',{panel,instance,method:'dispose',args:[]}).catch(()=>{});};
 },[panel,instance]);
 useEffect(()=>{if(!['music','studio'].includes(panel)||!wb.online)return;const tick=()=>void workbenchRequest('panelRpc',{panel,instance,method:'broadcast.sendMessage',args:['com.obr-suite/music-board:ready',{workbench:true},{destination:'LOCAL'}]}).catch(()=>{});tick();const timer=setInterval(tick,5000);return()=>clearInterval(timer);},[panel,instance,wb.online]);
 const title=({settings:section==='features'?'功能开关':'设置',music:'音乐',studio:'音乐工作室',table:'三龙牌'})[panel];
 const source=new URL(`../workbench-panels/${panel==='studio'?'studio/index':panel}.html`,location.href.split('#')[0]);source.searchParams.set('instance',instance);if(panel==='settings'){source.searchParams.set('workbench','1');if(section)source.searchParams.set('section',section);}if(panel==='table')source.searchParams.set('mode',tableMode);source.searchParams.set('v',import.meta.url.split('/').pop()||'');
 return <section className="workbench-panel" aria-label={`${title}工作区`} data-offline={!wb.online}><iframe ref={ref} title={`Full Suite ${title}`} src={source.href}/></section>;
}

export function MusicWorkspace({close}:{close:()=>void}){const [view,setView]=useState<'music'|'studio'>('music');return <section className="music-workspace"><nav className="music-workspace-tabs">{([['music','播放控制'],['studio','音乐库与音效']] as const).map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}</nav><div hidden={view!=='music'}><WorkbenchPanel panel="music" close={close}/></div><div hidden={view!=='studio'}>{view==='studio'&&<WorkbenchPanel panel="studio" close={close}/>}</div></section>;}
