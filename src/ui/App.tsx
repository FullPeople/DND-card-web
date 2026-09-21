import { explicitlyExcluded } from './libraryData';
import { MonsterDocument, MonsterPortrait } from './MonsterDocument';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ABILITIES, ABILITY_LABELS, KIND_LABELS, SKILLS, newCharacter, selectionAllowed, uid, type Character, type Edition, type Entry, type Kind, type Selection } from '../core/model';
import { candidateReason, choiceLabel, evaluate, requirementMismatch } from '../core/engine';
import { EXAMPLE_PACK, importOwlbear, parseFile, validateCharacter, validatePack } from '../core/validation';
import { exportCharacter, exportOwlbear, exportReview, exportRulePack } from '../core/export';
import { loadCatalog, DEFAULT_SOURCE, type LoadProgress } from '../data/catalog';
import { download, loadWorkspace, pickFile, restoreBackup, saveWorkspace, type Workspace } from '../platform/storage';
import { ContentBoundary, Entries } from './Entries';
import { EntryFacts } from './EntryFacts';
import { AdjustedValue, SheetEditContext } from './SheetEdit';
import { SIZE_ENTRIES } from '../data/sizes';
import { EntryBadges } from './EntryBadges';
import { SheetCell } from './SheetCell';
import { FeaturePanel } from './FeaturePanel';
import { Overview } from './Overview';
import { IdentityToken } from './IdentityToken';
import { syncFeatures, removeSelection } from '../core/sheet';
import { PaperFrame, type SheetPage } from './PaperFrame';
import { DropZone, EntryDragProvider, EntryDraggable } from './DragEntry';
import { GlobalSearch } from './GlobalSearch';
import { SourceSettings } from './SourceSettings';
import { SourceName, useSources } from './SourceName';
import { KeywordPreview } from './KeywordPreview';
import { Reference } from './Reference';
import { LibraryFilters } from './LibraryFilters';
import { LibraryDocument } from './LibraryDocument';
import { useLibrary } from './useLibrary';
import { LIBRARY_TABS, tabOf, columnsFor, facetsFor, matchesFacets, compareEntries } from './libraryData';
import { WikiSplitter } from './WikiSplitter';
import { registerOffline } from '../platform/offline';

const emptyProgress: LoadProgress = { done: 0, total: 1, label: '等待资料', failed: [], cached: 0 };
const clamp = (value: string, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const fileName = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100) || '角色';
type Edit = (action: (draft: Character) => void, key?: string) => void;

