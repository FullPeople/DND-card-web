import { useContext, useEffect, useRef, useState } from 'react';
import { SheetEditContext } from './SheetEdit';
import { Reference, ReferenceContext } from './Reference';
import {trainingChipReference} from '../core/trainingChipReference';
import { Inline } from './Entries';
import { pointerDrag } from './pointerDrag';

export function TrainingChips({ label, value, onChange, editAll = false }: { editAll?: boolean; label: string; value: string; onChange: (value: string) => void }) {
  const allowed = useContext(SheetEditContext), preview = useContext(ReferenceContext);
  const [editing, setEditing] = useState(false), [text, setText] = useState(value), [order, setOrder] = useState<string[]>();
  const ref = useRef<HTMLDivElement>(null), cancel = useRef<(() => void) | undefined>(undefined);
  const items = order || value.split(/[、\n；;]/).map(s => s.trim()).filter(Boolean);
  const live = useRef(items); live.current = items;
  useEffect(() => { setText(value); setOrder(undefined); }, [value]);
  useEffect(() => () => cancel.current?.(), []);
  function save() { if (allowed) onChange(text); setEditing(false); }
  return <div className="training-chips" ref={ref}>
    {allowed && (editing || editAll) ? <input autoFocus aria-label={`${label}熟练记录`} value={text} onChange={e => setText(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setText(value); setEditing(false); } }}/>
      : <>{items.map((name, index) => {
        const chip = trainingChipReference(name,label === '语言' ? 'language' : 'item',preview?.resolve);
        return <span className="feature-bubble" data-training-index={index} key={`${name}:${index}`}><Reference className="feature-caption" menuOptions={{origin:'sheet',canRemove:allowed,remove:()=>onChange(items.filter((_,i)=>i!==index).join('、'))}} reference={chip.reference} kind={chip.kind} entry={chip.entry} onClick={() => { if (allowed) { setText(value); setEditing(true); } }} onPointerDown={event => {

          if(!allowed)return;
          let current = index;
          cancel.current = pointerDrag(event, { title: chip.label, outside: hit => !hit || !ref.current?.closest('.training-cell')?.contains(hit),
            move: (_point, hit) => { const chip = hit?.closest<HTMLElement>('[data-training-index]'); if (!chip || !ref.current?.contains(chip)) return; const to = Number(chip.dataset.trainingIndex); if (to === current) return; const next = [...live.current]; next.splice(to, 0, ...next.splice(current, 1)); current = to; live.current = next; setOrder(next); },
            finish: (_point, hit) => { const next = [...live.current]; if (!hit || !ref.current?.closest('.training-cell')?.contains(hit)) next.splice(current, 1); onChange(next.join('、')); setOrder(undefined);return hit&&ref.current?.closest('.training-cell')?.contains(hit)?{resolve:()=>ref.current?.querySelector<HTMLElement>(`[data-training-index="${current}"]`)||null}:{removed:true}; }, cancel: () => setOrder(undefined) });
        }}><Inline text={chip.label}/></Reference></span>;
      })}</>}
  </div>;
}
