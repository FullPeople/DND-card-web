import {entryLabel} from '../core/entryLabel';
import {SpellLearners} from './SpellLearners';
import { MonsterDocument } from './MonsterDocument';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { type Entry, entryEdition, KIND_LABELS } from '../core/model';
import { ContentBoundary, Entries } from './Entries';
import { plainText } from '../core/export';
import { EntryBadges } from './EntryBadges';
import { EntryFacts } from './EntryFacts';
import { ReferenceContext } from './Reference';
import { useSources } from './SourceName';
import type { Point } from './pointerDrag';
import './reference176.css';

function wikiIsVisible(){
  if(document.querySelector('.sheet-pane.sheet-fullscreen')||document.fullscreenElement&&!document.fullscreenElement.querySelector('.wiki-pane'))return false;
  const pane=document.querySelector<HTMLElement>('.wiki-pane:not(.table-pane)');
  if(!pane)return false;
  const bounds=pane.getBoundingClientRect(),style=getComputedStyle(pane);
  return style.visibility!=='hidden'&&bounds.width>0&&bounds.height>0&&bounds.right>0&&bounds.left<innerWidth&&bounds.bottom>0&&bounds.top<innerHeight;
}

type Preview = { id: string; anchor: HTMLElement; reference: string; entry?: Entry; sourceLabel?: string; point: Point; fixed?: Point; excluded?:boolean };
function Pane({ value, pinned, index, keep, leave, open }: { value: Preview; pinned: boolean; index: number; keep: () => void; leave: () => void; open: (reference: string, kind?: string) => void }) {
  const {format}=useSources();
  const ref = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const { entry } = value;
  useLayoutEffect(() => {
    const place = () => {
      const b = ref.current!.getBoundingClientRect();
      const x = value.fixed?.x ?? value.point.x + 16;
      const y = value.fixed?.y ?? (value.point.y + b.height + 18 < innerHeight ? value.point.y + 18 : value.point.y - b.height - 14);
      setPosition({ left: Math.max(8, Math.min(innerWidth - b.width - 8, x)), top: Math.max(8, Math.min(innerHeight - b.height - 8, y)) });
    };
    place(); window.addEventListener('resize', place); return () => window.removeEventListener('resize', place);
  }, [value]);
  return <aside ref={ref} className={`keyword-preview ${pinned ? 'is-pinned' : ''} ${value.excluded?'entry-disabled':''}`} id={value.id} data-tooltip-id={value.id} role="tooltip" onDragStart={event => event.preventDefault()} style={{ ...position, zIndex: 101 + index }} onMouseEnter={keep} onMouseLeave={leave}>
    <header><strong>{entry?entryLabel(entry):value.reference.split('|')[0]}{entry?.english && entry.english !== entry.name && <small className="tooltip-english"> {entry.english}</small>}</strong>{entry && <EntryBadges entry={entry}/>}<small>{value.sourceLabel || (entry ? `${KIND_LABELS[entry.kind]} · ${format(entry.source)} · ${entryEdition(entry) === 'both' ? '通用' : entryEdition(entry)}` : '资料尚未收录')}{pinned && <span className="tooltip-pin"> · 已固定</span>}</small></header>
    <div className="keyword-content rules-prose">{entry ? <ContentBoundary key={entry.id}>{entry.kind==='monster'?<MonsterDocument entry={entry} onLink={open}/>:<>{!value.sourceLabel && <EntryFacts entry={entry} onLink={open}/>}<Entries compact={entry.kind==='feature'} value={entry.entries} onLink={open}/><SpellLearners entry={entry} onLink={open}/></>}</ContentBoundary> : null}</div>
  </aside>;
}
export function KeywordPreview({ children, resolve, open, sheetPreview, sheetCommit, isExcluded, wikiVisible=wikiIsVisible }: { isExcluded?:(entry:Entry)=>boolean; wikiVisible?:()=>boolean; sheetPreview?:(entry?:Entry)=>void; sheetCommit?:(entry:Entry)=>void; children: ReactNode; resolve: (reference: string, kind?: string) => Entry | undefined; open: (reference: string, kind?: string) => void }) {
  const sheetAnchor=useRef<HTMLElement | undefined>(undefined);
  const sheetCallbacks=useRef({sheetPreview,sheetCommit,resolve,wikiVisible});sheetCallbacks.current={sheetPreview,sheetCommit,resolve,wikiVisible};
  const [preview, setPreview] = useState<Preview>(); const [pinned, setPinned] = useState<Preview[]>([]);
  const state = useRef({ preview, pinned }); state.current = { preview, pinned };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), pending = useRef<Preview | undefined>(undefined), counter = useRef(0), suppressUntil = useRef(0), backdropPressed = useRef(false);
  const moveFrame = useRef(0);
  const dismissedAnchors = useRef(new Set<HTMLElement>());
  const scrollingUntil=useRef(0);
  const lastPointer = useRef({ x: -1, y: -1 });
  const keep = () => clearTimeout(timer.current);
  const close = () => { if(sheetAnchor.current){sheetAnchor.current=undefined;sheetCallbacks.current.sheetPreview?.();} keep(); pending.current = undefined; state.current.preview = undefined; setPreview(undefined); };
  const clear = () => { dismissedAnchors.current = new Set([...state.current.pinned.map(p => p.anchor), ...(state.current.preview ? [state.current.preview.anchor] : [])].filter(anchor => { const b = anchor.getBoundingClientRect(), p = lastPointer.current; return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom; })); backdropPressed.current = false; close(); setPinned([]); };
  const leave = () => { if(sheetAnchor.current){close();return;} dismissedAnchors.current.clear(); keep(); timer.current = setTimeout(close, 180); };
  function pin(value: Preview) {
    backdropPressed.current = false;
    const b = document.getElementById(value.id)?.getBoundingClientRect();
    setPinned(items => items.some(item => item.id === value.id) ? items : [...items, { ...value, fixed: { x: b?.x ?? value.point.x, y: b?.y ?? value.point.y } }]); close();
  }
  useEffect(() => {
    const track = (event: PointerEvent) => { lastPointer.current = { x: event.clientX, y: event.clientY }; for (const anchor of dismissedAnchors.current) { const b = anchor.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dismissedAnchors.current.delete(anchor); } };
    document.addEventListener('pointermove', track, true);
    function down(event: PointerEvent) {
      if (![1, 2].includes(event.button)) return;
      if(event.button===2&&(event.target as Element).closest('[data-entry-context-menu]')){suppressUntil.current=0;close();return;}
      // A middle-click command on a card takes priority over tooltip pinning.
      if(event.button===1&&(event.target as Element).closest('[data-middle-action]')){event.preventDefault();return;}
      if ((state.current.preview?.anchor.contains(event.target as Node)) || (event.target as Element).closest('[data-tooltip-id]')) {
        event.preventDefault(); event.stopImmediatePropagation(); suppressUntil.current = Date.now() + 800;
        if (state.current.preview) pin(state.current.preview);
      }
    }
    function menu(event: MouseEvent) { if(event.button===2&&(event.target as Element).closest('[data-entry-context-menu]'))return; if(event.button===1&&(event.target as Element).closest('[data-middle-action]'))return; if (Date.now() < suppressUntil.current || (event.target as Element).closest('[data-tooltip-id]')) { event.preventDefault(); event.stopImmediatePropagation(); } }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') clear(); };
    const scroll = (event: Event) => {
      if(sheetAnchor.current)return;
      // Focusing a link may scroll its reading pane after onFocus has already
      // opened the preview. Keep that keyboard preview at the link's new position.
      const current=state.current.preview;
      if(current?.anchor===document.activeElement&&current.anchor.matches(':focus-visible')){
        const box=current.anchor.getBoundingClientRect(),pane=current.anchor.closest('.entry-detail')?.getBoundingClientRect();
        if(box.bottom>Math.max(0,pane?.top||0)&&box.top<Math.min(innerHeight,pane?.bottom||innerHeight)){move(current.anchor,{x:box.left,y:box.bottom});return;}
      }
      if (!(event.target instanceof Element) || !event.target.closest('[data-tooltip-id]')) close();
    };
    const wheel=(event:WheelEvent)=>{const hit=(event.target as Element).closest<HTMLElement>('[data-tooltip-id]');const current=state.current.preview;const pane=hit||(current?.anchor.contains(event.target as Node)?document.getElementById(current.id):null);if(!pane){scrollingUntil.current=performance.now()+130;close();return;}event.preventDefault();event.stopImmediatePropagation();const content=pane.querySelector<HTMLElement>('.keyword-content');if(content)content.scrollTop+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?content.clientHeight:1);};
    document.addEventListener('wheel',wheel,{capture:true,passive:false});
    document.addEventListener('pointerdown', down, true); document.addEventListener('contextmenu', menu, true); document.addEventListener('auxclick', menu, true);
    document.addEventListener('keydown', key); document.addEventListener('scroll', scroll, true); window.addEventListener('card-drag-start', close);
    return () => { document.removeEventListener('wheel',wheel,true); keep(); cancelAnimationFrame(moveFrame.current); document.removeEventListener('pointermove', track, true); document.removeEventListener('pointerdown', down, true); document.removeEventListener('contextmenu', menu, true); document.removeEventListener('auxclick', menu, true); document.removeEventListener('keydown', key); document.removeEventListener('scroll', scroll, true); window.removeEventListener('card-drag-start', close); };
  }, []);
  function show(anchor: HTMLElement, reference: string, kind?: string, point?: Point, override?: Entry, sourceLabel?: string) {
    if (document.body.classList.contains('pointer-dragging') || performance.now()<scrollingUntil.current) return;
    if (dismissedAnchors.current.has(anchor)) return;
    keep();
    if (state.current.preview?.anchor === anchor) return;
    const entry = resolve(reference, kind) || override;
    if(anchor.closest('.paper,[data-wiki-preview]')&&sheetCallbacks.current.wikiVisible()){close();if(entry && sheetCallbacks.current.sheetPreview){sheetAnchor.current=anchor;sheetCallbacks.current.sheetPreview(entry);}return;}
    if (anchor.closest('.feature-bubble') && (!entry || !plainText(entry.entries).replace('外部角色卡条目；请在规则资料中核对并替换为有来源的条目。','').trim())) { close(); return; }
    const described=anchor.closest<HTMLElement>('[data-described-entry]');if(entry && described?.dataset.describedEntry===entry.id){close();return;}
    const parentId = anchor.closest<HTMLElement>('[data-tooltip-id]')?.dataset.tooltipId;
    if (parentId && state.current.preview?.id === parentId) pin(state.current.preview);
    const b = anchor.getBoundingClientRect();
    pending.current = { id: `keyword-preview-${++counter.current}`, anchor, reference, entry, sourceLabel, excluded:entry?isExcluded?.(entry):false, point: point || { x: b.left, y: b.bottom } };
    state.current.preview = pending.current;
    setPreview(pending.current); pending.current = undefined;
  }
  function move(anchor: HTMLElement, point: Point) {
    const value = state.current.preview; if (value?.anchor !== anchor) return;
    value.point = point; cancelAnimationFrame(moveFrame.current);
    moveFrame.current = requestAnimationFrame(() => {
      const pane = document.getElementById(value.id); if (!pane) return;
      const w = pane.offsetWidth, h = pane.offsetHeight, point = value.point;
      pane.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, point.x + 16))}px`;
      pane.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, point.y + h + 18 < innerHeight ? point.y + 18 : point.y - h - 14))}px`;
    });
  }
  return <ReferenceContext.Provider value={{ show, move, leave, close, resolve:(reference,kind)=>sheetCallbacks.current.resolve(reference,kind), commit:(anchor,reference,kind,entry)=>{if(!anchor.closest('.paper,[data-wiki-preview]')||!sheetCallbacks.current.sheetCommit)return false;const found=sheetCallbacks.current.resolve(reference,kind)||entry;if(!found)return false;sheetCallbacks.current.sheetCommit(found);return true;}, active: preview?.anchor, activeId: preview?.id }}>
    {children}
    {createPortal(<>{pinned.length > 0 && <div className="tooltip-backdrop" data-testid="tooltip-backdrop" onPointerDown={e => { backdropPressed.current = true; e.preventDefault(); e.stopPropagation(); }} onPointerUp={e => { e.preventDefault(); e.stopPropagation(); if (e.button !== 0 && backdropPressed.current) { backdropPressed.current = false; suppressUntil.current = Date.now() + 800; clear(); } }} onClick={e => { e.preventDefault(); e.stopPropagation(); clear(); }} onContextMenu={e => e.preventDefault()} onWheel={e => e.stopPropagation()}/>}{pinned.map((value, index) => <Pane key={value.id} value={value} pinned index={index} keep={keep} leave={leave} open={open}/>)}{preview && <Pane key={preview.id} value={preview} pinned={false} index={pinned.length} keep={keep} leave={leave} open={open}/>}</>, document.body)}
  </ReferenceContext.Provider>;
}
