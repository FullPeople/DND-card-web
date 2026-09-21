import { ABILITIES, ABILITY_LABELS, KIND_LABELS, SIZE_LABELS, SKILLS, selectionAllowed, signed, type Character, type Derived, type RulePack } from './model';
import { choiceLabel } from './engine';
export const exportCharacter = (c: Character) => ({ format: 'dnd-card-web', version: 1, exportedAt: new Date().toISOString(), character: c });
export const exportRulePack = (pack: RulePack) => ({ ...pack, entries: pack.entries.map(e => ({ id: e.id.slice(pack.id.length + 1), kind: e.kind, name: e.name, english: e.english, entries: e.entries, raw: e.raw, effects: e.effects || [], choices: e.choices || [] })) });
export function exportOwlbear(c: Character, d: Derived) {
  const active = c.selections.filter(s => selectionAllowed(c, s.entry));
  const entryName = (kind: string) => active.find(s => s.entry.kind === kind)?.entry.name || null;
  const features = (kinds: string[]) => active.filter(s => kinds.includes(s.entry.kind)).map(s => ({ name: s.entry.name, source: s.entry.source, description: plainText(s.entry.entries), level: s.entry.raw.level || null }));
  const spells = active.filter(s => s.entry.kind === 'spell').map(s => ({ name: s.entry.name, level: s.entry.raw.level || 0, source: s.entry.source, description: plainText(s.entry.entries), meta: { source: s.entry.source } }));
  const ability = active.find(s => s.entry.kind === 'class' && s.entry.raw.spellcastingAbility)?.entry.raw.spellcastingAbility;
  const spellMod = d.modifiers[ability as keyof typeof d.modifiers];
  return { schema_version: '0.3', meta: { template_name: 'DND Card Web', template_version: '0.1.0', layout_version: 'web-1', ruleset: c.edition, source_file: `${c.name}.json`, parsed_at: new Date().toISOString() },
    identity: { size: c.size || null, character_name: c.name, display_name: c.name, player: c.player, race: { name: entryName('race'), subrace: null }, background: entryName('background'), alignment: c.identity.alignment || null, gender: c.identity.gender || null, age: c.identity.age || null, languages: [], tool_proficiencies: [] },
    classes: active.filter(s => s.entry.kind === 'class').map((s, i) => ({ role: i === 0 ? '主职' : `兼职${i}`, name: s.entry.name, subclass: active.find(sc => sc.entry.kind === 'subclass' && sc.entry.raw.className === s.entry.name)?.entry.name || null, level: s.level })), total_level: d.level,
    abilities: Object.fromEntries(ABILITIES.map(a => [a, { total: d.abilities[a], initial: c.abilities[a], background: 0, growth: 0, misc: d.abilities[a] - c.abilities[a], modifier: d.modifiers[a], save: { proficient: d.saves[a].proficient, bonus: d.saves[a].value, misc: 0 } }])),
    core_stats: { ac: d.ac, initiative: d.initiative, speed: d.speed, proficiency_bonus: d.proficiency, passive_perception: d.passive, dc: Number.isFinite(spellMod) ? 8 + spellMod + d.proficiency : null, dc_ability: ability || null, hp: { current: c.runtime.hp, max: d.maxHp, temp: c.runtime.tempHp }, hit_dice: { current: d.level, max: d.level, die_size: active.filter(s => s.entry.kind === 'class').length === 1 ? active.find(s => s.entry.kind === 'class')!.entry.raw.hd?.faces || null : null }, inspiration: c.runtime.inspiration },
    skills: Object.entries(d.skills).map(([key, s]) => ({ name: SKILLS[key].name, ability: SKILLS[key].ability, total: s.value, proficiency: s.expertise ? 'expertise' : s.proficient ? 'proficient' : 'none', misc_bonus: s.value - d.modifiers[SKILLS[key].ability] - (s.proficient ? d.proficiency * (s.expertise ? 2 : 1) : 0) })),
    defenses: { resistances: [], immunities: [], advantages: [], disadvantages: [] },
    combat: { armor: null, shield: null, weapons: [] },
    features: { class_features: features(['feature', 'subclass']), race_features: features(['race']), feats: features(['feat']), fighting_style_feats: [], special_abilities: [] },
    inventory: { items: active.filter(s => s.entry.kind === 'item').map(s => ({ name: s.entry.name, quantity: s.quantity, equipped: s.equipped, weight: s.entry.raw.weight || 0, description: plainText(s.entry.entries) })), wondrous_items: [], consumables: [], containers: [] },
    spellcasting: { spellcasting_ability: ability || null, save_dc: Number.isFinite(spellMod) ? 8 + spellMod + d.proficiency : null, attack_bonus: Number.isFinite(spellMod) ? spellMod + d.proficiency : null, spell_slots: {}, cantrips_known: spells.filter(s => s.level === 0), prepared: spells.filter(s => s.level > 0), always_known: [] },
    background: { background_name: entryName('background'), appearance: c.identity.description, story: c.notes, description: plainText(active.find(s => s.entry.kind === 'background')?.entry.entries) },
    web_resources: c.runtime.resources,
    export_warnings: ['手动记录、选择历史和自定义规则包请保留在原生角色备份中。法术暂放入已准备列表；法术位、武器攻击、抗性和复杂特性需在枭熊中核对。', ...d.requirements.filter(r => !r.complete).map(r => `未完成：${r.label}（${r.origin}）`), ...d.issues.map(i => i.message), ...(c.adjustments || []).map(a => `人工修正 ${a.target}=${a.value}：${a.reason}`)] };
}
export function plainText(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\{@\w+\s+([^{}]+)\}/g, (_, body: string) => body.split('|')[2] || body.split('|')[0]);
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') { const v = value as Record<string, unknown>; return [v.name, v.entries, v.entry, v.items, v.rows].map(plainText).filter(Boolean).join('\n'); }
  return '';
}
const esc = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
export function exportReview(c: Character, d: Derived, sourceName: (id:string)=>string = id=>id): string {
  const pending = d.requirements.filter(r => !r.complete);
  const table = (headers: string[], rows: unknown[][]) => `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const sections = [
    `<h1>${esc(c.name)}</h1><p>玩家 ${esc(c.player)} · ${c.edition} · 修订 ${c.revision} · ${esc(c.updatedAt)}</p><p class="muted">固定修订的审阅副本，可离线阅读或使用浏览器打印为 PDF。基础计算不代替特殊规则核对。</p>`,
    `<p>${esc(c.selections.filter(s => s.entry.kind === 'class').map(s => `${s.entry.name} ${s.level} 级`).join(' / '))} · ${esc(c.identity.gender)} · ${esc(c.identity.alignment)}</p>`,
    table(['属性', '基础', '最终值', '调整值', '豁免'], ABILITIES.map(a => [ABILITY_LABELS[a], c.abilities[a], d.abilities[a], signed(d.modifiers[a]), `${signed(d.saves[a].value)}${d.saves[a].proficient ? '（熟练）' : ''}`])),
    `<p>等级 ${d.level} · AC ${d.ac} · HP ${c.runtime.hp}/${d.maxHp}（临时 ${c.runtime.tempHp}）· 先攻 ${signed(d.initiative)} · 速度 ${d.speed} 尺 · 熟练 ${signed(d.proficiency)} · 被动察觉 ${d.passive} · 生命骰 ${esc(d.hitDice)}${c.size ? ` · 体型 ${esc(SIZE_LABELS[c.size])}` : ''}</p>`,
    '<h2>技能与熟练</h2>', table(['技能', '检定', '熟练来源'], Object.entries(SKILLS).map(([key, skill]) => [skill.name, signed(d.skills[key].value), d.skills[key].sources.join('；') || '无'])),
    '<h2>装备训练记录</h2>', table(['类别', '记录'], Object.entries(c.training || {})),
    '<h2>填写与核对</h2>', `<ul>${pending.map(r => `<li>${esc(r.label)} — ${esc(r.origin)}（${r.selected.length}/${r.count}）</li>`).join('') || '<li>本卡由玩家手动记录，不自动判定选择数量或前提是否合法；请由 DM 核对。</li>'}${d.issues.map(i => `<li>${esc(i.message)}</li>`).join('')}</ul>`,
    '<h2>已经记录的选择</h2>', table(['选择要求', '已选内容'], Object.entries(c.answers).map(([id, values]) => { const r = d.requirements.find(r => r.id === id); return [r ? `${r.origin} · ${r.label}` : `历史记录：${id}`, values.map(v => r?.optionLabels?.[v] || choiceLabel(v)).join('、')]; })),
    `<h2>启用规则</h2><p>${c.profile.enabledSources.map(sourceName).map(esc).join('、')}</p><p>专长：${c.profile.optional.feats ? '开' : '关'}；兼职：${c.profile.optional.multiclass ? '开' : '关'}；旧版兼容：${c.profile.optional.legacy ? '开' : '关'}</p>`,
    '<h2>人工裁定与数值修正</h2>', `<ul>${Object.entries(c.profile.exceptions).map(([id, reason]) => `<li>条目特许 · ${esc(c.selections.find(s => s.entry.id === id)?.entry.name || id)}：${esc(reason)}</li>`).join('')}${(c.adjustments || []).map(a => `<li>${esc(a.target)} → ${a.value}：${esc(a.reason)}</li>`).join('')}${Object.entries(c.sheetBonuses || {}).map(([key, value]) => `<li>${esc(key)} ${signed(value)}（卡面调整）</li>`).join('')}</ul>`,
    '<h2>当前资源</h2>', table(['资源', '剩余', '上限'], Object.entries(c.runtime.resources).map(([name, v]) => [name, v.current, v.max])),
    '<h2>角色条目与固定来源</h2>', ...c.selections.map(s => `<article><h3>${esc(s.entry.name)} <small>${esc(KIND_LABELS[s.entry.kind])}</small></h3><p class="muted">${esc(sourceName(s.entry.source))} · ${esc(s.entry.edition)} · 资料修订 ${esc(s.entry.revision)}${s.entry.page ? ` · 第 ${s.entry.page} 页` : ''}</p><p>${s.entry.kind === 'class' ? `${s.level} 级 · ` : ''}${s.entry.kind === 'item' ? `数量 ${s.quantity} · ${s.equipped ? '已装备' : '未装备'} · ` : ''}${selectionAllowed(c, s.entry) ? '来源已启用' : '来源或规则未启用，效果暂停'}${s.parentId ? ` · 来自：${esc(c.selections.find(p => p.id === s.parentId)?.entry.name || '已移除来源')}` : ''}${c.reviewed.includes(s.id) ? ' · 特殊效果已人工核对' : ''}</p><pre>${esc(plainText(s.entry.entries))}</pre></article>`),
    `<h2>人物印象与笔记</h2><pre>${esc(c.identity.description)}\n${esc(c.notes)}</pre>`,
    '<h2>数值依据</h2>', ...Object.entries(d.trace).map(([key, values]) => `<p>${esc(choiceLabel(key))}：${values.map(esc).join('；')}</p>`),
  ];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.name)} · 审卡记录</title><style>body{max-width:900px;margin:35px auto;padding:0 24px;font:15px/1.8 system-ui;color:#292d27;background:#fff}h1{border-bottom:3px solid #555}h2{font-size:20px;border-bottom:1px solid #aaa;margin-top:30px}h3{font-size:17px}table{border-collapse:collapse;width:100%;margin:14px 0}td,th{border:1px solid #bbb;padding:6px 9px;text-align:left}th{background:#eee}tr{break-inside:avoid}article{border-bottom:1px solid #ccc}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.muted,small{color:#76796f;font-size:12px;overflow-wrap:anywhere}@media print{body{margin:0;max-width:none;font-size:11px}h2,h3{break-after:avoid}th{print-color-adjust:exact}}</style></head><body>${sections.join('')}</body></html>`;
}
