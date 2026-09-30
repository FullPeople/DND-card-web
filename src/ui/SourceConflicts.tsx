import {useMemo,useState,useEffect,useRef} from 'react';
import {sourceConflicts,conflictSelection,type ConflictSettings} from '../core/sourceCatalog';
import {KIND_LABELS,type Character,type Entry} from '../core/model';
import {useSources} from './SourceName';
import {Entries} from './Entries';
import './sourceCatalog.css';

export function SourceConflicts({c,entries,edit,readOnly=false}:{c:Character;entries:Entry[];edit:(action:(draft:Character)=>void)=>void;readOnly?:boolean}){
 const {registry,format}=useSources(),settings=c.profile.sourceConflicts;
 const groups=useMemo(()=>sourceConflicts(entries.filter(e=>c.profile.enabledSources.includes(e.source)&&!c.profile.disabledEntries?.includes(e.id)),c.edition,registry),[entries,c.edition,c.profile.enabledSources,c.profile.disabledEntries,registry]);
 const [choices,setChoices]=useState<ConflictSettings['selected']>(),[search,setSearch]=useState(''),[limit,setLimit]=useState(30);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(choices)dialog.current?.showModal();return()=>dialog.current?.close();},[!!choices]);
 if(!groups.length)return null;
 const shown=groups.filter(g=>`${g.name} ${g.entries.map(e=>`${e.english} ${format(e.source)}`).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
 const changeMode=(mode:ConflictSettings['mode'])=>edit(d=>{d.profile.sourceConflicts={mode,selected:d.profile.sourceConflicts?.selected||{}};});
 return <><div className="source-conflict-notice" role="status"><div className="source-conflict-heading"><strong>检测到同名冲突内容</strong><div className="dialog-actions"><button disabled={readOnly} aria-pressed={!settings||settings.mode==='latest'} onClick={()=>changeMode('latest')}>按最新时间算（默认）</button><button disabled={readOnly} aria-pressed={settings?.mode==='manual'} onClick={()=>{setChoices(Object.fromEntries(groups.map(g=>[g.key,conflictSelection(g,settings)])));setSearch('');setLimit(30);}}>手动比较</button><button disabled={readOnly} aria-pressed={settings?.mode==='all'} onClick={()=>changeMode('all')}>全部显示</button></div></div><small>{c.edition} · {groups.length} 组 · 此项是用来解决相同的旧内容的，例如奇械师</small></div>
 {choices&&<dialog ref={dialog} className="dialog source-compare-dialog" aria-label="手动比较同名资料" onCancel={e=>{e.preventDefault();e.stopPropagation();setChoices(undefined);}}><header className="dialog-head"><h2>手动比较同名资料</h2><button aria-label="关闭同名比较" onClick={()=>setChoices(undefined)}>×</button></header><div className="dialog-body"><input aria-label="搜索同名资料" placeholder="查找条目或来源" value={search} onChange={e=>{setSearch(e.target.value);setLimit(30);}}/>{shown.slice(0,limit).map(group=><section className="source-compare-group" key={group.key}><h3>{group.name} <small>{KIND_LABELS[group.kind]}</small></h3>{group.uncertain&&<p>日期缺失或并列，请核对正文后选择。</p>}{group.entries.map(e=><article key={e.id}><label><input type="checkbox" checked={(choices[group.key]||[]).includes(e.id)} onChange={event=>setChoices(old=>({...old,[group.key]:event.target.checked?[...new Set([...(old?.[group.key]||[]),e.id])]:(old?.[group.key]||[]).filter(id=>id!==e.id)}))}/><strong>{e.name}</strong> · {format(e.source)} · {registry[e.source]?.date||'日期未知'}</label><details><summary>查看正文</summary><Entries value={e.entries}/></details></article>)}</section>)}{shown.length>limit&&<button onClick={()=>setLimit(n=>n+30)}>继续显示 · 还有 {shown.length-limit} 组</button>}</div><footer className="dialog-actions"><button disabled={readOnly} onClick={()=>{edit(d=>{d.profile.sourceConflicts={mode:'manual',selected:choices};});setChoices(undefined);}}>保存手动选择</button><button onClick={()=>setChoices(undefined)}>取消</button></footer></dialog>}</>;
}
