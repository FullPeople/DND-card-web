import { describe, expect, it } from 'vitest';
import { editionAllows, entryEdition, newCharacter, selectionAllowed, type Entry } from '../src/core/model';
import { normalizeData } from '../src/data/catalog';
import { wikiEditionAllows } from '../src/ui/wikiEdition';
import { librarySourceEnabled } from '../src/ui/libraryData';

function subclass(source: string, classSource: string, edition?: string): Entry {
  return normalizeData({ subclass: [{ name: 'Edition fixture', source, classSource, className: 'Fixture class', edition }] }, 'test')[0];
}

describe('Wiki-only core subclass editions', () => {
  it.each(['PHB', 'XPHB'])('uses %s publication, independent of either parent adaptation', source => {
    for (const parent of ['PHB', 'XPHB']) {
      const entry = subclass(source, parent);
      for (const edition of ['2014', '2024'] as const) {
        const character = newCharacter(edition);
        for (const legacy of [false, true]) {
          character.profile.optional.legacy = legacy;
          expect(wikiEditionAllows(entry, character)).toBe(source === (edition === '2014' ? 'PHB' : 'XPHB'));
          expect(wikiEditionAllows(entry, character, edition)).toBe(source === (edition === '2014' ? 'PHB' : 'XPHB'));
          expect(wikiEditionAllows(entry, character, 'all')).toBe(true);
        }
      }
    }
  });

  it('does not change model compatibility, existing selections or character resources', () => {
    const character = newCharacter();
    const entry = subclass('PHB', 'XPHB');
    const before = structuredClone(character);
    expect(entryEdition(entry)).toBe('2024');
    expect(editionAllows(entry, '2024')).toBe(true);
    expect(selectionAllowed(character, entry)).toBe(true);
    expect(wikiEditionAllows(entry, character)).toBe(false);
    expect(character).toEqual(before);
  });

  it('preserves expansion, third-party, ambiguous and custom edition semantics', () => {
    const entries = [
      subclass('XGE', 'XPHB'), subclass('THIRD', 'XPHB'), subclass('THIRD', 'PHB'),
      subclass('CUSTOM', 'THIRD', 'one'), subclass('THIRD', 'UNKNOWN'),
      ...normalizeData({ spell: [{ name: 'Old spell', source: 'PHB' }], feat: [{ name: 'Custom feat', source: 'CUSTOM' }] }, 'test'),
    ];
    for (const entry of entries) for (const edition of ['2014', '2024'] as const) {
      const character = newCharacter(edition);
      for (const legacy of [false, true]) {
        character.profile.optional.legacy = legacy;
        expect(wikiEditionAllows(entry, character)).toBe(editionAllows(entry, edition, legacy));
        expect(wikiEditionAllows(entry, character, edition)).toBe(editionAllows(entry, edition));
        expect(wikiEditionAllows(entry, character, 'all')).toBe(true);
      }
    }
  });

  it('keeps source visibility separate from edition and per-entry restriction', () => {
    const character = newCharacter();
    const entry = subclass('PHB', 'XPHB');
    character.profile.enabledSources = ['XPHB'];
    character.profile.exceptions[entry.id] = 'Existing character exception';
    expect(wikiEditionAllows(entry, character, 'all')).toBe(true);
    expect(librarySourceEnabled(character, entry)).toBe(false);
    character.profile.enabledSources.push('PHB');
    character.profile.disabledEntries = [entry.id];
    expect(librarySourceEnabled(character, entry)).toBe(true);
    expect(wikiEditionAllows(entry, character, '2014')).toBe(true);
    expect(wikiEditionAllows(entry, character, '2024')).toBe(false);
  });
});
