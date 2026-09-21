import { useLayoutEffect, useRef, useState } from 'react';
const KEY = 'dnd-card:wiki-split-ratio';
export function WikiSplitter() {
  const ref = useRef<HTMLDivElement>(null), ratio = useRef<number | undefined>(undefined), cleanup = useRef<(() => void) | undefined>(undefined);
  const [height, setHeight] = useState(122);
  function apply(pixels: number) {
    const parent = ref.current!.parentElement!, total = parent.clientHeight;
    const min = Math.min(76, total * .3), max = Math.max(min, total - 128);
    const next = Math.max(min, Math.min(max, pixels));
    parent.style.setProperty('--catalog-height', `${next}px`); setHeight(Math.round(next));
    return next / Math.max(1, total);
  }
  function save() { try { localStorage.setItem(KEY, String(ratio.current)); } catch { /* Private storage may be unavailable. */ } }
  useLayoutEffect(() => {
    try { const stored = Number(localStorage.getItem(KEY)); if (stored > 0 && stored < 1) ratio.current = stored; } catch { /* Use default height. */ }
    const parent = ref.current!.parentElement!;
    const observer = new ResizeObserver(() => apply(ratio.current ? parent.clientHeight * ratio.current : innerWidth < 760 ? 102 : 122));
    observer.observe(parent); return () => { observer.disconnect(); cleanup.current?.(); };
  }, []);
  return <div ref={ref} className="wiki-splitter" role="separator" tabIndex={0} aria-label="调整资料列表与正文高度" aria-orientation="horizontal" aria-valuenow={height} aria-valuetext={`资料列表高度 ${height} 像素`} onKeyDown={event => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); ratio.current = apply(event.key === 'Home' ? 0 : event.key === 'End' ? Infinity : height + (event.key === 'ArrowDown' ? 16 : -16)); save();
  }} onPointerDown={event => {
    if (event.button !== 0) return; event.preventDefault();
    const start = event.clientY, original = height, previous = ratio.current;
    document.body.classList.add('wiki-resizing');
    const move = (e: PointerEvent) => { if (e.pointerId === event.pointerId) ratio.current = apply(original + e.clientY - start); };
    const clear = () => { document.body.classList.remove('wiki-resizing'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); document.removeEventListener('keydown', key); window.removeEventListener('blur', cancel); cleanup.current = undefined; };
    const up = (e: PointerEvent) => { if (e.pointerId === event.pointerId) { clear(); save(); } };
    const cancel = () => { clear(); ratio.current = previous; apply(original); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    cleanup.current = clear;
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel); document.addEventListener('keydown', key); window.addEventListener('blur', cancel);
  }}><span/></div>;
}
