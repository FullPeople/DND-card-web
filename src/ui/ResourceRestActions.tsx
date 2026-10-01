import {lazy,Suspense,useEffect,useState} from 'react';
import type {Character} from '../core/model';
const RestPopup=lazy(()=>import('./RestPopup').then(module=>({default:module.RestPopup})));

/** Keep the rest dialog outside dismissible resource menus so choosing a rest
 * closes that menu without losing the confirmation or mutating resources. */
export function useResourceRest(c:Character,edit:(update:(draft:Character)=>void)=>void){
 const [kind,setKind]=useState<'short'|'long'>();
 useEffect(()=>setKind(undefined),[c.id]);
 return {open:setKind,popup:kind?<Suspense fallback={<p role="status">正在加载休息选项…</p>}><RestPopup c={c} kind={kind} edit={edit} close={()=>setKind(undefined)}/></Suspense>:null};
}

export function ResourceRestActions({disabled,open,c}:{disabled:boolean;open:(kind:'short'|'long')=>void;c:Character}){
 const receipt=c.runtime.rests?.last;
 return <footer className="resource-menu-rests" aria-label="休息选项"><span>休息恢复</span><button type="button" disabled={disabled} onClick={()=>open('short')}>短休</button><button type="button" disabled={disabled} onClick={()=>open('long')}>长休</button>{receipt&&<p className="rest-result" role="status">{receipt.kind==='short'?'短休':'长休'}：生命 {receipt.hpBefore} → {receipt.hpAfter}{receipt.rolls.length>0&&` · ${receipt.rolls.map(r=>`d${r.faces}(${r.value})`).join(' + ')}`}</p>}</footer>;
}
