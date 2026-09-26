import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Character,Entry} from '../core/model';
import {candidateReason} from '../core/engine';
import {SourceName} from './SourceName';
import {inWorkbench,workbenchRequest} from '../platform/workbench';
import {reportWorkbenchError} from './CopyDiagnostic';

export function shareEntry(entry:Entry){
 // Only the selected rule text is shared, never the containing character.
 const {id,kind,name,english,source,edition,packId,revision,page,entries}=entry;
 const raw=Object.fromEntries(['level','school','time','range','components','duration','meta','value','weight','rarity','type','weaponCategory','property','dmg1','dmg2','dmgType','reqAttune','ac','hp','speed','size','alignment','str','dex','con','int','wis','cha','save','skill','senses','passive','languages','cr','pb','initiative','trait','action','bonus','reaction','legendary','mythic','spellcasting','resist','immune','vulnerable','conditionImmune','legendaryActions','legendaryHeader','_legendaryGroup','_spellSources','_spellClasses','classes','races','backgrounds','feats','proficiency','startingProficiencies','startingEquipment','hd','spellcastingAbility','_category','_custom'].filter(key=>key in entry.raw).map(key=>[key,entry.raw[key]]));
 void workbenchRequest('showEntry',{key:undefined,itemId:undefined,entry:{id,kind,name,english,source,edition,packId,revision,page,entries,raw}}).catch(reportWorkbenchError);
}
export function ShareEntryButton({entry,done}:{entry:Entry;done:()=>void}){
 return inWorkbench?<button role="menuitem" onClick={()=>{shareEntry(entry);done();}}>向全员展示</button>:null;
}
export type EntryMenuOptions={origin?:'wiki'|'sheet';selectionId?:string;remove?:()=>void;canRemove?:boolean};
const EntryMenuContext=createContext<((event:MouseEvent,entry:Entry,options?:EntryMenuOptions)=>void)|undefined>(undefined);
export const useEntryMenu=()=>useContext(EntryMenuContext);
type EntryActions={character:Character;editing:boolean;writable?:boolean;add:(entry:Entry)=>void;inspect:(entry:Entry)=>void;remove?:(id:string)=>void};
const EntryActionsContext=createContext<((actions:EntryActions|undefined)=>void)|undefined>(undefined);
export function useEntryMenuActions(actions:Omit<EntryActions,'character'>&{character:Character|undefined}){
 const register=useContext(EntryActionsContext);
 useLayoutEffect(()=>{register?.(actions.character?{...actions,character:actions.character}:undefined);return()=>register?.(undefined);},[register,actions.character,actions.editing,actions.writable,actions.add,actions.inspect,actions.remove]);
}
export function EntryMenuProvider({children}:{children:ReactNode}){
 const [menu,setMenu]=useState<{entry:Entry;x:number;y:number;options:EntryMenuOptions;characterId?:string}>();
 const actions=useRef<EntryActions|undefined>(undefined),register=useCallback((value:EntryActions|undefined)=>{actions.current=value;},[]);
 useEffect(()=>{if(!menu)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(undefined);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[!!menu]);
 const open=useCallback((event:MouseEvent,entry:Entry,options:EntryMenuOptions={})=>{event.preventDefault();event.stopPropagation();setMenu({entry,options,characterId:actions.current?.character.id,x:Math.max(8,Math.min(innerWidth-245,event.clientX)),y:Math.max(8,Math.min(innerHeight-125,event.clientY))});},[]);
 const current=actions.current,sheet=menu?.options.origin==='sheet';
 const blocked=menu&&current?(current.character.id!==menu.characterId?'角色已切换，请重新打开菜单':current.writable===false?'当前角色只读':!current.editing&&!['condition','item'].includes(menu.entry.kind)?'请先开启编辑模式':sheet?undefined:menu.entry.kind==='monster'?'怪物请从图鉴放入场景':candidateReason(current.character,menu.entry)):undefined;
 const removable=sheet&&!blocked&&(menu?.options.canRemove??true)&&!!(menu?.options.remove||menu?.options.selectionId&&current?.remove);
 return <EntryActionsContext.Provider value={register}><EntryMenuContext.Provider value={open}>{children}{menu&&createPortal(<div className="stock-menu-shade" onPointerDown={e=>{if(e.target===e.currentTarget){e.preventDefault();setMenu(undefined);}}} onContextMenu={e=>e.preventDefault()}><div className="stock-menu" role="menu" aria-label="词条操作" style={{left:menu.x,top:Math.min(menu.y,innerHeight-210)}}><strong>{menu.entry.name}</strong><small><SourceName id={menu.entry.source}/></small><ShareEntryButton entry={menu.entry} done={()=>setMenu(undefined)}/>{current&&<>{sheet?<><button role="menuitem" onClick={()=>{current.inspect(menu.entry);setMenu(undefined);}}>在 Wiki 中查看</button><button role="menuitem" disabled={!removable} title={blocked||undefined} onClick={()=>{if(removable){if(menu.options.remove)menu.options.remove();else current.remove?.(menu.options.selectionId!);}setMenu(undefined);}}>移除</button></>:<button role="menuitem" disabled={!!blocked} title={blocked||undefined} onClick={()=>{if(!blocked)current.add(menu.entry);setMenu(undefined);}}>添加至角色卡</button>}{blocked&&<small>{blocked}</small>}</>}</div></div>,document.body)}</EntryMenuContext.Provider></EntryActionsContext.Provider>;
}
