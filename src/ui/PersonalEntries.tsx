import {CustomStructureFields} from './CustomStructureFields';
import {customCreationPrompt,parseCustomEntryJson,validateCustomFields} from '../core/customEntrySchema';
import {parseFile,validateEntryContent} from '../core/validation';
import {useState} from 'react';
import {createCustomEntry,CUSTOM_TYPES} from '../core/customEntries';
import {candidateReason} from '../core/engine';
import {removeSelection} from '../core/sheet';
import {subclassOwner,uid,type Character,type Selection} from '../core/model';
import {NumberInput} from './NumberInput';

type Props={c:Character;edit:(fn:(c:Character)=>void)=>void};
export function PersonalEntries({c,edit}:Props){
 const [editing,setEditing]=useState<string>(),[type,setType]=useState('feature'),[name,setName]=useState(''),[body,setBody]=useState(''),[error,setError]=useState('');
 const [level,setLevel]=useState(1),[faces,setFaces]=useState(8),[spellLevel,setSpellLevel]=useState(1),[parent,setParent]=useState('');
 const [jsonText,setJsonText]=useState(''),[message,setMessage]=useState(''),[english,setEnglish]=useState('');
 const [price,setPrice]=useState(0),[weight,setWeight]=useState(0),[advanced,setAdvanced]=useState('{}');
 const current=c.selections.find(s=>s.id===editing),classes=c.selections.filter(s=>s.entry.kind==='class');
 function load(row?:Selection){
  setJsonText('');setMessage('');setEnglish(row?.entry.english||'');setEditing(row?.id);setType(row?.entry.raw._customType||row?.entry.kind||'feature');setName(row?.entry.name||'');setBody(row?.entry.entries.map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n\n')||'');
  setLevel(row?.level||1);setFaces(row?.entry.raw.hd?.faces||8);setSpellLevel(row?.entry.raw.level||0);setParent(row?.parentId||'');setPrice((row?.entry.raw.value||0)/100);setWeight(row?.entry.raw.weight||0);
  setAdvanced(JSON.stringify(Object.fromEntries(Object.entries(row?.entry.raw||{}).filter(([k])=>!k.startsWith('_'))),null,2));setError('');
 }
 function save(){try{
  const raw=parseFile(advanced) as Record<string,any>,kind=CUSTOM_TYPES[type].kind;
  if(kind==='class')raw.hd={number:1,faces};
  if(kind==='spell')raw.level=spellLevel;
  if(kind==='item'){raw.value=price*100;raw.weight=weight;}
  if(kind==='subclass'){const owner=classes.find(s=>s.id===parent);if(!owner)throw Error('请选择所属职业');raw.className=owner.entry.name;raw.classSource=owner.entry.source;}
  const entry=createCustomEntry({id:current?.entry.id,type,name,body,raw,revision:String(Number(current?.entry.revision||0)+1)});delete entry.raw._workbenchCustom;entry.english=english||entry.name;validateCustomFields(type,entry.raw,entry.entries);validateEntryContent(entry.entries);
  const without={...c,selections:c.selections.filter(s=>s.id!==current?.id)},reason=candidateReason(without,entry);if(reason)throw Error(reason);
  edit(draft=>{
   if(current){const row=draft.selections.find(s=>s.id===current.id)!;row.entry=entry;row.level=kind==='class'?level:1;row.parentId=parent||undefined;if(kind==='class')for(const sub of draft.selections.filter(s=>s.entry.kind==='subclass'&&s.parentId===row.id)){sub.entry.raw.className=entry.name;sub.entry.raw.classEnglish=entry.english;}return;}
   if(['race','background'].includes(kind))for(const old of draft.selections.filter(s=>s.entry.kind===kind))removeSelection(draft,old.id);
   const owner=kind==='subclass'?subclassOwner(draft,entry):undefined;
   if(owner)for(const old of draft.selections.filter(s=>s.entry.kind==='subclass'&&subclassOwner(draft,s.entry)?.id===owner.id))removeSelection(draft,old.id);
   if(kind==='race')draft.size='M';
   draft.selections.push({id:uid(),entry,level:kind==='class'?level:1,quantity:1,equipped:false,parentId:owner?.id||parent||undefined});
  });load();
 }catch(e){setError(e instanceof Error?e.message:String(e));}}
 return <section className="personal-entries">
 {classes.length>0&&<section><h3>职业等级</h3><div className="personal-levels">{classes.map(s=><label key={s.id}>{s.entry.name}<NumberInput aria-label={`${s.entry.name}目标等级`} type="number" min="1" max="20" value={s.level} onChange={e=>edit(c=>{c.selections.find(row=>row.id===s.id)!.level=Math.max(1,Math.min(20,Math.trunc(Number(e.target.value)||1)));})}/></label>)}</div></section>}
 <h3>卡内自定义条目</h3><div className="personal-entry-list">{c.selections.filter(s=>s.entry.raw._custom&&!s.entry.raw._workbenchCustom).map(s=><button key={s.id} onClick={()=>load(s)}>{s.entry.name}</button>)}<button onClick={()=>load()}>＋ 新建</button></div>
 <details className="custom-json-import" open={!!jsonText}><summary>完整 JSON / 创作提示词</summary><textarea aria-label="卡内完整条目 JSON" value={jsonText} onChange={e=>setJsonText(e.target.value)}/><button type="button" onClick={()=>{try{const entry=parseCustomEntryJson(jsonText,type);if(current&&entry.raw._customType!==type)throw Error('已保存条目不能更改类型，请新建条目');setType(entry.raw._customType);setName(entry.name);setEnglish(entry.english);setBody(entry.entries.map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n\n'));setAdvanced(JSON.stringify(entry.raw,null,2));setFaces(entry.raw.hd?.faces||8);setSpellLevel(entry.raw.level||0);setPrice((entry.raw.value||0)/100);setWeight(entry.raw.weight||0);setError('');setMessage('JSON 已载入；核对后加入角色卡');}catch(error){setError(String(error));}}}>载入 JSON</button><button type="button" onClick={()=>{void navigator.clipboard.writeText(customCreationPrompt(type)).then(()=>setMessage('创作提示词已复制')).catch(()=>{setJsonText(customCreationPrompt(type));setMessage('可复制上方提示词');});}}>复制创作提示词</button>{message&&<p role="status">{message}</p>}</details>
 <form onSubmit={e=>{e.preventDefault();save();}}>
 <div className="custom-fields"><label>类型<select aria-label="卡内条目类型" value={type} disabled={!!current} onChange={e=>{setType(e.target.value);setParent('');}}>{Object.entries(CUSTOM_TYPES).map(([id,t])=><option key={id} value={id}>{t.label}</option>)}</select></label><label>名称<input aria-label="卡内条目名称" required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label></div>
 {type==='class'&&<div className="custom-fields"><label>等级<NumberInput aria-label="自定义职业等级" type="number" min="1" max="20" value={level} onChange={e=>setLevel(Math.max(1,Math.min(20,Math.trunc(Number(e.target.value)||1))))}/></label></div>}
 {['subclass','feature','feat'].includes(type)&&<label>归属<select aria-label="自定义条目归属" value={parent} onChange={e=>setParent(e.target.value)}><option value="">{type==='subclass'?'选择所属职业':'独立条目'}</option>{c.selections.filter(s=>type==='subclass'?s.entry.kind==='class':['class','subclass','race','background'].includes(s.entry.kind)).map(s=><option key={s.id} value={s.id}>{s.entry.name}</option>)}</select></label>}
 {CUSTOM_TYPES[type].kind==='item'&&<div className="custom-fields"><label>价格（金币）<NumberInput type="number" min="0" value={price} onChange={e=>setPrice(Math.max(0,Number(e.target.value)||0))}/></label><label>重量（磅）<NumberInput type="number" min="0" value={weight} onChange={e=>setWeight(Math.max(0,Number(e.target.value)||0))}/></label></div>}
 <CustomStructureFields type={type} raw={(()=>{try{const fields=JSON.parse(advanced);return fields&&typeof fields==='object'&&!Array.isArray(fields)?{...fields,...(type==='class'?{hd:{number:1,faces}}:{}),...(type==='spell'?{level:spellLevel}:{})}:undefined;}catch{return undefined;}})()} change={fields=>{setAdvanced(JSON.stringify(fields,null,2));if(type==='class')setFaces(fields.hd?.faces||8);if(type==='spell')setSpellLevel(fields.level||0);}}/>
 <label>正文<textarea aria-label="卡内条目正文" rows={6} maxLength={100000} value={body} onChange={e=>setBody(e.target.value)}/></label>
 <details><summary>结构字段</summary><textarea aria-label="卡内条目结构字段" value={advanced} rows={6} onChange={e=>setAdvanced(e.target.value)}/></details>
 {error&&<p role="alert">{error}</p>}<button type="submit">{current?'保存修改':'加入角色卡'}</button>
 </form></section>;
}
