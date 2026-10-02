import {selectionAllowed,uid,type Character,type Entry,type Selection,type SourceEquipmentReceipt} from '../model';
import {inventoryState} from '../characterDetails';
import {resolveEntryReference} from '../entryReferences';

export const equipmentBlocks=(entry:Entry):any[]=>{const value=Array.isArray(entry.raw.startingEquipment)?entry.raw.startingEquipment:entry.raw.startingEquipment?.defaultData;return Array.isArray(value)?value:[];};
export const sourceEquipmentKey=(entry:Entry)=>JSON.stringify([entry.kind,entry.packId,entry.id,entry.source,entry.edition]);
export const sourceEquipmentShapeSupported=(entry:Entry)=>equipmentBlocks(entry).every(block=>block&&typeof block==='object'&&!Array.isArray(block)&&Object.values(block).every(Array.isArray));
const supportedOwner=(row:Selection)=>['background','race'].includes(row.entry.kind);
const keys=(block:any)=>Object.keys(block||{}).filter(key=>key!=='_');
const list=(value:any):any[]=>Array.isArray(value)?value:[];
export type EquipmentPart={key:string;items:any[]};
export function sourceEquipmentParts(entry:Entry,index:number,value:string,picks:Record<string,string>):EquipmentPart[]{
 const data=equipmentBlocks(entry),parts:EquipmentPart[]=[];
 data.forEach((block,i)=>{if(index>=0&&index!==i)return;const options=keys(block),chosen=index>=0?value:options.length===1?options[0]:picks[`group:${i}`];if(list(block._).length)parts.push({key:`${i}:_`,items:block._});if(chosen&&options.includes(chosen))parts.push({key:`${i}:${chosen}`,items:list(block[chosen])});});
 return parts;
}

/** Read old grant evidence conservatively; never infer a missing possession from
 * its current absence because it may already have been spent or transferred. */
export function sourceEquipmentReceipt(c:Character,owner:Selection):SourceEquipmentReceipt|undefined{
 if(!supportedOwner(owner)||!sourceEquipmentShapeSupported(owner.entry))return;
 const stored=c.inventory?.sourceEquipment?.[sourceEquipmentKey(owner.entry)];if(stored)return stored;
 const data=equipmentBlocks(owner.entry);if(!data.length)return;
 const choices={...c.backgroundChoices?.[owner.id]?.equipment},items=c.selections.filter(row=>row.parentId===owner.id&&row.entry.kind==='item'&&row.grantKey?.startsWith('equipment:'));
 const dismissed=(c.dismissedFeatures||[]).some(key=>key.startsWith(`${owner.id}|equipment:`)),coins=Object.keys(c.inventory?.grantedCoins||{}).some(key=>key.startsWith(`${owner.id}|equipment:`));
 if(!items.length&&!dismissed&&!coins&&!Object.values(choices).some(Boolean))return;
 const received:string[]=[];
 data.forEach((block,index)=>{if(list(block._).length)received.push(`${index}:_`);const options=keys(block),chosen=choices[String(index)]||choices[`group:${index}`]||(options.length===1?options[0]:undefined);if(chosen&&options.includes(chosen)){received.push(`${index}:${chosen}`);choices[String(index)]=chosen;choices[`group:${index}`]=chosen;}});
 const completed=data.every((block,index)=>keys(block).length<=1||keys(block).includes(choices[String(index)]));
 if(completed&&data.length>1)choices['-1']='default';if(completed&&data.length===1&&!keys(data[0]).length)choices['-1']='default';
 return {received,choices,itemIds:items.map(row=>row.id),ownerIds:[owner.id],completed};
}
export const sourceEquipmentChoices=(c:Character,owner:Selection)=>({...sourceEquipmentReceipt(c,owner)?.choices,...c.backgroundChoices?.[owner.id]?.equipment});
function saveReceipt(c:Character,owner:Selection,receipt:SourceEquipmentReceipt){const inv=c.inventory||=structuredClone(inventoryState(c));(inv.sourceEquipment||={})[sourceEquipmentKey(owner.entry)]=receipt;}
export function rememberSourceEquipment(c:Character,owners=c.selections):boolean{
 let changed=false;
 for(const owner of owners){const receipt=sourceEquipmentReceipt(c,owner);if(!receipt)continue;const stored=c.inventory?.sourceEquipment?.[sourceEquipmentKey(owner.entry)];if(!stored){saveReceipt(c,owner,receipt);changed=true;}else if(!stored.ownerIds.includes(owner.id)){stored.ownerIds.push(owner.id);changed=true;}}
 return changed;
}

/** Imported declarations are untrusted. Validate their scalar types before any
 * reference lookup or inventory mutation, shared by automatic and explicit grants. */
export function validateEquipmentItem(item:any):void{
 if(typeof item==='string'){if(!item.trim()||item.split('|')[0].length>300)throw Error('起始装备引用无效。');return;}
 if(!item||typeof item!=='object'||Array.isArray(item))throw Error('起始装备结构尚未支持，请查阅来源资料。');
 for(const field of ['item','special','equipmentType'])if(item[field]!==undefined&&(typeof item[field]!=='string'||!item[field].trim()||(field==='item'?item[field].split('|')[0].length:item[field].length)>300))throw Error('起始装备名称或引用无效。');
 if(item.quantity!==undefined&&(!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>3000))throw Error('装备数量无效。');
 for(const field of ['value','containsValue'])if(item[field]!==undefined&&(typeof item[field]!=='number'||!Number.isFinite(item[field])||item[field]<0||item[field]>100000000))throw Error('起始金币数值无效。');
 if(!item.item&&!item.special&&!item.equipmentType&&item.value===undefined&&item.containsValue===undefined)throw Error('起始装备结构尚未支持，请查阅来源资料。');
}

