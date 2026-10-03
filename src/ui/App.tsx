import {OverviewDashboardHost} from './OverviewDashboardHost';
import {confirmResourceDraftDiscard} from './resourceDraftGuard';
import {commitDashboardDraft,settleDashboardSave} from '../core/dashboardDraft';
import {useStartupComplete} from '../platform/startup';
import {entryNameIndex} from '../core/entryNameIndex';
import {classEditionSuffix} from '../core/classEdition';
import {wikiEditionAllows} from './wikiEdition';
import {CharacterTabs} from './CharacterTabs';
import {applyDisplayCharacterEdit,sameCharacterMechanics} from '../core/displayCharacterEdit';
import {ToolBoundary} from './ToolBoundary';
import './classCompatibility.css';
import './editingRecovery.css';
import {ownedTrainingReference} from './entryMenuEntries';
import {overviewConditionEntry} from './OverviewVisuals';
import {useGroupRoll,getGroupRoll} from '../platform/groupRoll';
const CardMigration=lazy(()=>import('./CardMigration').then(module=>({default:module.CardMigration})));
import {cardMigrationIssues} from '../core/cardMigrationIssues';
import {ClearableSearch} from './ClearableSearch';
import {classCompatibilityIssues,migrationStillCurrent,type ClassMigrationPlan} from '../core/classMigration';
const RuleOptions=lazy(()=>import('./RuleOptions').then(m=>({default:m.RuleOptions})));
import {rulesSetupComplete,rememberRulesSetup} from '../platform/rulesSetup';
import {rememberSourceSpellUses} from '../core/automation/sourceSpellState';

const AutomationPanel=lazy(()=>import('./AutomationPanel').then(module=>({default:module.AutomationPanel})));

import {automationEnabled,automationNeedsInitialization,initializeAutomation,newAutomationState} from '../core/automation/state';
import {reconcileEquipping} from '../core/automation/equipment';
const Announcement=lazy(()=>import('./Announcement').then(m=>({default:m.Announcement})));
import {useUiLanguage} from './UiLanguage';

import {uiEntryLabel} from './uiText';
import {useEntryMenuActions} from './EntrySharing';
import type {CharacterRow} from './CharacterManager';
import {localCharacterRow} from './characterRows';
const CharacterManager=lazy(()=>import('./CharacterManager').then(m=>({default:m.CharacterManager})));
const TransferPanel=lazy(()=>import('./TransferPanel').then(module=>({default:module.TransferPanel})));
const CharacterReview=lazy(()=>import('./CharacterReview').then(module=>({default:module.CharacterReview})));
import {readCharacterTransfer,deleteLocalCharacters} from '../core/transfers';
import {useEntrySearch} from './useEntrySearch';
import {announcementVersionFor,announcementPending,readAnnouncementVersion} from '../platform/announcement';
const SpellAbilityEditor=lazy(()=>import('./SpellAbilityEditor').then(module=>({default:module.SpellAbilityEditor})));
import {ownsSubclassFeature} from '../core/entryReferences';
import {reviewImport} from '../core/importReview';
import {hydrateImportedCasting} from '../core/castingSnapshot';
const PersonalEntries=lazy(()=>import('./PersonalEntries').then(module=>({default:module.PersonalEntries})));
const HitPointEditor=lazy(()=>import('./HitPointEditor').then(module=>({default:module.HitPointEditor})));
import {includeNewProfileSources,startAllSources} from '../core/sourceDefaults';
import {ensureSiteSources,sourceSettings,withSiteSources} from '../core/siteSources';

import {standalone} from '../platform/buildMode';
import {LocalDice} from '../standalone/LocalDice';
import {pinEntry} from '../core/quickbar';
const QuickbarManager=lazy(()=>import('./QuickbarManager').then(module=>({default:module.QuickbarManager})));
import {recordAction,travelHistory,useActionHistory} from '../platform/actionHistory';
import {applyPatch,sameValue} from '../core/merge';
import {CarryCapacity} from './InventoryMarks';
import {useLayoutEffect} from 'react';
import {SupporterEffect} from './SupporterEffect';
const ResourceModuleEditor=lazy(()=>import('./ResourceModuleEditor').then(module=>({default:module.ResourceModuleEditor})));
import type {DashboardViewport} from './ResourceDashboard';
const ResourceDashboard=lazy(()=>import('./ResourceDashboard').then(module=>({default:module.ResourceDashboard})));
import {ensureResourceWidget} from '../core/resourceWidgets';
import {ValueTraceProvider} from './ValueTrace';
import {ArmorAdjustmentReview} from './ArmorAdjustmentReview';
import {applyInventory} from '../core/inventory';
const WorkbenchInventory=lazy(()=>import('./StockBoard').then(m=>({default:m.WorkbenchInventory})));
import {WorkbenchPanel,MusicWorkspace} from './WorkbenchPanel';
import {ThreeDragonFullscreen} from './ThreeDragonFullscreen';
import {useNarrowWikiDrag} from './useNarrowWikiDrag';

import {Toast} from './Toast';
import {CopyDiagnostic,diagnosticText} from './CopyDiagnostic';
import {isHitDieResource,syncAutoResources} from '../core/resources';
import {NumberInput} from './NumberInput';
import {inWorkbench,useWorkbench,getWorkbench,markWorkbenchView,workbenchCharacterId,patchWorkbenchStats,workbenchRequest,chooseWorkbench,workbenchDiagnostics,type SharedRules} from '../platform/workbench';
import {WorkbenchBar,DicePage,WorkbenchMonster,DMConsole} from './Workbench';
const DetailHeader=lazy(()=>import('./CharacterPages').then(m=>({default:m.DetailHeader})));
const FeaturesPage=lazy(()=>import('./CharacterPages').then(m=>({default:m.FeaturesPage})));
const BackgroundPage=lazy(()=>import('./CharacterPages').then(m=>({default:m.BackgroundPage})));
import {ChoiceWorkspaceContext} from './ChoiceWorkspaceContext';
import {usePointerStableValue} from './usePointerStableValue';
import {sheetChoices} from '../core/automation/choices';
import {SheetChoicesContext} from './SheetChoicesContext';
import {choiceCatalog} from './choiceCatalog';
const SpellsPage=lazy(()=>import('./SpellsPage').then(m=>({default:m.SpellsPage})));
import {DmNotes} from './DmNotes';
const InventoryPage=lazy(()=>import('./InventoryPage').then(m=>({default:m.InventoryPage})));
import {WorkspaceSplitter} from './WorkspaceSplitter';
import {Palette} from './Portrait';
import type {SheetCaptureOptions} from '../platform/sheetImage';



import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ABILITIES, ABILITY_LABELS, KIND_LABELS, SKILLS, newCharacter, selectionEffectsAllowed, subclassOwner, entryEdition, uid, type Character, type Edition, type Entry, type Kind, type Selection } from '../core/model';
import { candidateReason, choiceLabel, evaluate, requirementMismatch } from '../core/engine';
import { EXAMPLE_PACK, importOwlbear, parseFile, readCharacter, validateCharacter, validatePack } from '../core/validation';
import { exportCharacter, exportOwlbear, exportRulePack } from '../core/export';
import type {LoadProgress} from '../data/catalog';
import {DEFAULT_SOURCE} from '../data/catalogSource';
import {afterStartupPaint} from '../platform/afterPaint';
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
import {SheetDisplayButton} from './SheetDisplayButton';
import { PaperFrame, type SheetPage } from './PaperFrame';
import {SheetFullscreenButton,exitSheetFullscreen} from './SheetFullscreenButton';
import { DropZone, EntryDragProvider, EntryDraggable } from './DragEntry';

const SourceSettings=lazy(()=>import('./SourceSettings').then(m=>({default:m.SourceSettings})));
const RoomRulesSummary=lazy(()=>import('./RoomRulesSummary').then(m=>({default:m.RoomRulesSummary})));
import {confirmedChanges} from '../core/syncRecovery';
import { SourceName, useSources } from './SourceName';
import { KeywordPreview } from './KeywordPreview';
import { Reference } from './Reference';


import { useLibrary } from './useLibrary';
import { explicitlyExcluded, librarySourceEnabled, LIBRARY_TABS, tabOf, matchesLibraryTab, columnsFor, facetsFor, matchesFacets, compareEntries } from './libraryData';

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
  const allowed = selectionEffectsAllowed(c, s.entry);
  if (['class', 'subclass', 'race', 'background'].includes(s.entry.kind)) return <IdentityToken row={s} c={c} edit={edit} inspect={inspect}/>;
  return <div className={`selected-entry ${allowed ? '' : 'restricted'}`}>
    <div className="selected-title"><span className="class-title"><Reference className="text-link" reference={`entry:${s.entry.id}`} kind={s.entry.kind} onClick={() => inspect(s.entry)}>{s.entry.name}</Reference></span><button className="remove" aria-label={`移除${s.entry.name}`} title="移除，可撤销" onClick={() => edit(d => { removeSelection(d, s.id); })}>×</button></div>
    <div className="entry-meta"><span><SourceName id={s.entry.source}/>{!allowed ? ' · 未启用' : ''}</span>{s.entry.kind === 'class' && <label>等级 <NumberInput aria-label={`${s.entry.name}等级`} type="number" min="1" max="20" value={s.level} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.level = clamp(e.target.value, 1, 20); }, `${s.id}-level`)}/></label>}

      {s.entry.kind === 'item' && <><label>× <NumberInput aria-label={`${s.entry.name}数量`} type="number" min="1" max="9999" value={s.quantity} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.quantity = clamp(e.target.value, 1, 9999); })}/></label><label><input type="checkbox" checked={s.equipped} onChange={e => edit(d => { d.selections.find(x => x.id === s.id)!.equipped = e.target.checked; })}/>装备</label></>}
    </div>
  </div>;
}

