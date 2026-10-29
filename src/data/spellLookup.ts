import type {Entry,Raw} from '../core/model';
/** One per-spell lookup row, identically applied to primary and homebrew library
 * entries. This returns a new catalog view, never refreshes a saved selection. */
export function hydrateSpellLookup(entry:Entry,spellLookup:Raw,lookupRevision:string):Entry{
 if(entry.kind!=='spell')return entry;
 const row=spellLookup[entry.source.toLowerCase()]?.[entry.name.toLowerCase()]||spellLookup[entry.source.toLowerCase()]?.[entry.english.toLowerCase()];
 return {...entry,raw:{...entry.raw,_spellClasses:row?.class,_spellSources:row,_spellClassLookupLoaded:!!row},revision:entry.revision+`|lists:${lookupRevision||'unavailable'}`};
}
