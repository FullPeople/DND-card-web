import { ABILITIES, KIND_LABELS, SKILLS, SHEET_BONUS_KEYS, SIZE_LABELS, skillKey, newCharacter, uid, type Character, type Effect, type Entry, type Raw, type RulePack } from './model';
import { evaluate } from './engine';
import {inventoryState,spellState} from './characterDetails';
import {normalizeCurrency} from './currency';
const plain = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function parseFile(text: string): unknown {
  assert(text.length <= 20_000_000, '文件超过 20 MB，请拆分规则包。');
  return JSON.parse(text, (key, value) => { assert(!['__proto__', 'prototype', 'constructor'].includes(key), '文件包含不允许的对象字段。'); return value; });
}
function validEntry(e: unknown): e is Entry {
  return plain(e) && typeof e.id === 'string' && typeof e.english === 'string' && typeof e.name === 'string' && e.name.length <= 300 && Object.hasOwn(KIND_LABELS, e.kind) &&
    typeof e.source === 'string' && typeof e.packId === 'string' && typeof e.revision === 'string' && ['2014', '2024', 'both'].includes(e.edition) && Array.isArray(e.entries) && plain(e.raw);
}
function validateChoices(value: unknown) {
  assert(Array.isArray(value) && value.length <= 200, 'choices 应为最多 200 项的数组。');
  const ids = new Set<string>();
  for (const c of value) {
    assert(plain(c) && typeof c.id === 'string' && !ids.has(c.id) && typeof c.label === 'string' && Number.isInteger(c.count) && c.count >= 1 && c.count <= 100, '选择要求的身份、数量或说明无效。'); ids.add(c.id);
    assert(c.kind === undefined || Object.hasOwn(KIND_LABELS, c.kind), '未知的选择条目类型。');
    for (const key of ['options', 'refs', 'featureType']) assert(c[key] === undefined || Array.isArray(c[key]) && c[key].every((v: unknown) => typeof v === 'string'), `选择的 ${key} 需要字符串数组。`);
    assert(c.spellLevel === undefined || Number.isInteger(c.spellLevel) && c.spellLevel >= 0 && c.spellLevel <= 9, '法术环阶无效。');
  }
}
function validateContent(value: unknown, depth = 0, budget = { left: 60000 }): void {
  assert(depth <= 35 && --budget.left > 0, '正文层级或节点数量过多。');
  if (Array.isArray(value)) { value.forEach(v => validateContent(v, depth + 1, budget)); return; }
  if (!plain(value)) return;
  for (const key of ['name', 'type', 'caption', 'by']) assert(value[key] === undefined || typeof value[key] === 'string', `正文的 ${key} 字段需要文本。`);
  for (const key of ['entries', 'items', 'rows', 'colLabels', 'row']) assert(value[key] === undefined || Array.isArray(value[key]), `正文的 ${key} 字段需要数组。`);
  Object.values(value).forEach(v => validateContent(v, depth + 1, budget));
}
function validateEffects(effects: unknown): asserts effects is Effect[] {
  assert(Array.isArray(effects) && effects.length <= 100, 'effects 必须是最多 100 项的数组。');
  for (const effect of effects) {
    assert(plain(effect), '效果格式不正确。');
    if (effect.op === 'proficiency') assert(typeof effect.skill === 'string', '熟练效果需要 skill。');
    else {
      assert(['add', 'set'].includes(effect.op), `不支持的效果操作：${String(effect.op)}。未安装该规则包。`);
      assert([...ABILITIES, 'ac', 'speed', 'hp'].includes(effect.target), `未知效果目标：${String(effect.target)}`);
      assert(Number.isFinite(effect.value) && Math.abs(effect.value) <= 10000, '效果数值不在允许范围。');
    }
  }
}
export function validateCharacter(value: unknown): Character {
  assert(plain(value), '角色文件应为一个对象。');
  const c = value.character ?? value;
  assert(plain(c) && c.schemaVersion === 1, '不支持的角色格式版本。请保留原文件，使用兼容版本打开。');
  assert(typeof c.id === 'string' && typeof c.name === 'string' && c.name.length <= 300 && typeof c.player === 'string', '角色身份数据不完整。');
  assert(['2014', '2024'].includes(c.edition), '角色规则版本必须为 2014 或 2024。');
  assert(plain(c.abilities) && ABILITIES.every(a => Number.isInteger(c.abilities[a]) && c.abilities[a] >= 1 && c.abilities[a] <= 100), '六项基础属性需要 1–100 的整数。');
  assert(Array.isArray(c.selections) && c.selections.length <= 3000, '角色条目数量或格式不正确。');
  const selectionIds = new Set();
  for (const s of c.selections) {
    assert(plain(s) && typeof s.id === 'string' && !selectionIds.has(s.id) && validEntry(s.entry), '角色中有无效或重复的条目身份。');
    selectionIds.add(s.id);
    assert(Number.isInteger(s.level) && s.level >= 1 && s.level <= 20 && Number.isInteger(s.quantity) && s.quantity >= 1 && s.quantity <= 100000, '角色条目数量或等级不合法。');
    assert(typeof s.equipped === 'boolean' && (s.requirementId === undefined || typeof s.requirementId === 'string'), '条目选择数据不合法。');
    assert(['parentId', 'grantKey'].every(key => s[key] === undefined || typeof s[key] === 'string' && s[key].length <= 2000), '条目来源关联无效。');
    assert(s.section === undefined || ['features', 'heritage'].includes(s.section), '条目放置区域无效。');
    if (s.entry.effects) validateEffects(s.entry.effects);
    if (s.entry.choices) validateChoices(s.entry.choices);
    validateContent(s.entry.entries);
    assert(!s.entry.dependencies || Array.isArray(s.entry.dependencies) && s.entry.dependencies.every((v: unknown) => typeof v === 'string'), '条目依赖列表无效。');
  }
  assert(plain(c.answers) && Object.values(c.answers).every(a => Array.isArray(a) && a.every(v => typeof v === 'string')), '角色选择记录不正确。');
  assert(c.proficiencies === undefined || plain(c.proficiencies) && Object.entries(c.proficiencies).every(([key, value]) => [...Object.keys(SKILLS), ...ABILITIES.map(a => `save:${a}`)].includes(key) && typeof value === 'boolean'), '熟练记录无效。');
  assert(c.training === undefined || plain(c.training) && Object.entries(c.training).every(([key, value]) => ['armor', 'weapons', 'tools', 'languages'].includes(key) && typeof value === 'string' && value.length <= 10000), '装备训练记录无效。');
  assert(c.expertise === undefined || plain(c.expertise) && Object.entries(c.expertise).every(([key, value]) => Object.hasOwn(SKILLS, key) && typeof value === 'boolean'), '专精记录无效。');
  assert(c.jackOfAllTrades === undefined || typeof c.jackOfAllTrades === 'boolean', '万事通记录无效。');
  assert(c.size === undefined || typeof c.size === 'string' && Object.hasOwn(SIZE_LABELS, c.size), '体型记录无效。');
  assert(c.sheetBonuses === undefined || plain(c.sheetBonuses) && Object.entries(c.sheetBonuses).every(([key, value]) => (SHEET_BONUS_KEYS as readonly string[]).includes(key) && typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 9999), '卡面调整值无效。');
  assert(c.dismissedFeatures === undefined || Array.isArray(c.dismissedFeatures) && c.dismissedFeatures.length <= 10000 && c.dismissedFeatures.every((value: unknown) => typeof value === 'string' && value.length <= 4000), '移除特性记录无效。');
  if(c.rulePacks!==undefined){assert(Array.isArray(c.rulePacks)&&c.rulePacks.length<=100,'扩展包列表无效。');for(const pack of c.rulePacks)validatePack({...pack,entries:pack.entries?.map((entry:any)=>({...entry,id:typeof entry.id==='string'&&entry.id.startsWith(pack.id+':')?entry.id.slice(pack.id.length+1):entry.id}))},c.rulePacks.filter((p:any)=>p!==pack));}
  if(c.quickbarLayout!==undefined)assert(plain(c.quickbarLayout)&&['order','hidden'].every(k=>Array.isArray(c.quickbarLayout[k])&&c.quickbarLayout[k].length<=3000&&c.quickbarLayout[k].every((v:unknown)=>typeof v==='string')),'快捷栏排序无效。');
  assert(c.quickbar === undefined || Array.isArray(c.quickbar) && c.quickbar.length <= 100 && c.quickbar.every((id: unknown) => typeof id === 'string') && new Set(c.quickbar).size === c.quickbar.length, '快捷栏需要最多 100 个互不重复的条目身份。');
  if(c.quickbarCopies!==undefined){assert(Array.isArray(c.quickbarCopies)&&c.quickbarCopies.length<=100&&c.quickbarCopies.every((row:any)=>plain(row)&&typeof row.id==='string'&&validEntry(row.entry))&&new Set(c.quickbarCopies.map((row:any)=>row.id)).size===c.quickbarCopies.length,'快捷栏副本无效。');for(const row of c.quickbarCopies)validateContent(row.entry.entries);}
  if(c.quickbarActions!==undefined)assert(Array.isArray(c.quickbarActions)&&c.quickbarActions.length<=100&&c.quickbarActions.every((row:any)=>plain(row)&&['id','name','attack','damage'].every(k=>typeof row[k]==='string'&&row[k].length<=160))&&new Set(c.quickbarActions.map((row:any)=>row.id)).size===c.quickbarActions.length,'自定义快捷动作无效。');
  if (c.featureLayout !== undefined) assert(plain(c.featureLayout) && ['order', 'expanded'].every(key => Array.isArray(c.featureLayout[key]) && c.featureLayout[key].length <= 10000 && c.featureLayout[key].every((id: unknown) => typeof id === 'string' && id.length <= 2000) && new Set(c.featureLayout[key]).size === c.featureLayout[key].length), '特性显示设置需要合法且不重复的条目身份。');
  assert(plain(c.profile) && Array.isArray(c.profile.enabledSources) && c.profile.enabledSources.every((v: unknown) => typeof v === 'string') && plain(c.profile.optional) && ['feats', 'multiclass', 'legacy'].every(k => typeof c.profile.optional[k] === 'boolean') && plain(c.profile.exceptions) && Object.values(c.profile.exceptions).every(v => typeof v === 'string'), '角色规则配置不正确。');
  assert(c.profile.disabledEntries === undefined || Array.isArray(c.profile.disabledEntries) && c.profile.disabledEntries.length <= 100000 && c.profile.disabledEntries.every((id:unknown) => typeof id === 'string' && id.length <= 4000), '禁用条目列表无效。');
  assert(c.profile.autoSourceDefaults === undefined || Array.isArray(c.profile.autoSourceDefaults) && c.profile.autoSourceDefaults.length <= 10000 && c.profile.autoSourceDefaults.every((id:unknown) => typeof id === 'string' && id.length <= 4000), '默认资料来源列表无效。');
  assert(plain(c.runtime) && ['hp', 'tempHp', 'inspiration'].every(k => Number.isFinite(c.runtime[k])) && plain(c.runtime.resources), '角色当前资源数据不正确。');
  if (c.runtime.deathSaves !== undefined) assert(plain(c.runtime.deathSaves) && ['success', 'failure'].every(key => Number.isInteger(c.runtime.deathSaves[key]) && c.runtime.deathSaves[key] >= 0 && c.runtime.deathSaves[key] <= 3), '死亡豁免记录无效。');
  assert(Object.values(c.runtime.resources).every(v => plain(v) && Number.isFinite(v.current) && Number.isFinite(v.max) && v.current >= 0 && v.max >= 0), '资源计数无效。');
  if (c.adjustments !== undefined) assert(Array.isArray(c.adjustments) && c.adjustments.every((v: unknown) => plain(v) && typeof v.id === 'string' && ['ac', 'hp', 'speed', 'initiative', 'passive', ...Object.keys(SKILLS).map(k => `skill:${k}`), ...ABILITIES.map(k => `save:${k}`)].includes(v.target) && Number.isFinite(v.value) && Math.abs(v.value) <= 10000 && typeof v.reason === 'string' && v.reason.trim()), '人工修正需要合法目标、数值和原因。');
  assert(plain(c.identity) && ['gender', 'alignment', 'age', 'description'].every(k => typeof c.identity[k] === 'string'), '角色描述数据不正确。');
  if(c.hpProgression!==undefined){const h=c.hpProgression;assert(plain(h)&&['average','rolled'].includes(h.mode)&&plain(h.rolls)&&Object.keys(h.rolls).length<=100&&Object.values(h.rolls).every(v=>Array.isArray(v)&&v.length<=20&&v.every(n=>n===null||Number.isInteger(n)&&n>=1&&n<=100)),'逐级生命骰记录无效。');}
  if(c.biography!==undefined)assert(plain(c.biography)&&Object.values(c.biography).every(v=>typeof v==='string'&&v.length<=100000),'人物背景无效。');
  if(c.palette!==undefined)assert(plain(c.palette)&&Object.entries(c.palette).every(([key,v])=>['paper','surface','frame','heading','ink','badge'].includes(key)&&typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)),'角色卡颜色无效。');
  for(const key of ['portrait','illustration'])if(c[key]!==undefined){const image=c[key];assert(plain(image)&&typeof image.data==='string'&&image.data.length<=650000&&/^data:image\/(webp|png|jpeg);base64,[a-z\d+/=]+$/i.test(image.data)&&['x','y','zoom'].every(k=>Number.isFinite(image[k]))&&Math.abs(image.x)<=300&&Math.abs(image.y)<=300&&image.zoom>=1&&image.zoom<=5&&['frameWidth','frameHeight'].every(k=>image[k]===undefined||Number.isFinite(image[k])&&image[k]>0&&image[k]<=2000),key==='portrait'?'头像数据无效。':'立绘数据无效。');}
  if(c.featureLayout?.detailsExpanded!==undefined)assert(Array.isArray(c.featureLayout.detailsExpanded)&&c.featureLayout.detailsExpanded.every((id:unknown)=>typeof id==='string'),'详细特性展开记录无效。');
  if(c.backgroundChoices!==undefined)assert(plain(c.backgroundChoices)&&Object.values(c.backgroundChoices).every(v=>plain(v)&&(!v.abilities||plain(v.abilities)&&Object.entries(v.abilities).every(([key,n])=>ABILITIES.includes(key as any)&&Number.isInteger(n)&&Number(n)>=0&&Number(n)<=10))&&(!v.equipment||plain(v.equipment)&&Object.values(v.equipment).every(k=>typeof k==='string'))),'背景选择无效。');
  if(c.spellSettings!==undefined){const s=c.spellSettings;assert(plain(s)&&['known','prepared'].includes(s.mode)&&(s.modeOverride===undefined||typeof s.modeOverride==='boolean')&&(s.abilityOverride===undefined||typeof s.abilityOverride==='boolean')&&(s.abilityClassId===undefined||typeof s.abilityClassId==='string')&&ABILITIES.includes(s.ability)&&Number.isInteger(s.capacity)&&s.capacity>=0&&s.capacity<=100&&(s.capacityAdjustment===undefined||Number.isInteger(s.capacityAdjustment)&&Math.abs(s.capacityAdjustment)<=100)&&['attackBonus','dcBonus'].every(k=>Number.isFinite(s[k])&&Math.abs(s[k])<=100)&&Array.isArray(s.prepared)&&s.prepared.length<=3000&&s.prepared.every((id:unknown)=>typeof id==='string')&&new Set(s.prepared.filter(Boolean)).size===s.prepared.filter(Boolean).length&&plain(s.slots)&&Object.entries(s.slots).every(([level,v])=>/^[1-9]$/.test(level)&&plain(v)&&Number.isInteger(v.max)&&v.max>=0&&v.max<=30&&Number.isInteger(v.used)&&v.used>=0&&v.used<=v.max),'法术设置无效。');}
  if(c.inventory!==undefined){const i=c.inventory;assert(plain(i)&&['grid','list'].includes(i.view)&&Array.isArray(i.order)&&i.order.every((id:unknown)=>typeof id==='string')&&new Set(i.order).size===i.order.length&&Number.isInteger(i.attunementLimit)&&i.attunementLimit>=0&&i.attunementLimit<=30&&plain(i.coins)&&['cp','sp','ep','gp','pp'].every(k=>Number.isFinite(i.coins[k])&&i.coins[k]>=0&&i.coins[k]<=1000000)&&(!i.grantedCoins||plain(i.grantedCoins)&&Object.values(i.grantedCoins).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)),'背包设置无效。');assert(i.capacityAdjustment===undefined||typeof i.capacityAdjustment==='string'&&i.capacityAdjustment.length<=180,'负重调整公式无效。');if(i.positions!==undefined)assert(plain(i.positions)&&Object.keys(i.positions).length<=10000&&Object.values(i.positions).every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<10000)&&new Set(Object.values(i.positions)).size===Object.keys(i.positions).length,'背包格子位置无效。');}
  assert(c.selections.every((s:any)=>s.attuned===undefined||typeof s.attuned==='boolean'),'同调记录无效。');
  assert(typeof c.notes === 'string' && Number.isFinite(c.baseHp) && c.baseHp >= 0 && Array.isArray(c.reviewed) && c.reviewed.every((v: unknown) => typeof v === 'string'), '角色笔记或核对记录不正确。');
  assert(Number.isInteger(c.revision) && c.revision > 0 && typeof c.createdAt === 'string' && typeof c.updatedAt === 'string', '角色修订记录不完整。');
  try { const result = evaluate(c as Character); assert([result.ac, result.speed, result.maxHp, ...Object.values(result.abilities)].every(Number.isFinite), '计算产生无效数值。'); } catch (error) { throw new Error(`条目规则结构无法读取：${String(error)}`); }
  return structuredClone(c as Character);
}
export function validatePack(value: unknown, installed: RulePack[]): RulePack {
  assert(plain(value) && value.schemaVersion === 1, '扩展包需要 schemaVersion: 1。');
  assert(typeof value.id === 'string' && /^[a-z0-9][a-z0-9._-]{2,79}$/.test(value.id) && value.id !== 'kiwee', '扩展包 id 应为 3–80 位小写字母、数字、点、横线或下划线。');
  assert(typeof value.name === 'string' && value.name.length > 0 && typeof value.version === 'string' && /^\d+\.\d+\.\d+$/.test(value.version), '扩展包需要名称与 x.y.z 版本。');
  assert(Array.isArray(value.editions) && value.editions.length > 0 && value.editions.every((v: unknown) => v === '2014' || v === '2024'), '扩展包需要声明适用的规则版本。');
  assert(Array.isArray(value.requires) && value.requires.every((x: unknown) => plain(x) && typeof x.id === 'string' && typeof x.version === 'string'), 'requires 应为依赖列表。');
  assert(Array.isArray(value.conflicts) && value.conflicts.every((x: unknown) => typeof x === 'string'), 'conflicts 应为包 ID 列表。');
  const others = installed.filter(p => p.id !== value.id);
  for (const dep of value.requires) assert(others.some(p => p.id === dep.id && p.version === dep.version), `缺少依赖 ${dep.id} ${dep.version}。请先安装该版本。`);
  assert(!value.requires.some((d: any) => d.id === value.id), '规则包不能依赖自己。');
  const packageId = value.id; const packageRequires = value.requires;
  function visit(id: string, seen: Set<string>) {
    assert(!seen.has(id), '规则包依赖构成循环。'); const next = new Set([...seen, id]);
    for (const dep of (id === packageId ? packageRequires : others.find(p => p.id === id)?.requires || [])) visit(dep.id, next);
  }
  visit(value.id, new Set());
  for (const p of others) assert(!value.conflicts.includes(p.id) && !p.conflicts.includes(value.id), `与已安装的「${p.name}」冲突。`);
  for (const p of others) for (const dep of p.requires) if (dep.id === value.id) assert(dep.version === value.version, `「${p.name}」需要旧版本 ${dep.version}，不能直接替换。`);
  assert(Array.isArray(value.entries) && value.entries.length > 0 && value.entries.length <= 3000, '扩展包应有 1–3000 个条目。');
  const ids = new Set<string>();
  const entries: Entry[] = value.entries.map((item: unknown) => {
    assert(plain(item) && typeof item.id === 'string' && /^[a-zA-Z0-9._-]+$/.test(item.id) && !ids.has(item.id), '包内条目需要互不重复的简单 id。'); ids.add(item.id);
    assert(typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 300 && Object.hasOwn(KIND_LABELS, item.kind), '条目名称或类型不正确。');
    assert(Array.isArray(item.entries), '条目正文 entries 必须为数组。');
    validateContent(item.entries);
    if (item.effects) validateEffects(item.effects);
    if (item.choices) validateChoices(item.choices);
    const dependencies = [...new Set<string>(value.requires.flatMap((dep: any) => [dep.id, ...(others.find(p => p.id === dep.id)?.entries[0].dependencies || [])]))];
    return { id: `${value.id}:${item.id}`, name: item.name, english: item.english || item.name, kind: item.kind, source: value.id, edition: value.editions.length > 1 ? 'both' : value.editions[0], packId: value.id, revision: value.version, entries: item.entries, raw: plain(item.raw) ? item.raw : {}, effects: item.effects || [], choices: item.choices || [], dependencies };
  });
  for (const entry of entries) { const sample = newCharacter(value.editions[0]); sample.profile.enabledSources = [value.id, ...(entry.dependencies || [])]; sample.selections = [{ id: 'check', entry, level: 1, quantity: 1, equipped: false }]; validateCharacter(sample); }
  return { schemaVersion: 1, id: value.id, name: value.name, version: value.version, author: value.author, editions: value.editions, requires: value.requires, conflicts: value.conflicts, entries };
}
export function importOwlbear(value: unknown): Character {
  assert(plain(value) && value.schema_version === '0.3' && plain(value.identity) && plain(value.abilities), '需要枭熊 schema_version 0.3 的角色 JSON。');
  const c = newCharacter(value.meta?.ruleset === '2014' ? '2014' : '2024');
  c.name = String(value.identity.character_name || value.identity.display_name || '导入的冒险者'); c.player = String(value.identity.player || '');
  for (const a of ABILITIES) { const n = Number(value.abilities[a]?.total); assert(Number.isInteger(n) && n >= 1 && n <= 100, `枭熊 ${a} 属性无效。`); c.abilities[a] = n; }
  c.profile.enabledSources.push('IMPORTED'); c.notes = `${String(value.background?.story || '')}\n从枭熊角色卡导入。数值按原卡总值保留；条目来源与内部选择需要重新核对。`;
  c.externalSnapshot = structuredClone(value);
  const add = (kind: Entry['kind'], name: string, level = 1, description = '', raw: Raw = {}, quantity = 1, equipped = false) => c.selections.push({ id: uid(), entry: { id: `imported:${kind}:${name}`, kind, name, english: name, source: 'IMPORTED', edition: 'both', packId: 'imported', revision: '0.3', entries: [description].filter(Boolean), raw }, level, quantity, equipped });
  if (value.identity.race?.name) add('race', String(value.identity.race.name));
  for (const cls of value.classes || []) if (cls.name && cls.level) { const level = Number(cls.level); assert(Number.isInteger(level) && level >= 1 && level <= 20, '导入职业等级无效'); add('class', String(cls.name), level, '', value.classes.length===1&&Number(value.core_stats?.hit_dice?.die_size)>0?{hd:{faces:Number(value.core_stats.hit_dice.die_size)}}:{});const parent=c.selections.at(-1)!;if(cls.subclass){add('subclass',String(cls.subclass),1,'',{className:cls.name,classSource:'IMPORTED'});c.selections.at(-1)!.parentId=parent.id;} }
  c.profile.optional.multiclass = c.selections.filter(s => s.entry.kind === 'class').length > 1;
  if (value.background?.background_name) add('background', String(value.background.background_name), 1, String(value.background.description || ''));
  const featureGroups = value.features || {};
  for (const [key, kind] of [['class_features', 'feature'], ['race_features', 'feature'], ['feats', 'feat'], ['fighting_style_feats', 'feature'], ['special_abilities', 'feature']] as const) {
    assert(featureGroups[key] === undefined || Array.isArray(featureGroups[key]), '枭熊特性列表格式无效。');
    for (const item of featureGroups[key] || []) if (item?.name) add(kind, String(item.name), 1, String(item.description || ''));
  }
  const seenSpells = new Set<string>();
  for (const key of ['cantrips_known', 'prepared', 'always_known']) {
    const list = value.spellcasting?.[key] || []; assert(Array.isArray(list), '枭熊法术列表格式无效。');
    for (const item of list) if (item?.name && !seenSpells.has(item.name)) { seenSpells.add(item.name); add('spell', String(item.name), 1, String(item.description || ''), { level: Number(item.level || 0) }); }
  }
  for (const item of value.inventory?.items || []) if (item?.name) {add('item', String(item.name), 1, String(item.description || ''), { weight: Number(item.weight || 0) }, Number(item.quantity || 1), !!item.equipped);c.selections.at(-1)!.attuned=!!item.attuned;}
  if(value.inventory?.coins!=null||value.inventory?.currency!=null){c.inventory=inventoryState(c);const coins=normalizeCurrency(value.inventory.coins??value.inventory.currency);for(const key of ['cp','sp','ep','gp','pp'] as const)c.inventory.coins[key]=coins[key]??0;}
  if(value.spellcasting){const s=c.spellSettings=spellState(c);s.ability=ABILITIES.includes(value.spellcasting.spellcasting_ability)?value.spellcasting.spellcasting_ability:'int';s.prepared=c.selections.filter(row=>row.entry.kind==='spell'&&(value.spellcasting.prepared||[]).some((spell:any)=>spell.name===row.entry.name)).map(row=>row.id);s.capacity=s.prepared.length;s.mode=s.prepared.length?'prepared':'known';for(const [level,v] of Object.entries(value.spellcasting.spell_slots||{}) as [string,any][]){if(!/^[1-9]$/.test(level))continue;s.slots[level]={max:Number(v.max||0),used:v.used!==undefined?Number(v.used):Number(v.max||0)-Number(v.current??v.max??0)};}const d=evaluate(c);const attack=typeof value.spellcasting.attack_bonus==='number'?value.spellcasting.attack_bonus:Number(String(value.spellcasting.attack_bonus??'NaN').match(/[+-]\s*\d+\s*$/)?.[0].replace(/\s/g,'')??value.spellcasting.attack_bonus);const dc=Number(String(value.spellcasting.save_dc??'NaN').replace(/^DC\s*/i,''));if(Number.isFinite(attack))s.attackBonus=attack-d.modifiers[s.ability]-d.proficiency;if(Number.isFinite(dc))s.dcBonus=dc-8-d.modifiers[s.ability]-d.proficiency;}
  c.biography={story:String(value.background?.story||''),backgroundDescription:String(value.background?.description||'')};
  c.identity.description = String(value.background?.appearance || ''); c.identity.alignment = String(value.identity.alignment || ''); c.identity.gender = String(value.identity.gender || ''); c.identity.age = String(value.identity.age || '');
  c.baseHp = Number(value.core_stats?.hp?.max || 0); c.runtime.hp = Number(value.core_stats?.hp?.current || 0); c.runtime.tempHp = Number(value.core_stats?.hp?.temp || 0); c.runtime.inspiration = Number(value.core_stats?.inspiration || 0);
  c.runtime.resources = structuredClone(value.web_resources||{});
  c.adjustments = [];
  const adjust = (target: string, v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) c.adjustments!.push({ id: uid(), target, value: v, reason: '保留枭熊原卡总值；更换规则条目后请重新核对此修正。' }); };
  for (const [key, target] of [['ac', 'ac'], ['initiative', 'initiative'], ['speed', 'speed'], ['passive_perception', 'passive']]) adjust(target, value.core_stats?.[key]);
  for (const a of ABILITIES) adjust(`save:${a}`, value.abilities[a]?.save?.bonus);
  assert(value.skills === undefined || Array.isArray(value.skills), '枭熊 skills 应为数组。');
  for (const skill of value.skills || []) {
    const key = skill.name === '特技' ? 'acrobatics' : skillKey(String(skill.name));
    if (SKILLS[key]) {
      (c.proficiencies ||= {})[key] = ['proficient', 'expertise', 'expert'].includes(skill.proficiency);
      (c.expertise ||= {})[key] = ['expertise', 'expert'].includes(skill.proficiency);
      adjust(`skill:${key}`, skill.total);
    }
  }
  return validateCharacter(c);
}
export const EXAMPLE_PACK = { schemaVersion: 1, id: 'homebrew.study', name: '我的扩展 · 示例', version: '1.0.0', author: '', editions: ['2014', '2024'], requires: [], conflicts: [], entries: [ { id: 'scholar-notes', name: '学者笔记', kind: 'feat', entries: ['你记录了旅途中的见闻。智力提高 1，并选择一项知识技能。此条目为展示导入格式而创作的自定义规则。'], effects: [{ op: 'add', target: 'int', value: 1 }], choices: [{ id: 'knowledge', label: '选择一项知识技能', count: 1, options: ['arcana', 'history', 'nature', 'religion'] }] } ] };
