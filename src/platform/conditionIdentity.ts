import type { Entry } from '../core/model';

type RuntimeConditionIdentity = { id: string; entry?: Pick<Entry, 'id' | 'raw'> };
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const runtimeIds = (condition: RuntimeConditionIdentity): string[] => [
  condition.id, condition.entry?.raw._suiteStatusId,
  // The host uses this transport ID when it projects a catalog condition into
  // legacy Suite status metadata. It identifies the exact source entry.
  ...(validId(condition.entry?.id) ? [`web:${condition.entry.id}`] : []),
].filter(validId);

/** Compare persisted identities only. Two statuses can use the same visual or
 * title while retaining different sources and separate removal/undo behavior. */
export function runtimeConditionMatches(a: RuntimeConditionIdentity, b: RuntimeConditionIdentity): boolean {
  if (validId(a.entry?.id) && a.entry.id === b.entry?.id) return true;
  const other = new Set(runtimeIds(b));
  return runtimeIds(a).some(id => other.has(id));
}
