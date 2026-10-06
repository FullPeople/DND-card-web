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
 const books=manifest.sources.filter(s=>sourceRuleCounts(manifest,s.id,'all')?.total).sort((a,b)=>{
  const rank=(id:string)=>['XPHB','PHB','XDMG','DMG'].indexOf(id);
  const ar=rank(a.id),br=rank(b.id);return (ar<0?99:ar)-(br<0?99:br)||a.name.localeCompare(b.name,'zh-CN');
 });
 const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(manifest.runtimeAudit?.updatedAt||manifest.updatedAt));
 return <div className="automation-progress">
  <p className="automation-progress-intro">大量条目目前放入角色卡不会有任何数据自动计算的功能，只会起一个可观测作用，因此自动化任重而道远。比如装备护甲时真实修改AC，职业具有对应选择能力，专长改变人的属性和生命值等。</p>
  <p className="automation-progress-summary">最近更新时间：<time>{date}</time><br/>
   规则条目（含第三方）已核对：{reviewed===undefined?'待核实':`${reviewed}/${total}`}，<span title="已有实际自动计算或选择功能就计入；其余未实现效果仍需手动处理。">已实装{manifest.runtimeAudit?`${manifest.runtimeAudit.implemented}/${total}`:'待核实'}</span>
  </p>
  <ul className="automation-progress-books" aria-label="各扩展实装进度">{books.map(book=>{
   const count=sourceRuleCounts(manifest,book.id,'all')!,implemented=book.runtimeImplemented;
   const percent=implemented===undefined||implemented===null?null:implemented/count.total*100;
   const label=percent===null?'待核实':`${percent===0?'0':percent===100?'100':percent.toFixed(1)}%`;
   return <li key={book.id} data-source={book.id} title={implemented===undefined||implemented===null?'实装数量待核实':`${implemented}/${count.total}`}>
    <span className="automation-progress-book-name">{book.name}</span><span className="automation-progress-track" aria-hidden="true"><span style={{width:`${percent||0}%`}}/></span><span className="automation-progress-percent">{label}</span>
   </li>;
  })}</ul>
 </div>;
}
