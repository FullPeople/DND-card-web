/** 5etools reference arguments are tag-specific; quickref indexes are not labels. */
export function inlineLabel(tag: string, body: string): string {
  const args = body.split('|');
  if (tag === 'quickref') return args[4] || args[0];
  if (tag === 'filter') return args[0];
  if (['dice', 'damage', 'd20'].includes(tag)) return args[1] || args[0];
  const displayArgument = ({ deity: 3, card: 3, subclass: 4, subclassFluff: 4, classFeature: 5, subclassFeature: 7 } as Record<string, number>)[tag] ?? 2;
  return args[displayArgument] || args[0];
}
