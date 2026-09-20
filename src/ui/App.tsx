import { useEffect, useMemo, useRef, useState, type ReactNode, type DragEvent } from 'react';
import { ABILITIES, ABILITY_LABELS, KIND_LABELS, SKILLS, newCharacter, selectionAllowed, signed, uid, type Character, type Edition, type Entry, type Kind, type Requirement, type Selection } from '../core/model';
import { candidateReason, choiceLabel, evaluate, requirementMismatch } from '../core/engine';
import { EXAMPLE_PACK, importOwlbear, parseFile, validateCharacter, validatePack } from '../core/validation';
import { exportCharacter, exportOwlbear, exportReview, exportRulePack } from '../core/export';
import { loadCatalog, DEFAULT_SOURCE, type LoadProgress } from '../data/catalog';
import { download, loadWorkspace, pickFile, restoreBackup, saveWorkspace, type Workspace } from '../platform/storage';
import { ContentBoundary, Entries } from './Entries';
import { EntryFacts } from './EntryFacts';
import { PaperFrame, type SheetPage } from './PaperFrame';
import { DropZone, DragContext } from './DragEntry';
import { KeywordPreview } from './KeywordPreview';
import { Reference } from './Reference';
import { registerOffline } from '../platform/offline';

const emptyProgress: LoadProgress = { done: 0, total: 1, label: '等待资料', failed: [], cached: 0 };
const clamp = (value: string, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const fileName = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100) || '角色';
type Edit = (action: (draft: Character) => void, key?: string) => void;

