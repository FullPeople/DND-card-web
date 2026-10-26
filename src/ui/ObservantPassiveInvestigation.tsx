import type {Derived} from '../core/model';
import {TraceValue} from './ValueTrace';
import './observantPassive.css';
/** One bounded read-only derived value, not a new saved/manual adjustment. */
export function ObservantPassiveInvestigation({d}:{d:Derived}){
 if(d.passiveInvestigation===undefined)return null;
 return <div className="observant-passive-investigation" title={(d.trace.passiveInvestigation||[]).join('；')}><span>被动调查</span><TraceValue target="passiveInvestigation" label="被动调查" value={d.passiveInvestigation}><strong data-stat="passiveInvestigation">{d.passiveInvestigation}</strong></TraceValue></div>;
}
