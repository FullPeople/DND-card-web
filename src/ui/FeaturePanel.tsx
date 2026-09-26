import {spellState} from '../core/characterDetails';
import {quickbarDrop} from './quickbarDrop';
import {togglePreparedSpell} from '../core/spells';
import {SheetEditContext} from './SheetEdit';
import {useContext} from 'react';
import {entryLabel} from '../core/entryLabel';
import {NumberInput} from './NumberInput';
import { useSources } from './SourceName';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { KIND_LABELS, selectionAllowed, type Character, type Entry, type Selection, type Kind } from '../core/model';
import { ContentBoundary, Entries } from './Entries';
import { Reference } from './Reference';
import { pointerDrag } from './pointerDrag';
import { removeSelection } from '../core/sheet';
import { DropZone } from './DragEntry';
import { conditionVisual } from './conditionVisuals';
import { SheetCell } from './SheetCell';
import {featureOwner,selectionLevel} from '../core/featureOwnership';

type Feature = { id: string; group: string; origin: string; name: string; entry: Entry; body: unknown; restricted: boolean };
type Props = { detailed?:boolean; inline?: boolean; grouped?: boolean; c: Character; rows: Selection[]; receive?: (entry: Entry) => void; label?: string; className?: string; kinds?: Kind[]; edit: (action: (draft: Character) => void) => void; browse: () => void; onLink: (reference: string, kind?: string) => void; children?: ReactNode };

