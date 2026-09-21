import type { PointerEvent as ReactPointerEvent } from 'react';

export type Point = { x: number; y: number };
type Gesture = { title: string; subtitle?: string; outside?: (hit: Element | null) => boolean; start?: () => void; move: (point: Point, hit: Element | null) => void; finish: (point: Point, hit: Element | null) => Point | void; cancel: () => void };
let cancelActive: (() => void) | undefined;

/** One pointer gesture for catalog entries and sheet chips; never uses HTML drag images. */
export function pointerDrag(event: ReactPointerEvent, gesture: Gesture) {
  if (event.button !== 0 || !event.isPrimary) return;
  cancelActive?.();
  const source = event.currentTarget as HTMLElement;
  const bounds = source.getBoundingClientRect();
  const width = Math.max(48, Math.min(180, bounds.width)), height = Math.max(24, Math.min(48, bounds.height));
  const grab = { x: Math.max(0, Math.min(width, (event.clientX - bounds.x) / Math.max(1, bounds.width) * width)), y: Math.max(0, Math.min(height, (event.clientY - bounds.y) / Math.max(1, bounds.height) * height)) };
  const origin = { x: event.clientX, y: event.clientY };
  let point = origin, painted = origin, active = false, finished = false, frame = 0, ghost: HTMLDivElement | undefined;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paint() {
    if (!ghost) return;
    painted = point;
    ghost.style.transform = `translate3d(${painted.x - grab.x}px,${painted.y - grab.y}px,0) rotate(${reduced ? 0 : 3}deg)`;
    const hit = document.elementFromPoint(point.x, point.y);
    ghost.classList.toggle('removal-preview', !!gesture.outside?.(hit));
    gesture.move(point, hit);
    let scroller = hit?.closest<HTMLElement>('.cell-content,.box-content,.catalog-list');
    while (scroller) {
      if (scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY)) {
        const bounds = scroller.getBoundingClientRect();
        if (point.y < bounds.top + 24) scroller.scrollTop -= 7;
        else if (point.y > bounds.bottom - 24) scroller.scrollTop += 7;
        break;
      }
      scroller = scroller.parentElement?.closest<HTMLElement>('.cell-content,.box-content,.catalog-list') || null;
    }
    frame = requestAnimationFrame(paint);
  }
  function move(e: PointerEvent) {
    if (e.pointerId !== event.pointerId) return;
    point = { x: e.clientX, y: e.clientY };
    if (!active && Math.hypot(point.x - origin.x, point.y - origin.y) >= 5) {
      active = true;
      document.body.classList.add('pointer-dragging');
      ghost = document.createElement('div'); ghost.className = 'drag-ghost pointer-ghost';
      const title = document.createElement('strong'); title.textContent = gesture.title;
      ghost.style.width = `${width}px`; ghost.style.height = `${height}px`;
      ghost.style.transformOrigin = `${grab.x}px ${grab.y}px`;
      ghost.dataset.grabX = String(grab.x); ghost.dataset.grabY = String(grab.y);
      ghost.append(title); document.body.append(ghost);
      window.dispatchEvent(new Event('card-drag-start')); gesture.start?.(); paint();
    }
    if (active) e.preventDefault();
  }
  function finish(cancelled: boolean) {
    if (finished) return; finished = true;
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel);
    document.removeEventListener('keydown', key); window.removeEventListener('blur', cancel);
    cancelAnimationFrame(frame); cancelActive = undefined; document.body.classList.remove('pointer-dragging');
    if (!active) return;
    const suppress = (e: MouseEvent) => { e.preventDefault(); e.stopImmediatePropagation(); };
    document.addEventListener('click', suppress, true);
    setTimeout(() => document.removeEventListener('click', suppress, true), 0);
    const destination = cancelled ? (gesture.cancel(), undefined) : gesture.finish(point, document.elementFromPoint(point.x, point.y));
    if (ghost) {
      const element = ghost, end = destination || origin;
      if (reduced) element.remove();
      else { element.animate([{ transform: element.style.transform, opacity: 1 }, { transform: `translate(${end.x}px,${end.y}px) rotate(0deg) scale(.7)`, opacity: 0 }], { duration: 170, easing: 'ease-out', fill: 'forwards' }).finished.finally(() => element.remove()); }
    }
  }
  function up(e: PointerEvent) { if (e.pointerId === event.pointerId) finish(false); }
  function cancel() { finish(true); }
  function key(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); cancel(); } }
  cancelActive = cancel;
  document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
  document.addEventListener('keydown', key); window.addEventListener('blur', cancel);
  return cancel;
}
