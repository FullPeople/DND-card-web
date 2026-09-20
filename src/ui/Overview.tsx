import { type ReactNode } from 'react';
import { ABILITY_LABELS, KIND_LABELS, SKILLS, selectionAllowed, signed, type Ability, type Character, type Derived, type Entry, type Kind, type Requirement, type Selection } from '../core/model';
import { SheetCell } from './SheetCell';
import { Reference } from './Reference';
import { Inline } from './Entries';

type Edit = (action: (draft: Character) => void, key?: string) => void;
type Props = {
  c: Character; d: Derived; edit: Edit; find: (r: Requirement) => void; browse: (kind: Kind) => void; inspect: (e: Entry) => void;
  renderSelection: (s: Selection) => ReactNode; renderRequirement: (r: Requirement) => ReactNode;
  openResources: () => void; openQuickbar: () => void; pinDrop: (event: React.DragEvent) => void;
};
const clamp = (value: string, min = 0, max = 9999) => Math.max(min, Math.min(max, Number(value) || 0));
const sizes: Record<string, string> = { T: '微型', S: '小型', M: '中型', L: '大型', H: '巨型', G: '超巨型' };

export function Overview({ c, d, edit, find, browse, inspect, renderSelection, renderRequirement, openResources, openQuickbar, pinDrop }: Props) {
  const selected = (kinds: Kind[]) => c.selections.filter(s => kinds.includes(s.entry.kind));
  const pending = (r: Requirement) => !r.complete && !r.review;
  const owner = (r: Requirement) => c.selections.find(s => r.id.startsWith(`${s.id}:`));
  const isClassFeature = (s: Selection) => {
    if (!['feature', 'rule'].includes(s.entry.kind)) return false;
    const parent = s.requirementId ? c.selections.find(p => s.requirementId!.startsWith(`${p.id}:`)) : undefined;
    return !parent || !['race', 'background', 'feat'].includes(parent.entry.kind);
  };
  const classFeatures = selected(['feature', 'rule']).filter(isClassFeature);
  const heritage = selected(['feat', 'feature', 'rule']).filter(s => !isClassFeature(s));
  const heritageRequirements = d.requirements.filter(r => ['abilities', 'feat', 'race', 'background', 'rule'].includes(r.section) && r.id !== 'base:race' && r.id !== 'base:background' || r.section === 'feature' && owner(r) && ['race', 'background', 'feat'].includes(owner(r)!.entry.kind));
  const classRequirements = d.requirements.filter(r => ['feature', 'rule'].includes(r.section) && !heritageRequirements.includes(r));
  const spellRequirements = d.requirements.filter(r => r.section === 'spell');
  const skillRequirements = d.requirements.filter(r => r.section === 'proficiency' && r.options?.some(v => Object.hasOwn(SKILLS, v)));
  const otherRequirements = d.requirements.filter(r => r.section === 'proficiency' && !skillRequirements.includes(r));
  const race = selected(['race'])[0];
  const size = Array.isArray(race?.entry.raw.size) ? race.entry.raw.size.map((s: string) => sizes[s] || s).join(' / ') : '—';
  const pins = (c.quickbar || []).flatMap(id => { const selection = c.selections.find(s => s.id === id); return selection ? [selection] : []; });

  function pickSkill(r: Requirement, key: string) {
    edit(draft => {
      const values = draft.answers[r.id] || [];
      draft.answers[r.id] = r.count === 1 ? [key] : values.includes(key) ? values.filter(v => v !== key) : values.length < r.count ? [...values, key] : values;
    });
  }
  function identityCell(kind: 'class' | 'race' | 'background', label: string) {
    const rows = selected([kind]); const reqs = d.requirements.filter(r => r.section === kind || kind === 'class' && r.section === 'subclass');
    const requirement = reqs.find(pending);
    return <SheetCell label={label} className={`identity-field identity-${kind}`} missing={!!requirement || !rows.length} onFill={() => requirement ? find(requirement) : browse(kind)} requirementId={requirement?.id} dropRequirement={requirement} dropKinds={kind === 'class' ? ['class', 'subclass'] : [kind]}>
        {rows.map(renderSelection)}
        {kind === 'class' && selected(['subclass']).filter(sub => !rows.some(parent => [parent.entry.name, parent.entry.english].includes(sub.entry.raw.className) && (!sub.entry.raw.classSource || sub.entry.raw.classSource === parent.entry.source))).map(sub => <span className="orphan-subclass" key={sub.id}>待关联职业：{renderSelection(sub)}</span>)}
    </SheetCell>;
  }
  function contentCell(label: string, rows: Selection[], reqs: Requirement[], kinds: Kind[], className: string, extra?: ReactNode) {
    const requirement = reqs.find(pending); const missing = !!requirement || !rows.length && !extra;
    return <SheetCell label={label} className={className} missing={missing} onFill={() => requirement ? find(requirement) : browse(kinds[0])} requirementId={requirement?.id} dropRequirement={requirement?.kind ? requirement : undefined} dropKinds={kinds} trailing={!missing && <button className="cell-add" aria-label={`查阅${label}`} onClick={() => browse(kinds[0])}>＋</button>}>
        {rows.map(renderSelection)}{extra}
        {reqs.filter(pending).length > 0 && <div className="pending-labels">{reqs.filter(pending).map(r => <button key={r.id} onClick={() => find(r)}>{r.label} <small>{r.selected.length}/{r.count}</small></button>)}</div>}
        {reqs.filter(r => r.review && !r.complete).map(renderRequirement)}
    </SheetCell>;
  }
  function abilityCell(a: Ability) {
    const skills = Object.entries(SKILLS).filter(([, s]) => s.ability === a);
    const requirements = skillRequirements.filter(r => skills.some(([key]) => r.options!.includes(key)));
    const requirement = requirements.find(pending);
    return <SheetCell label={ABILITY_LABELS[a]} className={`ability-box ability-${a}`} missing={!!requirement} onFill={() => requirement && find(requirement)} hint={d.trace[a].join('；')}>
      <div className="ability-values"><span className="ability-code">{a.toUpperCase()}</span><div><strong className="ability-modifier">{signed(d.modifiers[a])}</strong><small>调整值</small></div><label><input aria-label={`${ABILITY_LABELS[a]}基础值`} type="number" min="1" max="30" value={c.abilities[a]} onChange={e => edit(draft => { draft.abilities[a] = clamp(e.target.value, 1, 30); }, a)}/><span>基础属性</span></label></div>
      {d.abilities[a] !== c.abilities[a] && <div className="ability-total">总值 {d.abilities[a]}</div>}
      <div className="ability-save" title={d.saves[a].proficient ? '已获得豁免熟练' : '未获得豁免熟练'}><span>{d.saves[a].proficient ? '●' : '○'}</span><strong>{signed(d.saves[a].value)}</strong><span>豁免</span></div>
      <div className="ability-skills">{skills.map(([key, skill]) => {
        const choices = requirements.filter(r => r.options!.includes(key));
        return <div className="ability-skill" key={key} title={d.skills[key].sources.join('；') || '未获得技能熟练'}>
          <span className={d.skills[key].proficient ? 'trained' : 'untrained'}>{d.skills[key].proficient ? '●' : '○'}</span><strong>{signed(d.skills[key].value)}</strong><span>{skill.name}</span>
          <span className="skill-choice-inputs">{choices.map(r => <label key={r.id} title={`${r.origin} · ${r.label} ${r.selected.length}/${r.count}`}><input aria-label={choices.length > 1 ? `${skill.name} · ${r.origin}` : skill.name} type={r.count === 1 ? 'radio' : 'checkbox'} name={r.id} checked={r.selected.includes(key)} disabled={!r.selected.includes(key) && r.selected.length >= r.count && r.count !== 1} onChange={() => pickSkill(r, key)}/></label>)}</span>
        </div>;
      })}</div>
    </SheetCell>;
  }
  const raceTraits = race?.entry.entries.filter((v): v is { name: string } => !!v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') || [];
  const heritageText = race ? <div className="inherited-traits">{raceTraits.length ? raceTraits.map((v, i) => <Reference key={i} className="text-link" reference={`entry:${race.entry.id}`} kind="race" onClick={() => inspect(race.entry)}>{v.name}</Reference>) : <button className="text-link" onClick={() => inspect(race.entry)}>{race.entry.name} · 种族特性</button>}</div> : undefined;
  const training: { label: string; values: string[] }[] = [['护甲', 'armor'], ['武器', 'weapons'], ['工具', 'tools'], ['语言', 'languages']].map(([label, key]) => {
    const names: Record<string, string> = { light: '轻甲', medium: '中甲', heavy: '重甲', shields: '盾牌', simple: '简易武器', martial: '军用武器', common: '通用语', elvish: '精灵语' };
    const values = c.selections.filter(s => selectionAllowed(c, s.entry)).flatMap(s => {
      const raw = s.entry.raw; const block = raw.startingProficiencies?.[key];
      const fixed = Array.isArray(block) ? block.filter((v: unknown) => typeof v === 'string') : [];
      const extra = raw[({ armor: 'armorProficiencies', weapons: 'weaponProficiencies', tools: 'toolProficiencies', languages: 'languageProficiencies' } as Record<string, string>)[key]];
      return [...fixed, ...(Array.isArray(extra) ? extra.flatMap(v => Object.entries(v || {}).filter(([k, val]) => val === true && k !== 'choose').map(([k]) => k)) : [])];
    });
    return { label, values: [...new Set<string>(values.map(v => names[v] || v))] };
  });
  return <div className="overview-sheet">
    <div className="overview-top">
      <div className="identity-main overview-identity">
        <SheetCell label="角色名" className="identity-name"><input aria-label="角色姓名" value={c.name} onChange={e => edit(draft => { draft.name = e.target.value; }, 'name')}/><input aria-label="玩家姓名" placeholder="玩家姓名" value={c.player} onChange={e => edit(draft => { draft.player = e.target.value; }, 'player')}/></SheetCell>
        {identityCell('background', '背景')}{identityCell('class', '职业与子职')}{identityCell('race', '种族')}
      </div>
      <SheetCell label="总等级" className="total-level"><strong>{d.level}</strong><small>{c.edition}</small></SheetCell>
      <SheetCell label="护甲等级" className="armor-cell" hint={d.trace.ac.join('；')}><strong>{d.ac}</strong><small>AC</small></SheetCell>
      <SheetCell label="生命值" className="life-cell" hint={d.trace.hp.join('；')}><div className="life-fields"><label>当前<input aria-label="当前生命值" type="number" value={c.runtime.hp} onChange={e => edit(draft => { draft.runtime.hp = clamp(e.target.value); }, 'hp')}/></label><label>临时<input aria-label="临时生命值" type="number" value={c.runtime.tempHp} onChange={e => edit(draft => { draft.runtime.tempHp = clamp(e.target.value); }, 'tempHp')}/></label><span>上限<strong>{d.maxHp}</strong></span></div><button className="text-link" onClick={() => edit(draft => { draft.runtime.hp = d.maxHp; })}>补满生命值</button><details><summary>手动上限</summary><input aria-label="手动生命值上限" type="number" min="0" value={c.baseHp} onChange={e => edit(draft => { draft.baseHp = clamp(e.target.value); })}/></details></SheetCell>
      <SheetCell label="生命骰" className="dice-cell"><strong>{d.hitDice}</strong><button className="text-link" onClick={openResources}>资源记录</button></SheetCell>
      <SheetCell label="激励" className="inspiration-cell"><label><input aria-label="激励" type="checkbox" checked={!!c.runtime.inspiration} onChange={e => edit(draft => { draft.runtime.inspiration = Number(e.target.checked); })}/><span aria-hidden="true">✧</span></label></SheetCell>
    </div>
    <div className="edition-divider"><span/><strong>5TH EDITION</strong><span/></div>
    <div className="overview-body">
      <div className="overview-left">
        <div className="physical-abilities"><SheetCell label="熟练加值" className="proficiency-cell" hint={d.trace.proficiency.join('；')}><strong>{signed(d.proficiency)}</strong></SheetCell>{(['str', 'dex', 'con'] as Ability[]).map(a => <div className={`ability-slot slot-${a}`} key={a}>{abilityCell(a)}</div>)}{contentCell('状态', selected(['condition']), [], ['condition'], 'conditions-cell')}</div>
        <div className="mental-abilities">{(['int', 'wis', 'cha'] as Ability[]).map(a => <div className={`ability-slot slot-${a}`} key={a}>{abilityCell(a)}</div>)}</div>
        <SheetCell label="装备训练与其他熟练" className="training-cell" missing={!!otherRequirements.find(pending) || training.every(t => !t.values.length)} onFill={() => { const r = otherRequirements.find(pending); const parent = selected(['class'])[0]; if (r) find(r); else if (parent) inspect(parent.entry); else find(d.requirements.find(r => r.id === 'base:class')!); }}>{training.some(t => t.values.length) && <dl>{training.map(t => <div key={t.label}><dt>{t.label}</dt><dd>{t.values.length ? t.values.map((v, i) => <span key={i}><Inline text={v}/>{i < t.values.length - 1 ? '、' : ''}</span>) : '—'}</dd></div>)}</dl>}{training.some(t => t.values.length) && <small className="training-note">选择与特殊熟练项以条目正文为准</small>}{otherRequirements.map(renderRequirement)}</SheetCell>
      </div>
      <div className="overview-right">
        <div className="overview-vitals"><SheetCell label="先攻"><strong>{signed(d.initiative)}</strong></SheetCell><SheetCell label="速度"><strong>{d.speed}<small> 尺</small></strong></SheetCell><SheetCell label="体型" missing={!race} onFill={() => find(d.requirements.find(r => r.id === 'base:race')!)}>{race && <strong>{size}</strong>}</SheetCell><SheetCell label="被动察觉"><strong>{d.passive}</strong></SheetCell></div>
        <SheetCell label="快捷栏" className="quickbar-cell" missing={!pins.length} onFill={openQuickbar} dropKinds={['item', 'spell', 'feature', 'feat', 'rule']} onReceive={pinDrop} allowExisting trailing={pins.length > 0 && <button className="cell-add" aria-label="管理快捷栏" onClick={openQuickbar}>编辑</button>}>
            {pins.length > 0 && <div className="quickbar-columns"><span>常用条目</span><span>类型</span><span>来源</span></div>}
            {pins.map(s => <div className={`quickbar-row ${selectionAllowed(c, s.entry) ? '' : 'restricted'}`} key={s.id}><Reference className="text-link" reference={`entry:${s.entry.id}`} kind={s.entry.kind} onClick={() => inspect(s.entry)}>{s.entry.name}</Reference><small>{KIND_LABELS[s.entry.kind]}</small><small>{s.entry.source}</small><button aria-label={`取消固定${s.entry.name}`} onClick={() => edit(draft => { draft.quickbar = draft.quickbar?.filter(id => id !== s.id); })}>×</button></div>)}
        </SheetCell>
        {contentCell('职业特性', classFeatures, classRequirements, ['feature', 'rule'], 'class-features traits-box')}
        <div className="overview-lower">{contentCell('种族特性与专长', heritage, heritageRequirements, ['feat', 'feature', 'rule'], 'heritage-features traits-box', heritageText)}{contentCell('法术', selected(['spell']), spellRequirements, ['spell'], 'overview-spells spells-box')}</div>
      </div>
    </div>
  </div>;
}
