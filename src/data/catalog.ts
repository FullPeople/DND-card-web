import type {SourceMeta} from '../core/sourceCatalog';
import {catalogNormalizer,type CatalogOperation} from './catalogNormalizer';
import {correctSourceData} from '../core/sourceCorrections';
import {catalogTransport,CatalogPausedError} from './catalogTransport';
import {EQUIPMENT_TRAINING_ENTRIES} from './weaponTraining';
import type { Entry, Kind, Raw } from '../core/model';
import { readCache, writeCache } from '../platform/storage';
import { prepareBody, specificMagicItems, expandVersions, expandCopies } from './expand';
import { inheritSubrace, readableEntries } from './adapt';
import {DEFAULT_HOMEBREW,homebrewPaths,homebrewMetadata,homebrewBody} from './homebrew';
import {DEFAULT_SOURCE} from './catalogSource';
export {DEFAULT_SOURCE} from './catalogSource';
export interface LoadProgress { done: number; total: number; label: string; failed: string[]; cached: number; retry?:string[]; paused?:string }
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
      for (const snapshot of [inherited, ...expandVersions(inherited)]) {
      const raw=correctSourceData(snapshot);
      if(['subclass','classFeature','subclassFeature'].includes(key)){
        const parent=body.class?.find((c:Raw)=>c.source===raw.classSource&&[c.name,c.ENG_name].includes(raw.className));
        const parentEdition=parent?.edition==='one'?'2024':parent?.edition==='classic'?'2014':undefined;
        if(parentEdition)raw._classEdition=parentEdition;
      }
      const source = String(raw.source || raw.classSource || 'CUSTOM').toUpperCase();
      const edition = raw.edition === 'one' || ['XPHB', 'XDMG', 'XMM'].includes(source) ? '2024' : raw.edition === 'classic' || ['PHB', 'DMG', 'MM'].includes(source) ? '2014' : 'both';
      result.push({ id: entryIdentity(kind, { ...raw, source, _category: key }, packId), kind, name: raw.name, english: raw.ENG_name || raw.name, source, edition,
        packId, revision, page: raw.page, entries: readableEntries(raw, key), raw: { ...raw, _category: key } });
      }
    }
  }
  return result;
}
export {resolveEntryReference as resolveReference} from '../core/entryReferences';
export function normalizeCatalogData(body:Raw,revision:string,packId='kiwee',operation:CatalogOperation='normalize'):Entry[]{
 if(operation==='monsters'){
  const groups=expandCopies(body.legendaryGroup||[]),templates=expandCopies(body.monsterTemplate||[]);
  const expanded=expandCopies(body.monster||[],templates).map(raw=>{const group=raw.legendaryGroup&&groups.find(g=>[g.name,g.ENG_name].includes(raw.legendaryGroup.name)&&g.source===raw.legendaryGroup.source);return group?{...raw,_legendaryGroup:group}:raw;});
  return normalizeData({monster:expanded},revision,packId);
 }
 if(operation==='magicItems')return normalizeData({item:specificMagicItems(prepareBody(body))},revision,packId);
 return normalizeData(body,revision,packId);
}
async function fetchJson(base: string, path: string, signal: AbortSignal, refresh: boolean,transport:ReturnType<typeof catalogTransport>,retry:ReadonlySet<string>): Promise<{ body: Raw; revision: string; cached: boolean; warning?: string }> {
  const key = `${base}/${path}`;
  // Wiki caching is optional. A denied/full cache must not discard a valid network response.
  const cached = await readCache(key).catch(()=>undefined);
  const valid=(body:Raw)=>!path.endsWith('/index.json')||Object.values(body).some(v=>typeof v==='string'&&v.endsWith('.json'));
  const prior=cached&&valid(cached.body)?cached:undefined;
  if (!refresh && !retry.has(key) && prior) return { ...prior, cached: true };
  try {
    const {body,etag}=await transport.json(key);
    if(signal.aborted)throw signal.reason;
    if(!valid(body))throw Error('资料索引为空，请重试');
    const revision = etag || await hashJson(body);
    const result={body,revision,cached:false};
    try{await writeCache(key,result);}catch{return {...result,warning:'资料已加载，但浏览器未能保存资料缓存。'};}
    return result;
  } catch (error) {
    if (signal.aborted || error instanceof CatalogPausedError) throw error;
    if (prior) return { ...prior, cached: true, warning: `更新失败，正在使用旧缓存：${String(error)}` };
    throw error;
  }
}
export async function hashJson(body: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function loadCatalog(onBatch: (entries: Entry[]) => void, onProgress: (p: LoadProgress) => void, signal: AbortSignal, refresh = false, base = DEFAULT_SOURCE, onSources?: (names: Record<string, SourceMeta>) => void,retryKeys:readonly string[]=[]): Promise<void> {
  const url = new URL(base); if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('资料源需要 HTTPS 地址');
  base = base.replace(/\/$/, '');
  const normalizer=catalogNormalizer(signal,normalizeCatalogData);
  const transport=catalogTransport(signal),retry=new Set(retryKeys);
  const read=(path:string,source=base)=>fetchJson(source,path,signal,refresh,transport,retry);
  try {
  onBatch(EQUIPMENT_TRAINING_ENTRIES);
  const paths = ['data/bestiary/template.json','data/bestiary/legendarygroups.json','data/generated/gendata-variantrules.json', 'data/magicvariants.json', 'data/charcreationoptions.json', 'data/rewards.json', 'data/psionics.json', 'data/deities.json', 'data/cultsboons.json', 'data/bastions.json', 'data/tables.json', 'data/generated/gendata-tables.json', 'data/races.json', 'data/backgrounds.json', 'data/feats.json', 'data/items-base.json', 'data/items.json', 'data/optionalfeatures.json', 'data/conditionsdiseases.json', 'data/books.json', 'data/adventures.json', 'data/variantrules.json', 'data/actions.json', 'data/skills.json', 'data/senses.json', 'data/languages.json'];
  const progress: LoadProgress = { done: 0, total: paths.length + 4, label: '读取资料索引', failed: [], cached: 0,retry:[] };
  const publish=()=>onProgress({...progress,failed:[...progress.failed],retry:[...progress.retry!]});
  const failed=(path:string,label:string,error:unknown,source=base)=>{
    if(error instanceof CatalogPausedError)return;
    progress.failed.push(`${label}：${String(error)}`);progress.retry!.push(`${source}/${path}`);
  };
  const paused=()=>{if(!transport.paused)return false;progress.paused=transport.paused.message;publish();return true;};
  publish();
  let spellLookup: Raw = {}; let lookupRevision = '';
  try {
    const lookup = await read('data/generated/gendata-spell-source-lookup.json');
    spellLookup = lookup.body; lookupRevision = lookup.revision; if (lookup.cached) progress.cached++;
    if (lookup.warning) failed('data/generated/gendata-spell-source-lookup.json','法术职业索引',lookup.warning);
  } catch (error) { if (signal.aborted) return; failed('data/generated/gendata-spell-source-lookup.json','法术职业索引',error); }
  progress.done++;publish();
  if(paused())return;
  for (const category of ['class', 'spells', 'bestiary']) {
    try {
      const { body, cached, warning } = await read(`data/${category}/index.json`);
      if (warning) failed(`data/${category}/index.json`,`${category} 索引`,warning);
      if (cached) progress.cached++;
      for (const value of Object.values(body)) if (typeof value === 'string' && /^[\w.-]+\.json$/.test(value)) paths.push(`data/${category}/${value}`);
    } catch (error) { if (signal.aborted) return; failed(`data/${category}/index.json`,`${category} 索引`,error); }
    progress.done++; progress.total = paths.length + 4; publish();
    if(paused())return;
  }
  for(const file of ['spells-phb.json','spells-xphb.json']){const path=`data/spells/${file}`;if(!paths.includes(path))paths.push(path);}
  progress.total=paths.length+4;
  // Core rulebooks first; remaining books arrive incrementally.
  paths.sort((a, b) => Number(!/(phb|wizard|fighter|races|backgrounds|feats)/.test(a)) - Number(!/(phb|wizard|fighter|races|backgrounds|feats)/.test(b)));
  const monsters: Raw[]=[],monsterRevisions:string[]=[];let monsterTemplates:Raw[]=[],legendaryGroups:Raw[]=[];
  const equipment: Raw = {}; const equipmentRevisions: string[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < paths.length && !signal.aborted && !transport.paused) {
      const path = paths[cursor++];
      try {
        const result = await read(path);
        if (signal.aborted) return;
        if (result.cached) progress.cached++;
        if (result.warning) failed(path,path,result.warning);
        if (['data/books.json','data/adventures.json'].includes(path)) onSources?.(Object.fromEntries((result.body.book || result.body.adventure || []).map((book: Raw) => [String(book.source || book.id).toUpperCase(), {name:book.name,date:book.published,category:path==='data/adventures.json'?'模组内容':'核心规则'}])));
        if (['data/items-base.json', 'data/items.json', 'data/magicvariants.json'].includes(path)) { Object.assign(equipment, result.body); equipmentRevisions.push(`${path}:${result.revision}`); }
        if(result.body.monster)monsters.push(...result.body.monster);
        if(result.body.monster||result.body.monsterTemplate||result.body.legendaryGroup)monsterRevisions.push(`${path}:${result.revision}`);
        if(result.body.monsterTemplate)monsterTemplates=result.body.monsterTemplate;
        if(result.body.legendaryGroup)legendaryGroups=result.body.legendaryGroup;
        const normalized = await normalizer.normalize(result.body, result.revision);
        for (const entry of normalized) if (entry.kind === 'spell') {
          const lookup = spellLookup[entry.source.toLowerCase()]?.[entry.name.toLowerCase()] || spellLookup[entry.source.toLowerCase()]?.[entry.english.toLowerCase()];
          entry.raw._spellClasses = lookup?.class;
          entry.raw._spellSources = lookup;
          entry.raw._spellClassLookupLoaded = !!lookup;
          entry.revision += `|lists:${lookupRevision || 'unavailable'}`;
        }
        onBatch(normalized);
      } catch (error) { if (signal.aborted || error instanceof CatalogPausedError) return; failed(path,path,error); }
      progress.done++; progress.label = path.replace('data/', ''); publish();
    }
  }));
  if(!signal.aborted && monsters.length){
    onBatch(await normalizer.normalize({monster:monsters,monsterTemplate:monsterTemplates,legendaryGroup:legendaryGroups},await hashJson(monsterRevisions.sort()),'kiwee','monsters'));
  }
  if (!signal.aborted && Object.keys(equipment).length) {
    const revision = equipmentRevisions.sort().join('|');
    onBatch(await normalizer.normalize(equipment, revision));
    onBatch(await normalizer.normalize(equipment,revision,'kiwee','magicItems'));
  }
  // The mirror keeps third-party books in a separate repository, outside data/*.
  // Load its generated index rather than maintaining a list of book titles here.
  if(!signal.aborted&&!transport.paused&&base===DEFAULT_SOURCE){
    let brewFiles:string[]=[];
    progress.total++;
    try{const index=await read('_generated/index-sources.json',DEFAULT_HOMEBREW);brewFiles=homebrewPaths(index.body);if(index.cached)progress.cached++;if(index.warning)failed('_generated/index-sources.json','三方索引',index.warning,DEFAULT_HOMEBREW);}
    catch(error){if(signal.aborted)return;failed('_generated/index-sources.json','三方资料索引',error,DEFAULT_HOMEBREW);}
    progress.done++;
    progress.total+=brewFiles.length;let brewCursor=0;
    await Promise.all(Array.from({length:3},async()=>{while(brewCursor<brewFiles.length&&!signal.aborted&&!transport.paused){
      const path=brewFiles[brewCursor++];
      try{
        const encodedPath=path.split('/').map(encodeURIComponent).join('/');
        const result=await read(encodedPath,DEFAULT_HOMEBREW);
        if(signal.aborted)return;if(result.cached)progress.cached++;if(result.warning)failed(encodedPath,path,result.warning,DEFAULT_HOMEBREW);
        onSources?.(homebrewMetadata(result.body));
        const body=homebrewBody(result.body);
        onBatch(await normalizer.normalize(body,result.revision,'kiwee-homebrew'));
        if(body.magicvariant?.length&&body.baseitem?.length)onBatch(await normalizer.normalize(body,result.revision,'kiwee-homebrew','magicItems'));
      }catch(error){if(signal.aborted || error instanceof CatalogPausedError)return;failed(path.split('/').map(encodeURIComponent).join('/'),path,error,DEFAULT_HOMEBREW);}
      progress.done++;progress.label=path;publish();
    }}));
    publish();
  }
  if(!signal.aborted)paused();
  } finally {normalizer.dispose();}
}
