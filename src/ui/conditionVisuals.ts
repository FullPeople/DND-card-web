import type { Entry } from '../core/model';

// Presentation aliases only. Selecting an effect does not apply a mechanical rule.
export const CONDITION_VISUALS = {
  blinded: { name: '目盲', layer: 'edge' },
  charmed: { name: '魅惑', layer: 'background' },
  deafened: { name: '耳聋', layer: 'edge' },
  exhaustion: { name: '力竭', layer: 'edge' },
  frightened: { name: '恐慌', layer: 'edge' },
  grappled: { name: '受擒', layer: 'edge' },
  incapacitated: { name: '失能', layer: 'edge' },
  invisible: { name: '隐形', layer: 'edge' },
  paralyzed: { name: '麻痹', layer: 'background' },
  petrified: { name: '石化', layer: 'edge' },
  poisoned: { name: '中毒', layer: 'edge' },
  prone: { name: '倒地', layer: 'edge' },
  restrained: { name: '束缚', layer: 'background' },
  stunned: { name: '震慑', layer: 'edge' },
  unconscious: { name: '昏迷', layer: 'edge' },
  bloodied: { name: '浴血', layer: 'edge' },
  concentration: { name: '专注', layer: 'edge' },
  surprised: { name: '突袭', layer: 'edge' },
} as const;
export type ConditionVisual = keyof typeof CONDITION_VISUALS;

// Exact presentation aliases, including historical Suite IDs. Do not use these
// aliases for source identity, rule matching, deduplication or automatic grants.
const names: Partial<Record<ConditionVisual, readonly string[]>> = {
  frightened: ['恐惧'], stunned: ['眩晕'], invisible: ['隐身'], concentration: ['focused'],
};
const suiteAliases: Record<string, ConditionVisual> = {
  u_paralyzed: 'paralyzed', u_stunned: 'stunned', u_charmed: 'charmed', u_invisible: 'invisible',
  u_restrained: 'restrained', u_focused: 'concentration',
};
const canonical = (value: unknown) => typeof value === 'string' ? value.normalize('NFKC')
  .replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D]/gu, '').replace(/['’`]/g, '')
  .replace(/[\s_-]+/g, ' ').trim().toLowerCase() : '';
const aliases = new Map<string, ConditionVisual>();
for (const [id, visual] of Object.entries(CONDITION_VISUALS) as [ConditionVisual, typeof CONDITION_VISUALS[ConditionVisual]][]) {
  for (const name of [id, visual.name, ...(names[id] || [])]) aliases.set(canonical(name), id);
}
for (const [id, visual] of Object.entries(suiteAliases)) aliases.set(canonical(id), visual);

export function conditionVisual(entry: Entry): ConditionVisual | undefined {
  if (entry.kind !== 'condition') return;
  // An explicitly unknown visual ID is an intentional opt-out. Runtime Suite
  // IDs, however, may be UUIDs or web:<source-entry-id>; they are not visual IDs.
  if (entry.raw.visual?.condition != null) return aliases.get(canonical(entry.raw.visual.condition));
  const suiteVisual = aliases.get(canonical(entry.raw._suiteStatusId));
  if (suiteVisual) return suiteVisual;
  if (entry.raw._workbenchCustom || entry.source === 'CUSTOM') return;
  return aliases.get(canonical(entry.english)) || aliases.get(canonical(entry.name));
}
