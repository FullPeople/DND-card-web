import {useState} from 'react';
import type {Character,Entry} from '../core/model';
import type {Edit} from './CharacterPages';
import {useSources} from './SourceName';
import {entryLabel} from '../core/entryLabel';
import {setSourceSpellChoices,setSourceResourceColumn,syncSourceSpells,type SourceSpellChoice} from '../core/automation/sourceSpells';
import {syncAutoResources} from '../core/resources';
import './sourceSpellControls.css';

export function SourceResourceColumnControl({c,choice,entries,edit,writable}:{c:Character;choice:SourceSpellChoice;entries:Entry[];edit:Edit;writable:boolean}){
 const [message,setMessage]=useState(''),selected=c.automation?.spellResourceColumns?.[choice.key]||'';
 function save(column:string){if(!writable)return;try{edit(draft=>{setSourceResourceColumn(draft,choice.key,column,entries);syncAutoResources(draft);syncSourceSpells(draft,entries);});setMessage('选择已应用；保存结果请查看卡面状态。');}catch(error){setMessage(error instanceof Error?error.message:String(error));}}
 return <fieldset className="source-spell-choice" disabled={!writable}><legend>{choice.label}</legend><p>选择这项施法实际消耗的职业资源。已有点数保留，恢复方式请按来源核对。</p><select aria-label={choice.label} value={selected} onChange={event=>save(event.target.value)}><option value="">请选择</option>{selected&&!choice.resourceColumns?.some(column=>column.label===selected)&&<option value={selected}>旧选择：{selected}（需要重新核对）</option>}{choice.resourceColumns?.map(column=><option key={column.label} value={column.label}>{column.className} · {column.label}（上限 {column.max}）</option>)}</select>{message&&<small role="status">{message}</small>}</fieldset>;
}

export function SourceSpellChoiceControl({c,choice,entries,edit,writable}:{c:Character;choice:SourceSpellChoice;entries:Entry[];edit:Edit;writable:boolean}){
 const {registry}=useSources(),selected=c.automation?.spellChoices?.[choice.key]||[];
 const known=[...new Map([...c.selections.map(s=>s.entry),...entries].map(e=>[e.id,e] as const).reverse()).values()];
 const [message,setMessage]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(40);
 const referenceKey=(name:string,source:string)=>JSON.stringify([name.trim().toLowerCase(),source.trim().toLowerCase()]),index=new Map<string,Map<string,Entry>>();
 for(const entry of known.filter(e=>e.kind==='spell'))for(const name of new Set([entry.name,entry.english])){const key=referenceKey(name,entry.source),rows=index.get(key)||new Map<string,Entry>();rows.set(entry.id,entry);index.set(key,rows);}
 const options=(choice.spells||[]).map(ref=>{const [uid,cast]=ref.split('#'),[name,book]=uid.split('|'),source=book||'PHB',matches=index.get(referenceKey(name,source)),entry=matches?.size===1?matches.values().next().value:undefined,castHint=cast==='c'?' · 戏法':/^[1-9]$/.test(cast||'')?` · 按 ${cast} 环施放`:'';return {ref,name,source,entry,castHint};});
 const searchable=options.length>20,term=query.trim().toLowerCase(),matching=options.filter(option=>[option.name,option.entry?.name,option.entry?.english,option.source,registry[option.source]?.name].some(text=>text?.toLowerCase().includes(term))),unselected=matching.filter(option=>!selected.includes(option.ref));
 const visible=searchable?[...options.filter(option=>selected.includes(option.ref)),...unselected.slice(0,limit)]:options;
 function save(refs:string[]){if(!writable)return;let applied=false;try{edit(draft=>{setSourceSpellChoices(draft,choice.key,refs,entries);syncSourceSpells(draft,entries);applied=true;});setMessage(applied?'选择已应用到当前卡；保存与同步结果请看卡面状态。':'选择未提交，请查看卡面的只读或同步提示。');}catch(error){setMessage(String(error instanceof Error?error.message:error));}}
 return <fieldset className="source-spell-choice" disabled={!writable}><legend>{choice.label}</legend><p>可选 {choice.count} 项，已选 {selected.length} 项。可以少选，稍后继续填写。</p>
 {searchable&&<label className="source-spell-search">搜索法术<input type="search" aria-label={choice.label+'筛选'} placeholder="输入法术名或来源" value={query} onChange={event=>{setQuery(event.target.value);setLimit(40);}}/></label>}
 {visible.map(({ref,name,source,entry,castHint})=>{const checked=selected.includes(ref),blocked=choice.blockedSpells?.includes(ref);return <label key={ref}><input type="checkbox" checked={checked} disabled={!writable||!checked&&(selected.length>=choice.count!||blocked)} onChange={e=>save(e.target.checked?[...selected,ref]:selected.filter(x=>x!==ref))}/><span>{entry?entryLabel(entry):name}<small>{registry[entry?.source||source]?.name||(entry?.source||source)}{entry?' · '+(entry.edition==='both'?'通用':entry.edition):' · 资料尚未唯一匹配，加载后关联'}{castHint}{blocked&&!checked?' · 已在本组其他位置选择':''}</small></span></label>;})}
 {searchable&&!matching.length&&<p>没有匹配的法术。已选项会保留显示。</p>}
 {searchable&&unselected.length>limit&&<button type="button" onClick={()=>setLimit(value=>value+40)}>显示更多法术（还有 {unselected.length-limit} 项）</button>}
 {(selected.length>choice.count!||selected.some(x=>!choice.spells?.includes(x)))&&<p role="alert">旧选择超过当前数量上限，或已不在当前声明中；记录保留但暂停授予。<button onClick={()=>save([])}>清空旧选择后重选</button></p>}
 {message&&<small role="status">{message}</small>}</fieldset>;
}
