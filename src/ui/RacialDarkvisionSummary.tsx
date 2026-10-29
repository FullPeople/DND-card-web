import type {Derived} from '../core/model';

/** A readonly evaluator projection. No raw-tag fallback, saved sense, token
 * permission, lighting rule or character mutation is supplied by this view. */
export function RacialDarkvisionSummary({d}:{d:Derived}){
 const value=d.senses?.darkvision,range=typeof value==='number'&&Number.isFinite(value)&&value>0?value:undefined;
 return <section aria-label="来源黑暗视觉范围" data-racial-darkvision-summary="">
  <h3>来源黑暗视觉范围</h3>
  {range===undefined?<p>当前没有可核对的来源范围；不推定默认距离。</p>:<p>当前来源黑暗视觉：<strong data-testid="racial-darkvision-range">{range}</strong> 英尺。</p>}
  <p>仅显示已核对种族来源的固定距离。光照、颜色、魔法黑暗、条件与视觉使用仍需人工处理；不改变地图、令牌或视觉权限。</p>
  {!!d.trace.darkvision?.length&&<ul aria-label="黑暗视觉来源依据">{d.trace.darkvision.map((line,index)=><li key={index}>{line}</li>)}</ul>}
  {d.issues.filter(issue=>issue.id.startsWith('racial-darkvision:')).map(issue=><p key={issue.id} role="note">{issue.message}</p>)}
 </section>;
}
