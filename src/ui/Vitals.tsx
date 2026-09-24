import type {ReactNode,CSSProperties} from 'react';
import {LockIcon} from './ResourceEditor';
import './vitals.css';
/** Shared compact health controls for monsters and the resource overview. */
export function Vitals({stats,input,locked,lock,lockLabel,disabled=false}:{stats:Record<string,number>;input:(key:string,label:string)=>ReactNode;locked:boolean;lock?:()=>void;lockLabel:string;disabled?:boolean}){
 const ratio=stats['max health']?Math.max(0,Math.min(1,(stats.health||0)/stats['max health'])):0;
 return <div className="suite-vitals"><div className="vital-ac" title="护甲等级">{input('armor class','护甲')}</div><div className="vital-hp" style={{'--hp-ratio':ratio} as CSSProperties}><span>{input('health','生命')}</span><i>/</i><span>{input('max health','生命上限')}</span></div><div className="vital-temp" title="临时生命">{input('temporary health','临时生命')}</div>{lock&&<button className="vital-lock" aria-label={lockLabel} data-locked={locked} disabled={disabled} onClick={lock}><LockIcon locked={locked}/></button>}</div>;
}
