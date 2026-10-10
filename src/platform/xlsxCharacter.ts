import coordinates from './xlsxLayouts.json';
import {readXlsxWorkbook, type XlsxWorkbook, type XlsxSheet, type CellValue} from './xlsxWorkbook';
import {ABILITIES, uid, type Character, type Raw} from '../core/model';
import {importOwlbear, validateCharacter} from '../core/validation';
import {inventoryState} from '../core/characterDetails';

type Layout = {version_label: string; main: Raw; person: Raw; sheets: Record<string, string>; inventory?: Raw; ruleset?: string};
const text = (value: CellValue | undefined): string | null => value === null || value === undefined ? null : String(value).trim() || null;
const integer = (value: CellValue | undefined, fallback: number | null = 0): number | null => {
  if (value === null || value === undefined || value === '') return fallback;
  const match = /-?\d+/.exec(String(value)); return match ? Number(match[0]) : fallback;
};
const range = (pair: number[] | undefined, inclusive = false) => pair ? Array.from({length: Math.max(0, pair[1] - pair[0] + Number(inclusive))}, (_, i) => pair[0] + i) : [];
const column = (number: number): string => number ? column(Math.floor((number - 1) / 26)) + String.fromCharCode(65 + (number - 1) % 26) : '';
const cell = (sheet: XlsxSheet, ref: string | undefined) => ref ? sheet.cells.get(ref) ?? null : null;
const common = coordinates.commonAliases as Record<string, string[]>;
const profiles = coordinates.profileAliases as Record<string, Record<string, string[]>>;
const resolve = (book: XlsxWorkbook, names: string[], required = false): string | undefined => {
  const matches = book.names.filter(name => names.some(alias => alias.toLowerCase() === name.toLowerCase()));
  if (matches.length > 1) throw Error(`Excel 中有重复的工作表：${matches.join('、')}`);
  if (required && !matches.length) throw Error(`Excel 缺少工作表：${names.join(' / ')}`);
  return matches[0];
};

async function selectLayout(book: XlsxWorkbook): Promise<{layout: Layout; main: XlsxSheet; embedded: Raw | null; templateName: string | null; templateVersion: string | null}> {
  const resolved: Record<string, string> = {};
  for (const [role, aliases] of Object.entries(common)) {const name = resolve(book, aliases, role === 'main'); if (name) resolved[role] = name;}
  const main = await book.sheet(resolved.main), title = text(cell(main, 'A1'));
  const version = /<([^<>]+?)(v[\d.]+|ver\.?)>/.exec(title || '');
  const templateName = version?.[1].trim() || null, templateVersion = version?.[2].trim() || null;
  let embedded: Raw | null = null;
  try {const value = JSON.parse(text(cell(main, 'AV1')) || 'null'); if (value && typeof value === 'object' && !Array.isArray(value)) embedded = value;} catch { /* The original Excel formula may contain unescaped user text. */ }
  const evidence = new Set<string>();
  for (const col of range([5, 15])) for (const match of String(cell(main, `${column(col)}2`) || '').matchAll(/(?<![A-Za-z0-9])5E\d{4}(?![A-Za-z0-9])/g)) evidence.add(match[0]);
  if (embedded?.schema === 'obr-suite-card/v1' && embedded.meta?.ruleset != null) evidence.add(embedded.meta.ruleset);
  if ([...evidence].some(value => !['5E2014', '5E2024'].includes(value)) || evidence.size > 1) throw Error('Excel 的 2014／2024 版本标记冲突或不受支持');
  let ruleset = [...evidence][0];
  const origin = resolve(book, profiles['2024'].person), legacyModern = ['v1.0.11', 'v1.0.12'].includes(templateVersion || '');
  const modern = ['equipment', 'data', 'areas', 'export'].every(role => resolved[role]) || !!origin || legacyModern;
  let profile: string;
  if (modern) {
    if (!ruleset && !legacyModern) {
      const oldExport = text(cell(main, 'AV1'))?.startsWith('.st');
      const has = (names: string[]) => book.names.some(name => names.some(alias => alias.toLowerCase() === name.toLowerCase()));
      const newer = has(['起源', 'Origin', 'Origins', '专长与据点', 'Feats and Bastions', '自定义调整栏', 'Custom Adjustments', 'Species', 'Bastions']);
      const older = has(['额外法术', 'Additional Spells', '背景数据', 'Races', 'Strongholds']);
      if (!oldExport || newer === older) throw Error('未识别到旧插件支持的角色卡模板，请使用悲灵 2014／2024 适配版 Excel');
      ruleset = newer ? '5E2024' : '5E2014';
    }
    profile = ruleset === '5E2024' || !ruleset && origin ? '2024' : '2014';
  } else if (templateVersion === 'v1.0.0' && ruleset !== '5E2024') profile = '2014';
  else throw Error('未识别到旧插件支持的角色卡模板，请使用悲灵 2014／2024 适配版 Excel');
  const forbidden = profile === '2024' ? ['Background', '背景数据'] : ['起源', 'Origin', 'Origins'];
  if (book.names.some(name => forbidden.some(alias => alias.toLowerCase() === name.toLowerCase()))) throw Error('Excel 工作表与角色卡版本不一致');
  const required = new Set(['main', 'person', 'spell_db']);
  if (modern && !legacyModern) for (const role of ['equipment', 'data', 'areas', 'export', 'inventory', 'background_db']) required.add(role);
  for (const [role, aliases] of Object.entries(profiles[profile])) {
    const all = ['species', 'strongholds'].includes(role) ? [...new Set(Object.values(profiles).flatMap(value => value[role]))] : aliases;
    const name = resolve(book, all, required.has(role));
    if (name && !aliases.some(alias => alias.toLowerCase() === name.toLowerCase())) throw Error('Excel 工作表与角色卡版本不一致');
    if (name) resolved[role] = name;
  }
  for (const role of required) if (!resolved[role]) resolve(book, common[role] || profiles[profile][role], true);
  const layout = structuredClone(modern ? coordinates.layouts.modern : coordinates.layouts.legacy) as Layout;
  layout.sheets = {...layout.sheets, ...resolved}; layout.ruleset = ruleset || `5E${profile}`;
  layout.version_label = modern ? profile === '2024' ? 'v1.0.12' : 'v1.0.12-2014mode' : 'v1.0.0';
  if (modern && templateVersion !== 'v1.0.0' && [['AL39', ['盾牌', 'shield']], ['AQ39', ['ac', 'armor class']], ['AS39', ['着装', 'equipped']]].every(([ref, names]) => (names as string[]).includes((text(cell(main, ref as string)) || '').toLowerCase()))) {
    layout.main.shield_equipped = 'AS40'; layout.main.shield_equipped_yes_no = true;
  }
  return {layout, main, embedded, templateName, templateVersion};
}

