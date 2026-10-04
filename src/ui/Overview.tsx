import {useSheetChoices} from './SheetChoicesContext';
import {displayCharacterEdit} from '../core/displayCharacterEdit';
import {ScreenAbilities} from './ScreenAbilities';
import {ProficiencyStatus} from './ProficiencyStatus';
import {setManualSkillExpertise,setManualSkillProficiency} from '../core/manualSkills';
import {AutoSheetName} from './AutoSheetName';
import {useSheetRenderMode} from './sheetDisplay';

import {TraceValue} from './ValueTrace';
import {selectionActive} from '../core/automation/choices';
import {classMatches} from '../core/model';
import {proficiencyText} from '../core/proficiencyText';
import {spellIsReady} from '../core/spellWorkspace';
import {spellState} from '../core/characterDetails';
import {HitDiceResources} from './HitDiceResources';
import {workbenchRequest} from '../platform/workbench';
import {Quickbar} from './Quickbar';
import {inWorkbench,composeRoll} from '../platform/workbench';
import {NumberInput} from './NumberInput';
import {Portrait} from './Portrait';
import {VisibilityEye} from './VisibilityEye';
import './overviewSpellVisibility.css';
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
  addEntry: (entry: Entry, section?: Selection['section']) => void; c: Character; d: Derived; edit: Edit; browse: (kind: Kind | 'size',parent?:Entry) => void; inspect: (e: Entry) => void;
  renderSelection: (s: Selection) => ReactNode;
  onLink: (reference: string, kind?: string) => void; openResources: () => void;openQuickbar:()=>void;openHp?:()=>void; pinDrop: (entry: Entry) => void;
};
const clamp = (value: string, min = 0, max = 9999) => Math.max(min, Math.min(max, Number(value) || 0));
const sizes: Record<string, string> = { T: '微型', S: '小型', M: '中型', L: '大型', H: '巨型', G: '超巨型' };

