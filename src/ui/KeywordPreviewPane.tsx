import {entryLabel} from '../core/entryLabel';
import {SpellLearners} from './SpellLearners';
import {MonsterDocument} from './MonsterDocument';
import {useLayoutEffect,useRef,useState} from 'react';
import {entryEdition,KIND_LABELS} from '../core/model';
import {ContentBoundary,Entries} from './Entries';
import {EntryBadges} from './EntryBadges';
import {EntryFacts} from './EntryFacts';
import {useSources} from './SourceName';
import type {Preview} from './KeywordPreview';
export default function Pane({ value, pinned, index, keep, leave, open }: { value: Preview; pinned: boolean; index: number; keep: () => void; leave: () => void; open: (reference: string, kind?: string) => void }) {
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
  return <aside ref={ref} className={`keyword-preview ${pinned ? 'is-pinned' : ''} ${value.excluded?'entry-disabled':''}`} id={value.id} data-tooltip-id={value.id} role="tooltip" onDragStart={event => event.preventDefault()} style={{ ...position, zIndex: value.layer + 1 + index }} onMouseEnter={keep} onMouseLeave={leave}>
    <header><strong>{entry?entryLabel(entry):value.reference.split('|')[0]}{entry?.english && entry.english !== entry.name && <small className="tooltip-english"> {entry.english}</small>}</strong>{entry && <EntryBadges entry={entry}/>}<small>{value.sourceLabel || (entry ? `${KIND_LABELS[entry.kind]} · ${format(entry.source)} · ${entryEdition(entry) === 'both' ? '通用' : entryEdition(entry)}` : '资料尚未收录')}{pinned && <span className="tooltip-pin"> · 已固定</span>}</small></header>
    <div className="keyword-content rules-prose">{entry ? <ContentBoundary key={entry.id}>{entry.kind==='monster'?<MonsterDocument entry={entry} onLink={open}/>:<>{!value.sourceLabel && <EntryFacts entry={entry} onLink={open}/>}<Entries compact={entry.kind==='feature'} value={entry.entries} onLink={open}/><SpellLearners entry={entry} onLink={open}/></>}</ContentBoundary> : null}</div>
  </aside>;
}
