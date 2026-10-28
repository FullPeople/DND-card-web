import {projectVariantItemResistanceBonuses} from './automation/variantItemResistanceBonuses';
import {projectRacialResistances} from './automation/racialResistances';
import {projectRacialNaturalArmor,racialNaturalArmorFamilyId} from './automation/racialNaturalArmor';
import {projectSourceLevelHp,sourceLevelHpLegacyHpSelection} from './automation/sourceLevelHp';
import {projectItemAffineHp,itemAffineHpLegacyHpSelection} from './automation/itemAffineHp';
import {projectClassMovement,projectClassMovementModes} from './automation/classMovement';
import {projectRelativeRacialMovement} from './automation/relativeRacialMovement';
import {projectItemResistanceBonuses} from './automation/itemResistanceBonuses';
import {projectItemPassiveBonuses} from './automation/itemPassiveBonuses';
import {projectItemAbilityFloors} from './automation/itemAbilityFloors';
import {projectRacialMovement} from './automation/racialMovement';
import {projectRacialDarkvision} from './automation/racialDarkvision';
import {evaluateReviewedAlert} from './automation/reviewedAlert';
import {reviewedObservantHasRetainedBinding} from './automation/reviewedObservant';
import {evaluateReviewedSkilled} from './automation/reviewedSkilled';
import {reviewedWeaponMasterIdentity,reviewedSkilledIdentity,reviewedLinguistIdentity,reviewedObservantIdentity,reviewedAlertIdentity} from './automation/reviewedFeatIdentity';
import {evaluateAbilityAdvancements} from './automation/abilityAdvancements';
import {evaluateInfusions} from './automation/infusions';
import {invocationSkillScope,learnedInvocationRule} from './automation/invocations';
import {planFeatureResources} from './automation/featureResources';
import {activeEffectSelections} from './automation/active';
import {baseAbilityScores} from './automation/baseAbilities';
import {sheetChoices} from './automation/choices';
import {matchesReference} from './entryReferences';
import {hitPointLevels} from './hitPoints';
import {automationEnabled} from './automation/state';
import {evaluateArmor,automationCompatibilityIssue} from './automation/equipment';
import {evaluateFeatureArmor,unhandledFeatureArmorText} from './automation/featureArmor';
import { ABILITIES, ABILITY_LABELS, SKILLS, skillKey, selectionAllowed, selectionEffectsAllowed, editionAllows, entryEdition, subclassOwner, type Ability, type Character, type Derived, type Entry, type Requirement } from './model';

