import { describe, expect, it } from 'vitest';
import { newCharacter, uid, type Entry, type Character } from '../src/core/model';
import { syncFeatures, removeSelection } from '../src/core/sheet';
import { candidateReason, evaluate, requirementMismatch } from '../src/core/engine';
import { EXAMPLE_PACK, importOwlbear, parseFile, validateCharacter, validatePack } from '../src/core/validation';
import { exportCharacter, exportOwlbear, exportReview, exportRulePack } from '../src/core/export';
import { expandCopies, prepareBody, specificMagicItems } from '../src/data/expand';
import { normalizeData } from '../src/data/catalog';
import { compactLevelRows, tableSpans } from '../src/ui/tableSpans';

it('compacts consecutive level rows without losing changed values or changing non-level tables', () => {
  const rows = [[1, 2, 0], [2, 2, 0], [3, 2, 0], [4, 3, 0], [6, 3, 0]];
  expect(compactLevelRows(rows, ['等级', '回气', '固定值'])).toEqual([['1～3', 2, 0], [4, 3, 0], [6, 3, 0]]);
  expect(rows[0][0]).toBe(1);
  expect(compactLevelRows(rows, ['d6', '结果', '值'])).toBe(rows);
  expect(compactLevelRows([['1', 'a'], ['2', 'a'], ['3', 'b'], ['4', 'a']], ['Level', 'Feature'])).toEqual([['1～2', 'a'], ['3', 'b'], ['4', 'a']]);
  expect(compactLevelRows([[1, { entry: 'a', rowSpan: 2 }], [2, 'a']], ['等级', '特性'])).toEqual([[1, { entry: 'a', rowSpan: 2 }], [2, 'a']]);
  expect(compactLevelRows([[1, 'a'], [2]], ['等级', '特性'])).toEqual([[1, 'a'], [2]]);
});

it('sheet bonuses follow recalculation and survive backup validation without becoming absolute overrides', () => {
  const c = newCharacter(); const cls = add(c, entry('class', { hd: { faces: 6 }, proficiency: ['int'] }));
  c.abilities.dex = 14; c.proficiencies = { perception: true };
  c.sheetBonuses = { proficiency: 1, initiative: 4, speed: 5, passive: 2, hp: 3 }; c.size = 'L';
  const first = evaluate(c);
  expect([first.proficiency, first.initiative, first.speed, first.passive, first.maxHp]).toEqual([3, 6, 35, 15, 9]);
  cls.level = 5; const leveled = evaluate(c);
  expect(leveled.proficiency).toBe(4); expect(leveled.skills.perception.value).toBe(4); expect(leveled.saves.int.value).toBe(4); expect(leveled.passive).toBe(16); expect(leveled.maxHp).toBe(25);
  const restored = validateCharacter(exportCharacter(c)); expect(restored.size).toBe('L'); expect(evaluate(restored)).toEqual(leveled);
  expect(() => validateCharacter({ ...c, sheetBonuses: { hp: Infinity } })).toThrow();
  expect(() => validateCharacter({ ...c, sheetBonuses: { unknown: 1 } })).toThrow();
  expect(() => validateCharacter({ ...c, size: 'XXL' })).toThrow();
});

it('tables merge adjacent identical cells without merging separated groups or different references', () => {
  expect(tableSpans([[1, 2], [2, 2], [3, 2], [4, 3], [5, 2]])).toEqual([[1, 3], [1, 0], [1, 0], [1, 1], [1, 1]]);
  expect(tableSpans([[1, { roll: { exact: 2 }, type: 'cell' }], [2, { type: 'cell', roll: { exact: 2 } }]])).toEqual([[1, 2], [1, 0]]);
  expect(tableSpans([[1, '{@spell 同名|PHB}'], [2, '{@spell 同名|XPHB}']])).toEqual([[1, 1], [1, 1]]);
  expect(tableSpans([[1, ''], [2, '']])).toEqual([[1, 1], [1, 1]]);
  expect(tableSpans([[1, 2], [2]])).toEqual([[1, 1], [1]]);
});

