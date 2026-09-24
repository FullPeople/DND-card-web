import { compareSources, SOURCE_SEED, type SourceMeta } from './SourceName';
const collator = new Intl.Collator('zh-CN', { numeric: true });
import { entryEdition, ABILITY_LABELS, type Ability, type Character, type Entry, type Kind } from '../core/model';

export const LIBRARY_TABS = { class: '职业', race: '种族', background: '背景', feat: '专长', spell: '法术', item: '装备', condition: '状态', rule: '术语汇编', language: '语言', size: '体型', weaponProperty: '武器词条', weaponMastery: '武器精通', monster: '怪物图鉴', reference: '其他资料', custom:'自定义' };
export type LibraryTab = keyof typeof LIBRARY_TABS;
export type FacetSelection = Record<string, { include: string[]; exclude: string[] }>;
export type Column = { key: string; label: string; value: (e: Entry) => string | number };
export const explicitlyExcluded = (c:Character,e:Entry):boolean => c.profile.enabledSources.includes(e.source) && !!c.profile.disabledEntries?.includes(e.id);
export const tabOf = (e: Entry): LibraryTab => {
  if(e.raw._workbenchCustom)return 'custom';
  const category=e.raw._category;
  if(category==='itemProperty')return 'weaponProperty';
  if(category==='itemMastery')return 'weaponMastery';
  if(category==='size')return 'size';
  if(category==='language')return 'language';
  if(category==='disease')return 'reference';
  if(e.kind==='rule' && category && !['variantrule','action','sense','skill'].includes(category))return 'reference';
  if(e.kind==='subclass'||e.kind==='feature')return 'class';
  return e.kind;
};
export const browseTab = (kind: Kind): LibraryTab => kind === 'subclass' || kind === 'feature' ? 'class' : kind;
export function speedText(raw: any): string { return typeof raw === 'number' ? `${raw}尺` : raw && typeof raw === 'object' ? Object.entries(raw).filter(([k,v])=>['walk','fly','swim','climb','burrow'].includes(k) && v).map(([k,v]:[string,any])=>`${({walk:'步行',fly:'飞行',swim:'游泳',climb:'攀爬',burrow:'掘穴'} as Record<string,string>)[k]} ${typeof v==='number'?v:v===true?'等同步速':v.number||''}尺`).join(' / ') : '—'; }
export function abilityText(value: unknown):string {
 if(Array.isArray(value))return value.map(abilityText).join(' 或 ');
 if(!value||typeof value!=='object')return String(value??'');
 return Object.entries(value).map(([k,v]:[string,any])=>k==='choose'?`自选${v.count||1}项 +${v.amount||1}`:`${ABILITY_LABELS[k as Ability]||k} ${typeof v==='number'?(v>=0?'+':'')+v:abilityText(v)}`).join('、');
}
export function prerequisiteText(value:unknown):string {
 if(Array.isArray(value))return value.map(prerequisiteText).join(' 或 ');
 if(!value||typeof value!=='object')return String(value??'');
 return Object.entries(value).map(([key,v]:[string,any])=>{
  if(key==='level')return typeof v==='number'?`${v}级`:`${v.class?.name||''}${v.level}级`;
  if(key==='ability')return abilityText(v).replaceAll('+','');
  if(key.startsWith('spellcasting')&&v)return '具备施法能力';
  if(key==='feat')return `专长：${(Array.isArray(v)?v:[v]).map((s:string)=>s.split('|')[0]).join('、')}`;
  if(key==='race')return `种族：${(Array.isArray(v)?v:[v]).map((x:any)=>x.name||x).join('、')}`;
  if(key==='proficiency')return `熟练：${prerequisiteText(v)}`;
  return typeof v==='string'?v:typeof v==='boolean'?(v?({pact:'契约特性',psionics:'灵能'}[key]||key):''):prerequisiteText(v);
 }).filter(Boolean).join('；');
}
export const hasSpellcasting=(e:Entry)=>[...(e.raw.classFeatures||[]),...(e.raw.subclassFeatures||[])].some((f:any)=>/(?:施法|spellcasting)/i.test(typeof f==='string'?f:f.classFeature||f.subclassFeature||''))||JSON.stringify(e.entries).includes('"name":"施法"');
const words: Record<string, string> = { A: '防护', C: '咒法', D: '预言', E: '惑控', V: '塑能', I: '幻术', N: '死灵', T: '变化', action: '动作', bonus: '附赠动作', reaction: '反应', minute: '分钟', hour: '小时', round: '轮', day: '天', feet: '尺', miles: '里', self: '自身', touch: '触及', sight: '视野', unlimited: '无限', instant: '立即', timed: '计时', permanent: '永久', special: '特殊', standard: '标准', exotic: '异种', secret: '秘密', common: '普通', uncommon: '非普通', rare: '珍稀', 'very rare': '极珍稀', legendary: '传说', artifact: '神器', none: '无', varies: '可变', O: '起源', G: '通用', FS: '战斗风格', EB: '传奇恩惠', LA: '轻甲', MA: '中甲', HA: '重甲', S: '盾牌', M: '近战武器', R: '远程武器', AT: '工匠工具', INS: '乐器', SCF: '法器', P: '药水', W: '奇物', RD: '权杖', RG: '戒指', ST: '法杖', WD: '魔杖', SC: '卷轴', simple: '简易', martial: '军用', acid: '强酸', bludgeoning: '钝击', cold: '寒冷', fire: '火焰', force: '力场', lightning: '闪电', necrotic: '暗蚀', piercing: '穿刺', poison: '毒素', psychic: '心灵', radiant: '光耀', slashing: '挥砍', thunder: '雷鸣', aberration:'异怪', beast:'野兽', celestial:'天界生物', construct:'构装体', dragon:'龙', elemental:'元素', fey:'妖精', fiend:'邪魔', giant:'巨人', humanoid:'类人生物', monstrosity:'怪兽', ooze:'泥怪', plant:'植物', undead:'亡灵' };
export const translate = (v: unknown): string => { const s = String(v ?? ''); return words[s] || s; };
export const timeText = (e: Entry) => (e.raw.time || []).map((t: any) => `${t.number || 1}${translate(t.unit)}`).join(' / ');
export const rangeText = (e: Entry) => e.raw.range?.distance ? `${e.raw.range.distance.amount ?? ''}${translate(e.raw.range.distance.type)}` : translate(e.raw.range?.type);
export function columnsFor(tab: LibraryTab, legacy = true): Column[] {
  const name = { key: 'name', label: '名称', value: (e: Entry) => e.name }, source = { key: 'source', label: '来源', value: (e: Entry) => e.source };
  const middle: Record<string, Column[]> = {
    spell: [{ key: 'level', label: '环阶', value: e => e.raw.level ?? -1 }, { key: 'time', label: '时间', value: timeText }, { key: 'school', label: '学派', value: e => translate(e.raw.school) }, { key: 'ritual', label: '仪式', value: e => e.raw.meta?.ritual ? '是' : '—' }, { key: 'concentration', label: '专注', value: e => e.raw.duration?.some((d: any) => d.concentration) ? '是' : '—' }, { key: 'range', label: '范围', value: rangeText }],
    class: [{ key: 'hd', label: '生命骰', value: e => e.raw.hd?.faces || 0 }, { key: 'save', label: '豁免熟练', value: e => (e.raw.proficiency || []).map((a: Ability) => ABILITY_LABELS[a] || a).join(' / ') }, {key:'caster',label:'施法者',value:e=>hasSpellcasting(e)?'是':'—'}],
    feature: [{ key: 'level', label: '等级', value: e => e.raw.level ?? 0 }, { key: 'class', label: '所属职业', value: e => e.raw.className || '—' }],
    item: [{ key: 'type', label: '类型', value: e => translate(String(e.raw.type || '').split('|')[0]) }, { key: 'rarity', label: '稀有度', value: e => translate(e.raw.rarity) }, { key: 'weight', label: '重量', value: e => e.raw.weight ?? 0 }, { key: 'value', label: '金币', value: e => (e.raw.value ?? 0) / 100 }],
    feat: [{ key: 'category', label: '类别', value: e => translate(e.raw.category) },{key:'prerequisite',label:'先决条件',value:e=>prerequisiteText(e.raw.prerequisite)||'—'}],
    monster:[{key:'cr',label:'挑战等级',value:e=>e.raw.cr?.cr||e.raw.cr||'—'},{key:'type',label:'类型',value:e=>translate(e.raw.type?.type||e.raw.type)}],
    size: [{ key: 'edition', label: '版本', value: e => e.edition }],
    language: [{ key: 'type', label: '类别', value: e => translate(e.raw.type) }, { key: 'script', label: '文字', value: e => e.raw.script || '—' }],
    rule: [{ key: 'type', label: '类别', value: e => ({ variantrule: '规则术语', action: '动作', sense: '感官', skill: '技能', itemProperty: '武器属性', itemType: '物品类别', table: '表格', tableGroup: '表格组', deity: '神祇', cult: '教团', facility: '堡垒设施' }[e.raw._category as string] || '其他') }],
    race: [{ key: 'size', label: '体型', value: e => (e.raw.size || []).map((s: string) => ({ T: '微型', S: '小型', M: '中型', L: '大型', H: '巨型', G: '超巨型' }[s] || s)).join('/') },{key:'speed',label:'速度',value:e=>speedText(e.raw.speed)},...(legacy?[{key:'ability',label:'属性加成',value:(e:Entry)=>abilityText(e.raw.ability)||'—'}]:[])],
  };
  return [name, ...(middle[tab==='reference'?'rule':tab] || [{ key: 'edition', label: '版本', value: (e: Entry) => entryEdition(e) === 'both' ? '通用' : entryEdition(e) }]), source];
}
export function compareEntries(a: Entry, b: Entry, column: Column, descending: boolean, registry: Record<string, SourceMeta> = SOURCE_SEED) {
  const rank = (e: Entry): string | number => {
    if (column.key === 'cr') {const v=String(e.raw.cr?.cr??e.raw.cr??'');const parts=v.split('/').map(Number);return parts.length===2?parts[0]/parts[1]:v&&Number.isFinite(Number(v))?Number(v):Infinity;}
    if (column.key === 'time') return Math.min(...(e.raw.time || []).map((t: any) => (t.number || 1) * ({ reaction: 0.5, bonus: 0.75, action: 1, round: 6, minute: 60, hour: 3600, day: 86400 }[t.unit as string] || 1)), Infinity);
    if (column.key === 'range') { const d = e.raw.range?.distance; return d?.amount != null ? d.amount * (d.type === 'miles' ? 5280 : 1) : ({ self: 0, touch: 1, sight: 1e8, unlimited: 1e9 }[d?.type as string] ?? 1e10); }
    if (column.key === 'rarity') return ['none', 'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'].indexOf(e.raw.rarity);
    return column.value(e);
  };
  if (column.key === 'source') {
    const extra = a.kind === 'condition' && b.kind === 'condition' ? Number(a.raw._category === 'status') - Number(b.raw._category === 'status') : 0;
    return (extra || compareSources(a.source,b.source,registry) || collator.compare(a.name,b.name) || a.id.localeCompare(b.id)) * (descending ? -1 : 1);
  }
  const x = rank(a), y = rank(b);
  const comparison = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
  return (comparison || collator.compare(a.name,b.name) || a.id.localeCompare(b.id)) * (descending ? -1 : 1);
}
export type Facet = { key: string; label: string; values: (e: Entry) => string[] };
const array = (v: unknown) => (Array.isArray(v) ? v : v == null ? [] : [v]).filter(v => typeof v === 'string' || typeof v === 'number').map(String);
export function facetsFor(tab: LibraryTab): Facet[] {
  const fields: Facet[] = [{ key: 'source', label: '来源', values: e => [e.source] }, { key: 'edition', label: '版本', values: e => [entryEdition(e) === 'both' ? '通用' : entryEdition(e)] }];
  for (const col of columnsFor(tab)) if (!['source', 'name', 'edition', 'weight', 'value'].includes(col.key)) fields.push({ key: col.key, label: col.label, values: e => { const v = col.value(e); return v === '' || v === '—' ? [] : [String(v)]; } });
  fields.push({ key: 'classList', label: '职业法术表', values: e => { const found: string[] = []; const walk = (v: unknown) => { if (!v || typeof v !== 'object') return; for (const [key, value] of Object.entries(v)) { if (value === true) found.push(key); else walk(value); } }; walk(e.raw._spellClasses); for (const item of e.raw.classes?.fromClassList || []) if (item.name) found.push(item.name); return [...new Set(found)]; } },
    { key: 'damage', label: '伤害类型', values: e => array(e.raw.damageInflict).map(translate) },
    { key: 'components', label: '成分与标记', values: e => [e.raw.components?.v && '言语', e.raw.components?.s && '姿势', e.raw.components?.m && '材料', e.raw.meta?.ritual && '仪式', e.raw.reqAttune && '需要同调'].filter(Boolean) as string[] },
    { key: 'featureType', label: '特性类别', values: e => array(e.raw.featureType) },
    { key: 'weaponCategory', label: '武器类别', values: e => array(e.raw.weaponCategory).map(translate) });
  return fields;
}
export function matchesFacets(e: Entry, filters: FacetSelection, facets: Facet[], except?: string) {
  return facets.every(f => { const filter = filters[f.key]; if (!filter || f.key === except) return true; const values = f.values(e); return (!filter.include.length || filter.include.some(v => values.includes(v))) && !filter.exclude.some(v => values.includes(v)); });
}
