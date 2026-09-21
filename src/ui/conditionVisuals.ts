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
export function conditionVisual(entry: Entry): ConditionVisual | undefined {
  if (entry.kind !== 'condition') return;
  const id = String(entry.raw.visual?.condition || entry.english).toLowerCase();
  if (Object.hasOwn(CONDITION_VISUALS, id)) return id as ConditionVisual;
  return (Object.keys(CONDITION_VISUALS) as ConditionVisual[]).find(key => CONDITION_VISUALS[key].name === entry.name);
}
