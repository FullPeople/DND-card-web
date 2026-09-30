import {useMemo,useState} from 'react';
import {editionAllows,selectionAllowed,uid,type Character,type Entry} from '../core/model';
import {planClassMigration,reviewClasses,migrationStillCurrent,type ClassMigrationPlan} from '../core/classMigration';
import './classMigration.css';

export function ClassMigration({c,entries,loading,readOnly,save,busy,setBusy}:{c:Character;entries:Entry[];loading:boolean;readOnly:boolean;save:(plan:ClassMigrationPlan)=>Promise<void>;busy:boolean;setBusy:(v:boolean)=>void}){
 const reviews=useMemo(()=>reviewClasses(c,entries),[c,entries]);
 const [choices,setChoices]=useState<Record<string,string>>({}),[plan,setPlan]=useState<ClassMigrationPlan>(),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const candidates=entries.filter(e=>e.kind==='class'&&editionAllows(e,c.edition));
 const selected=(id:string,suggested?:Entry)=>choices[id]??suggested?.id??'';
 const stale=!!plan&&!migrationStillCurrent(plan,c);
 async function create(){if(!plan||stale||busy||uncertain)return;setBusy(true);setError('');try{await save(plan);}catch(e){setError(String(e));setUncertain(!!(e as {uncertain?:boolean}).uncertain);}finally{setBusy(false);}}
 return <section className="class-migration"><p>按当前角色的 {c.edition} 规则核对职业。确认目标并查看变化后，生成一张同步副本；原卡继续保留在角色簿中。</p><p className="muted">职业等级、手动填写和已消耗资源会保留。来源声明的职业特性随资料更新；子职、自定义规则和未能识别的选择需要继续核对。</p>
 {!reviews.length&&<p>这张卡尚未填写职业，无需迁移。</p>}
 {loading&&<p role="status">正在读取职业资料，请等待加载完成。</p>}
 <fieldset disabled={busy||uncertain}><div className="class-review-list">{reviews.map(({row,status,suggested,message})=><article key={row.id}><h3>{row.entry.name} · {row.level} 级 <small>{row.entry.source}</small></h3><p>{message}</p><label>同步目标<select aria-label={`${row.entry.name}同步目标`} value={selected(row.id,suggested)} onChange={e=>{setChoices(old=>({...old,[row.id]:e.target.value}));setPlan(undefined);setError('');}}><option value="">保留这项职业原样</option>{candidates.map(entry=><option key={entry.id} value={entry.id} disabled={!selectionAllowed(c,entry)}>{entry.name} · {entry.english} · {entry.source}{!selectionAllowed(c,entry)?'（来源未启用）':''}</option>)}</select></label>{status==='custom'&&<small>自定义职业不会仅凭名称自动替换。</small>}</article>)}</div>
 <button disabled={loading||!reviews.length||readOnly} onClick={()=>{try{setPlan(planClassMigration(c,entries,Object.fromEntries(reviews.map(({row,suggested})=>[row.id,selected(row.id,suggested)])),{id:uid(),now:new Date().toISOString()}));setError('');}catch(e){setError(String(e));setPlan(undefined);}}}>预览同步变化</button>
 {plan&&<div className="class-migration-preview"><h3>同步副本中的变化</h3>{([['职业资料',plan.changed],['计算数值',plan.stats],['新增来源内容',plan.added],['更新来源内容',plan.refreshed],['移除失效的自动内容',plan.removed],['资源记录',plan.resources],['仍需核对',plan.warnings]] as const).map(([label,items])=>items.length>0&&<div key={label}><h4>{label}</h4><ul>{items.map((item,i)=><li key={i}>{item}</li>)}</ul></div>)}<p>新出现的资源次数从 0 开始，核对后可按规则恢复。</p>{stale&&<p role="alert">角色记录已变化，请重新预览。</p>}<button className="primary" disabled={readOnly||stale} onClick={()=>void create()}>{busy?'正在保存…':'创建同步副本'}</button></div>}
 </fieldset>{error&&<p className="inline-error" role="alert">{error}</p>}{uncertain&&<p>创建结果尚未确认。请先重新读取角色簿核对副本，避免重复创建。</p>}</section>;
}
