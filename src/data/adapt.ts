import { ABILITIES, type Raw } from '../core/model';

/** Inheritance is resolved only for documented simple subrace fields. Complex
 * copy operations remain explicit, rather than guessing at mechanical changes. */
export function inheritSubrace(raw: Raw, races: Raw[]): Raw {
  const parent = races.find(r => [r.name, r.ENG_name].includes(raw.raceName) && r.source === (raw.raceSource || 'PHB'));
  if (!parent) return { ...raw, _unresolvedParent: true };
  const merged: Raw = { ...parent, ...raw, _parentName: parent.name, _parentSource: parent.source, _subraceName: raw.name };
  merged.name = raw.name ? `${parent.name}（${raw.name}）` : parent.name;
  merged.ENG_name = raw.name ? `${parent.ENG_name || parent.name} (${raw.ENG_name || raw.name})` : parent.ENG_name || parent.name;
  const parentEntries = structuredClone(parent.entries || []);
  for (const entry of raw.entries || []) {
    const overwrite = typeof entry === 'object' && entry?.data?.overwrite;
    const index = overwrite ? parentEntries.findIndex((e: Raw) => e.name === overwrite || e.ENG_name === overwrite) : -1;
    if (index >= 0) parentEntries[index] = entry; else parentEntries.push(entry);
  }
  merged.entries = parentEntries;
  if (raw.overwrite?.ability) merged.ability = raw.ability;
  else if (parent.ability?.length === 1 && raw.ability?.length === 1) {
    const a = { ...parent.ability[0], ...raw.ability[0] };
    for (const key of ABILITIES) if (typeof parent.ability[0][key] === 'number' || typeof raw.ability[0][key] === 'number') a[key] = (parent.ability[0][key] || 0) + (raw.ability[0][key] || 0);
    merged.ability = [a];
  } else if (raw.ability && parent.ability) merged._unresolvedParent = true;
  for (const key of ['skillProficiencies', 'toolProficiencies', 'languageProficiencies', 'weaponProficiencies', 'armorProficiencies', 'additionalSpells']) {
    if (!raw.overwrite?.[key]) merged[key] = [...(parent[key] || []), ...(raw[key] || [])];
  }
  return merged;
}

export function readableEntries(raw: Raw, category: string): unknown[] {
  const entries = [...(Array.isArray(raw.entries) ? raw.entries : [])];
  if (Array.isArray(raw.additionalEntries)) entries.push(...raw.additionalEntries);
  if (category === 'itemGroup' && raw.items?.length) entries.push({ type: 'list', items: raw.items.map((ref: string) => `{@item ${ref}}`) });
  if (category === 'table') entries.push({ ...raw, type: 'table' });
  if (category === 'tableGroup') entries.push(...(raw.tables || []));
  if (category === 'psionic') entries.push(...(raw.modes || []));
  if (category === 'class' || category === 'subclass') {
    const refs = raw.classFeatures || raw.subclassFeatures || [];
    if (refs.length) entries.push({ type: 'entries', name: '等级特性', entries: [{ type: 'list', items: refs.map((v: any) => {
      const ref = typeof v === 'string' ? v : v.classFeature || v.subclassFeature;
      return { type: category === 'class' ? 'refClassFeature' : 'refSubclassFeature', [category === 'class' ? 'classFeature' : 'subclassFeature']: ref };
    }) }] });
  }
  if (Array.isArray(raw.startingEquipment) || raw.startingEquipment?.default) {
    const blocks = raw.startingEquipment.default || raw.startingEquipment;
    const describe = (v: any): string => typeof v === 'string' ? v : v.item ? `{@item ${v.item}}${v.quantity ? ` ×${v.quantity}` : ''}` : v.special ? `${v.special}${v.quantity ? ` ×${v.quantity}` : ''}` : v.value ? `${v.value / 100} gp` : v.equipmentType ? `选择装备：${v.equipmentType}` : '';
    entries.push({ type: 'entries', name: '起始装备', entries: blocks.map((block: any) => typeof block === 'string' ? block : Object.entries(block).map(([key, list]) => `${key === '_' ? '固定' : `方案 ${key}`}：${Array.isArray(list) ? list.map(describe).filter(Boolean).join('、') : ''}`).join('\n')) });
  }
  if (category === 'monster') for (const [key,label] of Object.entries({trait:'特性',spellcasting:'施法',action:'动作',bonus:'附赠动作',reaction:'反应',legendary:'传奇动作',mythic:'神话动作',variant:'变体'})) if (raw[key]?.length) entries.push({type:'entries',name:label,entries:raw[key]});
  if (category === 'monster' && raw._legendaryGroup) for(const [key,label] of Object.entries({lairActions:'巢穴动作',regionalEffects:'区域效应',mythicEncounter:'神话遭遇'})) if(raw._legendaryGroup[key])entries.push({type:'entries',name:label,entries:raw._legendaryGroup[key]});
  if (raw.entriesHigherLevel) entries.push(...raw.entriesHigherLevel);
  return entries;
}
