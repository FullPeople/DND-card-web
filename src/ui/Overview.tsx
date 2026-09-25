import {spellUsesPreparation} from '../core/spellcastingRules';
import {spellState} from '../core/characterDetails';
import {HitDiceResources} from './HitDiceResources';
import {workbenchRequest} from '../platform/workbench';
import {Quickbar} from './Quickbar';
import {inWorkbench,composeRoll} from '../platform/workbench';
import {NumberInput} from './NumberInput';
import {Portrait} from './Portrait';
import { useContext, useMemo, useState, type ReactNode } from 'react';
import { AdjustedValue, SheetEditContext } from './SheetEdit';
import { sizeEntry } from '../data/sizes';
import { TrainingChips } from './TrainingChips';
import { ABILITY_LABELS, KIND_LABELS, SIZE_LABELS, SKILLS, selectionAllowed, signed, type Ability, type Character, type Derived, type Entry, type Kind, type Selection, type Size } from '../core/model';
import { SheetCell } from './SheetCell';
import { FeaturePanel } from './FeaturePanel';
import { Reference } from './Reference';
import { IdentityToken } from './IdentityToken';
import { DropZone } from './DragEntry';
import { trainingCategory } from './trainingData';
import { belongsToClass } from '../core/sheet';

type Edit = (action: (draft: Character) => void, key?: string) => void;
type Props = {
  catalog?:Entry[]; statusRibbon: ReactNode;
  addEntry: (entry: Entry, section?: Selection['section']) => void; c: Character; d: Derived; edit: Edit; browse: (kind: Kind | 'size') => void; inspect: (e: Entry) => void;
  renderSelection: (s: Selection) => ReactNode;
  onLink: (reference: string, kind?: string) => void; openResources: () => void;openQuickbar:()=>void;openHp?:()=>void; pinDrop: (entry: Entry) => void;
};
const clamp = (value: string, min = 0, max = 9999) => Math.max(min, Math.min(max, Number(value) || 0));
const sizes: Record<string, string> = { T: '微型', S: '小型', M: '中型', L: '大型', H: '巨型', G: '超巨型' };

