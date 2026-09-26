import { useEffect, useMemo, useRef, useState } from 'react';
import type { Entry, Kind } from '../core/model';
import { LIBRARY_TABS, tabOf, type FacetSelection, type LibraryTab } from './libraryData';

type TabState = { query:string; subclassesOpen?:boolean; focus?:string; edition: string; detailId?: string; filters: FacetSelection; sort: string; descending: boolean; positions: Record<string, number>; collapsed: Record<string, string[]> };
const initial = (tab?:LibraryTab): TabState => ({ query:'', edition: 'character', filters: {}, sort: tab==='spell'?'level':'source', descending: false, positions: {}, collapsed: {} });
const key = 'dnd-library-v2';
function read(): { active: LibraryTab; globalQuery:string; tabs: Partial<Record<LibraryTab, TabState>>; conditionDefault:boolean; sortDefaults:number } {
  try { const v = JSON.parse(localStorage.getItem(key) || '{}'); const tabs: Partial<Record<LibraryTab, TabState>> = {}; for (const tab of Object.keys(LIBRARY_TABS) as LibraryTab[]) { const s = v.tabs?.[tab]; if (!s || typeof s !== 'object') continue; const next = initial(tab); if (['character', '2014', '2024', 'all'].includes(s.edition)) next.edition = s.edition; next.query=typeof s.query==='string'?s.query:'';next.subclassesOpen=s.subclassesOpen===true; if (typeof s.detailId === 'string') next.detailId = s.detailId; if (v.sortDefaults === 2 && typeof s.sort === 'string') next.sort = s.sort; next.descending = v.sortDefaults === 2 && s.descending === true;
      if (s.filters && typeof s.filters === 'object') for (const [k, f] of Object.entries(s.filters) as [string, any][]) if (f && Array.isArray(f.include) && Array.isArray(f.exclude)) next.filters[k] = { include: f.include.filter((v: unknown) => typeof v === 'string'), exclude: f.exclude.filter((v: unknown) => typeof v === 'string') };
      if(tab==='condition' && v.sortDefaults !== 2 && next.filters.source?.include.every((id:string)=>['PHB','XPHB'].includes(id)) && !next.filters.source?.exclude.length)delete next.filters.source;
      if (s.positions && typeof s.positions === 'object') next.positions = Object.fromEntries(Object.entries(s.positions).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) as Record<string, number>;
      if (s.collapsed && typeof s.collapsed === 'object') next.collapsed = Object.fromEntries(Object.entries(s.collapsed).filter(([, v]) => Array.isArray(v) && v.every(x => typeof x === 'string'))) as Record<string, string[]>;
      tabs[tab] = next;
    } return { active: Object.hasOwn(LIBRARY_TABS, v.active) ? v.active : 'class', globalQuery:typeof v.globalQuery==='string'?v.globalQuery:typeof v.tabs?.[v.active]?.query==='string'?v.tabs[v.active].query:'', tabs,conditionDefault:true,sortDefaults:2 }; } catch { return { active: 'class', globalQuery:'', tabs: {},conditionDefault:true,sortDefaults:2 }; }
}
export function useLibrary(entries: Entry[],selectedEntries:Entry[]=[]) {
  const byId=useMemo(()=>new Map(entries.map(e=>[e.id,e])),[entries]);
  const selectedById=useMemo(()=>new Map(selectedEntries.map(e=>[e.id,e])),[selectedEntries]);
  const [saved, setSaved] = useState(read), snapshots = useRef(new Map<string, Entry>());
  const scrollSave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hover, setHover] = useState<{entry:Entry;focus?:string}>();
  const kind = hover ? tabOf(hover.entry) : saved.active;
  const state=useMemo(()=>saved.tabs[kind]||initial(kind),[saved.tabs,kind]);
  const [backStack,setBackStack]=useState<{tab:LibraryTab;state:TabState}[]>([]);
  const [navigationKey,setNavigationKey]=useState(0);
  const latest = useRef(saved); latest.current = saved;
  const flush = () => { try { localStorage.setItem(key, JSON.stringify(latest.current)); } catch { /* Reading preferences must not block character editing. */ } };
  useEffect(() => { const timer = setTimeout(flush, 120); return () => clearTimeout(timer); }, [saved]);
  useEffect(() => { window.addEventListener('pagehide', flush); return () => { clearTimeout(scrollSave.current); flush(); window.removeEventListener('pagehide', flush); }; }, []);
  function patch(value: Partial<TabState>,tab?:LibraryTab) { setSaved(s => {const target=tab||s.active;return { ...s, tabs: { ...s.tabs, [target]: { ...initial(target), ...s.tabs[target], ...value } } };}); }
  return { kind, state, patch, globalQuery:saved.globalQuery, setGlobalQuery:(globalQuery:string)=>setSaved(s=>({...s,globalQuery})), hover, preview:setHover, navigationKey, canGoBack:backStack.length>0,
    back:()=>{const target=backStack.at(-1);if(!target)return;setHover(undefined);setBackStack(s=>s.slice(0,-1));setSaved(s=>({...s,active:target.tab,tabs:{...s.tabs,[target.tab]:structuredClone(target.state)}}));setNavigationKey(n=>n+1);},
    navigate:(entry:Entry,focus?:string,push=true)=>{const current=latest.current,previous=current.tabs[current.active];if(push && previous?.detailId && (previous.detailId!==entry.id || previous.focus!==focus))setBackStack(stack=>[...stack.slice(-99),{tab:current.active,state:structuredClone(previous)}]);setNavigationKey(n=>n+1);snapshots.current.set(entry.id,entry);setHover(undefined);const next=tabOf(entry);setSaved(s=>({...s,active:next,tabs:{...s.tabs,[next]:{...initial(next),...s.tabs[next],detailId:entry.id,focus,...(focus==='subclasses'?{subclassesOpen:true}:{})}}}));},
    focus:hover ? hover.focus : state.focus,
    setKind: (next: Kind | LibraryTab) => {setHover(undefined);setSaved(s => ({ ...s, active: next === 'subclass' || next === 'feature' ? 'class' : next }));},
    detail: hover?.entry || selectedById.get(state.detailId || '') || byId.get(state.detailId || '') || snapshots.current.get(state.detailId || ''),
    setDetail: (entry?: Entry) => {setHover(undefined);if(entry){snapshots.current.set(entry.id,entry);const next=tabOf(entry);setSaved(s=>({...s,active:next,tabs:{...s.tabs,[next]:{...initial(next),...s.tabs[next],detailId:entry.id,focus:undefined}}}));}else patch({detailId:undefined,focus:undefined});},
    savePosition: (id: string, top: number) => { if(hover)return; const current = latest.current; const tab = current.tabs[current.active] || initial(current.active); tab.positions = { ...tab.positions, [id]: top }; current.tabs[current.active] = tab; clearTimeout(scrollSave.current); scrollSave.current = setTimeout(flush, 120); },
  };
}
