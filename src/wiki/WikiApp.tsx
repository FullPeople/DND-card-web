import {useLayoutEffect,startTransition,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {newCharacter,type Entry} from '../core/model';
import {entryReferenceCandidates,referenceEntryCategory,referenceEntryKind,resolveEntryReference} from '../core/entryReferences';
import {catalogIdCandidates,mergeCatalogRecords,recordNavigationKey,resolveCatalogId} from '../core/entryRecordIdentity';
import {loadCatalog,type LoadProgress} from '../data/catalog';
import {SIZE_ENTRIES} from '../data/sizes';
import {useLibrary} from '../ui/useLibrary';
import {useLibraryFavorites} from '../ui/useLibraryFavorites';
import {useEntrySearch} from '../ui/useEntrySearch';
import {LIBRARY_TABS,columnsFor,compareEntries,facetsFor,matchesFacets,matchesLibraryTab,navigationTab,type LibraryTab} from '../ui/libraryData';
import {wikiEditionAllows} from '../ui/wikiEdition';
import {SourceName,useSources,type SourceMode} from '../ui/SourceName';
import {WikiLayout,WikiReaderBack,WikiEmptyPrompt} from '../ui/WikiLayout';
import {WikiSplitter} from '../ui/WikiSplitter';
import {GlobalSearch} from '../ui/GlobalSearch';
import {LibraryFilters} from '../ui/LibraryFilters';
import {CatalogList} from '../ui/CatalogList';
import {LibraryDocument} from '../ui/LibraryDocument';
import {ClassNavigation} from '../ui/ClassNavigation';
import {MonsterDocument} from '../ui/MonsterDocument';
import {EntryFacts} from '../ui/EntryFacts';
import {EntryBadges} from '../ui/EntryBadges';
import {KeywordPreview} from '../ui/KeywordPreview';
import {ClearableSearch} from '../ui/ClearableSearch';
import {ContentBoundary} from '../ui/Entries';

const initialProgress:LoadProgress={done:0,total:0,label:'读取资料索引',failed:[],cached:0,retry:[]};
const categories:Record<string,string>={class:'职业',subclass:'子职',classFeature:'职业特性',subclassFeature:'子职特性',optionalfeature:'职业能力与选项',reward:'奖赏',charoption:'角色选项',psionic:'灵能',boon:'恩惠',deity:'神祇',cult:'教团',facility:'堡垒设施',table:'表格',tableGroup:'表格组',disease:'疾病',itemType:'装备类别'};
const tabs=Object.entries(LIBRARY_TABS).filter(([key])=>key!=='custom') as [LibraryTab,string][];
function route(){const query=new URLSearchParams(location.search);return {entry:query.get('entry')||'',definition:query.get('definition')||'',reference:query.get('reference')||'',referenceKind:query.get('referenceKind')||'',section:query.get('section')||undefined,tab:query.get('tab') as LibraryTab,edition:['2014','2024','all'].includes(query.get('edition')||'')?query.get('edition')!:'all'};}
function pageUrl(entry:string,tab:LibraryTab,edition:string,section?:string,definition?:string){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('tab',tab);url.searchParams.set('edition',edition);if(entry)url.searchParams.set('entry',entry);if(section)url.searchParams.set('section',section);if(definition)url.searchParams.set('definition',definition);return url;}

export default function WikiApp(){
 const sources=useSources(),favorites=useLibraryFavorites();
 const [entries,setEntries]=useState<Entry[]>(SIZE_ENTRIES),catalog=useRef(new Map(SIZE_ENTRIES.map(entry=>[entry.id,entry])));
 const [progress,setProgress]=useState(initialProgress),[loading,setLoading]=useState(true),[notice,setNotice]=useState('');
 const controller=useRef<AbortController|undefined>(undefined),request=useRef(0);
 const library=useLibrary(entries,[],false,'dnd-wiki-library-v1'),{kind,state,detail}=library;
 const [target,setTarget]=useState(route),[edition,setEdition]=useState(target.edition),[subtypeSelection,setSubtype]=useState({kind:'class' as LibraryTab,value:'class'});
 const subtype=subtypeSelection.kind===kind?subtypeSelection.value:kind==='class'?'class':'all';
 const pane=useRef<HTMLElement>(null);
 const profile=useMemo(()=>{const value=newCharacter(edition==='2014'?'2014':'2024');value.profile.enabledSources=[...new Set(entries.map(entry=>entry.source))];value.profile.optional.legacy=edition==='all';return value;},[edition,entries]);
 const available=useMemo(()=>entries.filter(entry=>wikiEditionAllows(entry,profile,edition)),[entries,profile,edition]);
 const load=useCallback(async(refresh=false,retry:readonly string[]=[])=>{
  controller.current?.abort();const next=new AbortController(),generation=++request.current;controller.current=next;setLoading(true);setProgress(initialProgress);setNotice('');let published=0;
  const flush=()=>{if(generation===request.current&&!next.signal.aborted)startTransition(()=>setEntries([...catalog.current.values()]));};
  try{await loadCatalog(batch=>{if(next.signal.aborted)return;mergeCatalogRecords(catalog.current,batch);if(performance.now()-published>400){published=performance.now();flush();}},value=>{if(!next.signal.aborted)startTransition(()=>setProgress(value));},next.signal,refresh,undefined,sources.merge,retry);flush();}
  catch(error){if(!next.signal.aborted)setNotice(`资料加载失败：${String(error)}`);}
  finally{if(generation===request.current&&!next.signal.aborted)setLoading(false);}
 },[sources.merge]);
 useEffect(()=>{void load();return()=>{++request.current;controller.current?.abort();};},[load]);
 useEffect(()=>{const read=()=>{const next=route();setEdition(next.edition);setTarget(next);if(Object.hasOwn(LIBRARY_TABS,next.tab)&&next.tab!=='custom')library.setKind(next.tab);if(!next.entry)library.setDetail(undefined);};window.addEventListener('popstate',read);read();return()=>window.removeEventListener('popstate',read);},[]);
 useEffect(()=>{if(!target.entry&&!target.reference)return;const found=target.entry?resolveCatalogId(target.entry,available,target.definition||undefined):resolveEntryReference(target.reference,available,referenceEntryKind(target.referenceKind),referenceEntryCategory(target.referenceKind));if(found&&(detail?.id!==found.id||state.focus!==target.section))library.navigate(found,target.section,false);else if(!found&&detail)library.setDetail(undefined);},[available,target.entry,target.definition,target.reference,target.referenceKind,target.section]);
 const legacyCandidates=useMemo(()=>target.entry&&!target.definition?catalogIdCandidates(target.entry,available):target.reference?entryReferenceCandidates(target.reference,available,referenceEntryKind(target.referenceKind),referenceEntryCategory(target.referenceKind)):[],[available,target.entry,target.definition,target.reference,target.referenceKind]);

 useEffect(()=>{if(detail&&pane.current)pane.current.scrollTop=state.positions[detail.id]||0;},[detail?.id,library.navigationKey]);
 useEffect(()=>{document.title=detail?`${detail.name} · DND Wiki`:'DND Wiki · 规则资料';},[detail?.id]);
 const inCategory=useMemo(()=>available.filter(entry=>kind==='favorites'?favorites.has(entry):matchesLibraryTab(entry,kind)),[available,kind,favorites.has]);
 const subtypes=useMemo(()=>[...new Set(inCategory.map(entry=>String(entry.raw._category||entry.kind)))].sort(),[inCategory]);
 const category=useMemo(()=>inCategory.filter(entry=>subtype==='all'||String(entry.raw._category||entry.kind)===subtype),[inCategory,subtype]);
 const columns=useMemo(()=>kind==='class'&&subtype!=='class'?[
  {key:'name',label:'名称',value:(entry:Entry)=>entry.name},
  {key:'type',label:'类别',value:(entry:Entry)=>categories[String(entry.raw._category||entry.kind)]||entry.kind},
  {key:'level',label:'等级',value:(entry:Entry)=>entry.raw.level??'—'},
  {key:'source',label:'来源',value:(entry:Entry)=>entry.source}
 ]:columnsFor(kind,edition!=='2024'),[kind,subtype,edition]);
 const facets=useMemo(()=>facetsFor(kind),[kind]);
 const sortedCategory=useMemo(()=>category.filter(entry=>matchesFacets(entry,state.filters,facets)).sort((a,b)=>compareEntries(a,b,columns.find(column=>column.key===state.sort)||columns[0],state.descending,sources.registry)),[category,state.filters,facets,sources.registry,columns,state.sort,state.descending]);
 const search=useEntrySearch(state.query,sortedCategory,sources.registry);
 const filtered=useMemo(()=>state.query.trim()?sortedCategory.filter(search.matches):sortedCategory,[sortedCategory,search.matches,state.query]);
 useLayoutEffect(()=>{
  if(!['book','adventure'].includes(new URLSearchParams(location.search).get('reading')||'')&&loading&&!notice&&(!filtered.length||((target.entry||target.reference)&&!detail)))return;
  document.documentElement.dataset.wikiContent='ready';
  window.dispatchEvent(new Event('dnd-wiki-content-ready'));
 },[filtered.length,loading,notice,detail,target.entry,target.reference]);
 function remember(entry:Entry|undefined,tab:LibraryTab,section?:string,nextEdition=edition){const definition=entry?recordNavigationKey(entry):'',url=pageUrl(entry?.id||'',tab,nextEdition,section,definition);if(url.href!==location.href)history.pushState(null,'',url);setTarget({entry:entry?.id||'',definition,reference:'',referenceKind:'',tab,edition:nextEdition,section});}
 function inspect(entry:Entry,section?:string){if(detail&&pane.current)library.savePosition(detail.id,pane.current.scrollTop);const nextEdition=wikiEditionAllows(entry,profile,edition)?edition:['2014','2024'].find(value=>wikiEditionAllows(entry,profile,value))||'all';if(nextEdition!==edition)setEdition(nextEdition);library.navigate(entry,section,true,kind);remember(entry,navigationTab(entry,kind),section,nextEdition);}
 function resolve(reference:string,kind?:string){return reference.startsWith('entry:')?resolveCatalogId(reference.slice(6),available):resolveEntryReference(reference,available,referenceEntryKind(kind),referenceEntryCategory(kind));}
 function link(reference:string,tag?:string){const entry=resolve(reference,tag);if(entry){inspect(entry);return;}const direct=reference.startsWith('entry:'),candidates=direct?catalogIdCandidates(reference.slice(6),available):entryReferenceCandidates(reference,available,referenceEntryKind(tag),referenceEntryCategory(tag));if(candidates.length>1){const next={entry:direct?reference.slice(6):'',definition:'',reference:direct?'':reference,referenceKind:tag||'',tab:kind,edition,section:undefined},url=pageUrl(next.entry,kind,edition);if(next.reference)url.searchParams.set('reference',next.reference);if(tag)url.searchParams.set('referenceKind',tag);history.pushState(null,'',url);library.setDetail(undefined);setTarget(next);}else setNotice(`暂未找到“${reference.split('|')[0]}”，可以用上方搜索继续查找。`);}
 async function copyLink(){try{await navigator.clipboard.writeText(pageUrl(detail?.id||'',kind,edition,state.focus,detail?recordNavigationKey(detail):undefined).href);setNotice('已复制当前资料链接。');}catch{setNotice('复制失败，请复制浏览器地址栏中的链接。');}}
 return <KeywordPreview resolve={resolve} open={link}><div className="wiki-reader-app">
  <header className="wiki-reader-header"><a className="brand" href="./"><img src="./dnd-center-icon.png" alt=""/><strong>DND Wiki</strong></a><span>规则资料</span><nav aria-label="站点导航"><a href="https://dnd.center/">首页</a><button onClick={()=>void load(true)} disabled={loading}>更新资料</button></nav></header>
  <main className="wiki-pane wiki-reader-pane" aria-label="规则资料"><WikiLayout hasDetail={!!detail} readingKey={library.navigationKey}>
   <GlobalSearch query={library.globalQuery} change={library.setGlobalQuery} entries={available} c={profile} inspect={entry=>inspect(entry)}/>
   <nav className="category-tabs" aria-label="资料分类">{tabs.map(([tab,label])=><button key={tab} aria-current={kind===tab?'page':undefined} className={kind===tab?'active':''} onClick={()=>{library.setKind(tab);remember(undefined,tab);library.patch({detailId:undefined,focus:undefined},tab);}}>{label}</button>)}</nav>
   <div className="wiki-filters"><ClearableSearch className="category-search-control" label={`${LIBRARY_TABS[kind]}分类搜索`} clearLabel="清空分类搜索" placeholder={`搜索${LIBRARY_TABS[kind]}`} value={state.query} change={query=>library.patch({query})}/><select aria-label="资料版本" value={edition} onChange={event=>{const value=event.target.value;setEdition(value);const url=pageUrl(detail?.id||'',kind,value,state.focus,detail?recordNavigationKey(detail):target.definition);history.pushState(null,'',url);setTarget({...target,edition:value});}}><option value="all">2014 与 2024</option><option value="2014">2014 规则</option><option value="2024">2024 规则</option></select>{subtypes.length>1&&<select aria-label="资料类型" value={subtype} onChange={event=>setSubtype({kind,value:event.target.value})}><option value="all">全部类型</option>{subtypes.map(value=><option key={value} value={value}>{categories[value]||value}</option>)}</select>}<LibraryFilters tab={kind} entries={category} filters={state.filters} change={filters=>library.patch({filters})} names={Object.fromEntries(Object.entries(sources.registry).map(([id,value])=>[id,value.name]))}/></div>
    {!detail&&legacyCandidates.length>1&&<section className="wiki-link-candidates" aria-label="引用条目选择"><p role="status">这个引用对应多个资料条目，请选择要查看的内容。</p><ul>{legacyCandidates.map(entry=><li key={entry.id}><button onClick={()=>inspect(entry)}>{entry.name} · {entry.source} · {["2014","2024"].includes(entry.raw._classEdition||entry.edition)?entry.raw._classEdition||entry.edition:"版本未标明"}{Number.isSafeInteger(entry.raw._catalogDefinitionOrdinal)&&entry.raw._catalogDefinitionOrdinal>0?` · 记录 ${entry.raw._catalogDefinitionOrdinal}`:""}{entry.page?` · 第 ${entry.page} 页`:''}</button></li>)}</ul></section>}
    <div className="catalog-status"><span>{entries.length>SIZE_ENTRIES.length?`${entries.length.toLocaleString()} 条资料`:'正在读取资料…'}{loading?` · 载入 ${progress.done}/${progress.total}`:progress.cached?` · ${progress.cached} 份缓存`:''}</span><span role={search.status?'status':undefined}>{search.status||`${filtered.length} 条符合筛选`}</span></div>
   {(progress.failed.length>0||progress.paused)&&<details className="load-errors"><summary>{progress.failed.length} 份资料读取异常 · 可重试</summary>{progress.paused&&<p>{progress.paused}</p>}{progress.failed.map((error,index)=><p key={index}>{error}</p>)}<button disabled={loading} onClick={()=>void load(false,progress.retry)}>重试加载</button></details>}
   <div className={`library-body ${detail?'has-detail':''}`} data-library-tab={kind}><CatalogList entries={filtered} columns={columns} kind={kind} character={profile} selected={detail} inspect={entry=>inspect(entry)} sort={state.sort} descending={state.descending} onSort={key=>library.patch({sort:key,descending:state.sort===key?!state.descending:false})} resetKey={JSON.stringify([kind,subtype,state.filters,edition,state.sort,state.descending,state.query])} loading={loading} onSettings={()=>library.patch({filters:{},query:''})} pulse={0}/><WikiSplitter/>
    {detail?<article className="entry-detail" data-entry-kind={detail.kind} data-described-entry={detail.id} ref={pane} onScroll={event=>library.savePosition(detail.id,event.currentTarget.scrollTop)}><div className="detail-frozen"><div className="detail-navigation"><button onClick={()=>history.back()} disabled={!library.canGoBack}>← 上一条</button><button onClick={()=>void copyLink()}>复制链接</button><button aria-pressed={favorites.has(detail)} onClick={()=>{try{favorites.change(detail,!favorites.has(detail));}catch{setNotice('浏览器未能保存收藏。');}}}>{favorites.has(detail)?'取消收藏':'收藏'}</button><WikiReaderBack close={()=>{library.setDetail(undefined);remember(undefined,kind);}}/></div><div className="detail-heading"><EntryBadges entry={detail}/><h1>{detail.name}{detail.english!==detail.name&&<small className="english-name"> {detail.english}</small>}</h1><small><SourceName id={detail.source}/>{detail.page?` · 第 ${detail.page} 页`:''}</small></div><ClassNavigation entry={detail} entries={entries} character={profile} focus={state.focus} subclassesOpen={!!state.subclassesOpen} onToggleSubclasses={()=>library.patch({subclassesOpen:!state.subclassesOpen})} navigate={(entry,focus)=>inspect(entry,focus)}/></div>
     <ContentBoundary key={detail.id}>{detail.kind==='monster'?<MonsterDocument entry={detail} onLink={link}/>:<><EntryFacts entry={detail} onLink={link}/><LibraryDocument entry={detail} entries={entries} character={profile} onLink={link} inspect={inspect} editionFilter={edition} focus={state.focus} subclassesOpen={!!state.subclassesOpen} collapsed={state.collapsed[detail.id]||[]} onCollapse={ids=>library.patch({focus:undefined,collapsed:{...state.collapsed,[detail.id]:ids}})}/></>}</ContentBoundary>
     <WikiRawDetails key={detail.id} entry={detail}/>
    </article>:<div className="wiki-reader-empty"><WikiEmptyPrompt/><p>按名称、来源和规则版本查阅资料。</p>{!loading&&legacyCandidates.length<2&&(target.entry||target.reference)&&!detail&&<p role="alert">链接中的资料暂未找到；请检查资料是否加载完整。</p>}</div>}
   </div><footer className="wiki-footer"><a href="https://5e.kiwee.top/" target="_blank" rel="noopener noreferrer">资料来源：5etools 中文站</a><select aria-label="来源显示方式" value={sources.mode} onChange={event=>sources.setMode(event.target.value as SourceMode)}><option value="both">全名与简写</option><option value="full">全名</option><option value="short">简写</option></select><a href="https://github.com/FullPeople/DND-card-web/issues" target="_blank" rel="noopener noreferrer">反馈问题</a></footer>
  </WikiLayout></main>{notice&&<div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={()=>setNotice('')}>×</button></div>}
 </div></KeywordPreview>;
}
function WikiRawDetails({entry}:{entry:Entry}){const [open,setOpen]=useState(false);return <details className="raw-details" onToggle={event=>setOpen(event.currentTarget.open)}><summary>数据与追溯</summary>{open&&<pre>{JSON.stringify(entry.raw,null,2)}</pre>}</details>;}
