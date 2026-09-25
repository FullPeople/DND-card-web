import {hitPointLevels} from './hitPoints';
import { ABILITIES, ABILITY_LABELS, SKILLS, skillKey, selectionAllowed, subclassOwner, type Ability, type Character, type Derived, type Entry, type Requirement } from './model';

export function evaluate(c: Character, excluded = new Set<string>(), inheritedIssues: Derived['issues'] = []): Derived {
  const abilities = { ...c.abilities }; const trace: Record<string, string[]> = {};
  ABILITIES.forEach(a => trace[a] = [`基础 ${abilities[a]}`]);
  const issues: Derived['issues'] = [...inheritedIssues]; const requirements: Requirement[] = [];
  const active = c.selections.filter(s => {
    if (excluded.has(s.id)) return false;
    let owner = s; const seen = new Set<string>();
    while (owner.parentId && !seen.has(owner.id)) { seen.add(owner.id); const parent = c.selections.find(p => p.id === owner.parentId); if (!parent || !selectionAllowed(c, parent.entry)) return false; owner = parent; }
    if (selectionAllowed(c, s.entry)) return true;
    issues.push({ id: `disabled:${s.id}`, message: `${s.entry.name} 的来源、依赖或规则选项未启用，保留内容但不计效果。`, selectionId: s.id, severity: 'error' }); return false;
  });
  const classes = active.filter(s => s.entry.kind === 'class');
  const level = classes.reduce((sum, s) => sum + s.level, 0);
  const proficiency = 2 + Math.floor((Math.max(1, level) - 1) / 4) + (c.sheetBonuses?.proficiency || 0);
  const skillSources: Record<string, string[]> = {}; const proficientSaves = new Set<string>();
  const grantSkill = (s: string, origin: string) => { const key = skillKey(s); if (SKILLS[key]) (skillSources[key] ??= []).push(origin); };
  const raceSpeed = active.find(s => s.entry.kind === 'race')?.entry.raw.speed;
  const walking=typeof raceSpeed==='number'?raceSpeed:raceSpeed?.walk;
  let speed = typeof walking==='number'?walking:typeof walking?.number==='number'?walking.number:30; let acBonus = 0; let hpBonus = 0; let acOverride: number | undefined; let hpOverride: number | undefined;
  const sizes = new Set<string>();
  for (const selection of active) {
    const e = selection.entry; const origin = `${e.name} · ${e.source}`; const raw = e.raw;
    // Background ability choices are annotations. The sheet's base scores
    // already contain the player's allocation, so do not apply it a second time.
    if (e.kind === 'race') { (raw.size || []).forEach((s: string) => sizes.add(s)); }
    if (raw._copy || raw._unresolvedParent) issues.push({ id: `copy:${selection.id}`, message: `${e.name} 使用尚未完整展开的继承资料，部分效果需要人工核对。`, severity: 'warning', selectionId: selection.id });
    // Fixed declarations only. Choice counts, progression checks and name-based rules
    // are deliberately not interpreted; players edit their own selections.
    const skillBlocks = e.kind === 'class' ? raw.startingProficiencies?.skills : raw.skillProficiencies;
    for (const block of Array.isArray(skillBlocks) ? skillBlocks : []) {
      for (const [key, value] of Object.entries(block || {})) if (value === true) grantSkill(key, origin);
    }
    if (selection.id === classes[0]?.id && Array.isArray(raw.proficiency)) raw.proficiency.forEach((a: string) => proficientSaves.add(a));
    // Retain already recorded skill choices from older backups, without quota limits.
    for (const [key, values] of Object.entries(c.answers)) if (key.startsWith(`${selection.id}:skills:`) || key.startsWith(`${selection.id}:custom:`)) values.forEach(value => grantSkill(value, origin));
    for (const effect of e.effects || []) {
      if (effect.op === 'proficiency') grantSkill(effect.skill, origin);
      else if (ABILITIES.includes(effect.target as Ability)) {
        if(e.kind==='background')continue;
        const a = effect.target as Ability; abilities[a] = effect.op === 'set' ? effect.value : abilities[a] + effect.value;
        trace[a].push(`${origin} ${effect.op === 'set' ? '=' : '+'}${effect.value}`);
      } else if (effect.target === 'speed') speed = effect.op === 'set' ? effect.value : speed + effect.value;
      else if (effect.target === 'ac') { if (effect.op === 'set') acOverride = effect.value; else acBonus += effect.value; }
      else if (effect.target === 'hp') { if (effect.op === 'set') hpOverride = effect.value; else hpBonus += effect.value; }
    }
  }
  for (const [key, value] of Object.entries(c.proficiencies || {})) {
    if (key.startsWith('save:')) { if (value) proficientSaves.add(key.slice(5)); else proficientSaves.delete(key.slice(5)); }
    else if (SKILLS[key]) { skillSources[key] = value ? ['手动记录'] : []; }
  }
  const modifiers = Object.fromEntries(ABILITIES.map(a => [a, Math.floor((abilities[a] - 10) / 2)])) as Record<Ability, number>;
  const skills = Object.fromEntries(Object.entries(SKILLS).map(([key, s]) => {
    const expertise = !!c.expertise?.[key], proficient = expertise || !!skillSources[key]?.length;
    const half = c.jackOfAllTrades && !proficient ? Math.floor(proficiency / 2) : 0;
    return [key, { value: modifiers[s.ability] + (proficient ? proficiency * (expertise ? 2 : 1) : half), proficient, expertise, sources: [...(skillSources[key] || []), ...(expertise ? ['专精'] : half ? ['万事通'] : [])] }];
  }));
  let ac = acOverride ?? (10 + modifiers.dex);
  // Equipment and attunement markers are visual references, not rule automation.
  ac += acBonus;
  const hpFromClasses = hitPointLevels(c,modifiers.con,classes).reduce((sum,r)=>sum+r.hp,0);
  let maxHp = Math.max(1, (hpOverride ?? (c.baseHp > 0 ? c.baseHp : hpFromClasses)) + hpBonus);
  trace.ac = [`基础 10 + 敏捷 ${modifiers.dex}`, ...(acBonus ? [`规则修正 +${acBonus}`] : [])];
  if (acOverride !== undefined) trace.ac.push(`规则设定基础结果 ${acOverride}`);
  trace.hp = [c.baseHp > 0 ? `手动生命值上限 ${c.baseHp}` : `首级满骰、以后${c.hpProgression?.mode==='rolled'?'逐级骰值':'固定平均值'}，含体质 ${modifiers.con}，每级最少 1 点：${hpFromClasses}`, ...(hpOverride !== undefined ? [`规则设定 ${hpOverride}`] : []), ...(hpBonus ? [`规则修正 +${hpBonus}`] : [])];
  trace.proficiency = [`总等级 ${level || 1}`]; trace.speed = [active.find(s => s.entry.kind === 'race')?.entry.name || '默认步行速度'];
  const saves = Object.fromEntries(ABILITIES.map(a => [a, { value: modifiers[a] + (proficientSaves.has(a) ? proficiency : 0), proficient: proficientSaves.has(a) }])) as Derived['saves'];
  let initiative = modifiers.dex + (c.jackOfAllTrades && c.edition === '2014' ? Math.floor(proficiency / 2) : 0); let passive = 10 + skills.perception.value;
  for (const adjustment of c.adjustments || []) {
    if (!adjustment.reason.trim()) continue;
    const { target, value } = adjustment;
    if (target === 'ac') ac = value; else if (target === 'hp') maxHp = value; else if (target === 'speed') speed = value;
    else if (target === 'initiative') initiative = value; else if (target === 'passive') passive = value;
    else if (target.startsWith('skill:') && skills[target.slice(6)]) skills[target.slice(6)].value = value;
    else if (target.startsWith('save:') && saves[target.slice(5) as Ability]) saves[target.slice(5) as Ability].value = value;
    (trace[target] ??= []).push(`人工修正为 ${value}：${adjustment.reason}`);
  }
  if (!(c.adjustments || []).some(a => a.target === 'passive')) passive = 10 + skills.perception.value;
  ac += c.sheetBonuses?.ac || 0;
  initiative += c.sheetBonuses?.initiative || 0;
  speed += c.sheetBonuses?.speed || 0;
  passive += c.sheetBonuses?.passive || 0;
  maxHp += c.sheetBonuses?.hp || 0;
  for (const [target, value] of Object.entries(c.sheetBonuses || {})) if (value) (trace[target] ??= []).push(`卡面调整 ${value >= 0 ? '+' : ''}${value}`);
  return { abilities, modifiers, level, proficiency, ac, initiative, speed, maxHp, passive,
    skills, saves, requirements, issues, trace,
    hitDice: classes.map(s => `${s.level}d${s.entry.raw.hd?.faces || '?'}`).join(' + ') || '—' };
}

