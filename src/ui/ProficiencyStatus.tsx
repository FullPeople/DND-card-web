import {useId} from 'react';
import './proficiencyStatus.css';

const skillExplanation='手动熟练与专精补充规则授予；取消只移除手动记录，来源授予仍生效。专精包含熟练。';

type Props={name:string;proficient:boolean;expertise?:boolean;editing:boolean;kind?:'skill'|'save';manualProficient?:boolean;onProficiencyChange?:(enabled:boolean)=>void;onExpertiseChange?:(enabled:boolean)=>void};
/** The edit controls own manual intent; the normal marker shows the combined result. */
export function ProficiencyStatus({name,proficient,expertise=false,editing,kind='skill',manualProficient=false,onProficiencyChange,onExpertiseChange}:Props){
 const explanationId=useId();
 const state=expertise?'专精':proficient?'熟练':'无熟练';
 const markerClass=expertise?'expert':proficient?'trained':'';
 if(!editing)return <span className={`proficiency-mark ${markerClass}`} aria-label={`${name}${state}`}/>;
 if(kind==='skill'&&onProficiencyChange&&onExpertiseChange)return <span className="proficiency-state proficiency-manual" title={`${name}当前生效：${state}。${skillExplanation}`}>
  <input type="checkbox" className="proficiency-manual-check" aria-label={`${name}手动熟练`} aria-describedby={explanationId} checked={manualProficient||expertise} onChange={e=>onProficiencyChange(e.target.checked)}/>
  <input type="checkbox" className="expertise-check" aria-label={`${name}专精`} aria-describedby={explanationId} checked={expertise} onChange={e=>onExpertiseChange(e.target.checked)}/>
  <span id={explanationId} className="proficiency-explanation">{`${name}当前生效：${state}。${skillExplanation}`}</span>
 </span>;
 const automaticExplanation=kind==='skill'?'技能熟练与专精由规则和已选能力计算。':'豁免熟练由规则和已选能力自动计算，不能在此手动更改；已有数值调整保持有效。';
 return <span className="proficiency-state" title={`${name}：${state}。${automaticExplanation}`}>
  <input type="checkbox" className={`proficiency-indicator ${markerClass}`} aria-label={`${name}熟练状态：${state}`} aria-describedby={explanationId} checked={proficient||expertise} disabled/>
  <span id={explanationId} className="proficiency-explanation">{automaticExplanation}</span>
 </span>;
}
