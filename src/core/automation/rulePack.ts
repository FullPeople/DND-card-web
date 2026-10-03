import {createIdentity} from '../../data/automation/identity';
import type {AutomationRecord,Grant,Mechanics} from '../../data/automation/protocol';
import {ABILITIES,SKILLS,skillKey,type Entry} from '../model';
/** RulePack 1 has explicit effects/choices. Convert once at its validated boundary. */
export function convertRulePack(entry:Entry):Entry {
 const mechanics:Mechanics={},unsupported:AutomationRecord['unsupported']=[];
 const packId='rulepack_'+Array.from(entry.packId).map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join('');
 const identity=createIdentity({kind:entry.kind,source:'CUSTOM',packId,engName:`RulePack entry ${entry.id}`});
 for(const effect of entry.effects||[]){
  if(effect.op==='proficiency')(mechanics.grants||=[]).push({type:'skillProficiency',fixed:[skillKey(effect.skill)]});
  else (mechanics.modifiers||=[]).push({target:effect.target==='speed'?'speed.walk':effect.target,op:effect.op,value:effect.value});
 }
 const labels:NonNullable<Entry['automationOptions']>={};
 for(const choice of entry.choices||[]){
  const refs=choice.options||choice.refs||[],skills=!choice.kind&&refs.every(value=>!!SKILLS[skillKey(value)]);
  const values=refs.map(value=>skills?skillKey(value):encodeURIComponent(value));
  if(!values.length){unsupported.push({code:'rulepack-choice-empty',family:'choice'});continue;}
  const grant:Grant={type:skills?'skillProficiency':choice.kind==='feat'?'feat':'feature',key:`custom:${choice.id}`,choose:{count:choice.count,from:values},origin:`rulePackChoice:${choice.kind||'option'}`};
  if(choice.abilityBonus!==undefined){unsupported.push({code:'rulepack-choice-ability',family:'ability'});}
  (mechanics.grants||=[]).push(grant);
  labels[grant.key!]={label:choice.label,options:Object.fromEntries(refs.map((value,index)=>[values[index],{label:choice.optionLabels?.[value]||SKILLS[skillKey(value)]?.name||value,reference:value}]))};
 }
 // Publisher-like raw fields remain display-only. No implicit raw-field execution.
 if(Object.keys(entry.raw).some(key=>!key.startsWith('_')&&!['name','ENG_name','page','source','edition'].includes(key)))unsupported.push({code:'rulepack-raw-display-only',family:'rulePack'});
 const present=Object.keys(mechanics).length>0;
 return {...entry,automationOptions:labels,automationVersion:`rulePack:${entry.revision}`,automation:{identity,edition:entry.edition,verdict:unsupported.length?'unsupported':present?'automated':'noMechanics',provenance:[{layer:'rulePack',ref:`${entry.packId}/${entry.id}/${entry.revision}`}],...(present?{mechanics}:{}),unsupported,...(!present&&!unsupported.length?{reasonCode:'narrative' as const}:{})}};
}
