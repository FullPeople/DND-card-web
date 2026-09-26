import { requirementMismatch } from './engine';
import { uid, type Character, type Entry, type Selection } from './model';
import {inventoryState} from './characterDetails';
import {classMatches,featureOwner} from './featureOwnership';

export function belongsToClass(child: Selection, parent: Selection) {
  return child.entry.kind === 'subclass' && classMatches(child.entry,parent.entry) && (!child.parentId || child.parentId === parent.id);
}
export function removeSelection(c: Character, id: string, dismiss = true) {
  const row = c.selections.find(s => s.id === id);
  if (dismiss && row?.parentId && row.grantKey) c.dismissedFeatures = [...new Set([...(c.dismissedFeatures || []), `${row.parentId}|${row.grantKey}`])];
  const removed = new Set([id]);
  for (let changed = true; changed;) {
    changed = false;
    for (const s of c.selections) if (!removed.has(s.id) && (s.parentId && removed.has(s.parentId) || s.requirementId && [...removed].some(key => s.requirementId!.startsWith(`${key}:`)) || [...removed].some(key => { const parent = c.selections.find(p => p.id === key); return parent && belongsToClass(s, parent); }))) { removed.add(s.id); changed = true; }
  }
  c.selections = c.selections.filter(s => !removed.has(s.id));
  c.quickbar = c.quickbar?.filter(key => !removed.has(key));
  if(c.spellSettings)c.spellSettings.prepared=c.spellSettings.prepared.map(key=>removed.has(key)?'':key);
  for(const key of removed){if(c.spellSettings?.special)delete c.spellSettings.special[key];delete c.runtime.resources[`innate-spell:${key}`];}
  if(c.inventory)c.inventory.order=c.inventory.order.filter(key=>!removed.has(key));
  if(c.backgroundChoices)for(const key of removed)delete c.backgroundChoices[key];
  if (c.featureLayout) { c.featureLayout.order = c.featureLayout.order.filter(key => !removed.has(key)); c.featureLayout.expanded = c.featureLayout.expanded.filter(key => !removed.has(key)); c.featureLayout.detailsExpanded=c.featureLayout.detailsExpanded?.filter(key=>!removed.has(key)); }
}

type Grant = { key: string; entry?: Entry;quantity?:number };
/** Attach declared content, never infer choices from prose or a named class/feature. */
export function syncFeatures(c: Character, catalog: Entry[]): boolean {
  let changed = false;
  const known = [...c.selections.map(s => s.entry), ...catalog];
  const byName = new Map<string, Entry[]>();
  for (const entry of known) for (const name of new Set([entry.name.toLowerCase(), entry.english.toLowerCase()])) { const group = byName.get(name) || []; group.push(entry); byName.set(name, group); }
  function resolve(ref: string, kind: Entry['kind']) {
    const exact = (byName.get(ref.split('|')[0].toLowerCase()) || []).find(e => e.kind === kind && !requirementMismatch(e, { refs: [ref] }));
    if (exact || kind !== 'feat') return exact;
    // A declared grant can qualify a catalog feat with a choice after a separator.
    // Preserve that qualifier as content; do not interpret or enforce the choice.
    const [name, source] = ref.split('|'), base = name.split(/[：:；;]/)[0].trim();
    if (base === name) return undefined;
    const entry = (byName.get(base.toLowerCase()) || []).find(e => e.kind === kind && !requirementMismatch(e, { refs: [`${base}|${source || ''}`] }));
    return entry ? { ...entry, id: `${entry.id}#grant:${name}`, name, raw: { ...entry.raw, _grantReference: ref } } : undefined;
  }
  const roots = c.selections.filter(s => ['class', 'subclass', 'race', 'background'].includes(s.entry.kind));
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
    if(owner.entry.kind==='background')for(const [index,block] of (Array.isArray(raw.startingEquipment)?raw.startingEquipment:[]).entries()){
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
    for (const child of c.selections.filter(s => s.parentId === owner.id && s.grantKey && !expected.has(s.grantKey))) { removeSelection(c, child.id, false); changed = true; }
    for (const grant of grants) {
      if (!grant.entry || c.dismissedFeatures?.includes(`${owner.id}|${grant.key}`)) continue;
      const attached=c.selections.find(s => s.parentId === owner.id && s.grantKey === grant.key);
      if(attached){if(attached.entry.raw._equipmentRef&&!grant.entry.raw._equipmentRef){attached.entry=structuredClone(grant.entry);changed=true;}continue;}
      const existing = c.selections.find(s => s.entry.id === grant.entry!.id && !s.grantKey && (!s.parentId || s.parentId === owner.id) && (!s.requirementId || s.requirementId.startsWith(`${owner.id}:`)));
      if (existing) { existing.parentId = owner.id; existing.grantKey = grant.key; changed = true; continue; }
      if (c.selections.length >= 3000) break;
      const legacyId = grant.key.startsWith('inline:') ? `${owner.id}:trait:${grant.key.slice(7)}` : undefined;
      c.selections.push({ id: legacyId && !c.selections.some(s => s.id === legacyId) ? legacyId : uid(), entry: structuredClone(grant.entry), level: 1, quantity: grant.quantity||1, equipped: false, parentId: owner.id, grantKey: grant.key }); changed = true;
    }
  }
  for(const row of c.selections.filter(s=>s.entry.kind==='feature')){
    const owner=featureOwner(c,row);
    if(owner&&row.parentId!==owner.id){row.parentId=owner.id;changed=true;}
  }
  return changed;
}