/** Only validated, concrete items/coins are automatic. Category placeholders
 * still require the existing explicit equipment chooser. */
function grantParts(c:Character,owner:Selection,parts:EquipmentPart[],catalog:Entry[],receipt:SourceEquipmentReceipt):void{
 const grants:{entry:Entry;quantity:number}[]=[];let money=0;
 for(const part of parts)for(const item of part.items){
  validateEquipmentItem(item);
  if(item==null||typeof item!=='string'&&typeof item!=='object')throw Error('起始装备结构尚未支持，请查阅来源资料。');
  const quantity=Number(item.quantity??1);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>3000)throw Error('装备数量无效。');
  if(item.equipmentType)throw Error('此装备类别需要先在选择工作区指定具体装备。');
  const ref=typeof item==='string'?item:item.item;
  if(ref||item.special){const found=ref?resolveEntryReference(ref,[...c.selections.map(row=>row.entry),...catalog],'item'):undefined;const name=item.special||String(ref).split('|')[0];const entry=found||{...owner.entry,id:`${owner.entry.id}#claimed:${ref||name}`,kind:'item' as const,name,english:name,entries:[`起始装备记录：${ref||name}`],raw:ref?{_equipmentRef:ref}:{},effects:undefined,choices:undefined};grants.push({entry,quantity});}
  if(item.value!==undefined||item.containsValue!==undefined){const amount=Number(item.value??item.containsValue)/100;if(!Number.isFinite(amount)||amount<0||amount>1000000)throw Error('起始金币数值无效。');money+=amount;}
  else if(!ref&&!item.special)throw Error('起始装备结构尚未支持，请查阅来源资料。');
 }
 if(c.selections.length+grants.length>3000)throw Error('角色条目数量达到上限。');
 if(inventoryState(c).coins.gp+money>1000000)throw Error('起始金币数值超过上限。');
 const next={...receipt,received:[...new Set([...receipt.received,...parts.map(part=>part.key)])],itemIds:[...receipt.itemIds]};
 for(const grant of grants){const id=uid();c.selections.push({id,entry:structuredClone(grant.entry),quantity:grant.quantity,level:1,equipped:false});next.itemIds.push(id);}
 const inv=c.inventory||=structuredClone(inventoryState(c));inv.coins.gp+=money;saveReceipt(c,owner,next);
}
export function syncSourceEquipment(c:Character,catalog:Entry[],owners=c.selections):boolean{
 let changed=rememberSourceEquipment(c,owners);
 for(const owner of owners){if(!supportedOwner(owner)||!selectionAllowed(c,owner.entry)||!sourceEquipmentShapeSupported(owner.entry))continue;const data=equipmentBlocks(owner.entry);if(!data.length)continue;
  let receipt=sourceEquipmentReceipt(c,owner)||{received:[],choices:{},itemIds:[],ownerIds:[owner.id],completed:false};if(receipt.completed)continue;
  const parts=data.flatMap((block,index)=>{const out:EquipmentPart[]=[],options=keys(block);if(list(block._).length)out.push({key:`${index}:_`,items:block._});if(options.length===1)out.push({key:`${index}:${options[0]}`,items:list(block[options[0]])});return out;}).filter(part=>!receipt.received.includes(part.key));
  // A failed automatic part stays pending and visible through the equipment
  // choice. It never partially mutates the inventory or claims support.
  if(parts.length){try{grantParts(c,owner,parts,catalog,receipt);changed=true;receipt=sourceEquipmentReceipt(c,owner)!;}catch{continue;}}
  if(data.every(block=>keys(block).length<=1)){
   const choices={...receipt.choices};data.forEach((block,index)=>{const option=keys(block)[0];if(option)choices[String(index)]=option;});if(data.length>1||!keys(data[0]).length)choices['-1']='default';
   saveReceipt(c,owner,{...receipt,choices,completed:true});changed=true;
  }
 }
 return changed;
}

/** Explicit confirmation may intentionally claim again. On the first chosen
 * package, the already delivered fixed portion is omitted once. */
export function sourceEquipmentAlreadyReceived(c:Character,owner:Selection):ReadonlySet<string>{const receipt=sourceEquipmentReceipt(c,owner);return new Set(receipt?.completed?[]:receipt?.received||[]);}
export function recordSourceEquipmentClaim(c:Character,owner:Selection,parts:EquipmentPart[],choices:Record<string,string>,itemIds:string[]):void{
 const previous=sourceEquipmentReceipt(c,owner)||{received:[],choices:{},itemIds:[],ownerIds:[owner.id],completed:false};
 saveReceipt(c,owner,{...previous,received:[...new Set([...previous.received,...parts.map(part=>part.key)])],choices:{...previous.choices,...choices},itemIds:[...new Set([...previous.itemIds,...itemIds])],ownerIds:[...new Set([...previous.ownerIds,owner.id])],completed:true});
}
