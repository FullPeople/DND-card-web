import {useEntryMenu,type EntryMenuOptions} from './EntrySharing';
import {DragContext} from './DragEntry';
import {entryLabel} from '../core/entryLabel';
import { Children, createContext, useContext, type ButtonHTMLAttributes } from 'react';
import type { Entry } from '../core/model';
import type { Point } from './pointerDrag';

type Preview = { resolve?: (reference:string,kind?:string)=>Entry|undefined; commit?: (anchor:HTMLElement, reference:string, kind?:string, entry?:Entry)=>boolean; show: (anchor: HTMLElement, reference: string, kind?: string, point?: Point, entry?: Entry, sourceLabel?: string) => void; move: (anchor: HTMLElement, point: Point) => void; leave: () => void; close: () => void; active?: HTMLElement; activeId?: string };
export const ReferenceContext = createContext<Preview | null>(null);
export function Reference({ reference, kind, children, onClick, onAuxClick, onContextMenu,onPointerDown, className = 'inline-reference', entry, sourceLabel, previewEnabled = true, commitOnClick = true,menuOptions, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { menuOptions?:EntryMenuOptions;commitOnClick?:boolean; previewEnabled?:boolean; reference: string; kind?: string; entry?: Entry; sourceLabel?: string }) {
  const preview = useContext(ReferenceContext), menu=useEntryMenu(), drag=useContext(DragContext),shareable=!!menu;
  const pointerDown:ButtonHTMLAttributes<HTMLButtonElement>['onPointerDown']=event=>{
    if(onPointerDown){onPointerDown(event);return;}
    if(!event.currentTarget.closest('.wiki-pane,.keyword-preview'))return;
    const found=entry||preview?.resolve?.(reference,kind);
    if(found&&drag){event.stopPropagation();drag.start(event,found);}
  };
  return <button {...props} onPointerDown={pointerDown} onDragStart={event=>event.preventDefault()} data-entry-context-menu={props['data-entry-context-menu' as keyof typeof props]||shareable?true:undefined} onContextMenu={e=>{if(onContextMenu){onContextMenu(e);return;}if(shareable&&menu){const found=entry||preview?.resolve?.(reference,kind)||{id:'custom-reference:'+reference,kind:'feature' as const,name:e.currentTarget.textContent||reference,english:'',source:'CUSTOM',edition:'both' as const,packId:'custom',revision:'1',entries:[],raw:{_custom:true}};preview?.close();menu(e,{...found,id:reference.startsWith('entry:')?reference.slice(6):found.id},menuOptions);}}} className={className} onAuxClick={e=>{if(e.button===1&&onAuxClick)preview?.close();onAuxClick?.(e);}} onPointerEnter={e => e.pointerType !== 'touch' && previewEnabled && preview?.show(e.currentTarget, reference, kind, { x: e.clientX, y: e.clientY }, entry, sourceLabel)} onPointerMove={e => e.pointerType !== 'touch' && preview?.move(e.currentTarget, { x: e.clientX, y: e.clientY })} onPointerLeave={() => preview?.leave()} onFocus={e => e.currentTarget.matches(':focus-visible') && previewEnabled && preview?.show(e.currentTarget, reference, kind, undefined, entry, sourceLabel)} onBlur={() => preview?.leave()} aria-describedby={preview?.active?.dataset.reference === `${kind}:${reference}` ? preview.activeId : undefined} data-reference={`${kind}:${reference}`} onClick={e => { if(commitOnClick&&preview?.commit?.(e.currentTarget,reference,kind,entry)) { preview.close(); return; } preview?.close(); onClick?.(e); }}>{entry?Children.map(children,child=>typeof child==='string'&&child===entry.name?entryLabel(entry):child):children}</button>;
}
