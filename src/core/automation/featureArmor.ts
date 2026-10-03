import type {Entry,Issue,Selection} from '../model';
import {armorType,type ArmorType} from './equipment';
import {irMechanics} from './ir';

export interface FeatureArmorRule {
 selectionId:string;entryId:string;source:string;edition:Entry['edition'];revision:string;
 path:string;bonus:number;armorTypes:ArmorType[];
}
export interface FeatureArmorReport {bonus:number;trace:string[];issues:Issue[];rules:FeatureArmorRule[]}

/** Display projection of reviewed IR. The engine applies these same modifiers
 * once through its regular evaluator; this report never interprets prose. */
export function evaluateFeatureArmor(active:Selection[]):FeatureArmorReport{
 const report:FeatureArmorReport={bonus:0,trace:[],issues:[],rules:[]},seen=new Set<string>();
 const worn=active.filter(row=>row.equipped&&row.quantity>0&&['LA','MA','HA'].includes(armorType(row.entry)||''));
 for(const row of active){
  const entry=row.entry;if(!['feature','feat','race','background'].includes(entry.kind)||seen.has(entry.id))continue;seen.add(entry.id);
  for(const gap of entry.automation?.unsupported||[])if(gap.family==='ac'||gap.family==='armorCondition')report.issues.push({id:`feature-ac-rule:${row.id}`,selectionId:row.id,severity:'warning',message:`${entry.name}：护甲规则的条件尚未完整适配，请核对声明与手动调整。`});
  for(const [index,modifier]of (irMechanics(entry)?.modifiers||[]).entries()){
   const condition=modifier.condition;if(modifier.target!=='ac'||modifier.op!=='add'||typeof modifier.value!=='number'||!condition||!('target'in condition)||condition.target!=='unarmored'||condition.op!=='eq'||condition.value!==false)continue;
   const rule:FeatureArmorRule={selectionId:row.id,entryId:entry.id,source:entry.source,edition:entry.edition,revision:entry.revision,path:`automation.mechanics.modifiers:${index}`,bonus:modifier.value,armorTypes:['LA','MA','HA']};report.rules.push(rule);
   if(worn.length===1){report.bonus+=modifier.value;report.trace.push(`${entry.name} · ${entry.source}：着装护甲 +${modifier.value}`);}
   else report.trace.push(`${entry.name} · ${entry.source}：${worn.length?'护甲穿戴冲突':'未着装护甲'}，条件加值未生效`);
  }
 }
 return report;
}
