import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Character} from '../core/model';
import {evaluate} from '../core/engine';
import type {CardChoice} from '../platform/workbench';
import {readResourceDashboard,saveResourceDashboard} from '../platform/resourceDashboard';
const ResourceDashboard=lazy(()=>import('./ResourceDashboard').then(module=>({default:module.ResourceDashboard})));

/** Load the complete, authoritative card rather than manufacturing one from a
 * roster projection. Closing the editor never commits its detached draft. */
export function OverviewResourceDashboard({card,gm,disabled,initialResourceId,close}:{card:CardChoice;gm:boolean;disabled:boolean;initialResourceId:string;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[character,setCharacter]=useState<Character>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const node=dialog.current!,focus=document.activeElement;node.showModal();return()=>{node.close();if(focus instanceof HTMLElement&&focus.isConnected)focus.focus();};},[]);
 useEffect(()=>{let active=true;setError('');setCharacter(undefined);void readResourceDashboard(card).then(value=>{if(active)setCharacter(value);}).catch(error=>{if(active)setError(String(error));});return()=>{active=false;};},[card.id,attempt]);
 const derived=useMemo(()=>character?evaluate(character):undefined,[character]);
 return createPortal(<dialog ref={dialog} className="dialog" aria-label="仪表盘" onCancel={event=>{event.preventDefault();close();}}><div className="dialog-head"><h2>{card.name} · 仪表盘</h2><button type="button" aria-label="关闭弹窗" onClick={close}>×</button></div><div className="dialog-body">{error?<div role="alert">{error}<button type="button" disabled={disabled} onClick={()=>setAttempt(value=>value+1)}>重试读取</button></div>:character&&derived?<Suspense fallback={<p role="status">正在载入仪表盘…</p>}><ResourceDashboard c={character} d={derived} edit={()=>{}} inspect={()=>{}} viewport={{page:0,height:210}} resourcesOnly initialResourceId={initialResourceId} disabled={disabled} gm={gm} onSave={async(base,draft)=>{const next=await saveResourceDashboard(card,base,draft);setCharacter(next);return next;}}/></Suspense>:<p role="status">正在读取角色资源…</p>}</div></dialog>,document.body);
}