export function FeaturePanel({ detailed = false, inline = false, c, rows, receive, edit, browse, onLink, children, label = '特性', className = 'class-features', kinds = ['feature', 'rule'], grouped = true }: Props) {
  const {format}=useSources(); const editing=useContext(SheetEditContext);
  const spells = kinds.length === 1 && kinds[0] === 'spell';
  const features: Feature[] = rows.map(s => {
    const owner = featureOwner(c,s);
    return { id: s.id, group: spells ? String(s.entry.raw.level ?? 0) : grouped ? owner?.id || 'other' : 'all', origin: owner ? `${KIND_LABELS[owner.entry.kind]} ${owner.entry.name}${['class', 'subclass'].includes(owner.entry.kind) ? ` Lv.${selectionLevel(c,owner)}` : ''}` : '其他特性', name: entryLabel(s.entry), entry: s.entry, body: s.entry.entries, restricted: !selectionAllowed(c, s.entry) || !!owner && !selectionAllowed(c, owner.entry) };
  });
  const saved = c.featureLayout;
  const [draftOrder, setDraftOrder] = useState<string[]>();
  const [dragging, setDragging] = useState('');
  const panel = useRef<HTMLDivElement>(null), cancel = useRef<(() => void) | undefined>(undefined);
  const positions = useRef(new Map<string, DOMRect>());
  const previous = useRef(new Map<string, DOMRect>());
  const measuredCharacter=useRef('');
  const sourceOrder = [...new Set(features.map(f => f.group))];
  const natural = [...features].sort((a, b) => sourceOrder.indexOf(a.group) - sourceOrder.indexOf(b.group));
  const ids = draftOrder || saved?.order || [];
  const ordered = [...ids.flatMap(id => natural.find(f => f.id === id) || []), ...natural.filter(f => !ids.includes(f.id))];
  if (spells) ordered.sort((a, b) => Number(a.group) - Number(b.group));
  const expanded = new Set(inline ? [] : detailed ? saved?.detailsExpanded || ordered.map(f=>f.id) : saved?.expanded || []);
  const allOpen = ordered.length > 0 && ordered.every(f => expanded.has(f.id));
  const live = useRef({ ordered, expanded, edit }); live.current = { ordered, expanded, edit };
  useEffect(() => { setDraftOrder(undefined); setDragging(''); return () => cancel.current?.(); }, [c.id]);
  const layoutKey = ordered.map(f => `${f.id}:${expanded.has(f.id)}`).join('|');
  useLayoutEffect(() => {
    const elements = [...(panel.current?.querySelectorAll<HTMLElement>('[data-feature-id]') || [])];
    const changedCharacter=measuredCharacter.current!==c.id;measuredCharacter.current=c.id;
    const before = positions.current.size ? positions.current : previous.current;
    const next = new Map<string, DOMRect>(); let arriving = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const element of elements) {
      const id = element.dataset.featureId!, old = before.get(id);
      const after = element.getBoundingClientRect(), scale = after.width / element.offsetWidth || 1; next.set(id, after);
      if (reduced||changedCharacter) continue;
      if (!old) element.animate([{ transform: 'scale(.15)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, delay: Math.min(arriving++ * 65, 650), fill: 'backwards', easing: 'cubic-bezier(.2,.8,.25,1.15)' });
      else { const x = (old.x - after.x) / scale, y = (old.y - after.y) / scale; if (x || y) element.animate([{ transform: `translate(${x}px,${y}px)` }, { transform: 'translate(0,0)' }], { duration: 180, easing: 'ease-out' }); }
    }
    previous.current = next; positions.current.clear();
  }, [layoutKey, c.id]);
  function saveLayout(order: string[], open: string[]) {
    live.current.edit(draft => {
      const own = new Set(features.map(f => f.id));
      draft.featureLayout = { ...draft.featureLayout, order: [...(draft.featureLayout?.order || []).filter(id => !own.has(id)), ...order], [detailed?'detailsExpanded':'expanded']: [...((detailed?(draft.featureLayout?.detailsExpanded??draft.selections.filter(s=>['feature','feat','rule'].includes(s.entry.kind)).map(s=>s.id)): draft.featureLayout?.expanded) || []).filter(id => !own.has(id)), ...open], expanded: detailed ? draft.featureLayout?.expanded||[] : [...(draft.featureLayout?.expanded||[]).filter(id=>!own.has(id)),...open] };
    });
  }
  function saveOrder(order: string[]) { saveLayout(order, features.filter(f => live.current.expanded.has(f.id)).map(f => f.id)); }
  function toggle(id: string) {
    if (inline) return;
    saveLayout(ordered.map(f => f.id), ordered.filter(f => expanded.has(f.id) !== (f.id === id)).map(f => f.id));
  }
  function reordered(from: string, to: string, after: boolean) {
    const ids = live.current.ordered.map(f => f.id).filter(id => id !== from), at = ids.indexOf(to);
    if (from === to || at < 0) return;
    ids.splice(at + Number(after), 0, from); return ids;
  }
  const groups: { origin: string; group: string; items: Feature[] }[] = [];
  for (const item of ordered) {
    if (groups.at(-1)?.group === item.group) groups.at(-1)!.items.push(item);
    else groups.push({ origin: item.origin, group: item.group, items: [item] });
  }
  const contents = <>
    <div ref={panel} className="feature-groups">
    {groups.map(group => <section className={`feature-group ${spells ? 'spell-level-group' : ''}`} data-spell-level={spells ? group.group : undefined} style={spells ? { '--spell-shade': `${6 + Math.min(9, Number(group.group)) * 6}%` } as CSSProperties : undefined} key={group.items[0].id}>{spells && <span className="spell-level-number" aria-label={`${group.group}环`}>{group.group}</span>}{grouped && <h4><button onClick={()=>{const ids=group.items.map(f=>f.id),all=ids.every(id=>expanded.has(id));saveLayout(ordered.map(f=>f.id),all?[...expanded].filter(id=>!ids.includes(id)):[...new Set([...expanded,...ids])]);}}>{group.origin}</button></h4>}<div className="feature-flow">{group.items.map(f => <article key={f.id} data-entry-id={f.entry.id} data-feature-id={f.id} data-drag-enabled={editing||f.entry.kind==='condition'} className={`feature-bubble ${expanded.has(f.id) ? 'is-expanded' : ''} ${f.restricted ? 'is-restricted' : ''} ${dragging === f.id ? 'is-dragging' : ''}`} onDragStart={event => event.preventDefault()}>
      <Reference reference={`entry:${f.entry.id}`} kind={f.entry.kind} menuOptions={{origin:'sheet',selectionId:f.id}} entry={{ ...f.entry, id: f.id, name: f.name, entries: Array.isArray(f.body) ? f.body : [f.body] }} sourceLabel={`${f.origin} · ${format(f.entry.source)}`} className="feature-caption" data-middle-action={editing&&spells&&spellState(c).mode==='prepared'&&Number(f.entry.raw.level)>0?'prepare-spell':undefined} onAuxClick={event=>{if(event.button===1&&editing&&spells&&spellState(c).mode==='prepared'&&Number(f.entry.raw.level)>0){event.preventDefault();event.stopPropagation();edit(draft=>{togglePreparedSpell(draft,f.id);});}}} aria-expanded={expanded.has(f.id)} aria-label={`${inline ? '状态' : expanded.has(f.id) ? '折叠' : '展开'}${f.name}`} onClick={() => toggle(f.id)} onPointerDown={event => {
        if(!editing&&f.entry.kind!=='condition')return;
        let lastTarget = '', lastPoint = { x: -1000, y: -1000 };
        cancel.current = pointerDrag(event, { title: f.name, subtitle: f.origin, outside: hit => !hit || !panel.current?.closest('.sheet-cell,.status-strip')?.contains(hit),
          start: () => { setDragging(f.id); setDraftOrder(live.current.ordered.map(item => item.id)); },
          cancel: () => { setDraftOrder(undefined); setDragging(''); },
          move: (point, hit) => {
            const target = hit?.closest<HTMLElement>('[data-feature-id]');
            if (!target || !panel.current?.contains(target) || target.dataset.featureId === f.id || target.dataset.featureId === lastTarget && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 14) return;
            const targetId = target.dataset.featureId!;
            const box = target.getBoundingClientRect();
            const after = live.current.expanded.has(targetId) ? point.y > box.y + box.height / 2 : point.x > box.x + box.width / 2;
            const next = reordered(f.id, targetId, after); if (!next || next.every((id, index) => live.current.ordered[index]?.id === id)) return;
            lastTarget = targetId; lastPoint = point;
            panel.current.querySelectorAll<HTMLElement>('[data-feature-id]').forEach(element => positions.current.set(element.dataset.featureId!, element.getBoundingClientRect()));
            live.current.ordered = next.flatMap(id => features.find(item => item.id === id) || []); setDraftOrder(next);
          },
          finish: (_point, hit) => {
            if(editing){const copied=quickbarDrop(hit,f.entry,live.current.edit);if(copied){setDraftOrder(undefined);setDragging('');return copied;}}
            const valid = !!hit && !!panel.current?.closest('.sheet-cell,.status-strip')?.contains(hit);
            const element = panel.current?.querySelector<HTMLElement>(`[data-feature-id="${CSS.escape(f.id)}"]`), box = element?.getBoundingClientRect();
            if (valid) saveOrder(live.current.ordered.map(item => item.id));
            else live.current.edit(draft => removeSelection(draft, f.id));
            setDraftOrder(undefined); setDragging('');
            if (valid && box) return { element:element! };if(!valid)return {removed:true};
          }
        });
      }} onKeyDown={event => { if(!editing&&f.entry.kind!=='condition')return; if (event.key === 'Delete') { event.preventDefault(); edit(draft => removeSelection(draft, f.id)); return; } if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1; const target = ordered[ordered.findIndex(item => item.id === f.id) + direction]; if (target) { const next = reordered(f.id, target.id, direction > 0); if (next) saveOrder(next); } }}>
        {expanded.has(f.id) ? <strong><em>{f.name.replace(/[。.]$/, '')}。</em></strong> : f.name}
      </Reference>{inline && conditionVisual(f.entry) === 'exhaustion' && <NumberInput className="exhaustion-level" aria-label="力竭层数" type="number" min="1" max="6" value={c.selections.find(s => s.id === f.id)?.level || 1} onChange={event => edit(draft => { const row = draft.selections.find(s => s.id === f.id); if (row) row.level = Math.max(1, Math.min(6, Math.trunc(Number(event.target.value) || 1))); })}/>} {expanded.has(f.id) && <div className="feature-prose rules-prose"><ContentBoundary key={f.id}><Entries value={f.body} onLink={onLink}/>{f.restricted && <p className="inline-warning">来源未启用</p>}</ContentBoundary></div>}
    </article>)}</div></section>)}
    </div>{children}{!inline && <button className="feature-browse" onClick={browse}>＋ 查阅{label}</button>}</>;
  if (inline) return <DropZone className="status-strip" kinds={kinds} onReceive={receive} wholePaper>{contents}</DropZone>;
  return <SheetCell label={label} className={`${className} traits-box feature-panel`} dropKinds={kinds} onReceive={receive} wholePaper={kinds.length === 1 && kinds[0] === 'condition'} onHeadingClick={() => saveLayout(ordered.map(f => f.id), allOpen ? [] : ordered.map(f => f.id))} headingExpanded={allOpen} headingActionLabel={`${allOpen ? '折叠' : '展开'}全部${label}`}>{contents}</SheetCell>;
}
