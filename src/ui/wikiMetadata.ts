import {ABILITY_LABELS,type Ability,type Entry,type Raw} from '../core/model';
import {proficiencyText,startingProficiencyEntries} from '../core/proficiencyText';

export function translationInfo(raw:Raw){
 const translator=raw.translator;
 const name=typeof translator==='string'?translator:Array.isArray(translator)?translator.join('、'):translator&&typeof translator==='object'?translator.name||translator.translator||JSON.stringify(translator):'';
 const machine=/机翻|机器翻译|machine|自动翻译|\bai\b/i.test(String(name))||raw.isMachineTranslated===true;
 return {name:String(name||''),machine,status:machine?'机器翻译':name?'已标注译者':'未标注译者'};
}
const abilities=(value:unknown):string=>{
 if(Array.isArray(value))return value.map(abilities).join(' 或 ');
 if(!value||typeof value!=='object')return String(value??'');
 const raw=value as Raw;
 return Object.entries(raw).map(([key,item]:[string,any])=>{
  if(key==='choose'){
   if(item.weighted)return `从${item.weighted.from.map((a:Ability)=>ABILITY_LABELS[a]||a).join('、')}中选择不同属性，分别增加 ${item.weighted.weights.join('、')}`;
   return `从${(item.from||[]).map((a:Ability)=>ABILITY_LABELS[a]||a).join('、')}中选择 ${item.count??1} 项，各增加 ${item.amount??1}`;
  }
  if(key==='max')return `上限 ${item}`;
  return `${ABILITY_LABELS[key as Ability]||key} ${typeof item==='number'?(item>=0?'+':'')+item:abilities(item)}`;
 }).join('；');
};
function requirements(raw:Raw):string{
 return Object.entries(raw).map(([key,value])=>key==='or'?`（${(value as Raw[]).map(requirements).join(' 或 ')}）`:key==='and'?`（${(value as Raw[]).map(requirements).join(' 且 ')}）`:typeof value==='number'?`${ABILITY_LABELS[key as Ability]||key}至少 ${value}`:String(value)).join(' 且 ');
}
export function extraFacts(entry:Entry):[string,string][]{
 const raw=entry.raw,result:[string,string][]=[];
 if(entry.kind==='class'){
  if(raw.hd?.faces){const number=raw.hd.number||1,faces=raw.hd.faces;result.push(['1 级生命值',`${number*faces} + 体质调整值`],['升级生命值',`${number}d${faces}（或 ${number*(Math.floor(faces/2)+1)}）+ 体质调整值／职业等级`]);}
  if(raw.multiclassing?.requirements&&Object.keys(raw.multiclassing.requirements).length)result.push(['兼职属性要求',requirements(raw.multiclassing.requirements)]);
  if(raw.multiclassing?.requirementsSpecial)result.push(['兼职特殊要求',String(raw.multiclassing.requirementsSpecial)]);
  if(raw.multiclassing?.proficienciesGained)result.push(['兼职获得熟练',startingProficiencyEntries({...raw,startingProficiencies:raw.multiclassing.proficienciesGained}).join('；')||'来源未列出新增熟练']);
  if(raw.multiclassing&&!Object.keys(raw.multiclassing).length)result.push(['兼职说明','来源未列出独立兼职要求，请按本版本职业正文核对']);
 }
 if(['background','feat'].includes(entry.kind)){
  if(raw.ability)result.push(['属性提升',abilities(raw.ability)]);
  for(const [field,label] of [['skillProficiencies','技能熟练'],['toolProficiencies','工具熟练'],['languageProficiencies','语言'],['armorProficiencies','护甲熟练'],['weaponProficiencies','武器熟练']])if(raw[field])result.push([label,proficiencyText(raw[field],entry.source,field)]);
  if(raw.repeatable!==undefined)result.push(['重复选择',raw.repeatable===true?'可以重复选择；仍需满足正文中的限制':raw.repeatable===false?'不可重复选择':String(raw.repeatable)]);
 }
 if(raw._category==='deity')for(const [field,label] of [['pantheon','神系'],['domains','领域'],['province','职掌'],['symbol','象征'],['alignment','阵营']])if(raw[field]!=null){let value=raw[field];if(field==='alignment')value=(Array.isArray(value)?value:[value]).map((code:string)=>({L:'守序',N:'中立',C:'混乱',G:'善良',E:'邪恶',U:'无阵营',A:'任意'} as Record<string,string>)[code]||code);result.push([label,Array.isArray(value)?value.join('、'):String(value)]);}
 return result;
}
