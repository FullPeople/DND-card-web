import type {Character,Derived,Entry} from '../core/model';
import {resourceBalanceEdit} from '../core/runtimeCharacterEdit';
import {inWorkbench,useWorkbench} from '../platform/workbench';
import {localGm} from '../cloud/localRights';
import {QuickbarAttacks,visibleQuickbarResources} from './Quickbar';
import {ResourceRow} from './ResourceRow';

export function MobilePlayResources({c,d,edit,disabled,inspect,manage,manageQuickbar,configure}:{c:Character;d:Derived;edit:(f:(c:Character)=>void)=>void;disabled:boolean;inspect:(entry:Entry)=>void;manage:()=>void;manageQuickbar:()=>void;configure:(id:string)=>void}){
 const wb=useWorkbench(),resources=visibleQuickbarResources(c),enabled=!disabled&&(!inWorkbench||wb.online&&!!wb.target?.write);
 return <div className="mobile-play-resources"><QuickbarAttacks c={c} d={d} inspect={inspect} manageQuickbar={manageQuickbar}/><section className="mobile-resource-list"><header><h3>资源</h3><button onClick={manage} disabled={disabled}>配置</button></header>{resources.length?resources.map(([id,value])=><ResourceRow key={id} resource={{...value,id}} enabled={enabled} gm={inWorkbench?wb.role==='GM':localGm()} configure={()=>configure(id)} change={async next=>edit(resourceBalanceEdit(id,next))}/>):<p>还没有可用资源。</p>}</section></div>;
}
