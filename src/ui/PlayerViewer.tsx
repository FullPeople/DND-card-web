import {ToolBoundary} from './ToolBoundary';
import {lazy,Suspense,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {type Character,type Entry} from '../core/model';
import {evaluate} from '../core/engine';
import {classEditionSuffix} from '../core/classEdition';
import {readCharacter,importOwlbear,parseFile} from '../core/validation';
import {SheetDisplayButton} from './SheetDisplayButton';
import {useSheetRenderMode,beginSheetCapture} from './sheetDisplay';
import {PaperFrame,type SheetPage} from './PaperFrame';
import {SheetEditContext} from './SheetEdit';
import {Overview} from './Overview';
const DetailHeader=lazy(()=>import('./CharacterPages').then(m=>({default:m.DetailHeader})));
const FeaturesPage=lazy(()=>import('./CharacterPages').then(m=>({default:m.FeaturesPage})));
const BackgroundPage=lazy(()=>import('./CharacterPages').then(m=>({default:m.BackgroundPage})));
const SpellsPage=lazy(()=>import('./SpellsPage').then(m=>({default:m.SpellsPage})));
const InventoryPage=lazy(()=>import('./InventoryPage').then(m=>({default:m.InventoryPage})));
import {FeaturePanel} from './FeaturePanel';
import {KeywordPreview} from './KeywordPreview';
import {ContentBoundary,Entries} from './Entries';
import {EntryFacts} from './EntryFacts';
import {SourceName} from './SourceName';
import {downloadBlob} from '../platform/storage';
import {useUiLanguage} from './UiLanguage';
import {PaletteButton,PaletteDrawer} from './PaletteDrawer';

import {uiEntryName,type UiTextKey} from './uiText';
import './playerViewer.css';

export function readViewerCharacter(value:unknown):Character{
 const raw=value as any;
 if(raw?.dnd_card_web)return readCharacter(raw.dnd_card_web).character;
 if(raw?.schemaVersion===1||raw?.format==='dnd-card-web'||raw?.character?.schemaVersion===1)return readCharacter(raw).character;
 return importOwlbear(value);
}
const noop=()=>{};
class ViewerLoadError extends Error{constructor(readonly key:UiTextKey,readonly values:Record<string,string|number>={}){super(key);}}
export default function PlayerViewer(){
 const libraryPreview=new URLSearchParams(location.search).get('libraryPreview')==='1';
 const {t}=useUiLanguage();
 const [card,setCard]=useState<Character>(),[originalJson,setOriginalJson]=useState<string>(),[error,setError]=useState<Error>(),[reload,setReload]=useState(0);
 useEffect(()=>{const abort=new AbortController();setError(undefined);setCard(undefined);setOriginalJson(undefined);void(async()=>{
  const params=new URLSearchParams(location.search),cloud=params.get('cloud');
  if(cloud&&!/^[A-Z]{6}$/.test(cloud)&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(cloud))throw new Error('云端卡 ID 格式不正确。');
  const target=cloud?'/api/cards/'+cloud:params.get('data_url');if(!target)throw new ViewerLoadError('readerMissing');
  const url=new URL(target,location.href);if(!['https:','http:'].includes(url.protocol)||/\.(?:xlsx?|xlsm)(?:$|[?#])/i.test(url.href))throw new ViewerLoadError('readerJsonOnly');
  const response=await fetch(url.href,{signal:abort.signal,credentials:'omit',cache:cloud?'no-store':'no-cache'});if(!response.ok){if(cloud&&response.status===404)throw new Error('这张云端卡已删除或不存在。请返回角色卡库刷新列表。');throw new ViewerLoadError('readerHttp',{status:response.status});}
  if(Number(response.headers.get('content-length')||0)>20_000_000)throw new ViewerLoadError('readerLarge');
  const text=await response.text(),next=readViewerCharacter(parseFile(text));if(!abort.signal.aborted){setCard(next);setOriginalJson(text);}
 })().catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e:new Error(String(e)));});return()=>abort.abort();},[reload]);
 if(!card)return <main className="player-viewer-loading"><h1>{t('card')}</h1>{error?<><p role="alert">{error instanceof ViewerLoadError?t(error.key,error.values):error.message}</p><button onClick={()=>setReload(n=>n+1)}>{t('retry')}</button></>:<p role="status">{t('readerLoading')}</p>}<a href={new URLSearchParams(location.search).has('cloud')?'/library/':'https://dnd.center/card/'}>{new URLSearchParams(location.search).has('cloud')?'返回角色卡库':t('goToSite')}</a></main>;
 return <PlayerSheet key={card.id} character={card} originalJson={originalJson} onReload={()=>setReload(n=>n+1)} preview={libraryPreview}/>;
}

/** A shared reader keeps gallery cards in one document and one module graph. */
export function PlayerSheet({character,originalJson,onReload,preview=false,active=true,displayOnly=false}:{displayOnly?:boolean;character:Character;originalJson?:string;onReload?:()=>void;preview?:boolean;active?:boolean}){
 const [paletteOpen,setPaletteOpen]=useState(false);
 const [card,setCard]=useState(character),[page,setPage]=useState<SheetPage>('主要'),[detail,setDetail]=useState<Entry>();
 const renderMode=useSheetRenderMode(),{language,t}=useUiLanguage(),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{setCard(character);setDetail(undefined);},[character]);
 useEffect(()=>preview?beginSheetCapture():undefined,[preview]);
 useLayoutEffect(()=>{for(const input of root.current?.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('.paper input,.paper textarea,.paper select')||[])input.disabled=true;},[card,page,renderMode]);
 const derived=useMemo(()=>card?evaluate(card):undefined,[card]);
 const entries=useMemo(()=>card?.selections.map(s=>s.entry)||[],[card]);
 const resolve=(reference:string,kind?:string)=>{if(reference.startsWith('entry:'))return entries.find(e=>e.id===reference.slice(6))||card?.selections.find(s=>s.id===reference.slice(6))?.entry;const [name,source]=reference.split('|');return entries.find(e=>(!kind||kind===e.kind)&&(!source||e.source.toLowerCase()===source.toLowerCase())&&[e.name,e.english].some(value=>value.toLowerCase()===name.toLowerCase()));};
 const link=(reference:string,kind?:string)=>{const entry=resolve(reference,kind);if(entry)setDetail(entry);};
 // Expand/collapse is local presentation state; the reader never persists or
 // rewrites the source character, inventory, resource values or prepared spells.
 const edit=(action:(draft:Character)=>void)=>setCard(current=>{if(!current)return current;const draft=structuredClone(current);action(draft);return {...current,featureLayout:draft.featureLayout};});
 if(!derived)return null;
 const props={c:card,d:derived,edit,browse:noop,inspect:setDetail,onLink:link,add:noop,entries};
 const sheet=<SheetEditContext.Provider value={false}><main ref={root} className={`player-viewer ${preview?'cloud-library-preview':''}`}>
  <header className="player-viewer-toolbar"><strong>{card.name}</strong><span>{card.edition} · {t('readOnly')}</span><PaletteButton open={paletteOpen} toggle={()=>setPaletteOpen(value=>!value)}/><button disabled={originalJson===undefined} onClick={()=>{if(originalJson!==undefined)downloadBlob(`${card.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,100)||'character'}.json`,new Blob([originalJson],{type:'application/json;charset=utf-8'}));}}>{t('exportJson')}</button><button onClick={onReload}>{t('refreshData')}</button><a href="https://dnd.center/card/?intro=0" target="_blank" rel="noreferrer">{t('createOnSite')}</a></header>
  <section className="sheet-pane"><div className="pane-toolbar"><SheetDisplayButton/></div><PaperFrame displayOnly={displayOnly} motionEnabled={active&&!displayOnly} character={card} page={page} changePage={setPage}>
   <ToolBoundary key={page} label={page} close={()=>setPage('主要')}><Suspense fallback={<p role="status">正在加载这一页…</p>}>{page==='主要'?<Overview {...props} catalog={entries} statusRibbon={<div className="edition-divider"><span/><strong>{t('cardTitle')}{classEditionSuffix(card)}</strong><FeaturePanel inline grouped={false} label="状态" kinds={['condition']} c={card} rows={card.selections.filter(s=>s.entry.kind==='condition')} edit={noop} browse={noop} onLink={link}/><span/></div>} addEntry={noop} renderSelection={()=>null} openResources={noop} openQuickbar={noop} pinDrop={noop}/>:<div className="sheet-details"><DetailHeader {...props} page={page}/>{page==='特性'?<FeaturesPage {...props}/>:page==='背景'?<BackgroundPage {...props}/>:page==='法术'?<SpellsPage {...props} readOnly/>:<InventoryPage {...props}/>}</div>}
  </Suspense></ToolBoundary></PaperFrame></section>
  {detail&&<div className="player-entry-shade" onPointerDown={event=>{if(event.target===event.currentTarget)setDetail(undefined);}}><section role="dialog" aria-label={t('entryDetails')}><header><div><strong>{uiEntryName(detail,language)}</strong><small><SourceName id={detail.source}/> · {detail.edition}</small></div><button aria-label={t('closeEntry')} onClick={()=>setDetail(undefined)}>×</button></header><ContentBoundary key={detail.id}><EntryFacts entry={detail} onLink={link}/><Entries value={detail.entries} onLink={link}/></ContentBoundary></section></div>}
 {!displayOnly&&<PaletteDrawer open={paletteOpen} close={()=>setPaletteOpen(false)} character={card}/>}</main></SheetEditContext.Provider>;
 return displayOnly?sheet:<KeywordPreview resolve={resolve} open={link}>{sheet}</KeywordPreview>;
}
