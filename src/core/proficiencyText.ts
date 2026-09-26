import {ABILITY_LABELS,SKILLS,type Raw} from './model';

export const EQUIPMENT_TRAINING = [
  ['simple','简易武器','Simple Weapons','weapons','simple|简易|weaponSimple'],
  ['martial','军用武器','Martial Weapons','weapons','martial|军用|weaponMartial'],
  ['simple-melee','简易近战武器','Simple Melee Weapons','weapons','weaponSimpleMelee'],
  ['simple-ranged','简易远程武器','Simple Ranged Weapons','weapons','weaponSimpleRanged'],
  ['martial-melee','军用近战武器','Martial Melee Weapons','weapons','weaponMartialMelee'],
  ['martial-ranged','军用远程武器','Martial Ranged Weapons','weapons','weaponMartialRanged'],
  ['firearms','火器','Firearms','weapons','firearm'],
  ['light','轻甲','Light Armor','armor','light armor'],
  ['medium','中甲','Medium Armor','armor','medium armor'],
  ['heavy','重甲','Heavy Armor','armor','heavy armor'],
  ['shield','盾牌','Shields','armor','shields|shield'],
  ['artisan','工匠工具','Artisan Tools','tools',"anyArtisansTool|artisan's tools|artisans tools|toolArtisan"],
  ['musical','乐器','Musical Instruments','tools','anyMusicalInstrument|musical instrument|instrumentMusical'],
  ['gaming','博弈用具','Gaming Sets','tools','anyGamingSet|gaming set|gameSet'],
  ['land-vehicles','陆上载具','Vehicles (Land)','tools','vehicles (land)|vehicle (land)'],
  ['water-vehicles','水上载具','Vehicles (Water)','tools','vehicles (water)|vehicle (water)'],
  ['air-vehicles','空中载具','Vehicles (Air)','tools','vehicles (air)|vehicle (air)'],
] as const;
const key=(value:string)=>value.toLowerCase().replace(/[\s_’']/g,'');
const skillNames=Object.fromEntries(Object.entries(SKILLS).map(([id,skill])=>[key(id),skill.name]));
const tools:Record<string,string>={"thieves' tools":'盗贼工具',"tinker's tools":'修补工具',"disguise kit":'易容工具',"forgery kit":'文书伪造工具',"herbalism kit":'草药工具',"navigator's tools":'领航工具',"poisoner's kit":'毒药工具'};
const toolNames=Object.fromEntries(Object.entries(tools).map(([id,name])=>[key(id),name]));
export function equipmentTraining(value:string){return EQUIPMENT_TRAINING.find(([id,name,english,,aliases])=>[id,name,english,...aliases.split('|')].some(alias=>key(alias)===key(value)));}
export function proficiencyLabel(value:string):string{return skillNames[key(value)]||equipmentTraining(value)?.[1]||toolNames[key(value)]||(ABILITY_LABELS as Record<string,string>)[value]||value;}
export function proficiencyText(value:unknown,source='PHB',group=''):string{
  if(typeof value==='string'){
    const category=equipmentTraining(value);
    if(category)return `{@itemProperty ${category[1]}|${source}}`;
    if(toolNames[key(value)])return `{@item ${value}|${source}|${toolNames[key(value)]}}`;
    // Keep reference identity intact while translating its visible label.
    return proficiencyLabel(value).replace(/\{@item ([^{}]+)\}/g,(_,body:string)=>{const [name,book=source,label=name]=body.split('|');return `{@item ${name}|${book}|${proficiencyLabel(label)}}`;});
  }
  if(Array.isArray(value))return value.map(item=>proficiencyText(item,source,group)).filter(Boolean).join('、');
  if(!value||typeof value!=='object')return value==null?'':String(value);
  const object=value as Raw;
  if(object.choose)return `从${proficiencyText(object.choose.from||[],source,group)}中选择 ${object.choose.count||1} 项`;
  if(object.proficiency)return `${proficiencyText(object.proficiency,source,group)}${object.optional?'（可选）':''}`;
  if(object.any)return `任选 ${object.any} 项${group==='skills'?'技能':''}`;
  if(object.fromFilter)return String(object.fromFilter).split('|').map(part=>{const [field,values]=part.split('=');return `${({type:'类别',property:'属性',source:'来源'} as Record<string,string>)[field]||field}：${(values||'').split(';').map(proficiencyLabel).join('或')}`;}).join('，');
  return Object.entries(object).map(([name,item])=>item===true?proficiencyText(name,source,group):typeof item==='number'?`任选 ${item} 项${proficiencyText(name,source,group)}`:`${proficiencyLabel(name)}：${proficiencyText(item,source,group)}`).join('；');
}
export function startingProficiencyEntries(raw:Raw):string[]{
  const p=raw.startingProficiencies;if(!p||typeof p!=='object')return [];
  const source=raw.edition==='one'||raw.source==='XPHB'?'XPHB':'PHB';
  const fields=[['skills','skillProficiencies','技能'],['weapons','weaponProficiencies','武器'],['armor','armorProficiencies','护甲'],['tools','toolProficiencies','工具'],['languages','languageProficiencies','语言']] as const;
  const result=fields.flatMap(([field,alternate,label])=>{const value=p[field]??p[alternate];return value==null?[]:[`${label}：${proficiencyText(value,source,field)}`];});
  const known=new Set<string>(fields.flatMap(([field,alternate])=>[field,alternate]));
  for(const [field,value] of Object.entries(p))if(!known.has(field))result.push(`${proficiencyLabel(field)}：${proficiencyText(value,source,field)}`);
  return result;
}
