import type {Derived} from '../core/model';

const MODES=[['swim','游泳'],['climb','攀爬']] as const;

/** Readonly authenticated relations, separate from fixed source base speeds. */
export function RelativeRacialMovementSummary({d}:{d:Derived}){
 const modes=MODES.flatMap(([mode,label])=>{const value=d.relativeMovement?.[mode];return typeof value==='number'&&Number.isFinite(value)&&value>=0&&Object.hasOwn(d.relativeMovement!,mode)?[{mode,label,value}]:[];});
 return <section aria-label="与当前步行相同的来源移动速度" data-relative-racial-movement-summary="">
  <h3>与当前步行相同的来源移动速度</h3>
  {modes.length?<ul aria-label="已核对的步行关联速度">{modes.map(({mode,label,value})=><li key={mode}>{label}：<strong data-testid={`relative-racial-movement-${mode}`}>{value}</strong> 英尺（与当前步行速度相同）。</li>)}</ul>:<p>当前没有可核对的步行关联移动方式；不推定默认速度，也不从未核对的速度标签换算。</p>}
  <p>本栏跟随卡面当前步行结果（含已有人工覆盖与卡面调整），不是固定来源基础值，也不代表整条种族规则已自动化。不改写步行速度或手工记录；飞行、冲刺、护甲、地形、临时情境及其他移动条件仍需人工核对。</p>
  {!!d.trace.relativeMovement?.length&&<ul aria-label="步行关联移动速度来源依据">{d.trace.relativeMovement.map((line,index)=><li key={index}>{line}</li>)}</ul>}
  {d.issues.filter(issue=>issue.id.startsWith('relative-racial-movement:')).map(issue=><p key={issue.id} role="note">{issue.message}</p>)}
 </section>;
}
