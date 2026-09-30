import {candidateReason} from '../core/engine';
import {KIND_LABELS,type Character,type Entry,type Kind,type Requirement} from '../core/model';
import {trainingCategory} from './trainingData';

export interface DropRules {requirement?:Requirement;kinds?:Kind[];allowExisting?:boolean;accepts?:(entry:Entry)=>boolean;rejectReason?:string;referenceOnly?:boolean}
/** The hover highlight and refusal message use the same acceptance rules. */
export function dropRejection(c:Character,entry:Entry,zone:DropRules):string|undefined{
 if(zone.referenceOnly)return zone.accepts&&!zone.accepts(entry)?zone.rejectReason||'此位置不接受这个引用。':undefined;
 const kinds=zone.requirement?.kind?[zone.requirement.kind]:zone.kinds;
 if(kinds&&!kinds.includes(entry.kind))return `此位置需要${kinds.map(kind=>KIND_LABELS[kind]).join('、')}，「${entry.name}」是${KIND_LABELS[entry.kind]}。`;
 if(entry.raw._category==='size'&&!zone.accepts)return '体型条目请拖到主要页的体型格。';
 if(entry.kind!=='item'&&trainingCategory(entry)&&!zone.accepts)return '熟练类别请拖到主要页的装备训练与其他熟练栏。';
 if(zone.accepts&&!zone.accepts(entry))return zone.rejectReason||'这个条目不符合此位置的限定条件，请选择对应的填写格。';
 const reason=candidateReason(c,entry,zone.requirement);
 return zone.allowExisting&&reason==='这个条目已经在角色卡中'?undefined:reason;
}
