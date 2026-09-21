import { useSources } from './SourceName';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Entry } from '../core/model';
import { facetsFor, matchesFacets, type FacetSelection, type LibraryTab } from './libraryData';

export function LibraryFilters({ tab, entries, filters, change, names, enabledOnly, setEnabledOnly, enabledSources }: { enabledOnly: boolean; setEnabledOnly: (value: boolean) => void; enabledSources: string[]; tab: LibraryTab; entries: Entry[]; filters: FacetSelection; change: (filters: FacetSelection) => void; names: Record<string, string> }) {
  const {format}=useSources();
  const [open, setOpen] = useState(false), [search, setSearch] = useState(''), [active, setActive] = useState('source');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) { ref.current?.showModal(); setSearch(''); } }, [open]);
  const facets = useMemo(() => facetsFor(tab).map(f => ({ ...f, options: [...new Set(entries.flatMap(f.values))].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true })) })).filter(f => f.options.length || filters[f.key]), [tab, entries, filters]);
  const allowed = useMemo(() => entries.filter(e => !enabledOnly || enabledSources.includes(e.source)), [entries, enabledOnly, enabledSources]);
  const field = facets.find(f => f.key === active) || facets[0];
  const count = Object.values(filters).reduce((n, f) => n + f.include.length + f.exclude.length, 0);
  function toggle(key: string, value: string, exclude: boolean) {
    const old = filters[key] || { include: [], exclude: [] }, side = exclude ? 'exclude' : 'include', other = exclude ? 'include' : 'exclude';
    change({ ...filters, [key]: { [side]: old[side].includes(value) ? old[side].filter(v => v !== value) : [...old[side], value], [other]: old[other].filter(v => v !== value) } as FacetSelection[string] });
  }
  const label = (key: string, value: string) => key === 'source' && names[value] ? format(value) : key === 'level' ? `${value} 级 / 环` : value;
  const counts = useMemo(() => { const result = new Map<string, number>(); if (field) for (const e of allowed) if (matchesFacets(e, filters, facets, field.key)) for (const v of new Set(field.values(e))) result.set(v, (result.get(v) || 0) + 1); return result; }, [allowed, filters, facets, field]);
  return <><button className="filter-trigger" onClick={() => setOpen(true)}>筛选{count ? ` · ${count}` : ''}</button>{count > 0 && <button className="filter-reset" onClick={() => change({})}>清空</button>}
    {open && <dialog className="library-filter-dialog" ref={ref} onCancel={() => setOpen(false)} onClick={e => { if (e.target === ref.current) setOpen(false); }} aria-label="筛选规则资料">
      <header><strong>筛选资料</strong><span>{allowed.filter(e => matchesFacets(e, filters, facets)).length} / {entries.length} 条</span><button aria-label="关闭筛选" onClick={() => setOpen(false)}>×</button></header>
      <div className="filter-explanation">同组任选其一，不同组同时满足。勾选保留，点「排除」隐藏；未选条件表示不限。</div>
      <div className="active-filters">{facets.flatMap(f => (['include', 'exclude'] as const).flatMap(side => (filters[f.key]?.[side] || []).map(v => <button key={`${f.key}:${side}:${v}`} onClick={() => toggle(f.key, v, side === 'exclude')}>{side === 'exclude' ? '排除 ' : ''}{f.label}：{label(f.key, v)} ×</button>)))}{!count && <span>当前没有额外限制</span>}</div>
      <div className="filter-body"><nav aria-label="筛选维度">{facets.map(f => <button key={f.key} className={f === field ? 'active' : ''} onClick={() => { setActive(f.key); setSearch(''); }}>{f.label}<small>{(filters[f.key]?.include.length || 0) + (filters[f.key]?.exclude.length || 0) || f.options.length}</small></button>)}</nav>
        <section><div className="filter-options-tools"><input aria-label="搜索筛选条件" placeholder={`搜索${field?.label || '条件'}…`} value={search} onChange={e => setSearch(e.target.value)}/><button onClick={() => { if (field) { const next = { ...filters }; delete next[field.key]; change(next); } }}>本组不限</button></div>
          <div className="filter-options">{field?.options.filter(v => label(field.key, v).toLowerCase().includes(search.toLowerCase())).map(v => <div key={v} className={filters[field.key]?.exclude.includes(v) ? 'excluded' : ''}><label><input type="checkbox" checked={filters[field.key]?.include.includes(v) || false} onChange={() => toggle(field.key, v, false)}/><span>{label(field.key, v)}</span><small>{counts.get(v) || 0}</small></label><button aria-label={`排除${v}`} aria-pressed={filters[field.key]?.exclude.includes(v) || false} onClick={() => toggle(field.key, v, true)}>排除</button></div>)}</div>
        </section></div><footer><button onClick={() => change({})}>重置全部</button><label><input type="checkbox" checked={enabledOnly} onChange={e => setEnabledOnly(e.target.checked)}/>仅角色已启用来源</label><button className="primary" onClick={() => setOpen(false)}>完成 · 查看结果</button></footer>
    </dialog>}
  </>;
}
