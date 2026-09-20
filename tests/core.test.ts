import { describe, expect, it } from 'vitest';
import { newCharacter, uid, type Entry, type Character } from '../src/core/model';
import { candidateReason, evaluate, requirementMismatch } from '../src/core/engine';
import { EXAMPLE_PACK, importOwlbear, parseFile, validateCharacter, validatePack } from '../src/core/validation';
import { exportCharacter, exportOwlbear, exportReview, exportRulePack } from '../src/core/export';
import { normalizeData } from '../src/data/catalog';

const entry = (kind: Entry['kind'], raw: Record<string, any> = {}, edition: Entry['edition'] = '2024'): Entry => ({ id: uid(), name: raw.name || '自制测试条目', english: raw.ENG_name || 'Test', kind, edition, source: edition === '2014' ? 'PHB' : 'XPHB', packId: 'test', revision: 'test-1', raw, entries: ['测试内容。'] });
const add = (c: Character, e: Entry, requirementId?: string, level = 1) => { const s = { id: uid(), entry: e, level, quantity: 1, equipped: false, requirementId }; c.selections.push(s); return s; };

describe('independent identity and source constraints', () => {
  it('keeps editions and class-feature context distinct', () => {
    const entries = normalizeData({ spell: [{ name: '同名', ENG_name: 'Same', source: 'PHB' }, { name: '同名', ENG_name: 'Same', source: 'XPHB' }], classFeature: [{ name: '同名', source: 'PHB', className: '甲', level: 1 }, { name: '同名', source: 'PHB', className: '乙', level: 1 }] }, 'fixed');
    expect(new Set(entries.map(e => e.id)).size).toBe(4);
  });
  it('preserves a disabled selection while suspending its effects and restores without granting resources', () => {
    const c = newCharacter(); const e = entry('feat'); e.effects = [{ op: 'add', target: 'int', value: 2 }]; add(c, e);
    c.runtime.resources.uses = { current: 0, max: 2 };
    expect(evaluate(c).abilities.int).toBe(12);
    c.profile.optional.feats = false;
    expect(evaluate(c).abilities.int).toBe(10); expect(c.selections).toHaveLength(1);
    c.profile.optional.feats = true; expect(evaluate(c).abilities.int).toBe(12); expect(c.runtime.resources.uses.current).toBe(0);
    c.profile.enabledSources = []; expect(evaluate(c).abilities.int).toBe(10);
    c.profile.exceptions[e.id] = 'DM 同意'; expect(evaluate(c).abilities.int).toBe(12);
  });
  it('does not apply old race ability bonuses to 2024 legacy characters', () => {
    const c = newCharacter(); c.profile.optional.legacy = true; add(c, entry('race', { ability: [{ str: 2 }] }, '2014'));
    expect(evaluate(c).abilities.str).toBe(10); c.edition = '2014'; expect(evaluate(c).abilities.str).toBe(12);
  });
});

