import { useEffect, useRef, type ReactNode } from 'react';
import { type Character, type Entry, type Selection, selectionAllowed } from '../core/model';
import { removeSelection } from '../core/sheet';
import { pointerDrag } from './pointerDrag';
import { Reference } from './Reference';
export function IdentityToken({ row, c, edit, inspect, children }: { row: Selection; c: Character; edit: (action: (draft: Character) => void) => void; inspect: (entry: Entry) => void; children?: ReactNode }) {
  const cancel = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => cancel.current?.(), []);
  const remove = () => edit(draft => removeSelection(draft, row.id));
  return <div className={`identity-token ${selectionAllowed(c, row.entry) ? '' : 'restricted'}`} data-selection-id={row.id} onPointerDown={event => {
    if ((event.target as Element).closest('input')) return;
    const area = event.currentTarget.closest('.identity-field') || event.currentTarget;
    cancel.current = pointerDrag(event, { title: `${row.entry.name}${row.entry.kind === 'class' ? ` Lv.${row.level}` : ''}`, outside: hit => !hit || !area.contains(hit),
      start: () => area.classList.add('identity-dragging'), move: (_point, hit) => area.classList.toggle('will-remove', !hit || !area.contains(hit)),
      cancel: () => area.classList.remove('identity-dragging', 'will-remove'),
      finish: (_point, hit) => { area.classList.remove('identity-dragging', 'will-remove'); if (!hit || !area.contains(hit)) { remove(); return; } const b = area.getBoundingClientRect(); return { x: b.x, y: b.y }; }
    });
  }} onKeyDown={event => { if (event.key === 'Delete' && !(event.target as Element).closest('input')) { event.preventDefault(); remove(); } }}>
    <Reference className="identity-title" reference={`entry:${row.entry.id}`} kind={row.entry.kind} onClick={() => inspect(row.entry)} title="拖出此格移除；Delete 移除，可撤销">{row.entry.name}</Reference>
    {row.entry.kind === 'class' && <label className="identity-level">Lv.<input aria-label={`${row.entry.name}等级`} type="number" min="1" max="20" value={row.level} onChange={event => edit(draft => { const found = draft.selections.find(s => s.id === row.id); if (found) found.level = Math.max(1, Math.min(20, Number(event.target.value) || 1)); })}/></label>}{children}
  </div>;
}
