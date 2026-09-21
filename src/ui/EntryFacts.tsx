import { ABILITY_LABELS, type Ability, type Entry } from '../core/model';
import { speedText, abilityText, hasSpellcasting, prerequisiteText, translate as translateRule } from './libraryData';
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
    facts.push(['施法者',hasSpellcasting(entry)?'是':'否']);
    if (r.hd?.faces) facts.push(['生命骰', `d${r.hd.faces}`]);
    if (Array.isArray(r.proficiency)) facts.push(['豁免熟练', r.proficiency.map((a: Ability) => ABILITY_LABELS[a] || a).join('、')]);
    if (r.spellcastingAbility) facts.push(['施法属性', ABILITY_LABELS[r.spellcastingAbility as Ability] || r.spellcastingAbility]);
  }
  if (entry.kind === 'race') {
    if (r.speed) facts.push(['速度', speedText(r.speed)]);
    if (r.ability) facts.push(['属性值加成',abilityText(r.ability)]);
    if (Array.isArray(r.size)) facts.push(['体型', r.size.map((s: string) => ({ T: '微型', S: '小型', M: '中型', L: '大型', H: '巨型', G: '超巨型' }[s] || s)).join(' / ')]);
  }
  if (entry.kind === 'monster') {
    const cr=typeof r.cr==='object'?r.cr.cr:r.cr;
    if(cr!=null)facts.push(['挑战等级',String(cr)]);
    if(Array.isArray(r.ac))facts.push(['护甲等级',r.ac.map((a:any)=>typeof a==='number'?a:`${a.special||a.ac}${a.from?`（${a.from.join('、')}）`:''}${a.condition||''}`).join(' / ')]);
    if(r.hp)facts.push(['生命值',r.hp.special||`${r.hp.average}（${r.hp.formula}）`]);
    if(r.speed)facts.push(['速度',speedText(r.speed)]);
    for(const a of Object.keys(ABILITY_LABELS) as Ability[])if(r[a]!=null)facts.push([ABILITY_LABELS[a],String(r[a])]);
    if(r.type)facts.push(['类型',translateRule(r.type.type||r.type)]);
    if(r.size)facts.push(['体型',r.size.map((v:string)=>({T:'微型',S:'小型',M:'中型',L:'大型',H:'巨型',G:'超巨型'}[v]||v)).join(' / ')]);
    if(r.alignment)facts.push(['阵营',r.alignment.map((v:any)=>typeof v==='string'?({L:'守序',N:'中立',C:'混乱',G:'善良',E:'邪恶',U:'无阵营',A:'任意阵营'}[v]||v):v.special||v.alignment?.join(' / ')||'').join(' ')]);
    const defenses=(v:any,key:string):string=>Array.isArray(v)?v.map(x=>defenses(x,key)).join('、'):typeof v==='string'?translateRule(v):v?.special||`${v?.preNote||''}${defenses(v?.[key]||[],key)}${v?.note||''}`;
    for(const [key,label] of [['resist','伤害抗性'],['immune','伤害免疫'],['vulnerable','伤害易伤']])if(r[key])facts.push([label,defenses(r[key],key)]);
    if(r.skill)facts.push(['技能',Object.entries(r.skill).map(([key,value])=>`${({acrobatics:'特技','animal handling':'驯兽',arcana:'奥秘',athletics:'运动',deception:'欺瞒',history:'历史',insight:'洞悉',intimidation:'威吓',investigation:'调查',medicine:'医药',nature:'自然',perception:'察觉',performance:'表演',persuasion:'游说',religion:'宗教','sleight of hand':'巧手',stealth:'隐匿',survival:'生存'} as Record<string,string>)[key]||key} ${value}`).join('、')]);
    if(r.passive)facts.push(['被动察觉',String(r.passive)]);
    if(r.save)facts.push(['豁免',Object.entries(r.save).map(([a,v])=>`${ABILITY_LABELS[a as Ability]||a} ${v}`).join('、')]);
    for(const [key,label] of [['senses','感官'],['languages','语言'],['conditionImmune','状态免疫']])if(r[key])facts.push([label,r[key].map((v:any)=>typeof v==='string'?v:v.special||'').join('、')]);
  }
  if (entry.kind === 'item') {
    if (r.ac) facts.push(['护甲基础值', String(r.ac)]);
    if (r.dmg1) facts.push(['武器伤害', `${r.dmg1}${r.dmg2 ? ` / 多用 ${r.dmg2}` : ''}`]);
    if (r.reqAttune) facts.push(['同调', typeof r.reqAttune === 'string' ? r.reqAttune : '需要同调']);
  }
  if (entry.kind === 'feat' && r.category) facts.push(['专长类别', ({ O: '起源', G: '通用', FS: '战斗风格', EB: '传奇恩惠' } as Record<string, string>)[r.category] || r.category]);
  if (r.prerequisite) facts.push(['先决条件',prerequisiteText(r.prerequisite)]);
  if (entry.kind === 'feature' && r.level) facts.push(['获得等级', String(r.level)]);
  if (r._category === 'language') {
    if (r.type) facts.push(['类别', ({ standard: '标准', exotic: '异种', secret: '秘密' } as Record<string, string>)[r.type] || r.type]);
    if (r.script) facts.push(['文字', r.script]);
    if (Array.isArray(r.typicalSpeakers)) facts.push(['典型使用者', r.typicalSpeakers.join('、')]);
  }
  if (!facts.length) return null;
  return <dl className="entry-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><Inline text={value} onLink={onLink}/></dd></div>)}</dl>;
}