export function evaluate(c: Character, excluded = new Set<string>(), inheritedIssues: Derived['issues'] = []): Derived {
  const issues: Derived['issues'] = [...inheritedIssues]; const requirements: Requirement[] = [];
  const compatibility=automationCompatibilityIssue(c);if(compatibility)issues.push(compatibility);
  const active=activeEffectSelections(c,excluded);
  const itemPassives=projectItemPassiveBonuses(c,active);issues.push(...itemPassives.issues);
  const itemResistance=projectItemResistanceBonuses(c,active);issues.push(...itemResistance.issues);
  const variantResistance=projectVariantItemResistanceBonuses(c,active);issues.push(...variantResistance.issues);
  const racialResistance=projectRacialResistances(c,active);issues.push(...racialResistance.issues);
  const racialSenses=projectRacialDarkvision(c,active);issues.push(...racialSenses.issues);
  const racialMovement=projectRacialMovement(c,active);issues.push(...racialMovement.issues);
  const classMovement=projectClassMovement(c,active);issues.push(...classMovement.issues);
  for(const s of c.selections)if(!excluded.has(s.id)&&!selectionEffectsAllowed(c,s.entry))issues.push({id:`disabled:${s.id}`,message:`${s.entry.name} 的来源、依赖或规则选项未启用，保留内容但不计效果。`,selectionId:s.id,severity:'error'});
  const baseAbilities=baseAbilityScores(c,active),abilities=baseAbilities.abilities,trace:Record<string,string[]>=baseAbilities.trace;issues.push(...baseAbilities.issues);
  const classes = active.filter(s => s.entry.kind === 'class');
  const level = classes.reduce((sum, s) => sum + s.level, 0);
  const proficiency = 2 + Math.floor((Math.max(1, level) - 1) / 4) + (c.sheetBonuses?.proficiency || 0);
  const skillSources: Record<string, string[]> = {}; const proficientSaves = new Set<string>();
  const grantSkill = (s: string, origin: string) => { const key = skillKey(s); if (SKILLS[key]) (skillSources[key] ??= []).push(origin); };
  const raceSpeed = active.find(s => s.entry.kind === 'race')?.entry.raw.speed;
  const walking=typeof raceSpeed==='number'?raceSpeed:raceSpeed?.walk;
  let speed = typeof walking==='number'?walking:typeof walking?.number==='number'?walking.number:30; let acBonus = 0; let hpBonus = 0; let acOverride: number | undefined; let hpOverride: number | undefined;
  speed+=classMovement.walkingBonus;
  const sizes = new Set<string>();
  const effectTrace:Record<string,string[]>={ac:[],hp:[],speed:[]};
  const invocationSkillsApplied=new Set<string>();
  for (const selection of active) {
    const e = selection.entry; const origin = `${e.name} · ${e.source}`; const raw = e.raw;
    const invocationScope=invocationSkillScope(c,selection);
    const invocation=invocationScope==='grant'?learnedInvocationRule(c,selection):undefined;
    const skillInvocation=invocation?.mechanism==='skills'?invocation:undefined;
    if(skillInvocation&&!invocationSkillsApplied.has(skillInvocation.reference)){
      for(const skill of skillInvocation.skills!)grantSkill(skill,origin);
      invocationSkillsApplied.add(skillInvocation.reference);
    }
    if(invocationScope==='grant'&&!invocation)issues.push({id:`invocation-skills:${selection.id}`,selectionId:selection.id,severity:'warning',message:`${e.name}：祈唤未通过当前职业学习授权或声明已变化；保留记录，不自动授予技能熟练，手工熟练与专精仍保留。`});
    if(selection.grantKey?.startsWith('choice:')&&!e.effects?.length&&!['skillProficiencies','armorProficiencies','weaponProficiencies','toolProficiencies','additionalSpells'].some(key=>raw[key])&&/(?:获得|学会).*(?:加值|熟练|受训|戏法|法术)/.test(unhandledFeatureArmorText(e)))issues.push({id:`choice-rule:${selection.id}`,selectionId:selection.id,severity:'warning',message:`${e.name}：选择已记录，正文中的数值、熟练或授予规则待适配。`});
    if (raw._copy || raw._unresolvedParent) issues.push({ id: `copy:${selection.id}`, message: `${e.name} 使用尚未完整展开的继承资料，部分效果需要人工核对。`, severity: 'warning', selectionId: selection.id });
    // Preserve the existing unsupported-choice notice, including for XPHB,
    // but never let a manual/edited Weapon Master raw or effects field bypass
    // the separate explicitly owned PHB training/ability grant.
    if(reviewedAlertIdentity(e)){issues.push({id:`reviewed-alert-manual:${selection.id}`,selectionId:selection.id,severity:'warning',message:'手工警觉条目与旧答案保留；只有真实职业属性提升位置另行确认先攻 +5 未计入手工数值后才生效。突袭、未见攻击者、状态与掷骰顺序仍手工。'});continue;}
    if(reviewedObservantIdentity(e)){issues.push({id:`reviewed-observant-manual:${selection.id}`,selectionId:selection.id,severity:'warning',message:'手工观察力与旧答案保留；此历史机制不属于本批受审。真实职业属性提升须另行确认属性与两项被动值未计入手工数值；唇读和情境优势／劣势仍手工。'});continue;}
    if(reviewedLinguistIdentity(e)){issues.push({id:`reviewed-linguist-manual:${selection.id}`,selectionId:selection.id,severity:'warning',message:'手工语言学家条目与旧手工语言答案保留；旧机制不属于本批受审。固定智力和三语言只支持真实职业属性提升位置另行确认；密码、解码与教学仍手工。'});continue;}
    if(reviewedSkilledIdentity(e)){issues.push({id:`reviewed-skilled-manual:${selection.id}`,selectionId:selection.id,severity:'warning',message:'手工熟习条目保留。本批只支持真实职业属性提升位置中另行确认的三项技能或工具熟练；此条目不自动授予效果。'});continue;}
    if(reviewedWeaponMasterIdentity(e))continue;
    // Background ability choices are annotations. The sheet's base scores
    // already contain the player's allocation, so do not apply it a second time.
    if (e.kind === 'race') {
      (raw.size || []).forEach((s: string) => sizes.add(s));
    }
    // Choices are explicit saved answers; evaluation never creates an answer or grant.
    const skillBlocks = invocationScope ? undefined : e.kind === 'class' ? (selection.id===classes[0]?.id?raw.startingProficiencies?.skills:raw.multiclassing?.proficienciesGained?.skills) : raw.skillProficiencies;
    for (const block of Array.isArray(skillBlocks) ? skillBlocks : []) {
      for (const [key, value] of Object.entries(block || {})) if (value === true) grantSkill(key, origin);
    }
    if (selection.id === classes[0]?.id && Array.isArray(raw.proficiency)) raw.proficiency.forEach((a: string) => proficientSaves.add(a));
    // Retain already recorded skill choices from older backups, without quota limits.
    if(!invocationScope)for (const [key, values] of Object.entries(c.answers)) if (key.startsWith(`${selection.id}:skills:`) || key.startsWith(`${selection.id}:custom:`)) values.forEach(value => grantSkill(value, origin));
    for (const effect of invocationScope ? [] : e.effects || []) {
      // Recognized innate-AC sources use their complete proof, not a changed
      // snapshot's legacy AC field. Other mechanisms and CUSTOM entries retain
      // their established executors.
      if(effect.op!=='proficiency'&&effect.target==='ac'&&racialNaturalArmorFamilyId(e))continue;
      if(effect.op!=='proficiency'&&effect.target==='hp'&&sourceLevelHpLegacyHpSelection(c,selection)){
        const id=`source-level-hp:legacy:${selection.id}`;if(!issues.some(issue=>issue.id===id))issues.push({id,selectionId:selection.id,severity:'warning',message:`${e.name}：此来源的旧平面生命值效果不能代替完整归属和明确核对；原记录保留，未借旧执行器追加生命值。`});
        continue;
      }
      if(effect.op!=='proficiency'&&effect.target==='hp'&&itemAffineHpLegacyHpSelection(c,selection)){
        const id=`item-affine-hp:legacy:${selection.id}`;if(!issues.some(issue=>issue.id===id))issues.push({id,selectionId:selection.id,severity:'warning',message:`${e.name}：此物品来源的旧平面生命值效果不能代替完整物理归属、当前同调／穿戴条件和明确核对；原记录保留，未借旧执行器追加生命值。`});
        continue;
      }
      if (effect.op === 'proficiency') grantSkill(effect.skill, origin);
      else if (ABILITIES.includes(effect.target as Ability)) {
        // Applied once by the shared pre-advancement score layer.
      } else if (effect.target === 'speed') {speed = effect.op === 'set' ? effect.value : speed + effect.value;effectTrace.speed.push(`${origin} ${effect.op==='set'?'=':effect.value<0?'':'+'}${effect.value}`);}
      else if (effect.target === 'ac') { if (effect.op === 'set') acOverride = effect.value; else acBonus += effect.value;effectTrace.ac.push(`${origin} ${effect.op==='set'?'=':effect.value<0?'':'+'}${effect.value}`); }
      else if (effect.target === 'hp') { if (effect.op === 'set') hpOverride = effect.value; else hpBonus += effect.value;effectTrace.hp.push(`${origin} ${effect.op==='set'?'=':effect.value<0?'':'+'}${effect.value}`); }
    }
  }
  const skilled=evaluateReviewedSkilled(c,active);issues.push(...skilled.issues);for(const skill of skilled.skills)grantSkill(skill.key,skill.source);
  const {asi,reviewed:reviewedFeats,linguist,observant}=evaluateAbilityAdvancements(c,abilities,active);issues.push(...asi.issues);
  for(const a of ABILITIES){abilities[a]+=asi.bonuses[a];trace[a].push(...asi.trace[a]);}
  issues.push(...reviewedFeats.issues,...linguist.issues,...observant.issues);
  for(const a of ABILITIES){abilities[a]+=observant.bonuses[a];trace[a].push(...observant.trace[a]);}
  for(const a of ABILITIES){abilities[a]+=linguist.bonuses[a];trace[a].push(...linguist.trace[a]);}
  for(const a of ABILITIES){abilities[a]+=reviewedFeats.bonuses[a];trace[a].push(...reviewedFeats.trace[a]);if(reviewedFeats.saves.has(a))proficientSaves.add(a);}
  // Equipment floors follow all natural advancement caps, never feed them.
  const naturalAbilities={...abilities},itemFloors=projectItemAbilityFloors(c,active);issues.push(...itemFloors.issues);
  for(const a of ABILITIES)if(itemFloors.floors[a]!==undefined){abilities[a]=Math.max(abilities[a],itemFloors.floors[a]!);trace[a].push(...(itemFloors.trace[a]||[]));}
  const equipmentChangedAbilities=ABILITIES.some(a=>abilities[a]!==naturalAbilities[a]);
  if(equipmentChangedAbilities)issues.push({id:'item-ability-floor:resource-policy',severity:'warning',message:'装备属性下限不自动授予属性公式资源容量、补充或恢复；这些政策尚未受审，仍需手工核对。原资源与已消耗次数保留。'});
  for (const [key, value] of Object.entries(c.proficiencies || {})) {
    if (key.startsWith('save:')) { if (value) proficientSaves.add(key.slice(5)); else proficientSaves.delete(key.slice(5)); }
    // Manual skill choices supplement source grants; clearing one cannot revoke a rule.
    else if (SKILLS[key] && value) grantSkill(key, '手动记录');
  }
  const modifiers = Object.fromEntries(ABILITIES.map(a => [a, Math.floor((abilities[a] - 10) / 2)])) as Record<Ability, number>;
  const skills = Object.fromEntries(Object.entries(SKILLS).map(([key, s]) => {
    const expertise = !!c.expertise?.[key], proficient = expertise || !!skillSources[key]?.length;
    const half = c.jackOfAllTrades && !proficient ? Math.floor(proficiency / 2) : 0;
    return [key, { value: modifiers[s.ability] + (proficient ? proficiency * (expertise ? 2 : 1) : half), proficient, expertise, sources: [...(skillSources[key] || []), ...(expertise ? ['专精'] : half ? ['万事通'] : [])] }];
  }));
  const armor=automationEnabled(c)?evaluateArmor(c,active,modifiers.dex):undefined;
  if(armor)issues.push(...armor.issues);
  // A recognized, unreviewed Observant payload is manual in every generic
  // executor, including the separate prose-based armor pass. Genuine XPHB
  // entries retain their existing generic route through the identity exception.
  const featureArmor=automationEnabled(c)?evaluateFeatureArmor(active.filter(row=>!reviewedObservantIdentity(row.entry)&&!reviewedAlertIdentity(row.entry)&&!racialNaturalArmorFamilyId(row.entry))):undefined;
  if(featureArmor)issues.push(...featureArmor.issues);
  // Keep unsupported-clause notices without letting an edited recognized
  // source regain AC through the separate legacy prose executor.
  if(automationEnabled(c))issues.push(...evaluateFeatureArmor(active.filter(row=>!!racialNaturalArmorFamilyId(row.entry))).issues);
  const naturalArmor=projectRacialNaturalArmor(c,{modifiers,armor,explicitBaseOverride:acOverride},active);issues.push(...naturalArmor.issues);
  let ac = (acOverride ?? naturalArmor.base ?? armor?.base ?? (10 + modifiers.dex))+(armor?.bonus||0);
  const infusion=evaluateInfusions(c,active);issues.push(...infusion.issues);trace.spellAttack=infusion.spellAttack.trace;trace.resistances=[...infusion.resistanceTrace,...itemResistance.trace,...variantResistance.trace,...racialResistance.trace];
  ac += acBonus+naturalArmor.bonus+(featureArmor?.bonus||0)+infusion.bonus+itemPassives.acBonus;
  const hpFromClasses = hitPointLevels(c,modifiers.con,classes).reduce((sum,r)=>sum+r.hp,0);
  const sourceHp=projectSourceLevelHp(c,active);issues.push(...sourceHp.issues);
  const itemHp=projectItemAffineHp(c,active);issues.push(...itemHp.issues);
  let maxHp = Math.max(1, (hpOverride ?? (c.baseHp > 0 ? c.baseHp : hpFromClasses)) + hpBonus+sourceHp.bonus+itemHp.bonus);
  trace.ac = [...(armor?.trace||[`基础 10 + 敏捷 ${modifiers.dex}`]),...naturalArmor.trace, ...effectTrace.ac,...(featureArmor?.trace||[]),...infusion.trace,...itemPassives.acTrace];
  trace.hp = [c.baseHp > 0 ? `手动生命值上限 ${c.baseHp}` : `首级满骰、以后${c.hpProgression?.mode==='rolled'?'逐级骰值':'固定平均值'}，含体质 ${modifiers.con}，每级最少 1 点：${hpFromClasses}`, ...effectTrace.hp,...sourceHp.trace,...itemHp.trace];
  trace.proficiency = [`总等级 ${level || 1}：基础熟练加值 ${2+Math.floor((Math.max(1,level)-1)/4)}`]; trace.speed = [`${active.find(s => s.entry.kind === 'race')?.entry.name || '默认步行速度'} ${typeof walking==='number'?walking:typeof walking?.number==='number'?walking.number:30}`,...classMovement.trace,...effectTrace.speed];
  const saves = Object.fromEntries(ABILITIES.map(a => [a, { value: modifiers[a] + (proficientSaves.has(a) ? proficiency : 0) + (itemPassives.saveBonuses[a] || 0), proficient: proficientSaves.has(a) }])) as Derived['saves'];
  const alert=evaluateReviewedAlert(c,active);issues.push(...alert.issues);
  let initiative = alert.initiativeBonus + modifiers.dex + (c.jackOfAllTrades && c.edition === '2014' ? Math.floor(proficiency / 2) : 0); let passive = 10 + skills.perception.value + observant.passivePerceptionBonus;
  trace.initiative=[`敏捷调整值 ${modifiers.dex}`,...(c.jackOfAllTrades&&c.edition==='2014'?[`万事通 +${Math.floor(proficiency/2)}`]:[]),...alert.trace];
  trace.passive=[`基础 10 + 察觉 ${skills.perception.value}`,...observant.passivePerceptionTrace];
  for (const adjustment of c.adjustments || []) {
    if (!adjustment.reason.trim()) continue;
    const { target, value } = adjustment;
    if (target === 'ac') {ac = value;issues.push({id:`legacy-ac:${adjustment.id}`,severity:'warning',message:'旧护甲覆盖仍在生效。请在“自动化设置 → 护甲与盾牌”中恢复规则计算或转为调整值；旧记录会保留。'});} else if (target === 'hp') maxHp = value; else if (target === 'speed') speed = value;
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
  // Like skill offsets, saving-throw offsets supplement any retained legacy total.
  for (const a of ABILITIES) saves[a].value += c.saveBonuses?.[a] || 0;
  if (!(c.adjustments || []).some(a => a.target === 'passive')) {passive = 10 + skills.perception.value + observant.passivePerceptionBonus;trace.passive[0]=`基础 10 + 察觉 ${skills.perception.value}`;}
  const passiveInvestigation=Number.isFinite(skills.investigation.value)&&reviewedObservantHasRetainedBinding(c)?10+skills.investigation.value+observant.passiveInvestigationBonus:undefined;
  if(passiveInvestigation!==undefined)trace.passiveInvestigation=[`基础 10 + 调查最终检定 ${skills.investigation.value}`,...observant.passiveInvestigationTrace,...(observant.passiveInvestigationBonus?[]:['观察力确认保留但当前暂停；此处仅显示自然被动调查，未授予 +5。']),'唇读与情境优势／劣势仍需手工裁定。'];
  if((c.adjustments||[]).some(a=>a.target==='passive'&&a.reason.trim())&&observant.passivePerceptionBonus){trace.passive[0]=`基础 10 + 察觉 ${skills.perception.value}；自然被动察觉 ${10+skills.perception.value+observant.passivePerceptionBonus}`;trace.passive.push('人工最终被动察觉覆盖自然结果（含观察力 +5）；不会再次叠加该加值，也不取消独立的被动调查与属性分量。');}
  if(alert.initiativeBonus&&(c.adjustments||[]).some(a=>a.target==='initiative'&&a.reason.trim()))trace.initiative.push('人工最终先攻覆盖自然结果（含警觉 +5）；不会再次叠加该加值，卡面独立调整仍在覆盖之后叠加。');
  ac += c.sheetBonuses?.ac || 0;
  initiative += c.sheetBonuses?.initiative || 0;
  speed += c.sheetBonuses?.speed || 0;
  passive += c.sheetBonuses?.passive || 0;
  maxHp += c.sheetBonuses?.hp || 0;
  maxHp += reviewedFeats.hpBonus;trace.hp.push(...reviewedFeats.hpTrace);
  for (const [target, value] of Object.entries(c.sheetBonuses || {})) if (value) (trace[target] ??= []).push(`卡面调整 ${value >= 0 ? '+' : ''}${value}`);
  const relativeMovement=projectRelativeRacialMovement(c,speed,active);issues.push(...relativeMovement.issues);
  const classModes=projectClassMovementModes(c,speed,active);
  for(const issue of classModes.issues)if(!issues.some(existing=>existing.id===issue.id))issues.push(issue);
  issues.push(...planFeatureResources(c).issues);
  for(const [key,skill] of Object.entries(SKILLS))trace[`skill:${key}`]=[`${ABILITY_LABELS[skill.ability]}调整值 ${modifiers[skill.ability]}`,...skills[key].sources.map(s=>`来源：${s}`),...(skills[key].proficient?[`${skills[key].expertise?'两倍熟练':'熟练加值'} +${proficiency*(skills[key].expertise?2:1)}`]:c.jackOfAllTrades?[`万事通 +${Math.floor(proficiency/2)}`]:[]),...(c.adjustments||[]).filter(a=>a.target===`skill:${key}`).map(a=>`人工覆盖 ${a.value}：${a.reason}`)];
  for(const a of ABILITIES)trace[`save:${a}`]=[`${ABILITY_LABELS[a]}调整值 ${modifiers[a]}`,...reviewedFeats.saveTrace[a],...(itemPassives.saveTrace[a]||[]),...(saves[a].proficient?[`熟练加值 +${proficiency}`]:[]),...(c.adjustments||[]).filter(v=>v.target===`save:${a}`).map(v=>`人工覆盖 ${v.value}：${v.reason}`),...(c.saveBonuses?.[a]?[`豁免额外调整 ${c.saveBonuses[a]>=0?'+':''}${c.saveBonuses[a]}`]:[])];
  for(const a of ABILITIES)trace[`mod:${a}`]=[...(trace[a]||[]),`最终属性 ${abilities[a]}：向下取整 (属性 − 10) / 2`];
  if(racialSenses.trace.length)trace.darkvision=racialSenses.trace;
  if(racialMovement.trace.length)trace.sourceMovement=racialMovement.trace;
  if(relativeMovement.trace.length)trace.relativeMovement=relativeMovement.trace;
  if(classMovement.trace.length||classModes.trace.length)trace.classMovement=[...classMovement.trace,...classModes.trace];
  return { abilities, ...(equipmentChangedAbilities?{naturalAbilities}:{}), modifiers, level, proficiency, ac, initiative, speed, maxHp, passive, ...(passiveInvestigation===undefined?{}:{passiveInvestigation}),...(racialSenses.darkvision===undefined?{}:{senses:{darkvision:racialSenses.darkvision}}),
    ...(Object.keys(racialMovement.modes).length?{sourceMovement:racialMovement.modes}:{}),
    ...(Object.keys(relativeMovement.modes).length?{relativeMovement:relativeMovement.modes}:{}),
    ...(Object.keys(classModes.modes).length?{classMovement:classModes.modes}:{}),
    skills, saves, requirements, issues, trace, resistances:[...new Set([...infusion.resistances,...itemResistance.resistances,...variantResistance.resistances,...racialResistance.resistances])],
    hitDice: classes.map(s => `${s.level}d${s.entry.raw.hd?.faces || '?'}`).join(' + ') || '—' };
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
