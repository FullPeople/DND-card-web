import type { Page } from '@playwright/test';
// Authored fixtures: no copied publisher rules or personal character data.
const core = (source: string) => ({ name: '测试法师', ENG_name: 'Test Mage', source, hd: { faces: 6 }, proficiency: ['int', 'wis'], startingProficiencies: { skills: [{ choose: { from: ['arcana', 'history', 'insight'], count: 2 } }] }, classFeatures: [`初始特性|测试法师|${source}|1`], cantripProgression: [1, 1, 1], classTableGroups: [{ rowsSpellProgression: [[2], [3], [4, 2]] }] });
const classes = { class: [core('PHB'), core('XPHB')], subclass: ['PHB', 'XPHB'].map(source => ({ name: '测试学派', shortName: '测试学派', source, className: '测试法师', classSource: source, subclassFeatures: [], entries: ['自制测试子职。'] })), classFeature: ['PHB', 'XPHB'].map(source => ({ name: '初始特性', ENG_name: 'First Feature', source, className: '测试法师', classSource: source, level: 1, entries: ['这是一条为软件验收创作的测试规则。可以查阅 {@spell 微光术|XPHB}。', ...Array.from({ length: 28 }, (_, i) => `记录片段 ${i + 1}：供长正文、关键词提示与区域滚动验收使用。`)] })) };
const data: Record<string, unknown> = {
  'class/index.json': { test: 'class-test.json' }, 'class/class-test.json': classes,
  'spells/index.json': { XPHB: 'spells-test.json' },
  'spells/spells-test.json': { spell: [{ name: '微光术', ENG_name: 'Test Glow', source: 'XPHB', level: 0, entries: ['为测试而创作的一点微光。'] }] },
  'generated/gendata-spell-source-lookup.json': { xphb: { 微光术: { class: { XPHB: { 测试法师: true } } } } },
  'races.json': { race: [{ name: '测试旅人', ENG_name: 'Test Traveller', source: 'XPHB', speed: 30, entries: ['自制测试种族。'] }] },
  'backgrounds.json': { background: [{ name: '抄书员', ENG_name: 'Test Scribe', source: 'XPHB', skillProficiencies: [{ history: true }], ability: [{ choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [2, 1] } } }], feats: [{ '旅行笔记|xphb': true }], entries: ['用于验证背景的选择要求。'] }] },
  'feats.json': { feat: [{ name: '旅行笔记', ENG_name: 'Travel Notes', source: 'XPHB', entries: ['记录旅途。'] }] },
  'items-base.json': { baseitem: [{ name: '测试皮甲', ENG_name: 'Test Armor', source: 'XPHB', ac: 11, type: 'LA', entries: ['测试护甲。'] }] },
  'items.json': {}, 'optionalfeatures.json': {}, 'conditionsdiseases.json': {},
};
export async function mockSource(page: Page) {
  await page.route('https://homebrew.kiwee.top/**',route=>route.fulfill({json:{},headers:{'access-control-allow-origin':'*'}}));
  await page.route('https://5e.kiwee.top/data/**', async route => {
    const key = new URL(route.request().url()).pathname.replace('/data/', '');
    await route.fulfill({ json: data[key] || {}, headers: { 'access-control-allow-origin': '*', etag: 'fixture-1' } });
  });
}
export async function fillFromDetail(page: Page) {
  const kind = await page.locator('.entry-detail').getAttribute('data-entry-kind');
  const preferred: Record<string, string> = { class: '.identity-class', subclass: '.identity-subclass', race: '.identity-race', background: '.identity-background', spell: '.overview-spells', condition: '.portrait-cell', feat: '.heritage-features', feature: '.class-features', rule: '.class-features', item: '.quickbar-cell' };
  const target = page.locator(preferred[kind || ''] || '.class-features');
  if (await target.isVisible()) await page.locator('.detail-title').dragTo(target);
  else {
    const zones = page.locator('.paper [data-drop-kind]');
    for (let i = 0; i < await zones.count(); i++) if (await zones.nth(i).isVisible() && (await zones.nth(i).getAttribute('data-drop-kind'))?.split(',').includes(kind || '')) { await page.locator('.detail-title').dragTo(zones.nth(i)); return; }
    throw new Error(`No visible drop region for ${kind}`);
  }
}
