import {useCallback,useEffect,useLayoutEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {RetainedSheetContexts} from './RetainedSheetContexts';
import {RetainedSheetAnimations} from './RetainedSheetAnimations';
import './retainedCardSheet.css';

type Row={id:string;host:HTMLDivElement;access:string|undefined;children:ReactNode;version:readonly unknown[];urgentVersion:readonly unknown[]};
type Snapshot={scope:unknown;rows:Row[]};
type Props={enabled:boolean;identity:string;scope:unknown;access:Readonly<Record<string,string|undefined>>;members:readonly {id:string}[];children:ReactNode;version:readonly unknown[];urgentVersion:readonly unknown[]};
const createHost=(stacked:boolean)=>{const host=document.createElement('div');host.className='retained-card-root';if(!stacked)host.style.display='contents';return host;};

/** Keep at most four opened sheets and their layout surfaces. Inactive surfaces
 * are clipped from hit testing and excluded from focus and input routing. */
export function RetainedCardSheet(props:Props){return props.enabled?<OpenedCardSheets {...props}/>:<>{props.children}</>;}
function OpenedCardSheets({identity,scope,access,members,children,version,urgentVersion}:Props){
 const stacked=useRef('inert' in HTMLElement.prototype).current;
 useEffect(()=>{
  const hidden=(target:EventTarget|null)=>target instanceof Element&&target.closest('[data-retained-card-active="false"]');
  let direction=0,redirecting=false;
  const key=(event:KeyboardEvent)=>{direction=event.key==='Tab'?(event.shiftKey?-1:1):0;};
  const block=(event:Event)=>{if(hidden(event.target)){event.preventDefault();event.stopImmediatePropagation();}};
  const focus=(event:FocusEvent)=>{
   if(redirecting||!hidden(event.target))return;
   event.stopImmediatePropagation();
   const all=[...document.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href],[tabindex]')].filter(node=>node.tabIndex>=0&&!node.matches(':disabled')&&node.getClientRects().length);
   const index=all.indexOf(event.target as HTMLElement),ordered=direction<0?all.slice(0,index).reverse():all.slice(index+1);
   const target=direction?ordered.find(node=>!hidden(node)):undefined;
   redirecting=true;(event.target as HTMLElement).blur();(target||document.querySelector<HTMLElement>('.character-tabs [aria-selected="true"]'))?.focus({preventScroll:true});redirecting=false;
  };
  document.addEventListener('keydown',key,true);document.addEventListener('focusin',focus,true);
  const events=['pointerdown','pointerup','click','dblclick','contextmenu','input','change','keydown'];
  for(const name of events)document.addEventListener(name,block,true);
  return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('focusin',focus,true);for(const name of events)document.removeEventListener(name,block,true);};
 },[]);
 const committed=useRef<Snapshot>({scope,rows:[]});
 const previous=committed.current;
 const valid=previous.scope===scope;
 const ids=new Set(members.map(row=>row.id));
 // A permission change invalidates that owner's view immediately. An unrelated
 // card's permission receipt must not discard every opened sheet.
 const rows=valid?previous.rows.filter(row=>ids.has(row.id)&&row.access===access[row.id]):[];
 const found=rows.find(row=>row.id===identity);
 const host=found?.host||createHost(stacked);
 const current:Row={id:identity,host,access:access[identity],children,version,urgentVersion};
 const next=[...rows.filter(row=>row.id!==identity).slice(-3),current];
 // The mount ref is attached before portal descendants run layout effects, so
 // geometry is measured in the live viewport, including on a warm return.
 const membership=JSON.stringify(next.map(row=>row.id).sort());
 const mount=useCallback((node:HTMLDivElement|null)=>{
  if(!node)return;
  if(!stacked){if(node.firstChild!==host)node.replaceChildren(host);return;}
  const retained=new Set(next.map(row=>row.host));
  for(const child of [...node.children])if(!retained.has(child as HTMLDivElement))child.remove();
  for(const row of next){
   const active=row.host===host,value=String(active);
   if(row.host.dataset.retainedCardActive!==value){row.host.dataset.retainedCardActive=value;row.host.setAttribute('aria-hidden',String(!active));}
   if(row.host.parentElement!==node)node.append(row.host);
  }
 },[host,membership,stacked]);
 useLayoutEffect(()=>{committed.current={scope,rows:next};});
 return <><div className={stacked?'retained-card-stack':'retained-card-mount'} style={stacked?undefined:{display:'contents'}} ref={mount}/>{next.map(row=>createPortal(<><RetainedSheetAnimations host={row.host} active={row.id===identity}/><RetainedSheetContexts active={row.id===identity} version={row.version} urgentVersion={row.urgentVersion}>{row.children}</RetainedSheetContexts></>,row.host,row.id))}</>;
}