function Box({ label, children, className = '', hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return <section className={`sheet-box ${className}`} aria-label={label} title={hint}><div className="box-content">{children}</div><h3 className="box-label">{label}</h3></section>;
}
function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={close} onClick={e => { if (e.target === ref.current) close(); }} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button onClick={close} aria-label="关闭弹窗">×</button></div><div className="dialog-body">{children}</div></dialog>;
}
function RequirementView({ r, c, edit, find, active }: { r: Requirement; c: Character; edit: Edit; find: (r: Requirement) => void; active: boolean }) {
  if (r.review) return <div className="review-requirement"><span>{r.origin}：特殊效果需核对正文</span><button onClick={() => edit(d => { d.reviewed.push(r.id.slice(0, -7)); })}>已核对</button></div>;
  return <DropZone requirement={r}><div className={`requirement ${r.complete ? 'is-complete' : ''} ${active ? 'is-target' : ''}`} data-requirement={r.id}>
    <div className="requirement-title"><span>{r.complete ? '✓' : '＋'} {r.label}</span><small>{r.selected.length}/{r.count}</small></div>
    <small className="requirement-origin">{r.origin}</small>
    {r.options ? <div className="choice-options">{r.options.map(v => <label key={v}><input type={r.count === 1 ? 'radio' : 'checkbox'} name={r.id} checked={r.selected.includes(v)} onChange={() => edit(d => {
      const values = d.answers[r.id] || []; d.answers[r.id] = r.count === 1 ? [v] : values.includes(v) ? values.filter(x => x !== v) : values.length < r.count ? [...values, v] : values;
    })}/>{r.optionLabels?.[v] || (r.id.endsWith('ability-mode') ? `方案 ${Number(v) + 1}` : choiceLabel(v))}</label>)}</div> : <button className="choose-button" onClick={() => find(r)}>{active ? '正在右侧筛选候选' : r.complete ? '查看可选内容' : '查阅并填入'}<span aria-hidden="true"> →</span></button>}
  </div></DropZone>;
}
function belongsToClass(sub: Selection, parent: Selection) { return parent.entry.kind === 'class' && [parent.entry.name, parent.entry.english].includes(sub.entry.raw.className) && (!sub.entry.raw.classSource || sub.entry.raw.classSource === parent.entry.source); }
function Selected({ s, c, edit, inspect, chooseSubclass }: { s: Selection; c: Character; edit: Edit; inspect: (e: Entry) => void; chooseSubclass?: () => void }) {
  const allowed = selectionAllowed(c, s.entry);
  const subclasses = s.entry.kind === 'class' ? c.selections.filter(sub => sub.entry.kind === 'subclass' && belongsToClass(sub, s)) : [];
  return <div className={`selected-entry ${allowed ? '' : 'restricted'}`}>
    <div className="selected-title"><span className="class-title"><Reference className="text-link" reference={`entry:${s.entry.id}`} kind={s.entry.kind} onClick={() => inspect(s.entry)}>{s.entry.name}</Reference>{chooseSubclass && !subclasses.length && <button className="choose-subclass text-link" onClick={chooseSubclass}> · 选择子职</button>}{subclasses.map(sub => <span className={`inline-subclass ${selectionAllowed(c, sub.entry) ? '' : 'restricted'}`} key={sub.id}> · <Reference className="text-link" reference={`entry:${sub.entry.id}`} kind="subclass" onClick={() => inspect(sub.entry)}>{sub.entry.name}</Reference><button className="remove" aria-label={`移除${sub.entry.name}`} onClick={() => edit(d => { d.selections = d.selections.filter(x => x.id !== sub.id); })}>×</button></span>)}</span><button className="remove" aria-label={`移除${s.entry.name}`} title="移除，可撤销" onClick={() => edit(d => { d.selections = d.selections.filter(x => x.id !== s.id); })}>×</button></div>
    <div className="entry-meta"><span>{s.entry.source}{!allowed ? ' · 未启用' : ''}</span>{s.entry.kind === 'class' && <label>等级 <input aria-label={`${s.entry.name}等级`} type="number" min="1" max="20" value={s.level} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.level = clamp(e.target.value, 1, 20); }, `${s.id}-level`)}/></label>}
      {s.requirementId && <button className="text-link" title="作为额外条目保留，不再占据原填写位置" onClick={() => edit(d => { delete d.selections.find(x => x.id === s.id)!.requirementId; })}>解除关联</button>}
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
  const [bookNames, setBookNames] = useState<Record<string, string>>({});
  const catalogRef = useRef(new Map<string, Entry>());
  const [progress, setProgress] = useState(emptyProgress);
  const [loading, setLoading] = useState(false);
  const loadController = useRef<AbortController | undefined>(undefined);
  const [kind, setKind] = useState<Kind>('class');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [editionFilter, setEditionFilter] = useState('character');
  const [enabledOnly, setEnabledOnly] = useState(true);
  const [detail, setDetail] = useState<Entry>();
  const [backStack, setBackStack] = useState<Entry[]>([]);
  const detailPane = useRef<HTMLElement>(null);
  const readingPositions = useRef<Record<string, number>>({});
  const [targetId, setTargetId] = useState('');
  const [modal, setModal] = useState('');
  const [ruleSearch, setRuleSearch] = useState('');
  const [limit, setLimit] = useState(80);
  const [sheetPage, setSheetPage] = useState<SheetPage>('主要');
  const [dragged, setDragged] = useState<Entry>();
  const dragGhost = useRef<HTMLDivElement>(null);
  function endDrag() { setDragged(undefined); }
  useEffect(() => { const end = () => endDrag(); window.addEventListener('dragend', end); window.addEventListener('drop', end); window.addEventListener('blur', end); return () => { window.removeEventListener('dragend', end); window.removeEventListener('drop', end); window.removeEventListener('blur', end); }; }, []);
  const [tab, setTab] = useState('sheet');
  const [exception, setException] = useState('');
  const [importError, setImportError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [showAllRequirements, setShowAllRequirements] = useState(false);
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
      }, setProgress, controller.signal, refresh, DEFAULT_SOURCE, setBookNames);
    } catch (e) { if (!controller.signal.aborted) setNotice(`资料加载失败：${String(e)}`); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => { void load(); return () => loadController.current?.abort(); }, []);
  useEffect(() => { void registerOffline(activate => setActivateUpdate(() => activate)); }, []);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (pendingSaves.current > 0 || saveFailed.current) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, []);
  const c = workspace?.characters.find(x => x.id === workspace.activeId);
  const d = useMemo(() => c ? evaluate(c) : undefined, [c]);
  const allEntries = useMemo(() => [...entries, ...(workspace?.packs.flatMap(p => p.entries) || [])], [entries, workspace?.packs]);
  const sources = useMemo(() => [...new Set([...allEntries.map(e => e.source), ...(c?.profile.enabledSources || []), ...(c?.selections.map(s => s.entry.source) || [])])].sort((a, b) => Number(!['PHB', 'XPHB'].includes(a)) - Number(!['PHB', 'XPHB'].includes(b)) || a.localeCompare(b)), [allEntries, c?.profile.enabledSources, c?.selections]);
  const target = d?.requirements.find(r => r.id === targetId);
  const filtered = useMemo(() => {
    if (!c) return [];
    const q = query.toLocaleLowerCase().trim();
    return allEntries.filter(e => e.kind === kind && (!source || e.source === source) && (!q || `${e.name} ${e.english} ${e.source}`.toLocaleLowerCase().includes(q)) &&
      (!enabledOnly || c.profile.enabledSources.includes(e.source)) &&
      (editionFilter === 'all' || e.edition === 'both' || e.edition === (editionFilter === 'character' ? c.edition : editionFilter) || editionFilter === 'character' && c.edition === '2024' && c.profile.optional.legacy) &&
      (!target || !candidateReason(c, e, target))).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.source.localeCompare(b.source));
  }, [allEntries, c, kind, source, query, enabledOnly, editionFilter, target]);
  useEffect(() => { setLimit(80); }, [kind, query, source, enabledOnly, editionFilter, targetId]);
  useEffect(() => { setException(''); }, [detail?.id]);
  useEffect(() => { if (detailPane.current && detail) detailPane.current.scrollTop = readingPositions.current[detail.id] || 0; }, [detail?.id]);
  useEffect(() => { if (!notice.startsWith('已')) return; const timer = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(timer); }, [notice]);
  const edit: Edit = (action, key) => {
    if (!writable.current) { setNotice('此标签页为只读。关闭另一编辑页并刷新后可继续。'); return; }
    const current = workspaceRef.current; if (!current) return;
    const character = current.characters.find(x => x.id === current.activeId)!;
    const record = history.current.get(character.id) || { past: [], future: [], time: 0 };
    if (!key || record.key !== key || Date.now() - record.time > 900) record.past = [...record.past.slice(-59), character];
    record.future = []; record.key = key; record.time = Date.now(); history.current.set(character.id, record);
    const draft = structuredClone(character); action(draft); draft.updatedAt = new Date().toISOString(); draft.revision++;
    persist({ ...current, characters: current.characters.map(x => x.id === draft.id ? draft : x) }); setHistoryTick(x => x + 1);
  };
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
  function inspect(entry: Entry, push = true) { if (detail && push) setBackStack(s => [...s.slice(-29), detail]); setDetail(entry); setTab('wiki'); }
  function resolveReference(reference: string, tag?: string) {
    if (reference.startsWith('entry:')) return c?.selections.find(s => s.entry.id === reference.slice(6))?.entry || allEntries.find(e => e.id === reference.slice(6));
    const [name, source] = reference.split('|');
    const tagKind = ['variantrule', 'action', 'skill', 'sense', 'language'].includes(tag || '') ? 'rule' : tag === 'optfeature' ? 'feature' : tag;
    const known = [...(c?.selections.map(s => s.entry) || []), ...allEntries];
    const matches = known.filter(e => (!tagKind || e.kind === tagKind) && [e.name, e.english].some(n => n.toLowerCase() === name.toLowerCase()));
    const found = tagKind === 'feature' ? matches.find(e => !requirementMismatch(e, { refs: [reference] })) : source ? matches.find(e => e.source.toLowerCase() === source.toLowerCase()) : matches.find(e => e.edition === detail?.edition && e.source === (detail?.source || 'PHB')) || matches.find(e => e.source === 'PHB') || matches[0];
    return found;
  }
  function link(reference: string, tag?: string) {
    const found = resolveReference(reference, tag);
    const name = reference.split('|')[0];
    const tagKind = ['variantrule', 'action', 'skill', 'sense', 'language'].includes(tag || '') ? 'rule' : tag === 'optfeature' ? 'feature' : tag;
    if (found) inspect(found); else { setQuery(name); if (tagKind && Object.hasOwn(KIND_LABELS, tagKind)) setKind(tagKind as Kind); setTargetId(''); setDetail(undefined); setNotice(`已搜索「${name}」。若未收录，可开启其他来源或在中文站查阅。`); }
  }
  function find(r: Requirement) { setTargetId(r.id); setKind(r.kind || 'feature'); setQuery(''); setSource(''); setEditionFilter('character'); setEnabledOnly(true); setDetail(undefined); setTab('wiki'); }
  function add(entry: Entry, requirement: Requirement | null | undefined = target) {
    if (!c) return;
    const reason = candidateReason(c, entry, requirement || undefined); if (reason) { setNotice(reason); return; }
    if (requirement && requirement.selected.length >= requirement.count) { setNotice('这个位置已经填满；请先移除原条目，或退出筛选后作为额外内容加入。'); return; }
    if (['race', 'background'].includes(entry.kind) && c.selections.some(s => s.entry.kind === entry.kind)) { setNotice(`角色已有${KIND_LABELS[entry.kind]}；请先移除原条目再替换，随时可撤销。`); return; }
    if (entry.kind === 'class' && !c.profile.optional.multiclass && c.selections.some(s => s.entry.kind === 'class')) { setNotice('添加另一职业前，请在规则设置中启用兼职。'); return; }
    edit(draft => { draft.selections.push({ id: uid(), entry: structuredClone(entry), quantity: 1, level: 1, equipped: false, ...(requirement && !requirement.id.startsWith('base:') ? { requirementId: requirement.id } : {}) }); });
    setNotice(`已填入「${entry.name}」`);
  }
  function drop(e: DragEvent, requirement?: Requirement, expected?: Kind[]) {
    e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData('application/x-dnd-entry'); const entry = allEntries.find(x => x.id === id);
    if (!entry) { setNotice('请从右侧资料列表拖入词条。'); return; }
    if (expected && !expected.includes(entry.kind)) { setNotice(`这个位置接收${expected.map(k => KIND_LABELS[k]).join('、')}。`); return; } add(entry, requirement || null);
  }
  function exportFile(mode: string) {
    if (!c || !d) return;
    if (mode === 'review') download(`${fileName(c.name)}-审卡.html`, exportReview(c, d), 'text/html');
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
        persist({ ...w, characters: [...w.characters, character], activeId: character.id }); setTargetId(''); setNotice('角色已作为新副本导入。');
      }
    } catch (error) { setImportError(error instanceof Error ? error.message : String(error)); }
  }
  function create(edition: Edition, copy = false) {
    if (!workspace || !c) return; const next = copy ? structuredClone(c) : newCharacter(edition); next.id = uid(); next.name = copy ? `${c.name}（副本）` : next.name; next.createdAt = next.updatedAt = new Date().toISOString(); next.revision = 1;
    persist({ ...workspace, characters: [...workspace.characters, next], activeId: next.id }); setTargetId(''); setModal(''); setSheetPage('主要'); setTab('sheet');
  }
  const requirements = (sections: string[]) => d?.requirements.filter(r => sections.includes(r.section) && (showAllRequirements || !r.complete || r.options)).map(r => <RequirementView key={r.id} r={r} c={c!} edit={edit} find={find} active={targetId === r.id}/>);
  const selections = (kinds: Kind[]) => c?.selections.filter(s => kinds.includes(s.entry.kind)).map(s => <Selected key={s.id} s={s} c={c} edit={edit} inspect={inspect} chooseSubclass={s.entry.kind === 'class' ? () => { setTargetId(''); setKind('subclass'); setQuery(''); setDetail(undefined); setTab('wiki'); } : undefined}/>);
  const addButton = (kind: Kind) => <button className="sheet-add" onClick={() => { setTargetId(''); setKind(kind); setQuery(''); setDetail(undefined); setTab('wiki'); }}>＋ 查阅{KIND_LABELS[kind]}</button>;

  if (!workspace || !c || !d) return <main className="startup"><h1>角色卡工坊</h1>{startupError ? <><p role="alert">本机记录读取失败：{startupError}</p><p>现有记录尚未覆盖。可以尝试恢复上一次保存。</p><button onClick={async () => { try { const backup = await restoreBackup(); if (!backup) throw new Error('没有可用备份'); acceptWorkspace(backup); } catch (e) { setStartupError(String(e)); } }}>读取备份</button><button onClick={() => { const next = newCharacter(); workspaceRef.current = { schemaVersion: 1, characters: [next], activeId: next.id, packs: [] }; setWorkspace(workspaceRef.current); setNotice('临时工作区。第一次编辑将保存新记录；请先导出重要数据。'); }}>使用新的临时工作区</button></> : <p>正在打开你的角色卡…</p>}</main>;
  const remaining = d.requirements.filter(r => !r.complete).length;
  const record = history.current.get(c.id); void historyTick;
  const blocked = detail ? candidateReason(c, detail, target) : '';
  return <KeywordPreview resolve={resolveReference} open={link}><DragContext.Provider value={{ entry: dragged, character: c, drop, end: endDrag }}><div className="app-shell">
    <header className="app-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); setModal('help'); }}><span className="brand-mark">▧</span><strong>角色卡工坊</strong><span className="brand-en">DND CARD</span></a>
      <div className="header-tools"><button onClick={() => setModal('characters')}>角色簿 <span>{workspace.characters.length}</span></button><button onClick={() => setModal('rules')}>规则与扩展</button><button className="primary" onClick={() => setModal('export')}>导入 / 导出</button><button className="help-button" aria-label="使用说明" onClick={() => setModal('help')}>?</button></div>
    </header>
    {readOnly && <div className="read-only-banner" role="status">另一标签页正在编辑，此页仅供查阅和导出。关闭另一页后将自动读取最新记录并接手。<button onClick={() => location.reload()}>重新检查</button></div>}
    {activateUpdate && <div className="read-only-banner" role="status">网页有新版本。<button onClick={async () => { await queue.current; if (saveFailed.current) { setNotice('保存未成功，请先导出角色备份，再重新打开网页。'); return; } navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); activateUpdate(); }}>保存后更新</button></div>}
    <nav className="mobile-tabs" aria-label="工作区"><button className={tab === 'sheet' ? 'active' : ''} onClick={() => setTab('sheet')}>角色卡{remaining ? ` · ${remaining} 项待填` : ''}</button><button className={tab === 'wiki' ? 'active' : ''} onClick={() => setTab('wiki')}>规则资料</button></nav>
    <main className="workspace">
      <section className={`sheet-pane ${tab === 'sheet' ? 'mobile-active' : ''}`} aria-label="角色卡工作区">
        <div className="pane-toolbar"><div><span className="eyebrow">角色卡</span><select aria-label="当前角色" value={c.id} onChange={e => { persist({ ...workspace, activeId: e.target.value }); setTargetId(''); }}>{workspace.characters.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="toolbar-actions"><button aria-label="撤销" disabled={!record?.past.length} onClick={() => undo()}>↶</button><button aria-label="重做" disabled={!record?.future.length} onClick={() => undo(true)}>↷</button><span className="paper-size">A4 · 适应窗口</span></div>
        </div>
        <PaperFrame page={sheetPage} changePage={page => { setSheetPage(page); setTab('sheet'); }}>
          <div className="paper-heading"><span>DUNGEONS &amp; DRAGONS</span><span>{c.edition} · 人物记录</span></div>
          {sheetPage === '主要' ? <><div className="identity-grid"><div className="identity-main">
            <Box label="角色姓名" className="name-box"><input aria-label="角色姓名" value={c.name} onChange={e => edit(d => { d.name = e.target.value; }, 'name')}/></Box>
            <Box label="职业与等级"><DropZone kinds={['class', 'subclass']}>{selections(['class'])}{c.selections.filter(sub => sub.entry.kind === 'subclass' && !c.selections.some(parent => belongsToClass(sub, parent))).map(sub => <span className="orphan-subclass" key={sub.id}>待关联职业：<Reference className="text-link" reference={`entry:${sub.entry.id}`} kind="subclass" onClick={() => inspect(sub.entry)}>{sub.entry.name}</Reference><button className="remove" aria-label={`移除${sub.entry.name}`} onClick={() => edit(draft => { draft.selections = draft.selections.filter(s => s.id !== sub.id); })}>×</button></span>)}{requirements(['class', 'subclass'])}</DropZone></Box>
            <div className="identity-bottom"><Box label="种族"><DropZone requirement={d.requirements.find(r => r.id === 'base:race')} kinds={['race']}>{selections(['race'])}{requirements(['race'])}</DropZone></Box><Box label="性别"><input aria-label="性别" value={c.identity.gender} onChange={e => edit(d => { d.identity.gender = e.target.value; }, 'gender')}/></Box><Box label="背景"><DropZone requirement={d.requirements.find(r => r.id === 'base:background')} kinds={['background']}>{selections(['background'])}{requirements(['background'])}</DropZone></Box><Box label="阵营"><input aria-label="阵营" value={c.identity.alignment} onChange={e => edit(d => { d.identity.alignment = e.target.value; }, 'alignment')}/></Box></div>
          </div><Box label="玩家与人物印象" className="player-box"><input aria-label="玩家姓名" placeholder="玩家姓名" value={c.player} onChange={e => edit(d => { d.player = e.target.value; }, 'player')}/><div className="portrait-placeholder" aria-hidden="true">◇</div><textarea aria-label="人物印象" placeholder="外貌、习惯，或一句介绍…" value={c.identity.description} onChange={e => edit(d => { d.identity.description = e.target.value; }, 'description')}/></Box></div>
          <div className="paper-body"><aside className="ability-column">{ABILITIES.map(a => <Box key={a} label={ABILITY_LABELS[a]} className="ability-box" hint={d.trace[a].join('；')}><span className="ability-code">{a.toUpperCase()}</span><strong className="ability-modifier">{signed(d.modifiers[a])}</strong><label className="ability-input"><span>基础</span><input aria-label={`${ABILITY_LABELS[a]}基础值`} type="number" min="1" max="30" value={c.abilities[a]} onChange={e => edit(draft => { draft.abilities[a] = clamp(e.target.value, 1, 30); }, a)}/></label>{d.abilities[a] !== c.abilities[a] && <small>总值 {d.abilities[a]}</small>}<span className="save-score">豁免 {signed(d.saves[a].value)}{d.saves[a].proficient ? ' ●' : ''}</span></Box>)}<Box label="状态">{selections(['condition'])}{addButton('condition')}</Box></aside>
          <div className="paper-main"><div className="stats-columns"><div className="stats-left">
            <div className="combat-numbers"><Box label="护甲等级" className="numeric" hint={d.trace.ac.join('；')}><strong>{d.ac}</strong></Box><Box label="先攻" className="numeric"><strong>{signed(d.initiative)}</strong></Box><Box label="速度 / 尺" className="numeric" hint={d.trace.speed.join('；')}><strong>{d.speed}</strong></Box></div>
            <Box label="生命值" className="hp-box" hint={d.trace.hp.join('；')}><div className="hp-top"><span>生命值上限 <strong>{d.maxHp}</strong></span><button className="text-link" onClick={() => edit(draft => { draft.runtime.hp = d.maxHp; })}>补满</button></div><div className="hp-inputs"><label>当前<input aria-label="当前生命值" type="number" min="0" max="9999" value={c.runtime.hp} onChange={e => edit(draft => { draft.runtime.hp = clamp(e.target.value, 0, 9999); }, 'hp')}/></label><label>临时<input aria-label="临时生命值" type="number" min="0" max="9999" value={c.runtime.tempHp} onChange={e => edit(draft => { draft.runtime.tempHp = clamp(e.target.value, 0, 9999); }, 'tempHp')}/></label></div><details><summary>手动调整上限</summary><label>0 使用计算值 <input aria-label="手动生命值上限" type="number" min="0" max="9999" value={c.baseHp} onChange={e => edit(draft => { draft.baseHp = clamp(e.target.value, 0, 9999); })}/></label></details></Box>
            <Box label="特性与专长" className="traits-box"><DropZone kinds={['feature', 'feat', 'rule']}>{selections(['feature', 'feat', 'rule'])}{requirements(['feature', 'feat', 'abilities', 'rule'])}<div className="add-row">{addButton('feature')}{addButton('feat')}</div></DropZone></Box>

          </div><div className="stats-right">
            <div className="secondary-stats"><Box label="激励" className="numeric"><input aria-label="激励" type="checkbox" checked={!!c.runtime.inspiration} onChange={e => edit(draft => { draft.runtime.inspiration = Number(e.target.checked); })}/></Box><div className="small-stats"><Box label="熟练加值" hint={d.trace.proficiency.join('；')}><strong>{signed(d.proficiency)}</strong></Box><Box label="被动察觉"><strong>{d.passive}</strong></Box></div><Box label="生命骰"><strong className="hit-dice">{d.hitDice}</strong></Box></div>
            <Box label="技能与熟练项" className="skills-box">{requirements(['proficiency'])}<div className="skill-list">{Object.entries(SKILLS).map(([key, skill]) => <div className="skill-line" key={key} title={d.skills[key].sources.join('；') || '未获得熟练'}><span className={d.skills[key].proficient ? 'trained' : 'untrained'}>{d.skills[key].proficient ? '●' : '○'}</span><strong>{signed(d.skills[key].value)}</strong><span>{skill.name}</span><small>{ABILITY_LABELS[skill.ability]}</small></div>)}</div></Box>
            <Box label="装备与物品" className="equipment-box"><DropZone kinds={['item']}>{selections(['item'])}{requirements(['item'])}{addButton('item')}<p className="sheet-note">穿戴的护甲和盾牌参与护甲计算。物品效果请核对正文。</p></DropZone></Box>
          </div></div>
          <Box label="法术记录" className="spells-box"><DropZone requirement={target?.kind === 'spell' ? target : undefined} kinds={['spell']}>{requirements(['spell'])}<div className="spell-selections">{selections(['spell'])}</div>{addButton('spell')}</DropZone></Box>
          </div></div>
        <aside className="sheet-checks"><div className="checks-heading"><strong>{remaining ? `${remaining} 项待填写或核对` : '当前填写要求已完成'}</strong><label><input type="checkbox" checked={showAllRequirements} onChange={e => setShowAllRequirements(e.target.checked)}/>显示已完成选择</label></div><p>基础数值自动计算；特殊特性、资源恢复和复杂联动请核对条目。计算依据可在导出审卡中查看。</p><div className="dialog-actions"><button onClick={() => setModal('adjust')}>数值依据与人工修正{c.adjustments?.length ? ` · ${c.adjustments.length}` : ''}</button><button onClick={() => setModal('resources')}>法术位与资源记录</button></div>{Object.entries(c.runtime.resources).map(([name, resource]) => <div className="resource-line" key={name}><span>{name}</span><button aria-label={`消耗${name}`} disabled={resource.current <= 0} onClick={() => edit(draft => { draft.runtime.resources[name].current--; })}>−</button><strong>{resource.current} / {resource.max}</strong><button aria-label={`恢复${name}`} disabled={resource.current >= resource.max} onClick={() => edit(draft => { draft.runtime.resources[name].current++; })}>＋</button></div>)}{d.issues.map(issue => <p className={`issue ${issue.severity}`} key={issue.id}>{issue.message}{issue.selectionId && <button onClick={() => inspect(c.selections.find(s => s.id === issue.selectionId)!.entry)}>查看</button>}</p>)}</aside></> : <div className="sheet-details">
          <header className="sheet-page-heading"><div><small>{c.name} · {c.edition}</small><h2>{sheetPage}</h2></div><span>{sheetPage === '特性' ? '能力、专长与规则选择' : sheetPage === '背景' ? '来历、性格与冒险记录' : sheetPage === '法术' ? '已选法术与施法资源' : '装备、物品与数量'}</span></header>
          {sheetPage === '背景' ? <><Box label="人物与来历" className="background-details"><label>年龄<input aria-label="年龄" value={c.identity.age} onChange={e => edit(draft => { draft.identity.age = e.target.value; }, 'age')}/></label><label>人物印象<textarea aria-label="人物印象" value={c.identity.description} onChange={e => edit(draft => { draft.identity.description = e.target.value; }, 'description')}/></label>{selections(['race', 'background'])}{requirements(['race', 'background'])}{c.selections.filter(s => ['race', 'background'].includes(s.entry.kind)).map(s => <section className="sheet-entry-body rules-prose" key={s.id}><h3>{s.entry.name}</h3><ContentBoundary key={s.id}><Entries value={s.entry.entries} onLink={link}/></ContentBoundary></section>)}</Box><Box label="冒险笔记" className="notes-box"><textarea aria-label="冒险笔记" placeholder="人物故事、战术与 DM 裁定…" value={c.notes} onChange={e => edit(draft => { draft.notes = e.target.value; }, 'notes')}/></Box></> : <>
          <Box label={sheetPage === '特性' ? '特性与专长' : sheetPage === '法术' ? '法术记录' : '装备与物品'} className="detail-page-box">
            <DropZone kinds={sheetPage === '特性' ? ['feature', 'feat', 'rule'] : sheetPage === '法术' ? ['spell'] : ['item']}>
              {requirements(sheetPage === '特性' ? ['feature', 'feat', 'abilities', 'rule', 'proficiency', 'subclass'] : sheetPage === '法术' ? ['spell'] : ['item'])}
              <div className="add-row">{sheetPage === '特性' ? <>{addButton('feature')}{addButton('feat')}</> : addButton(sheetPage === '法术' ? 'spell' : 'item')}</div>
              {c.selections.filter(s => (sheetPage === '特性' ? ['feature', 'feat', 'rule'] : sheetPage === '法术' ? ['spell'] : ['item']).includes(s.entry.kind)).map(s => <section className="sheet-entry-body" key={s.id}><Selected s={s} c={c} edit={edit} inspect={inspect}/><ContentBoundary key={s.id}><EntryFacts entry={s.entry} onLink={link}/><div className="rules-prose"><Entries value={s.entry.entries} onLink={link}/></div></ContentBoundary></section>)}
            </DropZone>
          </Box>
          {sheetPage === '法术' && <button className="sheet-resource-button" onClick={() => setModal('resources')}>法术位与资源记录 · {Object.keys(c.runtime.resources).length} 项</button>}
          </>}
        </div>}
          <footer className="paper-footer"><span>{c.edition} · {d.level || '—'} 级 · 修订 {c.revision}</span><span>资料快照随角色保存</span></footer>
        </PaperFrame><div className={`save-status ${saving === '保存失败' ? 'error' : ''}`} role="status"><span className="status-dot"/>{saving}<span>资料与角色保存在当前浏览器 · 请定期导出</span></div>
      </section>

      <section className={`wiki-pane ${tab === 'wiki' ? 'mobile-active' : ''}`} aria-label="规则资料"><div className="wiki-header"><div><span className="eyebrow">规则资料</span><span className="wiki-source">5etools 中文站</span></div><button title="重新检查上游资料" disabled={loading} onClick={() => load(true)}>{loading ? '加载中…' : '更新资料'}</button></div>
        <div className="wiki-search"><span aria-hidden="true">⌕</span><input aria-label="搜索规则资料" placeholder="搜索中文名、英文名或来源…" value={query} onChange={e => { setQuery(e.target.value); setDetail(undefined); }}/>{query && <button aria-label="清空搜索" onClick={() => setQuery('')}>×</button>}</div>
        <nav className="category-tabs" aria-label="资料分类">{Object.entries(KIND_LABELS).map(([key, label]) => <button key={key} className={kind === key ? 'active' : ''} onClick={() => { setKind(key as Kind); setDetail(undefined); setTargetId(''); }}>{label}</button>)}</nav>
        <div className="wiki-filters"><select aria-label="资料版本" value={editionFilter} onChange={e => setEditionFilter(e.target.value)}><option value="character">跟随角色 · {c.edition}</option><option value="2014">2014 规则</option><option value="2024">2024 规则</option><option value="all">所有版本</option></select><select aria-label="资料来源" value={source} onChange={e => setSource(e.target.value)}><option value="">全部来源</option>{sources.map(s => <option key={s} value={s}>{bookNames[s] ? `${s} · ${bookNames[s]}` : s}</option>)}</select><label><input type="checkbox" checked={enabledOnly} onChange={e => setEnabledOnly(e.target.checked)}/>已启用</label></div>
        {target && <div className="target-banner"><div><strong>正在填写：{target.label}</strong><small>{target.origin} · {target.selected.length}/{target.count}</small></div><button onClick={() => setTargetId('')}>退出筛选</button></div>}
        <div className="catalog-status"><span>{loading ? `${progress.done}/${progress.total} 份资料` : `${allEntries.length.toLocaleString()} 条资料`}{progress.cached > 0 ? ` · ${progress.cached} 份缓存` : ''}</span><span>{filtered.length} 条符合筛选</span></div>
        {progress.failed.length > 0 && <details className="load-errors"><summary>{progress.failed.length} 份资料读取异常 · 可重试</summary>{progress.failed.map((e, i) => <p key={i}>{e}</p>)}<button disabled={loading} onClick={() => load(true)}>重试加载</button></details>}
        <div className={`library-body ${detail ? 'has-detail' : ''}`}><div className="catalog-list" aria-label="资料列表">{filtered.slice(0, limit).map(entry => <button key={entry.id} draggable onDragStart={e => { e.dataTransfer.setData('application/x-dnd-entry', entry.id); e.dataTransfer.effectAllowed = 'copy'; setDragged(entry); const ghost = dragGhost.current!; ghost.querySelector('strong')!.textContent = entry.name; ghost.querySelector('small')!.textContent = `${KIND_LABELS[entry.kind]} · ${entry.source} · ${entry.edition}`; e.dataTransfer.setDragImage(ghost, 22, 24); }} onDragEnd={endDrag} className={`catalog-row ${detail?.id === entry.id ? 'active' : ''}`} onClick={() => inspect(entry)}><span className="entry-name">{entry.name}<small>{entry.english !== entry.name ? entry.english : ''}</small></span><span className="catalog-row-meta">{entry.kind === 'spell' ? `${entry.raw.level === 0 ? '戏法' : `${entry.raw.level}环`} · ` : ''}{entry.source}<small>{entry.edition === 'both' ? '通用' : entry.edition}</small></span></button>)}{filtered.length > limit && <button className="load-more" onClick={() => setLimit(n => n + 80)}>再显示 80 条（共 {filtered.length} 条）</button>}{!filtered.length && <div className="empty-state"><span>没有符合条件的条目</span><p>{loading ? '资料正在逐批载入。' : target ? '可以检查规则来源、退出候选筛选，或更新资料后重试。' : '试试其他关键词，或取消“已启用”查看全部来源。'}</p><button onClick={() => setModal('rules')}>查看规则设置</button></div>}</div>
        {detail && <article className="entry-detail" ref={detailPane} onScroll={e => { readingPositions.current[detail.id] = e.currentTarget.scrollTop; }}><div className="detail-navigation"><button disabled={!backStack.length} onClick={() => { const last = backStack.at(-1); if (last) { setDetail(last); setBackStack(s => s.slice(0, -1)); } else setDetail(undefined); }}>← 上一条</button><button aria-label="收起正文" onClick={() => { setDetail(undefined); setBackStack([]); }}>×</button></div><div className="detail-heading"><span className="eyebrow">{KIND_LABELS[detail.kind]} · {detail.edition === 'both' ? '通用资料' : detail.edition}</span><h1>{detail.name}</h1>{detail.english !== detail.name && <p>{detail.english}</p>}<small>{bookNames[detail.source] || detail.source} · {detail.source}{detail.page ? ` · 第 ${detail.page} 页` : ''}</small></div>
          <ContentBoundary key={`facts:${detail.id}`}><EntryFacts entry={detail} onLink={link}/></ContentBoundary>
          {detail.raw._copy && <p className="inline-warning">此资料继承了另一条目；未展开的继承内容需要在原站核对。</p>}
          <div className="rules-prose"><ContentBoundary key={detail.id}><Entries value={detail.entries} onLink={link}/></ContentBoundary>{!detail.entries.length && <p>此条目的内容以结构化规则为主。加入后可在角色卡查看需要填写的选择。</p>}</div>
          <details className="raw-details"><summary>数据与追溯</summary><dl><dt>条目身份</dt><dd>{detail.id}</dd><dt>资料修订</dt><dd>{detail.revision}</dd></dl><pre>{JSON.stringify(detail.raw, null, 2)}</pre></details>
          <div className="detail-actions">{blocked && <p className="inline-warning">{blocked}</p>}<button className="primary" disabled={!!blocked} onClick={() => add(detail)}>{target ? '填入当前要求' : '加入角色卡'}</button><a href={DEFAULT_SOURCE} target="_blank" rel="noreferrer">在中文站查阅 ↗</a>
          {blocked === '此来源或规则版本未启用' && <details><summary>记录 DM 特许</summary><p>仅对此条目启用；会随角色及审卡导出保留。</p><input aria-label="DM 特许说明" value={exception} placeholder="填写原因或 DM 的裁定" onChange={e => setException(e.target.value)}/><button disabled={!exception.trim()} onClick={() => edit(draft => { draft.profile.exceptions[detail.id] = exception.trim(); })}>保存特许</button></details>}
          {c.profile.exceptions[detail.id] && <p>DM 特许：{c.profile.exceptions[detail.id]} <button onClick={() => edit(draft => { delete draft.profile.exceptions[detail.id]; })}>撤回</button></p>}</div>
        </article>}{!detail && <div className="reading-placeholder"><span>选择上方条目</span><p>正文会在这里展开。选项与筛选始终保留，方便来回查阅。</p></div>}</div>
        <footer className="wiki-footer">拖入左侧对应位置，或在条目中点击加入。<a href="https://github.com/FullPeople/DND-card-web" target="_blank" rel="noreferrer">开源仓库 ↗</a></footer>
      </section>
    </main>
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
    {modal && <Dialog title={modal === 'characters' ? '角色簿' : modal === 'rules' ? '规则与扩展' : modal === 'export' ? '导入与导出' : modal === 'adjust' ? '数值依据与人工修正' : modal === 'resources' ? '法术位与资源记录' : '让角色卡带你完成选择'} close={() => { setModal(''); setImportError(''); setConfirmDelete(''); }}>
      {importError && <p className="inline-error" role="alert">导入未生效：{importError}</p>}
      {modal === 'adjust' && <><p className="muted">特殊规则尚未自动适配时，可填写最终数值与原因。修正会覆盖计算值，持续保留到手动撤回，并列入审卡。</p><div className="adjust-form"><label>数值<select aria-label="人工修正目标" value={adjustTarget} onChange={e => setAdjustTarget(e.target.value)}>{[['ac', '护甲等级'], ['hp', '生命值上限'], ['speed', '速度'], ['initiative', '先攻'], ['passive', '被动察觉'], ...Object.entries(SKILLS).map(([key, s]) => [`skill:${key}`, `${s.name}检定`]), ...ABILITIES.map(a => [`save:${a}`, `${ABILITY_LABELS[a]}豁免`])].map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>最终值<input aria-label="人工修正数值" type="number" min="-9999" max="9999" value={adjustValue} onChange={e => setAdjustValue(clamp(e.target.value, -9999, 9999))}/></label><label className="full-width">原因<input aria-label="人工修正原因" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="例如：DM 允许的护甲修正，或尚未适配的专长"/></label><button disabled={!adjustReason.trim()} onClick={() => { edit(draft => { draft.adjustments = [...(draft.adjustments || []).filter(a => a.target !== adjustTarget), { id: uid(), target: adjustTarget, value: adjustValue, reason: adjustReason.trim() }]; }); setAdjustReason(''); }}>记录修正</button></div>{(c.adjustments || []).map(a => <div className="pack-row" key={a.id}><span><strong>{a.target} → {a.value}</strong><small>{a.reason}</small></span><button onClick={() => edit(draft => { draft.adjustments = draft.adjustments?.filter(x => x.id !== a.id); })}>撤回</button></div>)}<details className="calculation-trace"><summary>展开计算依据</summary>{Object.entries(d.trace).map(([key, items]) => <p key={key}><strong>{choiceLabel(key)}</strong>：{items.join('；')}</p>)}</details></>}
      {modal === 'resources' && <><p className="muted">记录法术位、职业能力或消耗品的剩余次数。更新资料、升级与刷新页面不会自动补充资源。请按实际休息规则手动恢复。</p><div className="adjust-form"><label>资源名称<input aria-label="资源名称" placeholder="例如：一环法术位" value={resourceName} onChange={e => setResourceName(e.target.value)}/></label><label>上限<input aria-label="资源上限" type="number" min="1" max="999" value={resourceMax} onChange={e => setResourceMax(clamp(e.target.value, 1, 999))}/></label><button disabled={!resourceName.trim() || ['__proto__', 'constructor', 'prototype'].includes(resourceName.trim()) || Object.hasOwn(c.runtime.resources, resourceName.trim())} onClick={() => { edit(draft => { draft.runtime.resources[resourceName.trim()] = { current: resourceMax, max: resourceMax }; }); setResourceName(''); }}>添加记录</button></div>{Object.entries(c.runtime.resources).map(([name, resource]) => <div className="resource-line" key={name}><span>{name}</span><label>剩余 <input aria-label={`${name}剩余`} type="number" min="0" max={resource.max} value={resource.current} onChange={e => edit(draft => { draft.runtime.resources[name].current = clamp(e.target.value, 0, resource.max); })}/></label><span>/ {resource.max}</span><button onClick={() => edit(draft => { draft.runtime.resources[name].current = resource.max; })}>补满</button><button onClick={() => edit(draft => { delete draft.runtime.resources[name]; })}>移除</button></div>)}</>}
      {modal === 'characters' && <><div className="dialog-actions"><button onClick={() => create('2024')}>＋ 2024 角色</button><button onClick={() => create('2014')}>＋ 2014 角色</button><button onClick={() => create(c.edition, true)}>复制当前角色</button></div><div className="character-list">{workspace.characters.map(character => <div key={character.id}><button className="character-title" onClick={() => { persist({ ...workspace, activeId: character.id }); setTargetId(''); setModal(''); }}><strong>{character.name}</strong><small>{character.edition} · {character.player || '未填玩家'}{character.id === c.id ? ' · 当前角色' : ''}</small></button>{confirmDelete === character.id ? <span className="delete-confirm">删除后需通过导入恢复。<button onClick={() => { const characters = workspace.characters.filter(x => x.id !== character.id); persist({ ...workspace, characters, activeId: workspace.activeId === character.id ? characters[0].id : workspace.activeId }); setConfirmDelete(''); setTargetId(''); }}>确认删除</button><button onClick={() => setConfirmDelete('')}>取消</button></span> : <button disabled={workspace.characters.length === 1} onClick={() => setConfirmDelete(character.id)}>删除</button>}</div>)}</div><p className="muted">不同角色拥有独立的规则配置、选择与撤销记录。数据保存在本机浏览器。</p></>}
      {modal === 'rules' && <>
        <section className="settings-section"><h3>当前角色的规则</h3><label className="setting-row"><span>基础版本<small>切换会保留所有内容，并标记不兼容条目。</small></span><select aria-label="角色规则版本" value={c.edition} onChange={e => edit(draft => { draft.edition = e.target.value as Edition; })}><option>2024</option><option>2014</option></select></label>{([['feats', '专长规则', '允许选择专长'], ['multiclass', '兼职规则', '允许增加职业；兼职前提需与 DM 核对'], ['legacy', '兼容旧版内容', '允许 2024 角色使用 2014 条目，具体替换关系由 DM 裁定']] as const).map(([key, label, desc]) => <label className="setting-row" key={key}><span>{label}<small>{desc}</small></span><input type="checkbox" checked={c.profile.optional[key]} onChange={e => edit(draft => { draft.profile.optional[key] = e.target.checked; })}/></label>)}</section>
        <section className="settings-section"><h3>资料来源 <small>已启用 {c.profile.enabledSources.length}</small></h3><p>关闭后，已选条目仍保留，效果暂停。不同角色可使用不同书目。</p><div className="dialog-actions"><button onClick={() => edit(draft => { draft.profile.enabledSources = ['PHB', 'XPHB']; })}>仅基础规则</button><button onClick={() => edit(draft => { draft.profile.enabledSources = sources; })}>全部开启</button><button onClick={() => edit(draft => { draft.profile.enabledSources = []; })}>全部禁用</button></div><input className="source-search" aria-label="筛选资料来源" placeholder="筛选书籍简称或扩展包名称…" value={ruleSearch} onChange={e => setRuleSearch(e.target.value)}/><div className="source-grid">{sources.filter(s => `${s} ${bookNames[s] || ''} ${workspace.packs.find(p => p.id === s)?.name || ''}`.toLowerCase().includes(ruleSearch.toLowerCase())).map(s => <label key={s}><input type="checkbox" checked={c.profile.enabledSources.includes(s)} onChange={e => edit(draft => { draft.profile.enabledSources = e.target.checked ? [...new Set([...draft.profile.enabledSources, s])] : draft.profile.enabledSources.filter(x => x !== s); })}/><span>{workspace.packs.find(p => p.id === s)?.name || bookNames[s] || s}<small>{s === 'PHB' ? '玩家手册 2014' : s === 'XPHB' ? '玩家手册 2024' : `${s} · ${allEntries.filter(e => e.source === s).length} 条资料`}</small></span></label>)}</div><div className="dialog-actions"><button onClick={() => download(`${fileName(c.name)}-规则配置.json`, { profile: c.profile })}>导出配置</button><button onClick={() => importFile('profile')}>导入配置</button></div></section>
        <section className="settings-section"><h3>自定义扩展包</h3><p>以 JSON 声明条目、效果与选择。导入前检查格式、依赖和冲突；更新包不会替换角色内已选的旧快照。</p><div className="dialog-actions"><button onClick={() => importFile('pack')}>导入扩展包</button><button onClick={() => download('我的扩展-示例.json', EXAMPLE_PACK)}>下载编写示例</button></div><input className="file-input" data-testid="pack-file" type="file" accept=".json" aria-label="导入扩展包文件" onChange={e => { if (e.target.files?.[0]) importFile('pack', e.target.files[0]); e.target.value = ''; }}/>{workspace.packs.map(pack => <div className="pack-row" key={pack.id}><span><strong>{pack.name}</strong><small>{pack.id} · {pack.version} · {pack.entries.length} 条</small></span><button onClick={() => download(`${pack.id}-${pack.version}.json`, exportRulePack(pack))}>导出</button><button onClick={() => { const dependent = workspace.packs.find(p => p.requires.some(dep => dep.id === pack.id)); if (dependent) { setImportError(`「${dependent.name}」依赖这个包，请先移除依赖方。`); return; } persist({ ...workspace, packs: workspace.packs.filter(p => p.id !== pack.id) }); setNotice('已移除资料包；角色中的条目快照仍保留。可关闭其来源以暂停效果。'); }}>移除</button></div>)}</section>
        {Object.keys(c.profile.exceptions).length > 0 && <section className="settings-section"><h3>DM 特许记录</h3>{Object.entries(c.profile.exceptions).map(([id, reason]) => <p key={id}>{c.selections.find(s => s.entry.id === id)?.entry.name || allEntries.find(e => e.id === id)?.name || id}：{reason}<button onClick={() => edit(draft => { delete draft.profile.exceptions[id]; })}>撤回</button></p>)}</section>}
      </>}
      {modal === 'export' && <><section className="settings-section"><h3>带走当前角色</h3><div className="export-options"><button onClick={() => exportFile('character')}><strong>角色完整备份 · JSON</strong><span>保存基础输入、条目快照、选择与规则配置，可完整恢复。</span></button><button onClick={() => exportFile('review')}><strong>DM 审卡 · HTML / 打印</strong><span>离线打开即可阅读。包含计算依据、缺项、来源及裁定；浏览器打印可保存 PDF。</span></button><button onClick={() => exportFile('owlbear')}><strong>枭熊角色卡 · JSON</strong><span>导出 schema 0.3；复杂效果和未映射内容附带说明。</span></button></div></section><section className="settings-section"><h3>导入为新角色</h3><p>导入不覆盖已有角色。枭熊文件只迁入可识别的数据，需重新核对规则来源。</p><div className="dialog-actions"><button onClick={() => importFile('character')}>导入完整备份</button><button onClick={() => importFile('owlbear')}>导入枭熊 JSON</button></div><input className="file-input" data-testid="character-file" type="file" accept=".json" aria-label="导入角色备份文件" onChange={e => { if (e.target.files?.[0]) importFile('character', e.target.files[0]); e.target.value = ''; }}/></section><section className="settings-section"><h3>本机恢复</h3><p>自动保留上一次保存的工作区。请先导出当前角色，再恢复。</p><button onClick={async () => { try { const backup = await restoreBackup(); if (!backup) throw new Error('没有可用备份'); acceptWorkspace(backup); history.current.clear(); setNotice('已读取上一次保存；确认内容后继续编辑即可保存。'); setModal(''); } catch (error) { setImportError(String(error)); } }}>读取上一次保存</button></section></>}
      {modal === 'help' && <div className="help-copy"><p>从左侧灰色角色卡开始。虚线框表示一个尚未完成的选择，点击它，右侧会列出可以填入的资料。</p><ol><li>在角色簿中选择 2014 或 2024；在规则设置中勾选允许使用的书籍。</li><li>先填基础属性，再挑选职业、种族和背景。等级变化会产生新的填写要求。</li><li>阅读右侧正文，把条目拖入对应位置；也可以点“填入当前要求”。技能与属性增长直接在卡内选择。</li><li>特殊效果保留正文并提示核对。与 DM 协商的例外可记录在条目中。</li><li>随时导出完整备份。审卡 HTML 可离线发给 DM，也可打印为 PDF。</li></ol><p>这不是完整的战斗模拟器。基础属性、熟练、护甲、生命值和部分选择可以计算；施法准备、复杂前提、特性联动和休息恢复仍需人工核对。没有资料的规则不会被假装实现。</p><p>账号同步、Excel 适配和 C++ 桌面客户端属于后续阶段。</p><a href="https://github.com/FullPeople/DND-card-web" target="_blank" rel="noreferrer">源代码与问题反馈 ↗</a></div>}
    </Dialog>}
    <div className="drag-ghost" ref={dragGhost} aria-hidden="true"><span className="drag-grip">⠿</span><div><small/><strong/></div><span className="drag-plus">＋</span><p>放入亮起的填写区域</p></div>
  </div></DragContext.Provider></KeywordPreview>;
}