export function requirementMismatch(e: Entry, r?: Partial<Requirement>): string | undefined {
  if (r?.kind && r.kind !== e.kind) return '这不是该位置需要的条目类型';
  if (r?.refs?.length) {
    const match = r.refs.some(ref => {
      const parts = ref.split('|'); const [name, source, classSource] = parts;
      if (![e.name.toLowerCase(), e.english.toLowerCase()].includes(name.toLowerCase())) return false;
      if (e.kind === 'feature' && parts.length > 2) {
        const subclass = parts.length >= 6; const level = subclass ? parts[5] : parts[3]; const featureSource = (subclass ? parts[6] || parts[4] : parts[4]) || classSource || 'PHB';
        return (!source || [e.raw.className, e.raw.classEnglish].some(n => n?.toLowerCase() === source.toLowerCase())) && e.raw.classSource?.toLowerCase() === (classSource || 'PHB').toLowerCase() && e.source.toLowerCase() === featureSource.toLowerCase() && (!level || String(e.raw.level) === level) && (!subclass || e.raw.subclassShortName === parts[3] && e.raw.subclassSource?.toLowerCase() === (parts[4] || 'PHB').toLowerCase());
      }
      return !source || e.source.toLowerCase() === source.toLowerCase();
    });
    if (!match) return '此要求限定了特定条目或来源';
  }
  return undefined;
}
export function candidateReason(c: Character, e: Entry, r?: Requirement): string | undefined {
  if(e.kind==='class'&&!c.profile.optional.multiclass&&c.selections.some(s=>s.entry.kind==='class'&&s.entry.id!==e.id))return '当前规则未启用兼职，不能加入第二个职业';
  if(c.profile.disabledEntries?.includes(e.id))return '此条目已在规则与扩展中单独禁用';
  if(e.kind==='subclass'&&!subclassOwner(c,e))return '需要先加入该子职所属的职业';
  if (e.kind === 'feat' && !c.profile.optional.feats) return '当前角色未启用专长选项';
  if (!selectionAllowed(c, e)) return '此来源或规则版本未启用';
  const mismatch = requirementMismatch(e, r); if (mismatch) return mismatch;
  const existing = c.selections.some(s => s.entry.id === e.id && (!r || s.requirementId === r.id));
  if (existing && e.kind !== 'item' && !e.raw.repeatable) return '这个条目已经在角色卡中';

  return undefined;
}
export function choiceLabel(value: string): string { return ABILITY_LABELS[value as Ability] || SKILLS[value]?.name || value; }
