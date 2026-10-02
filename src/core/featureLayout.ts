import type { Character } from './model';

/** Missing preferences mean collapsed, independently on the overview/detail pages. */
export function expandedFeatureIds(character: Character, detailed = false, inline = false): readonly string[] {
  if (inline) return [];
  return (detailed ? character.featureLayout?.detailsExpanded : character.featureLayout?.expanded) ?? [];
}

/** A panel owns only its visible rows. Never implicitly open another panel while
 * recording the first explicit preference, and never alter the selected content. */
export function saveFeatureLayout(character: Character, ownIds: readonly string[], order: string[], open: string[], detailed = false): void {
  const own = new Set(ownIds), saved = character.featureLayout;
  const expanded = [...new Set([...expandedFeatureIds(character, detailed).filter(id => !own.has(id)), ...open.filter(id => own.has(id))])];
  character.featureLayout = {
    ...saved,
    order: [...(saved?.order ?? []).filter(id => !own.has(id)), ...order],
    expanded: detailed ? saved?.expanded ?? [] : expanded,
    ...(detailed ? { detailsExpanded: expanded } : {}),
  };
}