/** Coordinates and interpretation follow the old plugin parser; no server-side card is created. */
export async function parseXlsxCharacter(book: XlsxWorkbook, filename: string): Promise<Raw> {
  const {layout: L, main, embedded, templateName, templateVersion} = await selectLayout(book);
  const person = await book.sheet(L.sheets.person), M = L.main, P = L.person;
  const v = (key: string) => cell(main, M[key]), s = (key: string) => text(v(key)), n = (key: string, fallback: number | null = 0) => integer(v(key), fallback);
  const p = (key: string) => text(cell(person, P[key]));
  const area = (rows: number[], cols: number[], label: string) => [...new Set(range(rows).flatMap(row => range(cols).map(col => text(cell(person, `${column(col)}${row}`)))).filter((value): value is string => !!value && value !== label))];
  const classes = (M.class_rows as [string, number][]).map(([role, row]) => ({role, name: text(cell(main, M.class_name_col + row)), subclass: text(cell(main, M.class_sub_col + row)), level: integer(cell(main, M.class_lv_col + row), null)}));
  const abilities = Object.fromEntries(Object.entries(M.ability_rows).map(([ability, row]) => [ability, {
    ...Object.fromEntries(['total', 'initial', 'background', 'growth', 'misc', 'modifier'].map(key => [key, integer(cell(main, M[`ability_${key}_col`] + row))])),
    save: {proficient: cell(main, M.ability_save_prof_col + row) === 'O', bonus: integer(cell(main, M.ability_save_bonus_col + row)), misc: integer(cell(main, M.ability_save_misc_col + row))}
  }]));
  const core: Raw = Object.fromEntries(['proficiency_bonus', 'initiative', 'ac', 'dc', 'passive_perception', 'speed'].map(key => [key, n(key)]));
  core.dc_ability = s('dc_ability'); core.size = s('size'); core.hp = {current: n('hp_current'), max: n('hp_max'), temp: n('hp_temp')}; core.hit_dice = {current: n('hd_current'), max: n('hd_max'), die_size: null};
  const defenses: Raw = {resistances: [], immunities: [], advantages: [], disadvantages: []};
  for (const [row, key] of M.defense_rows) defenses[key] = range(M.defense_value_cols).map(col => text(cell(main, `${column(col)}${row}`))).filter(Boolean);
  const skills = M.skill_rows.map(([name, ability, row]: [string, string, number]) => ({name, ability, proficiency: ({O: 'proficient', '🅞': 'expertise'} as Record<string, string>)[String(cell(main, M.skill_prof_col + row))] || 'none', total: integer(cell(main, M.skill_total_col + row)), misc_bonus: integer(cell(main, M.skill_misc_col + row))}));
  const shieldValue = v('shield_equipped');
  const combat: Raw = {armor: {name: s('armor_name'), ac_base: n('armor_ac_base', null), dex_bonus_cap: n('armor_dex_cap', null), attuned: v('armor_attuned') === 'O', weight: n('armor_weight', null), equipped: true},
    shield: {ac_bonus: n('shield_ac', null), attuned: v('shield_attuned') === 'O', equipped: !M.shield_equipped || ['O', 'Y', '✓', '1', 'TRUE', 'YES'].includes(String(shieldValue).toUpperCase()) || shieldValue === true || !!M.shield_equipped_yes_no && shieldValue === '是'}, weapons: [], other_equipment: []};
  for (const row of range(M.weapon_rows)) {
    const read = (key: string) => text(cell(main, M[`weapon_${key}_col`] ? M[`weapon_${key}_col`] + row : undefined));
    const name = read('name'); if (!name) continue;
    const die = read('dmg_die'), plus = read('dmg_plus');
    combat.weapons.push({name, proficient: read('prof') === 'O', attack_bonus: read('atk'), damage: die ? die + (plus ? /^[+-]/.test(plus) ? plus : '+' + plus : '') : null,
      damage_type: read('dmg_type'), extra_damage: read('extra_die'), extra_damage_type: read('extra_type'), mastery: read('mastery'), mastery_effect: read('mastery_effect'), weight: integer(read('weight'), null), ammo_type: read('ammo'), properties: read('props')});
  }
  const spellDb = await book.sheet(L.sheets.spell_db), spells = new Map<string, Raw>(), aliases = new Map<string, string | null>(), occurrences = new Map<string, number>();
  for (const row of range([3, Math.min(spellDb.maxRow + 1, 100_001)])) {
    const read = (col: number) => text(cell(spellDb, `${column(col)}${row}`)), name = read(1); if (!name) continue;
    const info = {description: read(13), meta: {school: read(3), ritual: !!read(4), concentration: !!read(5), casting_time: read(6), range: read(7), components: [[8, 'V'], [9, 'S'], [10, 'M']].filter(([col]) => read(Number(col))).map(([, value]) => value).join('/') || null, duration: read(12), english: read(14), source: read(26)}};
    spells.set(name, info); occurrences.set(name, (occurrences.get(name) || 0) + 1);
    if (info.meta.english) {const key = info.meta.english.toLowerCase(); aliases.set(key, aliases.has(key) ? null : name);}
  }
  const originalKeys = new Set([...spells.keys()].map(name => name.toLowerCase()));
  const collectSpells = (cols: string[], rows: number[], group?: number) => range(rows).flatMap(row => {
    const level = cell(main, cols[0] + row), name = text(cell(main, cols[1] + row));
    if (!name || ['Lv', '法术名称'].includes(name) || ['Lv', '法术名称'].includes(String(level))) return [];
    const alias = aliases.get(name.toLowerCase()), info = spells.get(name) || (alias && occurrences.get(alias) === 1 && !originalKeys.has(name.toLowerCase()) ? spells.get(alias) : undefined);
    return [{level: integer(level) || 0, name, ...(group !== undefined ? {group} : {}), ...(info || {})}];
  });
  const active = s('spell_active_ability_cell'), activeRow = M.spell_ability_to_row[active || ''] || Object.values(M.spell_ability_to_row).at(-1);
  const slots: Raw = {};
  for (const [level, row] of Object.entries(M.spell_slot_rows)) {const current = integer(cell(main, M.spell_slot_cur_col + row), null), max = integer(cell(main, M.spell_slot_max_col + row), null); if (current !== null || max !== null) slots[level] = {current, max};}
  const sorceryMax = n('spell_sorcery_total', null), sorceryCurrent = n('spell_sorcery_cur', null);
  const spellcasting: Raw = {spellcasting_ability: active, save_dc: integer(cell(main, M.spell_dc_col + activeRow)), attack_bonus: text(cell(main, M.spell_atk_col + activeRow)), max_prepared: n('spell_max_prepared', null), spell_slots: slots,
    sorcery_points: sorceryMax ? {current: sorceryCurrent ?? sorceryMax, max: sorceryMax} : null,
    always_known: collectSpells(M.spell_always_known_cols, M.spell_always_known_rows), cantrips_known: M.spell_cantrip_cols.flatMap((cols: string[]) => collectSpells(cols, M.spell_cantrip_rows)),
    prepared: [...collectSpells(M.spell_prepared_group1_cols, M.spell_prepared_group1_rows, 1), ...M.spell_prepared_group23_cols.flatMap((cols: string[], index: number) => collectSpells(cols, M.spell_prepared_group23_rows, index + 2))]};
  const tokens = new Set(['名称', 'Lv', '种族特性', '生物种类', '体型', '速度', '专长', '战斗风格专长', '豁免熟练', '技能熟练', '武器熟练', '工具熟练', '护甲受训', '起始装备', '特殊能力', '描述', '寻获魔宠速查']);
  const features: Raw = {};
  for (const [key, prefix] of [['class_features', 'class'], ['race_features', 'race'], ['feats', 'general'], ['fighting_style_feats', 'fighting_style'], ['special_abilities', 'special_ability']]) {
    features[key] = range(M[`feat_${prefix}_rows`]).flatMap(row => {const name = text(cell(main, M[`feat_${prefix}_name_col`] + row)); return !name || tokens.has(name) ? [] : [{name, description: text(cell(main, M[`feat_${prefix}_desc_col`] + row)), ...(M[`feat_${prefix}_lv_col`] ? {level: integer(cell(main, M[`feat_${prefix}_lv_col`] + row), null)} : {})}];});
  }
  if (!M.feat_race_rows && M.feat_race_lookup_sheet && book.names.includes(M.feat_race_lookup_sheet) && s('race_name')) {
    const sheet = await book.sheet(M.feat_race_lookup_sheet), rows = range([2, Math.min(sheet.maxRow + 1, 100_001)]);
    const name = s('race_name')!, exact = rows.find(row => text(cell(sheet, `K${row}`)) === name);
    const row = exact ?? rows.find(row => {const value = text(cell(sheet, `K${row}`)); return !!value && (value.includes(name) || name.includes(value));});
    if (row) features.race_features = range([12, 40]).flatMap(col => {const name = text(cell(sheet, `${column(col)}${row}`)), description = text(cell(sheet, `${column(col)}${row + 1}`)); return name || description ? [{name: name || '(未命名)', description}] : [];});
  }
  const special_resources = range(M.special_resource_rows).flatMap(row => (M.special_resource_cols || []).flatMap((cols: Raw) => {const name = text(cell(main, cols.name + row)); return !name || ['特殊能力', '名称'].includes(name) ? [] : [{name, description: text(cell(main, cols.desc + row)), current: integer(cell(main, cols.cur + row)), max: integer(cell(main, cols.max + row), null), recharge: text(cell(main, cols.recharge + row))}];}));
  const wondrous_items = range(M.wondrous_rows).flatMap(row => {const read = (key: string) => cell(main, M[`wondrous_${key}_col`] + row), name = text(read('name')); return !name || ['奇物', '名称', '稀有度'].includes(name) ? [] : [{name, quantity: integer(read('qty'), 1), attuned: read('attuned') === 'O', rarity: text(read('rarity')), slot: text(read('slot')), properties: text(read('props'))}];});
  const consumables = range(M.consumable_rows).flatMap(row => {const read = (key: string) => cell(main, M[`consumable_${key}_col`] + row), name = text(read('name')); return !name || ['消耗品', '名称', '稀有度'].includes(name) ? [] : [{name, quantity: integer(read('qty'), 1), rarity: text(read('rarity')), description: text(read('desc'))}];});
  const inventorySheet = L.inventory?.containers?.length ? await book.sheet(L.sheets.inventory) : main;
  const containers = (L.inventory?.containers?.length ? L.inventory.containers : M.containers || []).map((reg: Raw) => ({label: reg.label, rows: reg.rows.join('-'), schema: reg.schema, items: range(reg.rows, true).flatMap(row => {const read = (key: string) => cell(inventorySheet, reg.schema[key] + row), name = text(read('name')); return !name || ['名称', '物品', '背包', '次元袋'].includes(name) ? [] : [{row, name, description: text(read('desc')), weight: text(read('weight')), quantity: integer(read('qty'), null)}];})}));
  const wallet = Object.fromEntries(['gp', 'pp', 'ep', 'sp', 'cp'].map(key => [key, n('currency_' + key)]));
  const background = Object.fromEntries(['background_name', 'personality', 'appearance', 'traits', 'ideals', 'bonds', 'flaws', 'story', 'description'].map(key => [key, p(key)]));
  const data: Raw = {schema_version: '0.3', meta: {template_name: templateName, template_version: templateVersion, layout_version: L.version_label, ruleset: L.ruleset, source_file: filename, parsed_at: new Date().toISOString()},
    identity: {character_name: s('character_name'), display_name: p('display_name'), player: s('player'), race: {name: s('race_name'), subrace: s('race_subrace')}, alignment: s('alignment'), faith: s('faith'), age: integer(cell(person, P.age), null), gender: p('gender'), height: p('height'), weight: p('weight'), hometown: p('hometown'), languages: area(P.languages_rows, P.languages_cols, P.languages_label), tool_proficiencies: area(P.tools_rows, P.tools_cols, P.tools_label)},
    classes, total_level: classes.reduce((sum, row) => sum + (row.level || 0), 0), abilities, core_stats: core, defenses, skills, combat, spellcasting, features, special_resources, background,
    inventory: {currency: {wallet, total_gp: integer(s('currency_total_gp'), null), total_gp_raw: s('currency_total_gp')}, encumbrance: Object.fromEntries(Object.entries(M.encumbrance).map(([key, ref]) => [key, integer(cell(main, ref as string))])), items: [], wondrous_items, consumables, containers}, exports: {dice_bot: s('dice_bot_export'), embedded_json: embedded}};
  const resourceIds = new Set<string>(), uniqueResource = (name: string) => {let id = name, index = 2; while (resourceIds.has(id)) id = `${name}-${index++}`; resourceIds.add(id); return id;};
  data.auto_resources = Object.entries(slots).filter(([, value]) => (value as Raw).max).map(([level, value]) => {const slot = value as Raw; return {id: uniqueResource(`spell-slot-${level}`), name: `${'一二三四五六七八九'[Number(level) - 1]}环法术位`, type: 'count', current: slot.current ?? slot.max, max: slot.max, icon: 'spellbook'};});
  data.auto_resources.push(...special_resources.filter((resource: Raw) => resource.name && resource.max).map((resource: Raw) => ({id: uniqueResource(resource.name), name: resource.name, type: resource.max <= 12 ? 'count' : 'bar', current: resource.current ?? resource.max, max: resource.max, icon: 'starFour'})));
  overlay(data, embedded); fallbackStats(data);
  return data;
}

