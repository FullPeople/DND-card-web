import {ABILITIES, type Ability, type Character, type Issue, type Selection} from './model';

export type RacialAbilityPlan = {
  bonuses: Partial<Record<Ability, number>>;
  trace: Partial<Record<Ability, string[]>>;
  issues: Issue[];
};

/** Pure, source-declared fixed racial increases. Saved card/version markers do
 * not suppress an owned source's bonuses. Optional allocations stay unresolved. */
export function planRacialAbilities(_c: Character, selection: Selection): RacialAbilityPlan {
  const result: RacialAbilityPlan = {bonuses: {}, trace: {}, issues: []};
  const entry = selection.entry, raw = entry.raw;
  if (entry.kind !== 'race' || raw.ability === undefined) return result;
  const blocks: unknown = raw.ability;
  if (Array.isArray(blocks) && !blocks.length) return result;
  const block = Array.isArray(blocks) && blocks.length === 1 && blocks[0] && typeof blocks[0] === 'object' && !Array.isArray(blocks[0]) ? blocks[0] as Record<string, unknown> : undefined;
  const declared = ABILITIES.filter(a => block && typeof block[a] === 'number' && block[a] !== 0);
  // Explicit rule-pack effects already owned these targets before raw support.
  // Keep their semantics and never add a second copy from raw.ability.
  const explicit = new Set((entry.effects || []).flatMap(effect => effect.op !== 'proficiency' && ABILITIES.includes(effect.target as Ability) ? [effect.target as Ability] : []));
  const affected = (declared.length ? declared : [...ABILITIES]).filter(a => !explicit.has(a));
  if (!affected.length) return result;
  const warn = (code: string, message: string) => {
    result.issues.push({id: `racial-ability:${code}:${selection.id}`, selectionId: selection.id, severity: 'warning', message});
    for (const ability of affected) result.trace[ability] = [message];
    return result;
  };
  const fixed = block && Object.entries(block).every(([key, value]) => ABILITIES.includes(key as Ability) && typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= 10);
  if (!fixed || raw._copy || raw._unresolvedParent) return warn('unsupported', `${entry.name}：种族属性含待选择或尚未支持的规则；未自动叠加，请核对资料与基础属性。`);
  for (const ability of declared) {
    if (explicit.has(ability)) continue;
    const amount = block![ability] as number;
    result.bonuses[ability] = amount;
    result.trace[ability] = [`种族：${entry.name} · ${entry.source} ${amount < 0 ? '' : '+'}${amount}`];
  }
  return result;
}