const entry = (kind: Entry['kind'], raw: Record<string, any> = {}, edition: Entry['edition'] = '2024'): Entry => ({ id: uid(), name: raw.name || '自制测试条目', english: raw.ENG_name || 'Test', kind, edition, source: edition === '2014' ? 'PHB' : 'XPHB', packId: 'test', revision: 'test-1', raw, entries: ['测试内容。'] });
const add = (c: Character, e: Entry, requirementId?: string, level = 1) => { const s = { id: uid(), entry: e, level, quantity: 1, equipped: false, requirementId }; c.selections.push(s); return s; };

it('preserves optional quickbar references in backups and rejects malformed pin lists', () => {
  const c = newCharacter(); const s = add(c, entry('item')); c.quickbar = [s.id];
  expect(validateCharacter(exportCharacter(c)).quickbar).toEqual([s.id]);
  const old = newCharacter(); expect(validateCharacter(old).quickbar).toBeUndefined();
  expect(() => validateCharacter({ ...c, quickbar: [s.id, s.id] })).toThrow('快捷栏');
  expect(() => validateCharacter({ ...c, quickbar: [{ id: s.id }] })).toThrow('快捷栏');
});

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
  it('keeps ability declarations readable without silently changing player-entered scores', () => {
    const c = newCharacter(); c.profile.optional.legacy = true; add(c, entry('race', { ability: [{ str: 2 }] }, '2014'));
    expect(evaluate(c).abilities.str).toBe(10); c.edition = '2014'; expect(evaluate(c).abilities.str).toBe(10); c.abilities.str = 12; expect(evaluate(c).abilities.str).toBe(12);
  });
});

