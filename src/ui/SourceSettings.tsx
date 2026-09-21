import { useMemo, useState } from 'react';
import { KIND_LABELS, type Character, type Entry } from '../core/model';
import { decodeProfile, encodeProfile } from '../core/profileCode';
import { compareSources, useSources, type SourceMode } from './SourceName';
import { tabOf, LIBRARY_TABS } from './libraryData';

type Edit=(action:(draft:Character)=>void)=>void;
export function SourceSettings({c,entries,edit}:{c:Character;entries:Entry[];edit:Edit}){
 const {registry,format,mode,setMode}=useSources();
 const [search,setSearch]=useState(''),[active,setActive]=useState(''),[entrySearch,setEntrySearch]=useState(''),[category,setCategory]=useState('all'),[limit,setLimit]=useState(80),[code,setCode]=useState(''),[error,setError]=useState('');
 const grouped=useMemo(()=>{const m=new Map<string,Entry[]>();for(const e of entries){const list=m.get(e.source)||[];list.push(e);m.set(e.source,list);}for(const source of c.profile.enabledSources)if(!m.has(source))m.set(source,[]);return m;},[entries,c.profile.enabledSources]);
 const sources=[...grouped.keys()].sort((a,b)=>compareSources(a,b,registry));
 const rows=grouped.get(active)||[];
 const categories=[...new Set(rows.map(tabOf))];
 const filtered=rows.filter(e=>(category==='all'||tabOf(e)===category)&&`${e.name} ${e.english}`.toLowerCase().includes(entrySearch.toLowerCase()));
 const disabled=new Set(c.profile.disabledEntries||[]);
 function setEntries(list:Entry[],enabled:boolean){edit(draft=>{const ids=new Set(draft.profile.disabledEntries||[]);for(const e of list)if(enabled)ids.delete(e.id);else ids.add(e.id);draft.profile.disabledEntries=[...ids];});}
 return <>
 <section className="settings-section"><h3>资料显示</h3><div className="setting-row"><span>简写显示方式</span><div className="segmented" role="radiogroup" aria-label="简写显示方式">{([['full','纯文本'],['short','简写'],['both','纯文本(简写)']] as [SourceMode,string][]).map(([v,label])=><button key={v} role="radio" aria-checked={mode===v} onClick={()=>setMode(v)}>{label}</button>)}</div></div></section>
 <section className="settings-section source-settings"><h3>资料来源 <small>已启用 {c.profile.enabledSources.length}</small></h3>
 <div className="dialog-actions"><button onClick={()=>edit(d=>{d.profile.enabledSources=['PHB','XPHB'];})}>仅基础规则</button><button onClick={()=>edit(d=>{d.profile.enabledSources=sources;})}>全部开启</button><button onClick={()=>edit(d=>{d.profile.enabledSources=[];})}>全部禁用</button></div>
 <input aria-label="筛选资料来源" className="source-search" placeholder="查找书名或简写" value={search} onChange={e=>setSearch(e.target.value)}/>
 <div className="source-books">{sources.filter(s=>`${s} ${registry[s]?.name||''}`.toLowerCase().includes(search.toLowerCase())).map(source=>{
 const counts=new Map<string,number>();for(const e of grouped.get(source)||[]){const key=KIND_LABELS[e.kind];counts.set(key,(counts.get(key)||0)+1);}
 return <div className={`source-book ${active===source?'is-open':''}`} key={source}><label><input type="checkbox" checked={c.profile.enabledSources.includes(source)} onChange={e=>edit(d=>{d.profile.enabledSources=e.target.checked?[...new Set([...d.profile.enabledSources,source])]:d.profile.enabledSources.filter(s=>s!==source);})}/><span><strong>{format(source)}</strong><small>{registry[source]?.date}</small><span className="source-counts">{[...counts].map(([kind,count])=><span key={kind}>{kind} {count}</span>)}</span></span></label><button aria-label={`设置来源 ${source}`} className="source-gear" aria-expanded={active===source} onClick={()=>{setActive(active===source?'':source);setCategory('all');setEntrySearch('');setLimit(80);}}>⚙</button>
 {active===source&&<div className="source-entry-settings"><input aria-label="搜索来源内条目" value={entrySearch} onChange={e=>{setEntrySearch(e.target.value);setLimit(80);}} placeholder="搜索本书条目"/><div className="source-categories"><button aria-pressed={category==='all'} onClick={()=>{setCategory('all');setLimit(80);}}>全部</button>{categories.map(k=><button key={k} aria-pressed={category===k} onClick={()=>{setCategory(k);setLimit(80);}}>{LIBRARY_TABS[k]}</button>)}</div><div className="dialog-actions"><button onClick={()=>setEntries(filtered,true)}>启用当前结果</button><button onClick={()=>setEntries(filtered,false)}>禁用当前结果</button><span>{filtered.length} 项</span></div><div className="source-entries">{filtered.slice(0,limit).map(e=><label key={e.id} className={c.profile.enabledSources.includes(source)&&disabled.has(e.id)?'entry-disabled':''}><input type="checkbox" aria-label={`启用条目 ${e.name}`} checked={!disabled.has(e.id)} onChange={ev=>setEntries([e],ev.target.checked)}/><span>{e.name}<small>{KIND_LABELS[e.kind]}</small></span></label>)}{filtered.length>limit&&<button onClick={()=>setLimit(n=>n+80)}>显示更多</button>}</div></div>}
 </div>;})}</div>
 <div className="profile-transfer"><h3>配置码</h3><textarea aria-label="规则配置码" value={code} onChange={e=>setCode(e.target.value)} spellCheck={false}/><div className="dialog-actions"><button onClick={async()=>{try{setError('');setCode(await encodeProfile({version:1,edition:c.edition,profile:c.profile,sourceDisplay:mode}));}catch(e){setError(String(e));}}}>导出配置</button><button disabled={!code.trim()} onClick={async()=>{try{setError('');const data=await decodeProfile(code);edit(d=>{d.edition=data.edition;d.profile=data.profile;});setMode(data.sourceDisplay);}catch{setError('配置码无效或已损坏。');}}}>导入配置</button><button disabled={!code} onClick={async()=>{try{await navigator.clipboard.writeText(code);}catch{setError('无法访问剪贴板，请选中配置码复制。');}}}>复制</button></div>{error&&<p role="alert">{error}</p>}</div>
 </section></>;
}
