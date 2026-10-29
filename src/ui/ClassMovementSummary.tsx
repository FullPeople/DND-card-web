import type {Derived} from '../core/model';

const MODES=[['swim','游泳'],['climb','攀爬']] as const;

/** Readonly current class projection, never a second walking calculation. */
export function ClassMovementSummary({d}:{d:Derived}){
 const modes=MODES.flatMap(([mode,label])=>{const value=d.classMovement?.[mode];return typeof value==='number'&&Number.isFinite(value)&&value>=0&&Object.hasOwn(d.classMovement!,mode)?[{mode,label,value}]:[];}),trace=d.trace.classMovement||[],issues=d.issues.filter(issue=>issue.id.startsWith('class-movement:'));
 if(!modes.length&&!trace.length&&!issues.length)return null;
 return <section aria-label="职业来源移动速度" data-class-movement-summary="">
  <h3>职业来源移动速度</h3>
  {Number.isFinite(d.speed)&&d.speed>=0?<p>当前卡面步行结果：<strong data-testid="class-movement-walking">{d.speed}</strong> 英尺。</p>:<p>当前卡面步行结果需人工核对；不在此修正。</p>}
  {!!modes.length&&<ul aria-label="已核对的职业移动方式">{modes.map(({mode,label,value})=><li key={mode}>{label}：<strong data-testid={`class-movement-${mode}`}>{value}</strong> 英尺（等于当前步行结果）。</li>)}</ul>}
  <p>步行使用卡面已有结果；本栏不再次加值，也不改写人工覆盖或卡面调整。其他移动条件、冲刺、墙面／水面行走与地形仍需人工处理，不代表整条职业规则已自动化。</p>
  {!!trace.length&&<ul aria-label="职业移动速度来源依据">{trace.map((line,index)=><li key={index}>{line}</li>)}</ul>}
  {issues.map(issue=><p key={issue.id} role="note">{issue.message}</p>)}
 </section>;
}
