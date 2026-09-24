import {createContext,useCallback,useContext,useEffect,useState,type ReactNode,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Entry} from '../core/model';
import {inWorkbench,workbenchRequest} from '../platform/workbench';
import {reportWorkbenchError} from './CopyDiagnostic';

export function shareEntry(entry:Entry){
 // Only the selected rule text is shared, never the containing character.
 const {id,kind,name,english,source,edition,packId,revision,page,entries}=entry;
 const raw=Object.fromEntries(['level','school','time','range','components','duration','value','weight','rarity','_category','_custom'].filter(key=>key in entry.raw).map(key=>[key,entry.raw[key]]));
 void workbenchRequest('showEntry',{key:undefined,itemId:undefined,entry:{id,kind,name,english,source,edition,packId,revision,page,entries,raw}}).catch(reportWorkbenchError);
}
export function ShareEntryButton({entry,done}:{entry:Entry;done:()=>void}){
 return inWorkbench?<button role="menuitem" onClick={()=>{shareEntry(entry);done();}}>向全员展示</button>:null;
}
const EntryMenuContext=createContext<((event:MouseEvent,entry:Entry)=>void)|undefined>(undefined);
export const useEntryMenu=()=>useContext(EntryMenuContext);
export function EntryMenuProvider({children}:{children:ReactNode}){
 const [menu,setMenu]=useState<{entry:Entry;x:number;y:number}>();
 useEffect(()=>{if(!menu)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(undefined);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[!!menu]);
 const open=useCallback((event:MouseEvent,entry:Entry)=>{event.preventDefault();event.stopPropagation();setMenu({entry,x:Math.max(8,Math.min(innerWidth-245,event.clientX)),y:Math.max(8,Math.min(innerHeight-125,event.clientY))});},[]);
 return <EntryMenuContext.Provider value={inWorkbench?open:undefined}>{children}{menu&&createPortal(<div className="stock-menu-shade" onPointerDown={e=>{if(e.target===e.currentTarget){e.preventDefault();setMenu(undefined);}}} onContextMenu={e=>e.preventDefault()}><div className="stock-menu" role="menu" aria-label="词条操作" style={{left:menu.x,top:menu.y}}><strong>{menu.entry.name}</strong><ShareEntryButton entry={menu.entry} done={()=>setMenu(undefined)}/></div></div>,document.body)}</EntryMenuContext.Provider>;
}
