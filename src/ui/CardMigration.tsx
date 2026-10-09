import {useId,useMemo,useRef,useState} from 'react';
import {KIND_LABELS,selectionAllowed,uid,type Character,type Entry,type Kind,type Selection} from '../core/model';
import {MIGRATION_ROOTS,migrationCandidates,migrationOptions,retainedProficiencies} from '../core/cardMigration';
import {planBatchCardMigration,suggestedBatchRoots} from '../core/batchCardMigration';
import {migrationStillCurrent,type ClassMigrationPlan} from '../core/classMigrationQuery';
import {MigrationEntry} from './MigrationEntry';
import {useSources} from './SourceName';
import {ClearableSearch} from './ClearableSearch';
import './cardMigration.css';
const stages=['基础资料','整卡同步预览'];
function MatchChoices({c,original,candidates,options,value,change,label,meta}:{c:Character;original:Entry;candidates:Entry[];options:(query:string)=>Entry[];value:string;change:(v:string)=>void;label:string;meta?:string}){
 const [query,setQuery]=useState(''),[manual,setManual]=useState(false),group=useId();
 const standard=candidates.some(e=>e.id===value),custom=manual||!!value&&!standard;
 const result=custom&&query.trim()?options(query):[];
 const selected=!standard&&value?options('').find(e=>e.id===value):undefined;
 const choice=(entry:Entry)=>{const allowed=selectionAllowed(c,entry);return <label key={entry.id} className={'migration-candidate '+(entry.id===value?'is-selected':'')+(!allowed?' is-unavailable':'')}><input type="radio" name={group} aria-label={`${label}：${entry.name}（${entry.source}）`} checked={value===entry.id} disabled={!allowed} onChange={()=>{change(entry.id);setManual(!candidates.some(e=>e.id===entry.id));setQuery('');}}/><MigrationEntry entry={entry}/>{!allowed&&<small>来源未启用</small>}</label>;};
 return <article className="migration-row migration-mapping"><div className="migration-original"><MigrationEntry entry={original}/>{meta&&<small>{meta}</small>}</div><span className="migration-arrow" aria-hidden="true">→</span><div className="migration-candidates" role="radiogroup" aria-label={label}>{candidates.map(choice)}<label className={'migration-candidate migration-custom '+(!value||custom?'is-selected':'')} onClick={()=>setManual(true)}><input type="radio" name={group} aria-label={label+'：自定义'} checked={!value||custom} onChange={()=>{change('');setManual(true);}}/><strong>自定义</strong><small>{selected?`手动选择：${selected.name}`:'保留原项，或手动选择其他资料'}</small></label></div>{custom&&<div className="migration-manual"><ClearableSearch label={`${original.name}查找资料`} value={query} change={setQuery} placeholder="输入名称，选择要替换的资料；留空则保留原项"/>{selected&&<div className="migration-manual-selected">已选择 <MigrationEntry entry={selected}/><button type="button" onClick={()=>change('')}>保留原项</button></div>}{result.length>0&&<div className="migration-search-results">{result.map(choice)}</div>}{query.trim()&&!result.length&&<p className="muted">没有匹配资料，可继续保留原项。</p>}</div>}</article>;
}
function Mapping({c,row,entries,kinds,value,change}:{c:Character;row:Selection;entries:Entry[];kinds:Kind[];value:string;change:(v:string)=>void}){
 const candidates=useMemo(()=>migrationCandidates(c,row,entries,kinds),[c,row,entries,kinds]);
 return <MatchChoices c={c} original={row.entry} candidates={candidates} options={q=>q?migrationOptions(c,entries,kinds,q):entries.filter(e=>e.id===value)} value={value} change={change} label={`${row.entry.name}同步目标`} meta={KIND_LABELS[row.entry.kind]+(row.entry.kind==='class'?` · ${row.level} 级`:row.entry.kind==='item'?` · 数量 ${row.quantity}`:'')}/>;
}
export function CardMigration({c,entries,loading,readOnly,save,busy,setBusy}:{c:Character;entries:Entry[];loading:boolean;readOnly:boolean;save:(plan:ClassMigrationPlan)=>Promise<void>;busy:boolean;setBusy:(v:boolean)=>void}){
 const {registry}=useSources(),explain=(text:string)=>text.replace(/\b[A-Z][A-Z0-9-]*\b/g,id=>id==='CUSTOM'||id==='IMPORTED'?'自定义':registry[id]?.name||id);
 const [roots,setRoots]=useState<Record<string,string>>({}),[keep,setKeep]=useState<Record<string,boolean>>({}),[review,setReview]=useState<{original:Character;roots:Record<string,string>;identity:{id:string;now:string}}>(),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),saving=useRef(false);
 const suggested=useMemo(()=>suggestedBatchRoots(c,entries,roots),[c,entries,roots]);
 const mappingContext=useMemo(()=>({...c,selections:c.selections.map(row=>({...row,entry:entries.find(e=>e.id===suggested[row.id])||row.entry}))}),[c,entries,suggested]);
 const rootRows=useMemo(()=>c.selections.filter(s=>MIGRATION_ROOTS.includes(s.entry.kind)&&s.entry.kind!=='item'),[c]);
 const result=useMemo(()=>{if(!review)return {};try{return {batch:planBatchCardMigration(review.original,entries,review.roots,keep,review.identity)};}catch(e){return {error:String(e)};}},[review,entries,keep]);
 const batch=result.batch,plan=batch?.plan,stale=!!plan&&!migrationStillCurrent(plan,c);
 function next(){try{const snapshot={original:structuredClone(c),roots:{...suggested,...roots},identity:{id:uid(),now:new Date().toISOString()}};planBatchCardMigration(snapshot.original,entries,snapshot.roots,{},snapshot.identity);setKeep({});setReview(snapshot);setError('');}catch(e){setError(String(e));}}
 async function create(){if(!plan||stale||busy||uncertain||readOnly||saving.current)return;saving.current=true;setBusy(true);setError('');try{await save(plan);}catch(e){setError(String(e));setUncertain(!!(e as {uncertain?:boolean}).uncertain);}finally{saving.current=false;setBusy(false);}}
 return <section className="card-migration"><p>核对基础资料后，一次同步 {c.edition} 规则对应的来源气泡、法术与相关内容。最后统一预览，并筛选要保留的自定义内容。</p><p className="muted">先保留同步前的旧卡副本，再更新当前卡；当前卡 ID 与棋子绑定保留。等级、已有装备、已消耗资源、手动调整和选择记录不会重置；资料不明确的内容默认保留。</p>
 <ol className="migration-steps" aria-label="同步步骤">{stages.map((label,i)=><li key={label} aria-current={Number(!!review)===i?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
 {loading&&<p role="status">正在加载资料，完成后才可继续核对。</p>}
 <fieldset disabled={busy||uncertain}><h3>{review?'2. 整卡同步预览':'1. 基础资料'}</h3>
 {!review&&<><p>选择目标基础资料，其来源内容会一起处理，无需逐个同步。选「自定义」保留原项或手动查找。</p>{rootRows.map(row=><Mapping key={row.id} c={mappingContext} row={row} entries={entries} kinds={[row.entry.kind]} value={roots[row.id]??suggested[row.id]??''} change={v=>{setRoots(old=>({...old,[row.id]:v}));setError('');}}/>)}{!rootRows.length&&<p>没有需要核对的基础资料，继续预览其余内容。</p>}</>}
 {review&&batch&&<div className="migration-preview"><p>来源内容已统一处理。新增资源从 0 开始，已有装备和金钱不会重复领取。核对以下变化，再备份旧卡并同步当前卡。</p>
 <div className="migration-batch-counts" aria-label="同步变化汇总"><span>更新 {plan!.refreshed.length}</span><span>新增 {plan!.added.length}</span><span>移除 {plan!.removed.length}</span><span>待筛选 {batch.retained.length}</span></div>
 {([['资料替换',plan!.changed],['数值变化',plan!.stats],['新增内容',plan!.added],['移除内容',plan!.removed],['资源变化',plan!.resources],['保留与待核对',plan!.warnings]] as const).map(([label,items])=>items.length>0&&<details key={label} open={label==='数值变化'||label==='移除内容'}><summary>{label}（{items.length}）</summary><ul>{items.map((item,i)=><li key={i}>{explain(item)}</li>)}</ul></details>)}
 <section className="migration-retention"><h4>自定义与未匹配内容</h4><p>默认全部保留。逐项勾选或取消；取消只影响更新后的当前卡，旧卡备份保留原内容。</p><div className="migration-retention-grid">{batch.retained.map(({row,reason})=><label className={'migration-retention-tile '+(keep[row.id]!==false?'is-kept':'')} key={row.id}><input type="checkbox" aria-label={'保留 '+row.entry.name} checked={keep[row.id]!==false} onChange={e=>setKeep(old=>({...old,[row.id]:e.target.checked}))}/><span><MigrationEntry entry={row.entry}/><small>{KIND_LABELS[row.entry.kind]} · {reason}</small></span></label>)}</div>{!batch.retained.length&&<p>没有需要筛选的自定义或未匹配内容。</p>}</section>
 <p>保留熟练：{retainedProficiencies(review.original).join('、')||'无手动记录'}</p>{stale&&<p role="alert">角色记录已变化，请返回重新核对并预览。</p>}</div>}
 <div className="migration-actions">{review&&<button onClick={()=>{setReview(undefined);setKeep({});setError('');}}>上一步</button>}{!review?<button className="primary" disabled={loading||busy} onClick={next}>确认并继续</button>:<button className="primary" disabled={loading||readOnly||stale||!plan||busy||uncertain} onClick={()=>void create()}>{busy?'正在保存…':'备份旧卡并同步当前卡'}</button>}</div></fieldset>
 {(error||result.error)&&<p className="inline-error" role="alert">{error||result.error}</p>}{uncertain&&<p>同步结果尚未确认，本机草稿已保留。请先重新读取角色簿核对备份和当前卡，避免重复提交。</p>}</section>;
}
