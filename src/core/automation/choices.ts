import {SKILLS,skillKey,selectionAllowed,selectionEffectsAllowed,uid,type Character,type Entry,type Selection} from '../model';
import {inventoryState} from '../characterDetails';
import {resolveEntryReference} from '../entryReferences';
import {selectionLevel} from '../featureOwnership';
import {automationEnabled} from './state';
import {backgroundAbilityOptions,backgroundAbilityValue} from './backgroundAbilities';
import {equipmentBlocks,sourceEquipmentChoices,sourceEquipmentParts,sourceEquipmentAlreadyReceived,recordSourceEquipmentClaim,sourceEquipmentShapeSupported,validateEquipmentItem} from './sourceEquipment';
export {equipmentBlocks} from './sourceEquipment';
import {classSpellChoices,chooseClassSpell,setClassSpellSlot,type ClassSpellChoiceKind} from './classSpellChoices';

export type ChoiceOption={value:string;label:string;entry:Entry;grant?:Entry;abilities?:Partial<Record<import('../model').Ability,number>>;unavailable?:string};
export type SheetChoice={id:string;ownerId:string;label:string;count:number;options:ChoiceOption[];selected:string[];slots?:string[];complete:boolean;restricted:boolean;channel:'skills'|'tools'|'languages'|'content'|'equipment'|'abilities'|'spells';equipmentIndex?:number;spellKind?:ClassSpellChoiceKind;hint?:string};
export const equipmentTypeLabel=(type:string)=>({weaponMartial:'军用武器',weaponSimple:'简易武器',focusSpellcastingHoly:'圣徽',focusSpellcastingArcane:'奥术法器',focusSpellcastingDruidic:'德鲁伊法器'} as Record<string,string>)[type]||'尚未适配的装备类别';
const blocks=(v:unknown):any[]=>Array.isArray(v)?v:[];
export function equipmentOptionConcept(entry:Entry,index:number,value:string):Entry{return concept(entry,`equipment:${index}:${value}`,`起始装备 · 方案 ${value}`,blocks(equipmentBlocks(entry)[index]?.[value]).map(item=>typeof item==='string'?`{@item ${item}}`:item?.item?`${item.quantity||1} × {@item ${item.item}}`:item?.special||(item?.equipmentType?equipmentTypeLabel(item.equipmentType):undefined)||(item?.value!==undefined||item?.containsValue!==undefined?`${(item.value??item.containsValue)/100} GP`:'尚未支持的装备条目')));}
export function equipmentPackage(entry:Entry,index:number,value:string,picks:Record<string,string>,strict=false):any[]{
 const data=equipmentBlocks(entry);if(!sourceEquipmentShapeSupported(entry))throw Error('此起始装备结构尚未支持，请查阅来源资料。');if(index>=0){const block=data[index];if(!block||!Object.hasOwn(block,value))throw Error('起始装备方案不存在。');return [...blocks(block._),...blocks(block[value])];}
 return data.flatMap((block,i)=>{const keys=Object.keys(block).filter(k=>k!=='_'),chosen=keys.length===1?keys[0]:picks[`group:${i}`];if(keys.length&&!keys.includes(chosen)){if(strict)throw Error(`请先完成第 ${i+1} 组装备选择。`);return blocks(block._);}return [...blocks(block._),...blocks(block[chosen])];});
}
export function selectionActive(c:Character,row:Selection):boolean{
 const seen=new Set<string>();let current:Selection|undefined=row;
 while(current){if(seen.has(current.id)||!selectionEffectsAllowed(c,current.entry))return false;seen.add(current.id);if(!current.parentId)return true;current=c.selections.find(s=>s.id===current!.parentId);}
 return false;
}
function concept(owner:Entry,value:string,label:string,entries:unknown[]):Entry{return {...owner,id:`${owner.id}#choice:${value}`,kind:'rule',name:label,english:label,entries,raw:{_choiceConcept:true},effects:undefined,choices:undefined};}
function resolve(c:Character,owner:Entry,ref:string,kind:string,catalog:Entry[]){
 const source=ref.includes('|')?ref:`${ref}|${owner.source}`;
 return resolveEntryReference(source,catalog,kind as any)||resolveEntryReference(ref,catalog,kind as any);
}
export function sheetChoices(c:Character,catalog:Entry[]=[]):SheetChoice[]{
 if(!automationEnabled(c))return [];
 const out:SheetChoice[]=[],known=[...c.selections.map(s=>s.entry),...catalog];
 for(const row of c.selections){
  const raw=row.entry.raw,restricted=!selectionActive(c,row);
  const push=(path:string,label:string,count:number,options:ChoiceOption[],channel:SheetChoice['channel'],equipmentIndex?:number)=>{
   if(!Number.isSafeInteger(count)||count<1||count>100)return;
   const id=`${row.id}:${path}`,saved=channel==='equipment'?[sourceEquipmentChoices(c,row)[String(equipmentIndex)]].filter(Boolean) as string[]:channel==='abilities'?[backgroundAbilityValue(c.backgroundChoices?.[row.id]?.abilities)].filter(Boolean):c.answers[id]||[];
   const selected=[...new Set(saved)].filter(v=>options.some(o=>o.value===v)).slice(0,count);
   const slots=Array.from({length:count},(_,i)=>options.some(o=>o.value===saved[i])?saved[i]:'');
   out.push({id,ownerId:row.id,label,count,options,selected,slots,complete:selected.length===count,restricted,channel,equipmentIndex});
  };
  if(row.entry.kind==='background'&&Array.isArray(raw.ability)&&raw.ability.length){
   const options=backgroundAbilityOptions(row.entry).map(option=>({...option,entry:concept(row.entry,`abilities:${option.value}`,option.label,['背景属性分配记录；不会重复改写卡面的基础属性。'])}));
   push('abilities','背景属性',1,options,'abilities');
   const choice=out.at(-1);if(choice?.channel==='abilities')choice.hint=options.length?'保存背景声明的分配方案，不会再次叠加到已填写的基础属性。':'此背景属性结构尚未支持，原有记录保留；请查阅来源资料。';
  }
  const first=c.selections.find(s=>s.entry.kind==='class');
  const start=row.entry.kind==='class'?(first?.id===row.id?raw.startingProficiencies:raw.multiclassing?.proficienciesGained):undefined;
  for(const [field,channel,label] of [['skills','skills','熟练项'],['tools','tools','工具熟练'],['languages','languages','语言']] as const){
   const data=start?.[field]??raw[({skills:'skillProficiencies',tools:'toolProficiencies',languages:'languageProficiencies'})[field]];
   blocks(data).forEach((block,index)=>{
    const choose=block?.choose,count=choose?.count??block?.any;if(!count)return;
    const values=choose?.from??(field==='skills'?Object.keys(SKILLS):known.filter(e=>field==='languages'?e.raw._category==='language':e.raw.tool).map(e=>e.id));
    const options=(values||[]).map((v:string)=>{
     const value=field==='skills'?skillKey(v):v,label=SKILLS[value]?.name||known.find(e=>e.id===v)?.name||v;
     const found=field==='skills'?known.find(e=>e.kind==='rule'&&e.raw._category==='skill'&&e.source===(c.edition==='2024'?'XPHB':'PHB')&&[e.name,e.english,e.raw.ENG_name].some(n=>typeof n==='string'&&skillKey(n)===value)):known.find(e=>e.id===v)||known.find(e=>e.source===row.entry.source&&[e.name,e.english].some(n=>n.toLowerCase()===label.toLowerCase()));
     return {value,label,entry:found||concept(row.entry,value,label,[`${label}熟练：相关检定加入熟练加值；专精及其他修正另行计算。`])};
    });
    push(`${channel}:${index}`,`${row.entry.kind==='class'?'起始':''}${label}`,count,options,channel);
   });
  }
  if(row.entry.kind==='class'&&row.id===first?.id||['background','race'].includes(row.entry.kind)){const data=equipmentBlocks(row.entry);
   if(data.length&&!sourceEquipmentShapeSupported(row.entry)){push('equipment:unsupported','起始装备',1,[],'equipment',-1);out.at(-1)!.hint='此起始装备结构尚未支持，原有记录保留；请查阅来源资料。';}
   else if(data.length===1){const keys=Object.keys(data[0]).filter(k=>k!=='_');push('equipment:0','起始装备',1,keys.length?keys.map(value=>({value,label:`方案 ${value}`,entry:equipmentOptionConcept(row.entry,0,value)})):[{value:'default',label:'固定起始装备',entry:concept(row.entry,'equipment:default','固定起始装备',row.entry.raw.startingEquipment?.entries||[])}],'equipment',keys.length?0:-1);}
   else if(data.length>1)push('equipment:bundle','起始装备',1,[{value:'default',label:'选择起始装备',entry:concept(row.entry,'equipment:bundle','起始装备',row.entry.raw.startingEquipment?.default||row.entry.raw.startingEquipment?.entries||[])}],'equipment',-1);
  }
  const contentOption=(node:any,index:number,path:string):ChoiceOption=>{
   const ref=node?.classFeature||node?.subclassFeature||node?.optionalfeature;
   const found=typeof ref==='string'?resolve(c,row.entry,ref,'feature',known):undefined;
   const entry=found||(typeof node==='object'&&node?.name?{...row.entry,id:`${row.entry.id}#${path}:${index}`,kind:'feature' as const,name:node.name,english:node.ENG_name||node.name,entries:node.entries||[node.entry].filter(Boolean),raw:{...node,_category:'inlineChoice'},effects:node.effects,choices:undefined}:undefined);
   const label=entry?.name||String(ref||node?.name||node);
   return {value:entry?.id||`${path}:${index}`,label,entry:entry||concept(row.entry,`${path}:${index}`,label,[`引用尚未加载：${ref||label}`]),grant:entry,unavailable:entry?(selectionAllowed(c,entry)?undefined:'此选项来源尚未启用。'):'引用资料尚未加载，不能确认此项。'};
  };
  const walk=(nodes:unknown,path:string,depth=0)=>{
   if(depth>12)return;blocks(nodes).forEach((node,index)=>{
    const here=`${path}:${index}`;
    if(node?.type==='options'){push(`text-option:${here}`,row.entry.name,Number(node.count)||1,blocks(node.entries).map((v,i)=>contentOption(v,i,here)),'content');return;}
    if(node?.entries)walk(node.entries,here,depth+1);if(node?.items)walk(node.items,`${here}:items`,depth+1);
   });
  };
  walk(row.entry.entries,'entries');
  // A declared filter is an explicit candidate set, even when its wrapper is prose.
  for(const [index,text] of row.entry.entries.entries())if(typeof text==='string'&&/(?:获得|选择).*(?:一项|一个|1)/.test(text)){
   const match=text.match(/\{@filter ([^|}]+)\|feats\|category=([^|}]+)/);if(!match)continue;
   const options=known.filter(e=>e.kind==='feat'&&e.raw.category===match[2]&&(e.edition==='both'||e.edition===c.edition)).map(e=>({value:e.id,label:e.name,entry:e,grant:e}));
   push(`filter:${index}`,row.entry.name,1,options,'content');
  }
  for(const choice of row.entry.choices||[]){
   const options=(choice.options||choice.refs||[]).map(value=>{const entry=known.find(e=>e.id===value)||resolve(c,row.entry,value,choice.kind||'feature',known),label=choice.optionLabels?.[value]||entry?.name||SKILLS[skillKey(value)]?.name||value;return {value,label,entry:entry||concept(row.entry,value,label,[choice.label]),grant:choice.kind?entry:undefined};});
   push(`custom:${choice.id}`,choice.label,choice.count,options,!choice.kind&&options.length>0&&options.every(o=>!!SKILLS[skillKey(o.value)])?'skills':'content');
  }
 }
 return [...out,...classSpellChoices(c,catalog)];
}
export function chooseSheetOption(c:Character,id:string,value:string,catalog:Entry[]=[]){
 const before=sheetChoices(c,catalog),choice=before.find(r=>r.id===id),option=choice?.options.find(o=>o.value===value);
 if(!choice||choice.restricted||!option||option.unavailable)throw Error(option?.unavailable||'此选择当前不可用。');
 if(choice.channel==='spells'){chooseClassSpell(c,choice,option.entry);finishBuiltinChoices(c,before,catalog);return;}
 const selected=choice.selected.includes(value)?choice.selected.filter(v=>v!==value):choice.count===1?[value]:[...choice.selected,value];
 if(selected.length>choice.count)throw Error(`最多选择 ${choice.count} 项，请先取消一项。`);
 if(choice.channel==='abilities'){const target=(c.backgroundChoices||={})[choice.ownerId]||={};target.abilities=selected.length?{...option.abilities}:{};}
 else if(choice.channel==='equipment'){const target=(c.backgroundChoices||={})[choice.ownerId]||={};(target.equipment||={})[String(choice.equipmentIndex)]=selected[0]||'';}
 else c.answers[id]=selected;
 finishBuiltinChoices(c,before,catalog);
}

