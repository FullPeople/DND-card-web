import { createContext } from 'react';
import type { Character } from '../core/model';
import { conditionVisual, type ConditionVisual } from './conditionVisuals';

// Explicitly approved visual composition; it does not grant/remove character data.
const COMPOSITES: Partial<Record<ConditionVisual, ConditionVisual[]>> = {
  unconscious: ['incapacitated', 'prone'], paralyzed: ['incapacitated'],
  petrified: ['incapacitated'], stunned: ['incapacitated'],
};
export function visualConditions(character: Character) {
  const active = new Set<ConditionVisual>();
  let exhaustion = 0;
  for (const row of character.selections) {
    const id = conditionVisual(row.entry); if (!id) continue;
    active.add(id); for (const inherited of COMPOSITES[id] || []) active.add(inherited);
    if (id === 'exhaustion') exhaustion = Math.max(exhaustion, Math.min(6, Math.max(1, Math.trunc(row.level || 1))));
  }
  return { active, exhaustion };
}
export const CardVisualContext = createContext<{ active: Set<ConditionVisual>; exhaustion: number }>({ active: new Set(), exhaustion: 0 });

export const CardIdentityContext = createContext('');
