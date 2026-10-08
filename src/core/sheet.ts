import {rememberSourceEquipment,syncSourceEquipment} from './automation/sourceEquipment';
import {entryNameIndex} from './entryNameIndex';
import {specialSpellResource} from './spellResourceKeys';
import {resolveEntryReference} from './entryReferences';
import {equipmentBlocks,syncChoiceContent,preserveClassChoiceGrants} from './automation/choices';
import {rememberFeatureResources} from './automation/featureResources';
import {rememberSourceSpellUses} from './automation/sourceSpellState';
import { requirementMismatch } from './engine';
import { uid, type Character, type Entry, type Selection } from './model';
import {inventoryState} from './characterDetails';
import {classMatches,featureOwner} from './featureOwnership';
import {retainedClassFeatureGrant} from './automation/classChoiceSourceGrant';

export function belongsToClass(child: Selection, parent: Selection) {
  return child.entry.kind === 'subclass' && classMatches(child.entry,parent.entry) && (!child.parentId || child.parentId === parent.id);
}
export function removeSelection(c: Character, id: string, dismiss = true) {
  rememberFeatureResources(c);
  rememberSourceEquipment(c);
  // Already delivered starting possessions outlive their source selection.
  for(const item of c.selections)if(item.parentId===id&&item.entry.kind==='item'&&item.grantKey?.startsWith('equipment:')){delete item.parentId;if(item.requirementId?.startsWith(`${id}:`))delete item.requirementId;}
  const row = c.selections.find(s => s.id === id);
  if(dismiss&&row?.grantKey?.startsWith('source-spell:'))return;
  if (dismiss && row?.parentId && row.grantKey) c.dismissedFeatures = [...new Set([...(c.dismissedFeatures || []), `${row.parentId}|${row.grantKey}`])];
  const removed = new Set([id]);
  for (let changed = true; changed;) {
    changed = false;
    for (const s of c.selections) if (!removed.has(s.id) && (s.parentId && removed.has(s.parentId) || s.requirementId && [...removed].some(key => s.requirementId!.startsWith(`${key}:`)) || [...removed].some(key => { const parent = c.selections.find(p => p.id === key); return parent && belongsToClass(s, parent); }))) { removed.add(s.id); changed = true; }
  }
  if(dismiss&&c.classChoiceArchive){
    const discardedParents:string[]=[];
    for(const [key,archive] of Object.entries(c.classChoiceArchive)){
      const root=archive.selections[0];
      if(root.parentId&&removed.has(root.parentId)||archive.parent?.parentId&&removed.has(archive.parent.parentId))for(const row of archive.selections)removed.add(row.id);
      for(let changed=true;changed;){changed=false;for(const row of archive.selections)if(row.parentId&&removed.has(row.parentId)&&!removed.has(row.id)){removed.add(row.id);changed=true;}}
      archive.selections=archive.selections.filter(row=>!removed.has(row.id));
      if(!archive.selections.length){if(archive.parent)discardedParents.push(archive.parent.id);delete c.classChoiceArchive[key];}
    }
    for(const parent of discardedParents)if(!c.selections.some(row=>row.id===parent)&&!Object.values(c.classChoiceArchive).some(archive=>archive.parent?.id===parent))removed.add(parent);
    if(!Object.keys(c.classChoiceArchive).length)delete c.classChoiceArchive;
  }
  rememberSourceSpellUses(c);
  const spellCounters=[...removed].map(id=>specialSpellResource(id,c));
  // Automatic level removal parks a class-choice tree first. Keep saved UI
  // references to its source snapshot so restoring the old ID restores pins.
  const retainedParents=new Set(dismiss?[]:Object.values(c.classChoiceArchive||{}).flatMap(archive=>archive.parent?[archive.parent.id]:[]));
  const removedReference=(key:string)=>removed.has(key)&&!retainedParents.has(key);
  c.selections = c.selections.filter(s => !removed.has(s.id));
  c.quickbar = c.quickbar?.filter(key => !removedReference(key));
  if(c.spellSettings){c.spellSettings.prepared=c.spellSettings.prepared.map(key=>removed.has(key)?'':key);for(const [owner,ids] of Object.entries(c.spellSettings.cantrips||{})){if(removed.has(owner))delete c.spellSettings.cantrips![owner];else c.spellSettings.cantrips![owner]=ids.map(id=>removed.has(id)?'':id);}}
  if(c.spellSettings?.classSpells)for(const [owner,ids] of Object.entries(c.spellSettings.classSpells)){if(removed.has(owner))delete c.spellSettings.classSpells[owner];else c.spellSettings.classSpells[owner]=ids.map(id=>removed.has(id)?'':id);}
  for(const key of removed)if(c.spellSettings?.special)delete c.spellSettings.special[key];
  for(const key of removed){if(c.spellSettings?.sourceCantripCapacities)delete c.spellSettings.sourceCantripCapacities[key];if(c.spellSettings?.sourceCapacityAdjustments)delete c.spellSettings.sourceCapacityAdjustments[key];if(c.spellSettings?.cantripCapacityAdjustments)delete c.spellSettings.cantripCapacityAdjustments[key];}
  for(const key of spellCounters)if(!Object.keys(c.spellSettings?.special||{}).some(id=>specialSpellResource(id,c)===key))delete c.runtime.resources[key];
  if(c.inventory)c.inventory.order=c.inventory.order.filter(key=>!removed.has(key));
  if(c.backgroundChoices)for(const key of removed)delete c.backgroundChoices[key];
  if (c.featureLayout) { c.featureLayout.order = c.featureLayout.order.filter(key => !removedReference(key)); c.featureLayout.expanded = c.featureLayout.expanded.filter(key => !removedReference(key)); c.featureLayout.detailsExpanded=c.featureLayout.detailsExpanded?.filter(key=>!removedReference(key));for(const id of removed)if(removedReference(id)&&c.featureLayout.optionsVisible)delete c.featureLayout.optionsVisible[id]; }
}

