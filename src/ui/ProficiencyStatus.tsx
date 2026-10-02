import {useId} from 'react';
import './proficiencyStatus.css';

const skillExplanation='技能熟练与专精由规则和已选能力自动计算，不能在此手动更改；额外调整值仍可编辑。';

/** A single display-only marker; the sheet must never override rule grants here. */
export function ProficiencyStatus({name,proficient,expertise=false,editing,kind='skill'}:{name:string;proficient:boolean;expertise?:boolean;editing:boolean;kind?:'skill'|'save'}){
 const automaticExplanation=kind==='skill'?skillExplanation:'豁免熟练由规则和已选能力自动计算，不能在此手动更改；已有数值调整保持有效。';
 const explanationId=useId();
 const state=expertise?'专精':proficient?'熟练':'无熟练';
 const markerClass=expertise?'expert':proficient?'trained':'';
 if(!editing)return <span className={`proficiency-mark ${markerClass}`} aria-label={`${name}${state}`}/>;
 return <span className="proficiency-state" title={`${name}：${state}。${automaticExplanation}`}>
  <input type="checkbox" className={`proficiency-indicator ${markerClass}`} aria-label={`${name}熟练状态：${state}`} aria-describedby={explanationId} checked={proficient||expertise} disabled/>
  <span id={explanationId} className="proficiency-explanation">{automaticExplanation}</span>
 </span>;
}