export function choiceSource(c:Character,choice:SheetChoice):string{
 let row=c.selections.find(s=>s.id===choice.ownerId);const seen=new Set<string>();
 while(row?.parentId&&!seen.has(row.id)){seen.add(row.id);const parent=c.selections.find(s=>s.id===row!.parentId);if(!parent)break;row=parent;}
 return row?.id||choice.ownerId;
}
export function builtinChoices(c:Character,ownerId:string,choices=sheetChoices(c)):SheetChoice[]{
 const firstLevel=c.selections.filter(s=>s.entry.kind==='class').reduce((n,s)=>n+s.level,0)===1;
 return choices.filter(r=>r.ownerId===ownerId&&(r.channel!=='equipment'||c.selections.find(row=>row.id===r.ownerId)?.entry.kind!=='class'||r.complete||firstLevel||c.featureLayout?.optionsVisible?.[ownerId]===true));
}
export function builtinOptionsVisible(c:Character,ownerId:string,choices=sheetChoices(c)):boolean{
 const source=choiceSource(c,{ownerId} as SheetChoice);
 return c.featureLayout?.optionsVisible?.[source]??choices.some(r=>choiceSource(c,r)===source&&!r.complete&&(r.channel!=='equipment'||c.selections.find(row=>row.id===r.ownerId)?.entry.kind!=='class'||c.selections.filter(s=>s.entry.kind==='class').reduce((n,s)=>n+s.level,0)===1));
}
export function setBuiltinOptionsVisible(c:Character,ownerId:string,visible:boolean){
 const layout=c.featureLayout||={order:[],expanded:[]};(layout.optionsVisible||={})[choiceSource(c,{ownerId} as SheetChoice)]=visible;
}
function finishBuiltinChoices(c:Character,before:SheetChoice[],catalog:Entry[]){
 const after=sheetChoices(c,catalog),sources=new Set(before.filter(r=>!r.complete).map(r=>choiceSource(c,r)));
 for(const source of sources)if(after.some(r=>choiceSource(c,r)===source)&&after.filter(r=>choiceSource(c,r)===source).every(r=>r.complete)&&c.featureLayout?.optionsVisible)delete c.featureLayout.optionsVisible[source];
}
/** Slot edits validate and replace atomically, including already full choices. */
export function setSheetChoiceSlot(c:Character,id:string,index:number,value:string|undefined,catalog:Entry[]=[]){
 const before=sheetChoices(c,catalog),choice=before.find(r=>r.id===id);
 if(!choice||choice.restricted||['equipment','abilities'].includes(choice.channel)||!Number.isInteger(index)||index<0||index>=Math.max(choice.count,choice.slots?.length||0))throw Error('此选择位置当前不可用。');
 const option=value===undefined?undefined:choice.options.find(o=>o.value===value);
 if(value!==undefined&&(!option||option.unavailable))throw Error(option?.unavailable||'此条目不属于可选内容。');
 if(((choice.slots||choice.selected)[index]||undefined)===value)return;
 // Ordinary option edits only touch answers and option visibility. Keep atomic
 // validation without copying every source snapshot and inventory item again.
 // Spell allocation can modify selections, so it retains the full transaction.
 const draft=choice.channel==='spells'?structuredClone(c):{...c,answers:{...c.answers},featureLayout:c.featureLayout?{...c.featureLayout,optionsVisible:c.featureLayout.optionsVisible?{...c.featureLayout.optionsVisible}:undefined}:undefined};
 if(choice.channel==='spells')setClassSpellSlot(draft,choice,index,option?.entry);
 else {const slots=[...(choice.slots||choice.selected)];while(slots.length<choice.count)slots.push('');const old=slots[index],from=value?slots.indexOf(value):-1;if(from>=0&&from!==index)slots[from]=old||'';slots[index]=value||'';draft.answers[id]=slots;}
 finishBuiltinChoices(draft,before,catalog);Object.assign(c,draft);
}
/** Reconcile content only at the existing explicit edit/hydration boundary. */
export function syncChoiceContent(c:Character,catalog:Entry[]){
 if(!automationEnabled(c))return false;
 let changed=false;const desired=new Map<string,{owner:string;entry:Entry;requirementId:string}>();
 // Resolve newly granted nested options in bounded passes without inventing answers.
 for(let pass=0;pass<12;pass++){
  let added=false;
  for(const choice of sheetChoices(c,catalog))if(choice.channel==='content')for(const value of choice.selected){const option=choice.options.find(o=>o.value===value);if(option?.grant){const key=`choice:${choice.id}:${value}`;desired.set(key,{owner:choice.ownerId,entry:option.grant,requirementId:choice.id});if(!c.selections.some(s=>s.grantKey===key)){const hash=(text:string)=>{let a=2166136261,b=5381;for(const ch of text){a=Math.imul(a^ch.charCodeAt(0),16777619);b=Math.imul(b,33)^ch.charCodeAt(0);}return `${a>>>0}-${b>>>0}`;};const id=`chosen:${hash(key)}`;if(c.selections.some(s=>s.id===id))throw Error('选择条目身份冲突，请保留角色备份。');c.selections.push({id,entry:structuredClone(option.grant),level:1,quantity:1,equipped:false,parentId:choice.ownerId,grantKey:key,requirementId:choice.id});changed=added=true;}}}
  if(!added)break;
 }
 const removed=new Set(c.selections.filter(s=>s.grantKey?.startsWith('choice:')&&!desired.has(s.grantKey)).map(s=>s.id));
 for(let pass=0;pass<12;pass++)for(const row of c.selections)if(row.parentId&&removed.has(row.parentId))removed.add(row.id);
 if(removed.size){c.selections=c.selections.filter(s=>!removed.has(s.id));changed=true;}
 return changed;
}