function overlay(data: Raw, embedded: Raw | null) {
  if (!embedded) return;
  const numeric = (value: unknown) => typeof value !== 'boolean' && value !== null && value !== undefined && String(value).trim() && Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
  for (const ability of ABILITIES) {
    const score = numeric((embedded.abilities || embedded)[ability]);
    if (score !== null) {data.abilities[ability].total = score; data.abilities[ability].modifier = Math.floor((score - 10) / 2);}
    const save = numeric(embedded.saves?.[ability] ?? embedded[`save_${ability}`]); if (save !== null) data.abilities[ability].save.bonus = save;
  }
  const pick = (...keys: string[]) => {for (const key of keys) {const value = numeric(embedded.core_stats?.[key] ?? embedded[key]); if (value !== null) return value;} return null;};
  for (const [key, aliases] of [['current', ['hp', 'hp_current']], ['max', ['hp_max', 'hpmax', 'maxhp']], ['temp', ['hp_temp', 'temp_hp', 'temp']]] as [string, string[]][]) {const value = pick(...aliases); if (value !== null) data.core_stats.hp[key] = value;}
  for (const [key, aliases] of [['ac', ['ac']], ['dc', ['dc']], ['passive_perception', ['pp', 'passive_perception']], ['initiative', ['initiative', 'init']], ['speed', ['speed']]] as [string, string[]][]) {const value = pick(...aliases); if (value !== null) data.core_stats[key] = value;}
  for (const skill of data.skills) {const value = numeric(embedded.skills?.[skill.name] ?? embedded[`skill_${skill.name}`]); if (value !== null) skill.total = value;}
  const name = text(embedded.name || embedded.identity?.display_name || embedded.identity?.character_name); if (name) {data.identity.display_name = name; data.identity.character_name ||= name;}
  // The nested template export is evidence, rather than an alternative workbook layout.
  if (typeof embedded.race === 'string') data.identity.race.name = embedded.race;
  if (typeof embedded.class === 'string' && data.classes[0]) data.classes[0].name = embedded.class;
  const level = numeric(embedded.level ?? embedded.total_level); if (level !== null) data.total_level = level;
}

