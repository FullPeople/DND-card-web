import type {Derived} from '../core/model';

const MODES=[['swim','游泳'],['climb','攀爬']] as const;

/** Readonly source base values, not final movement or a raw speed-tag fallback. */
export function RacialMovementSummary({d}:{d:Derived}){
 const modes=MODES.flatMap(([mode,label])=>{const value=d.sourceMovement?.[mode];return typeof value==='number'&&Number.isFinite(value)&&value>0?[{mode,label,value}]:[];});
 return <section aria-label="来源基础移动速度" data-racial-movement-summary="">
  <h3>来源基础移动速度</h3>
  {modes.length?<ul aria-label="已核对的来源基础速度">{modes.map(({mode,label,value})=><li key={mode}>{label}：<strong data-testid={`racial-movement-${mode}`}>{value}</strong> 英尺。</li>)}</ul>:<p>当前没有可核对的来源基础速度；不推定默认值或等同步行速度。</p>}
  <p>仅显示已核对种族来源的固定基础值，不是最终移动速度，也不代表整条种族规则已自动化。条件、护甲、增益、等级、地形与临时爆发仍需人工核对；不套用通用速度修正，不改写卡面步行速度或手工调整。</p>
  {!!d.trace.sourceMovement?.length&&<ul aria-label="基础移动速度来源依据">{d.trace.sourceMovement.map((line,index)=><li key={index}>{line}</li>)}</ul>}
  {d.issues.filter(issue=>issue.id.startsWith('racial-movement:')).map(issue=><p key={issue.id} role="note">{issue.message}</p>)}
 </section>;
}