function Box({ label, children, className = '', hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return <SheetCell label={label} className={`detail-cell ${className}`} hint={hint}>{children}</SheetCell>;
}
function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="dialog" ref={ref} onCancel={close} onClick={e => { if (e.target === ref.current) close(); }} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button onClick={close} aria-label="关闭弹窗">×</button></div><div className="dialog-body">{children}</div></dialog>;
}
function Selected({ s, c, edit, inspect }: { s: Selection; c: Character; edit: Edit; inspect: (e: Entry) => void }) {
  const allowed = selectionAllowed(c, s.entry);
  if (['class', 'subclass', 'race', 'background'].includes(s.entry.kind)) return <IdentityToken row={s} c={c} edit={edit} inspect={inspect}/>;
  return <div className={`selected-entry ${allowed ? '' : 'restricted'}`}>
    <div className="selected-title"><span className="class-title"><Reference className="text-link" reference={`entry:${s.entry.id}`} kind={s.entry.kind} onClick={() => inspect(s.entry)}>{s.entry.name}</Reference></span><button className="remove" aria-label={`移除${s.entry.name}`} title="移除，可撤销" onClick={() => edit(d => { removeSelection(d, s.id); })}>×</button></div>
    <div className="entry-meta"><span><SourceName id={s.entry.source}/>{!allowed ? ' · 未启用' : ''}</span>{s.entry.kind === 'class' && <label>等级 <input aria-label={`${s.entry.name}等级`} type="number" min="1" max="20" value={s.level} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.level = clamp(e.target.value, 1, 20); }, `${s.id}-level`)}/></label>}

      {s.entry.kind === 'item' && <><label>× <input aria-label={`${s.entry.name}数量`} type="number" min="1" max="9999" value={s.quantity} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.quantity = clamp(e.target.value, 1, 9999); })}/></label><label><input type="checkbox" checked={s.equipped} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.equipped = e.target.checked; })}/>装备</label></>}
    </div>
  </div>;
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const workspaceRef = useRef<Workspace | undefined>(undefined);
  const [startupError, setStartupError] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [activateUpdate, setActivateUpdate] = useState<(() => void)>();
  const writable = useRef(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState('正在读取');
  const queue = useRef(Promise.resolve());
  const pendingSaves = useRef(0);
  const saveFailed = useRef(false);
  const history = useRef(new Map<string, { past: Character[]; future: Character[]; key?: string; time: number }>());
  const [historyTick, setHistoryTick] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const sourceDisplay=useSources();
  useEffect(() => {
    if (workspace?.packs.length) sourceDisplay.merge(Object.fromEntries(workspace.packs.map(pack => [pack.id, { name: pack.name }])));
  }, [workspace?.packs, sourceDisplay.merge]);
  const bookNames=useMemo(()=>Object.fromEntries(Object.entries(sourceDisplay.registry).map(([id,m])=>[id,m.name])),[sourceDisplay.registry]);
  const catalogRef = useRef(new Map<string, Entry>());
  const [progress, setProgress] = useState(emptyProgress);
  const [loading, setLoading] = useState(false);
  const loadController = useRef<AbortController | undefined>(undefined);
  const allEntries = useMemo(() => [...SIZE_ENTRIES, ...entries, ...(workspace?.packs.flatMap(p => p.entries) || [])], [entries, workspace?.packs]);
  const library = useLibrary([...allEntries, ...(workspace?.characters.flatMap(c => c.selections.map(s => s.entry)) || [])]);
  const { kind, setKind, detail, setDetail, state: libraryState } = library;
  const { query, edition: editionFilter, enabled: enabledOnly, filters, sort, descending } = libraryState;
  const setQuery = (query: string) => library.patch({ query });
  const setEditionFilter = (edition: string) => library.patch({ edition });
  const setEnabledOnly = (enabled: boolean) => library.patch({ enabled });
  const detailPane = useRef<HTMLElement>(null);
  const [modal, setModal] = useState('');

  const [limit, setLimit] = useState(80);
  const catalogPane=useRef<HTMLDivElement>(null), catalogMore=useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [workspace?.activeId]);
  const [sheetPage, setSheetPage] = useState<SheetPage>('主要');
  const [tab, setTab] = useState('sheet');
  const [exception, setException] = useState('');
  const [importError, setImportError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [adjustTarget, setAdjustTarget] = useState('ac');
  const [adjustValue, setAdjustValue] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceMax, setResourceMax] = useState(1);

  function persist(next: Workspace) {
    if (!writable.current) { setNotice('另一标签页正在编辑；此页仅供查阅与导出。关闭另一页后刷新即可编辑。'); return; }
    workspaceRef.current = next; setWorkspace(next); setSaving('保存中…'); pendingSaves.current++;
    queue.current = queue.current.catch(() => {}).then(() => saveWorkspace(next)).then(() => {
      if (workspaceRef.current === next) { saveFailed.current = false; setSaving('已保存到本机'); }
    }).catch(error => { saveFailed.current = true; setSaving('保存失败'); setNotice(`本机保存失败，请立即导出角色备份。${String(error)}`); }).finally(() => { pendingSaves.current--; });
  }
  function acceptWorkspace(value: Workspace) {
    if (value.schemaVersion !== 1 || !Array.isArray(value.characters) || !value.characters.length || !Array.isArray(value.packs)) throw new Error('工作区结构不完整');
    value.characters.forEach(validateCharacter);
    if (new Set(value.characters.map(c => c.id)).size !== value.characters.length) throw new Error('角色身份重复');
    for (const pack of value.packs) validatePack({ ...pack, entries: pack.entries.map(e => ({ ...e, id: e.id.slice(pack.id.length + 1) })) }, value.packs);
    if (!value.characters.some(c => c.id === value.activeId)) value.activeId = value.characters[0].id;
    workspaceRef.current = value; setWorkspace(value); setSaving('已保存到本机'); setStartupError('');
  }
  useEffect(() => {
    let alive = true; let release = () => {}; const lockAbort = new AbortController();
    const initialize = async (canWrite: boolean) => {
      writable.current = canWrite; setReadOnly(!canWrite);
      try {
        const value = await loadWorkspace(); if (!alive) return;
        if (value) acceptWorkspace(value); else { const first = newCharacter(); const initial: Workspace = { schemaVersion: 1, characters: [first], activeId: first.id, packs: [] }; if (canWrite) persist(initial); else acceptWorkspace(initial); }
      } catch (e) { if (alive) setStartupError(String(e)); }
    };
    if (navigator.locks) navigator.locks.request('dnd-card-editor', { ifAvailable: true }, async lock => {
      const held = new Promise<void>(resolve => { release = resolve; });
      if (!alive) return; await initialize(!!lock);
      if (lock && alive) await held;
      else if (alive) await navigator.locks.request('dnd-card-editor', { signal: lockAbort.signal }, async () => {
        if (!alive) return; await initialize(true); if (alive) await held;
      });
    }).catch(e => { if (alive && !lockAbort.signal.aborted) setStartupError(String(e)); });
    else void initialize(true);
    return () => { alive = false; lockAbort.abort(); release(); };
  }, []);
  async function load(refresh = false) {
    loadController.current?.abort(); const controller = new AbortController(); loadController.current = controller;
    setLoading(true); setProgress(emptyProgress);
    try {
      await loadCatalog(batch => {
        batch.forEach(e => catalogRef.current.set(e.id, e)); setEntries([...catalogRef.current.values()]);
      }, setProgress, controller.signal, refresh, DEFAULT_SOURCE, sourceDisplay.merge);
    } catch (e) { if (!controller.signal.aborted) setNotice(`资料加载失败：${String(e)}`); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => { void load(); return () => loadController.current?.abort(); }, []);
  useEffect(() => { void registerOffline(activate => setActivateUpdate(() => activate)); }, []);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (pendingSaves.current > 0 || saveFailed.current) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, []);
  const c = workspace?.characters.find(x => x.id === workspace.activeId);
  const d = useMemo(() => c ? evaluate(c) : undefined, [c]);

  const columns = useMemo(() => columnsFor(kind, c?.edition==='2014'||!!c?.profile.optional.legacy||['2014','all'].includes(editionFilter)), [kind,c?.edition,c?.profile.optional.legacy,editionFilter]);
  const facets = useMemo(() => facetsFor(kind), [kind]);
  const categoryEntries = useMemo(() => {
    if (!c) return [];
    const q = query.toLocaleLowerCase().trim();
    return allEntries.filter(e => tabOf(e) === kind && (kind!=='class'||e.kind==='class') && (!q || `${e.name} ${e.english} ${e.source} ${bookNames[e.source]||''}`.toLocaleLowerCase().includes(q)) &&
      (editionFilter === 'all' || e.edition === 'both' || e.edition === (editionFilter === 'character' ? c.edition : editionFilter) || editionFilter === 'character' && c.edition === '2024' && c.profile.optional.legacy));
  }, [allEntries, c, kind, query, enabledOnly, editionFilter]);
  const filtered = useMemo(() => categoryEntries.filter(e => (!enabledOnly || c?.profile.enabledSources.includes(e.source)) && matchesFacets(e, filters, facets)).sort((a, b) => compareEntries(a, b, columns.find(col => col.key === sort) || columns[0], descending)), [categoryEntries, filters, facets, columns, sort, descending, enabledOnly, c?.profile.enabledSources]);
  useEffect(() => { setLimit(80); }, [kind, query, filters, enabledOnly, editionFilter]);
  useEffect(()=>{const node=catalogMore.current,pane=catalogPane.current;if(!node||!pane||limit>=filtered.length)return;const observer=new IntersectionObserver(records=>{if(records.some(r=>r.isIntersecting))setLimit(n=>Math.min(n+80,filtered.length));},{root:pane,rootMargin:'0px 0px 180px 0px'});observer.observe(node);return()=>observer.disconnect();},[limit,filtered.length,kind,query,filters]);
  useEffect(() => { setException(''); }, [detail?.id]);
  useEffect(() => { if (detailPane.current && detail) detailPane.current.scrollTop = libraryState.positions[detail.id] || 0; }, [kind, detail?.id, !!library.hover,library.navigationKey]);
  useEffect(() => { if (!notice.startsWith('已')) return; const timer = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(timer); }, [notice]);
  const edit: Edit = (action, key) => {
    if (!writable.current) { setNotice('此标签页为只读。关闭另一编辑页并刷新后可继续。'); return; }
    const current = workspaceRef.current; if (!current) return;
    const character = current.characters.find(x => x.id === current.activeId)!;
    const record = history.current.get(character.id) || { past: [], future: [], time: 0 };
    if (!key || record.key !== key || Date.now() - record.time > 900) record.past = [...record.past.slice(-59), character];
    record.future = []; record.key = key; record.time = Date.now(); history.current.set(character.id, record);
    const draft = structuredClone(character); action(draft); syncFeatures(draft, allEntries); if (draft.quickbar) draft.quickbar = draft.quickbar.filter(id => draft.selections.some(s => s.id === id)); draft.updatedAt = new Date().toISOString(); draft.revision++;
    persist({ ...current, characters: current.characters.map(x => x.id === draft.id ? draft : x) }); setHistoryTick(x => x + 1);
  };
  useEffect(() => {
    if (!c || !workspace || !writable.current) return;
    const draft = structuredClone(c);
    if (syncFeatures(draft, allEntries)) { draft.revision++; draft.updatedAt = new Date().toISOString(); persist({ ...workspace, characters: workspace.characters.map(row => row.id === draft.id ? draft : row) }); }
  }, [c, allEntries]);
  function undo(redo = false) {
    const w = workspaceRef.current; if (!w) return; const current = w.characters.find(x => x.id === w.activeId)!;
    const record = history.current.get(w.activeId); const stack = redo ? record?.future : record?.past;
    if (!record || !stack?.length) return;
    const previous = stack.pop()!; (redo ? record.past : record.future).push(current); record.key = undefined;
    persist({ ...w, characters: w.characters.map(x => x.id === current.id ? { ...previous, revision: current.revision + 1, updatedAt: new Date().toISOString() } : x) }); setHistoryTick(x => x + 1);
  }
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA'].includes(t.tagName)) { e.preventDefault(); undo(e.shiftKey); }
    }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, []);
  function readingTarget(entry:Entry){
    if(entry.raw._inlineOwner){const owner=allEntries.find(e=>e.id===entry.raw._inlineOwner);if(owner)return {entry:owner,focus:`name:${entry.raw._inlineName||entry.name}`};}
    const selected=c?.selections.find(s=>s.entry.id===entry.id),parent=selected?.parentId?c?.selections.find(s=>s.id===selected.parentId):undefined;
    if(parent && selected?.grantKey?.startsWith('inline:'))return {entry:allEntries.find(e=>e.id===parent.entry.id)||parent.entry,focus:`name:${entry.name}`};
    if(entry.kind==='feature' && entry.raw.subclassShortName){const subclass=allEntries.find(e=>e.kind==='subclass'&&e.raw.shortName===entry.raw.subclassShortName&&e.source===(entry.raw.subclassSource||entry.raw.classSource||'PHB').toUpperCase());if(subclass)return {entry:subclass,focus:entry.id};}
    if(entry.kind==='feature' && entry.raw._category!=='itemMastery'){
      const owner=allEntries.find(e=>e.kind==='class' && (entry.raw.className ? [e.name,e.english].includes(entry.raw.className) && (entry.raw.classSource||'PHB').toUpperCase()===e.source : e.edition===entry.edition && e.raw.optionalfeatureProgression?.some((p:any)=>p.featureType?.some((t:string)=>entry.raw.featureType?.includes(t)))));
      if(owner)return {entry:owner,focus:entry.id};
    }
    return {entry};
  }
  function inspect(entry: Entry, push = true) { if(detail && !library.hover && detailPane.current)library.savePosition(detail.id,detailPane.current.scrollTop);const target=readingTarget(entry);library.navigate(target.entry,target.focus,push);setTab('wiki'); }
  function resolveReference(reference: string, tag?: string) {
    if (reference.startsWith('entry:')) return c?.selections.find(s => s.entry.id === reference.slice(6))?.entry || allEntries.find(e => e.id === reference.slice(6));
    const [name, source] = reference.split('|');
    const tagKind = ['variantrule', 'action', 'skill', 'sense', 'language', 'itemProperty', 'itemType', 'table', 'deity', 'facility'].includes(tag || '') ? 'rule' : ['optfeature', 'itemMastery', 'reward', 'charoption', 'psionic'].includes(tag || '') ? 'feature' : ['status', 'disease'].includes(tag || '') ? 'condition' : tag==='creature'?'monster':tag;
    const known = [...(c?.selections.map(s => s.entry) || []), ...allEntries];
    const matches = known.filter(e => (!tagKind || e.kind === tagKind) && [e.name, e.english].some(n => n.toLowerCase() === name.toLowerCase()));
    const found = tagKind === 'feature' ? matches.find(e => !requirementMismatch(e, { refs: [reference] })) : source ? matches.find(e => e.source.toLowerCase() === source.toLowerCase()) : matches.find(e => e.edition === detail?.edition && e.source === (detail?.source || 'PHB')) || matches.find(e => e.source === 'PHB') || matches[0];
    return found;
  }
  function link(reference: string, tag?: string) {
    const found = resolveReference(reference, tag);
    const name = reference.split('|')[0];
    const tagKind = ['variantrule', 'action', 'skill', 'sense', 'language', 'itemProperty', 'itemType', 'table', 'deity', 'facility'].includes(tag || '') ? 'rule' : ['optfeature', 'itemMastery', 'reward', 'charoption', 'psionic'].includes(tag || '') ? 'feature' : ['status', 'disease'].includes(tag || '') ? 'condition' : tag==='creature'?'monster':tag;
    if (found) inspect(found); else { setQuery(name); if (tagKind && Object.hasOwn(KIND_LABELS, tagKind)) setKind(tagKind as Kind); setDetail(undefined); setNotice(`已搜索「${name}」。若未收录，可开启其他来源或在中文站查阅。`); }
  }
  function browse(kind: Kind | 'size') { setKind(kind); if (kind === 'subclass') { const owner = c?.selections.find(s => s.entry.kind === 'class'); if (owner) setDetail(allEntries.find(e => e.id === owner.entry.id) || owner.entry); } setTab('wiki'); }
  function add(entry: Entry, pin = false, section?: Selection['section']) {
    if (!c) return;
    if (entry.raw._category === 'size') { edit(draft => { draft.size = entry.raw.size; }); return; }
    if (pin) { const existing = c.selections.find(s => s.entry.id === entry.id); if (existing && selectionAllowed(c, entry)) { edit(draft => { draft.quickbar = [...new Set([...(draft.quickbar || []), existing.id])].slice(0, 100); }); return; } }
    const reason = candidateReason(c, entry); if (reason) { setNotice(reason); return; }
    edit(draft => {
      if (['race', 'background'].includes(entry.kind)) for (const old of draft.selections.filter(s => s.entry.kind === entry.kind)) removeSelection(draft, old.id);
      if (entry.kind === 'race') draft.size = 'M';
      const selectionId = uid(); draft.selections.push({ id: selectionId, entry: structuredClone(entry), quantity: 1, level: 1, equipped: false, section });
      if (entry.kind === 'class' && draft.selections.filter(s => s.entry.kind === 'class').length > 1) draft.profile.optional.multiclass = true;
      if (pin) draft.quickbar = [...(draft.quickbar || []), selectionId].slice(0, 100);
    });
    setNotice(`已填入「${entry.name}」`);
  }
  function exportFile(mode: string) {
    if (!c || !d) return;
    if (mode === 'review') download(`${fileName(c.name)}-审卡.html`, exportReview(c, d, sourceDisplay.format), 'text/html');
    else if (mode === 'owlbear') download(`${fileName(c.name)}-枭熊.json`, exportOwlbear(c, d));
    else download(`${fileName(c.name)}.json`, exportCharacter(c));
    setNotice('已生成下载文件。');
  }
  async function importFile(mode: string, file?: File) {
    setImportError('');
    try {
      const selected = file || await pickFile(); if (!selected) return;
      const value = parseFile(await selected.text()); const w = workspaceRef.current; if (!w) return;
      if (mode === 'pack') {
        const pack = validatePack(value, w.packs);
        persist({ ...w, packs: [...w.packs.filter(p => p.id !== pack.id), pack], characters: w.characters.map(x => x.id === w.activeId ? { ...x, profile: { ...x.profile, enabledSources: [...new Set([...x.profile.enabledSources, pack.id])] } } : x) });
        setNotice(`已安装「${pack.name}」${pack.version}；旧角色已选条目仍保留原快照。`);
      } else if (mode === 'profile') {
        const template = newCharacter(); template.profile = (value as { profile?: Character['profile'] })?.profile || value as Character['profile'];
        validateCharacter(template); edit(d => { d.profile = template.profile; }); setNotice('规则配置已应用，可撤销。');
      } else {
        const character = mode === 'owlbear' ? importOwlbear(value) : validateCharacter(value);
        character.id = uid(); character.revision = 1; character.name += '（导入）';
        persist({ ...w, characters: [...w.characters, character], activeId: character.id }); setNotice('角色已作为新副本导入。');
      }
    } catch (error) { setImportError(error instanceof Error ? error.message : String(error)); }
  }
  function create(edition: Edition, copy = false) {
    if (!workspace || !c) return; const next = copy ? structuredClone(c) : newCharacter(edition); next.id = uid(); next.name = copy ? `${c.name}（副本）` : next.name; next.createdAt = next.updatedAt = new Date().toISOString(); next.revision = 1;
    persist({ ...workspace, characters: [...workspace.characters, next], activeId: next.id }); setModal(''); setSheetPage('主要'); setTab('sheet');
  }
  const renderSelection = (s: Selection) => <Selected key={s.id} s={s} c={c!} edit={edit} inspect={inspect}/>;
  const selections = (kinds: Kind[]) => c?.selections.filter(s => kinds.includes(s.entry.kind)).map(renderSelection);
  const addButton = (kind: Kind) => <button className="sheet-add" onClick={() => browse(kind)}>＋ 查阅{KIND_LABELS[kind]}</button>;


  if (!workspace || !c || !d) return <main className="startup"><h1>角色卡工坊</h1>{startupError ? <><p role="alert">本机记录读取失败：{startupError}</p><p>现有记录尚未覆盖。可以尝试恢复上一次保存。</p><button onClick={async () => { try { const backup = await restoreBackup(); if (!backup) throw new Error('没有可用备份'); acceptWorkspace(backup); } catch (e) { setStartupError(String(e)); } }}>读取备份</button><button onClick={() => { const next = newCharacter(); workspaceRef.current = { schemaVersion: 1, characters: [next], activeId: next.id, packs: [] }; setWorkspace(workspaceRef.current); setNotice('临时工作区。第一次编辑将保存新记录；请先导出重要数据。'); }}>使用新的临时工作区</button></> : <p>正在打开你的角色卡…</p>}</main>;
  const record = history.current.get(c.id); void historyTick;
  const blocked = detail ? candidateReason(c, detail) : '';
  return <KeywordPreview resolve={resolveReference} open={link} sheetPreview={entry=>library.preview(entry?readingTarget(entry):undefined)} sheetCommit={entry=>inspect(entry)}><EntryDragProvider character={c} receive={entry => add(entry)}><div className="app-shell" onDragStart={event => event.preventDefault()}>
    <header className="app-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); setModal('help'); }}><span className="brand-mark">▧</span><strong>角色卡工坊</strong><span className="brand-en">DND CARD</span></a>
      <div className="header-tools"><button onClick={() => setModal('characters')}>角色簿 <span>{workspace.characters.length}</span></button><button onClick={() => setModal('rules')}>规则与扩展</button><button className="primary" onClick={() => setModal('export')}>导入 / 导出</button><button className="help-button" aria-label="使用说明" onClick={() => setModal('help')}>?</button></div>
    </header>
    {readOnly && <div className="read-only-banner" role="status">另一标签页正在编辑，此页仅供查阅和导出。关闭另一页后将自动读取最新记录并接手。<button onClick={() => location.reload()}>重新检查</button></div>}
    {activateUpdate && <div className="read-only-banner" role="status">网页有新版本。<button onClick={async () => { await queue.current; if (saveFailed.current) { setNotice('保存未成功，请先导出角色备份，再重新打开网页。'); return; } navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); activateUpdate(); }}>保存后更新</button></div>}
    <nav className="mobile-tabs" aria-label="工作区"><button className={tab === 'sheet' ? 'active' : ''} onClick={() => setTab('sheet')}>角色卡</button><button className={tab === 'wiki' ? 'active' : ''} onClick={() => setTab('wiki')}>规则资料</button></nav>
    <main className="workspace">
      <section className={`sheet-pane ${tab === 'sheet' ? 'mobile-active' : ''}`} aria-label="角色卡工作区">
        <div className="pane-toolbar"><div><span className="eyebrow">角色卡</span><select aria-label="当前角色" value={c.id} onChange={e => { persist({ ...workspace, activeId: e.target.value }); }}>{workspace.characters.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="toolbar-actions">{editing && <button className="adjust-shortcut" aria-label="数值依据与人工修正" onClick={() => setModal('adjust')}>修正</button>}<button aria-label="撤销" disabled={!record?.past.length} onClick={() => undo()}>↶</button><button aria-label="重做" disabled={!record?.future.length} onClick={() => undo(true)}>↷</button><span className="paper-size">A4 · 适应窗口</span></div>
        </div>
        <SheetEditContext.Provider value={editing}><PaperFrame character={c} page={sheetPage} changePage={page => { setSheetPage(page); setTab('sheet'); }}>
          <div className="paper-heading"><span>DUNGEONS &amp; DRAGONS</span><span className="paper-heading-right">{c.edition}<button className="edit-mode-toggle" role="switch" aria-checked={editing} aria-label="编辑模式" onClick={() => setEditing(v => !v)}><span className="edit-switch-track"><i/></span>编辑模式</button></span></div>
          {sheetPage === '主要' ? <><Overview statusRibbon={<div className="edition-divider"><span/><strong>DND 五版角色卡</strong><FeaturePanel inline grouped={false} label="状态" kinds={['condition']} c={c} rows={c.selections.filter(s => s.entry.kind === 'condition')} edit={edit} browse={() => browse('condition')} onLink={link} receive={entry => add(entry)}/><span/></div>} addEntry={(entry, section) => add(entry, false, section)} onLink={link} c={c} d={d} edit={edit} browse={browse} inspect={inspect} renderSelection={renderSelection} openResources={() => setModal('resources')} openQuickbar={() => setModal('quickbar')} pinDrop={entry => add(entry, true)}/>
</> : <div className="sheet-details">
          <div className="edition-divider"><span/><strong>DND 五版角色卡</strong><FeaturePanel inline grouped={false} label="状态" kinds={['condition']} c={c} rows={c.selections.filter(s => s.entry.kind === 'condition')} edit={edit} browse={() => browse('condition')} onLink={link} receive={entry => add(entry)}/><span/></div>
          <header className="sheet-page-heading"><div><small>{c.name} · {c.edition}</small><h2>{sheetPage}</h2></div><div className="detail-status-anchors"><SheetCell label="先攻" className="initiative-cell"><AdjustedValue c={c} value={d.initiative} target="initiative" label="先攻" sign edit={edit}/></SheetCell><SheetCell label="速度" className="speed-cell"><AdjustedValue c={c} value={d.speed} target="speed" label="速度" unit="尺" edit={edit}/></SheetCell><SheetCell label="头像" className="portrait-cell"><svg viewBox="0 0 80 90" aria-hidden="true"><path d="M28 27L33 17H47L52 27V39L45 49H35L28 39ZM35 49V56L17 65L12 82H68L63 65L45 56V49"/></svg></SheetCell></div></header>
          {sheetPage === '背景' ? <><Box label="人物与来历" className="background-details"><label>性别<input aria-label="性别" value={c.identity.gender} onChange={e => edit(draft => { draft.identity.gender = e.target.value; }, 'gender')}/></label><label>阵营<input aria-label="阵营" value={c.identity.alignment} onChange={e => edit(draft => { draft.identity.alignment = e.target.value; }, 'alignment')}/></label><label>年龄<input aria-label="年龄" value={c.identity.age} onChange={e => edit(draft => { draft.identity.age = e.target.value; }, 'age')}/></label><label>人物印象<textarea aria-label="人物印象" value={c.identity.description} onChange={e => edit(draft => { draft.identity.description = e.target.value; }, 'description')}/></label>{selections(['race', 'background'])}{c.selections.filter(s => ['race', 'background'].includes(s.entry.kind)).map(s => <section className="sheet-entry-body rules-prose" key={s.id}><h3>{s.entry.name}</h3><ContentBoundary key={s.id}><Entries value={s.entry.entries} onLink={link}/></ContentBoundary></section>)}</Box><Box label="冒险笔记" className="notes-box"><textarea aria-label="冒险笔记" placeholder="人物故事、战术与 DM 裁定…" value={c.notes} onChange={e => edit(draft => { draft.notes = e.target.value; }, 'notes')}/></Box></> : <>
          <Box label={sheetPage === '特性' ? '特性与专长' : sheetPage === '法术' ? '法术记录' : '装备与物品'} className="detail-page-box">
            <DropZone kinds={sheetPage === '特性' ? ['feature', 'feat', 'rule', 'subclass'] : sheetPage === '法术' ? ['spell'] : ['item']}>
              {sheetPage === '特性' && selections(['class'])}

              <div className="add-row">{sheetPage === '特性' ? <>{addButton('feature')}{addButton('feat')}</> : addButton(sheetPage === '法术' ? 'spell' : 'item')}</div>
              {c.selections.filter(s => (sheetPage === '特性' ? ['feature', 'feat', 'rule', 'subclass'] : sheetPage === '法术' ? ['spell'] : ['item']).includes(s.entry.kind)).map(s => <section className="sheet-entry-body" key={s.id}><Selected s={s} c={c} edit={edit} inspect={inspect}/><ContentBoundary key={s.id}><EntryFacts entry={s.entry} onLink={link}/><div className="rules-prose"><Entries value={s.entry.entries} onLink={link}/></div></ContentBoundary></section>)}
            </DropZone>
          </Box>
          {sheetPage === '法术' && <button className="sheet-resource-button" onClick={() => setModal('resources')}>法术位与资源记录 · {Object.keys(c.runtime.resources).length} 项</button>}
          </>}
        </div>}
          <footer className="paper-footer"><span>{c.edition} · {d.level || '—'} 级 · 修订 {c.revision}</span><span>资料快照随角色保存</span></footer>
        </PaperFrame></SheetEditContext.Provider><div className={`save-status ${saving === '保存失败' ? 'error' : ''}`} role="status"><span className="status-dot"/>{saving}<span>资料与角色保存在当前浏览器 · 请定期导出</span></div>
      </section>

      <section className={`wiki-pane ${tab === 'wiki' ? 'mobile-active' : ''}`} aria-label="规则资料"><div className="wiki-header"><div><span className="eyebrow">规则资料</span><span className="wiki-source">5etools 中文站</span></div><button title="重新检查上游资料" disabled={loading} onClick={() => load(true)}>{loading ? '加载中…' : '更新资料'}</button></div>
        <GlobalSearch query={query} change={setQuery} entries={allEntries} c={c} inspect={inspect}/>
        <nav className="category-tabs" aria-label="资料分类">{Object.entries(LIBRARY_TABS).filter(([key])=>key!=='weaponMastery'||c.edition==='2024'||editionFilter==='2024'||editionFilter==='all').map(([key, label]) => <button key={key} className={kind === key ? 'active' : ''} onClick={() => setKind(key as keyof typeof LIBRARY_TABS)}>{label}</button>)}</nav>
        <div className="wiki-filters"><select aria-label="资料版本" value={editionFilter} onChange={e => setEditionFilter(e.target.value)}><option value="character">跟随角色 · {c.edition}</option><option value="2014">2014 规则</option><option value="2024">2024 规则</option><option value="all">所有版本</option></select><LibraryFilters tab={kind} entries={categoryEntries} filters={filters} change={filters => library.patch({ filters })} names={bookNames} enabledOnly={enabledOnly} setEnabledOnly={setEnabledOnly} enabledSources={c.profile.enabledSources}/>
        <label><input type="checkbox" checked={enabledOnly} onChange={e => setEnabledOnly(e.target.checked)}/>已启用</label></div>
        <div className="catalog-status"><span>{loading ? `${progress.done}/${progress.total} 份资料` : `${allEntries.length.toLocaleString()} 条资料`}{progress.cached > 0 ? ` · ${progress.cached} 份缓存` : ''}</span><span>{filtered.length} 条符合筛选</span></div>
        {progress.failed.length > 0 && <details className="load-errors"><summary>{progress.failed.length} 份资料读取异常 · 可重试</summary>{progress.failed.map((e, i) => <p key={i}>{e}</p>)}<button disabled={loading} onClick={() => load(true)}>重试加载</button></details>}
        <div className={`library-body ${detail ? 'has-detail' : ''}`}><div className="catalog-list" ref={catalogPane} aria-label="资料列表"><div className={`catalog-columns columns-${kind}`} style={{gridTemplateColumns:`minmax(120px,2.1fr) repeat(${columns.length-2},minmax(40px,1fr)) minmax(70px,1.2fr)`}} role="row">{columns.map(col => <button key={col.key} role="columnheader" aria-sort={sort === col.key ? descending ? 'descending' : 'ascending' : 'none'} onClick={() => library.patch({ sort: col.key, descending: sort === col.key ? !descending : false })}>{col.label}{sort === col.key ? descending ? ' ▾' : ' ▴' : ''}</button>)}</div>{filtered.slice(0, limit).map(entry => <EntryDraggable key={entry.id} entry={entry}  style={{gridTemplateColumns:`minmax(120px,2.1fr) repeat(${columns.length-2},minmax(40px,1fr)) minmax(70px,1.2fr)`}} className={`catalog-row columns-${kind} ${entry.raw.meta?.ritual?'ritual-row':''} ${explicitlyExcluded(c,entry)?'entry-disabled':''} ${detail?.id === entry.id ? 'active' : ''}`} onClick={() => inspect(entry)}>{columns.map(col => <span key={col.key} className={col.key === 'name' ? 'entry-name' : 'catalog-value'}>{col.key === 'name' ? <>{entry.name}{entry.english !== entry.name && <small> {entry.english}</small>}</> : col.key === 'source' ? <SourceName id={entry.source}/> : col.key === 'level' && entry.kind === 'spell' ? entry.raw.level === 0 ? '戏法' : `${entry.raw.level}环` : col.key === 'hd' ? `d${col.value(entry)}` : col.value(entry) === '' ? '—' : col.value(entry)}</span>)}</EntryDraggable>)}{filtered.length > limit && <div ref={catalogMore} className="catalog-more" aria-label="继续加载资料"/>}{!filtered.length && <div className="empty-state"><span>没有符合条件的条目</span><p>{loading ? '资料正在逐批载入。' : '试试其他关键词，或取消“已启用”查看全部来源。'}</p><button onClick={() => setModal('rules')}>查看规则设置</button></div>}</div>
        <WikiSplitter/>
        {detail && <article className="entry-detail" data-described-entry={detail.id} data-entry-kind={detail.kind} ref={detailPane} onScroll={e => { if(!library.hover)library.savePosition(detail.id, e.currentTarget.scrollTop); }}><div className="detail-frozen"><div className="detail-navigation"><button disabled={!library.canGoBack} onClick={library.back}>← 上一条</button><button aria-label="收起正文" onClick={() => { setDetail(undefined); }}>×</button></div><div className="detail-heading">{detail.kind==='monster'&&<MonsterPortrait entry={detail}/>}<EntryBadges entry={detail}/><span className="eyebrow">{KIND_LABELS[detail.kind]} · {detail.edition === 'both' ? '通用资料' : detail.edition}</span><h1><EntryDraggable className="detail-title" entry={detail} >{detail.name}{detail.english !== detail.name && <small className="english-name"> {detail.english}</small>}</EntryDraggable></h1><small>{detail.raw._authoredBy ? `${detail.raw._authoredBy} · ` : ''}<SourceName id={detail.source}/>{detail.page ? ` · 第 ${detail.page} 页` : ''}</small>{detail.kind === 'class' && <div className="class-jumps">{[['body','主体'],['subclasses','子职'],['progression','等级']].map(([id,label])=><button key={id} onClick={()=>detailPane.current?.dispatchEvent(new CustomEvent('library-jump',{detail:id}))}>{label}</button>)}</div>}</div></div>
          {detail.kind==='monster'?<ContentBoundary key={detail.id}><MonsterDocument entry={detail} onLink={link}/></ContentBoundary>:<><ContentBoundary key={`facts:${detail.id}`}><EntryFacts entry={detail} onLink={link}/></ContentBoundary>
          <LibraryDocument focus={library.focus} character={c} entry={detail} entries={allEntries} onLink={link} inspect={inspect} collapsed={libraryState.collapsed[detail.id] || []} onCollapse={ids => library.patch({ focus:undefined, collapsed: { ...libraryState.collapsed, [detail.id]: ids } })}/></>}

          <details className="raw-details"><summary>数据与追溯</summary><dl><dt>条目身份</dt><dd>{detail.id}</dd><dt>资料修订</dt><dd>{detail.revision}</dd></dl><pre>{JSON.stringify(detail.raw, null, 2)}</pre></details>
          <div className="detail-actions">{blocked && <p className="inline-warning">{blocked}</p>}<a href={DEFAULT_SOURCE} target="_blank" rel="noreferrer">在中文站查阅 ↗</a>
          {blocked === '此来源或规则版本未启用' && <details><summary>记录 DM 特许</summary><p>仅对此条目启用；会随角色及审卡导出保留。</p><input aria-label="DM 特许说明" value={exception} placeholder="填写原因或 DM 的裁定" onChange={e => setException(e.target.value)}/><button disabled={!exception.trim()} onClick={() => edit(draft => { draft.profile.exceptions[detail.id] = exception.trim(); })}>保存特许</button></details>}
          {c.profile.exceptions[detail.id] && <p>DM 特许：{c.profile.exceptions[detail.id]} <button onClick={() => edit(draft => { delete draft.profile.exceptions[detail.id]; })}>撤回</button></p>}</div>
        </article>}{!detail && <div className="reading-placeholder"><span>选择上方条目</span></div>}</div>
        <footer className="wiki-footer"><a href="https://github.com/FullPeople/DND-card-web" target="_blank" rel="noreferrer">源码仓库 ↗</a><a href="https://github.com/FullPeople/DND-card-web/blob/main/LICENSE" target="_blank" rel="noreferrer">非商用共享许可 ↗</a></footer>
      </section>
    </main>
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
    {modal && <Dialog title={modal === 'characters' ? '角色簿' : modal === 'rules' ? '规则与扩展' : modal === 'export' ? '导入与导出' : modal === 'adjust' ? '数值依据与人工修正' : modal === 'resources' ? '法术位与资源记录' : modal === 'quickbar' ? '整理快捷栏' : '让角色卡带你完成选择'} close={() => { setModal(''); setImportError(''); setConfirmDelete(''); }}>
      {importError && <p className="inline-error" role="alert">导入未生效：{importError}</p>}
      {modal === 'adjust' && <><p className="muted">特殊规则尚未自动适配时，可填写最终数值与原因。修正会覆盖计算值，持续保留到手动撤回，并列入审卡。</p><div className="adjust-form"><label>数值<select aria-label="人工修正目标" value={adjustTarget} onChange={e => setAdjustTarget(e.target.value)}>{[['ac', '护甲等级'], ['hp', '生命值上限'], ['speed', '速度'], ['initiative', '先攻'], ['passive', '被动察觉'], ...Object.entries(SKILLS).map(([key, s]) => [`skill:${key}`, `${s.name}检定`]), ...ABILITIES.map(a => [`save:${a}`, `${ABILITY_LABELS[a]}豁免`])].map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>最终值<input aria-label="人工修正数值" type="number" min="-9999" max="9999" value={adjustValue} onChange={e => setAdjustValue(clamp(e.target.value, -9999, 9999))}/></label><label className="full-width">原因<input aria-label="人工修正原因" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="例如：DM 允许的护甲修正，或尚未适配的专长"/></label><button disabled={!adjustReason.trim()} onClick={() => { edit(draft => { draft.adjustments = [...(draft.adjustments || []).filter(a => a.target !== adjustTarget), { id: uid(), target: adjustTarget, value: adjustValue, reason: adjustReason.trim() }]; }); setAdjustReason(''); }}>记录修正</button></div>{(c.adjustments || []).map(a => <div className="pack-row" key={a.id}><span><strong>{a.target} → {a.value}</strong><small>{a.reason}</small></span><button onClick={() => edit(draft => { draft.adjustments = draft.adjustments?.filter(x => x.id !== a.id); })}>撤回</button></div>)}<details className="calculation-trace"><summary>展开计算依据</summary>{Object.entries(d.trace).map(([key, items]) => <p key={key}><strong>{choiceLabel(key)}</strong>：{items.join('；')}</p>)}</details></>}
      {modal === 'quickbar' && <><p className="muted">固定常用武器、法术或特性，点击快捷栏条目即可查阅。也可以从右侧资料直接拖入快捷栏。</p><div className="quickbar-manager">{(c.quickbar || []).filter(id => c.selections.some(s => s.id === id)).map((id, index) => { const s = c.selections.find(s => s.id === id)!; return <div className="pack-row" key={id}><strong>{s.entry.name}</strong><div><button aria-label={`上移${s.entry.name}`} disabled={index === 0} onClick={() => edit(draft => { const ids = (draft.quickbar || []).filter(id => draft.selections.some(s => s.id === id)); [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; draft.quickbar = ids; })}>↑</button><button onClick={() => edit(draft => { draft.quickbar = draft.quickbar?.filter(x => x !== id); })}>取消固定</button></div></div>; })}</div><h3>从角色已选条目中固定</h3><div className="quickbar-options">{c.selections.filter(s => ['item', 'spell', 'feature', 'feat', 'rule'].includes(s.entry.kind) && !(c.quickbar || []).includes(s.id)).map(s => <button key={s.id} onClick={() => edit(draft => { draft.quickbar = [...(draft.quickbar || []), s.id].slice(0, 100); })}>{s.entry.name} <small>{KIND_LABELS[s.entry.kind]} · <SourceName id={s.entry.source}/></small></button>)}</div><div className="dialog-actions">{(['item', 'spell', 'feature'] as Kind[]).map(kind => <button key={kind} onClick={() => { browse(kind); setModal(''); }}>查阅{KIND_LABELS[kind]}</button>)}</div></>}
      {modal === 'resources' && <><p className="muted">记录法术位、职业能力或消耗品的剩余次数。更新资料、升级与刷新页面不会自动补充资源。请按实际休息规则手动恢复。</p><div className="adjust-form"><label>资源名称<input aria-label="资源名称" placeholder="例如：一环法术位" value={resourceName} onChange={e => setResourceName(e.target.value)}/></label><label>上限<input aria-label="资源上限" type="number" min="1" max="999" value={resourceMax} onChange={e => setResourceMax(clamp(e.target.value, 1, 999))}/></label><button disabled={!resourceName.trim() || ['__proto__', 'constructor', 'prototype'].includes(resourceName.trim()) || Object.hasOwn(c.runtime.resources, resourceName.trim())} onClick={() => { edit(draft => { draft.runtime.resources[resourceName.trim()] = { current: resourceMax, max: resourceMax }; }); setResourceName(''); }}>添加记录</button></div>{Object.entries(c.runtime.resources).map(([name, resource]) => <div className="resource-line" key={name}><span>{name}</span><label>剩余 <input aria-label={`${name}剩余`} type="number" min="0" max={resource.max} value={resource.current} onChange={e => edit(draft => { draft.runtime.resources[name].current = clamp(e.target.value, 0, resource.max); })}/></label><span>/ {resource.max}</span><button onClick={() => edit(draft => { draft.runtime.resources[name].current = resource.max; })}>补满</button><button onClick={() => edit(draft => { delete draft.runtime.resources[name]; })}>移除</button></div>)}</>}
      {modal === 'characters' && <><div className="dialog-actions"><button onClick={() => create('2024')}>＋ 2024 角色</button><button onClick={() => create('2014')}>＋ 2014 角色</button><button onClick={() => create(c.edition, true)}>复制当前角色</button></div><div className="character-list">{workspace.characters.map(character => <div key={character.id}><button className="character-title" onClick={() => { persist({ ...workspace, activeId: character.id }); setModal(''); }}><strong>{character.name}</strong><small>{character.edition} · {character.player || '未填玩家'}{character.id === c.id ? ' · 当前角色' : ''}</small></button>{confirmDelete === character.id ? <span className="delete-confirm">删除后需通过导入恢复。<button onClick={() => { const characters = workspace.characters.filter(x => x.id !== character.id); persist({ ...workspace, characters, activeId: workspace.activeId === character.id ? characters[0].id : workspace.activeId }); setConfirmDelete(''); }}>确认删除</button><button onClick={() => setConfirmDelete('')}>取消</button></span> : <button disabled={workspace.characters.length === 1} onClick={() => setConfirmDelete(character.id)}>删除</button>}</div>)}</div><p className="muted">不同角色拥有独立的规则配置、选择与撤销记录。数据保存在本机浏览器。</p></>}
      {modal === 'rules' && <>
        <section className="settings-section"><h3>当前角色的规则</h3><div className="setting-row"><span>基础版本<small>切换会保留所有内容，并标记不兼容条目。</small></span><div className="segmented" role="radiogroup" aria-label="角色规则版本">{(['2014','2024'] as Edition[]).map(v=><button key={v} role="radio" aria-checked={c.edition===v} onClick={()=>edit(draft=>{draft.edition=v;})}>{v}</button>)}</div></div>{([['feats', '专长规则', '允许选择专长'], ['multiclass', '兼职规则', '允许增加职业；兼职前提需与 DM 核对'], ['legacy', '兼容旧版内容', '允许 2024 角色使用 2014 条目，具体替换关系由 DM 裁定']] as const).map(([key, label, desc]) => <label className="setting-row" key={key}><span>{label}<small>{desc}</small></span><input type="checkbox" checked={c.profile.optional[key]} onChange={e => edit(draft => { draft.profile.optional[key] = e.target.checked; })}/></label>)}</section>
        <SourceSettings c={c} entries={allEntries} edit={edit}/>
        <section className="settings-section"><h3>自定义扩展包</h3><p>以 JSON 声明条目、效果与选择。导入前检查格式、依赖和冲突；更新包不会替换角色内已选的旧快照。</p><div className="dialog-actions"><button onClick={() => importFile('pack')}>导入扩展包</button><button onClick={() => download('我的扩展-示例.json', EXAMPLE_PACK)}>下载编写示例</button></div><input className="file-input" data-testid="pack-file" type="file" accept=".json" aria-label="导入扩展包文件" onChange={e => { if (e.target.files?.[0]) importFile('pack', e.target.files[0]); e.target.value = ''; }}/>{workspace.packs.map(pack => <div className="pack-row" key={pack.id}><span><strong>{pack.name}</strong><small>{pack.id} · {pack.version} · {pack.entries.length} 条</small></span><button onClick={() => download(`${pack.id}-${pack.version}.json`, exportRulePack(pack))}>导出</button><button onClick={() => { const dependent = workspace.packs.find(p => p.requires.some(dep => dep.id === pack.id)); if (dependent) { setImportError(`「${dependent.name}」依赖这个包，请先移除依赖方。`); return; } persist({ ...workspace, packs: workspace.packs.filter(p => p.id !== pack.id) }); setNotice('已移除资料包；角色中的条目快照仍保留。可关闭其来源以暂停效果。'); }}>移除</button></div>)}</section>
        {Object.keys(c.profile.exceptions).length > 0 && <section className="settings-section"><h3>DM 特许记录</h3>{Object.entries(c.profile.exceptions).map(([id, reason]) => <p key={id}>{c.selections.find(s => s.entry.id === id)?.entry.name || allEntries.find(e => e.id === id)?.name || id}：{reason}<button onClick={() => edit(draft => { delete draft.profile.exceptions[id]; })}>撤回</button></p>)}</section>}
      </>}
      {modal === 'export' && <><section className="settings-section"><h3>带走当前角色</h3><div className="export-options"><button onClick={() => exportFile('character')}><strong>角色完整备份 · JSON</strong><span>保存基础输入、条目快照、选择与规则配置，可完整恢复。</span></button><button onClick={() => exportFile('review')}><strong>DM 审卡 · HTML / 打印</strong><span>离线打开即可阅读。包含计算依据、缺项、来源及裁定；浏览器打印可保存 PDF。</span></button><button onClick={() => exportFile('owlbear')}><strong>枭熊角色卡 · JSON</strong><span>导出 schema 0.3；复杂效果和未映射内容附带说明。</span></button></div></section><section className="settings-section"><h3>导入为新角色</h3><p>导入不覆盖已有角色。枭熊文件只迁入可识别的数据，需重新核对规则来源。</p><div className="dialog-actions"><button onClick={() => importFile('character')}>导入完整备份</button><button onClick={() => importFile('owlbear')}>导入枭熊 JSON</button></div><input className="file-input" data-testid="character-file" type="file" accept=".json" aria-label="导入角色备份文件" onChange={e => { if (e.target.files?.[0]) importFile('character', e.target.files[0]); e.target.value = ''; }}/></section><section className="settings-section"><h3>本机恢复</h3><p>自动保留上一次保存的工作区。请先导出当前角色，再恢复。</p><button onClick={async () => { try { const backup = await restoreBackup(); if (!backup) throw new Error('没有可用备份'); acceptWorkspace(backup); history.current.clear(); setNotice('已读取上一次保存；确认内容后继续编辑即可保存。'); setModal(''); } catch (error) { setImportError(String(error)); } }}>读取上一次保存</button></section></>}
      {modal === 'help' && <div className="help-copy"><p>从左侧角色卡开始。流动的虚线外框表示这个格子还有待填写的内容，点击格子，右侧会打开对应资料分类。</p><ol><li>在角色簿中选择 2014 或 2024；在规则设置中勾选允许使用的书籍。</li><li>先填基础属性，再挑选职业、种族和背景。对应等级的特性会随资料一起带入，玩家自行调整。</li><li>阅读右侧正文，把条目拖入对应位置。开启编辑模式后可调整属性和熟练项。</li><li>特殊效果保留正文并提示核对。与 DM 协商的例外可记录在条目中。</li><li>随时导出完整备份。审卡 HTML 可离线发给 DM，也可打印为 PDF。</li></ol><p>这不是完整的战斗模拟器。基础属性、熟练、护甲、生命值和部分选择可以计算；施法准备、复杂前提、特性联动和休息恢复仍需人工核对。没有资料的规则不会被假装实现。</p><p>账号同步、Excel 适配和 C++ 桌面客户端属于后续阶段。</p><a href="https://github.com/FullPeople/DND-card-web" target="_blank" rel="noreferrer">源代码与问题反馈 ↗</a></div>}
    </Dialog>}

  </div></EntryDragProvider></KeywordPreview>;
}
