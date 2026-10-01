import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Character,Entry} from '../core/model';
import {candidateReason} from '../core/engine';
import {SourceName} from './SourceName';
import {inWorkbench,workbenchRequest} from '../platform/workbench';
import {reportWorkbenchError} from './CopyDiagnostic';

function shareEntry(entry:Entry){
 // Only the selected rule text is shared, never the containing character.
 const {id,kind,name,english,source,edition,packId,revision,page,entries}=entry;
 const raw=Object.fromEntries(['level','school','time','range','components','duration','meta','value','weight','rarity','type','weaponCategory','property','dmg1','dmg2','dmgType','reqAttune','ac','hp','speed','size','alignment','str','dex','con','int','wis','cha','save','skill','senses','passive','languages','cr','pb','initiative','trait','action','bonus','reaction','legendary','mythic','spellcasting','resist','immune','vulnerable','conditionImmune','legendaryActions','legendaryHeader','_legendaryGroup','_spellSources','_spellClasses','classes','races','backgrounds','feats','proficiency','startingProficiencies','startingEquipment','hd','spellcastingAbility','_category','_custom'].filter(key=>key in entry.raw).map(key=>[key,entry.raw[key]]));
 void workbenchRequest('showEntry',{key:undefined,itemId:undefined,entry:{id,kind,name,english,source,edition,packId,revision,page,entries,raw}}).catch(reportWorkbenchError);
}
const EntryReadContext=createContext<((entry:Entry)=>Entry|undefined)|undefined>(undefined);
export function ShareEntryButton({entry,done}:{entry:Entry;done:()=>void}){
 const resolve=useContext(EntryReadContext);
 return inWorkbench?<button role="menuitem" onClick={()=>{const current=resolve?.(entry);if(current)shareEntry(current);done();}}>向全员展示</button>:null;
}
export type EntryMenuOptions={origin?:'wiki'|'sheet';selectionId?:string;remove?:()=>void;canRemove?:boolean};
const EntryMenuContext=createContext<((event:MouseEvent,entry:Entry,options?:EntryMenuOptions)=>void)|undefined>(undefined);
export const useEntryMenu=()=>useContext(EntryMenuContext);
type EntryActions={character:Character;editing:boolean;writable?:boolean;scope?:string;readableEntry?:(entry:Entry)=>Entry|undefined;add:(entry:Entry)=>void;inspect:(entry:Entry)=>void;remove?:(id:string)=>void;removeCustom?:(entry:Entry)=>void;canRemoveCustom?:(entry:Entry)=>boolean};
const EntryActionsContext=createContext<((actions:EntryActions|undefined)=>void)|undefined>(undefined);
export function useEntryMenuActions(actions:Omit<EntryActions,'character'>&{character:Character|undefined}){
 const register=useContext(EntryActionsContext);
 // Updating one registration must not briefly unregister another render's
 // permissions. Cleanup belongs to the mounted owner, not every callback edit.
 useLayoutEffect(()=>{register?.(actions.character?{...actions,character:actions.character}:undefined);},[register,actions.character,actions.editing,actions.writable,actions.scope,actions.readableEntry,actions.add,actions.inspect,actions.remove,actions.removeCustom,actions.canRemoveCustom]);
 useLayoutEffect(()=>()=>register?.(undefined),[register]);
}
type EntryMenu={entry:Entry;x:number;y:number;options:EntryMenuOptions;characterId?:string;scope?:string;writable?:boolean;editing?:boolean};
const sameEntry=(a:Entry,b:Entry)=>a.id===b.id&&a.source===b.source&&a.packId===b.packId&&a.edition===b.edition;
function readable(actions:EntryActions|undefined,entry:Entry){
 if(!actions)return undefined;
 const current=actions.readableEntry?actions.readableEntry(entry):inWorkbench?undefined:entry;
 return current&&sameEntry(current,entry)?current:undefined;
}
const sameContext=(menu:EntryMenu,current:EntryActions|undefined)=>!!current&&menu.characterId===current.character.id&&menu.scope===current.scope&&menu.writable===current.writable&&menu.editing===current.editing;
function blockedFor(menu:EntryMenu,current:EntryActions,entry:Entry){return current.writable===false?'当前角色只读':!current.editing&&!['condition','item'].includes(entry.kind)?'请先开启编辑模式':menu.options.origin==='sheet'?undefined:entry.kind==='monster'?'怪物请从图鉴放入场景':candidateReason(current.character,entry);}
export function EntryMenuProvider({children}:{children:ReactNode}){
 const [menu,setMenu]=useState<EntryMenu>();
 const activeMenu=useRef<EntryMenu|undefined>(undefined),actions=useRef<EntryActions|undefined>(undefined);
 const close=useCallback(()=>{activeMenu.current=undefined;setMenu(undefined);},[]);
 const register=useCallback((value:EntryActions|undefined)=>{
  actions.current=value;const opened=activeMenu.current;
  if(opened&&(!sameContext(opened,value)||!readable(value,opened.entry)))close();
 },[close]);
 const resolve=useCallback((entry:Entry)=>readable(actions.current,entry),[]);
 useEffect(()=>{if(!menu)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[!!menu,close]);
 const open=useCallback((event:MouseEvent,entry:Entry,options:EntryMenuOptions={})=>{
  event.preventDefault();event.stopPropagation();const current=actions.current,next=readable(current,entry);if(!current||!next){close();return;}
  const opened={entry:next,options,characterId:current.character.id,scope:current.scope,writable:current.writable,editing:current.editing,x:Math.max(8,Math.min(innerWidth-245,event.clientX)),y:Math.max(8,Math.min(innerHeight-125,event.clientY))};activeMenu.current=opened;setMenu(opened);
 },[close]);
 // Every handler resolves again: retained DOM callbacks cannot act on a revoked
 // identity, and a newer revision is shared instead of the menu's old body.
 const act=(action:(current:EntryActions,entry:Entry,menu:EntryMenu)=>void)=>{
  const opened=activeMenu.current,current=actions.current,entry=opened&&readable(current,opened.entry);
  if(opened&&current&&entry&&sameContext(opened,current))action(current,entry,opened);close();
 };
 const current=actions.current,sheet=menu?.options.origin==='sheet';
 const blocked=menu&&current?blockedFor(menu,current,menu.entry):undefined;
 const removable=sheet&&!blocked&&(menu?.options.canRemove??true)&&!!(menu?.options.remove||menu?.options.selectionId&&current?.remove);
 return <EntryActionsContext.Provider value={register}><EntryReadContext.Provider value={resolve}><EntryMenuContext.Provider value={open}>{children}{menu&&createPortal(<div className="stock-menu-shade" onPointerDown={e=>{if(e.target===e.currentTarget){e.preventDefault();close();}}} onContextMenu={e=>e.preventDefault()}><div className="stock-menu" role="menu" aria-label="词条操作" style={{left:menu.x,top:Math.min(menu.y,innerHeight-210)}}><strong>{menu.entry.name}</strong><small><SourceName id={menu.entry.source}/></small><ShareEntryButton entry={menu.entry} done={close}/>{current&&<>{sheet?<><button role="menuitem" onClick={()=>act((a,e)=>a.inspect(e))}>在 Wiki 中查看</button><button role="menuitem" disabled={!removable} title={blocked||undefined} onClick={()=>act((a,e,m)=>{if(blockedFor(m,a,e)||(m.options.canRemove??true)===false)return;if(m.options.remove)m.options.remove();else if(m.options.selectionId)a.remove?.(m.options.selectionId);})}>移除</button></>:<button role="menuitem" disabled={!!blocked} title={blocked||undefined} onClick={()=>act((a,e,m)=>{if(!blockedFor(m,a,e))a.add(e);})}>添加至角色卡</button>}{!sheet&&current.canRemoveCustom?.(menu.entry)&&<button role="menuitem" onClick={()=>act((a,e)=>{if(a.canRemoveCustom?.(e))a.removeCustom?.(e);})}>移除自定义条目</button>}{blocked&&<small>{blocked}</small>}</>}</div></div>,document.body)}</EntryMenuContext.Provider></EntryReadContext.Provider></EntryActionsContext.Provider>;
}
