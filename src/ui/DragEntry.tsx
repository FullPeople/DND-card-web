import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';
import { candidateReason } from '../core/engine';
import { type Character, type Entry, type Kind, type Requirement } from '../core/model';
import { useSources } from './SourceName';
import { landingWithin, pointerDrag } from './pointerDrag';
import { trainingCategory } from './trainingData';
import './wikiTouch.css';

export const requiresEditing=(entry:Entry)=>!['condition','item'].includes(entry.kind);
type Zone = { element: HTMLElement; requirement?: Requirement; kinds?: Kind[]; onReceive?: (entry: Entry) => void; allowExisting?: boolean; accepts?: (entry: Entry) => boolean; wholePaper?: boolean; referenceOnly?:boolean };
function compatible(character: Character, entry: Entry, zone: Omit<Zone, 'element'>) {
  if(zone.referenceOnly)return !zone.accepts||zone.accepts(entry);
  const { requirement, kinds, allowExisting } = zone;
  if (entry.raw._category === 'size' && !zone.accepts) return false;
  if (entry.kind !== 'item' && trainingCategory(entry) && !zone.accepts) return false;
  const reason = candidateReason(character, entry, requirement);
  return (!zone.accepts || zone.accepts(entry)) && (!kinds || kinds.includes(entry.kind)) && (!reason || allowExisting && reason === '这个条目已经在角色卡中');
}
type Drag = { editing:boolean; entry?: Entry; character: Character; over?: string; hoverTab?: string; register: (id: string, zone: Zone) => () => void; start: (event: PointerEvent, entry: Entry) => void };
export const DragContext = createContext<Drag | null>(null);
export function EntryDragProvider({ character, receive, children, editing=false }: { editing?:boolean; character: Character; receive: (entry: Entry, requirement?: Requirement) => void; children: ReactNode }) {
  const {format}=useSources();
  const [entry, setEntry] = useState<Entry>(); const [over, setOver] = useState<string>(); const [hoverTab, setHoverTab] = useState<string>();
  const zones = useRef(new Map<string, Zone>()), latest = useRef({ character, receive }), cancel = useRef<(() => void) | undefined>(undefined);
  latest.current = { character, receive };
  useLayoutEffect(() => () => cancel.current?.(), []);
  const register = useCallback((id: string, zone: Zone) => { zones.current.set(id, zone); return () => { zones.current.delete(id); }; }, []);
  const clear = () => { setEntry(undefined); setOver(undefined); setHoverTab(undefined); };
  function find(hit: Element | null, item: Entry) {
    const id = hit?.closest<HTMLElement>('[data-drop-zone]')?.dataset.dropZone;
    const zone = id ? zones.current.get(id) : undefined;
    if (zone && compatible(latest.current.character, item, zone)) return { id, zone };
    if (hit?.closest('.paper')) for (const [fallbackId, fallback] of zones.current) if (fallback.wholePaper && compatible(latest.current.character, item, fallback)) return { id: fallbackId, zone: fallback };
    return undefined;
  }
  function start(event: PointerEvent, item: Entry) {
    cancel.current = pointerDrag(event, { title: item.name, subtitle: `${format(item.source)}`, start: () => setEntry(item), cancel: clear,
      move: (_point, hit) => { setOver(find(hit, item)?.id); setHoverTab(hit?.closest<HTMLElement>('[data-sheet-tab]')?.dataset.sheetTab); },
      finish: (_point, hit) => { const target = find(hit, item); clear(); if(!editing&&(target?.zone.referenceOnly||requiresEditing(item))&&(target||hit?.closest('.paper'))){window.dispatchEvent(new CustomEvent('workbench-error',{detail:`添加「${item.name}」前，请先在角色卡右上角开启编辑模式。`}));return;} if(!target){if(hit?.closest('.paper')){const reason=candidateReason(latest.current.character,item);if(reason)window.dispatchEvent(new CustomEvent('workbench-error',{detail:reason}));}return;} if (target.zone.onReceive) target.zone.onReceive(item); else latest.current.receive(item, target.zone.requirement); return landingWithin(target.zone.element,()=>target.zone.element.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(item.id)}"],[data-overview-condition="${CSS.escape(item.id)}"]`)||target.zone.element.querySelector<HTMLElement>('.stock-empty')); }
    });
  }
  return <DragContext.Provider value={{ editing,entry, character, over, hoverTab, register, start }}>{children}</DragContext.Provider>;
}
export function EntryDraggable({ entry, children, dragEnabled = true, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { entry: Entry; dragEnabled?: boolean }) {
  const drag = useContext(DragContext);
  const canDrag=dragEnabled;
  return <button {...props} data-drag-enabled={canDrag} onPointerDown={event => { if (canDrag) drag?.start(event, entry); }} onDragStart={event => event.preventDefault()}>{children}</button>;
}
export function DropZone({ children, requirement, kinds, className = '', onReceive, allowExisting = false, accepts, wholePaper = false, referenceOnly=false, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; requirement?: Requirement; kinds?: Kind[]; onReceive?: (entry: Entry) => void; allowExisting?: boolean; accepts?: (entry: Entry) => boolean; wholePaper?: boolean;referenceOnly?:boolean }) {
  const drag = useContext(DragContext), id = useId(), element = useRef<HTMLDivElement>(null);
  const register = drag?.register;
  useLayoutEffect(() => register?.(id, { element: element.current!, requirement, kinds, onReceive, allowExisting, accepts, wholePaper,referenceOnly }), [register, id, requirement, kinds, onReceive, allowExisting, accepts, wholePaper,referenceOnly]);
  const ready = !!drag?.entry && compatible(drag.character, drag.entry, { requirement, kinds, allowExisting, accepts,referenceOnly });
  return <div {...props} ref={element} className={`drop-zone ${className} ${ready ? 'drop-ready' : ''} ${ready && drag?.over === id ? 'drop-over' : ''}`} data-drop-zone={id} data-drop-kind={requirement?.kind || kinds?.join(',')}>{children}</div>;
}
