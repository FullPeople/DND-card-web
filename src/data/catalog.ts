import type { Entry, Kind, Raw } from '../core/model';
import { readCache, writeCache } from '../platform/storage';
import { prepareBody, specificMagicItems, expandVersions, expandCopies } from './expand';
import { inheritSubrace, readableEntries } from './adapt';
import {DEFAULT_HOMEBREW,homebrewPaths,homebrewMetadata,homebrewBody} from './homebrew';
export const DEFAULT_SOURCE = 'https://5e.kiwee.top';
export interface LoadProgress { done: number; total: number; label: string; failed: string[]; cached: number }
const categories: Record<string, Kind> = { class: 'class', subclass: 'subclass', race: 'race', subrace: 'race', background: 'background', feat: 'feat', spell: 'spell', item: 'item', baseitem: 'item', classFeature: 'feature', subclassFeature: 'feature', optionalfeature: 'feature', condition: 'condition', variantrule: 'rule', action: 'rule', sense: 'rule', skill: 'rule', language: 'rule', status: 'condition', disease: 'condition', itemGroup: 'item', magicvariant: 'item', itemMastery: 'feature', itemProperty: 'rule', itemType: 'rule', reward: 'feature', charoption: 'feature', psionic: 'feature', deity: 'rule', cult: 'rule', boon: 'feature', facility: 'rule', table: 'rule', tableGroup: 'rule', monster: 'monster' };
const canonical = (s: unknown) => String(s ?? '').trim().toLowerCase();
export function entryIdentity(kind: Kind, raw: Raw, packId = 'kiwee'): string {
  return [packId, kind, raw.source, raw.ENG_name || raw.name, raw.classSource, raw.className, raw.subclassSource, raw.subclassShortName, kind === 'feature' ? raw.level : undefined, raw.raceName, ...(kind === 'rule' ? [raw._category] : []), ...(raw._variantIdentity ? [raw._variantIdentity] : []), ...(raw._category === 'deity' ? [raw.pantheon] : []), ...(['table', 'tableGroup'].includes(raw._category) ? [raw.name, raw.page] : []), ...(['itemGroup', 'magicvariant', 'status', 'disease'].includes(raw._category) ? [raw._category] : [])].map(canonical).map(encodeURIComponent).join(':');
}
export function normalizeData(body: Raw, revision: string, packId = 'kiwee'): Entry[] {
  body = prepareBody(body);
  const result: Entry[] = [];
  for (const [key, kind] of Object.entries(categories)) {
    if (!Array.isArray(body[key])) continue;
    for (const sourceItem of body[key]) {
      const item = sourceItem && !sourceItem.name && sourceItem.abbreviation ? { ...sourceItem, name: sourceItem.entries?.[0]?.name || sourceItem.abbreviation, ENG_name: sourceItem.entries?.[0]?.ENG_name || sourceItem.abbreviation } : sourceItem;
      if (!item || typeof item.name !== 'string' && key !== 'subrace') continue;
      const inherited = key === 'subrace' ? inheritSubrace(item, body.race || []) : item;
      for (const raw of [inherited, ...expandVersions(inherited)]) {
      const source = String(raw.source || raw.classSource || 'CUSTOM').toUpperCase();
      const edition = raw.edition === 'one' || ['XPHB', 'XDMG', 'XMM'].includes(source) ? '2024' : raw.edition === 'classic' || ['PHB', 'DMG', 'MM'].includes(source) ? '2014' : 'both';
      result.push({ id: entryIdentity(kind, { ...raw, source, _category: key }, packId), kind, name: raw.name, english: raw.ENG_name || raw.name, source, edition,
        packId, revision, page: raw.page, entries: readableEntries(raw, key), raw: { ...raw, _category: key } });
      }
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
  const cached = await readCache(key);
  const valid=(body:Raw)=>!path.endsWith('/index.json')||Object.values(body).some(v=>typeof v==='string'&&v.endsWith('.json'));
  const prior=cached&&valid(cached.body)?cached:undefined;
  if (!refresh && prior) return { ...prior, cached: true };
  try {
    const response = await fetch(key, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('资料格式不正确');
    if(!valid(body))throw Error('资料索引为空，请重试');
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
export async function loadCatalog(onBatch: (entries: Entry[]) => void, onProgress: (p: LoadProgress) => void, signal: AbortSignal, refresh = false, base = DEFAULT_SOURCE, onSources?: (names: Record<string, {name:string;date?:string}>) => void): Promise<void> {
  const url = new URL(base); if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('资料源需要 HTTPS 地址');
  base = base.replace(/\/$/, '');
  const paths = ['data/bestiary/template.json','data/bestiary/legendarygroups.json','data/generated/gendata-variantrules.json', 'data/magicvariants.json', 'data/charcreationoptions.json', 'data/rewards.json', 'data/psionics.json', 'data/deities.json', 'data/cultsboons.json', 'data/bastions.json', 'data/tables.json', 'data/generated/gendata-tables.json', 'data/races.json', 'data/backgrounds.json', 'data/feats.json', 'data/items-base.json', 'data/items.json', 'data/optionalfeatures.json', 'data/conditionsdiseases.json', 'data/books.json', 'data/adventures.json', 'data/variantrules.json', 'data/actions.json', 'data/skills.json', 'data/senses.json', 'data/languages.json'];
  const progress: LoadProgress = { done: 0, total: paths.length + 3, label: '读取资料索引', failed: [], cached: 0 };
  onProgress({ ...progress });
  let spellLookup: Raw = {}; let lookupRevision = '';
  try {
    const lookup = await fetchJson(base, 'data/generated/gendata-spell-source-lookup.json', signal, refresh);
    spellLookup = lookup.body; lookupRevision = lookup.revision; if (lookup.cached) progress.cached++;
    if (lookup.warning) progress.failed.push(`法术职业索引：${lookup.warning}`);
  } catch (error) { if (signal.aborted) return; progress.failed.push(`法术职业索引：${String(error)}`); }
  for (const category of ['class', 'spells', 'bestiary']) {
    try {
      const { body, cached, warning } = await fetchJson(base, `data/${category}/index.json`, signal, refresh);
      if (warning) progress.failed.push(`${category} 索引：${warning}`);
      if (cached) progress.cached++;
      for (const value of Object.values(body)) if (typeof value === 'string' && /^[\w.-]+\.json$/.test(value)) paths.push(`data/${category}/${value}`);
    } catch (error) { if (signal.aborted) return; progress.failed.push(`${category} 索引：${String(error)}`); }
    progress.done++; progress.total = paths.length + 3; onProgress({ ...progress });
  }
  for(const file of ['spells-phb.json','spells-xphb.json']){const path=`data/spells/${file}`;if(!paths.includes(path))paths.push(path);}
  // Core rulebooks first; remaining books arrive incrementally.
  paths.sort((a, b) => Number(!/(phb|wizard|fighter|races|backgrounds|feats)/.test(a)) - Number(!/(phb|wizard|fighter|races|backgrounds|feats)/.test(b)));
  const monsters: Raw[]=[];let monsterTemplates:Raw[]=[],legendaryGroups:Raw[]=[];
  const equipment: Raw = {}; const equipmentRevisions: string[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < paths.length && !signal.aborted) {
      const path = paths[cursor++];
      try {
        const result = await fetchJson(base, path, signal, refresh);
        if (signal.aborted) return;
        if (result.cached) progress.cached++;
        if (result.warning) progress.failed.push(`${path}：${result.warning}`);
        if (['data/books.json','data/adventures.json'].includes(path)) onSources?.(Object.fromEntries((result.body.book || result.body.adventure || []).map((book: Raw) => [String(book.source || book.id).toUpperCase(), {name:book.name,date:book.published}])));
        if (['data/items-base.json', 'data/items.json', 'data/magicvariants.json'].includes(path)) { Object.assign(equipment, result.body); equipmentRevisions.push(`${path}:${result.revision}`); }
        if(result.body.monster)monsters.push(...result.body.monster);
        if(result.body.monsterTemplate)monsterTemplates=result.body.monsterTemplate;
        if(result.body.legendaryGroup)legendaryGroups=result.body.legendaryGroup;
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
  if(!signal.aborted && monsters.length){
    const groups=expandCopies(legendaryGroups),templates=expandCopies(monsterTemplates);
    const expanded=expandCopies(monsters,templates).map(raw=>{const group=raw.legendaryGroup&&groups.find(g=>[g.name,g.ENG_name].includes(raw.legendaryGroup.name)&&g.source===raw.legendaryGroup.source);return group?{...raw,_legendaryGroup:group}:raw;});
    onBatch(normalizeData({monster:expanded},await hashJson(expanded)));
  }
  if (!signal.aborted && Object.keys(equipment).length) {
    const revision = equipmentRevisions.sort().join('|');
    onBatch(normalizeData(equipment, revision));
    const expanded = prepareBody(equipment);
    onBatch(normalizeData({ ...equipment, baseitem: [], itemGroup: [], magicvariant: [], item: specificMagicItems(expanded) }, revision));
  }
  // The mirror keeps third-party books in a separate repository, outside data/*.
  // Load its generated index rather than maintaining a list of book titles here.
  if(!signal.aborted&&base===DEFAULT_SOURCE){
    let brewFiles:string[]=[];
    try{const index=await fetchJson(DEFAULT_HOMEBREW,'_generated/index-sources.json',signal,refresh);brewFiles=homebrewPaths(index.body);if(index.cached)progress.cached++;if(index.warning)progress.failed.push(`三方索引：${index.warning}`);}
    catch(error){if(signal.aborted)return;progress.failed.push(`三方资料索引：${String(error)}`);}
    progress.total+=brewFiles.length;let brewCursor=0;
    await Promise.all(Array.from({length:3},async()=>{while(brewCursor<brewFiles.length&&!signal.aborted){
      const path=brewFiles[brewCursor++];
      try{
        const result=await fetchJson(DEFAULT_HOMEBREW,path.split('/').map(encodeURIComponent).join('/'),signal,refresh);
        if(signal.aborted)return;if(result.cached)progress.cached++;if(result.warning)progress.failed.push(`${path}：${result.warning}`);
        onSources?.(homebrewMetadata(result.body));
        const body=homebrewBody(result.body);
        onBatch(normalizeData(body,result.revision,'kiwee-homebrew'));
        if(body.magicvariant?.length&&body.baseitem?.length)onBatch(normalizeData({item:specificMagicItems(prepareBody(body))},result.revision,'kiwee-homebrew'));
      }catch(error){if(signal.aborted)return;progress.failed.push(`${path}：${String(error)}`);}
      progress.done++;progress.label=path;onProgress({...progress,failed:[...progress.failed]});
    }}));
    onProgress({...progress,failed:[...progress.failed]});
  }
}
