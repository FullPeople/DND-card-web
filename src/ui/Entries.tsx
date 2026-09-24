import { Reference } from './Reference';
import {inWorkbench,composeRoll} from '../platform/workbench';
import { Component, Fragment, createContext, useContext, type ReactNode } from 'react';
import { ABILITY_LABELS, type Ability } from '../core/model';
export class ContentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="inline-warning">正文结构暂不支持。</p> : this.props.children; }
}
export const RollLabelContext=createContext('');
type LinkHandler = (reference: string, kind?: string) => void;
export function Inline({ text, onLink }: { text: string; onLink?: LinkHandler }) {
  const rollLabel=useContext(RollLabelContext);
  text = typeof text === 'string' ? text : String(text ?? '');
  text = text.replace('外部角色卡条目；请在规则资料中核对并替换为有来源的条目。','').replace('（阅读后自行填入）', '').replace('职业等级可在角色卡中调整。', '');
  const parts: ReactNode[] = []; const regex = /\{@(\w+)(?:\s+([^{}]*))?\}/g; let cursor = 0; let match;
  while ((match = regex.exec(text))) {
    parts.push(text.slice(cursor, match.index)); const [all, tag, body = ''] = match; const args = body.split('|'); const label = tag === 'filter' ? args[0] : ['dice', 'damage', 'd20'].includes(tag) ? args[1] || args[0] : args[2] || args[0];
    if (['creature', 'spell', 'item', 'class', 'race', 'feat', 'condition', 'skill', 'sense', 'variantrule', 'action', 'language', 'optfeature', 'background', 'status', 'disease', 'itemMastery', 'itemProperty', 'itemType', 'table', 'deity', 'reward', 'charoption', 'psionic', 'facility'].includes(tag)) parts.push(<Reference key={match.index} reference={body} kind={tag} onClick={() => onLink?.(body, tag)}>{label}</Reference>);
    else if (['b', 'bold', 'strong'].includes(tag)) parts.push(<strong key={match.index}>{label}</strong>);
    else if (['i', 'italic', 'note'].includes(tag)) parts.push(<em key={match.index}>{label}</em>);
    else if(tag==='atkr')parts.push(<em key={match.index}>{args[0].split(',').map(v=>({m:'近战攻击检定',r:'远程攻击检定',a:'攻击检定'}[v]||v)).join('或')}：</em>);
    else if(tag==='actSave')parts.push(<em key={match.index}>{ABILITY_LABELS[args[0] as Ability]||args[0]}豁免：</em>);
    else if(['actSaveFail','actSaveSuccess','actSaveSuccessOrFail','actTrigger','actResponse'].includes(tag))parts.push(<em key={match.index}>{({actSaveFail:'失败',actSaveSuccess:'成功',actSaveSuccessOrFail:'无论成败',actTrigger:'触发',actResponse:'响应'} as Record<string,string>)[tag]}：</em>);
    else if(tag==='actSaveFailBy')parts.push(<em key={match.index}>失败差值至少{label}：</em>);
    else if (tag === 'dc') parts.push(`DC ${label}`);
    else if(inWorkbench&&['dice','damage','d20','hit'].includes(tag))parts.push(<button className="text-link" key={match.index} onClick={()=>{const expression=['hit','d20'].includes(tag)?`1d20${Number(args[0])>=0?'+':''}${Number(args[0])||0}`:args[0];composeRoll(expression,rollLabel?`${rollLabel} · ${tag==='hit'||tag==='d20'?'命中':tag==='damage'?'伤害':'投骰'}`:label);}}>{tag==='hit'&&Number(label)>=0?`+${label}`:label}</button>);
    else if (tag === 'hit') parts.push(Number(label) >= 0 ? `+${label}` : label);
    else if(tag==='atk')parts.push(args[0].split(',').map(v=>({mw:'近战武器攻击',rw:'远程武器攻击',ms:'近战法术攻击',rs:'远程法术攻击'}[v]||v)).join(' / '));
    else if (tag === 'h') parts.push('命中：');
    else if (tag === 'recharge') parts.push(`充能 ${label || '6'}`);
    else parts.push(label || '');
    cursor = match.index + all.length;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
export function Entries({ value, onLink, depth = 0 }: { value: unknown; onLink?: LinkHandler; depth?: number }): ReactNode {
  if (depth > 14 || value == null) return null;
  if (typeof value === 'string') return /^生命骰：d\d+。职业等级可在角色卡中调整。$/.test(value) ? null : <p><Inline text={value} onLink={onLink}/></p>;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((v, i) => <Fragment key={i}><Entries value={v} onLink={onLink} depth={depth + 1}/></Fragment>);
  if (typeof value !== 'object') return null;
  const v = value as Record<string, any>;
  if (v.type === 'dice') return v.toRoll ? (Array.isArray(v.toRoll) ? v.toRoll : [v.toRoll]).map((r:any)=>`${r.number ?? 1}d${r.faces}${r.modifier ? `${r.modifier>0?'+':''}${r.modifier}` : ''}`).join(' + ') : v.expression || v.displayText || null;
  if (v.type === 'bonus') return `${Number(v.value)>=0?'+':''}${v.value ?? 0}`;
  if (v.type === 'bonusSpeed') return `${v.value ?? 0} 尺`;
  if (['abilityDc', 'abilityAttackMod'].includes(v.type)) return <p className="ability-formula"><strong>{v.name || '法术'}{v.type === 'abilityDc' ? '豁免 DC' : '攻击加值'}</strong> = {v.type === 'abilityDc' ? '8 + ' : ''}{(v.attributes || []).map((a: Ability) => ABILITY_LABELS[a] || a).join(' / ')}调整值 + 熟练加值</p>;
  if (v.type === 'table') {
  const rows: any[][] = (v.rows || []).map((row: any) => Array.isArray(row) ? row : row.row || []);
    return <div className="table-scroll">{v.caption && <p className="table-caption"><Inline text={v.caption} onLink={onLink}/></p>}<Entries value={v.intro} onLink={onLink} depth={depth + 1}/><table><thead><tr>{v.colLabels?.map((l: string, i: number) => <th key={i} scope="col"><Inline text={l} onLink={onLink}/></th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell: any, j) => <td key={j} className={typeof cell==='number'||typeof cell==='string'&&/^[+−–—\d\s./~～-]+$/.test(cell)?'numeric-cell':undefined} rowSpan={cell?.rowSpan || cell?.rowspan || 1} colSpan={cell?.colSpan || cell?.colspan || 1}><Entries value={cell} onLink={onLink} depth={depth + 1}/></td>)}</tr>)}</tbody></table><Entries value={v.footnotes} onLink={onLink} depth={depth + 1}/></div>;
  }
  if (v.headerEntries || v.spells || v.daily || v.will) {
    const frequencies: Record<string,string>={daily:'每日',rest:'每次休息',weekly:'每周',monthly:'每月',yearly:'每年',recharge:'充能',legendary:'传奇动作'};
    return <section className="entry-section spellcasting-block">{v.name&&<h4><Inline text={v.name}/></h4>}<Entries value={v.headerEntries} onLink={onLink} depth={depth+1}/>{v.will&&<p><strong>随意施展：</strong><Inline text={v.will.join('、')} onLink={onLink}/></p>}{Object.entries(v.spells||{}).map(([level,data]:[string,any])=><p key={level}><strong>{level==='0'?'戏法':`${level}环`}{data.slots?`（${data.slots}法术位）`:''}：</strong><Inline text={(data.spells||[]).join('、')} onLink={onLink}/></p>)}{Object.entries(frequencies).flatMap(([key,label])=>Object.entries(v[key]||{}).map(([count,spells]:[string,any])=><p key={`${key}-${count}`}><strong>{label}{count.replace('e','')}次{count.includes('e')?'各自':''}：</strong><Inline text={Array.isArray(spells)?spells.join('、'):String(spells)} onLink={onLink}/></p>))}<Entries value={v.footerEntries} onLink={onLink} depth={depth+1}/></section>;
  }
  if (v.type === 'list') return <ul>{v.items?.map((item: unknown, i: number) => <li key={i}><Entries value={item} onLink={onLink} depth={depth + 1}/></li>)}</ul>;
  if (v.type === 'cell' && v.roll) return `${v.roll.exact ?? `${v.roll.min}–${v.roll.max}`}`;
  if (typeof v.type === 'string' && v.type.startsWith('ref')) { const ref = v.classFeature || v.subclassFeature || v.optionalfeature; return typeof ref === 'string' ? <p><Reference reference={ref} kind="feature" onClick={() => onLink?.(ref, 'feature')}>{ref.split('|')[0]}</Reference></p> : null; }
  return <section className={['inset', 'insetReadaloud', 'quote'].includes(v.type) ? 'entry-inset' : 'entry-section'}>{v.name && <h4><Inline text={v.name} onLink={onLink}/>{v.ENG_name && v.ENG_name !== v.name && <small> {v.ENG_name}</small>}</h4>}<Entries value={v.entries || v.entry || v.items || v.text} onLink={onLink} depth={depth + 1}/>{v.by && <small>— {v.by}</small>}</section>;
}