type Grant = { key: string; entry?: Entry;quantity?:number };
/** Attach declared content, never infer choices from prose or a named class/feature. */
export function syncFeatures(c: Character, catalog: Entry[], review?:{owners:Set<string>;refresh:boolean;equipmentPreview?:boolean},catalogNames?:ReadonlyMap<string,readonly Entry[]>): boolean {
  let changed = preserveClassChoiceGrants(c,catalog);
  changed = (review?.equipmentPreview?false:syncSourceEquipment(c,catalog,c.selections.filter(row=>!review||review.owners.has(row.id))))||changed;
  for(const row of c.selections)if(row.entry.kind==='item'&&typeof row.entry.raw._equipmentRef==='string'){const entry=resolveEntryReference(row.entry.raw._equipmentRef,catalog,'item');if(entry&&!entry.raw._equipmentRef){row.entry=structuredClone(entry);changed=true;}}
  const selectedNames=entryNameIndex(c.selections.map(s=>s.entry)),publishedNames=catalogNames||entryNameIndex(catalog);
  const named=(name:string)=>review?.refresh?[...(publishedNames.get(name)||[]),...(selectedNames.get(name)||[])]:[...(selectedNames.get(name)||[]),...(publishedNames.get(name)||[])];
  function resolve(ref: string, kind: Entry['kind']) {
    const exact = named(ref.split('|')[0].toLowerCase()).find(e => e.kind === kind && !requirementMismatch(e, { refs: [ref] }));
    if (exact || kind !== 'feat') return exact;
    // A declared grant can qualify a catalog feat with a choice after a separator.
    // Preserve that qualifier as content; do not interpret or enforce the choice.
    const [name, source] = ref.split('|'), base = name.split(/[：:；;]/)[0].trim();
    if (base === name) return undefined;
    const entry = named(base.toLowerCase()).find(e => e.kind === kind && !requirementMismatch(e, { refs: [`${base}|${source || ''}`] }));
    return entry ? { ...entry, id: `${entry.id}#grant:${name}`, name, raw: { ...entry.raw, _grantReference: ref } } : undefined;
  }
  const roots = c.selections.filter(s => ['class', 'subclass', 'race', 'background'].includes(s.entry.kind)&&(!review||review.owners.has(s.id)));
  for (const owner of roots) {
    const raw = owner.entry.raw, grants: Grant[] = [];
    const parent = c.selections.find(s => belongsToClass(owner, s));
    if (parent && !owner.parentId) { owner.parentId = parent.id; changed = true; }
    if (parent && owner.level !== parent.level) { owner.level = parent.level; changed = true; }
    const refs = owner.entry.kind === 'class' ? raw.classFeatures : owner.entry.kind === 'subclass' ? raw.subclassFeatures : undefined;
    for (const block of Array.isArray(refs) ? refs : []) {
      const ref = typeof block === 'string' ? block : block?.classFeature || block?.subclassFeature;
      if (typeof ref !== 'string') continue;
      const level = Number(ref.split('|')[owner.entry.kind === 'subclass' ? 5 : 3]);
      if (level > (parent?.level || owner.level)) continue;
      grants.push({ key: `ref:${ref}`, entry: resolve(ref, 'feature') });
    }
    // Named inline blocks are content sections, not separately invented rules.
    const blocks = raw.entries || (['race', 'background', 'feat'].includes(owner.entry.kind) ? owner.entry.entries : undefined);
    (Array.isArray(blocks) ? blocks : []).forEach((block, index) => {
      if (!block || typeof block !== 'object' || !block.name || block.type === 'options') return;
      if(owner.entry.kind==='background'&&!block.data?.isFeature)return;
      if (grants.some(g => g.entry?.name === block.name)) return;
      grants.push({ key: `inline:${index}`, entry: { ...owner.entry, id: `${owner.entry.id}#trait:${index}`, kind: 'feature', name: block.name, english: block.ENG_name || block.name, entries: block.entries || [block.entry].filter(Boolean), raw: {}, effects: undefined, choices: undefined } });
    });
    for (const block of Array.isArray(raw.feats) ? raw.feats : []) for (const [ref, granted] of Object.entries(block || {})) {
      if (granted === true) grants.push({ key: `feat:${ref}`, entry: resolve(ref, 'feat') });
    }
    // The old-card review builds a disposable linked-grant template. Runtime
    // hydration uses sourceEquipment receipts and never executes this preview path.
    if(review?.equipmentPreview&&owner.entry.kind==='background')for(const [index,block] of equipmentBlocks(owner.entry).entries()){
      const chosen=c.backgroundChoices?.[owner.id]?.equipment?.[String(index)];
      const options=Object.keys(block).filter(k=>k!=='_');
      const selectedKey=chosen&&options.includes(chosen)?chosen:options.length===1?options[0]:undefined;
      const equipment=[...(block._||[]).map((item:any,i:number)=>({item,key:`equipment:${index}:_:${i}`})),...(selectedKey?block[selectedKey]:[]).map((item:any,i:number)=>({item,key:`equipment:${index}:${selectedKey}:${i}`}))];
      let money=0;
      equipment.forEach(({item,key}:{item:any;key:string})=>{
        const ref=typeof item==='string'?item:item.item;
        let entry=typeof ref==='string'?resolve(ref,'item'):undefined;
        if(!entry&&(item.special||ref))entry={...owner.entry,id:`${owner.entry.id}#${key}`,kind:'item',name:item.special||ref.split('|')[0],english:item.special||ref.split('|')[0],entries:[],raw:ref?{_equipmentRef:ref}:{},effects:undefined,choices:undefined};
        if(entry)grants.push({key,entry,quantity:Math.max(1,Math.trunc(item.quantity||1))});
        money+=Number(item.value||item.containsValue||0)/100;
      });
      const coinKey=`${owner.id}|equipment:${index}`,before=c.inventory?.grantedCoins?.[coinKey]||0;
      if(money!==before){const inv=c.inventory||=structuredClone(inventoryState(c));(inv.grantedCoins||={})[coinKey]=money;inv.coins.gp=Math.max(0,inv.coins.gp+money-before);changed=true;}
    }
    const expected = new Set(grants.map(g => g.key));
    for (const child of c.selections.filter(s => s.parentId === owner.id && s.grantKey && !s.grantKey.startsWith('source-spell:') && !s.grantKey.startsWith('choice:') && (!s.grantKey.startsWith('equipment:')||!!review?.equipmentPreview) && !expected.has(s.grantKey))) { removeSelection(c, child.id, false); changed = true; }
    for (const grant of grants) {
      if(!grant.entry&&grant.key.startsWith('ref:')){
        const retained=retainedClassFeatureGrant(c,owner,grant.key.slice(4));
        if(retained)grant.entry=retained.entry;
      }
      if (!grant.entry || c.dismissedFeatures?.includes(`${owner.id}|${grant.key}`)) continue;
      const attached=c.selections.find(s => s.parentId === owner.id && s.grantKey === grant.key);
      if(attached){if(review?.refresh&&JSON.stringify(attached.entry)!==JSON.stringify(grant.entry)||attached.entry.raw._equipmentRef&&!grant.entry.raw._equipmentRef){attached.entry=structuredClone(grant.entry);changed=true;}continue;}
      const existing = c.selections.find(s => s.entry.id === grant.entry!.id && !s.grantKey && (!s.parentId || s.parentId === owner.id) && (!s.requirementId || s.requirementId.startsWith(`${owner.id}:`)));
      if (existing) { existing.parentId = owner.id; existing.grantKey = grant.key; changed = true; continue; }
      if (c.selections.length >= 3000) break;
      // A prerequisite may keep the archived feat inactive until its source
      // feature is present. Recreate that already-declared feature using its
      // saved identity, so the later choice sync restores the exact old tree.
      const retainedParent=Object.values(c.classChoiceArchive||{}).map(archive=>archive.parent).find(parent=>parent?.entry.kind==='feature'&&parent.parentId===owner.id&&parent.grantKey===grant.key&&parent.entry.id===grant.entry!.id&&!c.selections.some(row=>row.id===parent.id));
      if(retainedParent){const restored=structuredClone(retainedParent);if(review?.refresh)restored.entry=structuredClone(grant.entry);c.selections.push(restored);changed=true;continue;}
      const legacyId = grant.key.startsWith('inline:') ? `${owner.id}:trait:${grant.key.slice(7)}` : undefined;
      c.selections.push({ id: legacyId && !c.selections.some(s => s.id === legacyId) ? legacyId : uid(), entry: structuredClone(grant.entry), level: 1, quantity: grant.quantity||1, equipped: false, parentId: owner.id, grantKey: grant.key }); changed = true;
    }
  }
  for(const row of c.selections.filter(s=>s.entry.kind==='feature'&&(!review||!!s.parentId&&review.owners.has(s.parentId)))){
    const owner=featureOwner(c,row);
    if(owner&&row.parentId!==owner.id){row.parentId=owner.id;changed=true;}
  }
  return syncChoiceContent(c,catalog)||changed;
}
