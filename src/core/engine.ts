import { ABILITIES, ABILITY_LABELS, SKILLS, skillKey, selectionAllowed, type Ability, type Character, type Derived, type Entry, type Kind, type Requirement } from './model';

export function evaluate(c: Character, excluded = new Set<string>(), inheritedIssues: Derived['issues'] = []): Derived {
  const abilities = { ...c.abilities }; const trace: Record<string, string[]> = {};
  ABILITIES.forEach(a => trace[a] = [`基础 ${abilities[a]}`]);
  const issues: Derived['issues'] = [...inheritedIssues]; const requirements: Requirement[] = [];
  const active = c.selections.filter(s => {
    if (excluded.has(s.id)) return false;
    if (selectionAllowed(c, s.entry)) return true;
    issues.push({ id: `disabled:${s.id}`, message: `${s.entry.name} 的来源、依赖或规则选项未启用，保留内容但不计效果。`, selectionId: s.id, severity: 'error' }); return false;
  });
  const classes = active.filter(s => s.entry.kind === 'class');
  const level = classes.reduce((sum, s) => sum + s.level, 0);
  const proficiency = 2 + Math.floor((Math.max(1, level) - 1) / 4);
  const skillSources: Record<string, string[]> = {}; const proficientSaves = new Set<string>();
  const grantSkill = (s: string, origin: string) => { const key = skillKey(s); if (SKILLS[key]) (skillSources[key] ??= []).push(origin); };
  function requirement(id: string, label: string, section: Requirement['section'], count: number, origin: string, rest: Partial<Requirement> = {}) {
    const selected = rest.kind ? active.filter(s => s.requirementId === id && !requirementMismatch(s.entry, rest)).map(s => s.entry.id) : c.answers[id] || [];
    const valid = rest.options ? selected.filter(x => rest.options!.includes(x)) : selected;
    requirements.push({ ...rest, id, label, section, count, origin, selected, complete: new Set(valid).size >= count });
  }
  for (const kind of ['class', 'race', 'background'] as Kind[]) {
    if (!active.some(s => s.entry.kind === kind)) requirement(`base:${kind}`, kind === 'class' ? '选择职业' : kind === 'race' ? '选择种族' : '选择背景', kind, 1, `${c.edition} 基础规则`, { kind });
  }
  if (classes.length > 1 && !c.profile.optional.multiclass) issues.push({ id: 'multiclass', message: '已选择多个职业，但尚未启用兼职规则。', severity: 'error' });
  if (level > 20) issues.push({ id: 'levels', message: '职业总等级超过 20，请检查等级或记录 DM 裁定。', severity: 'error' });
  let speed = 30; let acBonus = 0; let hpBonus = 0; let acOverride: number | undefined;
  const sizes = new Set<string>();
  for (const selection of active) {
    const e = selection.entry; const origin = `${e.name} · ${e.source}`; const raw = e.raw;
    if (e.kind === 'race') { speed = typeof raw.speed === 'number' ? raw.speed : raw.speed?.walk ?? speed; (raw.size || []).forEach((s: string) => sizes.add(s)); }
    if (raw._copy || raw._unresolvedParent) issues.push({ id: `copy:${selection.id}`, message: `${e.name} 使用尚未完整展开的继承资料，部分效果需要人工核对。`, severity: 'warning', selectionId: selection.id });
    const abilityOptions = Array.isArray(raw.ability) ? raw.ability : [];
    let abilityIndex = Number(c.answers[`${selection.id}:ability-mode`]?.[0] ?? 0);
    if (abilityOptions.length > 1) requirement(`${selection.id}:ability-mode`, '选择属性增长方案', 'abilities', 1, origin, { options: abilityOptions.map((_: unknown, i: number) => String(i)), optionLabels: Object.fromEntries(abilityOptions.map((a: any, i: number) => [String(i), a.choose?.weighted ? a.choose.weighted.weights.map((n: number) => `+${n}`).join(' / ') : a.choose ? `${a.choose.count || 1} 项各 +${a.choose.amount || 1}` : `方案 ${i + 1}`])) });
    if (!Number.isInteger(abilityIndex) || abilityIndex < 0 || abilityIndex >= abilityOptions.length) abilityIndex = 0;
    const ability = abilityOptions[abilityIndex];
    if (ability && (c.edition === '2014' || e.kind !== 'race')) {
      ABILITIES.forEach(a => { if (typeof ability[a] === 'number') { abilities[a] += ability[a]; trace[a].push(`${origin} ${ability[a] >= 0 ? '+' : ''}${ability[a]}`); } });
      const choose = ability.choose;
      if (choose?.weighted) {
        const used = new Set<string>();
        choose.weighted.weights.forEach((weight: number, i: number) => {
          const key = `${selection.id}:ability:${abilityIndex}:${i}`;
          requirement(key, `选择一项属性 +${weight}`, 'abilities', 1, origin, { options: choose.weighted.from, abilityBonus: weight });
          const picked = c.answers[key]?.[0];
          if (choose.weighted.from.includes(picked) && ABILITIES.includes(picked as Ability) && !used.has(picked)) { abilities[picked as Ability] += weight; trace[picked].push(`${origin} +${weight}`); used.add(picked); }
          else if (picked) issues.push({ id: key, message: `${e.name} 的属性选择重复或不适用。`, severity: 'error' });
        });
      } else if (choose?.from) {
        const key = `${selection.id}:ability`; requirement(key, `选择 ${choose.count || 1} 项属性 +${choose.amount || 1}`, 'abilities', choose.count || 1, origin, { options: choose.from, abilityBonus: choose.amount || 1 });
        for (const a of [...new Set(c.answers[key] || [])].slice(0, choose.count || 1)) if (choose.from.includes(a) && ABILITIES.includes(a as Ability)) { abilities[a as Ability] += choose.amount || 1; trace[a].push(`${origin} +${choose.amount || 1}`); }
      }
    }
    const skillBlocks = e.kind === 'class' ? (selection.id === classes[0]?.id ? raw.startingProficiencies?.skills : raw.multiclassing?.proficienciesGained?.skills) : raw.skillProficiencies;
    if (Array.isArray(skillBlocks)) {
      skillBlocks.forEach((block: any, index: number) => {
        Object.entries(block).forEach(([key, value]) => { if (value === true) grantSkill(key, origin); });
        if (block.choose || block.any) {
          const from = block.choose?.from?.map(skillKey) || Object.keys(SKILLS); const count = block.choose?.count || block.any || 1;
          const key = `${selection.id}:skills:${index}`;
          requirement(key, `选择 ${count} 项技能熟练`, 'proficiency', count, origin, { options: from });
          for (const selected of (c.answers[key] || []).slice(0, count)) if (from.includes(selected)) grantSkill(selected, origin);
        }
      });
    }
    if (selection.id === classes[0]?.id && Array.isArray(raw.proficiency)) raw.proficiency.forEach((a: string) => proficientSaves.add(a));
    if (Array.isArray(raw.feats)) raw.feats.forEach((block: any, i: number) => {
      const refs = Object.keys(block).filter(k => k !== 'any' && block[k] === true);
      requirement(`${selection.id}:feat:${i}`, '选择授予的专长', 'feat', refs.length || block.any || 1, origin, { kind: 'feat', refs });
    });
    if (e.kind === 'class') {
      const refs: string[] = (raw.classFeatures || []).flatMap((f: any) => { const ref = typeof f === 'string' ? f : f.classFeature; const n = Number(ref?.split('|')[3]); const source = ref?.split('|')[4] || ref?.split('|')[2] || 'PHB'; return ref && n <= selection.level && c.profile.enabledSources.includes(source.toUpperCase()) ? [ref] : []; });
      for (const ref of refs) {
        const name = ref.split('|')[0]; const id = `${selection.id}:feature:${ref}`;
        requirement(id, `填写「${name}」`, 'feature', 1, origin, { kind: 'feature', refs: [ref] });
      }
      const gainsSubclass = (raw.classFeatures || []).find((f: any) => f?.gainSubclassFeature && Number(f.classFeature?.split('|')[3]) <= selection.level);
      if (gainsSubclass) requirement(`${selection.id}:subclass`, `选择${raw.subclassTitle || '子职'}`, 'subclass', 1, origin, { kind: 'subclass', parentClass: { name: e.name, source: e.source } });
      const spellClass = { name: e.name, source: e.source };
      const rows = (raw.classTableGroups || []).find((g: any) => Array.isArray(g.rowsSpellProgression))?.rowsSpellProgression?.[selection.level - 1];
      const maxSpellLevel = rows ? rows.reduce((max: number, n: number, i: number) => n > 0 ? i + 1 : max, 0) : Math.min(9, Math.ceil(selection.level / 2));
      const cantrips = raw.cantripProgression?.[selection.level - 1];
      if (typeof cantrips === 'number' && cantrips > 0) requirement(`${selection.id}:cantrips`, `选择 ${cantrips} 个戏法`, 'spell', cantrips, origin, { kind: 'spell', spellLevel: 0, spellClass });
      const known = raw.spellsKnownProgression?.[selection.level - 1];
      const prepared = raw.preparedSpellsProgression?.[selection.level - 1];
      if (typeof known === 'number' && known > 0) requirement(`${selection.id}:known-spells`, `选择 ${known} 个已知法术`, 'spell', known, origin, { kind: 'spell', maxSpellLevel, spellClass });
      else if (typeof prepared === 'number' && prepared > 0) requirement(`${selection.id}:prepared-spells`, `选择 ${prepared} 个准备法术`, 'spell', prepared, origin, { kind: 'spell', maxSpellLevel, spellClass });
      else if (raw.preparedSpells) issues.push({ id: `prepared:${selection.id}`, message: `${e.name} 的准备数量取决于属性与规则，请按施法特性手动核对。`, severity: 'warning', selectionId: selection.id });
    }
    if (e.kind === 'subclass') {
      const parent = classes.find(s => s.entry.name === raw.className && s.entry.source === (raw.classSource || 'PHB').toUpperCase());
      if (!parent) issues.push({ id: `subclass:${selection.id}`, message: `${e.name} 尚无匹配的职业与版本。`, severity: 'error', selectionId: selection.id });
      for (const ref of raw.subclassFeatures || []) if (typeof ref === 'string' && Number(ref.split('|')[5]) <= (parent?.level || 0)) requirement(`${selection.id}:feature:${ref}`, `填写「${ref.split('|')[0]}」`, 'feature', 1, origin, { kind: 'feature', refs: [ref] });
    }
    if (e.kind === 'feature' && /Ability Score Improvement/i.test(e.english)) {
      if (e.edition === '2024') requirement(`${selection.id}:asi-feat`, '选择属性值提升或通用专长', 'feat', 1, origin, { kind: 'feat', featCategory: 'G' });
      else {
        const key = `${selection.id}:asi-mode`;
        const modes = c.profile.optional.feats ? ['two', 'split', 'feat'] : ['two', 'split'];
        requirement(key, '选择本次成长', 'abilities', 1, origin, { options: modes, optionLabels: { two: '一项属性 +2', split: '两项属性各 +1', feat: '选择专长' } });
        const mode = c.answers[key]?.[0];
        if (mode === 'feat' && c.profile.optional.feats) requirement(`${selection.id}:asi-feat`, '选择成长专长', 'feat', 1, origin, { kind: 'feat' });
        else if (mode === 'two' || mode === 'split') {
          const count = mode === 'two' ? 1 : 2; const amount = mode === 'two' ? 2 : 1; const pick = `${selection.id}:asi-${mode}`;
          requirement(pick, `选择 ${count} 项属性 +${amount}`, 'abilities', count, origin, { options: [...ABILITIES] });
          for (const a of [...new Set(c.answers[pick] || [])].slice(0, count)) if (ABILITIES.includes(a as Ability)) { abilities[a as Ability] = Math.min(20, abilities[a as Ability] + amount); trace[a].push(`${origin} +${amount}（上限20）`); }
        }
      }
    }
    let optionIndex = 0;
    function scanOptions(value: unknown, depth = 0) {
      if (depth > 12 || !value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(v => scanOptions(v, depth + 1)); return; }
      const block = value as Record<string, any>;
      if (block.type === 'options' && Array.isArray(block.entries)) {
        const refs = block.entries.map((v: any) => v.optionalfeature || v.classFeature || v.subclassFeature).filter((v: unknown) => typeof v === 'string');
        const id = `${selection.id}:text-option:${optionIndex++}`;
        if (refs.length === block.entries.length && refs.length) requirement(id, block.name || '选择特性中的选项', 'feature', block.count || 1, origin, { kind: 'feature', refs });
        else { const options = block.entries.map((v: any) => typeof v === 'string' ? v : v.name).filter(Boolean); if (options.length) requirement(id, block.name || '记录特性中的选择', 'feature', block.count || 1, origin, { options }); }
        return;
      }
      for (const k of ['entries', 'items', 'entry']) scanOptions(block[k], depth + 1);
    }
    scanOptions(raw.entries);
    for (const choice of e.choices || []) {
      const key = `${selection.id}:custom:${choice.id}`;
      requirement(key, choice.label, choice.kind || 'proficiency', choice.count, origin, choice);
      if (!choice.kind) for (const answer of (c.answers[key] || []).slice(0, choice.count)) if (choice.options?.includes(answer)) grantSkill(answer, origin);
    }
    for (const effect of e.effects || []) {
      if (effect.op === 'proficiency') grantSkill(effect.skill, origin);
      else if (ABILITIES.includes(effect.target as Ability)) {
        const a = effect.target as Ability; abilities[a] = effect.op === 'set' ? effect.value : abilities[a] + effect.value;
        trace[a].push(`${origin} ${effect.op === 'set' ? '=' : '+'}${effect.value}`);
      } else if (effect.target === 'speed') speed = effect.op === 'set' ? effect.value : speed + effect.value;
      else if (effect.target === 'ac') { if (effect.op === 'set') acOverride = effect.value; else acBonus += effect.value; }
      else if (effect.target === 'hp') hpBonus += effect.value;
    }
    if (['feature', 'feat', 'subclass', 'race', 'background'].includes(e.kind)) {
      const key = `${selection.id}:review`;
      if (!c.reviewed.includes(selection.id)) requirements.push({ id: key, label: '核对特性中的特殊效果', section: e.kind, count: 1, selected: [], complete: false, origin, review: true });
    }
  }
  const modifiers = Object.fromEntries(ABILITIES.map(a => [a, Math.floor((abilities[a] - 10) / 2)])) as Record<Ability, number>;
  const skills = Object.fromEntries(Object.entries(SKILLS).map(([key, s]) => [key, { value: modifiers[s.ability] + (skillSources[key]?.length ? proficiency : 0), proficient: !!skillSources[key]?.length, sources: skillSources[key] || [] }]));
  let ac = acOverride ?? (10 + modifiers.dex);
  const armors = active.filter(s => s.entry.kind === 'item' && s.equipped && typeof s.entry.raw.ac === 'number');
  const armor = armors.filter(s => !String(s.entry.raw.type).startsWith('S'));
  const shields = armors.filter(s => String(s.entry.raw.type).startsWith('S'));
  if (armor.length > 1 || shields.length > 1) issues.push({ id: 'armor', message: '同时装备了多件护甲或盾牌，请选择生效的一件。', severity: 'error' });
  if (armor[0]) {
    const raw = armor[0].entry.raw; const t = String(raw.type);
    ac = raw.ac + (t.startsWith('HA') ? 0 : t.startsWith('MA') ? Math.min(2, modifiers.dex) : modifiers.dex);
  }
  ac += (shields[0]?.entry.raw.ac || 0) + acBonus;
  const hpFromClasses = classes.reduce((sum, s, i) => { const faces = Number(s.entry.raw.hd?.faces || 8); return sum + (i === 0 ? faces + (s.level - 1) * (Math.floor(faces / 2) + 1) : s.level * (Math.floor(faces / 2) + 1)); }, 0);
  let maxHp = Math.max(1, (c.baseHp > 0 ? c.baseHp : hpFromClasses + modifiers.con * level) + hpBonus);
  trace.ac = [armor[0] ? `${armor[0].entry.name} ${armor[0].entry.raw.ac}` : `基础 10 + 敏捷 ${modifiers.dex}`, ...(shields[0] ? [`${shields[0].entry.name} +${shields[0].entry.raw.ac}`] : []), ...(acBonus ? [`规则修正 +${acBonus}`] : [])];
  trace.hp = [c.baseHp > 0 ? `手动生命值上限 ${c.baseHp}` : `首级生命骰满值、以后取固定平均值 ${hpFromClasses} + 体质 ${modifiers.con} × ${level}`, ...(hpBonus ? [`规则修正 +${hpBonus}`] : [])];
  trace.proficiency = [`总等级 ${level || 1}`]; trace.speed = [active.find(s => s.entry.kind === 'race')?.entry.name || '默认步行速度'];
  // Orphaned choices remain in the document for undo/review, never silently deleted.
  const invalid = active.filter(s => s.requirementId && (!requirements.some(r => r.id === s.requirementId) || requirementMismatch(s.entry, requirements.find(r => r.id === s.requirementId)!)));
  if (invalid.length) {
    const next = new Set([...excluded, ...invalid.map(s => s.id)]);
    return evaluate(c, next, [...inheritedIssues, ...invalid.map(s => ({ id: `orphan:${s.id}`, message: `${s.entry.name} 原来的填写要求已改变，保留条目但暂停效果。请重新填写或解除关联。`, severity: 'error' as const, selectionId: s.id }))]);
  }
  const saves = Object.fromEntries(ABILITIES.map(a => [a, { value: modifiers[a] + (proficientSaves.has(a) ? proficiency : 0), proficient: proficientSaves.has(a) }])) as Derived['saves'];
  let initiative = modifiers.dex; let passive = 10 + skills.perception.value;
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
  if (r?.spellLevel !== undefined && e.raw.level !== r.spellLevel) return r.spellLevel === 0 ? '这里需要戏法' : '法术环阶不符';
  if (r?.maxSpellLevel !== undefined && (e.raw.level < 1 || e.raw.level > r.maxSpellLevel)) return '法术环阶不在当前职业等级范围';
  if (r?.spellClass && !e.raw._spellClasses?.[r.spellClass.source]?.[r.spellClass.name]) return e.raw._spellClassLookupLoaded ? '不在这个职业的法术列表中' : '缺少职业法术索引，更新资料后重试';
  if (r?.parentClass && (e.raw.className !== r.parentClass.name || (e.raw.classSource || 'PHB').toUpperCase() !== r.parentClass.source)) return '子职所属职业或规则版本不符';
  if (r?.featCategory && e.raw.category !== r.featCategory) return '专长类别不符';
  if (r?.featureType && !r.featureType.some(t => e.raw.featureType?.includes(t))) return '特性类型不符';
  return undefined;
}
export function candidateReason(c: Character, e: Entry, r?: Requirement): string | undefined {
  if (e.kind === 'feat' && !c.profile.optional.feats) return '当前角色未启用专长选项';
  if (!selectionAllowed(c, e)) return '此来源或规则版本未启用';
  const mismatch = requirementMismatch(e, r); if (mismatch) return mismatch;
  const existing = c.selections.some(s => s.entry.id === e.id && (!r || s.requirementId === r.id));
  if (existing && e.kind !== 'item' && !e.raw.repeatable) return '这个条目已经在角色卡中';
  const prereqs = e.raw.prerequisite;
  if (Array.isArray(prereqs) && prereqs.length) {
    const d = evaluate(c);
    const fits = prereqs.some((p: any) => {
      const level = typeof p.level === 'number' ? p.level : p.level?.level;
      if (level && d.level < level) return false;
      if (p.ability && !p.ability.some((a: any) => Object.entries(a).every(([key, value]) => d.abilities[key as Ability] >= Number(value)))) return false;
      return true;
    });
    if (!fits) return '等级或属性尚未满足条目前提';
  }
  return undefined;
}
export function choiceLabel(value: string): string { return ABILITY_LABELS[value as Ability] || SKILLS[value]?.name || value; }