describe('requirements and transitions', () => {
  it('applies speed bonuses independently of race selection order, supports set HP and minimum HP per level', () => {
    const c = newCharacter(); const feat = entry('feat'); feat.effects = [{ op: 'add', target: 'speed', value: 10 }]; add(c, feat); add(c, entry('race', { speed: 25 }));
    expect(evaluate(c).speed).toBe(35);
    c.abilities.con = 1; add(c, entry('class', { hd: { faces: 6 } }), undefined, 10); expect(evaluate(c).maxHp).toBe(10);
    feat.effects.push({ op: 'set', target: 'hp', value: 25 }); expect(evaluate(c).maxHp).toBe(25);
  });
  it('uses namespaced choice IDs and applies selected skill proficiency', () => {
    const pack = validatePack(EXAMPLE_PACK, []); const c = newCharacter(); c.profile.enabledSources.push(pack.id);
    const s = add(c, pack.entries[0]); const id = `${s.id}:custom:knowledge`;
    expect(evaluate(c).requirements.find(r => r.id === id)?.complete).toBe(false);
    c.answers[id] = ['history']; const d = evaluate(c);
    expect(d.requirements.find(r => r.id === id)?.complete).toBe(true); expect(d.skills.history.proficient).toBe(true); expect(d.abilities.int).toBe(11);
  });
  it('rejects duplicated weighted ability choices rather than granting twice', () => {
    const c = newCharacter(); const s = add(c, entry('background', { ability: [{ choose: { weighted: { from: ['int', 'wis'], weights: [2, 1] } } }] }));
    c.answers[`${s.id}:ability:0:0`] = ['int']; c.answers[`${s.id}:ability:0:1`] = ['int'];
    expect(evaluate(c).abilities.int).toBe(12); expect(evaluate(c).issues.some(i => i.message.includes('重复'))).toBe(true);
  });
  it('suspends stale feature effects when the class is removed or downgraded', () => {
    const c = newCharacter(); const cls = add(c, entry('class', { name: '测试法师', hd: { faces: 6 }, classFeatures: ['成长|测试法师|XPHB|4'] }), undefined, 4);
    const feature = entry('feature', { name: '成长', className: '测试法师', classSource: 'XPHB', level: 4 }); feature.effects = [{ op: 'add', target: 'str', value: 2 }];
    add(c, feature, `${cls.id}:feature:成长|测试法师|XPHB|4`);
    expect(evaluate(c).abilities.str).toBe(12); cls.level = 1;
    expect(evaluate(c).abilities.str).toBe(10); expect(evaluate(c).issues.some(i => i.id.startsWith('orphan:'))).toBe(true);
    cls.level = 4; expect(evaluate(c).abilities.str).toBe(12);
  });
  it('matches exact subclass and feature source, including default PHB references', () => {
    const f = entry('feature', { name: '施法', className: '法师', classSource: 'XPHB', level: 1 });
    expect(requirementMismatch(f, { kind: 'feature', refs: ['施法|法师||1'] })).toBeTruthy();
    expect(requirementMismatch(f, { kind: 'feature', refs: ['施法|法师|XPHB|1'] })).toBeUndefined();
    const sub = entry('feature', { name: '学派', className: '法师', classSource: 'XPHB', level: 3, subclassShortName: '学派', subclassSource: 'XPHB' });
    expect(requirementMismatch(sub, { refs: ['学派|法师|XPHB|学派|XPHB|3'] })).toBeUndefined();
  });
  it('filters spells by actual class list and available spell level', () => {
    const spell = entry('spell', { level: 1, _spellClasses: { XPHB: { 法师: true } }, _spellClassLookupLoaded: true });
    expect(requirementMismatch(spell, { spellClass: { name: '法师', source: 'XPHB' }, maxSpellLevel: 1 })).toBeUndefined();
    expect(requirementMismatch(spell, { spellClass: { name: '牧师', source: 'XPHB' } })).toBeTruthy();
    expect(requirementMismatch(spell, { spellLevel: 0 })).toBeTruthy();
  });
  it('merges parent race mechanics and body into a subrace without losing source identity', () => {
    const entries = normalizeData({ race: [{ name: '测试矮人', source: 'PHB', speed: 25, ability: [{ con: 2 }], entries: ['父种族'] }], subrace: [{ name: '山地', source: 'PHB', raceName: '测试矮人', raceSource: 'PHB', ability: [{ str: 2 }], entries: ['亚种族'] }] }, 'fixed');
    const c = newCharacter('2014'); add(c, entries[1]); const d = evaluate(c);
    expect(d.abilities.con).toBe(12); expect(d.abilities.str).toBe(12); expect(d.speed).toBe(25); expect(entries[1].entries).toContain('父种族');
  });
  it('enforces basic feat prerequisites', () => {
    const c = newCharacter(); const feat = entry('feat', { prerequisite: [{ level: 4, ability: [{ str: 13 }] }] });
    expect(candidateReason(c, feat)).toBeTruthy(); add(c, entry('class'), undefined, 4); c.abilities.str = 13; expect(candidateReason(c, feat)).toBeUndefined();
  });
});

