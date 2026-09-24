import {SheetEditContext} from './SheetEdit';
import {quickbarDrop} from './quickbarDrop';
import {useContext} from 'react';
import {entryLabel} from '../core/entryLabel';
import {NumberInput} from './NumberInput';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { type Character, type Entry, type Selection, selectionAllowed } from '../core/model';
import { removeSelection } from '../core/sheet';
import { pointerDrag } from './pointerDrag';
import { Reference } from './Reference';
export function IdentityToken({ row, c, edit, inspect, children }: { row: Selection; c: Character; edit: (action: (draft: Character) => void) => void; inspect: (entry: Entry) => void; children?: ReactNode }) {
  const editing=useContext(SheetEditContext);
  const root=useRef<HTMLDivElement>(null);
  const cancel = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => cancel.current?.(), []);
  useLayoutEffect(()=>{
    const token=root.current,title=token?.querySelector<HTMLElement>('.identity-title');
    if(!token||!title)return;
    let frame=0;
    const fit=()=>{
      title.style.removeProperty('font-size');
      const base=parseFloat(getComputedStyle(title).fontSize);
      if(title.clientWidth && title.scrollWidth>title.clientWidth)title.style.fontSize=`${Math.max(5,Math.floor(base*title.clientWidth/title.scrollWidth*100)/100)}px`;
    };
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);});
    observer.observe(token);fit();
    let active=true;void document.fonts?.ready.then(()=>{if(active)fit();});
    return()=>{active=false;observer.disconnect();cancelAnimationFrame(frame);};
  },[row.entry.name,row.level,children]);
  const remove = () => edit(draft => removeSelection(draft, row.id));
  return <div ref={root} className={`identity-token ${selectionAllowed(c, row.entry) ? '' : 'restricted'}`} data-entry-id={row.entry.id} data-selection-id={row.id} onPointerDown={event => {
    if (!editing || (event.target as Element).closest('input')) return;
    const token=event.currentTarget;const area = event.currentTarget.closest('.identity-field') || event.currentTarget;
    cancel.current = pointerDrag(event, { title: `${row.entry.name}${row.entry.kind === 'class' ? ` Lv.${row.level}` : ''}`, outside: hit => !hit || !area.contains(hit),
      start: () => area.classList.add('identity-dragging'), move: (_point, hit) => area.classList.toggle('will-remove', !hit || !area.contains(hit)),
      cancel: () => area.classList.remove('identity-dragging', 'will-remove'),
      finish: (_point, hit) => { area.classList.remove('identity-dragging', 'will-remove');const copied=quickbarDrop(hit,row.entry,edit);if(copied)return copied; if (!hit || !area.contains(hit)) { remove(); return {removed:true}; } return {element:token}; }
    });
  }} onKeyDown={event => { if (editing && event.key === 'Delete' && !(event.target as Element).closest('input')) { event.preventDefault(); remove(); } }}>
    <Reference className="identity-title" reference={`entry:${row.entry.id}`} kind={row.entry.kind} onClick={() => inspect(row.entry)} title="拖出此格移除；Delete 移除，可撤销">{entryLabel(row.entry)}</Reference>
    {row.entry.kind === 'class' && <label className="identity-level">Lv.<NumberInput readOnly={!editing} aria-label={`${row.entry.name}等级`} type="number" min="1" max="20" value={row.level} onChange={event => edit(draft => { const found = draft.selections.find(s => s.id === row.id); if (found) found.level = Math.max(1, Math.min(20, Number(event.target.value) || 1)); })}/></label>}{children}
  </div>;
}
