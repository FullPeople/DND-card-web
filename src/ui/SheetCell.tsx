import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { type Entry, type Kind, type Requirement } from '../core/model';
import { CellArt, CellHalo } from './CellArt';
import { DropZone } from './DragEntry';

/** The inner surface clips both the title band and contents to the same cut corners. */
export function SheetCell({ label, children, className = '', missing = false, dashed = false, onFill, requirementId, hint, trailing, dropKinds, dropRequirement, onReceive, allowExisting, flashKey, onHeadingClick, headingActionLabel, headingExpanded, accepts, wholePaper }: {
  accepts?: (entry: Entry) => boolean; wholePaper?: boolean;
  onHeadingClick?: () => void; headingActionLabel?: string; headingExpanded?: boolean;
  flashKey?: string; label: string; children?: ReactNode; className?: string; missing?: boolean; dashed?: boolean; onFill?: () => void; requirementId?: string; hint?: string; trailing?: ReactNode;
  dropKinds?: Kind[]; dropRequirement?: Requirement; onReceive?: (entry: Entry) => void; allowExisting?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const outlined = missing && dashed;
  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize[0];
      setSize({ width: box.inlineSize, height: box.blockSize });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const { width: w, height: h } = size;
  const content = <><header className={`cell-heading ${onHeadingClick ? 'heading-action' : ''}`} role={onHeadingClick ? 'button' : undefined} tabIndex={onHeadingClick ? 0 : undefined} aria-label={onHeadingClick ? headingActionLabel || label : undefined} aria-expanded={headingExpanded} onClick={onHeadingClick ? event => { event.stopPropagation(); onHeadingClick(); } : undefined} onKeyDown={onHeadingClick ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onHeadingClick(); } } : undefined}><h3>{label}</h3>{trailing}</header><div className="cell-content">{children}{outlined && onFill && <button className="cell-fill choose-button" onClick={event => { event.stopPropagation(); onFill(); }}>点击填写</button>}</div></>;
  return <section ref={ref} className={`sheet-cell ${className} ${missing ? 'cell-incomplete' : ''} ${outlined ? 'cell-missing' : ''}`} aria-label={label} data-requirement={requirementId} title={hint} onClick={event => {
    if (missing && onFill && !(event.target as HTMLElement).closest('button,input,select,textarea,a,summary,label')) onFill();
  }}>
    <div className="cell-face">
    {flashKey && <span key={flashKey} className="cell-sheen" aria-hidden="true"/>}
    {outlined && w > 0 && <svg className="cell-perimeter" aria-hidden="true"><path d={`M 8.6 1.5 H ${w - 8.6} L ${w - 1.5} 8.6 V ${h - 8.6} L ${w - 8.6} ${h - 1.5} H 8.6 L 1.5 ${h - 8.6} V 8.6 Z`}/></svg>}
    <div className="cell-surface">{dropKinds ? <DropZone className="cell-drop-surface" kinds={dropKinds} requirement={dropRequirement} onReceive={onReceive} allowExisting={allowExisting} accepts={accepts} wholePaper={wholePaper}>{content}</DropZone> : content}</div><CellArt width={w} height={h} missing={outlined}/></div>{className.includes('portrait-cell') && <CellHalo kind="portrait"/>}{className.includes('initiative-cell') && <CellHalo kind="initiative"/>}
  </section>;
}
