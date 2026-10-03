import {selectionEffectsAllowed,ABILITIES,type Ability,type Character,type Entry,type Selection} from '../model';
import {evaluateFormula,parseFormula} from '../../data/automation/formula';
import type {Condition,Grant,Mechanics,Modifier,AutomationRecord} from '../../data/automation/protocol';
import {automationEnabled} from './state';
const normalize=(value:unknown)=>String(value??'').normalize('NFKC').trim().toLowerCase();
export function reviewedRecord(entry:Entry):AutomationRecord|undefined {
 const record=entry.automation;
 return record&&record.verdict!=='needsAnnotation'&&record.verdict!=='noMechanics'?record:undefined;
}
export const ownedSpellLevel=(entry:Entry):number|undefined=>entry.manualSpellLevel??irMechanics(entry)?.spellModel?.level;
export const irMechanics=(entry:Entry):Mechanics|undefined=>entry.raw._contentOnly?undefined:reviewedRecord(entry)?.mechanics;
export function irSelectionActive(c:Character,row:Selection):boolean {
 const seen=new Set<string>();let current:Selection|undefined=row;
 while(current){if(seen.has(current.id)||!selectionEffectsAllowed(c,current.entry))return false;seen.add(current.id);const identity=current.entry.automation?.identity,parent=irParentClass(c,current);if(identity?.classEngName&&parent&&(normalize(identity.classEngName)!==normalize(parent.entry.automation?.identity.engName||parent.entry.english)||normalize(identity.classSource)!==normalize(parent.entry.source)))return false;const required=identity?.level;if(required!==undefined&&required>(irParentClass(c,current)?.level??current.level))return false;if(!current.parentId)return true;current=c.selections.find(s=>s.id===current!.parentId);}return false;
}
export function irParentClass(c:Character,row:Selection):Selection|undefined {
 if(row.entry.kind==='class')return row;
 const identity=row.entry.automation?.identity;
 const names=[identity?.classEngName,row.entry.raw.classEnglish,row.entry.raw.classENG_name,row.entry.raw.className].map(normalize).filter(Boolean),source=normalize(identity?.classSource||row.entry.raw.classSource||'PHB');
 let current:Selection|undefined=row;const seen=new Set<string>();while(current?.parentId&&!seen.has(current.id)){seen.add(current.id);current=c.selections.find(s=>s.id===current!.parentId);if(current?.entry.kind==='class')return current;}
 const matches=c.selections.filter(s=>s.entry.kind==='class'&&normalize(s.entry.source)===source&&[s.entry.automation?.identity.engName,s.entry.english,s.entry.name].map(normalize).some(name=>names.includes(name)));return matches.length===1?matches[0]:undefined;
}
export function irGrantSelected(c:Character,row:Selection,grant:Grant):boolean {
 if(row.entry.kind==='item'&&(!row.equipped||row.quantity<=0||irMechanics(row.entry)?.equipmentModel?.requiresAttunement&&!row.attuned))return false;
 if(grant.scope==='firstClass'&&row.id!==c.selections.find(s=>s.entry.kind==='class')?.id)return false;
 if(grant.scope==='multiclass'&&row.id===c.selections.find(s=>s.entry.kind==='class')?.id)return false;
 const level=irParentClass(c,row)?.level??row.level;
 if(grant.atLevel!==undefined&&level<grant.atLevel)return false;
 if(grant.setKey!==undefined&&grant.setOption!==undefined){const selected=c.answers[`${row.id}:ir-set:${grant.setKey}`]?.[0];if(selected!==String(grant.setOption))return false;}
 return true;
}
export function irGrantValues(c:Character,row:Selection,grant:Grant):string[] {
 if(!irGrantSelected(c,row,grant))return [];
 if(grant.fixed)return grant.fixed;
 const values=c.answers[`${row.id}:${irAnswerPath(grant)}`]||[];
 return [...new Set(values)].filter(value=>grant.choose?.from?.includes(value)).slice(0,irGrantCount(c,row,grant));
}
/** Explicit old answer codecs are kept; source prose never selects a channel. */
export function irAnswerPath(grant:Grant):string {
 const match=/^(?:startingProficiencies|multiclassing)\.(skills|tools|languages):(\d+)$/.exec(grant.key||'')||/^(skillProficiencies|toolProficiencies|languageProficiencies):(\d+)$/.exec(grant.key||'');
 if(match)return `${({skillProficiencies:'skills',toolProficiencies:'tools',languageProficiencies:'languages'} as Record<string,string>)[match[1]]||match[1]}:${match[2]}`;
 return grant.key||'ir-grant';
}
export const irGrantCount=(c:Character,row:Selection,grant:Grant)=>grant.choiceProgression?.filter(point=>point.level<=(irParentClass(c,row)?.level??row.level)).at(-1)?.count??grant.choose?.count??0;
export function irCondition(c:Character,row:Selection,condition?:Condition):boolean|undefined {
 if(!condition)return true;
 if('all'in condition){const values=condition.all.map(rule=>irCondition(c,row,rule));return values.includes(false)?false:values.includes(undefined)?undefined:true;}
 if('any'in condition){const values=condition.any.map(rule=>irCondition(c,row,rule));return values.includes(true)?true:values.includes(undefined)?undefined:false;}
 if('not'in condition){const value=irCondition(c,row,condition.not);return value===undefined?undefined:!value;}
 const active=c.selections.filter(s=>irSelectionActive(c,s)&&s.quantity>0),armors=active.filter(s=>s.equipped&&['lightArmor','mediumArmor','heavyArmor'].includes(irMechanics(s.entry)?.equipmentModel?.category||'')),shield=active.some(s=>s.equipped&&irMechanics(s.entry)?.equipmentModel?.category==='shield');
 const value:unknown=condition.target==='level'?active.filter(s=>s.entry.kind==='class').reduce((n,s)=>n+s.level,0):condition.target==='class.level'?irParentClass(c,row)?.level:condition.target==='equipped'?row.equipped:condition.target==='attuned'?!!row.attuned:condition.target==='unarmored'?armors.length>1?undefined:armors.length===0:condition.target==='shield'?shield:condition.target==='choice'?Object.entries(c.answers).filter(([key])=>key.startsWith(`${row.id}:`)).flatMap(([,values])=>values):undefined;
 if(value===undefined)return;
 if(condition.op==='includes')return Array.isArray(value)?value.includes(condition.value):undefined;
 if(typeof value!==typeof condition.value)return;
 if(condition.op==='eq')return value===condition.value;
 if(typeof value!=='number'||typeof condition.value!=='number')return;
 return condition.op==='gte'?value>=condition.value:value<=condition.value;
}
export function irFormulaValues(c:Character,row:Selection,scores:Record<Ability,number>=c.abilities):Record<string,number> {
 const active=c.selections.filter(s=>irSelectionActive(c,s)),classes=active.filter(s=>s.entry.kind==='class'),level=classes.reduce((n,s)=>n+s.level,0),parent=irParentClass(c,row),values:Record<string,number>={'@class.level':parent?.level||row.level,'@details.level':level,'@prof':2+Math.floor((Math.max(1,level)-1)/4)+(c.sheetBonuses?.proficiency||0)};
 for(const a of ABILITIES)values[`@abilities.${a}.mod`]=Math.floor((scores[a]-10)/2);
 for(const cls of classes)for(const name of new Set([cls.entry.automation?.identity.engName,cls.entry.english].filter(Boolean).map(normalize)))for(const id of new Set([name.replace(/\s+/g,'-'),name.replace(/[^a-z0-9_-]/g,'_')]))values[`@classes.${id}.levels`]=cls.level;
 const unqualified=new Map<string,number[]>(),qualified=new Map<string,number[]>();
 for(const source of active){const cls=irParentClass(c,source),at=cls?.level||source.level;for(const scale of irMechanics(source.entry)?.scales||[]){const point=scale.values.filter(p=>p.level<=at).at(-1);if(!point||!('value'in point))continue;
  const own=normalize(source.entry.automation?.identity.engName||source.entry.english).replace(/[^a-z0-9_]/g,'_');if(own)values[`@scale.${own}.${scale.key}`]=point.value;
  if(source.entry.kind==='class')values[`@scale.${normalize(source.entry.automation?.identity.engName||source.entry.english).replace(/[^a-z0-9_]/g,'_')}.${scale.key}`]=point.value;
  if(cls){const key=`@scale.${normalize(cls.entry.automation?.identity.engName||cls.entry.english).replace(/[^a-z0-9_]/g,'_')}.${scale.key}`;qualified.set(key,[...(qualified.get(key)||[]),point.value]);}
  unqualified.set(scale.key,[...(unqualified.get(scale.key)||[]),point.value]);
 }}
 for(const [key,list]of unqualified)if(list.length===1)values[`@scale.${key}`]=list[0];
 for(const [key,list]of qualified)if(new Set(list).size===1)values[key]=list[0];else delete values[key];
 if(automationEnabled(c))for(const owner of active)for(const modifier of irMechanics(owner.entry)?.modifiers||[])if(modifier.target==='proficiency'&&irCondition(c,owner,modifier.condition)===true&&!(owner.entry.kind==='item'&&(!owner.equipped||owner.quantity<=0||irMechanics(owner.entry)?.equipmentModel?.requiresAttunement&&!owner.attuned)))try{const amount=modifier.formula?evaluateFormula(modifier.formula,values):modifier.value;if(typeof amount==='number')values['@prof']=Math.max(0,applyIrNumber(values['@prof'],modifier,amount));}catch{}
 return values;
}
export function irAmount(c:Character,row:Selection,value:{value:number}|{formula:string},scores?:Record<Ability,number>):number {
 return 'value'in value?value.value:evaluateFormula(value.formula,irFormulaValues(c,row,scores));
}
export function irModifierValue(c:Character,row:Selection,modifier:Modifier,scores?:Record<Ability,number>):number|boolean|string|undefined {
 if(modifier.stackGroup)return;
 if(row.entry.kind==='item'&&(!row.equipped||row.quantity<=0||irMechanics(row.entry)?.equipmentModel?.requiresAttunement&&!row.attuned))return;
 if(irCondition(c,row,modifier.condition)!==true)return;
 return modifier.formula!==undefined?evaluateFormula(modifier.formula,irFormulaValues(c,row,scores)):modifier.value;
}
export const irModifierOrder=(a:Modifier,b:Modifier)=>(a.priority??(a.op==='set'?10:a.op==='add'?20:30))-(b.priority??(b.op==='set'?10:b.op==='add'?20:30));
export function applyIrNumber(base:number,modifier:Modifier,value:number):number {return modifier.op==='add'?base+value:modifier.op==='set'?value:modifier.op==='min'?Math.min(base,value):Math.max(base,value);}
export function irAbilityProjection(c:Character){
 const scores={...c.abilities},trace=Object.fromEntries(ABILITIES.map(ability=>[ability,[`基础 ${scores[ability]}`]])) as Record<Ability,string[]>;
 if(!automationEnabled(c))return {scores,trace};
 const active=c.selections.filter(row=>row.entry.kind!=='background'&&irSelectionActive(c,row));
 const modifiers=active.flatMap(row=>(irMechanics(row.entry)?.modifiers||[]).filter(modifier=>ABILITIES.includes(modifier.target as Ability)).map(modifier=>({row,modifier}))).sort((a,b)=>irModifierOrder(a.modifier,b.modifier));
 const record=(row:Selection,ability:Ability,before:number)=>{const difference=scores[ability]-before;if(difference)trace[ability].push(`${row.entry.kind==='race'?'种族':'来源'}：${row.entry.name} · ${row.entry.source} ${difference>=0?'+':''}${difference}`);};
 for(const {row,modifier}of modifiers)try{const ability=modifier.target as Ability,before=scores[ability],value=irModifierValue(c,row,modifier,scores);if(typeof value==='number'){scores[ability]=applyIrNumber(before,modifier,value);record(row,ability,before);}}catch{}
 for(const row of active)for(const grant of irMechanics(row.entry)?.grants||[])if(grant.type==='abilityScore')for(const [index,ability]of irGrantValues(c,row,grant).entries())if(ABILITIES.includes(ability as Ability)){const key=ability as Ability,before=scores[key];scores[key]+=grant.choose?.weights?.[index]??grant.amount??0;record(row,key,before);}
 return {scores,trace};
}
export const irAbilityScores=(c:Character):Record<Ability,number>=>irAbilityProjection(c).scores;
export function irRollFormula(c:Character,row:Selection,source:string):string {
 const formula=parseFormula(source),values=irFormulaValues(c,row,irAbilityScores(c));let result=source;
 for(const variable of [...formula.variables].sort((a,b)=>b.length-a.length)){const value=values[variable];if(!Number.isFinite(value))throw Error('规则公式的变量尚未绑定。');result=result.replaceAll(variable,value<0?`(${value})`:String(value));}
 parseFormula(result);return result;
}