export function Overview({ catalog=[], statusRibbon, addEntry, c, d, edit, browse, inspect, onLink, openResources, openQuickbar, openHp, pinDrop }: Props) {
  const editing = useContext(SheetEditContext),screen=useSheetRenderMode()==='screen';
  const spells = spellState(c);
  const choices=useSheetChoices(c,catalog);
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
      {showRows.map(row => <DropZone className="identity-record" key={row.id} kinds={kind==='class'?['subclass']:[kind]} accepts={entry=>kind!=='class'||classMatches(entry,row.entry)} onReceive={entry=>addEntry(entry)}><IdentityToken row={row} c={c} edit={edit} inspect={inspect}/>{kind === 'class' && multi && selected(['subclass']).filter(sub => belongsToClass(sub, row)).map(sub => <IdentityToken key={sub.id} row={sub} c={c} edit={edit} inspect={inspect}/>)}{kind==='class'&&editing&&<button className="subclass-fill" aria-label={`为${row.entry.name}选择子职`} onClick={()=>browse('subclass',row.entry)} title="选择此职业的子职">＋</button>}</DropZone>)}
    </SheetCell>;
  }
  function contentCell(label: string, rows: Selection[], kinds: Kind[], className: string, headingInline?:ReactNode) {
    return <FeaturePanel headingInline={headingInline} catalog={catalog} c={c} rows={rows} edit={edit} browse={() => browse(kinds[0])} onLink={onLink} label={label} className={className} kinds={kinds} grouped={false} receive={addEntry}/>;
  }
  function abilityCell(a: Ability) {
    const skills = Object.entries(SKILLS).filter(([, s]) => s.ability === a);
    return <SheetCell label={ABILITY_LABELS[a]} className={`ability-box ability-${a}`} hint={d.trace[a].join('；')}>
      <div className="ability-values"><span className="ability-code">{a.toUpperCase()}</span><label><NumberInput aria-label={`${ABILITY_LABELS[a]}基础值`} type="number" readOnly={!editing} min="1" max="30" value={c.abilities[a]} displayValue={d.abilities[a]} onChange={e => edit(draft => { draft.abilities[a] = clamp(e.target.value, 1, 30); }, a)}/><span>属性值</span></label><div><button className="ability-modifier rollable-stat" disabled={!inWorkbench} onClick={()=>composeRoll(`1d20${signed(d.modifiers[a])}`,`${ABILITY_LABELS[a]}检定`)}>{signed(d.modifiers[a])}</button><small>调整值</small></div></div>
      <div className={`ability-save ability-proficiency-row ${editing?'save-editing':inWorkbench?'roll-row':''}`} role={!editing&&inWorkbench?'button':undefined} tabIndex={!editing&&inWorkbench?0:undefined} onClick={()=>{if(!editing&&inWorkbench)composeRoll(`1d20${signed(d.saves[a].value)}`,`${ABILITY_LABELS[a]}豁免`);}} onKeyDown={e=>{if(!editing&&inWorkbench&&['Enter',' '].includes(e.key)){e.preventDefault();composeRoll(`1d20${signed(d.saves[a].value)}`,`${ABILITY_LABELS[a]}豁免`);}}}><ProficiencyStatus name={`${ABILITY_LABELS[a]}豁免`} proficient={d.saves[a].proficient} editing={editing} kind="save"/>{editing?<TraceValue target={`save:${a}`} label={`${ABILITY_LABELS[a]}豁免`} value={d.saves[a].value}><b>{signed(d.saves[a].value)}</b></TraceValue>:<b>{signed(d.saves[a].value)}</b>}<span>豁免</span>{editing&&<NumberInput className="save-extra-adjustment" aria-label={`${ABILITY_LABELS[a]}豁免额外调整值`} title="额外加减值，叠加于豁免；保留至手动修改" min="-9999" max="9999" step="1" value={c.saveBonuses?.[a]||0} onChange={e=>edit(draft=>{const value=Math.trunc(clamp(e.target.value,-9999,9999));if(value)(draft.saveBonuses||={})[a]=value;else if(draft.saveBonuses)delete draft.saveBonuses[a];},`save-bonus:${a}`)}/>}</div>
      <div className="ability-skills">{skills.map(([key, skill]) => <div className={`ability-skill ability-proficiency-row ${editing ? 'skill-editing' : inWorkbench?'roll-row':''}`} role={!editing&&inWorkbench?'button':undefined} tabIndex={!editing&&inWorkbench?0:undefined} onClick={()=>{if(!editing&&inWorkbench)composeRoll(`1d20${signed(d.skills[key].value)}`,skill.name);}} onKeyDown={e=>{if(!editing&&inWorkbench&&['Enter',' '].includes(e.key)){e.preventDefault();composeRoll(`1d20${signed(d.skills[key].value)}`,skill.name);}}} key={key} title={d.skills[key].sources.join('；')}>
        <ProficiencyStatus name={skill.name} proficient={d.skills[key].proficient} expertise={d.skills[key].expertise} editing={editing} manualProficient={!!c.proficiencies?.[key]} onProficiencyChange={enabled=>edit(draft=>setManualSkillProficiency(draft,key,enabled))} onExpertiseChange={enabled=>edit(draft=>setManualSkillExpertise(draft,key,enabled))}/>
                {editing?<TraceValue target={`skill:${key}`} label={skill.name} value={d.skills[key].value}><b>{signed(d.skills[key].value)}</b></TraceValue>:<b>{signed(d.skills[key].value)}</b>}<span title={skill.name}>{skill.name}</span>{editing&&<NumberInput className="skill-extra-adjustment" aria-label={`${skill.name}额外调整值`} title="额外加减值，叠加于技能检定；保留至手动修改" min="-9999" max="9999" step="1" value={c.skillBonuses?.[key]||0} onChange={e=>edit(draft=>{const value=Math.trunc(clamp(e.target.value,-9999,9999));if(value)(draft.skillBonuses||={})[key]=value;else if(draft.skillBonuses)delete draft.skillBonuses[key];},`skill-bonus:${key}`)}/>}</div>)}</div>
      {a === 'dex' && (screen || editing || c.jackOfAllTrades) && <label className={`jack-of-all-trades ${screen&&!editing&&!c.jackOfAllTrades?'jack-reserved':''}`}><input type="checkbox" aria-label="万事通" disabled={!editing} checked={!!c.jackOfAllTrades} onChange={e => edit(draft => { draft.jackOfAllTrades = e.target.checked; })}/><span>万事通</span></label>}
    </SheetCell>;
  }
  const training: { key: string; label: string; values: string[] }[] = [['护甲', 'armor'], ['武器', 'weapons'], ['工具', 'tools'], ['语言', 'languages']].map(([label, key]) => {
    const names: Record<string, string> = { common: '通用语', elvish: '精灵语' };
    const values = c.selections.filter(s => selectionActive(c,s)&&(!s.grantKey?.startsWith('choice:')||c.automation?.enabled)).flatMap(s => {
      const raw = s.entry.raw; const block = raw.startingProficiencies?.[key];
      const fixed = Array.isArray(block) ? block.filter((v: unknown) => typeof v === 'string') : [];
      const extra = raw[({ armor: 'armorProficiencies', weapons: 'weaponProficiencies', tools: 'toolProficiencies', languages: 'languageProficiencies' } as Record<string, string>)[key]];
      return [...fixed, ...(Array.isArray(extra) ? extra.flatMap(v => Object.entries(v || {}).filter(([k, val]) => val === true && k !== 'choose').map(([k]) => k)) : [])];
    });
    values.push(...choices.filter(r=>!r.restricted&&r.channel===key).flatMap(r=>r.selected.map(v=>r.options.find(o=>o.value===v)?.label||v)));
    return { key, label, values: [...new Set<string>(values.map(v => {const entry=(trainingNames.get(v.toLowerCase())||[]).find(e=>e.source===(c.edition==='2024'?'XPHB':'PHB'))||(trainingNames.get(v.toLowerCase())||[])[0];return names[v] || (entry?`{@${key==='languages'?'language':'item'} ${entry.name}|${entry.source}}`:proficiencyText(v,c.edition==='2024'?'XPHB':'PHB',key));}))] };
  });
    const identity = <div className="identity-main overview-identity">
        <SheetCell label="角色名" className="identity-name">{!editing&&inWorkbench?<button className="assign-token-name" onClick={()=>void workbenchRequest('assignName',{name:c.name}).catch(e=>window.dispatchEvent(new CustomEvent('workbench-error',{detail:String(e)})))}>{c.name}</button>:screen?<AutoSheetName value={c.name} readOnly={!editing} change={value=>edit(displayCharacterEdit('name',value),'name')}/>:<input aria-label="角色姓名" readOnly={!editing} value={c.name} onChange={e => edit(displayCharacterEdit('name',e.target.value), 'name')}/>}<input aria-label="玩家姓名" readOnly={!editing} placeholder="玩家姓名" value={c.player} onChange={e => edit(displayCharacterEdit('player',e.target.value), 'player')}/></SheetCell>
        {identityCell('background', '背景')}{identityCell('class', multi ? '职业与子职' : '职业')}{identityCell('race', '种族')}{!multi && identityCell('subclass', '子职')}
      </div>;
  const ratings = <div className="overview-ratings">
        <SheetCell label={screen?'等级':'总等级'} className="total-level"><strong>{d.level}</strong><small>LEVEL</small></SheetCell>
        <SheetCell label={screen?'护甲':'护甲等级'} className="armor-cell" hint={d.trace.ac.join('；')}><AdjustedValue c={c} value={d.ac} target="ac" label="护甲等级" edit={edit}/><small>AC</small></SheetCell>
      </div>;
  const health = <div className="overview-health">
        <SheetCell label="生命值" settingsIcon onHeadingClick={editing?openHp:undefined} headingActionLabel="设置生命值取值方式" className="life-cell" hint={d.trace.hp.join('；')}><div className="life-fields"><label>当前<NumberInput arithmetic aria-label="当前生命值" type="number" value={c.runtime.hp} onChange={e => edit(draft => { draft.runtime.hp = clamp(e.target.value); }, 'hp')}/></label><span className="hp-slash">/</span><div className="hp-maximum"><span>上限</span><AdjustedValue c={c} value={d.maxHp} target="hp" label="生命值上限" edit={edit}/></div><label>临时<NumberInput arithmetic aria-label="临时生命值" type="number" value={c.runtime.tempHp} onChange={e => edit(draft => { draft.runtime.tempHp = clamp(e.target.value); }, 'tempHp')}/></label></div></SheetCell>
        <SheetCell label="生命骰" className="dice-cell"><HitDiceResources c={c} edit={edit}/></SheetCell>
      </div>;
  const death = <SheetCell label="死亡豁免" className="death-saves-cell"><div className="death-saves">{(['success', 'failure'] as const).map(key => <div key={key}><span>{key === 'success' ? '成功' : '失败'}</span>{[1, 2, 3].map(n => <input key={n} type="checkbox" aria-label={`死亡豁免${key === 'success' ? '成功' : '失败'}${n}`} checked={(c.runtime.deathSaves?.[key] || 0) >= n} onChange={() => edit(draft => { const saves = draft.runtime.deathSaves ||= { success: 0, failure: 0 }; saves[key] = saves[key] >= n ? n - 1 : n; })}/>)}</div>)}</div></SheetCell>;
  const proficiency = <SheetCell label="熟练加值" className="proficiency-cell" hint={d.trace.proficiency.join('；')}><AdjustedValue c={c} value={d.proficiency} target="proficiency" label="熟练加值" sign edit={edit}/></SheetCell>;
  const trainingCell = <SheetCell label="装备训练与其他熟练" className="training-cell" training dropKinds={['rule', 'item', 'feature']} wholePaper accepts={entry => !!trainingCategory(entry)} allowExisting onReceive={entry => receiveTraining(entry,trainingCategory(entry)!)} onHeadingClick={editing ? () => setTrainingEditor(v => !v) : undefined} headingActionLabel="编辑装备训练与其他熟练" headingExpanded={editing && trainingEditor}><dl>{training.map(t => <DropZone key={t.key} className="training-row" training kinds={['item','rule','feature']} accepts={entry=>trainingCategory(entry)===t.key} allowExisting onReceive={entry=>receiveTraining(entry,t.key)}><dt>{t.label}</dt><dd><TrainingChips editAll={trainingEditor} label={t.label} value={c.training?.[t.key] ?? t.values.join('、')} onChange={value => edit(draft => { (draft.training ||= {})[t.key] = value; })}/></dd></DropZone>)}</dl></SheetCell>;
  const initiative = <SheetCell label="先攻" className="initiative-cell"><AdjustedValue c={c} value={d.initiative} target="initiative" label="先攻" sign edit={edit}/></SheetCell>;
  const speed = <SheetCell label="速度" className="speed-cell"><AdjustedValue c={c} value={d.speed} target="speed" label="速度" unit="尺" edit={edit}/></SheetCell>;
  const sizeCell = <SheetCell label="体型" className="size-cell" dropKinds={['rule']} accepts={entry => entry.raw._category === 'size'} onReceive={entry => edit(draft => { draft.size = entry.raw.size; })} dashed missing={!sizeCode} onFill={() => browse('size')} onHeadingClick={() => { if (sizeInfo) inspect(sizeInfo); }}>
          {editing ? <select aria-label="体型" value={c.size || ''} onChange={e => edit(draft => { draft.size = e.target.value ? e.target.value as Size : undefined; })}><option value="">{race ? `种族 · ${size}` : '—'}</option>{Object.entries(SIZE_LABELS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select> : sizeInfo ? <Reference className="size-value" reference={`entry:${sizeInfo.id}`} entry={sizeInfo} onClick={() => inspect(sizeInfo)}>{size}</Reference> : null}
        </SheetCell>;
  const passive = <SheetCell label="被动察觉"><AdjustedValue c={c} value={d.passive} target="passive" label="被动察觉" edit={edit}/></SheetCell>;
  const quickbar = <SheetCell label="快捷栏" className="quickbar-cell" missing={!pins.length} onHeadingClick={openResources} headingActionLabel="打开快捷栏编辑器">
            <DropZone referenceOnly onReceive={pinDrop} className="quickbar-copy-zone"><Quickbar c={c} d={d} edit={edit} inspect={inspect} manage={openResources} manageQuickbar={openQuickbar}/></DropZone>
        </SheetCell>;
  const heritageCell = <FeaturePanel catalog={catalog} owners={c.selections.filter(row=>row.entry.kind==='background')} receive={entry => addEntry(entry, 'heritage')} c={c} rows={heritage} edit={edit} browse={() => browse('feat')} onLink={onLink} label="背景与专长" className="heritage-features" kinds={['feat', 'feature', 'rule']}/>;
  const featuresCell = <FeaturePanel catalog={catalog} owners={c.selections.filter(row=>['class','subclass','race'].includes(row.entry.kind))} receive={entry => addEntry(entry, 'features')} c={c} rows={classFeatures} edit={edit} browse={() => browse('feature')} onLink={onLink}/>;
  const spellsHidden=c.overviewSpellsHidden===true;
  const spellCell = spellsHidden&&!editing?null:contentCell(spells.mode==='prepared'?'已预备法术':'法术', selected(['spell']).filter(s=>spellIsReady(c,s)), ['spell'], `overview-spells spells-box ${spellsHidden?'overview-spells-hidden':''}`,editing?<button type="button" className="overview-spells-visibility" aria-label="隐藏主要页法术框" aria-pressed={spellsHidden} title={spellsHidden?'退出编辑后隐藏法术框':'隐藏主要页法术框'} onKeyDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();edit(displayCharacterEdit('overviewSpellsHidden',!spellsHidden));}}><VisibilityEye hidden={spellsHidden}/></button>:undefined);
  if(screen)return <div className={`overview-sheet screen-overview ${spellsHidden&&!editing?'overview-spells-collapsed':''}`}><div className="screen-status">{statusRibbon}</div><div className="screen-layout"><div className="screen-summary">{identity}<ScreenAbilities items={[{id:'initiative',node:initiative},{id:'passive',node:passive},...(['str','int','dex','wis','con','cha'] as Ability[]).map(a=>({id:a,node:abilityCell(a)})),{id:'speed',node:speed},{id:'size',node:sizeCell},{id:'proficiency',node:proficiency},{id:'saves',node:death}]}/>{trainingCell}</div><div className="screen-actions"><div className="screen-vitals">{ratings}{health}<Portrait c={c} edit={edit}/></div>{quickbar}{featuresCell}{spellCell}{heritageCell}</div></div></div>;
  return <div className="overview-sheet">
    <div className="overview-top">
      {identity}
      {ratings}
      {health}
      <Portrait c={c} edit={edit}/>
    </div>
    {statusRibbon}
    <div className="overview-body">
      <div className="overview-left">
        <div className="physical-abilities">{death}{proficiency}{(['str', 'dex', 'con'] as Ability[]).map(a => <div className={`ability-slot slot-${a}`} key={a}>{abilityCell(a)}</div>)}</div>
        <div className="mental-abilities">{(['int', 'wis', 'cha'] as Ability[]).map(a => <div className={`ability-slot slot-${a}`} key={a}>{abilityCell(a)}</div>)}</div>
        {trainingCell}
      </div>
      <div className="overview-right">
        <div className="overview-vitals">{initiative}{speed}{sizeCell}{passive}</div>
        {quickbar}
        {featuresCell}
        <div className={`overview-lower ${spellsHidden&&!editing?'overview-spells-collapsed':''}`}>{heritageCell}{spellCell}</div>
      </div>
    </div>
  </div>;
}
