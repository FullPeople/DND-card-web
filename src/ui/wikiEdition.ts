import { editionAllows, type Character, type Edition, type Entry } from '../core/model';

/** Wiki browsing follows the printed core handbook for subclasses, even when
 * that subclass has a compatible adaptation for the other parent class. Keep
 * the model's parent-based edition semantics for character rules unchanged. */
export function wikiEditionAllows(entry: Entry, character: Character, filter = 'character'): boolean {
  if (filter === 'all') return true;
  const edition = (filter === 'character' ? character.edition : filter) as Edition;
  if (entry.kind === 'subclass') {
    const source = entry.source.toUpperCase();
    if (source === 'PHB') return edition === '2014';
    if (source === 'XPHB') return edition === '2024';
  }
  return editionAllows(entry, edition, filter === 'character' && character.profile.optional.legacy);
}
