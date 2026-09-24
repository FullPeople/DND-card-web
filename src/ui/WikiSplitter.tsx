import { useContext, useLayoutEffect, useRef, useState } from 'react';
import {WikiColumnsContext} from './WikiLayout';
const KEY = 'dnd-card:wiki-split-ratio';
const WIDTH_KEY = 'dnd-card:wiki-column-ratio';
export function WikiSplitter() {
  const horizontal=useContext(WikiColumnsContext);
  const ref = useRef<HTMLDivElement>(null), ratio = useRef<number | undefined>(undefined), cleanup = useRef<(() => void) | undefined>(undefined);
  const [height, setHeight] = useState(122);
  function apply(pixels: number) {
    const parent = horizontal?ref.current!.closest<HTMLElement>('.wiki-layout')!:ref.current!.parentElement!, total = horizontal?parent.clientWidth:parent.clientHeight;
    const min = horizontal?360:Math.min(76, total * .3), max = Math.max(min, total - (horizontal?529:128));
    const next = Math.max(min, Math.min(max, pixels));
    parent.style.setProperty(horizontal?'--catalog-width':'--catalog-height', `${next}px`); setHeight(Math.round(next));
    return next / Math.max(1, total);
  }
  function save() { try { localStorage.setItem(horizontal?WIDTH_KEY:KEY, String(ratio.current)); } catch { /* Private storage may be unavailable. */ } }
  useLayoutEffect(() => {
    ratio.current=undefined;
    try { const stored = Number(localStorage.getItem(horizontal?WIDTH_KEY:KEY)); if (stored > 0 && stored < 1) ratio.current = stored; } catch { /* Use default size. */ }
    const parent = horizontal?ref.current!.closest<HTMLElement>('.wiki-layout')!:ref.current!.parentElement!;
    const update=()=>apply(ratio.current ? (horizontal?parent.clientWidth:parent.clientHeight) * ratio.current : horizontal?parent.clientWidth*.42:innerWidth < 760 ? 102 : 122);
    update();const observer = new ResizeObserver(update);
    observer.observe(parent); return () => { observer.disconnect(); cleanup.current?.(); };
  }, [horizontal]);
  return <div ref={ref} className="wiki-splitter" role="separator" tabIndex={0} aria-label={`调整资料列表与正文${horizontal?'宽度':'高度'}`} aria-orientation={horizontal?'vertical':'horizontal'} aria-valuenow={height} aria-valuetext={`资料列表${horizontal?'宽度':'高度'} ${height} 像素`} onKeyDown={event => {
    const previous=horizontal?'ArrowLeft':'ArrowUp',next=horizontal?'ArrowRight':'ArrowDown';
    if (![previous, next, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); ratio.current = apply(event.key === 'Home' ? 0 : event.key === 'End' ? Infinity : height + (event.key === next ? 16 : -16)); save();
  }} onPointerDown={event => {
    if (event.button !== 0) return; event.preventDefault();
    const start = horizontal?event.clientX:event.clientY, original = height, previous = ratio.current;
    document.body.classList.add('wiki-resizing');
    if(horizontal)document.body.classList.add('wiki-resizing-columns');
    const move = (e: PointerEvent) => { if (e.pointerId === event.pointerId) ratio.current = apply(original + (horizontal?e.clientX:e.clientY) - start); };
    const clear = () => { document.body.classList.remove('wiki-resizing','wiki-resizing-columns'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); document.removeEventListener('keydown', key); window.removeEventListener('blur', cancel); cleanup.current = undefined; };
    const up = (e: PointerEvent) => { if (e.pointerId === event.pointerId) { clear(); save(); } };
    const cancel = () => { clear(); ratio.current = previous; apply(original); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    cleanup.current = clear;
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel); document.addEventListener('keydown', key); window.addEventListener('blur', cancel);
  }}><span/></div>;
}
