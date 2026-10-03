/** Shared, browser-safe identity codec. This module has no runtime dependencies. */
export interface IdentityInput { kind: string; source: string; engName: string; packId?: string; classSource?: string; classEngName?: string; subclassSource?: string; subclassEngShortName?: string; raceSource?: string; raceEngName?: string; level?: number; extra?: string }
export interface Identity extends IdentityInput { key: string }
export const containsCjk = (value: string): boolean => /[\u3400-\u9fff\uf900-\ufaff\u{20000}-\u{323af}]/u.test(value);
const normalized = (value: unknown): string => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function identityKey(input: IdentityInput): string {
  return [input.packId || 'kiwee', input.kind, input.source, input.engName, input.classSource, input.classEngName, input.subclassSource, input.subclassEngShortName, input.level, input.raceSource, input.raceEngName, input.extra].map(normalized).map(encodeURIComponent).join(':');
}
export function createIdentity(input: IdentityInput): Identity {
  for (const field of ['kind', 'source', 'engName'] as const) if (typeof input[field] !== 'string' || !input[field].trim()) throw Error(`Missing identity ${field}`);
  for (const [field, value] of Object.entries(input)) if (typeof value === 'string' && (containsCjk(value) || value.length > 1000 || /[\u0000-\u001f]/.test(value))) throw Error(`Unsafe identity ${field}`);
  if (input.level !== undefined && (!Number.isInteger(input.level) || input.level < 0 || input.level > 20)) throw Error('Invalid feature level');
  if (!!input.classEngName !== !!input.classSource || !!input.subclassEngShortName !== !!input.subclassSource || !!input.raceEngName !== !!input.raceSource) throw Error('Incomplete parent identity');
  if (input.subclassEngShortName && !input.classEngName) throw Error('Subclass requires class identity');
  const output: IdentityInput = { ...input, kind: input.kind.trim(), source: input.source.trim().toUpperCase(), engName: input.engName.normalize('NFKC').trim(), packId: input.packId || 'kiwee' };
  for (const field of ['classSource', 'subclassSource', 'raceSource'] as const) if (output[field]) output[field] = output[field]!.trim().toUpperCase();
  return { ...output, key: identityKey(output) };
}
