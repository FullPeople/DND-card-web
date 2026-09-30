import {useMemo,useState} from 'react';
import {KIND_LABELS,selectionAllowed,uid,type Character,type Entry,type Kind,type Selection} from '../core/model';
import {MIGRATION_ROOTS,emptyMigrationChoices,migrationCandidates,migrationOptions,migrationDraft,planCardMigration,retainedProficiencies,type MigrationChoices,type GrantChoice} from '../core/cardMigration';
import {migrationStillCurrent,type ClassMigrationPlan} from '../core/classMigration';
import {Entries} from './Entries';
import {ClearableSearch} from './ClearableSearch';
import './cardMigration.css';
const stages=['基础资料','来源气泡','额外气泡','保留自定义','法术与熟练','最终预览'];
const extraKinds:Kind[]=['feat','feature','rule','spell','item'];
function suggested(c:Character,rows:Entry[],current?:Entry){const available=rows.filter(e=>selectionAllowed(c,e));return available.find(e=>e.id===current?.id&&e.source===current.source)?.id||(available.length===1?available[0].id:'');}
function Mapping({c,row,entries,kinds,value,change}:{c:Character;row:Selection;entries:Entry[];kinds:Kind[];value:string;change:(v:string)=>void}){
 const [query,setQuery]=useState(''),[search,setSearch]=useState(false);
 const candidates=useMemo(()=>migrationCandidates(c,row,entries,kinds),[c,row,entries,kinds]);
 const options=useMemo(()=>[...new Map([...candidates,...(search?migrationOptions(c,entries,kinds,query):[]),...entries.filter(e=>e.id===value)].map(e=>[e.id,e])).values()],[c,candidates,entries,kinds,query,search,value]);
 const target=options.find(e=>e.id===value);
 return <article className="migration-row"><div className="migration-row-title"><strong>{row.entry.name}</strong><small>{KIND_LABELS[row.entry.kind]} · {row.entry.source}{row.entry.kind==='class'?` · ${row.level} 级`:row.entry.kind==='item'?` · 数量 ${row.quantity}`:''}</small></div>
 <label>替换为<select aria-label={`${row.entry.name}同步目标`} value={value} onChange={e=>change(e.target.value)}><option value="">保留原记录</option>{options.map(e=><option key={e.id} value={e.id} disabled={!selectionAllowed(c,e)}>{e.name} · {KIND_LABELS[e.kind]} · {e.source} · {e.edition}{!selectionAllowed(c,e)?'（来源未启用）':''}</option>)}</select></label>
 <button className="migration-search-toggle" type="button" onClick={()=>setSearch(v=>!v)}>{search?'收起手动查找':'手动查找其他资料'}</button>{search&&<ClearableSearch label={`${row.entry.name}查找资料`} value={query} change={setQuery} placeholder="输入资料名称（最多显示 100 项）"/>}
 {candidates.length>1&&<p className="muted">有多个同名候选，请核对来源后选择。</p>}
 <details><summary>比较正文{target?' · 目标位置：'+KIND_LABELS[target.kind]:''}</summary><div className="migration-compare"><section><h4>原记录</h4><Entries value={row.entry.entries}/></section><section><h4>{target?target.name+' · '+target.source:'保留原记录'}</h4>{target&&<Entries value={target.entries}/>}</section></div></details></article>;
}
export function CardMigration({c,entries,loading,readOnly,save,busy,setBusy}:{c:Character;entries:Entry[];loading:boolean;readOnly:boolean;save:(plan:ClassMigrationPlan)=>Promise<void>;busy:boolean;setBusy:(v:boolean)=>void}){
 const [step,setStep]=useState(0),[choices,setChoices]=useState<MigrationChoices>(emptyMigrationChoices),[plan,setPlan]=useState<ClassMigrationPlan>(),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const draftResult=useMemo(()=>{try{return {draft:migrationDraft(c,entries,step===0?emptyMigrationChoices():choices,step),error:''};}catch(e){return {draft:undefined,error:String(e)};}},[c,entries,choices,step]);
 const draft=draftResult.draft;
 const roots=useMemo(()=>c.selections.filter(s=>MIGRATION_ROOTS.includes(s.entry.kind)),[c]);
 const value=(bucket:'roots'|'extras'|'spells',row:Selection,kinds:Kind[])=>choices[bucket][row.id]??suggested(draft?.card||c,migrationCandidates(draft?.card||c,row,entries,kinds),row.entry);
 const setValue=(bucket:'roots'|'extras'|'spells',id:string,v:string)=>{setChoices(old=>({...old,[bucket]:{...old[bucket],[id]:v}}));setError('');};
 const grantValue=(g:NonNullable<typeof draft>['grants'][number]):GrantChoice=>choices.grants[g.key]??{include:true,replaceId:g.matches.length===1?g.matches[0].id:undefined};
 const trainingValue=(t:NonNullable<typeof draft>['training'][number])=>choices.training[t.id]??suggested(c,t.candidates);
 function next(){if(!draft)return;try{
  const selected=structuredClone(choices);
  if(step===0){selected.roots=Object.fromEntries(roots.map(row=>[row.id,value('roots',row,[row.entry.kind])]));selected.grants={};selected.extras={};selected.keep={};selected.spells={};selected.training={};}
  if(step===1){selected.grants=Object.fromEntries(draft.grants.map(g=>[g.key,grantValue(g)]));selected.extras={};selected.keep={};selected.spells={};selected.training={};}
  if(step===2){selected.extras=Object.fromEntries(draft.extraRows.map(row=>[row.id,value('extras',row,extraKinds)]));selected.keep={};selected.spells={};selected.training={};}
  if(step===3)selected.keep=Object.fromEntries(draft.leftovers.map(row=>[row.id,choices.keep[row.id]!==false]));
  if(step===4){selected.spells=Object.fromEntries(draft.spellRows.map(row=>[row.id,value('spells',row,['spell'])]));selected.training=Object.fromEntries(draft.training.map(t=>[t.id,trainingValue(t)]));setPlan(planCardMigration(c,entries,selected,{id:uid(),now:new Date().toISOString()}));}
  else migrationDraft(c,entries,selected,step+1);
  setChoices(selected);setStep(step+1);setError('');
 }catch(e){setError(String(e));}}
 const stale=!!plan&&!migrationStillCurrent(plan,c);
 async function create(){if(!plan||stale||busy||uncertain)return;setBusy(true);setError('');try{await save(plan);}catch(e){setError(String(e));setUncertain(!!(e as {uncertain?:boolean}).uncertain);}finally{setBusy(false);}}
 return <section className="card-migration"><p>逐步核对旧卡与 {c.edition} 资料库。每一步由你确认，最后创建同步副本，原角色卡保留。</p><p className="muted">同名只作为候选；等级、背包数量、已消耗资源和手动熟练记录会保留。资料未找到的内容可继续保留为自定义。</p>
 <ol className="migration-steps" aria-label="同步步骤">{stages.map((label,i)=><li key={label} aria-current={step===i?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
 {loading&&<p role="status">正在加载资料，完成后才可继续核对。</p>}
 <fieldset disabled={busy||uncertain}><h3>{step+1}. {stages[step]}</h3>
 {step===0&&<><p>核对背景、职业、种族、子职和背包。可逐项比较正文，选「保留原记录」继续使用自定义内容。</p>{roots.map(row=><Mapping key={row.id} c={c} row={row} entries={entries} kinds={[row.entry.kind]} value={value('roots',row,[row.entry.kind])} change={v=>setValue('roots',row.id,v)}/>)}{!roots.length&&<p>没有需要核对的基础资料。</p>}</>}
 {step===1&&draft&&<><p>以下内容来自刚确认的资料声明。选择替换对应旧气泡，或添加新气泡；取消勾选后，后续刷新也不会自动补回。</p>{draft.grants.map(g=>{const v=grantValue(g);return <article className="migration-row" key={g.key}><label><input type="checkbox" checked={v.include} onChange={e=>setChoices(old=>({...old,grants:{...old.grants,[g.key]:{...v,include:e.target.checked}}}))}/>同步 {g.row.entry.name} <small>来自 {g.owner.entry.name} · {g.row.entry.source}</small></label>{v.include&&<label>对应的旧气泡<select aria-label={`${g.row.entry.name}对应旧气泡`} value={v.replaceId||''} onChange={e=>setChoices(old=>({...old,grants:{...old.grants,[g.key]:{...v,replaceId:e.target.value||undefined}}}))}><option value="">新增气泡，旧记录留到后续核对</option>{g.matches.map(s=><option value={s.id} key={s.id}>{s.entry.name} · {s.entry.source}</option>)}</select></label>}<details><summary>查看来源正文</summary><Entries value={g.row.entry.entries}/></details></article>;})}{!draft.grants.length&&<p>没有新增的明确来源气泡。已主动删除的赠品会继续保留删除状态。</p>}</>}
 {step===2&&draft&&<><p>核对剩余的特性气泡。匹配到专长、法术或装备时，会放入对应位置，避免继续混在「其他特性」中。</p>{draft.extraRows.map(row=><Mapping key={row.id} c={draft.card} row={row} entries={entries} kinds={extraKinds} value={value('extras',row,extraKinds)} change={v=>setValue('extras',row.id,v)}/>)}{!draft.extraRows.length&&<p>没有额外气泡。</p>}</>}
 {step===3&&draft&&<><p>以下内容仍未关联资料库。勾选保留；取消勾选只会从同步副本移除，原卡保留。</p>{draft.leftovers.map(row=><article className="migration-row" key={row.id}><label><input type="checkbox" checked={choices.keep[row.id]!==false} onChange={e=>setChoices(old=>({...old,keep:{...old.keep,[row.id]:e.target.checked}}))}/>保留 {row.entry.name} · {KIND_LABELS[row.entry.kind]}</label><details><summary>查看原正文</summary><Entries value={row.entry.entries}/></details></article>)}{!draft.leftovers.length&&<p>没有未匹配的额外自定义气泡。</p>}</>}
 {step===4&&draft&&<><p>核对法术、装备训练与语言。法术已预备状态随原记录保留；技能、豁免和专精保留玩家当前选择。</p>{draft.spellRows.map(row=><Mapping key={row.id} c={draft.card} row={row} entries={entries} kinds={['spell']} value={value('spells',row,['spell'])} change={v=>setValue('spells',row.id,v)}/>)}{draft.training.map(t=><article className="migration-row" key={t.id}><label>{({armor:'护甲',weapons:'武器',tools:'工具',languages:'语言'} as Record<string,string>)[t.group]} · {t.text}<select aria-label={`${t.text}熟练同步目标`} value={trainingValue(t)} onChange={e=>setChoices(old=>({...old,training:{...old.training,[t.id]:e.target.value}}))}><option value="">保留原记录</option>{t.candidates.map(e=><option key={e.id} value={e.id} disabled={!selectionAllowed(c,e)}>{e.name} · {e.source}</option>)}</select></label></article>)}<p>保留熟练：{retainedProficiencies(c).join('、')||'无手动记录'}</p></>}
 {step===5&&plan&&<div className="migration-preview"><p>请核对副本变化。新出现的资源次数从 0 开始，不会把同步当作休息或再次领取起始装备、金钱。</p>{([['资料替换',plan.changed],['数值变化',plan.stats],['新增内容',plan.added],['移除内容',plan.removed],['资源变化',plan.resources],['保留与待核对',plan.warnings]] as const).map(([label,items])=>items.length>0&&<section key={label}><h4>{label}</h4><ul>{items.map((item,i)=><li key={i}>{item}</li>)}</ul></section>)}{stale&&<p role="alert">角色记录已变化，请返回重新核对并预览。</p>}</div>}
 {!!draft?.warnings.length&&step<5&&<details><summary>尚待核对的规则声明（{draft.warnings.length}）</summary><ul>{draft.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
 <div className="migration-actions">{step>0&&<button onClick={()=>{setStep(step-1);setPlan(undefined);setError('');}}>上一步</button>}{step<5?<button className="primary" disabled={loading||!draft} onClick={next}>确认并继续</button>:<button className="primary" disabled={loading||readOnly||stale||!plan} onClick={()=>void create()}>{busy?'正在保存…':'创建同步副本'}</button>}</div></fieldset>
 {(error||draftResult.error)&&<p className="inline-error" role="alert">{error||draftResult.error}</p>}{uncertain&&<p>创建结果尚未确认。请先重新读取角色簿核对副本，避免重复创建。</p>}</section>;
}