export default function App() {
  const {language,t}=useUiLanguage();
  const wb=useWorkbench(),groupRoll=useGroupRoll();
  const [workbenchPage,setWorkbenchPage]=useState('sheet');
  useEffect(()=>{const navigate=(e:Event)=>{const page=(e as CustomEvent).detail;if(['console','sheet','dice','music','settings','features'].includes(page))setWorkbenchPage(page);};window.addEventListener('workbench-panel-navigate',navigate);return()=>window.removeEventListener('workbench-panel-navigate',navigate);},[]);
  const [tableOpen,setTableOpen]=useState(false);
  useEffect(()=>{if(wb.enabled.threeDragonAnte===false)setTableOpen(false);if(wb.enabled.musicBoard===false&&workbenchPage==='music'||wb.enabled.dice===false&&workbenchPage==='dice')setWorkbenchPage('console');},[wb.enabled,workbenchPage]);
  const firstWorkbenchRole=useRef(false),previousTarget=useRef(''),restoredMapTarget=useRef<string|undefined>(undefined);
  const wikiVisible=!inWorkbench||!!wb.visibility?.wiki,monstersVisible=!inWorkbench||!!wb.visibility?.monsters;
  useEffect(()=>{if(!inWorkbench||!wb.role)return;if(!firstWorkbenchRole.current){firstWorkbenchRole.current=true;setWorkbenchPage('console');}},[wb.role]);
  useEffect(()=>{const key=wb.target?.key||'',id=wb.target?.targetId||(wb.target?.cardId?`card:${wb.target.cardId}`:wb.target?.itemId);if(!groupRoll&&previousTarget.current&&key&&key!==previousTarget.current){if(restoredMapTarget.current!==id&&restoredMapTarget.current!==wb.target?.itemId)setWorkbenchPage('sheet');restoredMapTarget.current=undefined;}previousTarget.current=key;},[wb.target?.key]);
  useEffect(()=>{const show=()=>{if(!groupRoll){setWorkbenchPage('sheet');setTab('sheet');}};window.addEventListener('workbench-show-sheet',show);return()=>window.removeEventListener('workbench-show-sheet',show);},[groupRoll]);
  useEffect(()=>{if(wb.compose&&!groupRoll)setWorkbenchPage('dice');},[wb.compose?.id]);
  useEffect(()=>{if(inWorkbench)document.body.classList.add('suite-workbench');return()=>document.body.classList.remove('suite-workbench');},[]);
  const appliedWorkbench=useRef('');
  const workbenchDocuments=useRef(new Map<string,any>());
  const workbenchViews=useRef(new Map<string,{signature:string;document:any;character:Character}>());
  const workbenchQuarantined=useRef(new Map<string,Character>());
  const workbenchAccessScope=useRef('');
  const appliedDocument=useRef<any>(undefined);
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
  const restoredWorkspacePendingSave = useRef(false);
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
  const activePacks=useMemo(()=>inWorkbench?(roomRules?.packs||[]):workspace?.packs||[],[workspace?.packs,roomRules?.packs]);
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
  const catalogNames=useMemo(()=>entryNameIndex(allEntries),[allEntries]);
  const defaultSources=useMemo(()=>[...new Set(allEntries.flatMap(e=>[e.source,...(e.dependencies||[])]))],[allEntries]);
  const roomProfile=useMemo(()=>roomRules?includeNewProfileSources(roomRules.profile,defaultSources):undefined,[roomRules,defaultSources]);
  const localProfile=useMemo(()=>storedCharacter?withSiteSources(storedCharacter,workspace?.siteSources,activePacks).profile:undefined,[storedCharacter?.profile,workspace?.siteSources,activePacks]);
  const c=useMemo(()=>{
    if(!storedCharacter)return;
    const effective=inWorkbench&&wb.shared?{...storedCharacter,edition:roomRules!.edition,profile:roomProfile!,rulePacks:roomRules!.packs}:localSources&&workspace?.siteSources?{...storedCharacter,profile:localProfile!,rulePacks:activePacks}:storedCharacter;
    // Reading an old card must not create competing network writes. Casting
    // metadata is a view until the owner performs an explicit edit.
    if(inWorkbench&&effective.selections.some(s=>s.entry.packId==='imported'&&s.entry.kind==='class'&&!s.entry.raw._castingSource)){const view=structuredClone(effective);const hydrated=hydrateImportedCasting(view,allEntries),initialized=initializeAutomation(view);if(hydrated||initialized){syncAutoResources(view);return view;}}
    if(automationNeedsInitialization(effective)){const autoView=structuredClone(effective);if(initializeAutomation(autoView)){syncAutoResources(autoView);return autoView;}}return effective;
  },[storedCharacter,roomRules,roomProfile,localProfile,activePacks,allEntries]);
  const mechanicsRef=useRef<Character|undefined>(undefined);
  if(c&&!sameCharacterMechanics(mechanicsRef.current,c))mechanicsRef.current=c;
  const mechanics=mechanicsRef.current;
  const choicesSnapshot=useMemo(()=>mechanics?{character:mechanics,catalog:allEntries,choices:sheetChoices(mechanics,allEntries)}:undefined,[mechanics,allEntries]);
  function createLocalCharacter(edition:Edition='2024'){const next=newCharacter(edition);initializeAutomation(next);return localSources?(workspaceRef.current?.siteSources?withSiteSources(next,workspaceRef.current.siteSources,workspaceRef.current.packs):startAllSources(next,defaultSources)):next;}
  useEffect(()=>{
    const current=workspaceRef.current;
    if(!localSources||!current||!writable.current)return;
    if(!current.siteSources)return;
    const profile=includeNewProfileSources(current.siteSources,defaultSources);
    if(profile!==current.siteSources)persist({...current,siteSources:sourceSettings(profile)});
  },[defaultSources,workspace]);
  const sourceEntries=useMemo(()=>c?allEntries.filter(e=>librarySourceEnabled(c,e)):[],[allEntries,c?.profile.enabledSources]);
  const selectedEntries = useMemo(()=>workspace?.characters.filter(row=>!inWorkbench||!row.id.startsWith('suite:')||(wb.access?wb.access.enabled.characterCards!==false&&wb.access.cards.some(card=>row.id===`suite:${wb.access!.room}:card:${card.id}`):!!wb.document&&!!wb.target&&row.id===workbenchCharacterId(wb.target))).flatMap(row=>row.selections.map(s=>s.entry))||[],[workspace?.characters,wb.access,wb.target?.key,wb.document]);
  const library = useLibrary(allEntries,selectedEntries,inWorkbench);
  const { kind, setKind, detail: storedDetail, setDetail, state: libraryState } = library;
  const detail=storedDetail&&c&&librarySourceEnabled(c,storedDetail)?storedDetail:undefined;
  useEffect(()=>{if(!monstersVisible&&kind==='monster')setKind('class');if(!monstersVisible&&detail?.kind==='monster')setDetail(undefined);},[monstersVisible,kind,detail?.id]);
  const { edition: editionFilter, filters, sort, descending, query:categoryQuery } = libraryState;
  const libraryEntries=sourceEntries;
  const { globalQuery:query, setGlobalQuery:setQuery } = library;
  const setEditionFilter = (edition: string) => library.patch({ edition });
  const detailPane = useRef<HTMLElement>(null);
  const previewCommit=useRef<{id:string;top:number}|undefined>(undefined);
  const startupComplete=useStartupComplete();
  const [announcement,setAnnouncement]=useState(()=>(standalone||inWorkbench)&&announcementPending(readAnnouncementVersion(inWorkbench?'suite':'standalone'),announcementVersionFor(inWorkbench?'suite':'standalone')));
  const [modal, setModalValue] = useState('');
  const setModal=(value:string)=>{if(confirmResourceDraftDiscard())setModalValue(value);};
  const [classSyncBusy,setClassSyncBusy]=useState(false);
  const [workbenchReadError,setWorkbenchReadError]=useState<{key:string;message:string}>();
  const classReview=useMemo(()=>mechanics?cardMigrationIssues(mechanics,allEntries):[],[mechanics,allEntries]);
  const classNeedsReview=classReview.length>0;
  const showClassReview=usePointerStableValue(classNeedsReview&&!loading,c?.id);
  const migrationWarningCache=useMemo(()=>new WeakMap<Character,boolean>(),[allEntries,roomRules,roomProfile,workspace?.siteSources,activePacks]);
  const classWarnings=useMemo(()=>new Set(!loading&&workspace?workspace.characters.filter(row=>{let issue=migrationWarningCache.get(row);if(issue===undefined){issue=cardMigrationIssues(inWorkbench&&roomRules?{...row,edition:roomRules.edition,profile:roomProfile!}:withSiteSources(row,workspace.siteSources,activePacks),allEntries).length>0;migrationWarningCache.set(row,issue);}return issue;}).map(row=>row.id):[]),[workspace?.characters,loading,migrationWarningCache]);
  const roomClassWarnings=useMemo(()=>new Set(!loading&&c?wb.cards.filter(card=>card.id===wb.target?.cardId&&c.id===workbenchCharacterId(wb.target!)?classNeedsReview:card.classSummary?classCompatibilityIssues({...c,selections:card.classSummary},allEntries).length:classWarnings.has(`suite:${wb.target?.key.split(':card:')[0]}:card:${card.id}`)).map(card=>card.id):[]),[loading,c,wb.cards,wb.target,classNeedsReview,classWarnings,allEntries]);
  const [setupDone,setSetupDone]=useState(rulesSetupComplete);
  const completeSetup=()=>{rememberRulesSetup();setSetupDone(true);setModal('');};
  useEffect(()=>{if(startupComplete&&!setupDone&&workspace&&c&&!announcement&&!modal&&!readOnly&&(!inWorkbench||wb.online&&wb.target?.kind==='character'&&!!wb.document))setModal('onboarding');},[startupComplete,setupDone,workspace?.activeId,announcement,modal,readOnly,wb.online,wb.document]);
  const [pendingImport,setPendingImport]=useState<{card:Character;review:ReturnType<typeof reviewImport>}>();
  const [pendingBatch,setPendingBatch]=useState<{card:Character;review:ReturnType<typeof reviewImport>}[]>([]);
  const [batchBusy,setBatchBusy]=useState(false);
  const [batchUncertain,setBatchUncertain]=useState(false);
  const [reviewTarget,setReviewTarget]=useState<Character>();
  const [exportView,setExportView]=useState<SheetCaptureOptions>();
  const exportInProgress=useRef(false);

  const [fillPulse,setFillPulse]=useState(0);
  const [readingFlash,setReadingFlash]=useState(0);
  const [automationRuntime,setAutomationRuntime]=useState<typeof import('../core/automation/cardRuntime')>();
  const [editingLoadError,setEditingLoadError]=useState('');
  const [editingReloadPending,setEditingReloadPending]=useState(false);
  const editingReloadInProgress=useRef(false);
  useEffect(()=>{if(!workspace)return;let alive=true;const cancel=afterStartupPaint(()=>{void import('../core/automation/cardRuntime').then(runtime=>{if(alive){setAutomationRuntime(runtime);setEditingLoadError('');}}).catch(error=>{if(alive)setEditingLoadError(String(error));});});return()=>{alive=false;cancel();};},[!!workspace]);
  const [editingRequested, setEditing] = useState(()=>{try{return localStorage.getItem('dnd-card:editing')==='true';}catch{return false;}});
  const editing=editingRequested&&!!automationRuntime;
  useEffect(()=>{try{localStorage.setItem('dnd-card:editing',String(editingRequested));}catch{/* A session still keeps the global editing preference. */}},[editingRequested]);
  const [sheetPage, setSheetPage] = useState<SheetPage>('主要');
  const readableMenuEntry=(entry:Entry)=>{
    const same=(row:Entry)=>row.id===entry.id&&row.source===entry.source&&row.packId===entry.packId&&row.edition===entry.edition;
    if(inWorkbench&&!wb.online)return undefined;
    // Roster conditions are already authorized directory data and may not be a
    // selection on the open sheet. Rebuild them from the current roster only.
    return selectedEntries.find(same)||allEntries.find(same)
      ||(!inWorkbench||wb.target&&!!wb.document&&c?.id===workbenchCharacterId(wb.target)?c&&(c.quickbarCopies?.map(row=>row.entry).find(same)||ownedTrainingReference(c,entry)):undefined)
      ||(inWorkbench?Object.values(wb.inventory?.containers||{}).flatMap(container=>container.items).map(row=>row.entry).find((row):row is Entry=>!!row&&same(row)):undefined)
      ||(inWorkbench?[...wb.cards,...wb.monsters].flatMap(row=>row.conditions||[]).map(overviewConditionEntry).find(same):undefined);
  };
  useEntryMenuActions({character:c,editing,scope:inWorkbench?JSON.stringify([wb.online,wb.role,wb.access?.room,wb.access?.scope,wb.access?.epoch]):undefined,readableEntry:readableMenuEntry,writable:!readOnly&&(!inWorkbench||!!wb.target?.write),add:entry=>add(entry),inspect,remove:id=>edit(draft=>removeSelection(draft,id)),canRemoveCustom:entry=>canAuthor&&!readOnly&&!rulesBusy&&customEntries.some(row=>row.id===entry.id),removeCustom:entry=>{void changeCustom(entry,true).catch(error=>setNotice(String(error)));}});
  const [tab, setTab] = useState('sheet');
  const groupReturn=useRef<{page:string;tab:string;sheet:SheetPage;scrolls:{selector:string;top:number;left:number}[]}|undefined>(undefined);
  const mapFollowing=useRef(false);
  const captureSelectionReturn=()=>{if(!groupReturn.current)groupReturn.current={page:workbenchPage,tab,sheet:sheetPage,scrolls:['.sheet-viewport','.sheet-pane','.entry-detail'].flatMap(selector=>{const el=document.querySelector(selector);return el?[{selector,top:el.scrollTop,left:el.scrollLeft}]:[]})};};
  const restoreSelectionReturn=()=>{
    const restore=groupReturn.current;if(!restore)return;groupReturn.current=undefined;setWorkbenchPage(restore.page);setTab(restore.tab);setSheetPage(restore.sheet);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(groupReturn.current)return;for(const position of restore.scrolls){const el=document.querySelector(position.selector);if(el){el.scrollTop=position.top;el.scrollLeft=position.left;}}}));
  };
  useEffect(()=>{
    const follow=(event:Event)=>{const detail=(event as CustomEvent).detail;
      if(detail.active){captureSelectionReturn();mapFollowing.current=true;restoredMapTarget.current=undefined;}
      else{mapFollowing.current=false;if(detail.restore===false){groupReturn.current=undefined;return;}if(!getGroupRoll()||getGroupRoll()?.phase==='select'){restoredMapTarget.current=detail.itemId;restoreSelectionReturn();}}
    };
    window.addEventListener('workbench-follow-selection',follow);return()=>window.removeEventListener('workbench-follow-selection',follow);
  },[workbenchPage,tab,sheetPage]);
  useLayoutEffect(()=>{
    if(inWorkbench&&wb.role==='GM'&&groupRoll){
      captureSelectionReturn();setWorkbenchPage('console');setTab('sheet');
    }else if(groupReturn.current&&!mapFollowing.current){
      restoreSelectionReturn();
    }
  },[groupRoll?.id,wb.role]);

  const [choiceRoute,setChoiceRoute]=useState<{id:string;characterId:string}>();
  const choiceSnapshot=useRef<ReturnType<typeof library.snapshot>|undefined>(undefined);
  const activeChoice=useMemo(()=>c&&choiceRoute?.characterId===c.id?choicesSnapshot?.choices.find(r=>r.id===choiceRoute.id):undefined,[c?.id,choicesSnapshot,choiceRoute]);
  const choiceScope=useMemo(()=>c&&activeChoice?choiceCatalog(c,activeChoice,allEntries):undefined,[c,activeChoice,allEntries]);
  function closeChoice(){setChoiceRoute(undefined);if(choiceSnapshot.current){library.restore(choiceSnapshot.current);choiceSnapshot.current=undefined;}}
  function openChoice(id:string){if(!c||!editing||readOnly||inWorkbench&&!wb.target?.write)return;const choice=choicesSnapshot?.choices.find(r=>r.id===id);if(!choice)return;
    choiceSnapshot.current??=library.snapshot();setChoiceRoute({id,characterId:c.id});setSheetPage('特性');exitSheetFullscreen();
    const scope=choiceCatalog(c,choice,allEntries);if(scope.wiki){library.setKind(scope.tab);library.patch({query:'',detailId:undefined,focus:undefined,edition:c.edition,filters:scope.filters,sort:scope.tab==='spell'?'level':'source',descending:false},scope.tab);setFillPulse(n=>n+1);setTab('wiki');}else setTab('sheet');
  }
  useEffect(()=>{if(choiceRoute&&(!activeChoice||!editing||sheetPage!=='特性'))closeChoice();},[c?.id,choiceRoute?.id,!!activeChoice,editing,sheetPage]);
  useNarrowWikiDrag(tab,setTab,!tableOpen&&(!inWorkbench||workbenchPage==='console'||workbenchPage==='sheet'&&!!wb.target));
  const [exception, setException] = useState('');
  const [importError, setImportError] = useState('');
  const [adjustTarget, setAdjustTarget] = useState('hp');
  const [adjustValue, setAdjustValue] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const dashboardSaveBases=useRef(new WeakMap<Character,Character>());
  const [editingResource,setEditingResource]=useState(''),[resourceViewport,setResourceViewport]=useState<DashboardViewport>({page:0});
  useEffect(()=>{const page=(event:Event)=>setResourceViewport(typeof (event as CustomEvent).detail==='number'?{page:(event as CustomEvent).detail}:(event as CustomEvent).detail||{page:0});window.addEventListener('resource-canvas-page',page);return()=>window.removeEventListener('resource-canvas-page',page);},[]);
  useEffect(()=>{const open=(event:Event)=>{if(!confirmResourceDraftDiscard())return;setEditingResource((event as CustomEvent).detail);setModalValue('resources');};window.addEventListener('edit-character-resource',open);return()=>window.removeEventListener('edit-character-resource',open);},[]);

  function persist(next: Workspace) {
    if(localSources)next=ensureSiteSources(next);
    if (!writable.current) { setNotice('另一标签页正在编辑；此页仅供查阅与导出。关闭另一页后刷新即可编辑。'); return; }
    workspaceRef.current = next; setWorkspace(next); setSaving('保存中…'); pendingSaves.current++;
    const operation = queue.current.catch(() => {}).then(() => saveWorkspace(next)).then(() => {
      if (workspaceRef.current === next) { restoredWorkspacePendingSave.current = false; saveFailed.current = false; setSaving('已保存到本机'); }
    });
    queue.current=operation.catch(error => { saveFailed.current = true; setSaving('保存失败'); setNotice(`本机保存失败，请立即导出角色备份。${String(error)}`); }).finally(() => { pendingSaves.current--; });
    return operation;
  }
  async function reloadSavedWorkspace(){
    if(editingReloadInProgress.current)return;
    editingReloadInProgress.current=true;setEditingReloadPending(true);
    try{
      if(restoredWorkspacePendingSave.current){
        if(!writable.current){setNotice('此标签页为只读，恢复的备份尚未保存。请先导出角色备份。');return;}
        const accepted=workspaceRef.current;if(!accepted)return;
        // Save the accepted book, not the active character's derived view.
        // Ordinary retries leave the existing previous-save backup untouched.
        persist(accepted);
      }
      await queue.current;
      if(saveFailed.current||restoredWorkspacePendingSave.current||pendingSaves.current>0){setNotice('保存尚未完成或未成功，请先导出角色备份。');return;}
      location.reload();
    }finally{editingReloadInProgress.current=false;setEditingReloadPending(false);}
  }
  function acceptWorkspace(value: Workspace,fromBackup=false) {
    performance.mark('dnd-card:workspace-validate-start');
    if (value.schemaVersion !== 1 || !Array.isArray(value.characters) || !value.characters.length || !Array.isArray(value.packs)) throw new Error('工作区结构不完整');
    const repaired: string[] = [];
    value = {...value, characters: value.characters.map(character => { const read = readCharacter(character); if (read.repaired.length) repaired.push(`${character.name || '未命名'}（${read.repaired.join('、')}）`); if(!inWorkbench)initializeAutomation(read.character);return read.character; })};
    if(value.siteSources){const probe=newCharacter();probe.profile={...probe.profile,...value.siteSources};validateCharacter(probe);}
    if (new Set(value.characters.map(c => c.id)).size !== value.characters.length) throw new Error('角色身份重复');
    for (const pack of value.packs) validatePack({ ...pack, entries: pack.entries.map(e => ({ ...e, id: e.id.slice(pack.id.length + 1) })) }, value.packs);
    if (!value.characters.some(c => c.id === value.activeId)) value.activeId = value.characters[0].id;
    if(localSources)value=ensureSiteSources(value);
    restoredWorkspacePendingSave.current=fromBackup;
    performance.mark('dnd-card:workspace-validated');
    workspaceRef.current = value; setWorkspace(value); setSaving(fromBackup?'备份已读取，尚未保存':'已保存到本机'); setStartupError('');
    if(repaired.length)setNotice(`这些角色的图片数据无法读取，已忽略并保留其余内容：${repaired.join('；')}。请重新设置后再保存。`);
  }
  useEffect(() => {
    let alive = true; let release = () => {}; const lockAbort = new AbortController();
    const initialize = async (canWrite: boolean) => {
      writable.current = canWrite; setReadOnly(!canWrite);
      try {
        performance.mark('dnd-card:workspace-read-start');
        const value = await loadWorkspace(); if (!alive) return;
        performance.mark('dnd-card:workspace-read-end');
        if (value) {acceptWorkspace(value);if(localSources&&canWrite&&(!value.siteSources||!sameValue(value.characters,workspaceRef.current!.characters)))persist(workspaceRef.current!);} else { const first = createLocalCharacter(); const initial: Workspace = { schemaVersion: 1, characters: [first], activeId: first.id, packs: [] }; if (canWrite) persist(initial); else acceptWorkspace(initial); }
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
  async function load(refresh = false,retryKeys:readonly string[] = []) {
    loadController.current?.abort(); const controller = new AbortController(); loadController.current = controller;
    setLoading(true); setProgress(emptyProgress);
    let lastPublish=0;
    try {
      await (await import('../data/catalog')).loadCatalog(batch => {
        batch.forEach(e => catalogRef.current.set(e.id, e));
        if(performance.now()-lastPublish>500){lastPublish=performance.now();setEntries([...catalogRef.current.values()]);}
      }, setProgress, controller.signal, refresh, DEFAULT_SOURCE, sourceDisplay.merge,retryKeys);
      if(!controller.signal.aborted)setEntries([...catalogRef.current.values()]);
    } catch (e) { if (!controller.signal.aborted) setNotice(`资料加载失败：${String(e)}`); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const [wikiUiError,setWikiUiError]=useState('');
  const [wikiUi,setWikiUi]=useState<typeof import('./WikiUi')>();
  useEffect(()=>{if(!workspace)return;const cancel=afterStartupPaint(()=>{void import('./WikiUi').then(setWikiUi).catch(error=>setWikiUiError(String(error)));});return cancel;},[!!workspace]);
  useEffect(()=>{if(!wikiUi)return;void load();return()=>loadController.current?.abort();},[!!wikiUi]);
  useEffect(() => afterStartupPaint(()=>{void registerOffline(activate => setActivateUpdate(() => activate));}), []);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (pendingSaves.current > 0 || saveFailed.current || restoredWorkspacePendingSave.current) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, []);
  const d = useMemo(() => mechanics ? evaluate(mechanics) : undefined, [mechanics]);
  // Reveal the startup animation only once a usable workspace or recovery UI has committed.
  useEffect(()=>{if(startupError)window.dispatchEvent(new Event('dnd-card-failed'));else if(workspace&&c&&d)window.dispatchEvent(new Event('dnd-card-ready'));},[!!workspace,!!c,!!d,startupError]);
  /** 一张坏图片只丢弃它自己：头像或立绘读不出来时仍然打开整张角色卡。 */
  function readDocument(document: unknown): Character {
    const { character, repaired } = readCharacter(document);
    if (repaired.length) setNotice(`${repaired.join('、')}已兼容处理并打开角色卡；原始资料未自动写回。`);
    return character;
  }
  useLayoutEffect(()=>{
    if(!inWorkbench||!wb.access||!workspaceRef.current)return;
    const access=wb.access,scope=JSON.stringify([access.scope,access.role]);
    const allowed=new Set(access.enabled.characterCards===false?[]:access.cards.map(card=>`suite:${access.room}:card:${card.id}`));
    if(workbenchAccessScope.current!==scope){workbenchViews.current.clear();workbenchDocuments.current.clear();appliedWorkbench.current='';workbenchAccessScope.current=scope;}
    const current=workspaceRef.current,characters=current.characters.filter(row=>{
      if(!row.id.startsWith('suite:')||allowed.has(row.id))return true;
      // Keep unresolved local edits recoverable, but never expose them in the
      // sheet or library after the host has removed their reading permission.
      if(workbenchDirty.current.has(row.id)||workbenchUncertain.current.has(row.id)||workbenchFailed.current.has(row.id))workbenchQuarantined.current.set(row.id,row);
      workbenchViews.current.delete(row.id);workbenchDocuments.current.delete(row.id);return false;
    });
    for(const [id,row]of workbenchQuarantined.current)if(allowed.has(id)){if(!characters.some(c=>c.id===id))characters.push(row);workbenchQuarantined.current.delete(id);}
    if(characters.length===current.characters.length&&characters.every((row,i)=>row===current.characters[i]))return;
    if(!characters.length)characters.push(newCharacter());
    const visible={...current,characters,activeId:characters.some(row=>row.id===current.activeId)?current.activeId:characters[0].id};
    workspaceRef.current=visible;setWorkspace(visible);
  },[wb.access,!!workspace]);
  useLayoutEffect(()=>{
    if(!inWorkbench||!workspace||!writable.current||!wb.target||wb.target.kind!=='character')return;
    const target=wb.target,id=workbenchCharacterId(target),stock=wb.inventory?.containers[`card:${target.cardId}`],signature=JSON.stringify([target,wb.inventory?.publicId,wb.inventory?.access,stock?.revision,stock?.write,stock?.locked]);
    if(signature===appliedWorkbench.current&&appliedDocument.current===wb.document&&workspaceRef.current?.activeId===id)return;
    const current=workspaceRef.current!;let next=current.characters.find(row=>row.id===id);
    try{
      markWorkbenchView('prepare',target.key);
      const documentSignature=wb.document,cached=workbenchViews.current.get(id);
      if(cached&&next===cached.character&&cached.signature===signature&&cached.document===documentSignature&&!workbenchDirty.current.has(id)&&!workbenchUncertain.current.has(id)){
        markWorkbenchView('prepared',target.key,true);appliedWorkbench.current=signature;appliedDocument.current=documentSignature;setWorkbenchReadError(undefined);
        if(current.activeId!==id){const visible={...current,activeId:id};workspaceRef.current=visible;setWorkspace(visible);}return;
      }
      if(!next||(wb.document&&workbenchDocuments.current.get(id)!==documentSignature&&!workbenchDirty.current.has(id))){if(!wb.document)return;next=wb.document.dnd_card_web?structuredClone(readDocument(wb.document.dnd_card_web)):importOwlbear(wb.document);next.id=id;}
      else next=structuredClone(next);
      const uncertain=workbenchUncertain.current.get(id);
      if(uncertain&&wb.document?.dnd_card_web&&confirmedChanges(uncertain.before,uncertain.after,wb.document.dnd_card_web)){window.dispatchEvent(new CustomEvent('workbench-operation-reconciled',{detail:{requestId:uncertain.requestId}}));workbenchUncertain.current.delete(id);workbenchDirty.current.delete(id);workbenchFailed.current.delete(id);next=structuredClone(readDocument(wb.document.dnd_card_web));next.id=id;}
      if(workbenchDirty.current.has(id)){if(current.activeId!==id){const visible={...current,activeId:id};workspaceRef.current=visible;setWorkspace(visible);}return;}
      if(stock)applyInventory(next,stock);
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
      // AC comes from the imported document and its explicit card adjustment.
      // A scene projection must never create a permanent final-value override.
      }
      syncAutoResources(next);
      workbenchViews.current.set(id,{signature,document:documentSignature,character:next});
      markWorkbenchView('prepared',target.key,false);
      appliedWorkbench.current=signature;appliedDocument.current=wb.document;setWorkbenchReadError(undefined);
      // Remote reads are already durable on the server. Keep their view in memory;
      // saving every snapshot rewrote every imported portrait plus the backup.
      const visible={...current,activeId:id,characters:[...current.characters.filter(row=>row.id!==id),next]};
      workspaceRef.current=visible;setWorkspace(visible);
    }catch(e){const message=`枭熊角色读取失败：${String(e)}`;setNotice(message);setWorkbenchReadError({key:target.key,message});appliedWorkbench.current=signature;appliedDocument.current=wb.document;}
  },[wb.target,wb.document,wb.inventory?.revision,wb.inventory?.access,wb.inventory?.publicId,!!workspace,workspace?.activeId,historyTick]);
  useLayoutEffect(()=>{if(inWorkbench&&wb.target?.kind==='character'&&storedCharacter?.id===workbenchCharacterId(wb.target)&&appliedDocument.current===wb.document)markWorkbenchView('committed',wb.target.key);},[storedCharacter,wb.target,wb.document]);


  const columns = useMemo(() => columnsFor(choiceScope?.wiki&&choiceScope.tab===kind&&choiceScope.entries.length>0&&choiceScope.entries.every(e=>e.kind==='feature')?'feature':kind, c?.edition==='2014'||!!c?.profile.optional.legacy||['2014','all'].includes(editionFilter)), [kind,c?.edition,c?.profile.optional.legacy,editionFilter,choiceScope]);
  const facets = useMemo(() => facetsFor(kind), [kind]);
  const categoryEntries = useMemo(() => {
    if (!c) return [];
    const candidates=choiceScope?.wiki&&choiceScope.tab===kind?new Set(choiceScope.entries.map(e=>e.id)):undefined;
    return libraryEntries.filter(e => (candidates?candidates.has(e.id):matchesLibraryTab(e,kind)&&(kind!=='class'||e.kind==='class')) &&
      wikiEditionAllows(e,c,editionFilter));
  }, [libraryEntries, c?.edition, c?.profile.optional.legacy, kind, editionFilter,choiceScope]);
  const {matches:matchesEntrySearch,status:searchStatus}=useEntrySearch(categoryQuery);
  const filtered = useMemo(() => categoryEntries.filter(e => matchesFacets(e, filters, facets)&&matchesEntrySearch(e,categoryQuery,sourceDisplay.registry[e.source]?.name)).sort((a, b) => compareEntries(a, b, columns.find(col => col.key === sort) || columns[0], descending,sourceDisplay.registry)), [categoryEntries, filters, facets, columns, sort, descending,sourceDisplay.registry,categoryQuery,matchesEntrySearch]);
  useEffect(() => { setException(''); }, [detail?.id]);
  useEffect(() => { if (detailPane.current && detail) { const pending=previewCommit.current;detailPane.current.scrollTop=pending?.id===detail.id?pending.top:libraryState.positions[detail.id]||0;previewCommit.current=undefined; } }, [kind, detail?.id, !!library.hover,library.navigationKey]);

  function sendCharacter(before:Character,after:Character,target=wb.target){
    if(!inWorkbench)return Promise.resolve();const id=after.id;
    workbenchDirty.current.add(id);workbenchPending.current.set(id,(workbenchPending.current.get(id)||0)+1);
    const project=(value:Character)=>roomRules?{...value,edition:roomRules.edition,profile:roomProfile!,rulePacks:roomRules.packs}:value;
    const projectedBefore=project(before),projectedAfter=project(after);
    return Promise.resolve(patchWorkbenchStats(before,after,evaluate(projectedBefore),evaluate(projectedAfter),target,{before:projectedBefore,after:projectedAfter})).then(()=>{workbenchFailed.current.delete(id);}).catch(e=>{workbenchFailed.current.add(id);if(e?.uncertain&&!e?.queueBlocked){const old=workbenchUncertain.current.get(id);workbenchUncertain.current.set(id,{requestId:e.requestId,before:old?.before||before,after:old&&old.after.revision>after.revision?old.after:after});}void saveRecovery(after).catch(()=>{});setSyncDiagnostic(diagnosticText(e));setNotice(`同步失败，已保留本地备份：${e instanceof Error?e.message:String(e)}`);throw e;}).finally(()=>{const pending=Math.max(0,(workbenchPending.current.get(id)||1)-1);workbenchPending.current.set(id,pending);if(!pending&&!workbenchUncertain.current.has(id))workbenchDirty.current.delete(id);appliedWorkbench.current='';setHistoryTick(x=>x+1);});
  }
  function rememberCharacter(before:Character,after:Character){const target=wb.target;
    const restore=async(from:Character,to:Character)=>{const w=workspaceRef.current!;const live=w.characters.find(c=>c.id===before.id);if(!live)throw Error('角色已经删除');if(inWorkbench){const currentAccess=getWorkbench();if(!target||!currentAccess.online||!currentAccess.cards.some(card=>card.id===target.cardId&&card.write))throw Error('当前角色的写入权限已改变，不能撤销或重做');}const canonical=(value:Character)=>{const result=structuredClone(value);for(const row of result.selections)delete row.entry.raw._suiteStatusId;return result;};const normalize=(value:Character)=>canonical(localSources?withSiteSources(value,w.siteSources,w.packs):value);const restored=applyPatch(normalize(live),normalize(from),normalize(to)) as Character;for(const row of restored.selections){const previous=live.selections.find(s=>s.id===row.id);if(previous?.entry.raw._suiteStatusId)row.entry.raw._suiteStatusId=previous.entry.raw._suiteStatusId;}restored.revision=live.revision+1;restored.updatedAt=new Date().toISOString();persist({...w,characters:w.characters.map(c=>c.id===restored.id?restored:c)});await sendCharacter(live,restored,target);};
    recordAction({label:after.name,undo:()=>restore(after,before),redo:()=>restore(before,after)});
  }
  const edit: Edit = (action, key) => {
    if(!automationRuntime){setNotice('正在加载编辑功能，请稍候。');return;}
    if (!writable.current) { setNotice('此标签页为只读。关闭另一编辑页并刷新后可继续。'); return; }
    const current = workspaceRef.current; if (!current) return;
    const character = current.characters.find(x => x.id === current.activeId)!;
    if(workbenchUncertain.current.has(character.id)){setNotice('上一项修改的结果尚未确认，本地修改已保留。请先核对枭熊数据。');return;}
    if(inWorkbench&&character.id.startsWith('suite:')&&(!wb.online||!wb.target?.write||workbenchCharacterId(wb.target)!==character.id)){setNotice('当前棋子不可编辑或已经切换');return;}
    const record = history.current.get(character.id) || { past: [], future: [], time: 0 };
    if (!key || record.key !== key || Date.now() - record.time > 900) record.past = [...record.past.slice(-59), character];
    record.future = []; record.key = key; record.time = Date.now(); history.current.set(character.id, record);
    const effective=inWorkbench&&roomRules?{...character,edition:roomRules.edition,profile:roomProfile!,rulePacks:roomRules.packs}:localSources?withSiteSources(character,current.siteSources,current.packs):character;
    const displayDraft=applyDisplayCharacterEdit(character,action);
    let draft:Character;
    if(displayDraft){if(displayDraft===character)return;draft=displayDraft;}
    else {draft=structuredClone(effective); const defaultChanged=initializeAutomation(draft); hydrateImportedCasting(draft,allEntries);if(defaultChanged){syncFeatures(draft,allEntries,undefined,catalogNames);syncAutoResources(draft,effective);} rememberSourceSpellUses(draft); action(draft); reconcileEquipping(effective,draft); syncFeatures(draft, allEntries,undefined,catalogNames); automationRuntime.syncSourceSpells(draft,allEntries); syncAutoResources(draft,effective); for(const id of Object.keys(draft.runtime.resources))if(!Object.hasOwn(effective.runtime.resources,id))ensureResourceWidget(draft,id); if (draft.quickbar) draft.quickbar = draft.quickbar.filter(id => draft.selections.some(s => s.id === id)); if(sameValue(effective,draft))return;} draft.updatedAt = new Date().toISOString(); draft.revision++;
    // Room rules are an evaluation view, not a migration of a character's identity.
    if(!displayDraft&&inWorkbench&&roomRules){draft.edition=character.edition;draft.profile=structuredClone(character.profile);draft.rulePacks=character.rulePacks;}
    persist({ ...current, characters: current.characters.map(x => x.id === draft.id ? draft : x) });
    rememberCharacter(character,draft);void sendCharacter(character,draft).catch(()=>{});setHistoryTick(x=>x+1);
  };
  async function saveDashboard(base:Character,draft:Character){
    const current=workspaceRef.current,character=current?.characters.find(row=>row.id===current.activeId);
    if(!current||!character||!writable.current||!automationRuntime||character.id!==base.id)throw Error('当前角色不可编辑或已经切换');
    if(workbenchUncertain.current.has(character.id))throw Error('上一项修改结果尚未确认，请先核对同步结果');
    if(inWorkbench&&(!wb.online||!wb.target?.write||workbenchCharacterId(wb.target)!==character.id))throw Error('当前棋子不可编辑或已经切换');
    const effective=inWorkbench&&roomRules?{...character,edition:roomRules.edition,profile:roomProfile!,rulePacks:roomRules.packs}:localSources?withSiteSources(character,current.siteSources,current.packs):character;
    const prepared=structuredClone(effective),initialized=initializeAutomation(prepared);hydrateImportedCasting(prepared,allEntries);
    if(initialized){syncFeatures(prepared,allEntries,undefined,catalogNames);syncAutoResources(prepared,effective);}else syncAutoResources(prepared);
    const next=commitDashboardDraft(prepared,base,draft,{gm:!inWorkbench||wb.role==='GM'});
    rememberSourceSpellUses(next);syncFeatures(next,allEntries,undefined,catalogNames);automationRuntime.syncSourceSpells(next,allEntries);syncAutoResources(next,effective);
    for(const id of Object.keys(next.runtime.resources))if(!Object.hasOwn(effective.runtime.resources,id))ensureResourceWidget(next,id);
    if(inWorkbench&&roomRules){next.edition=character.edition;next.profile=structuredClone(character.profile);next.rulePacks=character.rulePacks;}
    // A terminal failure may leave the optimistic local value in memory. Retain
    // the original outgoing baseline so explicit retry still sends its delta.
    const before=dashboardSaveBases.current.get(base)||character;dashboardSaveBases.current.set(base,before);
    next.revision=character.revision+1;next.updatedAt=new Date().toISOString();
    const local=persist({...current,characters:current.characters.map(row=>row.id===next.id?next:row)});
    if(!local)throw Error('当前角色无法保存');
    rememberCharacter(character,next);setHistoryTick(value=>value+1);
    // Keep the detached draft dirty until both persistence boundaries acknowledge.
    await settleDashboardSave([local,sendCharacter(before,next)]);
    dashboardSaveBases.current.delete(base);
    return workspaceRef.current?.characters.find(row=>row.id===next.id)||next;
  }
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
    if (!automationRuntime || !c || !workspace || !writable.current || inWorkbench) return;
    const draft = structuredClone(c);
    const castingChanged=hydrateImportedCasting(draft,allEntries);
    const featuresChanged=syncFeatures(draft, allEntries,undefined,catalogNames),resourcesChanged=syncAutoResources(draft),sourceSpellsChanged=automationRuntime.syncSourceSpells(draft,allEntries);
    if (featuresChanged || resourcesChanged || castingChanged || sourceSpellsChanged) { draft.revision++; draft.updatedAt = new Date().toISOString(); persist({ ...workspace, characters: workspace.characters.map(row => row.id === draft.id ? draft : row) }); }
  }, [mechanics, allEntries,automationRuntime]);
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
  function inspect(entry: Entry, push = true, from?:keyof typeof LIBRARY_TABS) { exitSheetFullscreen(); if(detail && !library.hover && detailPane.current)library.savePosition(detail.id,detailPane.current.scrollTop);const target=readingTarget(entry);if(library.hover){previewCommit.current={id:target.entry.id,top:detailPane.current?.scrollTop||0};setReadingFlash(n=>n+1);}else setReadingFlash(0);library.navigate(target.entry,target.focus,push,from);setTab('wiki'); }
  useEffect(()=>{const open=(event:Event)=>{const entry=(event as CustomEvent<Entry>).detail;if(entry?.id&&entry?.name&&entry?.kind){setTableOpen(false);inspect(allEntries.find(e=>e.id===entry.id)||(entry.id.startsWith('resource:')?allEntries.find(e=>e.name===entry.name):undefined)||entry);}};window.addEventListener('workbench-open-entry',open);return()=>window.removeEventListener('workbench-open-entry',open);});
  function resolveReference(reference: string, tag?: string) {
    if (reference.startsWith('entry:')) return c?.selections.find(s => s.entry.id === reference.slice(6)&&librarySourceEnabled(c,s.entry))?.entry || sourceEntries.find(e => e.id === reference.slice(6));
    const [name, source] = reference.split('|');
    const tagKind = ['quickref', 'variantrule', 'action', 'skill', 'sense', 'language', 'itemProperty', 'itemType', 'table', 'deity', 'facility'].includes(tag || '') ? 'rule' : ['optfeature', 'itemMastery', 'reward', 'charoption', 'psionic'].includes(tag || '') ? 'feature' : ['status', 'disease'].includes(tag || '') ? 'condition' : tag==='creature'?'monster':tag;
    const known = [...sourceEntries, ...(c?.selections.filter(s=>librarySourceEnabled(c,s.entry)).map(s => s.entry) || [])];
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
  function browse(kind: Kind | 'size',parent?:Entry) { exitSheetFullscreen(); setFillPulse(n=>n+1);setKind(kind); if (kind === 'subclass') { const owner = parent||c?.selections.find(s => s.entry.kind === 'class')?.entry; if (owner) {library.navigate(allEntries.find(e => e.id === owner.id) || owner,'subclasses');library.patch({subclassesOpen:true});} } setTab('wiki'); }
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
  async function readCards(ids:string[]):Promise<Character[]>{
    if(!inWorkbench)return ids.map(id=>{const card=workspaceRef.current?.characters.find(c=>c.id===id);if(!card)throw Error('角色已不存在');return withSiteSources(card,workspaceRef.current?.siteSources,workspaceRef.current?.packs||[]);});
    const cards:Character[]=[];
    for(const id of ids){
      if(id===wb.target?.cardId&&storedCharacter){cards.push(structuredClone(storedCharacter));continue;}
      const result=await workbenchRequest('readCard',{key:undefined,itemId:`card:${id}`});
      const card=result.document?.dnd_card_web?readCharacter(result.document.dnd_card_web).character:importOwlbear(result.document);
      cards.push(card);
    }
    return cards;
  }
  async function importTexts(texts:string[]){
    const cards=readCharacterTransfer(texts),w=workspaceRef.current!;
    const batch=cards.map(card=>{initializeAutomation(card);hydrateImportedCasting(card,allEntries);const effective=inWorkbench&&roomRules?{...card,edition:roomRules.edition,profile:roomProfile!,rulePacks:roomRules.packs}:withSiteSources(card,w.siteSources,w.packs);return {card,review:reviewImport(card,effective,c?.edition||card.edition)};});
    setPendingBatch(batch);setBatchUncertain(false);setImportError('');setModal('batchImport');
  }
  async function finishBatch(){
    if(!writable.current){setImportError('当前标签页只读，尚未导入任何角色');return;}
    if(batchBusy||batchUncertain)return;setBatchBusy(true);setImportError('');let completed=0;
    try{
      if(inWorkbench){for(const row of pendingBatch){await createRemoteCard(row.card,false);completed++;}}
      else{const w=workspaceRef.current!;persist({...w,characters:[...w.characters,...pendingBatch.map(r=>r.card)]});completed=pendingBatch.length;}
      setPendingBatch([]);setModal('characters');setNotice(`已导入 ${completed} 张角色卡。`);
    }catch(e){setPendingBatch(rows=>rows.slice(completed));if((e as {uncertain?:boolean}).uncertain)setBatchUncertain(true);setImportError(`已确认导入 ${completed} 张，剩余已停止：${String(e)}${(e as {uncertain?:boolean}).uncertain?' 请先在角色簿核对本次结果，不能重复提交。':''}`);}
    finally{setBatchBusy(false);}
  }
  async function removeCards(ids:string[]){
    if(!writable.current)throw Error('当前标签页只读，不能删除角色');
    if(inWorkbench){let done=0;try{for(const id of ids){await workbenchRequest('delete',{key:undefined,itemId:`card:${id}`});done++;}}catch(e){throw Error(`已删除 ${done} 张；其余已停止：${String(e)}`);}}
    else{const w=workspaceRef.current!;persist({...w,...deleteLocalCharacters(w.characters,w.activeId,ids)});}
  }
  async function createCards(names:string[],edition:Edition){
    if(!writable.current)throw Error('当前标签页只读，不能创建角色');
    const cards=names.map(name=>{const card=createLocalCharacter(edition);card.name=name;if(inWorkbench&&roomRules){card.profile=structuredClone(roomRules.profile);card.rulePacks=structuredClone(roomRules.packs);}return card;});
    if(inWorkbench){let done=0;try{for(const card of cards){await createRemoteCard(card,false);done++;}}catch(e){throw Object.assign(Error(`已创建 ${done} 张；其余已停止：${String(e)}`),{completed:done,uncertain:!!(e as {uncertain?:boolean}).uncertain});}}
    else{const w=workspaceRef.current!;persist({...w,characters:[...w.characters,...cards]});}
  }
  async function capturePages(pages:SheetPage[],options:SheetCaptureOptions){
    if(inWorkbench&&wb.target?.kind!=='character')throw Error('请先打开需要导出的五页人物角色卡');
    if(exportInProgress.current)throw Error('上一项导出尚未完成');
    exportInProgress.current=true;
    const original={page:sheetPage,editing,workbenchPage,tab,id:workspaceRef.current?.activeId};
    const result:{page:SheetPage;blob:Blob}[]=[];
    const settle=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    try{setExportView(options);setEditing(false);setWorkbenchPage('sheet');setTab('sheet');for(const page of (['主要','特性','背景','法术','背包'] as SheetPage[]).filter(p=>pages.includes(p))){setSheetPage(page);await settle();if(workspaceRef.current?.activeId!==original.id)throw Error('角色已切换，已停止导出');result.push({page,blob:await (await import('../platform/sheetImage')).captureSheet(options)});}return result;}
    finally{exportInProgress.current=false;setExportView(undefined);setSheetPage(original.page);setEditing(original.editing);setWorkbenchPage(original.workbenchPage);setTab(original.tab);}
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
        const imported=readCharacterTransfer([JSON.stringify(value)]);
        if(imported.length>1){await importTexts([JSON.stringify(value)]);return;}
        const character=imported[0];
        hydrateImportedCasting(character,allEntries);
        character.id = uid(); character.revision = 1; character.name += '（导入）';
        const effective=inWorkbench&&roomRules?{...character,edition:roomRules.edition,profile:roomProfile!,rulePacks:roomRules.packs}:withSiteSources(character,w.siteSources,w.packs);
        const review=reviewImport(character,effective,c?.edition||character.edition);
        if(review.editionMismatch||review.disabled.length){setPendingImport({card:character,review});setModal('importReview');return;}
        await finishImport(character);
      }
    } catch (error) { setImportError(error instanceof Error ? error.message : String(error)); }
  }
  async function saveClassCopy(plan:ClassMigrationPlan){
    if(!writable.current||readOnly||inWorkbench&&(!wb.online||!wb.target?.write))throw Error('当前角色不可写，请先恢复连接或写入权限。');
    await queue.current;
    const w=workspaceRef.current!,original=w.characters.find(card=>card.id===plan.originalId);
    if(!original||original.revision!==plan.originalRevision||w.activeId!==plan.originalId||!migrationStillCurrent(plan,inWorkbench?c!:withSiteSources(original,w.siteSources,w.packs)))throw Error('角色记录或规则已变化，请重新打开资料同步并预览。');
    if(inWorkbench){await createRemoteCard(plan.card);setNotice('同步副本已创建，原卡仍保留在角色簿中。');return;}
    const next=ensureSiteSources({...w,characters:[...w.characters,plan.card],activeId:plan.card.id});
    // Reserve the queued workspace before I/O; later saves retain the new copy.
    workspaceRef.current=next;pendingSaves.current++;setSaving('保存同步副本…');
    const operation=queue.current.catch(()=>{}).then(()=>saveWorkspace(next));
    queue.current=operation.catch(()=>{});
    try{await operation;if(workspaceRef.current===next)restoredWorkspacePendingSave.current=false;setWorkspace(workspaceRef.current);saveFailed.current=false;setSaving('已保存到本机');setModal('');setNotice('同步副本已保存。原卡仍在角色簿中，可随时切回。');}
    catch(e){if(workspaceRef.current===next){workspaceRef.current=w;setWorkspace(w);}setSaving('保存失败');saveFailed.current=true;throw Error(`同步副本保存失败，原卡保留。${String(e)}`);}
    finally{pendingSaves.current--;}
  }
  async function finishImport(character:Character){
    initializeAutomation(character);
    if(inWorkbench)await createRemoteCard(character);else{const w=workspaceRef.current!;persist({...w,characters:[...w.characters,character],activeId:character.id});setModal('export');}
    setPendingImport(undefined);setNotice(inWorkbench?'角色已导入枭熊角色簿。':'角色已作为新副本导入。');
  }
  async function createRemoteCard(card:Character,select=true){
    initializeAutomation(card);
    if(!wb.online)throw Error('枭熊未连接，角色尚未导入。');
    if(remoteCreatePending.current)throw Error('正在创建角色，请等待当前操作完成。');
    remoteCreatePending.current=true;setCreatingCard(true);
    try{const data={...exportOwlbear(card,evaluate(card)),dnd_card_web:card};const result=await workbenchRequest('createCard',{key:undefined,itemId:undefined,data});if(select){chooseWorkbench(`card:${result.created.id}`);setModal('');setWorkbenchPage('sheet');setSheetPage('主要');setTab('sheet');}}finally{remoteCreatePending.current=false;setCreatingCard(false);}
  }
  async function createRemote(edition:Edition){
    if(creatingCard||!wb.online)return;
    try{const card=newCharacter(edition);if(roomRules){card.profile=structuredClone(roomRules.profile);card.rulePacks=structuredClone(roomRules.packs);}await createRemoteCard(card);}catch(e){setNotice(String(e));}
  }
  function create(edition: Edition, copy = false, automatic = false) {
    if (!workspace || !c) return; const next = copy ? structuredClone(c) : createLocalCharacter(edition); next.id = uid(); next.name = copy ? `${c.name}（副本）` : next.name; next.createdAt = next.updatedAt = new Date().toISOString(); next.revision = 1;if(automatic)next.automation=newAutomationState();
    persist({ ...workspace, characters: [...workspace.characters, next], activeId: next.id }); setModal(''); setSheetPage('主要'); setTab('sheet');
  }
  const renderSelection = (s: Selection) => <Selected key={s.id} s={s} c={c!} edit={edit} inspect={inspect}/>;
  const selections = (kinds: Kind[]) => c?.selections.filter(s => kinds.includes(s.entry.kind)).map(renderSelection);
  const addButton = (kind: Kind) => <button className="sheet-add" onClick={() => browse(kind)}>＋ 查阅{KIND_LABELS[kind]}</button>;


  if (!workspace || !c || !d) return <main className="startup"><h1>{standalone?t('cardBrand'):'Full Suite'}</h1>{startupError ? <><p role="alert">本机记录读取失败：{startupError}</p><p>现有记录尚未覆盖。可以尝试恢复上一次保存。</p><button onClick={async () => { try { const backup = await restoreBackup(); if (!backup) throw new Error('没有可用备份'); acceptWorkspace(backup,true); } catch (e) { setStartupError(String(e)); } }}>读取备份</button><button onClick={() => { const next = createLocalCharacter(); workspaceRef.current = { schemaVersion: 1, characters: [next], activeId: next.id, packs: [] }; setWorkspace(workspaceRef.current); setNotice('临时工作区。第一次编辑将保存新记录；请先导出重要数据。'); }}>使用新的临时工作区</button></> : <p>正在打开你的角色卡…</p>}</main>;
  void historyTick;
  const blocked = detail ? candidateReason(c, detail) : '';
  const dragDisabledReason=
    readOnly?'当前标签页只读，另一标签页正在编辑。关闭另一编辑页并刷新后可继续。':
    inWorkbench&&!wb.online?'枭熊连接已断开，请等待重连后再拖入。':
    inWorkbench&&!wb.target?.write?'当前棋子没有编辑权限，请选择可编辑的角色卡。':
    inWorkbench&&c.id.startsWith('suite:')&&wb.target&&workbenchCharacterId(wb.target)!==c.id?'选中的棋子已经切换，请等待角色资料加载完成。':
    workbenchUncertain.current.has(c.id)?'上一项修改尚未确认，请先核对枭熊数据。':undefined;
  const managerId=inWorkbench?wb.target?.cardId||'':c.id;
  const managerRows:CharacterRow[]=!['characters','export'].includes(modal)?[]:inWorkbench?wb.cards.map(row=>({id:row.id,name:row.name,player:row.player,write:row.write,locked:row.locked,inScene:row.inScene,hp:row.stats?.health,maxHp:row.stats?.['max health'],ac:row.stats?.['armor class']})):workspace.characters.map(row=>({...localCharacterRow(withSiteSources(row,workspace.siteSources,workspace.packs)),write:!readOnly}));
  return <OverviewDashboardHost><SheetChoicesContext.Provider value={choicesSnapshot}><ChoiceWorkspaceContext.Provider value={{id:activeChoice?.id,open:openChoice,close:closeChoice}}><KeywordPreview readableEntry={inWorkbench?entry=>{const same=(row:Entry)=>row.id===entry.id&&row.source===entry.source&&row.packId===entry.packId&&row.edition===entry.edition;return selectedEntries.find(same)||allEntries.find(same);}:undefined} isExcluded={entry=>explicitlyExcluded(c,entry)} resolve={resolveReference} open={link} sheetPreview={entry=>library.preview(entry&&librarySourceEnabled(c,entry)?readingTarget(entry):undefined)} sheetCommit={entry=>inspect(entry)}><EntryDragProvider preservePage={!!activeChoice} editing={editing&&(!inWorkbench||!!wb.target?.write)} disabledReason={dragDisabledReason} character={c} receive={entry => add(entry)}><div className="app-shell compact-layout" data-workbench-page={inWorkbench?workbenchPage:undefined} onDragStart={event => event.preventDefault()}>
    <header className="app-header"><a className="brand" href="#" onClick={e => { e.preventDefault();setTab('sheet');if(inWorkbench)setWorkbenchPage('console'); }}><img className="brand-logo" src={startupComplete?'./exe_icon.png':undefined} alt=""/><strong>{standalone?t('cardBrand'):'Full Suite'}</strong></a>
      <div className="header-tools">{inWorkbench&&wb.enabled.threeDragonAnte!==false&&<button aria-pressed={tableOpen} onClick={()=>setTableOpen(value=>!value)}>{t('threeDragon')}</button>}{inWorkbench&&<button aria-pressed={workbenchPage==='features'} onClick={()=>{setWorkbenchPage('features');setTab('sheet');}}>{t('featuresToggle')}</button>}{inWorkbench&&<button aria-pressed={workbenchPage==='settings'} onClick={()=>{setWorkbenchPage('settings');setTab('sheet');}}>{t('settings')}</button>}{(standalone||inWorkbench)&&<button onClick={()=>setAnnouncement(true)}>{t('announcements')}</button>}<button onClick={() => setModal('characters')}>{t('characters')} <span>{inWorkbench?wb.cards.length:workspace.characters.length}</span></button><button onClick={() => setModal('rules')}>{t('rules')}</button><button className="primary" onClick={() => setModal('export')}>{t('transfer')}</button></div>
    </header>
    {inWorkbench&&<><WorkbenchBar classWarnings={roomClassWarnings} online={wb.online} target={wb.target} message={wb.message} page={workbenchPage} change={page=>{setWorkbenchPage(page);setTab('sheet');}} save={()=>{if(!wb.target||c.id!==workbenchCharacterId(wb.target)){setNotice('当前角色与选中的棋子不一致');return;}void workbenchRequest('save',{native:c,data:exportOwlbear(c,d)}).then(()=>{workbenchDirty.current.delete(c.id);setNotice('已保存角色资料到枭熊');}).catch(e=>setNotice(String(e)));}}/></>}
    {readOnly && <div className="read-only-banner" role="status">另一标签页正在编辑，此页仅供查阅和导出。关闭另一页后将自动读取最新记录并接手。<button onClick={() => location.reload()}>重新检查</button></div>}
    {activateUpdate && <div className="read-only-banner" role="status">网页有新版本。<button onClick={async () => { await queue.current; if (saveFailed.current) { setNotice('保存未成功，请先导出角色备份，再重新打开网页。'); return; } navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); activateUpdate(); }}>保存后更新</button></div>}
    <nav className="mobile-tabs" aria-label={t('workspace')}><button className={tab === 'sheet' ? 'active' : ''} onClick={() => setTab('sheet')}>{t('functionalPage')}</button><button className={tab === 'wiki' ? 'active' : ''} onClick={() => setTab('wiki')} hidden={!wikiVisible}>Wiki</button></nav>
    <main className={`workspace ${wikiVisible?'':'wiki-hidden'}`}>
      <section data-inventory-recipient={inWorkbench&&workbenchPage==='sheet'&&wb.target?wb.target.cardId?`card:${wb.target.cardId}`:`monster:${wb.target.itemId}`:undefined} className={`sheet-pane ${tab === 'sheet' ? 'mobile-active' : ''} ${editing&&(!inWorkbench||workbenchPage==='sheet'&&wb.target?.write)&&!exportView?'sheet-editing':''}`} aria-label={t('cardWorkspace')}>
        {inWorkbench&&workbenchPage==='music'?<MusicWorkspace close={()=>setWorkbenchPage('console')}/>:inWorkbench&&['settings','features'].includes(workbenchPage)?<WorkbenchPanel key={workbenchPage} panel="settings" section={workbenchPage==='features'?'features':undefined} close={()=>setWorkbenchPage('console')}/>:inWorkbench&&workbenchPage==='notes'&&wb.role==='GM'?<DmNotes/>:inWorkbench&&workbenchPage==='dice'?<DicePage online={wb.online} target={wb.target} rolls={wb.rolls} compose={wb.compose}/>:inWorkbench&&workbenchPage==='console'?<DMConsole navigate={setWorkbenchPage}/>:inWorkbench&&(!wb.target||wb.target.kind==='character'&&(!wb.document||c.id!==workbenchCharacterId(wb.target)||workbenchReadError?.key===wb.target.key))?<div className="workbench-monster">{workbenchReadError&&workbenchReadError.key===wb.target?.key?<p role="alert">{workbenchReadError?.message}。原始资料保留，请选择其他角色或重新读取角色簿。</p>:<p role="status">{wb.loading||wb.document?'读取角色资料…':'从上方选择角色卡'}</p>}</div>:inWorkbench&&(wb.target?.kind==='monster'||wb.target?.kind==='token')?<WorkbenchMonster editing={editing} setEditing={setEditing} key={wb.target.key} target={wb.target} raw={wb.document} online={wb.online} onLink={link}/>:<>
        <div className="pane-toolbar"><div><span className="eyebrow">{t('card')}</span>{!inWorkbench&&<CharacterTabs characters={workspace.characters} activeId={c.id} warnings={classWarnings} label={t('currentCharacter')} select={id=>{if(confirmResourceDraftDiscard())persist({...workspace,activeId:id});}}/>}</div>
          <div className="toolbar-actions">{<button className="automation-toggle" aria-label={t('automationSettings')} onClick={()=>setModal('automation')}>{t('automation')} · {t(automationEnabled(c)?'on':'manual')}</button>}{inWorkbench&&(workbenchUncertain.current.has(c.id)||workbenchFailed.current.has(c.id))&&<button className="sync-review-button" onClick={()=>setModal('syncReview')}>{t('syncReview')}</button>}<SheetFullscreenButton/><button aria-label={t('undo')} disabled={!actionHistory.undo} onClick={() => undo()}>↶</button><button aria-label={t('redo')} disabled={!actionHistory.redo} onClick={() => undo(true)}>↷</button><SheetDisplayButton/><button disabled={!automationRuntime||inWorkbench&&!wb.target?.write} className="edit-mode-toggle" role="switch" aria-checked={editing} aria-label={t('editMode')} onClick={() => setEditing(v => !v)}><span className="edit-switch-track"><i/></span>{t('editMode')}</button></div>
        </div>
        {editingLoadError&&<aside className="editing-load-error" role="alert"><p>编辑功能加载失败。检查网络后可重新加载，角色资料已保留。</p><div><button disabled={editingReloadPending} onClick={()=>void reloadSavedWorkspace()}>保存后重新加载编辑功能</button><button onClick={()=>download(`${fileName(c.name)}-角色备份.json`,exportCharacter(c))}>导出角色备份</button><details><summary>错误详情</summary><pre>{editingLoadError}</pre></details></div></aside>}
        {showClassReview&&<aside className="class-compatibility-banner" role="status"><p>当前角色的职业尚未关联资料库，或与当前 {c.edition} 职业规则不同。可以核对并同步；其他自定义内容不会触发此提醒。</p><button onClick={()=>setModal('classSync')}>核对并同步旧卡</button></aside>}
        <SheetEditContext.Provider value={editing&&!readOnly&&(!inWorkbench||wb.online&&!!wb.target?.write)}><ValueTraceProvider c={c} d={d} enabled={editing&&(!inWorkbench||!!wb.target?.write)}><PaperFrame effectsEnabled={!exportView?.hideConditions} character={c} page={sheetPage} changePage={page => { setSheetPage(page); setTab('sheet'); }}>
          <div className="paper-heading"><span>DUNGEONS &amp; DRAGONS</span><span className="paper-heading-right">{storedCharacter?.edition||c.edition}{storedCharacter?.edition!==c.edition&&` · ${t('room')} ${c.edition}`}{editing&&<Palette c={c} edit={edit}/>}<button className="card-lock" aria-label={c.locked?'解锁角色卡':'上锁角色卡'} aria-pressed={!!c.locked} disabled={inWorkbench&&(!wb.online||!wb.target?.write)} onClick={()=>{if(inWorkbench)void workbenchRequest('lock',{locked:!c.locked}).catch(e=>setNotice(String(e)));else edit(draft=>{draft.locked=!draft.locked;});}}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="10" width="14" height="11" rx="1"/><path d={c.locked?'M8 10V6a4 4 0 018 0v4':'M8 10V6a4 4 0 018 0'}/><path d="M12 14v3"/></svg></button></span></div>
          {sheetPage === '主要' ? <><Overview catalog={allEntries} statusRibbon={<div className="edition-divider"><span/><strong>{t('cardTitle')}{classEditionSuffix(c)}</strong><FeaturePanel inline grouped={false} label="状态" kinds={['condition']} c={c} rows={c.selections.filter(s => s.entry.kind === 'condition')} edit={edit} browse={() => browse('condition')} onLink={link} receive={entry => add(entry)}/><span/></div>} addEntry={(entry, section) => add(entry, false, section)} onLink={link} c={c} d={d} edit={edit} browse={browse} inspect={inspect} renderSelection={renderSelection} openResources={() => {setEditingResource('');setModal('resources');}} openQuickbar={()=>setModal('quickbar')} openHp={()=>setModal('hp')} pinDrop={entry => add(entry, true)}/>
</> : <ToolBoundary key={sheetPage} label={sheetPage} close={()=>setSheetPage('主要')}><Suspense fallback={<p role="status">正在加载这一页…</p>}><div className="sheet-details">
          <div className="edition-divider"><span/><strong>{t('cardTitle')}{classEditionSuffix(c)}</strong><FeaturePanel inline grouped={false} label="状态" kinds={['condition']} c={c} rows={c.selections.filter(s => s.entry.kind === 'condition')} edit={edit} browse={() => browse('condition')} onLink={link} receive={entry => add(entry)}/><span/></div>
          <DetailHeader openSpellAbility={()=>setModal('spellAbility')} page={sheetPage} c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>
          {sheetPage==='特性'?<FeaturesPage entries={allEntries} c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>:sheetPage==='背景'?<BackgroundPage c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>:sheetPage==='法术'?<SpellsPage entries={allEntries} c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>:inWorkbench?<WorkbenchInventory id={`card:${wb.target!.cardId}`} capacity={<CarryCapacity c={c} d={d} edit={edit}/>}/>:<InventoryPage c={c} d={d} edit={edit} browse={browse} inspect={inspect} onLink={link} add={add}/>}
        </div></Suspense></ToolBoundary>}
          <footer className="paper-footer"><span>{t('cardFooter',{edition:c.edition,level:d.level||'—',revision:c.revision})}</span><span>{t('snapshotSaved')}</span></footer>
        </PaperFrame></ValueTraceProvider></SheetEditContext.Provider><div className={`save-status ${saving === '保存失败' ? 'error' : ''}`} role="status"><span className="status-dot"/>{inWorkbench?(workbenchUncertain.current.has(c.id)?'待核对 · 本地修改已保留':workbenchDirty.current.has(c.id)?'正在同步至枭熊…':workbenchFailed.current.has(c.id)?'同步失败 · 已保留本地备份':wb.target?.projectionPending?'资料已保存 · 棋子显示待同步':wb.online?'与枭熊同步':'等待枭熊重连'):saving}{workbenchUncertain.current.has(c.id)&&wb.document&&<button onClick={()=>{window.dispatchEvent(new CustomEvent('workbench-operation-reconciled',{detail:{requestId:workbenchUncertain.current.get(c.id)?.requestId}}));workbenchUncertain.current.delete(c.id);workbenchDirty.current.delete(c.id);workbenchFailed.current.delete(c.id);workbenchDocuments.current.delete(c.id);appliedWorkbench.current='';setHistoryTick(n=>n+1);setNotice('已采用枭熊当前数据；未确认的本地修改仍保留在恢复备份中。');}}>核对并采用枭熊数据</button>}{syncDiagnostic&&<CopyDiagnostic text={syncDiagnostic}/>}<span>{inWorkbench?'角色资料自动保存':'资料与角色保存在当前浏览器 · 请定期导出'}</span></div></>}
      </section>

      {wikiVisible&&<><WorkspaceSplitter/><section className={`wiki-pane ${tab === 'wiki' ? 'mobile-active' : ''}`} aria-label="规则资料">{wikiUi?(()=>{const {WikiLayout,WikiEmptyPrompt,GlobalSearch,LibraryFilters,CatalogList,WikiSplitter,CustomEntryEditor,ClassNavigation,MonsterDocument,MonsterPortrait,LibraryDocument}=wikiUi;return <WikiLayout><div className="wiki-header"><div><span className="eyebrow">规则资料</span><span className="wiki-source">5etools 中文站</span></div><button title="重新检查上游资料" disabled={loading} onClick={() => load(true)}>{loading ? '加载中…' : '更新资料'}</button></div>
        <GlobalSearch query={query} change={setQuery} entries={libraryEntries} c={c} inspect={entry=>{inspect(entry);library.patch({query:"",filters:{},edition:entry.edition==="both"?"all":entry.edition},tabOf(readingTarget(entry).entry));}}/>
        <nav className="category-tabs" aria-label="资料分类">{Object.entries(LIBRARY_TABS).filter(([key])=>(key!=='custom'||canAuthor)&&(key!=='monster'||monstersVisible)&&(key!=='weaponMastery'||c.edition==='2024'||editionFilter==='2024'||editionFilter==='all')).map(([key, label]) => <button key={key} className={kind === key ? 'active' : ''} onClick={() => setKind(key as keyof typeof LIBRARY_TABS)}>{label}</button>)}</nav>
        {choiceScope?.wiki&&<div className="wiki-choice-notice"><span>选择{activeChoice!.label} · 拖拽加入左侧空格</span><button onClick={()=>setTab('sheet')}>查看选择</button><button onClick={closeChoice}>退出选择</button></div>}<div className="wiki-filters"><ClearableSearch className="category-search-control" label={`${LIBRARY_TABS[kind]}分类搜索`} clearLabel="清空分类搜索" placeholder={`搜索${LIBRARY_TABS[kind]}`} value={categoryQuery} change={query=>library.patch({query})}/><select aria-label="资料版本" value={editionFilter} onChange={e => setEditionFilter(e.target.value)}><option value="character">跟随角色 · {c.edition}</option><option value="2014">2014 规则</option><option value="2024">2024 规则</option><option value="all">所有版本</option></select><LibraryFilters tab={kind} entries={categoryEntries} filters={filters} change={filters => library.patch({ filters })} names={bookNames}/>
        </div>
        <div className="catalog-status"><span>{loading || progress.paused ? `${progress.done}/${progress.total} 份资料${progress.paused?' · 已暂停':''}` : `${libraryEntries.length.toLocaleString()} 条资料`}{progress.cached > 0 ? ` · ${progress.cached} 份缓存` : ''}</span><span role={searchStatus?"status":undefined}>{searchStatus||`${filtered.length} 条符合筛选`}</span></div>
        {progress.paused && <p className="load-paused" role="status">{progress.paused}尚有资料未读。</p>}
        {(progress.failed.length > 0 || progress.paused) && <details className="load-errors"><summary>{progress.failed.length} 份资料读取异常 · 可重试</summary>{progress.failed.map((e, i) => <p key={i}>{e}</p>)}<button disabled={loading} onClick={() => load(false,progress.retry)}>重试加载</button></details>}
        <div className={`library-body ${detail ? 'has-detail' : ''}`} data-library-tab={kind}><CatalogList entries={filtered} columns={columns} kind={kind} character={c} selected={detail} inspect={entry=>inspect(entry,true,kind)} sort={sort} descending={descending} onSort={key=>library.patch({sort:key,descending:sort===key?!descending:false})} resetKey={JSON.stringify([kind,filters,editionFilter,sort,descending,categoryQuery])} loading={loading} onSettings={()=>setModal('rules')} pulse={fillPulse}/>
        <WikiSplitter/>{kind==='custom'&&canAuthor&&<><CustomEntryEditor newEntry={()=>setDetail(undefined)} entry={detail?.raw._workbenchCustom?detail:undefined} busy={rulesBusy} save={entry=>changeCustom(entry)} remove={entry=>changeCustom(entry,true)}/></>}
        {detail && <article key={`${detail.kind}:${detail.id}`} className={`entry-detail ${explicitlyExcluded(c,detail)?'entry-disabled':''} ${library.hover?'is-sheet-preview':readingFlash?'sheet-preview-committed':''} ${library.focus?'has-reading-focus':''}`} data-described-entry={detail.id} data-entry-kind={detail.kind} ref={detailPane} onScroll={e => { if(!library.hover)library.savePosition(detail.id, e.currentTarget.scrollTop); }}><div className="detail-frozen"><div className="detail-navigation"><button disabled={!library.canGoBack} onClick={library.back}>← 上一条</button><button aria-label="收起正文" onClick={() => { setDetail(undefined); }}>×</button></div><div className="detail-heading">{detail.kind==='monster'&&<MonsterPortrait entry={detail}/>}<EntryBadges entry={detail}/><span className="eyebrow">{KIND_LABELS[detail.kind]} · {entryEdition(detail) === 'both' ? '通用资料' : entryEdition(detail)}</span><h1><EntryDraggable className="detail-title" entry={detail} >{uiEntryLabel(detail,language)}{detail.english !== detail.name && <small className="english-name"> {language==='en'?detail.name:detail.english}</small>}</EntryDraggable></h1><small>{detail.raw._authoredBy ? `${detail.raw._authoredBy} · ` : ''}<SourceName id={detail.source}/>{detail.page ? ` · 第 ${detail.page} 页` : ''}</small></div><ClassNavigation subclassesOpen={!!libraryState.subclassesOpen} onToggleSubclasses={()=>library.patch({subclassesOpen:!libraryState.subclassesOpen})} entry={detail} entries={libraryEntries} character={c} navigate={(entry,focus)=>library.navigate(entry,focus)}/></div>
          {detail.kind==='monster'?<ContentBoundary key={detail.id}><MonsterDocument entry={detail} onLink={link}/></ContentBoundary>:<><ContentBoundary key={`facts:${detail.id}`}><EntryFacts entry={detail} onLink={link}/></ContentBoundary>
          <LibraryDocument editionFilter={editionFilter} subclassesOpen={!!libraryState.subclassesOpen} preview={!!library.hover} highlight={readingFlash} focus={library.focus} character={c} entry={detail} entries={allEntries} onLink={link} inspect={inspect} collapsed={libraryState.collapsed[detail.id] || []} onCollapse={ids => library.patch({ focus:undefined, collapsed: { ...libraryState.collapsed, [detail.id]: ids } })}/></>}

          <RawDetails key={detail.id} entry={detail}/>
          <div className="detail-actions">{blocked && <p className="inline-warning">{blocked}</p>}<a href={DEFAULT_SOURCE} target="_blank" rel="noreferrer">在中文站查阅 ↗</a>
          {blocked === '此来源或规则版本未启用' && <details><summary>记录 DM 特许</summary><p>仅对此条目启用；会随角色及审卡导出保留。</p><input aria-label="DM 特许说明" value={exception} placeholder="填写原因或 DM 的裁定" onChange={e => setException(e.target.value)}/><button disabled={rulesReadonly||!exception.trim()} onClick={() => editRules(draft => { draft.profile.exceptions[detail.id] = exception.trim(); })}>保存特许</button></details>}
          {c.profile.exceptions[detail.id] && <p>DM 特许：{c.profile.exceptions[detail.id]} <button disabled={rulesReadonly} onClick={() => editRules(draft => { delete draft.profile.exceptions[detail.id]; })}>撤回</button></p>}</div>
        </article>}{!detail && kind!=='custom' && <div className="reading-placeholder"><WikiEmptyPrompt/></div>}</div></WikiLayout>;})():<div className="wiki-loading" role="status">{wikiUiError?<><p>Wiki 加载失败，角色卡仍可编辑和保存。</p><button onClick={async()=>{await queue.current;if(saveFailed.current){setNotice('保存未成功，请先导出角色备份。');return;}location.reload();}}>保存后重新加载</button><details><summary>错误详情</summary><pre>{wikiUiError}</pre></details></>:<>角色卡已打开，正在加载 Wiki…</>}</div>}
        <footer className="wiki-footer">{inWorkbench&&<a href="https://obr.dnd.center/card/" target="_blank" rel="noreferrer">单机版 ↗</a>}<a href={inWorkbench?'./source.zip':'https://github.com/FullPeople/DND-card-web'} target="_blank" rel="noreferrer">源码 ↗</a><a href="https://github.com/FullPeople/DND-card-web/blob/main/LICENSE" target="_blank" rel="noreferrer">非商用共享许可 ↗</a></footer>
      </section></>}
    </main>
    {inWorkbench&&tableOpen&&<ThreeDragonFullscreen close={()=>setTableOpen(false)}/>}
    {standalone?<LocalDice/>:<SupporterEffect/>}{(standalone||inWorkbench)&&startupComplete&&announcement&&<Suspense fallback={<p role="status">正在加载公告…</p>}><Announcement mode={inWorkbench?"suite":"standalone"} close={()=>setAnnouncement(false)}/></Suspense>}{notice&&<Toast message={notice} action={!editing&&(!inWorkbench||!!wb.target?.write)&&/开启编辑模式/.test(notice)?{label:'开启编辑模式',run:()=>{setEditing(true);setNotice('');}}:undefined} details={notice===noticeDiagnostic?.message?noticeDiagnostic.diagnostic:notice.startsWith('同步失败')?syncDiagnostic:undefined} close={()=>setNotice('')}/>}
    {modal && <Dialog title={modal==='onboarding'?'开始使用角色卡':modal==='classSync'?'旧卡资料同步':modal==='automation'?'基础自动化':modal==='review'?'DM 审卡':modal==='batchImport'?'批量导入前核对':modal==='spellAbility'?'施法属性':modal==='syncReview'?'核对同步结果':modal==='importReview'?'导入前核对':modal==='personal'?'条目与等级':modal==='hp'?'生命值取值方式':modal === 'characters' ? '角色簿' : modal === 'rules' ? '规则与扩展' : modal === 'export' ? '导入与导出' : modal === 'adjust' ? '数值依据与人工修正' : modal === 'resources' ? editingResource?'资源配置':'仪表盘' : modal === 'quickbar' ? '整理快捷栏' : '让角色卡带你完成选择'} close={() => { if(!batchBusy&&!classSyncBusy&&!exportInProgress.current){if(modal==='onboarding'){completeSetup();return;}setModal(''); setImportError('');} }}>
      <ToolBoundary key={modal} label="编辑面板" close={()=>setModal('')}><Suspense fallback={<p role="status">正在加载面板…</p>}>
      {importError && <p className="inline-error" role="alert">导入未生效：{importError}</p>}
      {modal === 'adjust' && <><ArmorAdjustmentReview c={c} edit={edit}/><p className="muted">以下其他数值在特殊规则尚未适配时可填写最终值与原因，持续保留到手动撤回，并列入审卡。</p><div className="adjust-form"><label>数值<select aria-label="人工修正目标" value={adjustTarget} onChange={e => setAdjustTarget(e.target.value)}>{[['hp', '生命值上限'], ['speed', '速度'], ['initiative', '先攻'], ['passive', '被动察觉'], ...Object.entries(SKILLS).map(([key, s]) => [`skill:${key}`, `${s.name}检定`]), ...ABILITIES.map(a => [`save:${a}`, `${ABILITY_LABELS[a]}豁免`])].map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>最终值<NumberInput aria-label="人工修正数值" type="number" min="-9999" max="9999" value={adjustValue} onChange={e => setAdjustValue(clamp(e.target.value, -9999, 9999))}/></label><label className="full-width">原因<input aria-label="人工修正原因" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="例如：DM 允许的生命值修正，或尚未适配的专长"/></label><button disabled={!adjustReason.trim()} onClick={() => { edit(draft => { draft.adjustments = [...(draft.adjustments || []).filter(a => a.target !== adjustTarget), { id: uid(), target: adjustTarget, value: adjustValue, reason: adjustReason.trim() }]; }); setAdjustReason(''); }}>记录修正</button></div>{(c.adjustments || []).filter(a=>a.target!=='ac').map(a => <div className="pack-row" key={a.id}><span><strong>{a.target} → {a.value}</strong><small>{a.reason}</small></span><button onClick={() => edit(draft => { draft.adjustments = draft.adjustments?.filter(x => x.id !== a.id); })}>撤回</button></div>)}<details className="calculation-trace"><summary>展开计算依据</summary>{Object.entries(d.trace).map(([key, items]) => <p key={key}><strong>{choiceLabel(key)}</strong>：{items.join('；')}</p>)}</details></>}
      {modal==='classSync'&&<CardMigration key={c.id} c={c} entries={allEntries} loading={loading} readOnly={readOnly||inWorkbench&&(!wb.online||!wb.target?.write)} save={saveClassCopy} busy={classSyncBusy} setBusy={setClassSyncBusy}/>}
      {modal==='automation'&&<AutomationPanel c={c} d={d} entries={allEntries} edit={edit} copy={inWorkbench?undefined:()=>create(c.edition,true,true)} writable={!readOnly&&(!inWorkbench||!!wb.target?.write)}/>}
      {modal === 'quickbar' && <QuickbarManager c={c} edit={edit}/>}
      {modal === 'resources' && (editingResource?<ResourceModuleEditor key={editingResource} c={c} id={editingResource} edit={edit} close={()=>setModal('')} disabled={readOnly||inWorkbench&&(!wb.online||!wb.target?.write)} gm={!inWorkbench||wb.role==='GM'}/>:<ResourceDashboard onSave={saveDashboard} c={c} d={d} edit={edit} inspect={inspect} viewport={resourceViewport} disabled={readOnly||inWorkbench&&(!wb.online||!wb.target?.write)} gm={!inWorkbench||wb.role==='GM'}/>)}
      {modal==='syncReview'&&<section><p>{workbenchUncertain.current.has(c.id)?'上一项修改尚未得到确认。本地修改已备份，核对期间不会重放未确认的操作。':'本地修改已有恢复备份，可重新读取枭熊保存的结果。'}</p><div className="dialog-actions"><button disabled={!wb.online} onClick={()=>void workbenchRequest('refreshCard',{itemId:wb.target?.targetId||(wb.target?.cardId?`card:${wb.target.cardId}`:wb.target?.itemId),key:undefined}).then(()=>setNotice('已重新读取枭熊数据。')).catch(e=>{setSyncDiagnostic(diagnosticText(e));setNotice(String(e));})}>重新核对保存结果</button><button onClick={()=>download(`${fileName(c.name)}-本地恢复.json`,exportCharacter(c))}>导出本地修改</button><CopyDiagnostic text={syncDiagnostic||JSON.stringify(workbenchDiagnostics(),null,2)}/></div></section>}
      {modal==='importReview'&&pendingImport&&<section><h3>{pendingImport.card.name}</h3>{pendingImport.review.editionMismatch&&<p>导入角色使用 {pendingImport.card.edition}，当前规则使用 {c.edition}。{pendingImport.review.editionChanged?'房间规则将用于计算此角色。':'导入后保留该角色自己的规则版本。'}</p>}{pendingImport.review.totalLevel!==pendingImport.review.effectiveLevel&&<p role="alert">原卡总等级 {pendingImport.review.totalLevel}，当前启用来源下的计算等级 {pendingImport.review.effectiveLevel}。职业与等级记录会保留。</p>}{pendingImport.review.disabled.length>0&&<><p>以下 {pendingImport.review.disabled.length} 项在当前规则或资料来源中未启用，保留条目但暂停效果：</p><ul className="import-conflicts">{pendingImport.review.disabled.map(s=><li key={s.id}>{s.entry.name} · <SourceName id={s.entry.source}/></li>)}</ul></>}<div className="dialog-actions"><button disabled={creatingCard} onClick={()=>void finishImport(pendingImport.card).catch(e=>setImportError(String(e)))}>保留全部记录并导入</button><button onClick={()=>{setPendingImport(undefined);setModal('export');}}>取消导入</button></div></section>}
      {modal==='personal' &&editing&&<PersonalEntries c={c} edit={edit}/>}
      {modal==='spellAbility'&&<SpellAbilityEditor c={c} edit={edit}/>}
      {modal==='hp'&&editing&&<HitPointEditor c={c} edit={edit}/>}
      {modal === 'characters' && <><div className="dialog-actions">{inWorkbench?<button disabled={creatingCard||!wb.online} onClick={()=>void createRemote(c.edition)}>＋ 空白角色卡</button>:<><button onClick={()=>create('2024')}>＋ 2024 角色</button><button onClick={()=>create('2014')}>＋ 2014 角色</button><button onClick={()=>create(c.edition,true)}>复制当前角色</button></>}</div><CharacterManager rows={managerRows} currentId={managerId} disabled={readOnly||inWorkbench&&!wb.online} open={id=>{if(inWorkbench)chooseWorkbench(`card:${id}`);else persist({...workspace,activeId:id});setModal('');}} read={readCards} remove={removeCards} create={createCards} review={card=>{setReviewTarget(card);setModal('review');}}/>{inWorkbench&&<button onClick={async()=>download('本机恢复记录.json',{recoveries:await loadRecoveries()})}>导出本机恢复记录</button>}</>}
      {modal==='review'&&reviewTarget&&<CharacterReview c={reviewTarget} ruleContext={inWorkbench&&roomRules?{edition:roomRules.edition,profile:roomProfile!,rulePacks:roomRules.packs}:undefined} inspect={entry=>{setModal('');inspect(entry);}}/>}
      {modal==='batchImport'&&<section><p>已校验 {pendingBatch.length} 张。确认后创建新副本，原有角色保留。</p>{pendingBatch.map(({card,review})=><article key={card.id}><h3>{card.name} · {card.edition}</h3>{review.editionMismatch&&<p role="alert">版本不同：当前 {c.edition}，导入 {card.edition}。保留原卡版本与条目身份，房间来源限制仍生效。</p>}{review.totalLevel!==review.effectiveLevel&&<p>记录等级 {review.totalLevel}；当前来源下生效等级 {review.effectiveLevel}。</p>}{review.disabled.length>0&&<details open><summary>{review.disabled.length} 项来源或规则禁用；保留内容，暂停效果</summary><ul>{review.disabled.map(row=><li key={row.id}>{row.entry.name} · <SourceName id={row.entry.source}/></li>)}</ul></details>}</article>)}<div className="dialog-actions"><button disabled={batchBusy||batchUncertain||!pendingBatch.length} onClick={()=>void finishBatch()}>确认导入这批角色</button><button disabled={batchBusy} onClick={()=>{setPendingBatch([]);setModal('export');}}>取消</button></div></section>}
      {modal==='onboarding'&&<section className="rules-onboarding"><p className="setup-intro">你随时可以在右上角“规则与扩展”处打开并调整这些设置。</p>{inWorkbench&&wb.role!=='GM'?<><p>房间规则与扩展由 DM 管理；你可以选择自己的资料显示方式。</p><RoomRulesSummary character={c} entries={allEntries} scope={wb.shared?.scope}/></>:<><RuleOptions c={c} edit={editRules} readOnly={rulesReadonly}/><SourceSettings c={c} entries={allEntries} edit={editSources} readOnly={rulesReadonly} changeMode={sourceDisplay.setMode}/></>}<div className="dialog-actions"><button className="primary" disabled={rulesBusy} onClick={completeSetup}>完成设置</button></div></section>}
      {modal === 'rules' && <><fieldset className="rules-fieldset" disabled={rulesBusy} aria-busy={rulesBusy}>{inWorkbench&&wb.role!=='GM'?<RoomRulesSummary character={c} entries={allEntries} scope={wb.shared?.scope}/>:<>
        <section className="settings-section"><h3>自定义扩展包</h3><p>以 JSON 声明条目、效果与选择。导入前检查格式、依赖和冲突；更新包不会替换角色内已选的旧快照。</p><div className="dialog-actions"><button disabled={rulesReadonly} onClick={() => importFile('pack')}>导入扩展包</button><button onClick={() => download('我的扩展-示例.json', EXAMPLE_PACK)}>下载编写示例</button></div><input className="file-input" data-testid="pack-file" type="file" accept=".json" aria-label="导入扩展包文件" onChange={e => { if (e.target.files?.[0]) importFile('pack', e.target.files[0]); e.target.value = ''; }}/>{activePacks.map(pack => <div className="pack-row" key={pack.id}><span><strong>{pack.name}</strong><small>{pack.id} · {pack.version} · {pack.entries.length} 条</small></span><button onClick={() => download(`${pack.id}-${pack.version}.json`, exportRulePack(pack))}>导出</button><button disabled={rulesReadonly} onClick={() => { const dependent = activePacks.find(p => p.requires.some(dep => dep.id === pack.id)); if (dependent) { setImportError(`「${dependent.name}」依赖这个包，请先移除依赖方。`); return; } editSources(draft=>{draft.rulePacks=activePacks.filter(p=>p.id!==pack.id);}); setNotice('已移除资料包；角色中的条目快照仍保留。可关闭其来源以暂停效果。'); }}>移除</button></div>)}</section>
        <RuleOptions c={c} edit={editRules} readOnly={rulesReadonly} title={inWorkbench?(wb.shared?.scope==='room'?'房间规则':'场景规则'):'当前角色的规则'}/>
        <SourceSettings c={c} entries={allEntries} edit={editSources} readOnly={rulesReadonly} changeMode={sourceDisplay.setMode}/>

        {Object.keys(c.profile.exceptions).length > 0 && <section className="settings-section"><h3>DM 特许记录</h3>{Object.entries(c.profile.exceptions).map(([id, reason]) => <p key={id}>{c.selections.find(s => s.entry.id === id)?.entry.name || allEntries.find(e => e.id === id)?.name || id}：{reason}<button disabled={rulesReadonly} onClick={() => editRules(draft => { delete draft.profile.exceptions[id]; })}>撤回</button></p>)}</section>}
      </>}</fieldset></>}      {modal === 'export' && <><div className="dialog-actions"><button disabled={loading||readOnly||inWorkbench&&!wb.target?.write} onClick={()=>setModal('classSync')}>核对当前角色资料</button></div><TransferPanel rows={managerRows} currentId={managerId} currentName={c.name} currentPage={sheetPage} read={readCards} importTexts={importTexts} capture={capturePages} disabled={readOnly||inWorkbench&&!wb.online} formatSource={sourceDisplay.format}/><section className="settings-section"><h3>单文件导入与本机恢复</h3><div className="dialog-actions"><button onClick={()=>importFile('character')}>导入角色 JSON</button></div><input className="file-input" data-testid="character-file" type="file" accept=".json" aria-label="导入角色备份文件" onChange={e=>{if(e.target.files?.[0])importFile('character',e.target.files[0]);e.target.value='';}}/><button onClick={async()=>{try{const backup=await restoreBackup();if(!backup)throw Error('没有可用备份');acceptWorkspace(backup,true);history.current.clear();setNotice('已读取上一次保存，尚未保存。继续编辑或重试编辑加载时将保存。');setModal('');}catch(e){setImportError(String(e));}}}>读取上一次保存</button></section></>}

      </Suspense></ToolBoundary>
    </Dialog>}

  </div></EntryDragProvider></KeywordPreview></ChoiceWorkspaceContext.Provider></SheetChoicesContext.Provider></OverviewDashboardHost>;
}
