import {useEffect,useState} from 'react';
import {identity,manifestUrl} from 'virtual:automation-progress';
import {filterProgress,sourceRuleCounts,loadProgress,publicationFor,PROGRESS_CATEGORIES,type ProgressManifest,type ProgressCapability} from '../platform/automationProgress';
import type {AnnouncementMode} from '../platform/announcement';
import './automationProgress.css';

export default function AutomationProgress({release,mode}:{release:unknown;mode:AnnouncementMode}){
 const [manifest,setManifest]=useState<ProgressManifest>();const [error,setError]=useState('');
 const [suiteRelease,setSuiteRelease]=useState<unknown>();
 const [category,setCategory]=useState('all'),[source,setSource]=useState('all'),[origin,setOrigin]=useState('all');
 useEffect(()=>{let active=true;void loadProgress(manifestUrl,identity.manifestSha256).then(data=>{if(active)setManifest(data);}).catch(()=>{if(active)setError('进度清单暂时无法读取或与程序不匹配；所有未取得证据的状态均待核实。');});return()=>{active=false;};},[]);
 // Suite also requires a release receipt beside the Web artifact. A host version
 // string, an announcement version or a different channel cannot substitute for it.
 useEffect(()=>{if(mode!=='suite')return;let active=true;void fetch('./release.json',{cache:'no-store'}).then(r=>r.ok?r.json():undefined).then(r=>{if(active)setSuiteRelease(r);}).catch(()=>{});return()=>{active=false;};},[mode]);
 if(error)return <p role="status" className="automation-progress-warning">{error}</p>;
 if(!manifest)return <p role="status">正在读取精简进度清单…</p>;
 const publication=publicationFor(manifest,identity,mode==='suite'?suiteRelease:release);
 const current=new Set(publication.availableIds),verified=manifest.capabilities.filter(c=>c.verified&&c.playerAvailable).length;
 const books=manifest.sources.filter(s=>origin==='all'||s.origin===origin);
 const rows=filterProgress(manifest,category,source,origin);
 const selectedBook=manifest.sources.find(s=>s.id===source);
 const ruleCounts=sourceRuleCounts(manifest,source,category);
 const card=(c:ProgressCapability)=><article className="automation-progress-item" key={c.id} data-capability={c.id}>
  <h4>{c.title}<small>{c.state==='partial'?(c.verified?'部分支持':'验证待核实'):c.state==='pending'?'待实现 / 待核实':'入口未开放'}</small></h4>
  <ul className="automation-progress-states" aria-label={`${c.title}证据状态`}>
   <li>已核对：<strong>{c.reviewed?'机制说明与代码':'待核实'}</strong></li>
   <li>已实现并验证：<strong>{c.verified?'原创单元夹具':'待核实'}</strong></li>
   <li>当前发布已加载且验证可用：<strong data-current-available={current.has(c.id)}>{current.has(c.id)?'已验证（所列边界内）':c.playerAvailable?'待核实':'未开放'}</strong></li>
  </ul>
  {c.playerAvailable&&c.verified?<dl><dt>自动做什么</dt><dd>{c.does}</dd><dt>如何触发</dt><dd>{c.trigger}</dd><dt>需要条件</dt><dd>{c.conditions}</dd><dt>手动边界</dt><dd>{c.boundary}</dd></dl>:<p>{c.status||'已识别该机制；当前源码的实现验证证据待核实，仅展示状态。'}</p>}
  {!!c.sampleSources.length&&<p className="automation-progress-samples">原创夹具来源身份：{c.sampleSources.join(' / ')}；不代表该书整条规则验收。</p>}
 </article>;
 return <div className="automation-progress">
  <section className="automation-progress-intro" aria-label="自动化状态概览">
   <h3>现在自动到哪一步？</h3>
   <p className="automation-progress-headline">{publication.matched?`当前运行发布 ${publication.version}，${current.size} 项玩家机制有匹配的可用验证。`:`这份清单有 ${verified} 项玩家机制通过开发核验；当前发布可用仍待核实。`}</p>
   <p>{manifest.notice}</p>
   <p className="automation-progress-meta">最近更新时间：<time>{new Date(manifest.updatedAt).toISOString().replace('T',' ').slice(0,19)} UTC</time><br/>清单匹配源码：<code>{manifest.build.sourceCommit.slice(0,12)}</code> · 规则 {manifest.build.rulesVersion} / 协议 {manifest.build.protocol}<br/>读取到的发布版本：{publication.version}</p>
   <p role="status" className={publication.matched?'automation-progress-confirmed':'automation-progress-warning'}>{publication.reason}</p>
   <dl className="automation-progress-totals">
    <div><dt>规则条目已核对</dt><dd>{manifest.audit.counts?`${manifest.audit.counts.reviewed} / ${manifest.audit.counts.total}`:'待核实'}</dd></div>
    <div><dt>整条已实现并验证</dt><dd>{manifest.audit.snapshot?`待核实（当前版本逐条证据 ${manifest.audit.counts!.implementedVerified} 条）`:manifest.audit.counts?manifest.audit.counts.implementedVerified:'待核实'}</dd></div>
    <div><dt>当前发布整条可用</dt><dd>{publication.ruleAuditVerified?manifest.audit.counts?.implementedVerified:'待核实'}</dd></div>
   </dl>
   {manifest.audit.snapshot&&<p className="automation-progress-snapshot">取得的本地快照标记整条完成 {manifest.audit.snapshot.localMarkedComplete} 条、无需机制 {manifest.audit.snapshot.noMechanics} 条、已核对但未整条完成 {manifest.audit.snapshot.acceptedIncomplete} 条、待核对 {manifest.audit.snapshot.unreviewed} 条。{manifest.audit.snapshot.partialPayloadRecords} 条未完成记录含部分本地载荷；{manifest.audit.snapshot.historicalEvidenceRecords} 条关联历史本地测试。这些均不提升为当前版本整条已验证或线上可用。</p>}
   <p>“已核对”不等于已实现，“单元验证”不等于当前发布验证。{manifest.audit.scope==='local-snapshot'?'条目数字仅覆盖取得的本地快照，不能解释成全站完成率。':'机制项数不能当作规则条目完成率。'}{manifest.verification.testedAt&&` 开发验证时间：${new Date(manifest.verification.testedAt).toISOString().slice(0,19).replace('T',' ')} UTC。`}</p>
  </section>
  <section aria-label="来源书与功能筛选">
   <h3>来源书与功能覆盖</h3><p>{manifest.sourcesNotice}</p>
   <div className="automation-progress-filters">
    <label>资料类型<select aria-label="自动化资料类型" value={origin} onChange={e=>{setOrigin(e.target.value);setSource('all');}}><option value="all">全部资料</option><option value="official">官方</option><option value="third-party">第三方</option><option value="project">项目整理</option></select></label>
    <label>来源书<select aria-label="自动化来源书" value={source} onChange={e=>setSource(e.target.value)}><option value="all">全部来源书</option>{books.map(s=><option key={s.id} value={s.id}>{s.name}（{s.id}）</option>)}</select></label>
    <label>功能分类<select aria-label="自动化功能分类" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">全部功能</option>{Object.entries(PROGRESS_CATEGORIES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   </div>
   {source!=='all'&&<p role="status">{selectedBook?.name}：{ruleCounts?`取得 ${ruleCounts.total} 条状态，已核对 ${ruleCounts.reviewed} 条，${manifest.audit.snapshot?`整条实现并验证待核实（当前版本逐条证据 ${ruleCounts.implementedVerified} 条）`:`整条实现并验证 ${ruleCounts.implementedVerified} 条`}。`:'书目已识别；本书逐条核对、整条自动化和发布可用数量均待核实。所选分类未取得证据时也不按 0 条计算。'}</p>}
   <p className="automation-progress-results" role="status">显示 {rows.length} 项机制说明{origin==='third-party'?(manifest.audit.snapshot?'；第三方本地逐条状态已接入，当前发布可用待核实。':'；第三方逐书证据待核实。'):'。'}</p>
  </section>
  {Object.entries(PROGRESS_CATEGORIES).map(([id,label])=>{const group=rows.filter(c=>c.category===id);return group.length?<section className="automation-progress-category" key={id}><h3>{label}</h3>{group.map(card)}</section>:null;})}
  {!rows.length&&<p className="automation-progress-warning">所选来源 / 分类没有已证实的机制记录。缺少证据不表示覆盖率为 0，也不会启用或补齐任何能力。</p>}
  <details className="automation-progress-evidence"><summary>证据范围与待补资料</summary><p>{manifest.verification.scope}</p>{manifest.audit.snapshot&&<p>逐条状态权威来源：{manifest.audit.snapshot.repository}，导出版本 <code>{manifest.audit.snapshot.exportRevision.slice(0,12)}</code>；原始规则版本 <code>{manifest.audit.snapshot.sourceRevision.slice(0,12)}</code>。本页只载入来源与分类汇总，逐条身份、部分支持边界和历史验证关联保留在版本锁定的精简产物中。</p>}<p>以下证据未取得，相关状态保持待核实：</p><ul>{manifest.missingEvidence.map(path=><li key={path}>{path}</li>)}</ul></details>
  <section className="automation-progress-changes"><h3>简短更新记录</h3><ul>{manifest.changes.map(change=><li key={`${change.date}:${change.summary}`}><time>{change.date}</time> · {change.summary}</li>)}</ul></section>
 </div>;
}
