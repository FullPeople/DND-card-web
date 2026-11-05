import {useEffect,useState} from 'react';
import {identity,manifestUrl} from 'virtual:automation-progress';
import {loadProgress,sourceRuleCounts,type ProgressManifest} from '../platform/automationProgress';
import type {AnnouncementMode} from '../platform/announcement';
import './automationProgress.css';

export default function AutomationProgress(_props:{release:unknown;mode:AnnouncementMode}){
 const [manifest,setManifest]=useState<ProgressManifest>();const [error,setError]=useState(false);
 useEffect(()=>{let active=true;void loadProgress(manifestUrl,identity.manifestSha256).then(data=>{if(active)setManifest(data);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[]);
 if(error)return <p role="status">进度暂时无法读取，请稍后重试。</p>;
 if(!manifest)return <p role="status">正在读取自动化进度…</p>;
 const total=manifest.audit.counts?.total,reviewed=manifest.audit.counts?.reviewed;
 const books=[...manifest.sources].sort((a,b)=>{
  const rank=(id:string)=>['XPHB','PHB','XDMG','DMG'].indexOf(id);
  const ar=rank(a.id),br=rank(b.id);return (ar<0?99:ar)-(br<0?99:br)||a.name.localeCompare(b.name,'zh-CN');
 });
 const unknown=books.filter(book=>sourceRuleCounts(manifest,book.id,'all')===null).length;
 const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(manifest.runtimeAudit?.updatedAt||manifest.updatedAt));
 return <div className="automation-progress">
  <p className="automation-progress-intro">覆盖全部官方、第三方书籍及其他扩展。局部机制可用不等于整条规则完成。</p>
  <p className="automation-progress-summary">最近更新时间：<time>{date}</time><br/>
   目录范围：{books.length} 个来源，{unknown} 个来源的规则目录待建立。
  </p>
  <p className="automation-progress-stages" aria-label="规则自动化阶段统计">
   <span>已登记：{total??'待核实'}</span><span>来源已核验：{reviewed??'待核实'}</span>
   <span>完整建模：待核实</span><span>完整执行：待核实</span><span>已验收：待核实</span>
  </p>
  <p className="automation-progress-coverage">至少一项机制已执行：{manifest.runtimeAudit?`${manifest.runtimeAudit.implemented}/${total}`:'待核实'}（含数值计算或可用选择）。<br/>下方比例是局部覆盖率。未登记内容尚未计入分母；来源核验不代表完整验收。</p>
  <ul className="automation-progress-books" aria-label="各扩展机制覆盖">{books.map(book=>{
   const count=sourceRuleCounts(manifest,book.id,'all'),implemented=book.runtimeImplemented;
   const percent=!count?.total||implemented===undefined||implemented===null?null:implemented/count.total*100;
   const label=percent===null?'待核实':`${percent===0?'0':percent===100?'100':percent.toFixed(1)}%`;
   const description=count?`已登记 ${count.total} 项，来源已核验 ${count.reviewed} 项；至少一项机制已执行 ${implemented??'待核实'} 项；完整建模、完整执行与验收待核实。`:'此来源的规则目录尚未建立；数量、适用性与完成状态待核实。';
   return <li key={book.id} data-source={book.id} title={description} aria-label={`${book.name}：${description}`}>
    <span className="automation-progress-book-name">{book.name}</span><span className="automation-progress-track" aria-hidden="true"><span style={{width:`${percent||0}%`}}/></span><span className="automation-progress-percent">{count?label:'目录待建立'}</span>
   </li>;
  })}</ul>
 </div>;
}
