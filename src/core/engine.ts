import {planFeatureResources} from './automation/featureResources';
import {irRuntimeGaps,irGapLabel} from './automation/capabilities';
import {irMechanics,irGrantValues,irModifierValue,applyIrNumber,irAbilityScores,irSelectionActive,irFormulaValues,irModifierOrder,irAbilityProjection} from './automation/ir';
import {sheetChoices} from './automation/choices';
import {matchesReference} from './entryReferences';
import {hitPointLevels} from './hitPoints';
import {automationEnabled} from './automation/state';
import {evaluateArmor,automationCompatibilityIssue} from './automation/equipment';
import { ABILITIES, ABILITY_LABELS, SKILLS, skillKey, selectionAllowed, selectionEffectsAllowed, editionAllows, entryEdition, subclassOwner, type Ability, type Character, type Derived, type Entry, type Requirement } from './model';

export function evaluate(c: Character, excluded = new Set<string>(), inheritedIssues: Derived['issues'] = []): Derived {
  const abilityView=automationEnabled(c)?irAbilityProjection({...c,selections:c.selections.filter(row=>!excluded.has(row.id))}):undefined,abilities=abilityView?.scores||{...c.abilities}; const trace: Record<string, string[]> = {};
  ABILITIES.forEach(a => trace[a] = abilityView?abilityView.trace[a]:[`基础 ${abilities[a]}`]);
  const issues: Derived['issues'] = [...inheritedIssues]; const requirements: Requirement[] = [];
  const compatibility=automationCompatibilityIssue(c);if(compatibility)issues.push(compatibility);
  const active = c.selections.filter(s => {
    if(s.grantKey?.startsWith('choice:')&&!automationEnabled(c))return false;
    if (excluded.has(s.id)) return false;
    let owner = s; const seen = new Set<string>();
    while (owner.parentId && !seen.has(owner.id)) { seen.add(owner.id); const parent = c.selections.find(p => p.id === owner.parentId); if (!parent || !selectionEffectsAllowed(c, parent.entry)) return false; owner = parent; }
    if (selectionEffectsAllowed(c, s.entry)) return irSelectionActive(c,s);
    issues.push({ id: `disabled:${s.id}`, message: `${s.entry.name} 的来源、依赖或规则选项未启用，保留内容但不计效果。`, selectionId: s.id, severity: 'error' }); return false;
  });
  const classes = active.filter(s => s.entry.kind === 'class');
  const level = classes.reduce((sum, s) => sum + s.level, 0);
  const proficiency = automationEnabled(c)&&active.length?irFormulaValues(c,classes[0]||active[0],abilities)['@prof']:2+Math.floor((Math.max(1,level)-1)/4)+(c.sheetBonuses?.proficiency||0);
  const skillSources: Record<string, string[]> = {}; const proficientSaves = new Set<string>();
  const grantSkill = (s: string, origin: string) => { const key = skillKey(s); if (SKILLS[key]) (skillSources[key] ??= []).push(origin); };
  let speed=30;
  const automaticExpertise=new Set<string>();
  const pendingModifiers:{row:typeof active[number];modifier:NonNullable<NonNullable<Entry['automation']>['mechanics']>['modifiers'] extends (infer T)[]|undefined?T:never}[]=[];
  for (const selection of active) {
    const e=selection.entry,origin=`${e.name} · ${e.source}`,record=e.automation;
    if(automationEnabled(c)){
      if(!e.raw._contentOnly&&(!record||record.verdict==='needsAnnotation'))issues.push({id:`automation-data:${selection.id}`,selectionId:selection.id,severity:'warning',message:`${e.name}：${record?'规则待注释，尚未执行。':'此版本缺少规则数据，尚未执行。'}`});
      if(record?.verdict==='unsupported')issues.push({id:`automation-gap:${selection.id}`,selectionId:selection.id,severity:'warning',message:`${e.name}：部分机制需手动处理（${record.unsupported.map(item=>item.family).join('、')}）。`});
      const runtimeGaps=irRuntimeGaps(e);if(runtimeGaps.length)issues.push({id:`automation-runtime:${selection.id}`,selectionId:selection.id,severity:'warning',message:`${e.name}：本客户端尚未自动处理 ${runtimeGaps.map(irGapLabel).join('、')}，请人工记录。`});
      const model=irMechanics(e);
      for(const grant of model?.grants||[])for(const value of irGrantValues(c,selection,grant)){
        if(grant.type==='skillProficiency')grantSkill(value,origin);
        if(grant.type==='expertise'){const key=skillKey(value);if(SKILLS[key]){automaticExpertise.add(key);grantSkill(key,origin);}}
        if(grant.type==='savingThrow')proficientSaves.add(value);
      }
      for(const modifier of model?.modifiers||[])if(!ABILITIES.includes(modifier.target as Ability))pendingModifiers.push({row:selection,modifier});
      if(e.kind==='race'&&model?.grants?.some(grant=>grant.type==='abilityScore'&&grant.choose&&irGrantValues(c,selection,grant).length<grant.choose.count))issues.push({id:`racial-ability:unsupported:${selection.id}`,selectionId:selection.id,severity:'warning',message:`${e.name}：属性分配尚未完成，保存的基础属性保留。`});
    }
  }
  for (const [key, value] of Object.entries(c.proficiencies || {})) {
    if (key.startsWith('save:')) { if (value) proficientSaves.add(key.slice(5)); else proficientSaves.delete(key.slice(5)); }
    else if (SKILLS[key]) { skillSources[key] = value ? ['手动记录'] : []; }
  }
  const modifiers = Object.fromEntries(ABILITIES.map(a => [a, Math.floor((abilities[a] - 10) / 2)])) as Record<Ability, number>;
  const skills = Object.fromEntries(Object.entries(SKILLS).map(([key, s]) => {
    const expertise = c.expertise?.[key]??automaticExpertise.has(key), proficient = expertise || !!skillSources[key]?.length;
    const half = c.jackOfAllTrades && !proficient ? Math.floor(proficiency / 2) : 0;
    return [key, { value: modifiers[s.ability] + (proficient ? proficiency * (expertise ? 2 : 1) : half), proficient, expertise, sources: [...(skillSources[key] || []), ...(expertise ? ['专精'] : half ? ['万事通'] : [])] }];
  }));
  const armor=automationEnabled(c)?evaluateArmor(c,active,modifiers.dex):undefined;
  if(armor)issues.push(...armor.issues);
  let ac = (armor?.base ?? (10 + modifiers.dex))+(armor?.bonus||0);
  const hpFromClasses = hitPointLevels(c,modifiers.con,classes).reduce((sum,r)=>sum+r.hp,0);
  let maxHp = Math.max(1, (c.baseHp > 0 ? c.baseHp : hpFromClasses));
  trace.ac = [...(armor?.trace||[`基础 10 + 敏捷 ${modifiers.dex}`])];
  trace.hp = [c.baseHp > 0 ? `手动生命值上限 ${c.baseHp}` : `首级满骰、以后${c.hpProgression?.mode==='rolled'?'逐级骰值':'固定平均值'}，含体质 ${modifiers.con}，每级最少 1 点：${hpFromClasses}`];
  trace.proficiency = [`总等级 ${level || 1}：基础熟练加值 ${2+Math.floor((Math.max(1,level)-1)/4)}`]; trace.speed = ['默认步行速度 30'];
  const saves = Object.fromEntries(ABILITIES.map(a => [a, { value: modifiers[a] + (proficientSaves.has(a) ? proficiency : 0), proficient: proficientSaves.has(a) }])) as Derived['saves'];
  const initialPerception=skills.perception.value;
  let initiative = modifiers.dex + (c.jackOfAllTrades && c.edition === '2014' ? Math.floor(proficiency / 2) : 0); let passive = 10 + skills.perception.value;
  trace.initiative=[`敏捷调整值 ${modifiers.dex}`,...(c.jackOfAllTrades&&c.edition==='2014'?[`万事通 +${Math.floor(proficiency/2)}`]:[])];
  trace.passive=[`基础 10 + 察觉 ${skills.perception.value}`];
  for(const {row,modifier}of pendingModifiers.sort((a,b)=>irModifierOrder(a.modifier,b.modifier))){
    if(modifier.target==='ac'&&armor?.rules.some(rule=>rule.origin.selectionId===row.id))continue;
    try{
      const value=irModifierValue(c,row,modifier,abilities);if(typeof value!=='number')continue;
      const target=modifier.target;
      if(target==='ac')ac=applyIrNumber(ac,modifier,value);
      else if(target==='hp')maxHp=applyIrNumber(maxHp,modifier,value);
      else if(target==='speed.walk')speed=applyIrNumber(speed,modifier,value);
      else if(target==='initiative')initiative=applyIrNumber(initiative,modifier,value);
      else if(target==='passive')passive=applyIrNumber(passive,modifier,value);
      else if(target.startsWith('skill:')&&skills[skillKey(target.slice(6))]){const key=skillKey(target.slice(6));skills[key].value=applyIrNumber(skills[key].value,modifier,value);skills[key].sources.push(row.entry.name);}
      else if(target.startsWith('save:')&&saves[target.slice(5) as Ability])saves[target.slice(5) as Ability].value=applyIrNumber(saves[target.slice(5) as Ability].value,modifier,value);
      else continue;
      (trace[target==='speed.walk'?'speed':target]||=[]).push(`${row.entry.name} · ${row.entry.source}：${modifier.op} ${value}`);
    }catch{issues.push({id:`formula:${row.id}:${modifier.target}`,selectionId:row.id,severity:'warning',message:`${row.entry.name}：规则公式尚未绑定，未应用 ${modifier.target}。`});}
  }
  if(automationEnabled(c))for(const cls of classes)if(!irMechanics(cls.entry)?.classModel?.hitDie&&!c.baseHp)issues.push({id:`hit-die:${cls.id}`,selectionId:cls.id,severity:'warning',message:`${cls.entry.name}：生命骰规则缺失，请填写手动生命值上限。`});
  for (const adjustment of c.adjustments || []) {
    if (!adjustment.reason.trim()) continue;
    const { target, value } = adjustment;
    if (target === 'ac') ac = value; else if (target === 'hp') maxHp = value; else if (target === 'speed') speed = value;
    else if (target === 'initiative') initiative = value; else if (target === 'passive') passive = value;
    else if (target.startsWith('skill:') && skills[target.slice(6)]) skills[target.slice(6)].value = value;
    else if (target.startsWith('save:') && saves[target.slice(5) as Ability]) saves[target.slice(5) as Ability].value = value;
    (trace[target] ??= []).push(`人工修正为 ${value}：${adjustment.reason}`);
  }
  for (const [key,value] of Object.entries(c.skillBonuses || {})) if (skills[key] && value) {
    skills[key].value += value;
    const note=`技能额外调整 ${value >= 0 ? '+' : ''}${value}`;
    skills[key].sources.push(note);(trace['skill:'+key] ||= []).push(note);
  }
  if (!(c.adjustments || []).some(a => a.target === 'passive')) {passive+=skills.perception.value-initialPerception;trace.passive[0]=`基础 10 + 察觉 ${skills.perception.value}`;}
  ac += c.sheetBonuses?.ac || 0;
  initiative += c.sheetBonuses?.initiative || 0;
  speed += c.sheetBonuses?.speed || 0;
  passive += c.sheetBonuses?.passive || 0;
  maxHp += c.sheetBonuses?.hp || 0;
  for (const [target, value] of Object.entries(c.sheetBonuses || {})) if (value) (trace[target] ??= []).push(`卡面调整 ${value >= 0 ? '+' : ''}${value}`);
  issues.push(...planFeatureResources(c).issues);
  for(const [key,skill] of Object.entries(SKILLS))trace[`skill:${key}`]=[`${ABILITY_LABELS[skill.ability]}调整值 ${modifiers[skill.ability]}`,...skills[key].sources.map(s=>`来源：${s}`),...(skills[key].proficient?[`${skills[key].expertise?'两倍熟练':'熟练加值'} +${proficiency*(skills[key].expertise?2:1)}`]:c.jackOfAllTrades?[`万事通 +${Math.floor(proficiency/2)}`]:[]),...(c.adjustments||[]).filter(a=>a.target===`skill:${key}`).map(a=>`人工覆盖 ${a.value}：${a.reason}`)];
  for(const a of ABILITIES)trace[`save:${a}`]=[`${ABILITY_LABELS[a]}调整值 ${modifiers[a]}`,...(saves[a].proficient?[`熟练加值 +${proficiency}`]:[]),...(c.adjustments||[]).filter(v=>v.target===`save:${a}`).map(v=>`人工覆盖 ${v.value}：${v.reason}`)];
  for(const a of ABILITIES)trace[`mod:${a}`]=[...(trace[a]||[]),`最终属性 ${abilities[a]}：向下取整 (属性 − 10) / 2`];
  return { abilities, modifiers, level, proficiency, ac, initiative, speed, maxHp, passive,
    skills, saves, requirements, issues, trace,
    hitDice: classes.map(s => `${s.level}d${irMechanics(s.entry)?.classModel?.hitDie || '?'}`).join(' + ') || '—' };
}

