import { createContext, useContext, useState, type DragEvent, type ReactNode } from 'react';
import { candidateReason } from '../core/engine';
import { type Character, type Entry, type Kind, type Requirement } from '../core/model';

export const DragContext = createContext<{ entry?: Entry; character: Character; drop: (event: DragEvent, requirement?: Requirement, expected?: Kind[]) => void; end: () => void } | null>(null);
export function DropZone({ children, requirement, kinds, className = '' }: { children: ReactNode; requirement?: Requirement; kinds?: Kind[]; className?: string }) {
  const drag = useContext(DragContext);
  const [over, setOver] = useState(false);
  const entry = drag?.entry;
  const compatible = !!entry && (!requirement || !!requirement.kind && !requirement.options && !requirement.complete) && (!kinds || kinds.includes(entry.kind)) && !candidateReason(drag!.character, entry, requirement) && !(entry.kind === 'class' && !drag!.character.profile.optional.multiclass && drag!.character.selections.some(s => s.entry.kind === 'class')) && !(['race', 'background'].includes(entry.kind) && drag!.character.selections.some(s => s.entry.kind === entry.kind));
  return <div className={`drop-zone ${className} ${compatible ? 'drop-ready' : ''} ${compatible && over ? 'drop-over' : ''}`} data-drop-kind={requirement?.kind || kinds?.join(',')} onDragOver={event => {
    event.stopPropagation();
    event.dataTransfer.dropEffect = compatible ? 'copy' : 'none';
    if (compatible) { event.preventDefault(); setOver(true); }
  }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false); }} onDrop={event => {
    event.preventDefault(); event.stopPropagation(); setOver(false);
    if (compatible) drag?.drop(event, requirement, kinds);
    drag?.end();
  }}>{children}</div>;
}
