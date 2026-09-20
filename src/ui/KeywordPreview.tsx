import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { type Entry, KIND_LABELS } from '../core/model';
import { ContentBoundary, Entries } from './Entries';
import { EntryFacts } from './EntryFacts';
import { ReferenceContext } from './Reference';

export function KeywordPreview({ children, resolve, open }: { children: ReactNode; resolve: (reference: string, kind?: string) => Entry | undefined; open: (reference: string, kind?: string) => void }) {
  const [preview, setPreview] = useState<{ anchor: HTMLElement; reference: string; kind?: string }>();
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panel = useRef<HTMLElement>(null);
  const keep = () => clearTimeout(timer.current);
  const close = () => { keep(); setPreview(undefined); };
  const entry = preview ? resolve(preview.reference, preview.kind) : undefined;
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const moved = (event: Event) => { if (!panel.current?.contains(event.target as Node)) close(); };
    document.addEventListener('keydown', escape); document.addEventListener('scroll', moved, true); window.addEventListener('resize', close); window.addEventListener('dragstart', close);
    return () => { keep(); document.removeEventListener('keydown', escape); document.removeEventListener('scroll', moved, true); window.removeEventListener('resize', close); window.removeEventListener('dragstart', close); };
  }, []);
  useLayoutEffect(() => {
    if (!preview || !panel.current) return;
    const anchor = preview.anchor.getBoundingClientRect(), bounds = panel.current.getBoundingClientRect();
    setPosition({ left: Math.max(10, Math.min(innerWidth - bounds.width - 10, anchor.left)), top: Math.max(10, anchor.bottom + bounds.height + 10 < innerHeight ? anchor.bottom + 7 : anchor.top - bounds.height - 7) });
  }, [preview, entry]);
  return <ReferenceContext.Provider value={{ show: (anchor, reference, kind) => { keep(); timer.current = setTimeout(() => setPreview({ anchor, reference, kind }), 220); }, leave: () => { keep(); timer.current = setTimeout(close, 180); }, close, active: preview?.anchor }}>
    {children}
    {preview && createPortal(<aside className="keyword-preview" ref={panel} id="keyword-preview" role="tooltip" style={position} onMouseEnter={keep} onMouseLeave={() => { timer.current = setTimeout(close, 180); }}>
      <header><strong>{entry?.name || preview.reference.split('|')[0]}</strong><small>{entry ? `${KIND_LABELS[entry.kind]} · ${entry.source} · ${entry.edition === 'both' ? '通用' : entry.edition}` : '资料尚未收录'}</small></header>
      <div className="keyword-content rules-prose"><ReferenceContext.Provider value={null}>{entry ? <ContentBoundary key={entry.id}><EntryFacts entry={entry} onLink={open}/><Entries value={entry.entries} onLink={open}/>{!entry.entries.length && <p>此条目以结构化选项为主，点击关键词可查看完整资料。</p>}</ContentBoundary> : <p>当前资料库中未找到这个关键词。点击关键词可搜索相关资料。</p>}</ReferenceContext.Provider></div>
      <footer>点击关键词打开完整条目 · Esc 收起</footer>
    </aside>, document.body)}
  </ReferenceContext.Provider>;
}
