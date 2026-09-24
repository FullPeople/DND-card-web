import { useEffect, useMemo, useRef, useState } from 'react';
import { VirtualList } from './VirtualList';
import { KIND_LABELS, type Character, type Entry } from '../core/model';
import { decodeProfile, encodeProfile } from '../core/profileCode';
import { compareSources, useSources, type SourceMode } from './SourceName';
import { tabOf, LIBRARY_TABS } from './libraryData';

export function SourceSettings({c,entries,edit,readOnly=false,summary=false,changeMode}:{c:Character;entries:Entry[];edit:(action:(draft:Character)=>void,mode?:SourceMode)=>void;readOnly?:boolean;summary?:boolean;changeMode?:(mode:SourceMode)=>void}){
 const {registry,format,mode,setMode:localSetMode}=useSources();
 const setMode=changeMode||localSetMode;
 const [search,setSearch]=useState(''),[active,setActive]=useState(''),[entrySearch,setEntrySearch]=useState(''),[category,setCategory]=useState('all'),[code,setCode]=useState(''),[error,setError]=useState('');
 const modal=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(active){modal.current?.showModal();}return()=>modal.current?.close();},[active]);
 const grouped=useMemo(()=>{const m=new Map<string,Entry[]>();for(const e of entries){const list=m.get(e.source)||[];list.push(e);m.set(e.source,list);}for(const source of c.profile.enabledSources)if(!m.has(source))m.set(source,[]);return m;},[entries,c.profile.enabledSources]);
 const sources=useMemo(()=>[...grouped.keys()].sort((a,b)=>compareSources(a,b,registry)),[grouped,registry]);
 const counts=useMemo(()=>new Map([...grouped].map(([source,rows])=>{const tally=new Map<string,number>();for(const e of rows){const key=KIND_LABELS[e.kind];tally.set(key,(tally.get(key)||0)+1);}return [source,[...tally]];})),[grouped]);
 const rows=grouped.get(active)||[];
 const categories=[...new Set(rows.map(tabOf))];
 const filtered=useMemo(()=>rows.filter(e=>(category==='all'||tabOf(e)===category)&&`${e.name} ${e.english}`.toLowerCase().includes(entrySearch.toLowerCase())),[rows,category,entrySearch]);
 const disabled=new Set(c.profile.disabledEntries||[]);
 function setEntries(list:Entry[],enabled:boolean){edit(draft=>{const ids=new Set(draft.profile.disabledEntries||[]);for(const e of list)if(enabled)ids.delete(e.id);else ids.add(e.id);draft.profile.disabledEntries=[...ids];});}
 return <>
 <section className="settings-section"><h3>资料显示</h3><div className="setting-row"><span>简写显示方式</span><div className="segmented" role="radiogroup" aria-label="简写显示方式">{([['full','纯文本'],['short','简写'],['both','纯文本(简写)']] as [SourceMode,string][]).map(([v,label])=><button key={v} role="radio" aria-checked={mode===v} onClick={()=>setMode(v)}>{label}</button>)}</div></div></section>
 {summary?<section className="settings-section source-summary"><h3>已开启扩展 <small>{c.profile.enabledSources.length}</small></h3>{sources.filter(s=>c.profile.enabledSources.includes(s)).map(source=>{const restricted=(grouped.get(source)||[]).filter(e=>disabled.has(e.id));return <div className="source-summary-book" key={source}><strong>{format(source)}</strong>{restricted.length>0&&<details><summary>禁用条目 · {restricted.length}</summary><ul>{restricted.map(e=><li key={e.id}><s>{e.name}</s><small>{KIND_LABELS[e.kind]}</small></li>)}</ul></details>}</div>;})}</section>:<section className="settings-section source-settings"><h3>资料来源 <small>已启用 {c.profile.enabledSources.length}</small></h3>
 <div className="profile-transfer"><h3>配置码</h3><textarea aria-label="规则配置码" value={code} onChange={e=>setCode(e.target.value)} spellCheck={false}/><div className="dialog-actions"><button onClick={async()=>{try{setError('');setCode(await encodeProfile({version:1,edition:c.edition,profile:c.profile,sourceDisplay:mode}));}catch(e){setError(String(e));}}}>导出配置</button><button disabled={readOnly||!code.trim()} onClick={async()=>{try{setError('');const data=await decodeProfile(code);edit(d=>{d.edition=data.edition;d.profile=data.profile;},data.sourceDisplay);setMode(data.sourceDisplay);}catch{setError('配置码无效或已损坏。');}}}>导入配置</button><button disabled={!code} onClick={async()=>{try{await navigator.clipboard.writeText(code);}catch{setError('无法访问剪贴板，请选中配置码复制。');}}}>复制</button></div>{error&&<p role="alert">{error}</p>}</div>
 <div className="dialog-actions"><button disabled={readOnly} onClick={()=>edit(d=>{d.profile.enabledSources=['PHB','XPHB'];delete d.profile.autoSourceDefaults;})}>仅基础规则</button><button disabled={readOnly} onClick={()=>edit(d=>{d.profile.enabledSources=sources;})}>全部开启</button><button disabled={readOnly} onClick={()=>edit(d=>{d.profile.enabledSources=[];delete d.profile.autoSourceDefaults;})}>全部禁用</button></div>
 <input aria-label="筛选资料来源" className="source-search" placeholder="查找书名或简写" value={search} onChange={e=>setSearch(e.target.value)}/>
 <div className="source-books">{sources.filter(s=>`${s} ${registry[s]?.name||''}`.toLowerCase().includes(search.toLowerCase())).map(source=>{

 return <div className="source-book" key={source}><label><input type="checkbox" disabled={readOnly} checked={c.profile.enabledSources.includes(source)} onChange={e=>edit(d=>{d.profile.enabledSources=e.target.checked?[...new Set([...d.profile.enabledSources,source])]:d.profile.enabledSources.filter(s=>s!==source);})}/><span><strong>{format(source)}</strong><small>{registry[source]?.date}</small><span className="source-counts">{(counts.get(source)||[]).map(([kind,count])=><span key={kind}>{kind} {count}</span>)}</span></span></label><button aria-label={`设置来源 ${source}`} className="source-gear" aria-expanded={active===source} onClick={()=>{setActive(source);setCategory('all');setEntrySearch('');}}>⚙</button>

 </div>;})}</div>

 </section>}
 {active&&<dialog className="dialog source-dialog" ref={modal} aria-label={`来源设置 ${format(active)}`} onCancel={e=>{e.preventDefault();e.stopPropagation();setActive('');}} onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setActive('');}}>
 <header className="dialog-head"><h2>{format(active)}</h2><button aria-label="关闭来源设置" onClick={()=>setActive('')}>×</button></header>
 <div className="dialog-body source-entry-settings"><input aria-label="搜索来源内条目" value={entrySearch} onChange={e=>setEntrySearch(e.target.value)} placeholder="搜索本书条目"/><div className="source-categories"><button aria-pressed={category==='all'} onClick={()=>setCategory('all')}>全部</button>{categories.map(k=><button key={k} aria-pressed={category===k} onClick={()=>setCategory(k)}>{LIBRARY_TABS[k]}</button>)}</div><div className="dialog-actions"><button disabled={readOnly} onClick={()=>setEntries(filtered,true)}>启用当前结果</button><button disabled={readOnly} onClick={()=>setEntries(filtered,false)}>禁用当前结果</button><span>{filtered.length} 项</span></div>
 <VirtualList items={filtered} rowHeight={32} className="source-entries" label="来源内条目" resetKey={`${active}:${category}:${entrySearch}`} itemKey={e=>e.id} renderRow={e=><label className={c.profile.enabledSources.includes(active)&&disabled.has(e.id)?'entry-disabled':''}><input type="checkbox" disabled={readOnly} aria-label={`启用条目 ${e.name}`} checked={!disabled.has(e.id)} onChange={ev=>setEntries([e],ev.target.checked)}/><span>{e.name}<small>{KIND_LABELS[e.kind]}</small></span></label>}/>
 </div></dialog>}
</>;
}