describe('safe import and extension contracts', () => {
  it('rejects prototype fields, unknown effects, invalid choices and malformed rule data', () => {
    expect(() => parseFile('{"__proto__":{"polluted":1}}')).toThrow();
    const pack = structuredClone(EXAMPLE_PACK) as any; pack.entries[0].effects[0].op = 'eval'; expect(() => validatePack(pack, [])).toThrow();
    pack.entries[0].effects = []; pack.entries[0].choices[0].count = -1; expect(() => validatePack(pack, [])).toThrow();
    const c = newCharacter(); add(c, entry('race', { size: 123 })); expect(() => validateCharacter(c)).toThrow();
  });
  it('checks exact dependencies, conflict symmetry and cycles before installing', () => {
    const a = validatePack(EXAMPLE_PACK, []);
    const definition = { ...EXAMPLE_PACK, id: 'homebrew.child', requires: [{ id: a.id, version: a.version }] };
    expect(() => validatePack(definition, [])).toThrow(); const b = validatePack(definition, [a]);
    expect(b.entries[0].dependencies).toContain(a.id);
    expect(() => validatePack({ ...EXAMPLE_PACK, requires: [{ id: b.id, version: b.version }] }, [a, b])).toThrow(/循环/);
    expect(() => validatePack({ ...EXAMPLE_PACK, id: 'homebrew.conflict', conflicts: [a.id] }, [a])).toThrow(/冲突/);
    const c = newCharacter(); c.profile.enabledSources = [b.id]; add(c, b.entries[0]); expect(evaluate(c).abilities.int).toBe(10);
  });
  it('keeps selected snapshots stable when a package gets updated', () => {
    const a = validatePack(EXAMPLE_PACK, []); const c = newCharacter(); c.profile.enabledSources.push(a.id); add(c, structuredClone(a.entries[0]));
    const updated = structuredClone(EXAMPLE_PACK); updated.version = '1.1.0'; updated.entries[0].effects[0].value = 5; validatePack(updated, [a]);
    expect(evaluate(c).abilities.int).toBe(11); expect(c.selections[0].entry.revision).toBe('1.0.0');
    expect(validatePack(exportRulePack(a), [])).toEqual(a);
  });
  it('round trips native characters and preserves actual Owlbear schema 0.3 shapes', () => {
    const c = newCharacter(); c.name = '测试冒险者'; c.abilities.dex = 14; c.baseHp = 22; c.runtime.hp = 17; c.runtime.tempHp = 3;
    add(c, entry('class', { hd: { faces: 8 } }), undefined, 3); add(c, entry('feat')); add(c, entry('spell', { level: 0 }));
    const native = validateCharacter(parseFile(JSON.stringify(exportCharacter(c)))); expect(native).toEqual(c);
    const external = exportOwlbear(c, evaluate(c)); expect(external.core_stats.hp).toEqual({ current: 17, max: 22, temp: 3 });
    expect(Array.isArray(external.skills)).toBe(true); expect(external.features.feats).toHaveLength(1); expect(external.spellcasting.cantrips_known).toHaveLength(1);
    const imported = importOwlbear(external); expect(imported.baseHp).toBe(22); expect(imported.runtime.tempHp).toBe(3); expect(evaluate(imported).ac).toBe(evaluate(c).ac); expect(imported.externalSnapshot).toBeDefined();
  });
  it('exports a self-contained escaped review with failures and human rulings visible', () => {
    const c = newCharacter(); c.name = '<script>alert(1)</script>'; c.adjustments = [{ id: 'manual', target: 'ac', value: 17, reason: 'DM 裁定' }];
    const review = exportReview(c, evaluate(c)); expect(review).not.toContain('<script>'); expect(review).toContain('&lt;script&gt;'); expect(review).toContain('DM 裁定'); expect(review).toContain('选择职业');
  });
});