export function equipmentCandidates(type:string,owner:Entry,catalog:Entry[]){
 return catalog.filter(e=>e.kind==='item'&&(e.edition==='both'||e.edition===owner.edition)&&(
  type==='weaponMartial'?e.raw.weaponCategory==='martial':type==='weaponSimple'?e.raw.weaponCategory==='simple':
  type==='focusSpellcastingHoly'?e.raw.scfType==='holy':type==='focusSpellcastingArcane'?e.raw.scfType==='arcane':
  type==='focusSpellcastingDruidic'?e.raw.scfType==='druid':false));
}
/** An explicit one-time claim. Claimed items have no modifier/source lifetime. */
export function claimStartingEquipment(c:Character,id:string,value:string,catalog:Entry[],picks:Record<string,string>={}){
 const before=sheetChoices(c,catalog),choice=before.find(r=>r.id===id),owner=c.selections.find(s=>s.id===choice?.ownerId);
 if(!choice||choice.restricted||choice.channel!=='equipment'||!owner)throw Error('起始装备方案不可用。');
 if(!sourceEquipmentShapeSupported(owner.entry))throw Error('此起始装备结构尚未支持，请查阅来源资料。');
 if(!choice.options.some(o=>o.value===value))throw Error('起始装备方案不可用。');
 const sourceOwned=['background','race'].includes(owner.entry.kind),parts=sourceOwned?sourceEquipmentParts(owner.entry,choice.equipmentIndex!,value,picks):[],received=sourceEquipmentAlreadyReceived(c,owner),skipped=new Set<number>();let offset=0;for(const part of parts){for(let n=0;n<part.items.length;n++)if(received.has(part.key))skipped.add(offset+n);offset+=part.items.length;}
 const items=equipmentPackage(owner.entry,choice.equipmentIndex!,value,picks,true),grants:{entry:Entry;quantity:number}[]=[],claimedIds:string[]=[];let money=0;
 for(const [index,item] of items.entries()){
  if(skipped.has(index))continue;
  validateEquipmentItem(item);
  if(sourceOwned&&(item==null||typeof item==='string'?!String(item??'').trim():typeof item!=='object'||!item.item&&!item.special&&!item.equipmentType&&item.value===undefined&&item.containsValue===undefined))throw Error('此起始装备条目尚未支持，请查阅来源资料。');
  const quantity=Number(item.quantity??1);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>3000)throw Error('装备数量无效。');
  if(item.equipmentType){for(let n=0;n<quantity;n++){const entry=equipmentCandidates(item.equipmentType,owner.entry,catalog).find(e=>e.id===picks[`${index}:${n}`]);if(!entry)throw Error(`请先选择 ${equipmentTypeLabel(item.equipmentType)} 的具体装备。`);grants.push({entry,quantity:1});}continue;}
  const ref=typeof item==='string'?item:item.item;
  if(ref||item.special){const found=ref?resolveEntryReference(ref,[...c.selections.map(s=>s.entry),...catalog],'item'):undefined;const entry=found||{...owner.entry,id:`${owner.entry.id}#claimed:${ref||item.special}`,kind:'item' as const,name:item.special||String(ref).split('|')[0],english:item.special||String(ref).split('|')[0],entries:[`起始装备记录：${ref||item.special}`],raw:{_equipmentRef:ref},effects:undefined,choices:undefined};grants.push({entry,quantity});}
  if(item.value!==undefined||item.containsValue!==undefined){const coins=Number(item.value??item.containsValue??0)/100;if(!Number.isFinite(coins)||coins<0||coins>1000000)throw Error('起始金币数值无效。');money+=coins;}
  else if(!ref&&!item.special)throw Error('起始装备结构尚未支持，请查阅来源资料。');
 }
 if(c.selections.length+grants.length>3000)throw Error('角色条目数量达到上限。');
 if(inventoryState(c).coins.gp+money>1000000)throw Error('起始金币数值超过上限。');
 // All package and nested option validation precedes the one-time mutation.
 for(const grant of grants){const id=uid();c.selections.push({id,entry:structuredClone(grant.entry),quantity:grant.quantity,level:1,equipped:false});claimedIds.push(id);}
 const inv=c.inventory||=structuredClone(inventoryState(c));inv.coins.gp+=money;
 const target=(c.backgroundChoices||={})[owner.id]||={};(target.equipment||={})[String(choice.equipmentIndex)]=value;Object.assign(target.equipment,picks);
 if(sourceOwned)recordSourceEquipmentClaim(c,owner,parts,{[String(choice.equipmentIndex)]:value,...picks},claimedIds);
 finishBuiltinChoices(c,before,catalog);
}
