import {Announcement} from './Announcement';
import {announcementPending,readAnnouncementVersion} from '../platform/announcement';
import {SpellAbilityEditor} from './SpellAbilityEditor';
import {ownsSubclassFeature} from '../core/entryReferences';
import {reviewImport} from '../core/importReview';
import {hydrateImportedCasting} from '../core/castingSnapshot';
import {PersonalEntries} from './PersonalEntries';
import {HitPointEditor} from './HitPointEditor';
import {includeNewProfileSources,startAllSources} from '../core/sourceDefaults';
import {ensureSiteSources,sourceSettings,withSiteSources} from '../core/siteSources';
import {WikiLayout,WikiEmptyPrompt} from './WikiLayout';
import {standalone} from '../platform/buildMode';
import {LocalDice} from '../standalone/LocalDice';
import {pinEntry} from '../core/quickbar';
import {QuickbarManager} from './QuickbarManager';
import {recordAction,travelHistory,useActionHistory} from '../platform/actionHistory';
import {applyPatch,sameValue} from '../core/merge';
import {CarryCapacity} from './InventoryMarks';
import {useLayoutEffect} from 'react';
import {SupporterEffect} from './SupporterEffect';
import {ResourceEditor} from './ResourceEditor';
import {applyInventory} from '../core/inventory';
import {WorkbenchInventory} from './StockBoard';
import {WorkbenchPanel,MusicWorkspace} from './WorkbenchPanel';
import {useNarrowWikiDrag} from './useNarrowWikiDrag';
import {CustomEntryEditor} from './CustomEntryEditor';
import {Toast} from './Toast';
import {CopyDiagnostic,diagnosticText} from './CopyDiagnostic';
import {isHitDieResource,syncAutoResources} from '../core/resources';
import {entryLabel} from '../core/entryLabel';
import {NumberInput} from './NumberInput';
import {inWorkbench,useWorkbench,workbenchCharacterId,patchWorkbenchStats,workbenchRequest,chooseWorkbench,workbenchDiagnostics,type SharedRules} from '../platform/workbench';
import {WorkbenchBar,DicePage,WorkbenchMonster,DMConsole} from './Workbench';
import {DetailHeader,FeaturesPage,BackgroundPage} from './CharacterPages';
import {SpellsPage} from './SpellsPage';
import {DmNotes} from './DmNotes';
import {InventoryPage} from './InventoryPage';
import {WorkspaceSplitter} from './WorkspaceSplitter';
import {Palette} from './Portrait';
import { captureSheet, saveSheetPng, printSheetPng } from '../platform/sheetImage';
import { ClassNavigation } from './ClassNavigation';
import { CatalogList } from './CatalogList';
import { MonsterDocument, MonsterPortrait } from './MonsterDocument';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ABILITIES, ABILITY_LABELS, KIND_LABELS, SKILLS, newCharacter, selectionAllowed, subclassOwner, entryEdition, editionAllows, uid, type Character, type Edition, type Entry, type Kind, type Selection } from '../core/model';
import { candidateReason, choiceLabel, evaluate, requirementMismatch } from '../core/engine';
import { EXAMPLE_PACK, importOwlbear, parseFile, readCharacter, validateCharacter, validatePack } from '../core/validation';
import { exportCharacter, exportOwlbear, exportReview, exportRulePack } from '../core/export';
import { loadCatalog, DEFAULT_SOURCE, type LoadProgress } from '../data/catalog';
import { download,saveRecovery,loadRecoveries, loadWorkspace, pickFile, restoreBackup, saveWorkspace, type Workspace } from '../platform/storage';
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
import {SheetFullscreenButton,exitSheetFullscreen} from './SheetFullscreenButton';
import { DropZone, EntryDragProvider, EntryDraggable } from './DragEntry';
import { GlobalSearch } from './GlobalSearch';
import { SourceSettings } from './SourceSettings';
import { RoomRulesSummary } from './RoomRulesSummary';
import {confirmedChanges} from '../core/syncRecovery';
import { SourceName, useSources } from './SourceName';
import { KeywordPreview } from './KeywordPreview';
import { Reference } from './Reference';
import { LibraryFilters } from './LibraryFilters';
import { LibraryDocument } from './LibraryDocument';
import { useLibrary } from './useLibrary';
import { explicitlyExcluded, librarySourceEnabled, LIBRARY_TABS, tabOf, columnsFor, facetsFor, matchesFacets, compareEntries } from './libraryData';
import { WikiSplitter } from './WikiSplitter';
import { registerOffline } from '../platform/offline';

const emptyProgress: LoadProgress = { done: 0, total: 1, label: '等待资料', failed: [], cached: 0 };
const clamp = (value: string, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const fileName = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100) || '角色';
type Edit = (action: (draft: Character) => void, key?: string) => void;

function Box({ label, children, className = '', hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return <SheetCell label={label} className={`detail-cell ${className}`} hint={hint}>{children}</SheetCell>;
}
function RawDetails({entry}:{entry:Entry}){const [open,setOpen]=useState(false);return <details className="raw-details" onToggle={e=>setOpen(e.currentTarget.open)}><summary>数据与追溯</summary>{open&&<><dl><dt>条目身份</dt><dd>{entry.id}</dd><dt>资料修订</dt><dd>{entry.revision}</dd></dl><pre>{JSON.stringify(entry.raw,null,2)}</pre></>}</details>;}
function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="dialog" ref={ref} onCancel={e=>{if(e.target===e.currentTarget){e.preventDefault();close();}}} onClick={e => { if (e.target === ref.current) close(); }} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button onClick={close} aria-label="关闭弹窗">×</button></div><div className="dialog-body">{children}</div></dialog>;
}
function Selected({ s, c, edit, inspect }: { s: Selection; c: Character; edit: Edit; inspect: (e: Entry) => void }) {
  const allowed = selectionAllowed(c, s.entry);
  if (['class', 'subclass', 'race', 'background'].includes(s.entry.kind)) return <IdentityToken row={s} c={c} edit={edit} inspect={inspect}/>;
  return <div className={`selected-entry ${allowed ? '' : 'restricted'}`}>
    <div className="selected-title"><span className="class-title"><Reference className="text-link" reference={`entry:${s.entry.id}`} kind={s.entry.kind} onClick={() => inspect(s.entry)}>{s.entry.name}</Reference></span><button className="remove" aria-label={`移除${s.entry.name}`} title="移除，可撤销" onClick={() => edit(d => { removeSelection(d, s.id); })}>×</button></div>
    <div className="entry-meta"><span><SourceName id={s.entry.source}/>{!allowed ? ' · 未启用' : ''}</span>{s.entry.kind === 'class' && <label>等级 <NumberInput aria-label={`${s.entry.name}等级`} type="number" min="1" max="20" value={s.level} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.level = clamp(e.target.value, 1, 20); }, `${s.id}-level`)}/></label>}

      {s.entry.kind === 'item' && <><label>× <NumberInput aria-label={`${s.entry.name}数量`} type="number" min="1" max="9999" value={s.quantity} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.quantity = clamp(e.target.value, 1, 9999); })}/></label><label><input type="checkbox" checked={s.equipped} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.equipped = e.target.checked; })}/>装备</label></>}
    </div>
  </div>;
}

