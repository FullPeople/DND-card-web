import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {type Character,type Entry} from '../core/model';
import {evaluate} from '../core/engine';
import {readCharacter,importOwlbear,parseFile} from '../core/validation';
import {PaperFrame,type SheetPage} from './PaperFrame';
import {SheetEditContext} from './SheetEdit';
import {Overview} from './Overview';
import {DetailHeader,FeaturesPage,BackgroundPage} from './CharacterPages';
import {SpellsPage} from './SpellsPage';
import {InventoryPage} from './InventoryPage';
import {FeaturePanel} from './FeaturePanel';
import {KeywordPreview} from './KeywordPreview';
import {ContentBoundary,Entries} from './Entries';
import {EntryFacts} from './EntryFacts';
import {SourceName} from './SourceName';
import './playerViewer.css';

export function readViewerCharacter(value:unknown):Character{
 const raw=value as any;
 if(raw?.dnd_card_web)return readCharacter(raw.dnd_card_web).character;
 if(raw?.schemaVersion===1||raw?.format==='dnd-card-web'||raw?.character?.schemaVersion===1)return readCharacter(raw).character;
 return importOwlbear(value);
}
const noop=()=>{};
export default function PlayerViewer(){
 const [card,setCard]=useState<Character>(),[error,setError]=useState(''),[page,setPage]=useState<SheetPage>('主要'),[detail,setDetail]=useState<Entry>(),[reload,setReload]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const abort=new AbortController();setError('');setCard(undefined);void(async()=>{
  const target=new URLSearchParams(location.search).get('data_url');if(!target)throw Error('未提供角色 JSON。请从角色卡列表重新打开。');
  const url=new URL(target,location.href);if(!['https:','http:'].includes(url.protocol)||/\.(?:xlsx?|xlsm)(?:$|[?#])/i.test(url.href))throw Error('此阅读器只接受角色 JSON。请在角色卡网站制卡后导入 JSON。');
  const response=await fetch(url.href,{signal:abort.signal,credentials:'omit',cache:'no-cache'});if(!response.ok)throw Error(`角色读取失败（HTTP ${response.status}），请重试。`);
  if(Number(response.headers.get('content-length')||0)>20_000_000)throw Error('角色文件超过 20 MB。');
  const next=readViewerCharacter(parseFile(await response.text()));if(!abort.signal.aborted)setCard(next);
 })().catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:String(e));});return()=>abort.abort();},[reload]);
 useLayoutEffect(()=>{for(const input of root.current?.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('.paper input,.paper textarea,.paper select')||[])input.disabled=true;},[card,page]);
 const derived=useMemo(()=>card?evaluate(card):undefined,[card]);
 const entries=useMemo(()=>card?.selections.map(s=>s.entry)||[],[card]);
 const resolve=(reference:string,kind?:string)=>{if(reference.startsWith('entry:'))return entries.find(e=>e.id===reference.slice(6))||card?.selections.find(s=>s.id===reference.slice(6))?.entry;const [name,source]=reference.split('|');return entries.find(e=>(!kind||kind===e.kind)&&(!source||e.source.toLowerCase()===source.toLowerCase())&&[e.name,e.english].some(value=>value.toLowerCase()===name.toLowerCase()));};
 const link=(reference:string,kind?:string)=>{const entry=resolve(reference,kind);if(entry)setDetail(entry);};
 // Expand/collapse is local presentation state; the reader never persists or
 // rewrites the source character, inventory, resource values or prepared spells.
 const edit=(action:(draft:Character)=>void)=>setCard(current=>{if(!current)return current;const draft=structuredClone(current);action(draft);return {...current,featureLayout:draft.featureLayout};});
 if(!card||!derived)return <main className="player-viewer-loading"><h1>角色卡</h1>{error?<><p role="alert">{error}</p><button onClick={()=>setReload(n=>n+1)}>重试</button></>:<p role="status">正在读取角色资料…</p>}<a href="https://obr.dnd.center/card/" target="_blank" rel="noreferrer">前往角色卡网站</a></main>;
 const props={c:card,d:derived,edit,browse:noop,inspect:setDetail,onLink:link,add:noop,entries};
 return <KeywordPreview resolve={resolve} open={link}><SheetEditContext.Provider value={false}><main ref={root} className="player-viewer">
  <header className="player-viewer-toolbar"><strong>{card.name}</strong><span>{card.edition} · 只读角色卡</span><button onClick={()=>setReload(n=>n+1)}>刷新资料</button><a href="https://obr.dnd.center/card/" target="_blank" rel="noreferrer">前往网站制卡</a></header>
  <section className="sheet-pane"><PaperFrame character={card} page={page} changePage={setPage}>
   {page==='主要'?<Overview {...props} catalog={entries} statusRibbon={<div className="edition-divider"><span/><strong>DND 五版角色卡</strong><FeaturePanel inline grouped={false} label="状态" kinds={['condition']} c={card} rows={card.selections.filter(s=>s.entry.kind==='condition')} edit={noop} browse={noop} onLink={link}/><span/></div>} addEntry={noop} renderSelection={()=>null} openResources={noop} openQuickbar={noop} pinDrop={noop}/>:<div className="sheet-details"><DetailHeader {...props} page={page}/>{page==='特性'?<FeaturesPage {...props}/>:page==='背景'?<BackgroundPage {...props}/>:page==='法术'?<SpellsPage {...props}/>:<InventoryPage {...props}/>}</div>}
  </PaperFrame></section>
  {detail&&<div className="player-entry-shade" onPointerDown={event=>{if(event.target===event.currentTarget)setDetail(undefined);}}><section role="dialog" aria-label="角色条目正文"><header><div><strong>{detail.name}</strong><small><SourceName id={detail.source}/> · {detail.edition}</small></div><button aria-label="关闭角色条目" onClick={()=>setDetail(undefined)}>×</button></header><ContentBoundary key={detail.id}><EntryFacts entry={detail} onLink={link}/><Entries value={detail.entries} onLink={link}/></ContentBoundary></section></div>}
 </main></SheetEditContext.Provider></KeywordPreview>;
}
