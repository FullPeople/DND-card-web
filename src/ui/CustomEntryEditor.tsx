import {useEffect,useState} from 'react';
import {createCustomEntry,CUSTOM_TYPES} from '../core/customEntries';
import type {Entry} from '../core/model';
import {EntryDraggable} from './DragEntry';
import {Entries} from './Entries';
import {entryLabel} from '../core/entryLabel';
import './customEntries.css';
export function CustomEntryEditor({entry,busy,save,remove,newEntry}:{entry?:Entry;busy:boolean;save:(entry:Entry)=>Promise<void>;remove:(entry:Entry)=>Promise<void>;newEntry:()=>void}){
 const [name,setName]=useState(''),[type,setType]=useState('item'),[body,setBody]=useState(''),[raw,setRaw]=useState('{}'),[error,setError]=useState('');
 const [price,setPrice]=useState(''),[weight,setWeight]=useState('');
 const isItem=CUSTOM_TYPES[type]?.kind==='item';
 useEffect(()=>{setPrice(typeof entry?.raw.value==='number'?String(entry.raw.value/100):'');setWeight(typeof entry?.raw.weight==='number'?String(entry.raw.weight):'');},[entry?.id,entry?.revision]);
 useEffect(()=>{setName(entry?.name||'');setType(entry?.raw._customType||'item');setBody(entry?.entries.map(e=>typeof e==='string'?e:JSON.stringify(e)).join('\n\n')||'');setRaw(JSON.stringify(Object.fromEntries(Object.entries(entry?.raw||{}).filter(([key])=>!key.startsWith('_'))),null,2));setError('');},[entry?.id,entry?.revision]);
 return <section className="custom-entry-editor" aria-label="自定义条目编辑器"><header><h2>{entry?'编辑条目':'新建条目'}</h2><button onClick={newEntry}>＋ 新建条目</button>{entry&&<EntryDraggable entry={entry} className="custom-drag" aria-label={`拖拽 ${entry.name}`}>拖拽 {entryLabel(entry)}</EntryDraggable>}</header><form onSubmit={e=>{e.preventDefault();try{const fields=JSON.parse(raw);if(isItem){if(!price.trim()||!weight.trim())throw Error('请填写价格与重量');fields.value=Number(price)*100;fields.weight=Number(weight);}const next=createCustomEntry({id:entry?.id,name,type,body,raw:fields,edition:entry?.edition,revision:String(Number(entry?.revision||0)+1)});void save(next).catch(e=>setError(String(e)));}catch(e){setError(String(e));}}}>
 <div className="custom-fields"><label>名称<input aria-label="自定义条目名称" required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label><label>类型<select aria-label="自定义条目类型" value={type} onChange={e=>setType(e.target.value)}>{Object.entries(CUSTOM_TYPES).map(([key,t])=><option value={key} key={key}>{t.label}</option>)}</select></label></div>
 {isItem&&<div className="custom-fields custom-item-fields"><label>价格（金币）<input aria-label="物品价格（金币）" type="number" required min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>重量（磅）<input aria-label="物品重量（磅）" type="number" required min="0" step="any" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div>}
 <label>正文<textarea className="custom-body" aria-label="自定义条目正文" value={body} onChange={e=>setBody(e.target.value)} maxLength={100000}/></label>
 <details><summary>结构字段</summary><textarea aria-label="自定义结构字段" spellCheck={false} value={raw} onChange={e=>setRaw(e.target.value)}/></details>
 {error&&<p role="alert">{error}</p>}<footer><button type="submit" disabled={busy}>保存条目</button>{entry&&<button type="button" disabled={busy} onClick={()=>void remove(entry).catch(e=>setError(String(e)))}>删除条目</button>}</footer></form>
 {entry&&<article className="rules-prose"><h3>{entryLabel(entry)}</h3><Entries value={entry.entries}/></article>}
 </section>;
}