export function requirementMismatch(e: Entry, r?: Partial<Requirement>): string | undefined {
  if (r?.kind && r.kind !== e.kind) return '这不是该位置需要的条目类型';
  if (r?.refs?.length) {
    const match = r.refs.some(ref => matchesReference(e,ref));
    if (!match) return '此要求限定了特定条目或来源';
  }
  return undefined;
}
export function candidateReason(c: Character, e: Entry, r?: Requirement): string | undefined {
  if(e.kind==='class'&&!c.profile.optional.multiclass&&c.selections.some(s=>s.entry.kind==='class'&&s.entry.id!==e.id))return '当前规则未启用兼职，不能加入第二个职业';
  if(c.profile.disabledEntries?.includes(e.id))return '此条目已在规则与扩展中单独禁用';
  if(e.kind==='subclass'&&!subclassOwner(c,e))return '需要先加入该子职所属的职业';
  if (e.kind === 'feat' && !c.profile.optional.feats) return '当前角色未启用专长选项';
  if (!selectionAllowed(c, e)) {
    if(!editionAllows(e,c.edition,c.profile.optional.legacy))return `此条目属于 ${entryEdition(e)} 规则，当前角色使用 ${c.edition}；请核对规则与扩展中的版本设置`;
    if(!c.profile.enabledSources.includes(e.source))return `来源 ${e.source} 未启用，请在规则与扩展中核对`;
    const missing=e.dependencies?.filter(id=>!c.profile.enabledSources.includes(id));
    if(missing?.length)return `此条目需要先启用依赖来源：${missing.join('、')}`;
    return '此条目当前未获准加入，请核对规则与扩展';
  }
  const mismatch = requirementMismatch(e, r); if (mismatch) return mismatch;
  const existing = c.selections.some(s => s.entry.id === e.id && (!r || s.requirementId === r.id));
  if(e.kind==='class'&&c.selections.filter(s=>s.entry.kind==='class').reduce((sum,s)=>sum+s.level,0)>=20)return '职业总等级已达到 20';
  if (existing && e.kind !== 'class' && e.kind !== 'item' && !e.raw.repeatable) return '这个条目已经在角色卡中';

  return undefined;
}
export function choiceLabel(value: string): string { return ABILITY_LABELS[value as Ability] || SKILLS[value]?.name || value; }
