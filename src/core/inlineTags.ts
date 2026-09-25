/** 5etools reference arguments are tag-specific; quickref indexes are not labels. */
export function inlineLabel(tag: string, body: string): string {
  const args = body.split('|');
  if (tag === 'quickref') return args[4] || args[0];
  if (tag === 'filter') return args[0];
  if (['dice', 'damage', 'd20'].includes(tag)) return args[1] || args[0];
  return args[2] || args[0];
}
