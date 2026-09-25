import {resolveEntryReference} from '../core/entryReferences';
import { explicitlyExcluded, librarySourceEnabled } from './libraryData';
import { useEffect, useMemo, useRef } from 'react';
import { entryEdition, editionAllows, type Character, type Entry } from '../core/model';
import { ContentBoundary, Entries, Inline } from './Entries';
import { EntryDraggable } from './DragEntry';
import { SourceName, compareSources, useSources } from './SourceName';

type Section = { id: string; name: string; english?: string; level?: number; source?: string; page?: number; body: unknown; depth: number; reference?: Entry; excluded?:boolean; subclassHeading?:boolean };
export function LibraryDocument({ entry, entries, onLink, inspect, collapsed, onCollapse, focus, character, preview, highlight,subclassesOpen=false }: { subclassesOpen?:boolean; preview?:boolean; highlight?:number; focus?: string; character: Character; entry: Entry; entries: Entry[]; onLink: (reference: string, kind?: string) => void; inspect: (entry: Entry) => void; collapsed: string[]; onCollapse: (ids: string[]) => void }) {
  const {registry}=useSources();
  const showSubclasses=subclassesOpen&&['class','subclass'].includes(entry.kind);
  const roots=useMemo(()=>{if(!showSubclasses||entry.kind==='subclass')return [entry];const parent=entry.kind==='class'?entry:entries.find(e=>e.kind==='class'&&[e.name,e.english].includes(entry.raw.className)&&e.source===(entry.raw.classSource||'PHB').toUpperCase());return parent?entries.filter(e=>e.kind==='subclass'&&[parent.name,parent.english].includes(e.raw.className)&&(e.raw.classSource||'PHB').toUpperCase()===parent.source&&librarySourceEnabled(character,e)).sort((a,b)=>compareSources(a.source,b.source,registry)||a.name.localeCompare(b.name,'zh')):[entry];},[entry,entries,showSubclasses,registry,character.profile.enabledSources,character.profile.exceptions]);
  const effectiveCollapsed=focus?[]:collapsed;
  const ref = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => {
    const result: Section[] = [];
    function walk(value: unknown, path: string, depth = 0, seen = new Set<string>(), level?: number, owner=entry, inheritedExcluded=false) {
      const excluded=inheritedExcluded||explicitlyExcluded(character,owner);
      if (depth > 12 || value == null) return;
      if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}-${i}`, depth, seen, level, owner, excluded)); return; }
      if (typeof value === 'object') {
        const v = value as Record<string, any>, pointer = v.classFeature || v.subclassFeature || v.optionalfeature;
        // 特性正文里的引用是它自己的选项（如圣职的保护者/奇术使），留在正文里内联，不再提升成同级段落。
        if (typeof v.type === 'string' && v.type.startsWith('ref') && typeof pointer === 'string' && owner.kind !== 'feature') {
          const found = resolveEntryReference(pointer,entries,'feature');
          if (found && !librarySourceEnabled(character,found)) return;
          if (found && !seen.has(found.id)) {
            const visited = new Set(seen).add(found.id);
            result.push({ id: path, name: found.name, english: found.english, level: found.raw.level || level, source: found.source, page: found.page, body: [], depth, reference: found, excluded:excluded||explicitlyExcluded(character,found) });
            walk(found.entries, `${path}-body`, depth + 1, visited, found.raw.level || level, found, excluded); return;
          }
        }
        if (owner.kind!=='feature' && v.name && ['entries', 'section', undefined].includes(v.type) && (v.entries || v.entry)) {
          result.push({ id: path, excluded, name: v.name, english: v.ENG_name, body: [], depth, level, reference: ['race','background','feat','class','subclass','feature'].includes(entry.kind) && !(v.entries?.length===1 && v.entries[0]?.type==='list' && v.entries[0].items?.every((item:any)=>item?.type?.startsWith('ref'))) ? {...owner,id:`${owner.id}#trait:${path.replace(/^section-/, '')}`,kind:'feature',effects:undefined,choices:undefined,name:v.name,english:v.ENG_name||v.name,entries:Array.isArray(v.entries)?v.entries:[v.entry].filter(Boolean),raw:{_inlineOwner:owner.id,_inlineName:v.name,className:owner.kind==='class'?owner.name:owner.raw.className,classEnglish:owner.kind==='class'?owner.english:owner.raw.classEnglish,classSource:owner.kind==='class'?owner.source:owner.raw.classSource,subclassShortName:owner.kind==='subclass'?owner.raw.shortName||owner.name:owner.raw.subclassShortName,subclassSource:owner.kind==='subclass'?owner.source:owner.raw.subclassSource,level}} : undefined });
          walk(v.entries || v.entry, `${path}-body`, depth + 1, seen, level, owner, excluded); return;
        }
        if (v.type === 'list' && v.items?.some((i: any) => i?.type?.startsWith('ref'))) { walk(v.items, path, depth, seen, level, owner, excluded); return; }
        if (!v.name && ['entries', 'section', 'options'].includes(v.type) && v.entries) { walk(v.entries, path, depth, seen, level, owner, excluded); return; }
      }
      const last = result.at(-1);
      if (last && last.depth === depth - 1) (last.body as unknown[]).push(value);
      else result.push({ id: path, name: '', body: [value], depth, level, excluded });
    }
    for(const root of roots){
    const prefix=showSubclasses?`subclass-${root.id}-`:'';
    const baseDepth=showSubclasses?1:0;
    if(showSubclasses)result.push({id:prefix+'body',name:root.name,english:root.english,source:root.source,page:root.page,depth:0,body:[],reference:root,excluded:explicitlyExcluded(character,root),subclassHeading:true});
    walk(root.entries, prefix+'section',baseDepth,new Set(),undefined,root);
    for (const [index, group] of (root.raw.optionalfeatureProgression || []).entries()) {
      const options = entries.filter(e => e.raw._category === 'optionalfeature' && editionAllows(e,entryEdition(root)==='both'?character.edition:entryEdition(root) as '2014'|'2024') && librarySourceEnabled(character,e) && (e.raw.featureType || []).some((t: string) => (group.featureType || []).includes(t)));
      if (!options.length) continue;
      result.push({id:`${prefix}options-${index}`, name:group.name, english:group.ENG_name, depth:baseDepth, body:[],excluded:explicitlyExcluded(character,root)});
      for (const option of options) result.push({id:`${prefix}option-${option.id}`,name:option.name,english:option.english,source:option.source,page:option.page,depth:baseDepth+1,body:option.entries,reference:option,excluded:explicitlyExcluded(character,root)||explicitlyExcluded(character,option)});
    }
    const tables=root.raw.classTableGroups||root.raw.subclassTableGroups;
    if (tables?.some((g: any) => g.colLabels?.length)){const table={ id: prefix+'progression', excluded:explicitlyExcluded(character,root), name: '职业成长表', depth: baseDepth, body: tables.filter((g: any) => g.colLabels?.length).map((g: any) => ({ type: 'table', caption: g.title, colLabels: ['等级', ...g.colLabels], rows: (g.rows || g.rowsSpellProgression || []).map((row: unknown[], index: number) => [index + 1, ...row]) })) };if(showSubclasses)result.push(table);else result.unshift(table);}
    }
    return result;
  }, [entry, entries, roots,showSubclasses, character.profile.enabledSources, character.profile.disabledEntries]);
  const navigation = entry.kind === 'class' || entry.kind === 'subclass' ? sections.filter(s => showSubclasses?s.subclassHeading:s.name) : [];
  // A collapsed heading hides its descendants, while preserving each descendant's own state.
  const hidden = new Set<string>(); let parentDepth = Infinity;
  for (const s of sections) { if (s.depth > parentDepth) hidden.add(s.id); else parentDepth = Infinity; if (effectiveCollapsed.includes(s.id) && !hidden.has(s.id)) parentDepth = s.depth; }
  useEffect(() => {
    const container=ref.current?.closest<HTMLElement>('.entry-detail');if(!container||!navigation.length)return;
    let frame=0, active='', offsets:{id:string;top:number}[]=[];
    const measure=()=>{const top=container.getBoundingClientRect().top;offsets=[...(ref.current?.querySelectorAll<HTMLElement>('[data-section]')||[])].filter(node=>!showSubclasses||navigation.some(s=>s.id===node.dataset.section)).map(node=>({id:node.dataset.section!,top:node.getBoundingClientRect().top-top+container.scrollTop}));update();};
    const update=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;const top=container.scrollTop+(container.querySelector('.detail-frozen')?.clientHeight||0)+14;let lo=0,hi=offsets.length;while(lo<hi){const mid=(lo+hi)>>1;if(offsets[mid].top<=top)lo=mid+1;else hi=mid;}const id=offsets[Math.max(0,lo-1)]?.id||'';if(id===active)return;ref.current?.querySelector('.document-nav button.active')?.classList.remove('active');ref.current?.querySelector(`[data-nav-section="${CSS.escape(id)}"]`)?.classList.add('active');active=id;});};
    const observer=new ResizeObserver(measure);observer.observe(ref.current!);container.addEventListener('scroll',update,{passive:true});measure();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();container.removeEventListener('scroll',update);};
  }, [entry.id, sections, collapsed]);
  function go(id: string) {
    const section = sections.find(s => s.id === id);
    if (!section) { const node=ref.current?.closest('.entry-detail')?.querySelector<HTMLElement>(`[data-anchor="${id}"]`); if(node) jump(node); return; }
    const ancestors = sections.slice(0, sections.indexOf(section)).filter(s => effectiveCollapsed.includes(s.id) && section.id.startsWith(`${s.id}-body`));
    if (ancestors.length && !focus) onCollapse(collapsed.filter(x => !ancestors.some(s => s.id === x)));
    requestAnimationFrame(() => { const node = ref.current?.querySelector<HTMLElement>(`[data-section="${id}"]`), pane = ref.current?.closest('.entry-detail'); if (node && pane) jump(node); });
  }
  useEffect(()=>{const pane=ref.current?.closest<HTMLElement>('.entry-detail'), frozen=pane?.querySelector('.detail-frozen');if(!pane||!frozen)return;const observer=new ResizeObserver(()=>pane.style.setProperty('--frozen-height',`${frozen.getBoundingClientRect().height+8}px`));observer.observe(frozen);return()=>observer.disconnect();},[entry.id]);
  function jump(node: HTMLElement) { const pane=ref.current?.closest('.entry-detail'); if(!pane)return; const frozen=pane.querySelector('.detail-frozen')?.getBoundingClientRect().height || 0; pane.scrollTo({top:pane.scrollTop+node.getBoundingClientRect().top-pane.getBoundingClientRect().top-frozen-8,behavior:'instant'}); }
  useEffect(()=>{const pane=ref.current?.closest('.entry-detail'); const handler=(event:Event)=>go((event as CustomEvent<string>).detail); pane?.addEventListener('library-jump',handler);return()=>pane?.removeEventListener('library-jump',handler);});
  useEffect(()=>{if(!focus)return;const section=sections.find(s=>s.reference?.id===focus || focus===`name:${s.name}`);go(section?.id || focus);},[focus,entry.id,showSubclasses]);
  const focusSection=sections.find(s=>s.reference?.id===focus||focus===`name:${s.name}`||s.id===focus)?.id;
  return <div className="library-document" ref={ref}>
    {navigation.length > 0 && <nav className="document-nav" aria-label="正文目录"><strong>目录</strong><div>{navigation.map((s, index) => <div key={s.id}>{s.level && s.level !== navigation[index - 1]?.level && <span className="nav-level">等级 {s.level}</span>}<button data-nav-section={s.id} title={s.name} onClick={() => go(s.id)}>{s.name}{s.subclassHeading&&s.source&&<small> <SourceName id={s.source}/></small>}</button></div>)}</div></nav>}
    <div className={`document-prose rules-prose ${navigation.length ? 'with-nav' : ''}`}><ContentBoundary key={entry.id}>{sections.filter(s => !hidden.has(s.id)).map(s => <section key={`${s.id}:${s.id===focusSection?highlight||0:0}`} data-anchor={s===sections.find(x=>x.id!=='progression')?'body':undefined} data-section={s.name ? s.id : undefined} data-entry-id={s.reference?.id} data-described-entry={s.reference?.id} className={`document-section ${s.id===focusSection && (preview||highlight) ? preview?'reading-highlight':'reading-highlight-fade' : ''} depth-${Math.min(s.depth, 2)} ${s.excluded ? 'entry-disabled' : ''}`}>
      {s.name && <h4><EntryDraggable className="document-heading-toggle" dragEnabled={!!s.reference} entry={s.reference || entry} aria-expanded={!effectiveCollapsed.includes(s.id)} aria-label={`${effectiveCollapsed.includes(s.id) ? '展开' : '折叠'}段落 ${s.name}`} onClick={() => onCollapse(effectiveCollapsed.includes(s.id) ? collapsed.filter(x => x !== s.id) : [...collapsed, s.id])}>
        {s.level && s.reference && <span>等级 {s.level}：</span>}<Inline text={s.name}/> {s.english && s.english !== s.name && <small>{s.english}</small>}{s.source && <span className="section-tools"><small><SourceName id={s.source}/>{s.page ? ` p${s.page}` : ''}</small></span>}
      </EntryDraggable></h4>}
      {!effectiveCollapsed.includes(s.id) && <Entries compact={entry.kind==='feature'||s.reference?.kind==='feature'} value={s.body} onLink={onLink}/>}
    </section>)}</ContentBoundary></div>
  </div>;
}
