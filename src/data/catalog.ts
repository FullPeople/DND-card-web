import type { Entry, Kind, Raw } from '../core/model';
import { readCache, writeCache } from '../platform/storage';
import { inheritSubrace, readableEntries } from './adapt';
export const DEFAULT_SOURCE = 'https://5e.kiwee.top';
export interface LoadProgress { done: number; total: number; label: string; failed: string[]; cached: number }
const categories: Record<string, Kind> = { class: 'class', subclass: 'subclass', race: 'race', subrace: 'race', background: 'background', feat: 'feat', spell: 'spell', item: 'item', baseitem: 'item', classFeature: 'feature', subclassFeature: 'feature', optionalfeature: 'feature', condition: 'condition' };
const canonical = (s: unknown) => String(s ?? '').trim().toLowerCase();
export function entryIdentity(kind: Kind, raw: Raw, packId = 'kiwee'): string {
  return [packId, kind, raw.source, raw.ENG_name || raw.name, raw.classSource, raw.className, raw.subclassSource, raw.subclassShortName, kind === 'feature' ? raw.level : undefined, raw.raceName].map(canonical).map(encodeURIComponent).join(':');
}
export function normalizeData(body: Raw, revision: string, packId = 'kiwee'): Entry[] {
  const result: Entry[] = [];
  for (const [key, kind] of Object.entries(categories)) {
    if (!Array.isArray(body[key])) continue;
    for (const item of body[key]) {
      if (!item || typeof item.name !== 'string') continue;
      const raw = key === 'subrace' ? inheritSubrace(item, body.race || []) : item;
      const source = String(raw.source || raw.classSource || 'CUSTOM').toUpperCase();
      const edition = raw.edition === 'one' || ['XPHB', 'XDMG', 'XMM'].includes(source) ? '2024' : raw.edition === 'classic' || ['PHB', 'DMG', 'MM'].includes(source) ? '2014' : 'both';
      result.push({ id: entryIdentity(kind, { ...raw, source }, packId), kind, name: raw.name, english: raw.ENG_name || raw.name, source, edition,
        packId, revision, page: raw.page, entries: readableEntries(raw, key), raw: { ...raw, _category: key } });
    }
  }
  return result;
}
export function resolveReference(ref: string, entries: Entry[], kind?: Kind): Entry | undefined {
  const parts = ref.split('|'); const name = canonical(parts[0]);
  return entries.find(e => (!kind || e.kind === kind) && [e.name, e.english].some(n => canonical(n) === name) &&
    (!parts[1] || (kind === 'feature' ? [e.raw.className, e.raw.classEnglish].some(n => canonical(n) === canonical(parts[1])) : canonical(e.source) === canonical(parts[1]))) &&
    (kind !== 'feature' || !parts[2] || canonical(e.raw.classSource) === canonical(parts[2])) &&
    (kind !== 'feature' || !parts[3] || String(e.raw.level) === parts[3]));
}
async function fetchJson(base: string, path: string, signal: AbortSignal, refresh: boolean): Promise<{ body: Raw; revision: string; cached: boolean; warning?: string }> {
  const key = `${base}/${path}`;
  const prior = await readCache(key);
  if (!refresh && prior) return { ...prior, cached: true };
  try {
    const response = await fetch(key, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('资料格式不正确');
    const revision = response.headers.get('etag') || await hashJson(body);
    await writeCache(key, { body, revision });
    return { body, revision, cached: false };
  } catch (error) {
    if (signal.aborted) throw error;
    if (prior) return { ...prior, cached: true, warning: `更新失败，正在使用旧缓存：${String(error)}` };
    throw error;
  }
}
export async function hashJson(body: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function loadCatalog(onBatch: (entries: Entry[]) => void, onProgress: (p: LoadProgress) => void, signal: AbortSignal, refresh = false, base = DEFAULT_SOURCE): Promise<void> {
  const url = new URL(base); if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('资料源需要 HTTPS 地址');
  base = base.replace(/\/$/, '');
  const paths = ['data/races.json', 'data/backgrounds.json', 'data/feats.json', 'data/items-base.json', 'data/items.json', 'data/optionalfeatures.json', 'data/conditionsdiseases.json'];
  const progress: LoadProgress = { done: 0, total: paths.length + 2, label: '读取资料索引', failed: [], cached: 0 };
  onProgress({ ...progress });
  let spellLookup: Raw = {}; let lookupRevision = '';
  try {
    const lookup = await fetchJson(base, 'data/generated/gendata-spell-source-lookup.json', signal, refresh);
    spellLookup = lookup.body; lookupRevision = lookup.revision; if (lookup.cached) progress.cached++;
    if (lookup.warning) progress.failed.push(`法术职业索引：${lookup.warning}`);
  } catch (error) { if (signal.aborted) return; progress.failed.push(`法术职业索引：${String(error)}`); }
  for (const category of ['class', 'spells']) {
    try {
      const { body, cached, warning } = await fetchJson(base, `data/${category}/index.json`, signal, refresh);
      if (warning) progress.failed.push(`${category} 索引：${warning}`);
      if (cached) progress.cached++;
      for (const value of Object.values(body)) if (typeof value === 'string' && /^[\w.-]+\.json$/.test(value)) paths.push(`data/${category}/${value}`);
    } catch (error) { if (signal.aborted) return; progress.failed.push(`${category} 索引：${String(error)}`); }
    progress.done++; progress.total = paths.length + 2; onProgress({ ...progress });
  }
  // Core rulebooks first; remaining books arrive incrementally.
  paths.sort((a, b) => Number(!/(phb|wizard|fighter|races|backgrounds|feats)/.test(a)) - Number(!/(phb|wizard|fighter|races|backgrounds|feats)/.test(b)));
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < paths.length && !signal.aborted) {
      const path = paths[cursor++];
      try {
        const result = await fetchJson(base, path, signal, refresh);
        if (signal.aborted) return;
        if (result.cached) progress.cached++;
        if (result.warning) progress.failed.push(`${path}：${result.warning}`);
        const normalized = normalizeData(result.body, result.revision);
        for (const entry of normalized) if (entry.kind === 'spell') {
          const lookup = spellLookup[entry.source.toLowerCase()]?.[entry.name.toLowerCase()] || spellLookup[entry.source.toLowerCase()]?.[entry.english.toLowerCase()];
          entry.raw._spellClasses = lookup?.class;
          entry.raw._spellClassLookupLoaded = !!lookup;
          entry.revision += `|lists:${lookupRevision || 'unavailable'}`;
        }
        onBatch(normalized);
      } catch (error) { if (signal.aborted) return; progress.failed.push(`${path}：${String(error)}`); }
      progress.done++; progress.label = path.replace('data/', ''); onProgress({ ...progress, failed: [...progress.failed] });
    }
  }));
}