export default function App() {
  const wb=useWorkbench();
  const [workbenchPage,setWorkbenchPage]=useState('sheet');
  useEffect(()=>{const navigate=(e:Event)=>{const page=(e as CustomEvent).detail;if(['console','sheet','dice','music','settings','features'].includes(page))setWorkbenchPage(page);};window.addEventListener('workbench-panel-navigate',navigate);return()=>window.removeEventListener('workbench-panel-navigate',navigate);},[]);
  const [tableOpen,setTableOpen]=useState(false);
  useEffect(()=>{if(wb.enabled.threeDragonAnte===false)setTableOpen(false);if(wb.enabled.musicBoard===false&&workbenchPage==='music'||wb.enabled.dice===false&&workbenchPage==='dice')setWorkbenchPage('console');},[wb.enabled,workbenchPage]);
  const firstWorkbenchRole=useRef(false),previousTarget=useRef('');
  const wikiVisible=!inWorkbench||!!wb.visibility?.wiki,monstersVisible=!inWorkbench||!!wb.visibility?.monsters;
  useEffect(()=>{if(!inWorkbench||!wb.role)return;if(!firstWorkbenchRole.current){firstWorkbenchRole.current=true;setWorkbenchPage('console');}},[wb.role]);
  useEffect(()=>{const key=wb.target?.key||'';if(previousTarget.current&&key&&key!==previousTarget.current)setWorkbenchPage('sheet');previousTarget.current=key;},[wb.target?.key]);
  useEffect(()=>{const show=()=>{setWorkbenchPage('sheet');setTab('sheet');};window.addEventListener('workbench-show-sheet',show);return()=>window.removeEventListener('workbench-show-sheet',show);},[]);
  useEffect(()=>{if(wb.compose)setWorkbenchPage('dice');},[wb.compose?.id]);
  useEffect(()=>{if(inWorkbench)document.body.classList.add('suite-workbench');return()=>document.body.classList.remove('suite-workbench');},[]);
  const appliedWorkbench=useRef('');
  const workbenchDocuments=useRef(new Map<string,string>());
  const workbenchDirty=useRef(new Set<string>());
  const workbenchFailed=useRef(new Set<string>());
  const workbenchUncertain=useRef(new Map<string,{requestId:string;before:Character;after:Character}>());
  const workbenchPending=useRef(new Map<string,number>());
  const [workspace, setWorkspace] = useState<Workspace>();
  const workspaceRef = useRef<Workspace | undefined>(undefined);
  const [startupError, setStartupError] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [activateUpdate, setActivateUpdate] = useState<(() => void)>();
  const writable = useRef(false);
  const [notice, setNotice] = useState('');
  const [syncDiagnostic,setSyncDiagnostic]=useState('');
  const [noticeDiagnostic,setNoticeDiagnostic]=useState<{message:string;diagnostic?:string}>();
  useEffect(()=>{const error=(e:Event)=>{const detail=(e as CustomEvent).detail;setNotice(typeof detail==='string'?detail:detail.message);setNoticeDiagnostic(typeof detail==='object'?detail:undefined);};window.addEventListener('workbench-error',error);return()=>window.removeEventListener('workbench-error',error);},[]);
  const [saving, setSaving] = useState('正在读取');
  const queue = useRef(Promise.resolve());
  const pendingSaves = useRef(0);
  const saveFailed = useRef(false);
  const history = useRef(new Map<string, { past: Character[]; future: Character[]; key?: string; time: number }>());
  const [historyTick, setHistoryTick] = useState(0);
  useEffect(()=>{const handler=(event:Event)=>{const receipt=(event as CustomEvent).detail;if(receipt.uncertain)return;let changed=false;for(const [id,pending] of workbenchUncertain.current){if(pending.requestId!==receipt.requestId)continue;const remote=receipt.result?.snapshot?.document?.dnd_card_web;if(receipt.ok&&(!remote||!confirmedChanges(pending.before,pending.after,remote)))continue;workbenchUncertain.current.delete(id);workbenchDirty.current.delete(id);if(receipt.ok)workbenchFailed.current.delete(id);changed=true;}if(changed){appliedWorkbench.current='';setHistoryTick(n=>n+1);}};window.addEventListener('workbench-operation-result',handler);return()=>window.removeEventListener('workbench-operation-result',handler);},[]);
  const actionHistory=useActionHistory();
  const [entries, setEntries] = useState<Entry[]>([]);
  const sourceDisplay=useSources();
  const bookNames=useMemo(()=>Object.fromEntries(Object.entries(sourceDisplay.registry).map(([id,m])=>[id,m.name])),[sourceDisplay.registry]);
  const catalogRef = useRef(new Map<string, Entry>());
  const [progress, setProgress] = useState(emptyProgress);
  const [loading, setLoading] = useState(false);
  const loadController = useRef<AbortController | undefined>(undefined);
  const [rulesDraft,setRulesDraft]=useState<{key:string;rules:SharedRules}>();
  const roomRules=rulesDraft?.key===wb.shared?.key?rulesDraft?.rules:wb.shared?.rules;
  const activePacks=useMemo(()=>inWorkbench?(roomRules?.packs||[]):workspace?.packs||[],[workspace,roomRules?.packs]);
  const [rulesBusy,setRulesBusy]=useState(false);
  const [creatingCard,setCreatingCard]=useState(false);
  const remoteCreatePending=useRef(false);
  const rulesReadonly=inWorkbench&&(!wb.online||wb.role!=='GM'||!wb.shared?.key||rulesBusy);
  useEffect(()=>{if(activePacks.length)sourceDisplay.merge(Object.fromEntries(activePacks.map(pack=>[pack.id,{name:pack.name}])));},[activePacks,sourceDisplay.merge]);
  const canAuthor=!inWorkbench||wb.role==='GM';
  const customEntries=useMemo(()=>inWorkbench?roomRules?.customEntries||[]:workspace?.customEntries||[],[roomRules?.customEntries,workspace?.customEntries]);
  const localSources=!inWorkbench;
  const storedCharacter=workspace?.characters.find(x=>x.id===workspace.activeId);
  const allEntries = useMemo(() => [...SIZE_ENTRIES, ...entries, ...activePacks.flatMap(p => p.entries), ...(canAuthor?customEntries:[])].filter(e=>monstersVisible||e.kind!=='monster'), [entries, activePacks,monstersVisible,canAuthor,customEntries]);
  const defaultSources=useMemo(()=>[...new Set(allEntries.flatMap(e=>[e.source,...(e.dependencies||[])]))],[allEntries]);
  const roomProfile=useMemo(()=>roomRules?includeNewProfileSources(roomRules.profile,defaultSources):undefined,[roomRules,defaultSources]);
  const c=useMemo(()=>{
    if(!storedCharacter)return;
    const effective=inWorkbench&&wb.shared?{...storedCharacter,edition:roomRules!.edition,profile:roomProfile!,rulePacks:roomRules!.packs}:localSources?withSiteSources(storedCharacter,workspace?.siteSources,activePacks):storedCharacter;
    // Reading an old card must not create competing network writes. Casting
    // metadata is a view until the owner performs an explicit edit.
    if(inWorkbench&&effective.selections.some(s=>s.entry.packId==='imported'&&s.entry.kind==='class'&&!s.entry.raw._castingSource)){const view=structuredClone(effective);if(hydrateImportedCasting(view,allEntries))return view;}
    return effective;
  },[storedCharacter,roomRules,roomProfile,workspace?.siteSources,activePacks,allEntries]);
  function createLocalCharacter(edition:Edition='2024'){const next=newCharacter(edition);return localSources?(workspaceRef.current?.siteSources?withSiteSources(next,workspaceRef.current.siteSources,workspaceRef.current.packs):startAllSources(next,defaultSources)):next;}
  useEffect(()=>{
    const current=workspaceRef.current;
    if(!localSources||!current||!writable.current)return;
    if(!current.siteSources)return;
    const profile=includeNewProfileSources(current.siteSources,defaultSources);
    if(profile!==current.siteSources)persist({...current,siteSources:sourceSettings(profile)});
  },[defaultSources,workspace]);
  const libraryEntries=useMemo(()=>c?allEntries.filter(e=>librarySourceEnabled(c,e)):[],[allEntries,c?.profile.enabledSources]);
  const readableEntries = useMemo(()=>[...allEntries,...(workspace?.characters.flatMap(c=>c.selections.map(s=>s.entry))||[])],[allEntries,workspace?.characters]);
  const library = useLibrary(readableEntries);
  const { kind, setKind, detail: storedDetail, setDetail, state: libraryState } = library;
  const detail=storedDetail&&c&&librarySourceEnabled(c,storedDetail)?storedDetail:undefined;
  useEffect(()=>{if(!monstersVisible&&kind==='monster')setKind('class');if(!monstersVisible&&detail?.kind==='monster')setDetail(undefined);},[monstersVisible,kind,detail?.id]);
  const { edition: editionFilter, filters, sort, descending, query:categoryQuery } = libraryState;
  const { globalQuery:query, setGlobalQuery:setQuery } = library;
  const setEditionFilter = (edition: string) => library.patch({ edition });
  const detailPane = useRef<HTMLElement>(null);
  const previewCommit=useRef<{id:string;top:number}|undefined>(undefined);
  const [announcement,setAnnouncement]=useState(()=>standalone&&announcementPending(readAnnouncementVersion()));
  const [modal, setModal] = useState('');
  const [pendingImport,setPendingImport]=useState<{card:Character;review:ReturnType<typeof reviewImport>}>();

  const [fillPulse,setFillPulse]=useState(0);
  const [readingFlash,setReadingFlash]=useState(0);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [workspace?.activeId]);
  const [sheetPage, setSheetPage] = useState<SheetPage>('主要');
  const [tab, setTab] = useState('sheet');
  useNarrowWikiDrag(tab,setTab,!tableOpen&&(!inWorkbench||workbenchPage==='console'||workbenchPage==='sheet'&&!!wb.target));
  const [exception, setException] = useState('');
  const [importError, setImportError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [adjustTarget, setAdjustTarget] = useState('ac');
  const [adjustValue, setAdjustValue] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [transferText,setTransferText]=useState(''),[imageBusy,setImageBusy]=useState(false),[png,setPng]=useState<{url:string;blob:Blob}>();
  useEffect(()=>()=>{if(png)URL.revokeObjectURL(png.url);},[png]);
  const [editingResource,setEditingResource]=useState('');
  useEffect(()=>{const open=(event:Event)=>{setEditingResource((event as CustomEvent).detail);setModal('resources');};window.addEventListener('edit-character-resource',open);return()=>window.removeEventListener('edit-character-resource',open);},[]);

  function persist(next: Workspace) {
    if(localSources)next=ensureSiteSources(next);
    if (!writable.current) { setNotice('另一标签页正在编辑；此页仅供查阅与导出。关闭另一页后刷新即可编辑。'); return; }
    workspaceRef.current = next; setWorkspace(next); setSaving('保存中…'); pendingSaves.current++;
    queue.current = queue.current.catch(() => {}).then(() => saveWorkspace(next)).then(() => {
      if (workspaceRef.current === next) { saveFailed.current = false; setSaving('已保存到本机'); }
    }).catch(error => { saveFailed.current = true; setSaving('保存失败'); setNotice(`本机保存失败，请立即导出角色备份。${String(error)}`); }).finally(() => { pendingSaves.current--; });
  }
  function acceptWorkspace(value: Workspace) {
    if (value.schemaVersion !== 1 || !Array.isArray(value.characters) || !value.characters.length || !Array.isArray(value.packs)) throw new Error('工作区结构不完整');
    const repaired: string[] = [];
    value = {...value, characters: value.characters.map(character => { const read = readCharacter(character); if (read.repaired.length) repaired.push(`${character.name || '未命名'}（${read.repaired.join('、')}）`); return read.character; })};
    if(value.siteSources){const probe=newCharacter();probe.profile={...probe.profile,...value.siteSources};validateCharacter(probe);}
    if (new Set(value.characters.map(c => c.id)).size !== value.characters.length) throw new Error('角色身份重复');
    for (const pack of value.packs) validatePack({ ...pack, entries: pack.entries.map(e => ({ ...e, id: e.id.slice(pack.id.length + 1) })) }, value.packs);
    if (!value.characters.some(c => c.id === value.activeId)) value.activeId = value.characters[0].id;
    if(localSources)value=ensureSiteSources(value);
    workspaceRef.current = value; setWorkspace(value); setSaving('已保存到本机'); setStartupError('');
    if(repaired.length)setNotice(`这些角色的图片数据无法读取，已忽略并保留其余内容：${repaired.join('；')}。请重新设置后再保存。`);
  }
  useEffect(() => {
    let alive = true; let release = () => {}; const lockAbort = new AbortController();
    const initialize = async (canWrite: boolean) => {
      writable.current = canWrite; setReadOnly(!canWrite);
      try {
        const value = await loadWorkspace(); if (!alive) return;
        if (value) {acceptWorkspace(value);if(localSources&&!value.siteSources&&canWrite)persist(workspaceRef.current!);} else { const first = createLocalCharacter(); const initial: Workspace = { schemaVersion: 1, characters: [first], activeId: first.id, packs: [] }; if (canWrite) persist(initial); else acceptWorkspace(initial); }
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
    let lastPublish=0;
    try {
      await loadCatalog(batch => {
        batch.forEach(e => catalogRef.current.set(e.id, e));
        if(performance.now()-lastPublish>500){lastPublish=performance.now();setEntries([...catalogRef.current.values()]);}
      }, setProgress, controller.signal, refresh, DEFAULT_SOURCE, sourceDisplay.merge);
      if(!controller.signal.aborted)setEntries([...catalogRef.current.values()]);
    } catch (e) { if (!controller.signal.aborted) setNotice(`资料加载失败：${String(e)}`); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => { void load(); return () => loadController.current?.abort(); }, []);
  useEffect(() => { void registerOffline(activate => setActivateUpdate(() => activate)); }, []);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (pendingSaves.current > 0 || saveFailed.current) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, []);
  const d = useMemo(() => c ? evaluate(c) : undefined, [c]);
  /** 一张坏图片只丢弃它自己：头像或立绘读不出来时仍然打开整张角色卡。 */
  function readDocument(document: unknown): Character {
    const { character, repaired } = readCharacter(document);
    if (repaired.length) setNotice(`${repaired.join('、')}数据无法读取，已忽略并打开角色卡；重新设置后保存会覆盖损坏的记录。`);
    return character;
  }
  useLayoutEffect(()=>{
    if(!inWorkbench||!workspace||!writable.current||!wb.target||wb.target.kind!=='character')return;
    const target=wb.target,id=workbenchCharacterId(target),signature=JSON.stringify([target,wb.document,wb.inventory?.revision]);
    if(signature===appliedWorkbench.current&&workspaceRef.current?.activeId===id)return;
    const current=workspaceRef.current!;let next=current.characters.find(row=>row.id===id);
    try{
      const documentSignature=JSON.stringify(wb.document);
      if(!next||(wb.document&&workbenchDocuments.current.get(id)!==documentSignature&&!workbenchDirty.current.has(id))){if(!wb.document)return;next=wb.document.dnd_card_web?structuredClone(readDocument(wb.document.dnd_card_web)):importOwlbear(wb.document);next.id=id;}
      else next=structuredClone(next);
      const uncertain=workbenchUncertain.current.get(id);
      if(uncertain&&wb.document?.dnd_card_web&&confirmedChanges(uncertain.before,uncertain.after,wb.document.dnd_card_web)){window.dispatchEvent(new CustomEvent('workbench-operation-reconciled',{detail:{requestId:uncertain.requestId}}));workbenchUncertain.current.delete(id);workbenchDirty.current.delete(id);workbenchFailed.current.delete(id);next=structuredClone(readDocument(wb.document.dnd_card_web));next.id=id;}
      if(workbenchDirty.current.has(id)){if(current.activeId!==id)persist({...current,activeId:id});return;}
      const stock=wb.inventory?.containers[`card:${target.cardId}`];if(stock&&!workbenchDirty.current.has(id))applyInventory(next,stock);
      if(wb.document)workbenchDocuments.current.set(id,documentSignature);
      next.locked=target.locked;
      if(!wb.document?.dnd_card_web){
      if(target.conditions){
        const existing=next.selections.filter(s=>s.entry.kind==='condition');next.selections=next.selections.filter(s=>s.entry.kind!=='condition');
        for(const condition of target.conditions){const clean=condition.name.replace(/[^\p{L}\p{N}]/gu,'');const old=existing.find(s=>s.entry.raw._suiteStatusId===condition.id||s.entry.name.replace(/[^\p{L}\p{N}]/gu,'')===clean||condition.id==='web:'+s.entry.id);
          const entry=old?.entry||allEntries.find(e=>e.kind==='condition'&&e.name.replace(/[^\p{L}\p{N}]/gu,'')===clean)||{id:'suite-condition:'+condition.id,kind:'condition' as const,name:condition.name,english:condition.name,source:'IMPORTED',edition:'both' as const,packId:'imported',revision:'1',entries:[],raw:{}};
          next.selections.push({...old,id:old?.id||'suite-status:'+condition.id,entry:{...entry,raw:{...entry.raw,_suiteStatusId:condition.id}},level:old?.level??1,quantity:1,equipped:false});
        }
      }
      if(target.resources)next.runtime.resources=Object.fromEntries(target.resources.map((r:any)=>[r.id,{...r,current:r.current,max:r.max}]));
      const stats=target.stats;
      if(typeof stats.health==='number')next.runtime.hp=stats.health;
      if(typeof stats['temporary health']==='number')next.runtime.tempHp=stats['temporary health'];
      if(typeof stats['max health']==='number'){next.baseHp=stats['max health'];next.sheetBonuses={...next.sheetBonuses,hp:0};next.adjustments=next.adjustments?.filter(a=>a.target!=='hp');}
      if(typeof stats['armor class']==='number'){next.adjustments=next.adjustments?.filter(a=>a.target!=='ac')||[];next.adjustments.push({id:'suite-ac',target:'ac',value:stats['armor class']-(next.sheetBonuses?.ac||0),reason:'枭熊场景'});}
      }
      syncAutoResources(next);
      appliedWorkbench.current=signature;
      persist({...current,activeId:id,characters:[...current.characters.filter(row=>row.id!==id),next]});
    }catch(e){setNotice(`枭熊角色读取失败：${String(e)}`);appliedWorkbench.current=signature;}
  },[wb.target,wb.document,wb.inventory?.revision,!!workspace,workspace?.activeId,historyTick]);


  const columns = useMemo(() => columnsFor(kind, c?.edition==='2014'||!!c?.profile.optional.legacy||['2014','all'].includes(editionFilter)), [kind,c?.edition,c?.profile.optional.legacy,editionFilter]);
  const facets = useMemo(() => facetsFor(kind), [kind]);
  const categoryEntries = useMemo(() => {
    if (!c) return [];
    return libraryEntries.filter(e => tabOf(e) === kind && (kind!=='class'||e.kind==='class') &&
      (editionFilter === 'all' || editionAllows(e,(editionFilter === 'character' ? c.edition : editionFilter) as Edition,editionFilter === 'character' && c.profile.optional.legacy)));
  }, [libraryEntries, c?.edition, c?.profile.optional.legacy, kind, editionFilter]);
  const filtered = useMemo(() => categoryEntries.filter(e => matchesFacets(e, filters, facets)&&(!categoryQuery.trim()||`${e.name} ${e.english} ${e.source}`.toLocaleLowerCase().includes(categoryQuery.trim().toLocaleLowerCase()))).sort((a, b) => compareEntries(a, b, columns.find(col => col.key === sort) || columns[0], descending,sourceDisplay.registry)), [categoryEntries, filters, facets, columns, sort, descending,sourceDisplay.registry,categoryQuery]);
  useEffect(() => { setException(''); }, [detail?.id]);
  useEffect(() => { if (detailPane.current && detail) { const pending=previewCommit.current;detailPane.current.scrollTop=pending?.id===detail.id?pending.top:libraryState.positions[detail.id]||0;previewCommit.current=undefined; } }, [kind, detail?.id, !!library.hover,library.navigationKey]);

  function sendCharacter(before:Character,after:Character,target=wb.target){
    if(!inWorkbench)return Promise.resolve();const id=after.id;
    workbenchDirty.current.add(id);workbenchPending.current.set(id,(workbenchPending.current.get(id)||0)+1);
    return Promise.resolve(patchWorkbenchStats(before,after,evaluate(before),evaluate(after),target)).then(()=>{workbenchFailed.current.delete(id);}).catch(e=>{workbenchFailed.current.add(id);if(e?.uncertain&&!e?.queueBlocked){const old=workbenchUncertain.current.get(id);workbenchUncertain.current.set(id,{requestId:e.requestId,before:old?.before||before,after:old&&old.after.revision>after.revision?old.after:after});}void saveRecovery(after).catch(()=>{});setSyncDiagnostic(diagnosticText(e));setNotice(`同步失败，已保留本地备份：${e instanceof Error?e.message:String(e)}`);throw e;}).finally(()=>{const pending=Math.max(0,(workbenchPending.current.get(id)||1)-1);workbenchPending.current.set(id,pending);if(!pending&&!workbenchUncertain.current.has(id))workbenchDirty.current.delete(id);appliedWorkbench.current='';setHistoryTick(x=>x+1);});
  }
  function rememberCharacter(before:Character,after:Character){const target=wb.target;
    const restore=async(from:Character,to:Character)=>{const w=workspaceRef.current!;const live=w.characters.find(c=>c.id===before.id);if(!live)throw Error('角色已经删除');const canonical=(value:Character)=>{const result=structuredClone(value);for(const row of result.selections)delete row.entry.raw._suiteStatusId;return result;};const normalize=(value:Character)=>canonical(localSources?withSiteSources(value,w.siteSources,w.packs):value);const restored=applyPatch(normalize(live),normalize(from),normalize(to)) as Character;for(const row of restored.selections){const previous=live.selections.find(s=>s.id===row.id);if(previous?.entry.raw._suiteStatusId)row.entry.raw._suiteStatusId=previous.entry.raw._suiteStatusId;}restored.revision=live.revision+1;restored.updatedAt=new Date().toISOString();persist({...w,characters:w.characters.map(c=>c.id===restored.id?restored:c)});await sendCharacter(live,restored,target);};
    recordAction({label:after.name,undo:()=>restore(after,before),redo:()=>restore(before,after)});
  }
  const edit: Edit = (action, key) => {
    if (!writable.current) { setNotice('此标签页为只读。关闭另一编辑页并刷新后可继续。'); return; }
    const current = workspaceRef.current; if (!current) return;
    const character = current.characters.find(x => x.id === current.activeId)!;
    if(workbenchUncertain.current.has(character.id)){setNotice('上一项修改的结果尚未确认，本地修改已保留。请先核对枭熊数据。');return;}
    if(inWorkbench&&character.id.startsWith('suite:')&&(!wb.online||!wb.target?.write||workbenchCharacterId(wb.target)!==character.id)){setNotice('当前棋子不可编辑或已经切换');return;}
    const record = history.current.get(character.id) || { past: [], future: [], time: 0 };
    if (!key || record.key !== key || Date.now() - record.time > 900) record.past = [...record.past.slice(-59), character];
    record.future = []; record.key = key; record.time = Date.now(); history.current.set(character.id, record);
    const effective=inWorkbench&&roomRules?{...character,edition:roomRules.edition,profile:roomProfile!,rulePacks:roomRules.packs}:localSources?withSiteSources(character,current.siteSources,current.packs):character;
    const draft = structuredClone(effective); hydrateImportedCasting(draft,allEntries); action(draft); syncFeatures(draft, allEntries); syncAutoResources(draft,effective); if (draft.quickbar) draft.quickbar = draft.quickbar.filter(id => draft.selections.some(s => s.id === id)); if(sameValue(effective,draft))return; draft.updatedAt = new Date().toISOString(); draft.revision++;
    persist({ ...current, characters: current.characters.map(x => x.id === draft.id ? draft : x) });
    rememberCharacter(character,draft);void sendCharacter(character,draft).catch(()=>{});setHistoryTick(x=>x+1);
  };
  async function changeCustom(entry:Entry,remove=false){
    const next=customEntries.filter(e=>e.id!==entry.id);if(!remove)next.push(entry);
    if(inWorkbench){if(rulesReadonly||!wb.shared)throw Error('仅 DM 可编辑自定义资料');setRulesBusy(true);try{await workbenchRequest('rules',{key:undefined,itemId:undefined,scopeKey:wb.shared.key,expected:wb.shared.revision,rules:{...wb.shared.rules,customEntries:next,profile:{...wb.shared.rules.profile,enabledSources:[...new Set([...wb.shared.rules.profile.enabledSources,'CUSTOM'])]}}});}finally{setRulesBusy(false);}}
    else {const w=workspaceRef.current!;if(localSources&&w.siteSources)persist({...w,customEntries:next,siteSources:{...w.siteSources,enabledSources:[...new Set([...w.siteSources.enabledSources,'CUSTOM'])]}});else persist({...w,customEntries:next,characters:w.characters.map(row=>row.id===w.activeId?{...row,profile:{...row.profile,enabledSources:[...new Set([...row.profile.enabledSources,'CUSTOM'])]}}:row)});}
    if(remove)setDetail(undefined);else library.navigate(entry);
  }
  async function editSources(action:(draft:Character)=>void,sourceMode?:'full'|'short'|'both'){
    if(!localSources)return editRules(action,sourceMode);
    const current=workspaceRef.current;if(!current?.siteSources||!writable.current)return false;
    const selected=current.characters.find(row=>row.id===current.activeId)!;
    const draft=structuredClone(withSiteSources(selected,current.siteSources,current.packs));
    action(draft);validateCharacter(draft);
    const before={siteSources:current.siteSources,packs:current.packs},after={siteSources:sourceSettings(draft.profile),packs:draft.rulePacks||current.packs};
    if(!sameValue(before,after)){
      const restore=(from:typeof before,to:typeof after)=>{const latest=workspaceRef.current!;if(!writable.current)throw Error('此标签页为只读');const patch=applyPatch({siteSources:latest.siteSources,packs:latest.packs},from,to) as typeof after;persist({...latest,...patch});};
      restore(before,after);recordAction({label:'网站资料来源',undo:()=>restore(after,before),redo:()=>restore(before,after)});
    }
    if(sourceMode)sourceDisplay.setMode(sourceMode);return true;
  }
  async function editRules(action:(draft:Character)=>void,sourceMode?:'full'|'short'|'both'){
    if(!inWorkbench){edit(action);if(sourceMode)sourceDisplay.setMode(sourceMode);return true;}
    if(rulesReadonly||!wb.shared||!c)return false;
    const draft=structuredClone(c);action(draft);setRulesBusy(true);
    const rules={...wb.shared.rules,edition:draft.edition,profile:draft.profile,packs:draft.rulePacks||[],sourceMode:sourceMode||wb.shared.rules.sourceMode};
    setRulesDraft({key:wb.shared.key,rules});
    try{await workbenchRequest('rules',{key:undefined,itemId:undefined,scopeKey:wb.shared.key,expected:wb.shared.revision,rules});return true;}catch(e){setNotice(String(e));return false;}finally{setRulesDraft(undefined);setRulesBusy(false);}
  }
  useEffect(() => {
    if (!c || !workspace || !writable.current || inWorkbench) return;
    const draft = structuredClone(c);
    const castingChanged=hydrateImportedCasting(draft,allEntries);
    const featuresChanged=syncFeatures(draft, allEntries),resourcesChanged=syncAutoResources(draft);
    if (featuresChanged || resourcesChanged || castingChanged) { draft.revision++; draft.updatedAt = new Date().toISOString(); persist({ ...workspace, characters: workspace.characters.map(row => row.id === draft.id ? draft : row) }); }
  }, [c, allEntries]);
  function undo(redo=false){void travelHistory(redo);}

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA'].includes(t.tagName)) { e.preventDefault(); undo(e.shiftKey); }
    }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, []);
  function readingTarget(entry:Entry){
    if(entry.raw._inlineOwner){const owner=libraryEntries.find(e=>e.id===entry.raw._inlineOwner);if(owner)return {entry:owner,focus:`name:${entry.raw._inlineName||entry.name}`};}
    const selected=c?.selections.find(s=>s.entry.id===entry.id),parent=selected?.parentId?c?.selections.find(s=>s.id===selected.parentId):undefined;
    if(parent && selected?.grantKey?.startsWith('inline:'))return {entry:libraryEntries.find(e=>e.id===parent.entry.id)||parent.entry,focus:`name:${entry.name}`};
    if(entry.kind==='feature' && entry.raw.subclassShortName){const subclass=libraryEntries.find(e=>ownsSubclassFeature(e,entry));if(subclass)return {entry:subclass,focus:entry.id};}
    if(entry.kind==='feature' && entry.raw._category!=='itemMastery'){
      const owner=libraryEntries.find(e=>e.kind==='class' && (entry.raw.className ? [e.name,e.english].includes(entry.raw.className) && (entry.raw.classSource||'PHB').toUpperCase()===e.source : e.edition===entry.edition && e.raw.optionalfeatureProgression?.some((p:any)=>p.featureType?.some((t:string)=>entry.raw.featureType?.includes(t)))));
      if(owner)return {entry:owner,focus:entry.id};
    }
    return {entry};
  }
  function inspect(entry: Entry, push = true) { exitSheetFullscreen(); if(detail && !library.hover && detailPane.current)library.savePosition(detail.id,detailPane.current.scrollTop);const target=readingTarget(entry);if(library.hover){previewCommit.current={id:target.entry.id,top:detailPane.current?.scrollTop||0};setReadingFlash(n=>n+1);}else setReadingFlash(0);library.navigate(target.entry,target.focus,push);setTab('wiki'); }
  useEffect(()=>{const open=(event:Event)=>{const entry=(event as CustomEvent<Entry>).detail;if(entry?.id&&entry?.name&&entry?.kind){setTableOpen(false);inspect(allEntries.find(e=>e.id===entry.id)||(entry.id.startsWith('resource:')?allEntries.find(e=>e.name===entry.name):undefined)||entry);}};window.addEventListener('workbench-open-entry',open);return()=>window.removeEventListener('workbench-open-entry',open);});
  function resolveReference(reference: string, tag?: string) {
    if (reference.startsWith('entry:')) return c?.selections.find(s => s.entry.id === reference.slice(6)&&librarySourceEnabled(c,s.entry))?.entry || libraryEntries.find(e => e.id === reference.slice(6));
    const [name, source] = reference.split('|');
    const tagKind = ['quickref', 'variantrule', 'action', 'skill', 'sense', 'language', 'itemProperty', 'itemType', 'table', 'deity', 'facility'].includes(tag || '') ? 'rule' : ['optfeature', 'itemMastery', 'reward', 'charoption', 'psionic'].includes(tag || '') ? 'feature' : ['status', 'disease'].includes(tag || '') ? 'condition' : tag==='creature'?'monster':tag;
    const known = [...libraryEntries, ...(c?.selections.filter(s=>librarySourceEnabled(c,s.entry)).map(s => s.entry) || [])];
    if(tag==='class'){
      const parts=reference.split('|'),sub=parts[3],subSource=parts[4]||source||'PHB';
      if(sub){const target=known.find(e=>e.kind==='subclass'&&e.source.toLowerCase()===subSource.toLowerCase()&&[e.name,e.english,e.raw.shortName,e.raw.ENG_shortName].some(n=>typeof n==='string'&&n.toLowerCase()===sub.toLowerCase())&&(e.raw.classSource||'PHB').toLowerCase()===(source||'PHB').toLowerCase()&&[e.raw.className,e.raw.classEnglish].some(n=>typeof n==='string'&&n.toLowerCase()===name.toLowerCase()));if(target)return target;}
    }
    const matches = known.filter(e => (!tagKind || e.kind === tagKind) && [e.name, e.english].some(n => n.toLowerCase() === name.toLowerCase()));
    const found = tagKind === 'feature' ? matches.find(e => !requirementMismatch(e, { refs: [reference] })) : source ? matches.find(e => e.source.toLowerCase() === source.toLowerCase()) : matches.find(e => e.edition === detail?.edition && e.source === (detail?.source || 'PHB')) || matches.find(e => e.source === 'PHB') || matches[0];
    return found;
  }
  function link(reference: string, tag?: string) {
    exitSheetFullscreen();
    const found = resolveReference(reference, tag);
    const name = reference.split('|')[0];
    const tagKind = ['quickref', 'variantrule', 'action', 'skill', 'sense', 'language', 'itemProperty', 'itemType', 'table', 'deity', 'facility'].includes(tag || '') ? 'rule' : ['optfeature', 'itemMastery', 'reward', 'charoption', 'psionic'].includes(tag || '') ? 'feature' : ['status', 'disease'].includes(tag || '') ? 'condition' : tag==='creature'?'monster':tag;
    if (found) inspect(found); else { setQuery(name); if (tagKind && Object.hasOwn(KIND_LABELS, tagKind)) setKind(tagKind as Kind); setDetail(undefined); setNotice(`已搜索「${name}」。若未收录，可开启其他来源或在中文站查阅。`); }
  }
  function browse(kind: Kind | 'size') { exitSheetFullscreen(); setFillPulse(n=>n+1);setKind(kind); if (kind === 'subclass') { const owner = c?.selections.find(s => s.entry.kind === 'class'); if (owner) library.navigate(allEntries.find(e => e.id === owner.entry.id) || owner.entry,'subclasses'); } setTab('wiki'); }
  function add(entry: Entry, pin = false, section?: Selection['section']) {
    if (!c) return;
    if(pin){edit(draft=>pinEntry(draft,entry));return;}
    if (entry.raw._category === 'size') { edit(draft => { draft.size = entry.raw.size; }); return; }

    const reason = candidateReason(c, entry); if (reason) { setNotice(reason); return; }
    edit(draft => {
      const existing=entry.kind==='class'?draft.selections.find(s=>s.entry.id===entry.id):undefined;
      if(existing){existing.level+=1;return;}
      if (['race', 'background'].includes(entry.kind)) for (const old of draft.selections.filter(s => s.entry.kind === entry.kind)) removeSelection(draft, old.id);
      if (entry.kind === 'race') draft.size = 'M';
      const parent=entry.kind==='subclass'?subclassOwner(draft,entry):undefined;
      if(parent)for(const old of draft.selections.filter(s=>s.entry.kind==='subclass'&&subclassOwner(draft,s.entry)?.id===parent.id))removeSelection(draft,old.id);
      const selectionId = uid(); draft.selections.push({ parentId:parent?.id,id: selectionId, entry: structuredClone(entry), quantity: 1, level: 1, equipped: false, section });
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
  async function importFile(mode: string, file?: File, text?: string) {
    setImportError('');
    try {
      const selected = text===undefined ? file || await pickFile() : undefined; if (text===undefined && !selected) return;
      const value = parseFile(text ?? await selected!.text()); const w = workspaceRef.current; if (!w) return;
      if (mode === 'pack') {
        const pack = validatePack(value, activePacks);
        {if(!await editSources(draft=>{draft.rulePacks=[...activePacks.filter(p=>p.id!==pack.id),pack];draft.profile.enabledSources=[...new Set([...draft.profile.enabledSources,pack.id])];}))return;}
        setNotice(`已安装「${pack.name}」${pack.version}；旧角色已选条目仍保留原快照。`);
      } else if (mode === 'profile') {
        const template = newCharacter(); template.profile = (value as { profile?: Character['profile'] })?.profile || value as Character['profile'];
        validateCharacter(template); editRules(d => { d.profile = template.profile; }); setNotice('规则配置已应用，可撤销。');
      } else {
        const character = mode === 'owlbear' ? importOwlbear(value) : validateCharacter(value);
        hydrateImportedCasting(character,allEntries);
        character.id = uid(); character.revision = 1; character.name += '（导入）';
        const effective=inWorkbench&&roomRules?{...character,edition:roomRules.edition,profile:roomProfile!,rulePacks:roomRules.packs}:withSiteSources(character,w.siteSources,w.packs);
        const review=reviewImport(character,effective,c?.edition||character.edition);
        if(review.editionMismatch||review.disabled.length){setPendingImport({card:character,review});setModal('importReview');return;}
        await finishImport(character);
      }
    } catch (error) { setImportError(error instanceof Error ? error.message : String(error)); }
  }
  async function finishImport(character:Character){
    if(inWorkbench)await createRemoteCard(character);else{const w=workspaceRef.current!;persist({...w,characters:[...w.characters,character],activeId:character.id});setModal('export');}
    setPendingImport(undefined);setNotice(inWorkbench?'角色已导入枭熊角色簿。':'角色已作为新副本导入。');
  }
  async function createRemoteCard(card:Character){
    if(!wb.online)throw Error('枭熊未连接，角色尚未导入。');
    if(remoteCreatePending.current)throw Error('正在创建角色，请等待当前操作完成。');
    remoteCreatePending.current=true;setCreatingCard(true);
    try{const data={...exportOwlbear(card,evaluate(card)),dnd_card_web:card};const result=await workbenchRequest('createCard',{key:undefined,itemId:undefined,data});chooseWorkbench(`card:${result.created.id}`);setModal('');setWorkbenchPage('sheet');setSheetPage('主要');setTab('sheet');}finally{remoteCreatePending.current=false;setCreatingCard(false);}
  }
  async function createRemote(edition:Edition){
    if(creatingCard||!wb.online)return;
    try{const card=newCharacter(edition);if(roomRules){card.profile=structuredClone(roomRules.profile);card.rulePacks=structuredClone(roomRules.packs);}await createRemoteCard(card);}catch(e){setNotice(String(e));}
  }
  function create(edition: Edition, copy = false) {
    if (!workspace || !c) return; const next = copy ? structuredClone(c) : createLocalCharacter(edition); next.id = uid(); next.name = copy ? `${c.name}（副本）` : next.name; next.createdAt = next.updatedAt = new Date().toISOString(); next.revision = 1;
    persist({ ...workspace, characters: [...workspace.characters, next], activeId: next.id }); setModal(''); setSheetPage('主要'); setTab('sheet');
  }
  const renderSelection = (s: Selection) => <Selected key={s.id} s={s} c={c!} edit={edit} inspect={inspect}/>;
  const selections = (kinds: Kind[]) => c?.selections.filter(s => kinds.includes(s.entry.kind)).map(renderSelection);
  const addButton = (kind: Kind) => <button className="sheet-add" onClick={() => browse(kind)}>＋ 查阅{KIND_LABELS[kind]}</button>;


  if (!workspace || !c || !d) return <main className="startup"><h1>{standalone?'DND 角色卡':'Full Suite'}</h1>{startupError ? <><p role="alert">本机记录读取失败：{startupError}</p><p>现有记录尚未覆盖。可以尝试恢复上一次保存。</p><button onClick={async () => { try { const backup = await restoreBackup(); if (!backup) throw new Error('没有可用备份'); acceptWorkspace(backup); } catch (e) { setStartupError(String(e)); } }}>读取备份</button><button onClick={() => { const next = createLocalCharacter(); workspaceRef.current = { schemaVersion: 1, characters: [next], activeId: next.id, packs: [] }; setWorkspace(workspaceRef.current); setNotice('临时工作区。第一次编辑将保存新记录；请先导出重要数据。'); }}>使用新的临时工作区</button></> : <p>正在打开你的角色卡…</p>}</main>;
  void historyTick;
  const blocked = detail ? candidateReason(c, detail) : '';
  return <KeywordPreview isExcluded={entry=>explicitlyExcluded(c,entry)} resolve={resolveReference} open={link} sheetPreview={entry=>library.preview(entry&&librarySourceEnabled(c,entry)?readingTarget(entry):undefined)} sheetCommit={entry=>inspect(entry)}><EntryDragProvider editing={editing&&(!inWorkbench||!!wb.target?.write)} character={c} receive={entry => add(entry)}><div className="app-shell compact-layout" data-workbench-page={inWorkbench?workbenchPage:undefined} onDragStart={event => event.preventDefault()}>
    <header className="app-header"><a className="brand" href="#" onClick={e => { e.preventDefault();setTab('sheet');if(inWorkbench)setWorkbenchPage('console'); }}><img className="brand-logo" src="./exe_icon.png" alt=""/><strong>{standalone?'DND 角色卡':'Full Suite'}</strong></a>
      <div className="header-tools">{inWorkbench&&wb.enabled.threeDragonAnte!==false&&<button aria-pressed={tableOpen} onClick={()=>{setTableOpen(value=>!value);setTab('wiki');}}>三龙牌</button>}{inWorkbench&&<button aria-pressed={workbenchPage==='features'} onClick={()=>{setWorkbenchPage('features');setTab('sheet');}}>功能开关</button>}{inWorkbench&&<button aria-pressed={workbenchPage==='settings'} onClick={()=>{setWorkbenchPage('settings');setTab('sheet');}}>设置</button>}{standalone&&<button onClick={()=>setAnnouncement(true)}>公告</button>}<button onClick={() => setModal('characters')}>角色簿 <span>{inWorkbench?wb.cards.length:workspace.characters.length}</span></button><button onClick={() => setModal('rules')}>规则与扩展</button><button className="primary" onClick={() => setModal('export')}>导入 / 导出</button></div>
    </header>
    {inWorkbench&&<><WorkbenchBar online={wb.online} target={wb.target} message={wb.message} page={workbenchPage} change={page=>{setWorkbenchPage(page);setTab('sheet');}} save={()=>{if(!wb.target||c.id!==workbenchCharacterId(wb.target)){setNotice('当前角色与选中的棋子不一致');return;}void workbenchRequest('save',{native:c,data:exportOwlbear(c,d)}).then(()=>{workbenchDirty.current.delete(c.id);setNotice('已保存角色资料到枭熊');}).catch(e=>setNotice(String(e)));}}/></>}
    {readOnly && <div className="read-only-banner" role="status">另一标签页正在编辑，此页仅供查阅和导出。关闭另一页后将自动读取最新记录并接手。<button onClick={() => location.reload()}>重新检查</button></div>}
    {activateUpdate && <div className="read-only-banner" role="status">网页有新版本。<button onClick={async () => { await queue.current; if (saveFailed.current) { setNotice('保存未成功，请先导出角色备份，再重新打开网页。'); return; } navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); activateUpdate(); }}>保存后更新</button></div>}
    <nav className="mobile-tabs" aria-label="工作区"><button className={tab === 'sheet' ? 'active' : ''} onClick={() => setTab('sheet')}>功能页</button><button className={tab === 'wiki' ? 'active' : ''} onClick={() => setTab('wiki')} hidden={!wikiVisible&&!tableOpen}>{tableOpen?'三龙牌':'Wiki'}</button></nav>
    <main className={`workspace ${wikiVisible||tableOpen?'':'wiki-hidden'}`}>
      <section data-inventory-recipient={inWorkbench&&workbenchPage==='sheet'&&wb.target?wb.target.cardId?`card:${wb.target.cardId}`:`monster:${wb.target.itemId}`:undefined} className={`sheet-pane ${tab === 'sheet' ? 'mobile-active' : ''}`} aria-label="角色卡工作区">
        {inWorkbench&&workbenchPage==='music'?<MusicWorkspace close={()=>setWorkbenchPage('console')}/>:inWorkbench&&['settings','features'].includes(workbenchPage)?<WorkbenchPanel key={workbenchPage} panel="settings" section={workbenchPage==='features'?'features':undefined} close={()=>setWorkbenchPage('console')}/>:inWorkbench&&workbenchPage==='notes'&&wb.role==='GM'?<DmNotes/>:inWorkbench&&workbenchPage==='dice'?<DicePage online={wb.online} target={wb.target} rolls={wb.rolls} compose={wb.compose}/>:inWorkbench&&workbenchPage==='console'?<DMConsole navigate={setWorkbenchPage}/>:inWorkbench&&(!wb.target||wb.target.kind==='character'&&!wb.document)?<div className="workbench-monster"><p role="status">{wb.loading?'读取角色资料…':'从上方选择角色卡'}</p></div>:inWorkbench&&(wb.target?.kind==='monster'||wb.target?.kind==='token')?<WorkbenchMonster key={wb.target.key} target={wb.target} raw={wb.document} online={wb.online} onLink={link}/>:<>
        <div className="pane-toolbar"><div><span className="eyebrow">角色卡</span><div className="character-tabs" role="tablist" aria-label="当前角色">{!inWorkbench&&workspace.characters.map(x=><button key={x.id} role="tab" aria-selected={x.id===c.id} onClick={()=>persist({...workspace,activeId:x.id})}>{x.name}</button>)}</div></div>
          <div className="toolbar-actions">{inWorkbench&&(workbenchUncertain.current.has(c.id)||workbenchFailed.current.has(c.id))&&<button className="sync-review-button" onClick={()=>setModal('syncReview')}>同步核对</button>}{editing&&<button onClick={()=>setModal('personal')}>条目 / 等级</button>}{editing && <button className="adjust-shortcut" aria-label="数值依据与人工修正" onClick={() => setModal('adjust')}>修正</button>}<SheetFullscreenButton/><button aria-label="撤销" disabled={!actionHistory.undo} onClick={() => undo()}>↶</button><button aria-label="重做" disabled={!actionHistory.redo} onClick={() => undo(true)}>↷</button><span className="paper-size">A4 · 适应窗口</span></div>
        </div>
        <SheetEditContext.Provider value={editing&&(!inWorkbench||!!wb.target?.write)}><PaperFrame character={c} page={sheetPage} changePage={page => { setSheetPage(page); setTab('sheet'); }}>
          <div className="paper-heading"><span>DUNGEONS &amp; DRAGONS</span><span className="paper-heading-right">{c.edition}{editing&&<Palette c={c} edit={edit}/>}<button className="card-lock" aria-label={c.locked?'解锁角色卡':'上锁角色卡'} aria-pressed={!!c.locked} disabled={inWorkbench&&(!wb.online||!wb.target?.write)} onClick={()=>{if(inWorkbench)void workbenchRequest('lock',{locked:!c.locked}).catch(e=>setNotice(String(e)));else edit(draft=>{draft.locked=!draft.locked;});}}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="10" width="14" height="11" rx="1"/><path d={c.locked?'M8 10V6a4 4 0 018 0v4':'M8 10V6a4 4 0 018 0'}/><path d="M12 14v3"/></svg></button><button disabled={inWorkbench&&!wb.target?.write} className="edit-mode-toggle" role="switch" aria-checked={editing} aria-label="编辑模式" onClick={() => setEditing(v => !v)}><span className="edit-switch-track"><i/></span>编辑模式</button></span></div>
          {sheetPage === '主要' ? <><Overview catalog={allEntries} statusRibbon={<div className="edition-divider"><span/><strong>DND 五版角色卡</strong><FeaturePanel inline grouped={false} label="状态" kinds={['condition']} c={c} rows={c.selections.filter(s => s.entry.kind === 'condition')} edit={edit} browse={() => browse('condition')} onLink={link} receive={entry => add(entry)}/><span/></div>} addEntry={(entry, section) => add(entry, false, section)} onLink={link} c={c} d={d} edit={edit} browse={browse} inspect={inspect} renderSelection={renderSelection} openResources={() => setModal('resources')} openQuickbar={()=>setModal('quickbar')} openHp={()=>setModal('hp')} pinDrop={entry => add(entry, true)}/>
</> : <div className="sheet-details">
          <div className="edition-divider"><span/><strong>DND 五版角色卡</strong><FeaturePanel inline grouped={false} label="状态" kinds={['condition']} c={c} rows={c.selections.filter(s => s.entry.kind === 'condition')} edit={edit} browse={() => browse('condition')} onLink={link} receive={entry => add(entry)}/><span/></div>
          <DetailHeader openSpellAbility={()=>setModal('spellAbility')} page={sheetPage} c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>
          {sheetPage==='特性'?<FeaturesPage c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>:sheetPage==='背景'?<BackgroundPage c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>:sheetPage==='法术'?<SpellsPage entries={allEntries} c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>:inWorkbench?<WorkbenchInventory id={`card:${wb.target!.cardId}`} capacity={<CarryCapacity c={c} d={d} edit={edit}/>}/>:<InventoryPage c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>}
        </div>}
          <footer className="paper-footer"><span>{c.edition} · {d.level || '—'} 级 · 修订 {c.revision}</span><span>资料快照随角色保存</span></footer>
        </PaperFrame></SheetEditContext.Provider><div className={`save-status ${saving === '保存失败' ? 'error' : ''}`} role="status"><span className="status-dot"/>{inWorkbench?(workbenchUncertain.current.has(c.id)?'待核对 · 本地修改已保留':workbenchDirty.current.has(c.id)?'正在同步至枭熊…':workbenchFailed.current.has(c.id)?'同步失败 · 已保留本地备份':wb.target?.projectionPending?'资料已保存 · 棋子显示待同步':wb.online?'与枭熊同步':'等待枭熊重连'):saving}{workbenchUncertain.current.has(c.id)&&wb.document&&<button onClick={()=>{window.dispatchEvent(new CustomEvent('workbench-operation-reconciled',{detail:{requestId:workbenchUncertain.current.get(c.id)?.requestId}}));workbenchUncertain.current.delete(c.id);workbenchDirty.current.delete(c.id);workbenchFailed.current.delete(c.id);workbenchDocuments.current.delete(c.id);appliedWorkbench.current='';setHistoryTick(n=>n+1);setNotice('已采用枭熊当前数据；未确认的本地修改仍保留在恢复备份中。');}}>核对并采用枭熊数据</button>}{syncDiagnostic&&<CopyDiagnostic text={syncDiagnostic}/>}<span>{inWorkbench?'角色资料自动保存':'资料与角色保存在当前浏览器 · 请定期导出'}</span></div></>}
      </section>

      {tableOpen?<><WorkspaceSplitter/><section className={`wiki-pane table-pane ${tab==='wiki'?'mobile-active':''}`} aria-label="三龙牌"><WorkbenchPanel panel="table" close={()=>setTableOpen(false)}/></section></>:wikiVisible&&<><WorkspaceSplitter/><section className={`wiki-pane ${tab === 'wiki' ? 'mobile-active' : ''}`} aria-label="规则资料"><WikiLayout><div className="wiki-header"><div><span className="eyebrow">规则资料</span><span className="wiki-source">5etools 中文站</span></div><button title="重新检查上游资料" disabled={loading} onClick={() => load(true)}>{loading ? '加载中…' : '更新资料'}</button></div>
        <GlobalSearch query={query} change={setQuery} entries={libraryEntries} c={c} inspect={inspect}/>
        <nav className="category-tabs" aria-label="资料分类">{Object.entries(LIBRARY_TABS).filter(([key])=>(key!=='custom'||canAuthor)&&(key!=='monster'||monstersVisible)&&(key!=='weaponMastery'||c.edition==='2024'||editionFilter==='2024'||editionFilter==='all')).map(([key, label]) => <button key={key} className={kind === key ? 'active' : ''} onClick={() => setKind(key as keyof typeof LIBRARY_TABS)}>{label}</button>)}</nav>
        <div className="wiki-filters"><input className="category-search" type="search" aria-label={`${LIBRARY_TABS[kind]}分类搜索`} placeholder={`搜索${LIBRARY_TABS[kind]}`} value={categoryQuery} onChange={e=>library.patch({query:e.target.value})}/><select aria-label="资料版本" value={editionFilter} onChange={e => setEditionFilter(e.target.value)}><option value="character">跟随角色 · {c.edition}</option><option value="2014">2014 规则</option><option value="2024">2024 规则</option><option value="all">所有版本</option></select><LibraryFilters tab={kind} entries={categoryEntries} filters={filters} change={filters => library.patch({ filters })} names={bookNames}/>
        </div>
        <div className="catalog-status"><span>{loading ? `${progress.done}/${progress.total} 份资料` : `${libraryEntries.length.toLocaleString()} 条资料`}{progress.cached > 0 ? ` · ${progress.cached} 份缓存` : ''}</span><span>{filtered.length} 条符合筛选</span></div>
        {progress.failed.length > 0 && <details className="load-errors"><summary>{progress.failed.length} 份资料读取异常 · 可重试</summary>{progress.failed.map((e, i) => <p key={i}>{e}</p>)}<button disabled={loading} onClick={() => load(true)}>重试加载</button></details>}
        <div className={`library-body ${detail ? 'has-detail' : ''}`}><CatalogList entries={filtered} columns={columns} kind={kind} character={c} selected={detail} inspect={inspect} sort={sort} descending={descending} onSort={key=>library.patch({sort:key,descending:sort===key?!descending:false})} resetKey={JSON.stringify([kind,filters,editionFilter,sort,descending,categoryQuery])} loading={loading} onSettings={()=>setModal('rules')} pulse={fillPulse}/>
        <WikiSplitter/>{kind==='custom'&&canAuthor&&<><CustomEntryEditor newEntry={()=>setDetail(undefined)} entry={detail?.raw._workbenchCustom?detail:undefined} busy={rulesBusy} save={entry=>changeCustom(entry)} remove={entry=>changeCustom(entry,true)}/></>}
        {detail && !(kind==='custom'&&canAuthor) && <article key={`${detail.kind}:${detail.id}`} className={`entry-detail ${explicitlyExcluded(c,detail)?'entry-disabled':''} ${library.hover?'is-sheet-preview':readingFlash?'sheet-preview-committed':''} ${library.focus?'has-reading-focus':''}`} data-described-entry={detail.id} data-entry-kind={detail.kind} ref={detailPane} onScroll={e => { if(!library.hover)library.savePosition(detail.id, e.currentTarget.scrollTop); }}><div className="detail-frozen"><div className="detail-navigation"><button disabled={!library.canGoBack} onClick={library.back}>← 上一条</button><button aria-label="收起正文" onClick={() => { setDetail(undefined); }}>×</button></div><div className="detail-heading">{detail.kind==='monster'&&<MonsterPortrait entry={detail}/>}<EntryBadges entry={detail}/><span className="eyebrow">{KIND_LABELS[detail.kind]} · {entryEdition(detail) === 'both' ? '通用资料' : entryEdition(detail)}</span><h1><EntryDraggable className="detail-title" entry={detail} >{entryLabel(detail)}{detail.english !== detail.name && <small className="english-name"> {detail.english}</small>}</EntryDraggable></h1><small>{detail.raw._authoredBy ? `${detail.raw._authoredBy} · ` : ''}<SourceName id={detail.source}/>{detail.page ? ` · 第 ${detail.page} 页` : ''}</small></div><ClassNavigation subclassesOpen={!!libraryState.subclassesOpen} onToggleSubclasses={()=>library.patch({subclassesOpen:!libraryState.subclassesOpen})} entry={detail} entries={libraryEntries} character={c} navigate={(entry,focus)=>library.navigate(entry,focus)}/></div>
          {detail.kind==='monster'?<ContentBoundary key={detail.id}><MonsterDocument entry={detail} onLink={link}/></ContentBoundary>:<><ContentBoundary key={`facts:${detail.id}`}><EntryFacts entry={detail} onLink={link}/></ContentBoundary>
          <LibraryDocument subclassesOpen={!!libraryState.subclassesOpen} preview={!!library.hover} highlight={readingFlash} focus={library.focus} character={c} entry={detail} entries={allEntries} onLink={link} inspect={inspect} collapsed={libraryState.collapsed[detail.id] || []} onCollapse={ids => library.patch({ focus:undefined, collapsed: { ...libraryState.collapsed, [detail.id]: ids } })}/></>}

          <RawDetails key={detail.id} entry={detail}/>
          <div className="detail-actions">{blocked && <p className="inline-warning">{blocked}</p>}<a href={DEFAULT_SOURCE} target="_blank" rel="noreferrer">在中文站查阅 ↗</a>
          {blocked === '此来源或规则版本未启用' && <details><summary>记录 DM 特许</summary><p>仅对此条目启用；会随角色及审卡导出保留。</p><input aria-label="DM 特许说明" value={exception} placeholder="填写原因或 DM 的裁定" onChange={e => setException(e.target.value)}/><button disabled={rulesReadonly||!exception.trim()} onClick={() => editRules(draft => { draft.profile.exceptions[detail.id] = exception.trim(); })}>保存特许</button></details>}
          {c.profile.exceptions[detail.id] && <p>DM 特许：{c.profile.exceptions[detail.id]} <button disabled={rulesReadonly} onClick={() => editRules(draft => { delete draft.profile.exceptions[detail.id]; })}>撤回</button></p>}</div>
        </article>}{!detail && kind!=='custom' && <div className="reading-placeholder"><WikiEmptyPrompt/></div>}</div></WikiLayout>
        <footer className="wiki-footer">{inWorkbench&&<a href="https://obr.dnd.center/card/" target="_blank" rel="noreferrer">单机版 ↗</a>}<a href={inWorkbench?'./source.zip':'https://github.com/FullPeople/DND-card-web'} target="_blank" rel="noreferrer">源码 ↗</a><a href="https://github.com/FullPeople/DND-card-web/blob/main/LICENSE" target="_blank" rel="noreferrer">非商用共享许可 ↗</a></footer>
      </section></>}
    </main>
    {standalone?<LocalDice/>:<SupporterEffect/>}{standalone&&announcement&&<Announcement close={()=>setAnnouncement(false)}/>}{notice&&<Toast message={notice} details={notice===noticeDiagnostic?.message?noticeDiagnostic.diagnostic:notice.startsWith('同步失败')?syncDiagnostic:undefined} close={()=>setNotice('')}/>}
    {modal && <Dialog title={modal==='spellAbility'?'施法属性':modal==='syncReview'?'核对同步结果':modal==='importReview'?'导入前核对':modal==='personal'?'条目与等级':modal==='hp'?'生命值取值方式':modal === 'characters' ? '角色簿' : modal === 'rules' ? '规则与扩展' : modal === 'export' ? '导入与导出' : modal === 'adjust' ? '数值依据与人工修正' : modal === 'resources' ? '法术位与资源记录' : modal === 'quickbar' ? '整理快捷栏' : '让角色卡带你完成选择'} close={() => { setModal(''); setImportError(''); setConfirmDelete(''); }}>
      {importError && <p className="inline-error" role="alert">导入未生效：{importError}</p>}
      {modal === 'adjust' && <><p className="muted">特殊规则尚未自动适配时，可填写最终数值与原因。修正会覆盖计算值，持续保留到手动撤回，并列入审卡。</p><div className="adjust-form"><label>数值<select aria-label="人工修正目标" value={adjustTarget} onChange={e => setAdjustTarget(e.target.value)}>{[['ac', '护甲等级'], ['hp', '生命值上限'], ['speed', '速度'], ['initiative', '先攻'], ['passive', '被动察觉'], ...Object.entries(SKILLS).map(([key, s]) => [`skill:${key}`, `${s.name}检定`]), ...ABILITIES.map(a => [`save:${a}`, `${ABILITY_LABELS[a]}豁免`])].map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>最终值<NumberInput aria-label="人工修正数值" type="number" min="-9999" max="9999" value={adjustValue} onChange={e => setAdjustValue(clamp(e.target.value, -9999, 9999))}/></label><label className="full-width">原因<input aria-label="人工修正原因" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="例如：DM 允许的护甲修正，或尚未适配的专长"/></label><button disabled={!adjustReason.trim()} onClick={() => { edit(draft => { draft.adjustments = [...(draft.adjustments || []).filter(a => a.target !== adjustTarget), { id: uid(), target: adjustTarget, value: adjustValue, reason: adjustReason.trim() }]; }); setAdjustReason(''); }}>记录修正</button></div>{(c.adjustments || []).map(a => <div className="pack-row" key={a.id}><span><strong>{a.target} → {a.value}</strong><small>{a.reason}</small></span><button onClick={() => edit(draft => { draft.adjustments = draft.adjustments?.filter(x => x.id !== a.id); })}>撤回</button></div>)}<details className="calculation-trace"><summary>展开计算依据</summary>{Object.entries(d.trace).map(([key, items]) => <p key={key}><strong>{choiceLabel(key)}</strong>：{items.join('；')}</p>)}</details></>}
      {modal === 'quickbar' && <QuickbarManager c={c} edit={edit}/>}
      {modal === 'resources' && <><div className="resource-editor-actions"><button onClick={()=>edit(draft=>{if(draft.quickbarLayout)draft.quickbarLayout.hidden=draft.quickbarLayout.hidden.filter(id=>!id.startsWith('resource:'));})}>显示全部资源</button><button onClick={()=>setEditingResource('new')}>＋ 资源</button></div>{editingResource&&<ResourceEditor gm={!inWorkbench||wb.role==='GM'} key={editingResource} value={c.runtime.resources[editingResource]} close={()=>setEditingResource('')} save={async resource=>{edit(draft=>{draft.runtime.resources[editingResource==='new'?crypto.randomUUID():editingResource]=resource;});}} remove={editingResource==='new'?undefined:async()=>{edit(draft=>{delete draft.runtime.resources[editingResource];});}}/>}{Object.entries(c.runtime.resources).filter(([id])=>!isHitDieResource(id)).map(([id,r])=><details className="resource-management-item" key={id}><summary>{r.name||id}<small>{r.current}{!r.unlimited&&` / ${r.max}`}</small></summary><ResourceEditor inline gm={!inWorkbench||wb.role==='GM'} value={r} close={()=>{}} save={async resource=>{edit(draft=>{draft.runtime.resources[id]=resource;});}} remove={r.automatic?undefined:async()=>{edit(draft=>{delete draft.runtime.resources[id];});}}/></details>)}</>}
      {modal==='syncReview'&&<section><p>{workbenchUncertain.current.has(c.id)?'上一项修改尚未得到确认。本地修改已备份，核对期间不会重放未确认的操作。':'本地修改已有恢复备份，可重新读取枭熊保存的结果。'}</p><div className="dialog-actions"><button disabled={!wb.online} onClick={()=>void workbenchRequest('refreshCard',{itemId:wb.target?.cardId?`card:${wb.target.cardId}`:wb.target?.itemId,key:undefined}).then(()=>setNotice('已重新读取枭熊数据。')).catch(e=>{setSyncDiagnostic(diagnosticText(e));setNotice(String(e));})}>重新核对保存结果</button><button onClick={()=>download(`${fileName(c.name)}-本地恢复.json`,exportCharacter(c))}>导出本地修改</button><CopyDiagnostic text={syncDiagnostic||JSON.stringify(workbenchDiagnostics(),null,2)}/></div></section>}
      {modal==='importReview'&&pendingImport&&<section><h3>{pendingImport.card.name}</h3>{pendingImport.review.editionMismatch&&<p>导入角色使用 {pendingImport.card.edition}，当前规则使用 {c.edition}。{pendingImport.review.editionChanged?'房间规则将用于计算此角色。':'导入后保留该角色自己的规则版本。'}</p>}{pendingImport.review.totalLevel!==pendingImport.review.effectiveLevel&&<p role="alert">原卡总等级 {pendingImport.review.totalLevel}，当前启用来源下的计算等级 {pendingImport.review.effectiveLevel}。职业与等级记录会保留。</p>}{pendingImport.review.disabled.length>0&&<><p>以下 {pendingImport.review.disabled.length} 项在当前规则或资料来源中未启用，保留条目但暂停效果：</p><ul className="import-conflicts">{pendingImport.review.disabled.map(s=><li key={s.id}>{s.entry.name} · <SourceName id={s.entry.source}/></li>)}</ul></>}<div className="dialog-actions"><button disabled={creatingCard} onClick={()=>void finishImport(pendingImport.card).catch(e=>setImportError(String(e)))}>保留全部记录并导入</button><button onClick={()=>{setPendingImport(undefined);setModal('export');}}>取消导入</button></div></section>}
      {modal==='personal' &&editing&&<PersonalEntries c={c} edit={edit}/>}
      {modal==='spellAbility'&&<SpellAbilityEditor c={c} edit={edit}/>}
      {modal==='hp'&&editing&&<HitPointEditor c={c} edit={edit}/>}
      {modal === 'characters' && inWorkbench && <><div className="dialog-actions"><button disabled={creatingCard||!wb.online} onClick={()=>void createRemote(c.edition)}>＋ 空白角色卡</button></div><div className="character-list">{wb.cards.map(card=><div key={card.id}><button className="character-title" onClick={()=>{chooseWorkbench(card.itemId);setModal('');}}><strong>{card.name}</strong><small>{card.write?'可编辑':'只读'}{card.inScene?' · 当前场景':''}{card.locked?' · 已上锁':''}</small></button>{card.write&&(confirmDelete===card.id?<span className="delete-confirm">删除共享角色资料，棋子保留。<button onClick={()=>{setConfirmDelete('');void workbenchRequest('delete',{key:undefined,itemId:`card:${card.id}`}).catch(e=>setNotice(String(e)));}}>确认删除</button><button onClick={()=>setConfirmDelete('')}>取消</button></span>:<button disabled={!wb.online} onClick={()=>setConfirmDelete(card.id)}>删除</button>)}</div>)}</div><button onClick={async()=>download('本机恢复记录.json',{recoveries:await loadRecoveries(),legacy:workspace.characters.filter(c=>c.name.endsWith('（未同步备份）'))})}>导出本机恢复记录</button></>}
      {modal === 'characters' && !inWorkbench && <><div className="dialog-actions"><button onClick={() => create('2024')}>＋ 2024 角色</button><button onClick={() => create('2014')}>＋ 2014 角色</button><button onClick={() => create(c.edition, true)}>复制当前角色</button></div><div className="character-list">{workspace.characters.map(character => <div key={character.id}><button className="character-title" onClick={() => { persist({ ...workspace, activeId: character.id }); setModal(''); }}><strong>{character.name}</strong><small>{character.edition} · {character.player || '未填玩家'}{character.id === c.id ? ' · 当前角色' : ''}</small></button>{confirmDelete === character.id ? <span className="delete-confirm">删除后需通过导入恢复。<button onClick={() => { const characters = workspace.characters.filter(x => x.id !== character.id); persist({ ...workspace, characters, activeId: workspace.activeId === character.id ? characters[0].id : workspace.activeId }); setConfirmDelete(''); }}>确认删除</button><button onClick={() => setConfirmDelete('')}>取消</button></span> : <button disabled={workspace.characters.length === 1} onClick={() => setConfirmDelete(character.id)}>删除</button>}</div>)}</div><p className="muted">{localSources?'角色保留各自的版本、选择与撤销记录；资料来源由网站共用。数据保存在本机浏览器。':'不同角色拥有独立的规则配置、选择与撤销记录。数据保存在本机浏览器。'}</p></>}
      {modal === 'rules' && <fieldset className="rules-fieldset" disabled={rulesBusy} aria-busy={rulesBusy}>{inWorkbench&&wb.role!=='GM'?<RoomRulesSummary character={c} entries={allEntries} scope={wb.shared?.scope}/>:<>
        <section className="settings-section"><h3>自定义扩展包</h3><p>以 JSON 声明条目、效果与选择。导入前检查格式、依赖和冲突；更新包不会替换角色内已选的旧快照。</p><div className="dialog-actions"><button disabled={rulesReadonly} onClick={() => importFile('pack')}>导入扩展包</button><button onClick={() => download('我的扩展-示例.json', EXAMPLE_PACK)}>下载编写示例</button></div><input className="file-input" data-testid="pack-file" type="file" accept=".json" aria-label="导入扩展包文件" onChange={e => { if (e.target.files?.[0]) importFile('pack', e.target.files[0]); e.target.value = ''; }}/>{activePacks.map(pack => <div className="pack-row" key={pack.id}><span><strong>{pack.name}</strong><small>{pack.id} · {pack.version} · {pack.entries.length} 条</small></span><button onClick={() => download(`${pack.id}-${pack.version}.json`, exportRulePack(pack))}>导出</button><button disabled={rulesReadonly} onClick={() => { const dependent = activePacks.find(p => p.requires.some(dep => dep.id === pack.id)); if (dependent) { setImportError(`「${dependent.name}」依赖这个包，请先移除依赖方。`); return; } editSources(draft=>{draft.rulePacks=activePacks.filter(p=>p.id!==pack.id);}); setNotice('已移除资料包；角色中的条目快照仍保留。可关闭其来源以暂停效果。'); }}>移除</button></div>)}</section>
        <section className="settings-section"><h3>{inWorkbench?(wb.shared?.scope==='room'?'房间规则':'场景规则'):'当前角色的规则'}</h3><div className="setting-row"><span>基础版本<small>切换会保留所有内容，并标记不兼容条目。</small></span><div className="segmented" role="radiogroup" aria-label="角色规则版本">{(['2014','2024'] as Edition[]).map(v=><button disabled={rulesReadonly} key={v} role="radio" aria-checked={c.edition===v} onClick={()=>editRules(draft=>{draft.edition=v;})}>{v}</button>)}</div></div>{([['feats', '专长规则', '允许选择专长'], ['multiclass', '兼职规则', '允许增加职业；兼职前提需与 DM 核对'], ['legacy', '兼容旧版内容', '允许 2024 角色使用 2014 条目，具体替换关系由 DM 裁定']] as const).map(([key, label, desc]) => <label className="setting-row" key={key}><span>{label}<small>{desc}</small></span><input disabled={rulesReadonly} type="checkbox" checked={c.profile.optional[key]} onChange={e => editRules(draft => { draft.profile.optional[key] = e.target.checked; })}/></label>)}</section>
        <SourceSettings c={c} entries={allEntries} edit={editSources} readOnly={rulesReadonly} changeMode={sourceDisplay.setMode}/>

        {Object.keys(c.profile.exceptions).length > 0 && <section className="settings-section"><h3>DM 特许记录</h3>{Object.entries(c.profile.exceptions).map(([id, reason]) => <p key={id}>{c.selections.find(s => s.entry.id === id)?.entry.name || allEntries.find(e => e.id === id)?.name || id}：{reason}<button disabled={rulesReadonly} onClick={() => editRules(draft => { delete draft.profile.exceptions[id]; })}>撤回</button></p>)}</section>}
      </>}</fieldset>}      {modal === 'export' && <><section className="settings-section"><h3>带走当前角色</h3><div className="export-options"><button onClick={() => exportFile('character')}><strong>角色完整备份 · JSON</strong><span>保存基础输入、条目快照、选择与规则配置，可完整恢复。</span></button><button onClick={() => exportFile('review')}><strong>DM 审卡 · HTML / 打印</strong><span>离线打开即可阅读。包含计算依据、缺项、来源及裁定；浏览器打印可保存 PDF。</span></button>{!standalone&&<button onClick={() => exportFile('owlbear')}><strong>枭熊角色卡 · JSON</strong><span>导出 schema 0.3；复杂效果和未映射内容附带说明。</span></button>}</div></section><section className="settings-section"><h3>导入为新角色</h3><p>{standalone?'导入为本机的新角色副本。':'导入不覆盖已有角色。枭熊文件只迁入可识别的数据，需重新核对规则来源。'}</p><div className="dialog-actions"><button onClick={() => importFile('character')}>导入完整备份</button>{!standalone&&<button onClick={() => importFile('owlbear')}>导入枭熊 JSON</button>}</div><input className="file-input" data-testid="character-file" type="file" accept=".json" aria-label="导入角色备份文件" onChange={e => { if (e.target.files?.[0]) importFile('character', e.target.files[0]); e.target.value = ''; }}/></section>{!standalone&&<section className="settings-section transfer-json"><h3>枭熊 JSON · 复制 / 粘贴</h3><textarea aria-label="枭熊 JSON 文本" value={transferText} onChange={e=>setTransferText(e.target.value)} spellCheck={false}/><div className="dialog-actions"><button onClick={()=>setTransferText(JSON.stringify(exportOwlbear(c,d),null,2))}>生成枭熊 JSON</button><button disabled={!transferText.trim()} onClick={async()=>{try{await navigator.clipboard.writeText(transferText);setNotice('已复制枭熊 JSON');}catch{setImportError('无法访问剪贴板，请选中文本复制。');}}}>复制 JSON</button><button onClick={async()=>{try{setTransferText(await navigator.clipboard.readText());}catch{setImportError('无法读取剪贴板，请在文本框中粘贴。');}}}>粘贴 JSON</button><button disabled={!transferText.trim()} onClick={()=>importFile('owlbear',undefined,transferText)}>从文本导入枭熊</button></div></section>}<section className="settings-section"><h3>当前角色卡页 · PNG / 打印</h3><div className="dialog-actions"><button disabled={imageBusy} onClick={async()=>{setImageBusy(true);setImportError('');try{const blob=await captureSheet();setPng({blob,url:URL.createObjectURL(blob)});}catch(e){setImportError(String(e));}finally{setImageBusy(false);}}}>{imageBusy?'正在生成 PNG…':'生成当前页 PNG'}</button>{png&&<><button onClick={()=>saveSheetPng(png.blob,`${fileName(c.name)}-${sheetPage}.png`)}>下载 PNG</button><button onClick={()=>{try{printSheetPng(png.url);}catch(e){setImportError(String(e));}}}>打印 PNG</button></>}</div>{png&&<img className="png-preview" src={png.url} alt="当前角色卡 PNG 预览"/>}</section><section className="settings-section"><h3>本机恢复</h3><p>自动保留上一次保存的工作区。请先导出当前角色，再恢复。</p><button onClick={async () => { try { const backup = await restoreBackup(); if (!backup) throw new Error('没有可用备份'); acceptWorkspace(backup); history.current.clear(); setNotice('已读取上一次保存；确认内容后继续编辑即可保存。'); setModal(''); } catch (error) { setImportError(String(error)); } }}>读取上一次保存</button></section></>}

    </Dialog>}

  </div></EntryDragProvider></KeywordPreview>;
}
