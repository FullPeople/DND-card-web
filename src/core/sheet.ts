import { requirementMismatch } from './engine';
import { uid, type Character, type Entry, type Selection } from './model';

export function belongsToClass(child: Selection, parent: Selection) {
  return child.entry.kind === 'subclass' && parent.entry.kind === 'class' && (child.parentId ? child.parentId === parent.id : [parent.entry.name, parent.entry.english].includes(child.entry.raw.className) && (!child.entry.raw.classSource || child.entry.raw.classSource.toLowerCase() === parent.entry.source.toLowerCase()));
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
  if (c.featureLayout) { c.featureLayout.order = c.featureLayout.order.filter(key => !removed.has(key)); c.featureLayout.expanded = c.featureLayout.expanded.filter(key => !removed.has(key)); }
}

type Grant = { key: string; entry?: Entry };
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
    const classes = c.selections.filter(s => s.entry.kind === 'class');
    const parent = c.selections.find(s => belongsToClass(owner, s)) || (owner.entry.kind === 'subclass' && classes.length === 1 ? classes[0] : undefined);
    if (parent && !owner.parentId) { owner.parentId = parent.id; changed = true; }
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
      if (grants.some(g => g.entry?.name === block.name)) return;
      grants.push({ key: `inline:${index}`, entry: { ...owner.entry, id: `${owner.entry.id}#trait:${index}`, kind: 'feature', name: block.name, english: block.ENG_name || block.name, entries: block.entries || [block.entry].filter(Boolean), raw: {}, effects: undefined, choices: undefined } });
    });
    for (const block of Array.isArray(raw.feats) ? raw.feats : []) for (const [ref, granted] of Object.entries(block || {})) {
      if (granted === true) grants.push({ key: `feat:${ref}`, entry: resolve(ref, 'feat') });
    }
    const expected = new Set(grants.map(g => g.key));
    for (const child of c.selections.filter(s => s.parentId === owner.id && s.grantKey && !expected.has(s.grantKey))) { removeSelection(c, child.id, false); changed = true; }
    for (const grant of grants) {
      if (!grant.entry || c.dismissedFeatures?.includes(`${owner.id}|${grant.key}`)) continue;
      if (c.selections.some(s => s.parentId === owner.id && s.grantKey === grant.key)) continue;
      const existing = c.selections.find(s => s.entry.id === grant.entry!.id && !s.grantKey && (!s.parentId || s.parentId === owner.id) && (!s.requirementId || s.requirementId.startsWith(`${owner.id}:`)));
      if (existing) { existing.parentId = owner.id; existing.grantKey = grant.key; changed = true; continue; }
      if (c.selections.length >= 3000) break;
      const legacyId = grant.key.startsWith('inline:') ? `${owner.id}:trait:${grant.key.slice(7)}` : undefined;
      c.selections.push({ id: legacyId && !c.selections.some(s => s.id === legacyId) ? legacyId : uid(), entry: structuredClone(grant.entry), level: 1, quantity: 1, equipped: false, parentId: owner.id, grantKey: grant.key }); changed = true;
    }
  }
  return changed;
}