describe('requirements and transitions', () => {
  it('applies speed bonuses independently of race selection order, supports set HP and minimum HP per level', () => {
    const c = newCharacter(); const feat = entry('feat'); feat.effects = [{ op: 'add', target: 'speed', value: 10 }]; add(c, feat); add(c, entry('race', { speed: 25 }));
    expect(evaluate(c).speed).toBe(35);
    c.abilities.con = 1; add(c, entry('class', { hd: { faces: 6 } }), undefined, 10); expect(evaluate(c).maxHp).toBe(10);
    feat.effects.push({ op: 'set', target: 'hp', value: 25 }); expect(evaluate(c).maxHp).toBe(25);
  });
  it('retains legacy skill answers without generating quotas, and accepts manual overrides', () => {
    const pack = validatePack(EXAMPLE_PACK, []); const c = newCharacter(); c.profile.enabledSources.push(pack.id);
    const s = add(c, pack.entries[0]); const id = `${s.id}:custom:knowledge`;
    expect(evaluate(c).requirements).toEqual([]);
    c.answers[id] = ['history']; const d = evaluate(c);
    expect(d.requirements).toEqual([]); expect(d.skills.history.proficient).toBe(true); expect(d.abilities.int).toBe(11);
  });
  it('does not interpret weighted ability choices or produce choice errors', () => {
    const c = newCharacter(); const s = add(c, entry('background', { ability: [{ choose: { weighted: { from: ['int', 'wis'], weights: [2, 1] } } }] }));
    c.answers[`${s.id}:ability:0:0`] = ['int']; c.answers[`${s.id}:ability:0:1`] = ['int'];
    expect(evaluate(c).abilities.int).toBe(10); expect(evaluate(c).requirements).toEqual([]); expect(evaluate(c).issues).toEqual([]);
  });
  it('reconciles declared level features and removes their effects when the parent is downgraded', () => {
    const c = newCharacter(); const cls = add(c, entry('class', { name: '测试法师', hd: { faces: 6 }, classFeatures: ['成长|测试法师|XPHB|4'] }), undefined, 4);
    const feature = entry('feature', { name: '成长', className: '测试法师', classSource: 'XPHB', level: 4 }); feature.effects = [{ op: 'add', target: 'str', value: 2 }];
    add(c, feature, `${cls.id}:feature:成长|测试法师|XPHB|4`);
    syncFeatures(c, [feature]); expect(evaluate(c).abilities.str).toBe(12); cls.level = 1; syncFeatures(c, [feature]);
    expect(evaluate(c).abilities.str).toBe(10); expect(c.selections).toHaveLength(1);
    cls.level = 4; syncFeatures(c, [feature]); expect(evaluate(c).abilities.str).toBe(12);
  });
  it('matches exact subclass and feature source, including default PHB references', () => {
    const f = entry('feature', { name: '施法', className: '法师', classSource: 'XPHB', level: 1 });
    expect(requirementMismatch(f, { kind: 'feature', refs: ['施法|法师||1'] })).toBeTruthy();
    expect(requirementMismatch(f, { kind: 'feature', refs: ['施法|法师|XPHB|1'] })).toBeUndefined();
    const sub = entry('feature', { name: '学派', className: '法师', classSource: 'XPHB', level: 3, subclassShortName: '学派', subclassSource: 'XPHB' });
    expect(requirementMismatch(sub, { refs: ['学派|法师|XPHB|学派|XPHB|3'] })).toBeUndefined();
  });
  it('does not constrain manual spell choices by class list or available slots', () => {
    const spell = entry('spell', { level: 1, _spellClasses: { XPHB: { 法师: true } }, _spellClassLookupLoaded: true });
    expect(requirementMismatch(spell, { spellClass: { name: '法师', source: 'XPHB' }, maxSpellLevel: 1 })).toBeUndefined();
    expect(requirementMismatch(spell, { spellClass: { name: '牧师', source: 'XPHB' } })).toBeUndefined();
    expect(requirementMismatch(spell, { spellLevel: 0 })).toBeUndefined();
  });
  it('merges parent race mechanics and body into a subrace without losing source identity', () => {
    const entries = normalizeData({ race: [{ name: '测试矮人', source: 'PHB', speed: 25, ability: [{ con: 2 }], entries: ['父种族'] }], subrace: [{ name: '山地', source: 'PHB', raceName: '测试矮人', raceSource: 'PHB', ability: [{ str: 2 }], entries: ['亚种族'] }] }, 'fixed');
    const c = newCharacter('2014'); add(c, entries[1]); const d = evaluate(c);
    expect(entries[1].raw.ability).toEqual([{ con: 2, str: 2 }]); expect(d.abilities.con).toBe(10); expect(d.abilities.str).toBe(10); expect(d.speed).toBe(25); expect(entries[1].entries).toContain('父种族');
  });
  it('leaves feat prerequisites for the player and DM to check', () => {
    const c = newCharacter(); const feat = entry('feat', { prerequisite: [{ level: 4, ability: [{ str: 13 }] }] });
    expect(candidateReason(c, feat)).toBeUndefined(); add(c, entry('class'), undefined, 4); c.abilities.str = 13; expect(candidateReason(c, feat)).toBeUndefined();
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
  it('round trips optional feature presentation without granting or losing selections', () => {
    const c = newCharacter(); add(c, entry('feature'));
    const original = structuredClone(c.selections);
    expect(validateCharacter(c).featureLayout).toBeUndefined();
    c.featureLayout = { order: [c.selections[0].id, 'race:trait:0'], expanded: [c.selections[0].id] };
    const restored = validateCharacter(parseFile(JSON.stringify(exportCharacter(c))));
    expect(restored.featureLayout).toEqual(c.featureLayout); expect(restored.selections).toEqual(original);
    expect(() => validateCharacter({ ...c, featureLayout: { order: ['same', 'same'], expanded: [] } })).toThrow(/特性显示/);
    expect(() => validateCharacter({ ...c, featureLayout: { order: [], expanded: [12] } })).toThrow(/特性显示/);
  });
  it('exports a self-contained escaped review with failures and human rulings visible', () => {
    const c = newCharacter(); c.name = '<script>alert(1)</script>'; c.adjustments = [{ id: 'manual', target: 'ac', value: 17, reason: 'DM 裁定' }];
    const review = exportReview(c, evaluate(c)); expect(review).not.toContain('<script>'); expect(review).toContain('&lt;script&gt;'); expect(review).toContain('DM 裁定'); expect(review).toContain('由玩家手动记录');
  });
});


describe('manual sheet content ownership', () => {
  it('attaches referenced and inline content once, remembers removals and survives export/import', () => {
    const c = newCharacter(); const cls = add(c, entry('class', { name: '法师', classFeatures: ['施法|法师|XPHB|1'] }));
    const f = entry('feature', { name: '施法', className: '法师', classSource: 'XPHB', level: 1 });
    const race = entry('race'); race.entries = [{ type: 'entries', name: '感官', entries: ['自制测试'] }]; const owner = add(c, race);
    expect(syncFeatures(c, [f])).toBe(true); expect(syncFeatures(c, [f])).toBe(false);
    expect(c.selections.filter(s => s.parentId === cls.id)).toHaveLength(1);
    const trait = c.selections.find(s => s.parentId === owner.id)!;
    removeSelection(c, trait.id); syncFeatures(c, [f]); expect(c.selections.some(s => s.id === trait.id)).toBe(false);
    const restored = validateCharacter(exportCharacter(c)); syncFeatures(restored, [f]); expect(restored.dismissedFeatures).toEqual(c.dismissedFeatures);
    removeSelection(restored, cls.id); expect(restored.selections.map(s => s.id)).toEqual([owner.id]);
  });
  it('resolves late-arriving data and fixed granted feats without choosing among alternatives', () => {
    const c = newCharacter(); const bg = add(c, entry('background', { feats: [{ '旅行笔记|XPHB': true }, { any: 1 }] }));
    expect(syncFeatures(c, [])).toBe(false); const feat = entry('feat', { name: '旅行笔记' });
    syncFeatures(c, [feat]); expect(c.selections.filter(s => s.parentId === bg.id).map(s => s.entry.name)).toEqual(['旅行笔记']);
    expect(evaluate(c).requirements).toEqual([]);
    bg.entry.raw.feats = [{ '旅行笔记；自选流派|XPHB': true }]; syncFeatures(c, [feat]);
    expect(c.selections.filter(s => s.parentId === bg.id).map(s => s.entry.name)).toEqual(['旅行笔记；自选流派']);
  });
  it('allows unrestricted manual proficiency, overrides fixed grants and validates persisted controls', () => {
    const c = newCharacter(); add(c, entry('background', { skillProficiencies: [{ history: true }] }));
    c.proficiencies = { history: false, arcana: true, nature: true, religion: true, 'save:str': true };
    c.training = { tools: '自定义工具' };
    const restored = validateCharacter(exportCharacter(c)), d = evaluate(restored);
    expect(d.skills.history.proficient).toBe(false); expect(d.skills.arcana.proficient).toBe(true); expect(d.saves.str.proficient).toBe(true);
    expect(restored.training?.tools).toBe('自定义工具'); expect(() => validateCharacter({ ...c, proficiencies: { invalid: true } })).toThrow('熟练记录');
  });
});


it('manual expertise and jack of all trades recalculate, remain exclusive and survive backup validation', () => {
  const c = newCharacter('2024'); add(c, entry('class')); c.abilities.dex = 14;
  c.jackOfAllTrades = true; c.proficiencies = { perception: true }; c.expertise = { perception: true };
  let d = evaluate(c); expect(d.skills.perception.value).toBe(4); expect(d.skills.arcana.value).toBe(1); expect(d.initiative).toBe(2);
  c.edition = '2014'; c.profile.optional.legacy = true; d = evaluate(c); expect(d.initiative).toBe(3);
  c.sheetBonuses = { proficiency: 1 }; expect(evaluate(c).skills.perception.value).toBe(6); expect(evaluate(c).skills.arcana.value).toBe(1);
  expect(validateCharacter(exportCharacter(c)).expertise).toEqual({ perception: true });
  expect(() => validateCharacter({ ...c, expertise: { invalid: true } })).toThrow();
});

it('source normalization retains omitted categories, extra prose, contextual identities and race versions', () => {
  const body = { status: [{ name: '状态甲', source: 'XPHB', entries: ['状态正文'] }], itemMastery: [{ name: '精通甲', source: 'XPHB', entries: ['精通正文'] }], itemProperty: [{ abbreviation: 'A', source: 'XPHB', entries: [{name: '属性甲', entries: ['属性正文']}]}], baseitem: [{ name: '工具甲', source: 'XPHB', additionalEntries: ['工具扩展说明'] }], itemGroup: [{ name:'工具组',source:'XPHB',items:['工具甲|XPHB']}], deity: [{ name:'神祇',source:'PHB',pantheon:'甲'}, {name:'神祇',source:'PHB',pantheon:'乙'}], race: [{name:'种族甲',source:'PHB',entries:[{name:'特性',entries:['原版']}],_versions:[{name:'种族变体',source:'PHB',_mod:{entries:{mode:'replaceArr',replace:'特性',items:{name:'特性',entries:['变体']}}}}]}] };
  const rows = normalizeData(body, 'test'); expect(rows.find(e=>e.name==='工具甲')?.entries).toContain('工具扩展说明'); expect(rows.find(e=>e.name==='种族变体')?.entries).toEqual([{name:'特性',entries:['变体']}]);
  expect(rows.filter(e=>e.name==='神祇')).toHaveLength(2); expect(new Set(rows.map(e=>e.id)).size).toBe(rows.length);
  expect(rows.find(e=>e.name==='属性甲')?.raw._category).toBe('itemProperty'); expect(rows.find(e=>e.name==='状态甲')?.kind).toBe('condition');
});

it('copy inheritance and magic templates produce distinct concrete items without altering source objects', () => {
  const body = { baseitem: [{name:'剑',ENG_name:'Sword',source:'PHB',type:'M',weight:2,value:100,entries:['基础正文']}], item:[{name:'复制剑',source:'DMG',_copy:{name:'剑',source:'PHB',_mod:{entries:{mode:'appendArr',items:'新增正文'}}}}], magicvariant:[{name:'+1武器',ENG_name:'+1 Weapon',edition:'classic',requires:[{type:'M'}],inherits:{source:'DMG',namePrefix:'+1 ',bonusWeapon:'+1',entries:['加值{=bonusWeapon}。']}}] };
  const prepared = prepareBody(body); expect(prepared.item[0].entries).toEqual(['基础正文','新增正文']); expect(prepared.item[0]._copy).toBeUndefined();
  const variants = specificMagicItems(prepared); expect(variants).toHaveLength(1); expect(variants[0].name).toBe('+1 剑'); expect(variants[0].entries).toEqual(['加值+1。','基础正文']); expect(variants[0].value).toBeUndefined(); expect(body.item[0]._copy).toBeDefined();
  expect(expandCopies([{name:'a',source:'PHB',_copy:{name:'b',source:'PHB'}},{name:'b',source:'PHB',_copy:{name:'a',source:'PHB'}}])[0]._copy).toBeDefined();
});

it('death saves persist in backups and reject invalid runtime counts', () => {
  const c = newCharacter(); c.runtime.deathSaves = { success: 2, failure: 1 };
  expect(validateCharacter(exportCharacter(c)).runtime.deathSaves).toEqual({ success: 2, failure: 1 });
  for (const count of [-1, 4, 1.5, NaN]) expect(() => validateCharacter({ ...c, runtime: { ...c.runtime, deathSaves: { success: count, failure: 0 } } })).toThrow('死亡豁免');
  expect(validateCharacter(exportCharacter(newCharacter())).runtime.deathSaves).toBeUndefined();
});
