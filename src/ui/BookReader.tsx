import {useEffect,useRef,useState} from 'react';
import type {Raw} from '../core/model';
import {readingVolumes,volumeChapters,type ReadingVolume} from '../data/wikiReading';
import {ReadingRefresh} from '../data/readingRefresh';
import {Entries} from './Entries';
import {ReadingImages,TranslationNotice} from './EntryReadingExtras';
import './wikiReading.css';

export type ReadingMode='entry'|'book'|'adventure';
export function readingRoute(){const query=new URLSearchParams(location.search),index=Number(query.get('chapter'));return {kind:(query.get('reading')==='adventure'?'adventure':query.get('reading')==='book'?'book':'entry') as ReadingMode,id:query.get('book')||'',chapter:Number.isFinite(index)?Math.max(0,Math.floor(index)):0};}
export function readingUrl(kind:ReadingMode,id='',chapter=0){const url=new URL(location.href);if(kind==='entry'){for(const key of ['reading','book','chapter'])url.searchParams.delete(key);}else{url.searchParams.set('reading',kind);if(id)url.searchParams.set('book',id);else url.searchParams.delete('book');url.searchParams.set('chapter',String(chapter));}return url;}
const storeKey=(kind:string)=>'dnd-wiki-reading-progress-v1:'+kind;
function saved(kind:string){try{const value=JSON.parse(localStorage.getItem(storeKey(kind))||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
export function BookReader({kind}:{kind:'book'|'adventure'}){
 const initial=readingRoute(),stored=saved(kind);
 const [volumes,setVolumes]=useState<ReadingVolume[]>([]),[query,setQuery]=useState(''),[id,setId]=useState<string>(initial.id||stored.id||''),[chapter,setChapter]=useState<number>(initial.id?initial.chapter:Number(stored.chapter)||0),[chapters,setChapters]=useState<Raw[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[loadingList,setLoadingList]=useState(true),[retry,setRetry]=useState(0),[message,setMessage]=useState(''),[images,setImages]=useState(false);
 const pane=useRef<HTMLElement>(null),positions=useRef<Record<string,number>>(stored.positions&&typeof stored.positions==='object'&&!Array.isArray(stored.positions)?stored.positions:{});
 const selected=volumes.find(volume=>volume.id.toLowerCase()===String(id).toLowerCase());
 const refresh=useRef(new ReadingRefresh());
 const refreshReading=()=>setRetry(refresh.current.request([kind+':list',...(selected?[kind+':'+selected.id.toLowerCase()]:[])]));
 useEffect(()=>{const key=kind+':list',controller=new AbortController(),ticket=refresh.current.pending(key);setLoadingList(true);setError('');readingVolumes(kind,controller.signal,ticket!==undefined).then(value=>{if(!controller.signal.aborted)setVolumes(value);}).catch(error=>{if(!controller.signal.aborted)setError(String(error?.message||error));}).finally(()=>{if(!controller.signal.aborted){refresh.current.complete(key,ticket);setLoadingList(false);}});return()=>controller.abort();},[kind,retry]);
 useEffect(()=>{
  if(!selected){setChapters([]);return;}
  const key=kind+':'+selected.id.toLowerCase(),controller=new AbortController(),ticket=refresh.current.pending(key);setLoading(true);setError('');setChapters([]);setImages(false);
  volumeChapters(kind,selected.id,controller.signal,ticket!==undefined).then(value=>{if(!controller.signal.aborted){setChapters(value);setChapter(old=>Math.min(value.length-1,Math.max(0,old)));}}).catch(error=>{if(!controller.signal.aborted)setError(String(error?.message||error));}).finally(()=>{if(!controller.signal.aborted){refresh.current.complete(key,ticket);setLoading(false);}});
  return()=>controller.abort();
 },[kind,selected?.id,retry]);
 useEffect(()=>{const pop=()=>{const next=readingRoute();if(next.kind===kind){setId(next.id);setChapter(next.chapter);}};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[kind]);
 useEffect(()=>{if(!id)return;try{localStorage.setItem(storeKey(kind),JSON.stringify({id,chapter,positions:positions.current}));}catch{}},[id,chapter]);
 useEffect(()=>{if(pane.current&&chapters.length)pane.current.scrollTop=positions.current[id+':'+chapter]||0;},[id,chapter,chapters]);
 function rememberScroll(){if(!pane.current)return;positions.current[id+':'+chapter]=pane.current.scrollTop;try{localStorage.setItem(storeKey(kind),JSON.stringify({id,chapter,positions:positions.current}));}catch{}}
 function navigate(nextId:string,nextChapter:number){rememberScroll();setId(nextId);setChapter(nextChapter);setImages(false);history.pushState(null,'',readingUrl(kind,nextId,nextChapter));}
 async function copy(){const url=new URL('https://dnd.center/wiki/');url.searchParams.set('reading',kind);url.searchParams.set('book',id);url.searchParams.set('chapter',String(chapter));try{await navigator.clipboard.writeText(url.href);setMessage('已复制章节链接。');}catch{setMessage('复制失败；章节地址为 '+url.href);}}
 function openReference(reference:string,referenceKind?:string){const url=new URL('https://dnd.center/wiki/');url.searchParams.set('reference',reference.includes('|')?reference:reference+'|'+(selected?.source||selected?.id||''));url.searchParams.set('referenceKind',referenceKind||'rule');window.open(url.href,'_blank','noopener');}
 const current=chapters[chapter],title=selected?.contents?.[chapter]?.name||current?.name||`章节 ${chapter+1}`;
 const filtered=volumes.filter(volume=>[volume.name,volume.ENG_name,volume.id,volume.source,volume.translator].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <section className="reading-volume" aria-label={kind==='book'?'书籍阅读':'冒险阅读'} onKeyDown={event=>{if((event.target as HTMLElement).matches('input,textarea,select,[contenteditable=true]'))return;if(event.key==='['&&chapter>0){event.preventDefault();navigate(id,chapter-1);}if(event.key===']'&&chapter<chapters.length-1){event.preventDefault();navigate(id,chapter+1);}}}>
  <div className="reading-volume-tools"><input aria-label={kind==='book'?'搜索书籍':'搜索冒险'} placeholder="搜索中文名、英文名、来源或译者" value={query} onChange={event=>setQuery(event.target.value)}/><span>{loadingList?'正在读取目录…':`${filtered.length} 份资料`}</span><button disabled={loading||loadingList} onClick={refreshReading}>更新阅读资料</button><a href={`https://5e.kiwee.top/${kind==='book'?'books':'adventures'}.html`} target="_blank" rel="noopener noreferrer">资料来源 ↗</a></div>
  <div className="reading-volume-body"><nav className="reading-volume-list" aria-label="出版资料目录">{filtered.map(volume=><button key={volume.id} aria-current={selected?.id===volume.id} onClick={()=>navigate(volume.id,0)}>{volume.name}<small>{volume.id}{volume.published?' · '+volume.published:''}</small></button>)}</nav>
   <article className="reading-volume-content" ref={pane} tabIndex={0} onScroll={rememberScroll}>
    {selected&&<><header className="reading-volume-heading"><h2>{selected.name}</h2>{selected.ENG_name&&<small>{selected.ENG_name}</small>}<TranslationNotice raw={selected}/></header>
     {chapters.length>0&&<div className="reading-chapters"><button disabled={chapter===0} onClick={()=>navigate(id,chapter-1)}>上一章</button><select aria-label="选择章节" value={chapter} onChange={event=>navigate(id,Number(event.target.value))}>{chapters.map((value,index)=><option key={index} value={index}>{selected.contents?.[index]?.name||value.name||`章节 ${index+1}`}</option>)}</select><button disabled={chapter===chapters.length-1} onClick={()=>navigate(id,chapter+1)}>下一章</button><button onClick={()=>void copy()}>复制章节链接</button><button aria-pressed={images} onClick={()=>setImages(old=>!old)}>{images?'收起插图':'显示插图'}</button></div>}
    </>}
    {(loading||loadingList)&&<p role="status">{loading?'正在读取正文…':'正在读取出版资料目录…'}</p>}
    {error&&<><p role="alert">资料读取失败：{error}</p><button onClick={refreshReading}>重试读取</button></>}
    {!loading&&!error&&current&&<section className="rules-prose" aria-label="章节正文"><h3>{title}{current.ENG_name&&current.ENG_name!==title&&<small> {current.ENG_name}</small>}</h3><ChapterBody value={typeof current==='object'&&!Array.isArray(current)?{...current,name:undefined,ENG_name:undefined}:current} images={images} onLink={openReference}/></section>}
    {!selected&&!loadingList&&!error&&<p>选择一份资料后读取章节；正文会保留在本机缓存中。</p>}
    {message&&<p role="status">{message}</p>}
   </article>
  </div>
 </section>;
}
function ChapterBody({value,images,onLink}:{value:unknown;images:boolean;onLink:(reference:string,kind?:string)=>void}){
 // Existing prose rendering handles tables, lists and references. Image nodes
 // are kept separate so opening a chapter never starts image downloads.
 function prune(value:any):any{if(Array.isArray(value))return value.map(prune).filter(value=>value!=null);if(!value||typeof value!=='object')return value;if(value.type==='image')return null;if(value.type==='statblock'&&value.name){const tags:Record<string,string>={monster:'creature',variantrule:'variantrule',class:'class',subclass:'class'};return `{@${tags[value.prop]||value.prop||'variantrule'} ${value.name}|${value.source||''}}`;}if(value.type==='statblockInline')return {type:'entries',name:value.data?.name||value.name,entries:value.data?.entries||value.entries||['此嵌入资料请在资料源中核对完整内容。']};return Object.fromEntries(Object.entries(value).map(([key,value])=>[key,prune(value)]));}
 const figures:Raw[]=[];
 function collect(value:any){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(collect);return;}if(value.type==='image')figures.push(value);else Object.values(value).forEach(collect);}
 if(images)collect(value);
 return <><Entries value={prune(value)} onLink={onLink}/>{images&&(figures.length?<ReadingImages images={figures}/>:<p>本章没有独立插图。</p>)}</>;
}
