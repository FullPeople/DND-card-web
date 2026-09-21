import { explicitlyExcluded } from './libraryData';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Character, type Entry } from '../core/model';
import { ContentBoundary, Entries, Inline } from './Entries';
import { EntryDraggable } from './DragEntry';
import { SourceName } from './SourceName';

type Section = { id: string; name: string; english?: string; level?: number; source?: string; page?: number; body: unknown; depth: number; reference?: Entry };
function featureReference(ref: string, category: string, entries: Entry[]) {
  const p = ref.split('|'), sub = category === 'refSubclassFeature';
  const same = (a: unknown, b: string) => String(a || '').toLowerCase() === b.toLowerCase();
  return entries.find(e => e.kind === 'feature' && [e.name, e.english].some(n => same(n, p[0])) && same(e.raw.className, p[1]) && same(e.raw.classSource || 'PHB', p[2] || 'PHB') &&
    (sub ? same(e.raw.subclassShortName, p[3]) && same(e.raw.subclassSource || p[2] || 'PHB', p[4] || p[2] || 'PHB') && Number(e.raw.level) === Number(p[5]) && same(e.source, p[6] || p[4] || p[2] || 'PHB') : Number(e.raw.level) === Number(p[3]) && same(e.source, p[4] || p[2] || 'PHB')));
}
export function LibraryDocument({ entry, entries, onLink, inspect, collapsed, onCollapse, focus, character }: { focus?: string; character: Character; entry: Entry; entries: Entry[]; onLink: (reference: string, kind?: string) => void; inspect: (entry: Entry) => void; collapsed: string[]; onCollapse: (ids: string[]) => void }) {
  const effectiveCollapsed=focus?[]:collapsed;
  const ref = useRef<HTMLDivElement>(null), [active, setActive] = useState('');
  const sections = useMemo(() => {
    const result: Section[] = [];
    function walk(value: unknown, path: string, depth = 0, seen = new Set<string>(), level?: number) {
      if (depth > 12 || value == null) return;
      if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}-${i}`, depth, seen, level)); return; }
      if (typeof value === 'object') {
        const v = value as Record<string, any>, pointer = v.classFeature || v.subclassFeature || v.optionalfeature;
        if (typeof v.type === 'string' && v.type.startsWith('ref') && typeof pointer === 'string') {
          const found = v.type === 'refOptionalfeature' ? entries.find(e => e.kind === 'feature' && [e.name, e.english].includes(pointer.split('|')[0]) && e.source.toLowerCase() === (pointer.split('|')[1] || 'phb').toLowerCase()) : featureReference(pointer, v.type, entries);
          if (found && !seen.has(found.id)) {
            const visited = new Set(seen).add(found.id);
            result.push({ id: path, name: found.name, english: found.english, level: found.raw.level || level, source: found.source, page: found.page, body: [], depth, reference: found });
            walk(found.entries, `${path}-body`, depth + 1, visited, found.raw.level || level); return;
          }
        }
        if (v.name && ['entries', 'section', undefined].includes(v.type) && (v.entries || v.entry)) {
          result.push({ id: path, name: v.name, english: v.ENG_name, body: [], depth, level, reference: ['race','background','feat','class','subclass','feature'].includes(entry.kind) && !(v.entries?.length===1 && v.entries[0]?.type==='list' && v.entries[0].items?.every((item:any)=>item?.type?.startsWith('ref'))) ? {...entry,id:`${entry.id}#trait:${path.replace(/^section-/, '')}`,kind:'feature',effects:undefined,choices:undefined,name:v.name,english:v.ENG_name||v.name,entries:Array.isArray(v.entries)?v.entries:[v.entry].filter(Boolean),raw:{_inlineOwner:entry.id,_inlineName:v.name}} : undefined });
          walk(v.entries || v.entry, `${path}-body`, depth + 1, seen, level); return;
        }
        if (v.type === 'list' && v.items?.some((i: any) => i?.type?.startsWith('ref'))) { walk(v.items, path, depth, seen, level); return; }
      }
      const last = result.at(-1);
      if (last && last.depth === depth - 1) (last.body as unknown[]).push(value);
      else result.push({ id: path, name: '', body: [value], depth, level });
    }
    walk(entry.entries, 'section');
    for (const [index, group] of (entry.raw.optionalfeatureProgression || []).entries()) {
      const options = entries.filter(e => e.raw._category === 'optionalfeature' && (e.edition === 'both' || entry.edition === e.edition) && (e.raw.featureType || []).some((t: string) => (group.featureType || []).includes(t)));
      if (!options.length) continue;
      result.push({id:`options-${index}`, name:group.name, english:group.ENG_name, depth:0, body:[]});
      for (const option of options) result.push({id:`option-${option.id}`,name:option.name,english:option.english,source:option.source,page:option.page,depth:1,body:option.entries,reference:option});
    }
    if (entry.raw.classTableGroups?.some((g: any) => g.colLabels?.length)) result.unshift({ id: 'progression', name: '职业成长表', depth: 0, body: entry.raw.classTableGroups.filter((g: any) => g.colLabels?.length).map((g: any) => ({ type: 'table', caption: g.title, colLabels: ['等级', ...g.colLabels], rows: (g.rows || g.rowsSpellProgression || []).map((row: unknown[], index: number) => [index + 1, ...row]) })) });
    return result;
  }, [entry, entries]);
  const navigation = entry.kind === 'class' || entry.kind === 'subclass' ? sections.filter(s => s.name) : [];
  // A collapsed heading hides its descendants, while preserving each descendant's own state.
  const hidden = new Set<string>(); let parentDepth = Infinity;
  for (const s of sections) { if (s.depth > parentDepth) hidden.add(s.id); else parentDepth = Infinity; if (effectiveCollapsed.includes(s.id) && !hidden.has(s.id)) parentDepth = s.depth; }
  useEffect(() => {
    const container = ref.current?.closest('.entry-detail'); if (!container) return;
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { const top = container.getBoundingClientRect().top + (container.querySelector('.detail-frozen')?.getBoundingClientRect().height||0) + 14; const visible = [...(ref.current?.querySelectorAll<HTMLElement>('[data-section]') || [])]; const current = visible.filter(node => node.getBoundingClientRect().top <= top).at(-1) || visible[0]; setActive(current?.dataset.section || ''); }); };
    container.addEventListener('scroll', update, { passive: true }); update();
    return () => { cancelAnimationFrame(frame); container.removeEventListener('scroll', update); };
  }, [entry.id, sections, collapsed]);
  function go(id: string) {
    const section = sections.find(s => s.id === id);
    if (!section) { const node=ref.current?.querySelector<HTMLElement>(`[data-anchor="${id}"]`); if(node) jump(node); return; }
    const ancestors = sections.slice(0, sections.indexOf(section)).filter(s => effectiveCollapsed.includes(s.id) && section.id.startsWith(`${s.id}-body`));
    if (ancestors.length && !focus) onCollapse(collapsed.filter(x => !ancestors.some(s => s.id === x)));
    requestAnimationFrame(() => { const node = ref.current?.querySelector<HTMLElement>(`[data-section="${id}"]`), pane = ref.current?.closest('.entry-detail'); if (node && pane) jump(node); });
  }
  useEffect(()=>{const pane=ref.current?.closest<HTMLElement>('.entry-detail'), frozen=pane?.querySelector('.detail-frozen');if(!pane||!frozen)return;const observer=new ResizeObserver(()=>pane.style.setProperty('--frozen-height',`${frozen.getBoundingClientRect().height+8}px`));observer.observe(frozen);return()=>observer.disconnect();},[entry.id]);
  function jump(node: HTMLElement) { const pane=ref.current?.closest('.entry-detail'); if(!pane)return; const frozen=pane.querySelector('.detail-frozen')?.getBoundingClientRect().height || 0; pane.scrollTo({top:pane.scrollTop+node.getBoundingClientRect().top-pane.getBoundingClientRect().top-frozen-8,behavior:'instant'}); }
  useEffect(()=>{const pane=ref.current?.closest('.entry-detail'); const handler=(event:Event)=>go((event as CustomEvent<string>).detail); pane?.addEventListener('library-jump',handler);return()=>pane?.removeEventListener('library-jump',handler);});
  useEffect(()=>{if(!focus)return;const section=sections.find(s=>s.reference?.id===focus || focus===`name:${s.name}`);if(section)go(section.id);},[focus,entry.id]);
  const subclasses = entry.kind === 'class' ? entries.filter(e => e.kind === 'subclass' && [entry.name, entry.english].includes(e.raw.className) && (e.raw.classSource || 'PHB').toUpperCase() === entry.source) : [];
  return <div className="library-document" ref={ref}>
    {subclasses.length > 0 && <div className="class-subclasses" data-anchor="subclasses"><strong>子职</strong>{subclasses.map(e => <EntryDraggable className={explicitlyExcluded(character,e)?'entry-disabled':''} key={e.id} entry={e} onClick={() => inspect(e)}>{e.name} <small><SourceName id={e.source}/></small></EntryDraggable>)}</div>}
    {navigation.length > 0 && <nav className="document-nav" aria-label="正文目录"><strong>目录</strong><div>{navigation.map((s, index) => <div key={s.id}>{s.level && s.level !== navigation[index - 1]?.level && <span className="nav-level">等级 {s.level}</span>}<button className={active === s.id ? 'active' : ''} title={s.name} onClick={() => go(s.id)}>{s.name}</button></div>)}</div></nav>}
    <div className={`document-prose rules-prose ${navigation.length ? 'with-nav' : ''}`}><ContentBoundary key={entry.id}>{sections.filter(s => !hidden.has(s.id)).map(s => <section key={s.id} data-anchor={s===sections.find(x=>x.id!=='progression')?'body':undefined} data-section={s.name ? s.id : undefined} data-entry-id={s.reference?.id} data-described-entry={s.reference?.id} className={`document-section depth-${Math.min(s.depth, 2)} ${s.reference && explicitlyExcluded(character,s.reference) ? 'entry-disabled' : ''}`}>
      {s.name && <h4><EntryDraggable className="document-heading-toggle" dragEnabled={!!s.reference} entry={s.reference || entry} aria-expanded={!effectiveCollapsed.includes(s.id)} aria-label={`${effectiveCollapsed.includes(s.id) ? '展开' : '折叠'}段落 ${s.name}`} onClick={() => onCollapse(effectiveCollapsed.includes(s.id) ? collapsed.filter(x => x !== s.id) : [...collapsed, s.id])}>
        {s.level && s.reference && <span>等级 {s.level}：</span>}<Inline text={s.name}/> {s.english && s.english !== s.name && <small>{s.english}</small>}{s.source && <span className="section-tools"><small><SourceName id={s.source}/>{s.page ? ` p${s.page}` : ''}</small></span>}
      </EntryDraggable></h4>}
      {!effectiveCollapsed.includes(s.id) && <Entries value={s.body} onLink={onLink}/>}
    </section>)}</ContentBoundary></div>
  </div>;
}
