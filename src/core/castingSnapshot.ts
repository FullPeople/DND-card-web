import {editionAllows,type Character,type Entry} from './model';

const keys=['casterProgression','spellcastingAbility','preparedSpells','preparedSpellsProgression','preparedSpellsChange','spellsKnownProgression','spellsKnownProgressionFixed','classTableGroups','subclassTableGroups'] as const;
/** Recover missing casting declarations from a unique, same-edition source.
 * Only legacy imports qualify. Custom rules and existing snapshots win. */
export function hydrateImportedCasting(c:Character,entries:Entry[]):boolean{
 let changed=false;
 for(const s of c.selections){
  if(s.entry.kind!=='class'||s.entry.packId!=='imported'||s.entry.source!=='IMPORTED'||s.entry.raw._castingSource)continue;
  const names=[s.entry.name,s.entry.english].map(n=>n.trim().toLocaleLowerCase());
  const matches=entries.filter(e=>e.kind==='class'&&!e.raw._custom&&editionAllows(e,c.edition)&&[e.name,e.english].some(n=>names.includes(n.trim().toLocaleLowerCase())));
  const core=matches.filter(e=>e.source===(c.edition==='2014'?'PHB':'XPHB')),candidates=core.length?core:matches;
  if(candidates.length!==1)continue;
  const source=candidates[0];if(!keys.some(key=>source.raw[key]!==undefined))continue;
  for(const key of keys)if(s.entry.raw[key]===undefined&&source.raw[key]!==undefined)s.entry.raw[key]=structuredClone(source.raw[key]);
  s.entry.raw._castingSource={id:source.id,source:source.source,revision:source.revision};changed=true;
  // Legacy import used the number currently prepared as the total capacity.
  // Once a rule formula is available, that count is not a manual adjustment.
  if(c.spellSettings&&!c.spellSettings.modeOverride&&c.spellSettings.capacityAdjustment===undefined)c.spellSettings.capacityAdjustment=0;
 }
 return changed;
}