function fallbackStats(data: Raw) {
  const core = data.core_stats, mod = (ability: string) => data.abilities[ability].modifier || (data.abilities[ability].total ? Math.floor((data.abilities[ability].total - 10) / 2) : 0), dex = mod('dex');
  if (!core.initiative) core.initiative = dex;
  if (!core.ac) {const {armor, shield} = data.combat; core.ac = (armor.ac_base ?? 10) + Math.min(dex, armor.dex_bonus_cap ?? dex) + (shield.equipped ? shield.ac_bonus || 0 : 0);}
  if (!core.passive_perception) {const skill = data.skills.find((row: Raw) => row.name === '察觉'); core.passive_perception = 10 + (skill?.total || mod('wis') + (skill?.proficiency === 'expertise' ? 2 : skill?.proficiency === 'proficient' ? 1 : 0) * (core.proficiency_bonus || 0) + (skill?.misc_bonus || 0));}
}

export async function readXlsxCharacter(file: File): Promise<Character> {
  let data: Raw;
  try {data = await parseXlsxCharacter(await readXlsxWorkbook(file), file.name);} catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (error instanceof TypeError && /DecompressionStream|deflate-raw/.test(detail)) throw Error('当前浏览器无法读取 Excel，请更新浏览器或先从旧插件导出 JSON');
    throw Error(`无法导入「${file.name}」：${detail}`);
  }
  const normalized = structuredClone(data);
  normalized.meta.ruleset = data.meta.ruleset === '5E2014' ? '2014' : '2024';
  normalized.spellcasting.spellcasting_ability = ({智力: 'int', 感知: 'wis', 魅力: 'cha'} as Record<string, string>)[data.spellcasting.spellcasting_ability] || data.spellcasting.spellcasting_ability;
  const card = importOwlbear(normalized); card.externalSnapshot = data;
  card.biography = {...card.biography, ...Object.fromEntries(['hometown', 'height', 'weight'].map(key => [key, data.identity[key] || ''])), ...Object.fromEntries(['traits', 'ideals', 'bonds', 'flaws'].map(key => [key, data.background[key] || '']))};
  inventoryState(card).coins = {...data.inventory.currency.wallet};
  const addItem = (item: Raw, raw: Raw = {}, equipped = false) => {
    const name = String(item.name || '').trim(); if (!name) return;
    const id = uid();
    card.selections.push({id, entry: {id: 'imported:item:' + id, kind: 'item', name, english: name, source: 'IMPORTED', edition: 'both', packId: 'imported', revision: '0.3', entries: [item.description || item.properties || ''].filter(Boolean), raw: {weight: Math.max(0, Number(item.weight) || 0), ...raw}}, quantity: Math.max(1, Number(item.quantity ?? 1)), level: 1, equipped, attuned: !!item.attuned});
  };
  for (const container of data.inventory.containers) for (const item of container.items) addItem(item, {_xlsxContainer: container.label});
  for (const item of [...data.inventory.wondrous_items, ...data.inventory.consumables]) addItem(item);
  const armor = data.combat.armor;
  if (armor.name) addItem(armor, {armor: true, ac: armor.ac_base, dexterityMax: armor.dex_bonus_cap, _xlsxArmor: true}, true);
  if (data.combat.shield.ac_bonus) addItem({name: '盾牌', attuned: data.combat.shield.attuned}, {armor: true, type: 'S', ac: data.combat.shield.ac_bonus}, data.combat.shield.equipped);
  for (const weapon of data.combat.weapons) addItem(weapon, {_xlsxWeapon: weapon}, true);
  const resources = [...data.special_resources, ...(data.spellcasting.sorcery_points ? [{...data.spellcasting.sorcery_points, name: '术法点'}] : [])];
  resources.forEach((resource: Raw, index: number) => {const max = Math.max(0, Number(resource.max) || 0); card.runtime.resources[`xlsx:resource:${index}`] = {name: resource.name, current: Math.max(0, Math.min(max, Number(resource.current) || 0)), max, type: 'count'};});
  if (ABILITIES.some(ability => card.abilities[ability] < 1)) throw Error('Excel 属性尚未计算，请在 Excel 中重新计算并保存后导入');
  return validateCharacter(card);
}
