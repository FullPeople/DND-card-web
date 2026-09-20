import { ABILITY_LABELS, type Ability, type Entry } from '../core/model';
import { Inline } from './Entries';
const units: Record<string, string> = { action: '动作', bonus: '附赠动作', reaction: '反应', minute: '分钟', hour: '小时', day: '日', round: '轮', turn: '回合', feet: '尺', miles: '里', self: '自身', touch: '触及', sight: '视线', unlimited: '无限', special: '特殊' };
const schools: Record<string, string> = { A: '防护', C: '咒法', D: '预言', E: '惑控', V: '塑能', I: '幻术', N: '死灵', T: '变化' };
const shapes: Record<string, string> = { cone: '锥状', line: '线状', sphere: '球状', cube: '立方', radius: '半径', hemisphere: '半球', cylinder: '柱状' };
const translate = (v: unknown) => units[String(v)] || String(v ?? '');
export function EntryFacts({ entry, onLink }: { entry: Entry; onLink: (ref: string, kind?: string) => void }) {
  const r = entry.raw; const facts: [string, string][] = [];
  if (entry.kind === 'spell') {
    facts.push(['学派', `${r.level === 0 ? '戏法' : `${r.level} 环`} · ${schools[r.school] || r.school || '—'}${r.meta?.ritual ? ' · 仪式' : ''}`]);
    if (Array.isArray(r.time)) facts.push(['施法时间', r.time.map((t: any) => `${t.number || 1} ${translate(t.unit)}${t.condition ? `，${t.condition}` : ''}`).join(' / ')]);
    if (r.range) { const distance = r.range.distance; facts.push(['施法距离', `${distance?.amount ? `${distance.amount} ` : ''}${translate(distance?.type || r.range.type)}${shapes[r.range.type] ? `（${shapes[r.range.type]}）` : ''}`]); }
    if (r.components) { const material = r.components.m; facts.push(['法术成分', [r.components.v ? '言语 V' : '', r.components.s ? '姿势 S' : '', material ? `材料 M：${typeof material === 'string' ? material : material.text || '见正文'}` : ''].filter(Boolean).join('；') || '无']); }
    if (Array.isArray(r.duration)) facts.push(['持续时间', r.duration.map((v: any) => `${v.concentration ? '专注，' : ''}${v.type === 'instant' ? '立即' : v.type === 'permanent' ? '直至解除' : v.duration ? `${v.duration.amount || ''} ${translate(v.duration.type)}` : translate(v.type)}`).join(' / ')]);
  }
  if (entry.kind === 'class') {
    if (r.hd?.faces) facts.push(['生命骰', `d${r.hd.faces}`]);
    if (Array.isArray(r.proficiency)) facts.push(['豁免熟练', r.proficiency.map((a: Ability) => ABILITY_LABELS[a] || a).join('、')]);
    if (r.spellcastingAbility) facts.push(['施法属性', ABILITY_LABELS[r.spellcastingAbility as Ability] || r.spellcastingAbility]);
  }
  if (entry.kind === 'race') {
    if (r.speed) facts.push(['步行速度', `${typeof r.speed === 'number' ? r.speed : r.speed.walk || '—'} 尺`]);
    if (Array.isArray(r.size)) facts.push(['体型', r.size.map((s: string) => ({ T: '微型', S: '小型', M: '中型', L: '大型', H: '巨型', G: '超巨型' }[s] || s)).join(' / ')]);
  }
  if (entry.kind === 'item') {
    if (r.ac) facts.push(['护甲基础值', String(r.ac)]);
    if (r.dmg1) facts.push(['武器伤害', `${r.dmg1}${r.dmg2 ? ` / 多用 ${r.dmg2}` : ''}`]);
    if (r.weight) facts.push(['重量', `${r.weight} 磅`]);
    if (r.value) facts.push(['价格', `${r.value / 100} gp`]);
    if (r.reqAttune) facts.push(['同调', typeof r.reqAttune === 'string' ? r.reqAttune : '需要同调']);
  }
  if (entry.kind === 'feat' && r.category) facts.push(['专长类别', ({ O: '起源', G: '通用', FS: '战斗风格', EB: '传奇恩惠' } as Record<string, string>)[r.category] || r.category]);
  if (Array.isArray(r.prerequisite)) facts.push(['先决条件', r.prerequisite.map((p: any) => Object.entries(p).map(([key, v]: [string, any]) => {
    if (key === 'level') return typeof v === 'number' ? `${v} 级` : `${v.class?.name || ''} ${v.level} 级`;
    if (key === 'ability' && Array.isArray(v)) return v.map(option => Object.entries(option).map(([a, n]) => `${ABILITY_LABELS[a as Ability] || a} ${n}`).join('且')).join('或');
    if (key === 'spellcasting' && v) return '具备施法能力';
    if (key === 'feat' && Array.isArray(v)) return `专长：${v.map(x => String(x).split('|')[0]).join('、')}`;
    return typeof v === 'string' ? v : '还有特殊条件，请核对正文';
  }).join('；')).join(' / 或 / ')]);
  if (entry.kind === 'feature' && r.level) facts.push(['获得等级', String(r.level)]);
  if (!facts.length) return null;
  return <dl className="entry-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><Inline text={value} onLink={onLink}/></dd></div>)}</dl>;
}
