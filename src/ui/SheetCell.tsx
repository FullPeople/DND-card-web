import { type ReactNode, type DragEvent } from 'react';
import { type Kind, type Requirement } from '../core/model';
import { DropZone } from './DragEntry';

/** One framed field. Missing content is indicated by the perimeter, never an inner card. */
export function SheetCell({ label, children, className = '', missing = false, onFill, requirementId, hint, trailing, dropKinds, dropRequirement, onReceive, allowExisting }: {
  label: string; children?: ReactNode; className?: string; missing?: boolean; onFill?: () => void; requirementId?: string; hint?: string; trailing?: ReactNode;
  dropKinds?: Kind[]; dropRequirement?: Requirement; onReceive?: (event: DragEvent) => void; allowExisting?: boolean;
}) {
  const content = <><svg className="cell-perimeter" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M 5,1 H 95 L 99,5 V 95 L 95,99 H 5 L 1,95 V 5 Z" vectorEffect="non-scaling-stroke"/></svg><svg className="cell-perimeter cell-rounded-perimeter" aria-hidden="true"><rect x="1.5" y="1.5" rx="9.5"/></svg><header className="cell-heading"><h3>{label}</h3>{trailing}</header><div className="cell-content">{children}</div>{missing && onFill && <button className="cell-fill choose-button" onClick={event => { event.stopPropagation(); onFill(); }}>尚未填写，点击跳转</button>}</>;
  return <section className={`sheet-cell ${className} ${missing ? 'cell-missing' : ''}`} aria-label={label} data-requirement={requirementId} title={hint} onClick={event => {
    if (missing && onFill && !(event.target as HTMLElement).closest('button,input,select,textarea,a,summary,label')) onFill();
  }}>
    {dropKinds ? <DropZone className="cell-drop-surface" kinds={dropKinds} requirement={dropRequirement} onReceive={onReceive} allowExisting={allowExisting}>{content}</DropZone> : content}
  </section>;
}