export function Overview({ catalog=[], statusRibbon, addEntry, c, d, edit, browse, inspect, onLink, openResources, openQuickbar, openHp, pinDrop }: Props) {
  const editing = useContext(SheetEditContext);
  const spells = spellState(c);
  const trainingNames=useMemo(()=>{const map=new Map<string,Entry[]>();for(const e of catalog)if(e.kind==='item'||e.raw._category==='language'){for(const name of [e.name,e.english]){const key=name.toLowerCase();map.set(key,[...(map.get(key)||[]),e]);}}return map;},[catalog]);
  const [trainingEditor, setTrainingEditor] = useState(false);
  function receiveTraining(entry:Entry,key:string) {edit(draft=>{const current=draft.training?.[key]??training.find(t=>t.key===key)!.values.join('、');const token=`{@${entry.raw._category==='language'?'language':entry.raw._category==='itemProperty'?'itemProperty':entry.raw._category==='itemMastery'?'itemMastery':'item'} ${entry.name}|${entry.source}}`; (draft.training||={})[key]=[...new Set([...current.split(/[、\n；;]/).filter(Boolean),token])].join('、');});}
  const selected = (kinds: Kind[]) => c.selections.filter(s => kinds.includes(s.entry.kind));
  const ownerOf = (s: Selection) => c.selections.find(p => p.id === s.parentId || s.requirementId?.startsWith(`${p.id}:`));
  const belongsToHeritage = (s: Selection) => { if (s.section) return s.section === 'heritage'; let owner = ownerOf(s); const seen = new Set<string>(); while (owner && !seen.has(owner.id)) { if (['background', 'feat'].includes(owner.entry.kind)) return true; seen.add(owner.id); owner = ownerOf(owner); } return s.entry.kind === 'feat'; };
  const featureRows = selected(['feature', 'rule', 'feat']);
  const classFeatures = featureRows.filter(s => !belongsToHeritage(s));
  const heritage = featureRows.filter(belongsToHeritage);
  const classes = selected(['class']);
  const multi = classes.length > 1;
  const race = selected(['race'])[0];
  const sizeCode = c.size || (race ? 'M' : '');
  const size = sizeCode ? sizes[sizeCode] || sizeCode : Array.isArray(race?.entry.raw.size) ? race.entry.raw.size.map((s: string) => sizes[s] || s).join(' / ') : '—';
  const sizeInfo = sizeEntry(c.edition, sizeCode);
  const pins = (c.quickbar || []).flatMap(id => { const selection = c.selections.find(s => s.id === id); return selection ? [selection] : []; });

  function identityCell(kind: 'class' | 'subclass' | 'race' | 'background', label: string) {
    const rows = selected([kind]);
    const showRows = kind === 'subclass' && classes.length === 1 ? rows.filter(s => belongsToClass(s, classes[0])) : rows;
    return <SheetCell label={label} className={`identity-field identity-${kind} ${kind === 'class' && multi ? 'identity-multiclass' : ''}`} flashKey={showRows.map(s => s.id).join(',')} dashed missing={!showRows.length} onFill={() => browse(kind)} dropKinds={kind === 'class' ? ['class', 'subclass'] : kind === 'subclass' ? ['subclass', 'class'] : [kind]}>
      {showRows.map(row => <div className="identity-record" key={row.id}><IdentityToken row={row} c={c} edit={edit} inspect={inspect}/>{kind === 'class' && multi && selected(['subclass']).filter(sub => belongsToClass(sub, row)).map(sub => <IdentityToken key={sub.id} row={sub} c={c} edit={edit} inspect={inspect}/>)}</div>)}
    </SheetCell>;
  }
  function contentCell(label: string, rows: Selection[], kinds: Kind[], className: string) {
    return <FeaturePanel c={c} rows={rows} edit={edit} browse={() => browse(kinds[0])} onLink={onLink} label={label} className={className} kinds={kinds} grouped={false} receive={addEntry}/>;
  }
  function setProficiency(key: string, value: boolean) { edit(draft => { (draft.proficiencies ||= {})[key] = value; if (!value && draft.expertise) draft.expertise[key] = false; }); }
  function abilityCell(a: Ability) {
    const skills = Object.entries(SKILLS).filter(([, s]) => s.ability === a);
    return <SheetCell label={ABILITY_LABELS[a]} className={`ability-box ability-${a}`} hint={d.trace[a].join('；')}>
      <div className="ability-values"><span className="ability-code">{a.toUpperCase()}</span><label><NumberInput aria-label={`${ABILITY_LABELS[a]}基础值`} type="number" readOnly={!editing} min="1" max="30" value={c.abilities[a]} onChange={e => edit(draft => { draft.abilities[a] = clamp(e.target.value, 1, 30); }, a)}/><span>基础属性</span></label><div><button className="ability-modifier rollable-stat" disabled={!inWorkbench} onClick={()=>composeRoll(`1d20${signed(d.modifiers[a])}`,`${ABILITY_LABELS[a]}检定`)}>{signed(d.modifiers[a])}</button><small>调整值</small></div></div>
      {d.abilities[a] !== c.abilities[a] && <div className="ability-total">总值 {d.abilities[a]}</div>}
      <div className={`ability-save ${!editing&&inWorkbench?'roll-row':''}`} role={!editing&&inWorkbench?'button':undefined} tabIndex={!editing&&inWorkbench?0:undefined} onClick={()=>{if(!editing&&inWorkbench)composeRoll(`1d20${signed(d.saves[a].value)}`,`${ABILITY_LABELS[a]}豁免`);}} onKeyDown={e=>{if(!editing&&inWorkbench&&['Enter',' '].includes(e.key)){e.preventDefault();composeRoll(`1d20${signed(d.saves[a].value)}`,`${ABILITY_LABELS[a]}豁免`);}}}>{editing ? <input type="checkbox" aria-label={`${ABILITY_LABELS[a]}豁免熟练`} checked={d.saves[a].proficient} onChange={e => setProficiency(`save:${a}`, e.target.checked)}/> : <span className={`proficiency-mark ${d.saves[a].proficient ? 'trained' : ''}`} aria-label={`${ABILITY_LABELS[a]}豁免${d.saves[a].proficient ? '熟练' : '无熟练'}`}/>}<b>{signed(d.saves[a].value)}</b><span>豁免</span></div>
      <div className="ability-skills">{skills.map(([key, skill]) => <div className={`ability-skill ${editing ? 'skill-editing' : inWorkbench?'roll-row':''}`} role={!editing&&inWorkbench?'button':undefined} tabIndex={!editing&&inWorkbench?0:undefined} onClick={()=>{if(!editing&&inWorkbench)composeRoll(`1d20${signed(d.skills[key].value)}`,skill.name);}} onKeyDown={e=>{if(!editing&&inWorkbench&&['Enter',' '].includes(e.key)){e.preventDefault();composeRoll(`1d20${signed(d.skills[key].value)}`,skill.name);}}} key={key} title={d.skills[key].sources.join('；')}>
        {editing ? <><input aria-label={`${skill.name}熟练`} type="checkbox" checked={d.skills[key].proficient} onChange={e => setProficiency(key, e.target.checked)}/><input className="expertise-check" aria-label={`${skill.name}专精`} type="checkbox" checked={d.skills[key].expertise} onChange={e => edit(draft => { (draft.expertise ||= {})[key] = e.target.checked; if (e.target.checked) (draft.proficiencies ||= {})[key] = true; })}/></> : <span className={`proficiency-mark ${d.skills[key].expertise ? 'expert' : d.skills[key].proficient ? 'trained' : ''}`} aria-label={`${skill.name}${d.skills[key].expertise ? '专精' : d.skills[key].proficient ? '熟练' : '无熟练'}`}/>}
        <b>{signed(d.skills[key].value)}</b><span>{skill.name}</span></div>)}</div>
      {a === 'dex' && (editing || c.jackOfAllTrades) && <label className="jack-of-all-trades"><input type="checkbox" aria-label="万事通" disabled={!editing} checked={!!c.jackOfAllTrades} onChange={e => edit(draft => { draft.jackOfAllTrades = e.target.checked; })}/><span>万事通</span></label>}
    </SheetCell>;
  }
  const training: { key: string; label: string; values: string[] }[] = [['护甲', 'armor'], ['武器', 'weapons'], ['工具', 'tools'], ['语言', 'languages']].map(([label, key]) => {
    const names: Record<string, string> = { light: '轻甲', medium: '中甲', heavy: '重甲', shields: '盾牌', simple: '简易武器', martial: '军用武器', common: '通用语', elvish: '精灵语' };
    const values = c.selections.filter(s => selectionAllowed(c, s.entry)).flatMap(s => {
      const raw = s.entry.raw; const block = raw.startingProficiencies?.[key];
      const fixed = Array.isArray(block) ? block.filter((v: unknown) => typeof v === 'string') : [];
      const extra = raw[({ armor: 'armorProficiencies', weapons: 'weaponProficiencies', tools: 'toolProficiencies', languages: 'languageProficiencies' } as Record<string, string>)[key]];
      return [...fixed, ...(Array.isArray(extra) ? extra.flatMap(v => Object.entries(v || {}).filter(([k, val]) => val === true && k !== 'choose').map(([k]) => k)) : [])];
    });
    return { key, label, values: [...new Set<string>(values.map(v => {const entry=(trainingNames.get(v.toLowerCase())||[]).find(e=>e.source===(c.edition==='2024'?'XPHB':'PHB'))||(trainingNames.get(v.toLowerCase())||[])[0];return names[v] || (entry?`{@${key==='languages'?'language':'item'} ${entry.name}|${entry.source}}`:v);}))] };
  });
  return <div className="overview-sheet">
    <div className="overview-top">
      <div className="identity-main overview-identity">
        <SheetCell label="角色名" className="identity-name">{!editing&&inWorkbench?<button className="assign-token-name" onClick={()=>void workbenchRequest('assignName',{name:c.name}).catch(e=>window.dispatchEvent(new CustomEvent('workbench-error',{detail:String(e)})))}>{c.name}</button>:<input aria-label="角色姓名" readOnly={!editing} value={c.name} onChange={e => edit(draft => { draft.name = e.target.value; }, 'name')}/>}<input aria-label="玩家姓名" readOnly={!editing} placeholder="玩家姓名" value={c.player} onChange={e => edit(draft => { draft.player = e.target.value; }, 'player')}/></SheetCell>
        {identityCell('background', '背景')}{identityCell('class', multi ? '职业与子职' : '职业')}{identityCell('race', '种族')}{!multi && identityCell('subclass', '子职')}
      </div>
      <div className="overview-ratings">
        <SheetCell label="总等级" className="total-level"><strong>{d.level}</strong><small>LEVEL</small></SheetCell>
        <SheetCell label="护甲等级" className="armor-cell" hint={d.trace.ac.join('；')}><AdjustedValue c={c} value={d.ac} target="ac" label="护甲等级" edit={edit}/><small>AC</small></SheetCell>
      </div>
      <div className="overview-health">
        <SheetCell label="生命值" settingsIcon onHeadingClick={editing?openHp:undefined} headingActionLabel="设置生命值取值方式" className="life-cell" hint={d.trace.hp.join('；')}><div className="life-fields"><label>当前<NumberInput aria-label="当前生命值" type="number" value={c.runtime.hp} onChange={e => edit(draft => { draft.runtime.hp = clamp(e.target.value); }, 'hp')}/></label><span className="hp-slash">/</span><div className="hp-maximum"><span>上限</span><AdjustedValue c={c} value={d.maxHp} target="hp" label="生命值上限" edit={edit}/></div><label>临时<NumberInput aria-label="临时生命值" type="number" value={c.runtime.tempHp} onChange={e => edit(draft => { draft.runtime.tempHp = clamp(e.target.value); }, 'tempHp')}/></label></div></SheetCell>
        <SheetCell label="生命骰" className="dice-cell"><HitDiceResources c={c} edit={edit}/></SheetCell>
      </div>
      <Portrait c={c} edit={edit}/>
    </div>
    {statusRibbon}
    <div className="overview-body">
      <div className="overview-left">
        <div className="physical-abilities"><SheetCell label="死亡豁免" className="death-saves-cell"><div className="death-saves">{(['success', 'failure'] as const).map(key => <div key={key}><span>{key === 'success' ? '成功' : '失败'}</span>{[1, 2, 3].map(n => <input key={n} type="checkbox" aria-label={`死亡豁免${key === 'success' ? '成功' : '失败'}${n}`} checked={(c.runtime.deathSaves?.[key] || 0) >= n} onChange={() => edit(draft => { const saves = draft.runtime.deathSaves ||= { success: 0, failure: 0 }; saves[key] = saves[key] >= n ? n - 1 : n; })}/>)}</div>)}</div></SheetCell><SheetCell label="熟练加值" className="proficiency-cell" hint={d.trace.proficiency.join('；')}><AdjustedValue c={c} value={d.proficiency} target="proficiency" label="熟练加值" sign edit={edit}/></SheetCell>{(['str', 'dex', 'con'] as Ability[]).map(a => <div className={`ability-slot slot-${a}`} key={a}>{abilityCell(a)}</div>)}</div>
        <div className="mental-abilities">{(['int', 'wis', 'cha'] as Ability[]).map(a => <div className={`ability-slot slot-${a}`} key={a}>{abilityCell(a)}</div>)}</div>
        <SheetCell label="装备训练与其他熟练" className="training-cell" dropKinds={['rule', 'item', 'feature']} wholePaper accepts={entry => !!trainingCategory(entry)} allowExisting onReceive={entry => receiveTraining(entry,trainingCategory(entry)!)} onHeadingClick={editing ? () => setTrainingEditor(v => !v) : undefined} headingActionLabel="编辑装备训练与其他熟练" headingExpanded={editing && trainingEditor}><dl>{training.map(t => <DropZone key={t.key} className="training-row" kinds={['item','rule','feature']} accepts={entry=>t.key==='languages'?entry.raw._category==='language':entry.kind==='item'||['itemProperty','itemMastery'].includes(entry.raw._category)} allowExisting onReceive={entry=>receiveTraining(entry,t.key)}><dt>{t.label}</dt><dd><TrainingChips editAll={trainingEditor} label={t.label} value={c.training?.[t.key] ?? t.values.join('、')} onChange={value => edit(draft => { (draft.training ||= {})[t.key] = value; })}/></dd></DropZone>)}</dl></SheetCell>
      </div>
      <div className="overview-right">
        <div className="overview-vitals"><SheetCell label="先攻" className="initiative-cell"><AdjustedValue c={c} value={d.initiative} target="initiative" label="先攻" sign edit={edit}/></SheetCell><SheetCell label="速度" className="speed-cell"><AdjustedValue c={c} value={d.speed} target="speed" label="速度" unit="尺" edit={edit}/></SheetCell><SheetCell label="体型" className="size-cell" dropKinds={['rule']} accepts={entry => entry.raw._category === 'size'} onReceive={entry => edit(draft => { draft.size = entry.raw.size; })} dashed missing={!sizeCode} onFill={() => browse('size')} onHeadingClick={() => { if (sizeInfo) inspect(sizeInfo); }}>
          {editing ? <select aria-label="体型" value={c.size || ''} onChange={e => edit(draft => { draft.size = e.target.value ? e.target.value as Size : undefined; })}><option value="">{race ? `种族 · ${size}` : '—'}</option>{Object.entries(SIZE_LABELS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select> : sizeInfo ? <Reference className="size-value" reference={`entry:${sizeInfo.id}`} entry={sizeInfo} onClick={() => inspect(sizeInfo)}>{size}</Reference> : null}
        </SheetCell><SheetCell label="被动察觉"><AdjustedValue c={c} value={d.passive} target="passive" label="被动察觉" edit={edit}/></SheetCell></div>
        <SheetCell label="快捷栏" className="quickbar-cell" missing={!pins.length}   >
            <DropZone referenceOnly onReceive={pinDrop} className="quickbar-copy-zone"><Quickbar c={c} d={d} edit={edit} inspect={inspect} manage={openResources} manageQuickbar={openQuickbar}/></DropZone>
        </SheetCell>
        <FeaturePanel receive={entry => addEntry(entry, 'features')} c={c} rows={classFeatures} edit={edit} browse={() => browse('feature')} onLink={onLink}/>
        <div className="overview-lower"><FeaturePanel receive={entry => addEntry(entry, 'heritage')} c={c} rows={heritage} edit={edit} browse={() => browse('feat')} onLink={onLink} label="背景与专长" className="heritage-features" kinds={['feat', 'feature', 'rule']}/>{contentCell(spells.mode==='prepared'?'已预备法术':'法术', selected(['spell']).filter(s=>spells.mode!=='prepared'||!spellUsesPreparation(c,s.entry)||spells.prepared.includes(s.id)), ['spell'], 'overview-spells spells-box')}</div>
      </div>
    </div>
  </div>;
}
