import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';
import { candidateReason } from '../core/engine';
import { type Character, type Entry, type Kind, type Requirement } from '../core/model';
import { useSources } from './SourceName';
import { landingWithin, pointerDrag } from './pointerDrag';
import {dropRejection,type DropRules} from './dropRejection';
import './wikiTouch.css';
import {useEntryMenu} from './EntrySharing';
import {ReferenceContext} from './Reference';
import './dragAvailability.css';

export const requiresEditing=(entry:Entry)=>!['condition','item'].includes(entry.kind);
type Zone = DropRules & { element: HTMLElement; onReceive?: (entry: Entry) => void; wholePaper?: boolean };
function compatible(character: Character, entry: Entry, zone: Omit<Zone, 'element'>) {
  return !dropRejection(character,entry,zone);
}
type Drag = { editing:boolean; entry?: Entry; character: Character; over?: string; hoverTab?: string; register: (id: string, zone: Zone) => () => void; start: (event: PointerEvent, entry: Entry) => void };
export const DragContext = createContext<Drag | null>(null);
export function EntryDragProvider({ character, receive, children, editing=false, disabledReason }: { editing?:boolean; disabledReason?:string; character: Character; receive: (entry: Entry, requirement?: Requirement) => void; children: ReactNode }) {
  const {format}=useSources();
  const [entry, setEntry] = useState<Entry>(); const [over, setOver] = useState<string>(); const [hoverTab, setHoverTab] = useState<string>();
  const zones = useRef(new Map<string, Zone>()), latest = useRef({ character, receive,editing,disabledReason }), cancel = useRef<(() => void) | undefined>(undefined);
  latest.current = { character, receive,editing,disabledReason };
  useLayoutEffect(() => () => cancel.current?.(), []);
  const hitCache=useRef<{hit:Element|null;item:Entry;character:Character;result:ReturnType<typeof find>}|undefined>(undefined);
  const register = useCallback((id: string, zone: Zone) => { zones.current.set(id, zone);hitCache.current=undefined; return () => { zones.current.delete(id);hitCache.current=undefined; }; }, []);
  const clear = () => { setEntry(undefined); setOver(undefined); setHoverTab(undefined); };
  function find(hit: Element | null, item: Entry) {
    for(let node=hit?.closest<HTMLElement>('[data-drop-zone]');node;node=node.parentElement?.closest<HTMLElement>('[data-drop-zone]')){
      const id=node.dataset.dropZone,zone=id?zones.current.get(id):undefined;
      if(zone&&compatible(latest.current.character,item,zone))return {id,zone};
      // A specific slot explains its constraint; do not reroute to its broad parent.
      if(zone?.rejectReason)return undefined;
    }
    if (hit?.closest('.paper')) for (const [fallbackId, fallback] of zones.current) if (fallback.wholePaper && compatible(latest.current.character, item, fallback)) return { id: fallbackId, zone: fallback };
    return undefined;
  }
  function start(event: PointerEvent, item: Entry) {
    const preservePage=item.kind==='item'&&!!event.currentTarget.closest('.inline-reference,.training-row');
    cancel.current = pointerDrag(event, { title: item.name, subtitle: `${format(item.source)}`, start: () => {setEntry(item);window.dispatchEvent(new CustomEvent('entry-drag-start',{detail:{entry:item,preservePage}}));}, cancel: clear,
      move: (_point, hit) => {const old=hitCache.current;const match=old&&old.hit===hit&&old.item===item&&old.character===latest.current.character?old.result:find(hit,item);hitCache.current={hit,item,character:latest.current.character,result:match};setOver(match?.id); setHoverTab(hit?.closest<HTMLElement>('[data-sheet-tab]')?.dataset.sheetTab); },
      finish: (_point, hit) => {
        const target=find(hit,item),nearest=hit?.closest<HTMLElement>('[data-drop-zone]'),zone=nearest?.dataset.dropZone?zones.current.get(nearest.dataset.dropZone):undefined;
        clear();if(!target&&!zone&&!hit?.closest('.paper'))return;
        const state=latest.current,fail=(detail:string)=>window.dispatchEvent(new CustomEvent('workbench-error',{detail}));
        if(state.disabledReason){fail(state.disabledReason);return;}
        if(!state.editing&&(target?.zone.referenceOnly||zone?.referenceOnly||requiresEditing(item))){fail(`添加「${item.name}」前，请先在角色卡右上角开启编辑模式。`);return;}
        if(!target){fail(zone?dropRejection(state.character,item,zone)||'请将条目拖到对应的填写格。':candidateReason(state.character,item)||'这里没有对应的填写格，请拖到带有栏目标题的接收位置。');return;}
        if(target.zone.onReceive)target.zone.onReceive(item);else state.receive(item,target.zone.requirement);
        return landingWithin(target.zone.element,()=>target.zone.element.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(item.id)}"],[data-overview-condition="${CSS.escape(item.id)}"]`)||target.zone.element.querySelector<HTMLElement>('.stock-empty'));
      }
    });
  }
  return <DragContext.Provider value={{ editing,entry, character, over, hoverTab, register, start }}>{children}</DragContext.Provider>;
}
export function EntryDraggable({ entry, children, dragEnabled = true, onContextMenu, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { entry: Entry; dragEnabled?: boolean }) {
  const drag = useContext(DragContext);
  const menu=useEntryMenu(),preview=useContext(ReferenceContext);
  const canDrag=dragEnabled;
  return <button {...props} data-entry-context-menu={!!menu} onContextMenu={event=>{if(onContextMenu){onContextMenu(event);return;}preview?.close();menu?.(event,entry);}} data-drag-enabled={canDrag} onPointerDown={event => { if (canDrag) drag?.start(event, entry); }} onDragStart={event => event.preventDefault()}>{children}</button>;
}
export function DropZone({ children, requirement, kinds, className = '', onReceive, allowExisting = false, accepts, rejectReason, wholePaper = false, referenceOnly=false, ...props }: HTMLAttributes<HTMLDivElement> & DropRules & { children: ReactNode; onReceive?: (entry: Entry) => void; wholePaper?: boolean }) {
  const drag = useContext(DragContext), id = useId(), element = useRef<HTMLDivElement>(null);
  const register = drag?.register;
  useLayoutEffect(() => register?.(id, { element: element.current!, requirement, kinds, onReceive, allowExisting, accepts, rejectReason, wholePaper,referenceOnly }), [register, id, requirement, kinds, onReceive, allowExisting, accepts, rejectReason, wholePaper,referenceOnly]);
  const ready = !!drag?.entry && compatible(drag.character, drag.entry, { requirement, kinds, allowExisting, accepts,rejectReason,referenceOnly });
  return <div {...props} ref={element} className={`drop-zone ${className} ${ready ? 'drop-ready' : ''} ${ready && drag?.over === id ? 'drop-over' : ''}`} data-drop-zone={id} data-drop-kind={requirement?.kind || kinds?.join(',')}>{children}</div>;
}
