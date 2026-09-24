import {entryLabel} from '../core/entryLabel';
import { Children, createContext, useContext, type ButtonHTMLAttributes } from 'react';
import type { Entry } from '../core/model';
import type { Point } from './pointerDrag';

type Preview = { commit?: (anchor:HTMLElement, reference:string, kind?:string, entry?:Entry)=>boolean; show: (anchor: HTMLElement, reference: string, kind?: string, point?: Point, entry?: Entry, sourceLabel?: string) => void; move: (anchor: HTMLElement, point: Point) => void; leave: () => void; close: () => void; active?: HTMLElement; activeId?: string };
export const ReferenceContext = createContext<Preview | null>(null);
export function Reference({ reference, kind, children, onClick, onAuxClick, className = 'inline-reference', entry, sourceLabel, previewEnabled = true, commitOnClick = true, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { commitOnClick?:boolean; previewEnabled?:boolean; reference: string; kind?: string; entry?: Entry; sourceLabel?: string }) {
  const preview = useContext(ReferenceContext);
  return <button {...props} className={className} onAuxClick={e=>{if(e.button===1&&onAuxClick)preview?.close();onAuxClick?.(e);}} onMouseEnter={e => previewEnabled && preview?.show(e.currentTarget, reference, kind, { x: e.clientX, y: e.clientY }, entry, sourceLabel)} onMouseMove={e => preview?.move(e.currentTarget, { x: e.clientX, y: e.clientY })} onMouseLeave={() => preview?.leave()} onFocus={e => previewEnabled && preview?.show(e.currentTarget, reference, kind, undefined, entry, sourceLabel)} onBlur={() => preview?.leave()} aria-describedby={preview?.active?.dataset.reference === `${kind}:${reference}` ? preview.activeId : undefined} data-reference={`${kind}:${reference}`} onClick={e => { if(commitOnClick&&preview?.commit?.(e.currentTarget,reference,kind,entry)) { preview.close(); return; } preview?.close(); onClick?.(e); }}>{entry?Children.map(children,child=>typeof child==='string'&&child===entry.name?entryLabel(entry):child):children}</button>;
}
