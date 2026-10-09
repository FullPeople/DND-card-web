import {useState} from 'react';
import type {Raw} from '../core/model';
import {parseMonsterDraft,validateMonsterDraft} from '../core/monsterEditing';
import {CustomEntryCanvas} from './CustomEntryCanvas';
import './monsterEditor.css';

export function MonsterEditor({value,save,busy}:{value:any;save:(value:any)=>Promise<void>;busy:boolean}){
 const [draft,setDraft]=useState<Raw>(()=>structuredClone(value||{})),[json,setJson]=useState<string>(),[error,setError]=useState(''),[regionError,setRegionError]=useState(''),[generation,setGeneration]=useState(0);
 const entries=Array.isArray(draft.entries)?draft.entries:[],body=entries.map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n\n');
 function toggle(){
  if(regionError){setError(regionError);return;}
  if(json===undefined){setJson(JSON.stringify(draft,null,2));setError('');return;}
  try{setDraft(parseMonsterDraft(json));setJson(undefined);setError('');}catch(e){setError(String(e instanceof Error?e.message:e));}
 }
 return <form className="monster-editor monster-editor-document" onSubmit={event=>{event.preventDefault();if(regionError)return;setError('');try{const next=json===undefined?validateMonsterDraft(draft):parseMonsterDraft(json);void save(next).catch(e=>setError(String(e)));}catch(e){setError(String(e instanceof Error?e.message:e));}}}>
  <nav aria-label="怪物编辑方式"><button type="button" aria-pressed={json===undefined} onClick={()=>{if(json!==undefined)toggle();}}>完整展示</button><button type="button" aria-pressed={json!==undefined} onClick={()=>{if(json===undefined)toggle();}}>JSON 模式</button></nav>
  <fieldset disabled={busy}>
   {json===undefined?<CustomEntryCanvas key={generation} disabled={busy} monsterCard name={draft.name||''} english={draft.ENG_name||draft.english||''} type="monster" edition="both" body={body} entries={entries} raw={draft} change={setDraft} invalid={setRegionError} identity={(key,text)=>setDraft(old=>({...old,[key==='english'?'ENG_name':key]:text}))} changeBody={text=>setDraft(old=>({...old,entries:text.split(/\n\s*\n/).filter(v=>v.trim()).map(v=>{try{const node=JSON.parse(v);return node&&typeof node==='object'?node:v;}catch{return v;}})}))}/>:<textarea className="monster-json-input" aria-label="怪物完整 JSON" value={json} onChange={event=>setJson(event.target.value)} spellCheck={false}/>}
  </fieldset>{(error||regionError)&&<p role="alert">{error||regionError}</p>}
  <div className="monster-editor-footer"><button type="submit" disabled={busy||!!regionError}>{busy?'保存中…':'保存资料'}</button><button type="button" disabled={busy} onClick={()=>{setGeneration(n=>n+1);setDraft(structuredClone(value||{}));setJson(undefined);setRegionError('');setError('');}}>还原本次修改</button></div>
 </form>;
}
