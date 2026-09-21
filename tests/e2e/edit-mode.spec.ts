import { test, expect } from '@playwright/test';
import { mockSource } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockSource(page);
  await page.route('**/data/class/class-test.json', route => route.fulfill({ json: { class: [{ name: '测试法师', source: 'XPHB', hd: { faces: 6 }, proficiency: ['int', 'wis'], classFeatures: ['测试特性|测试法师|XPHB|1'], classTableGroups: [{ colLabels: ['回气次数', '固定值'], rows: [[2, 0], [2, 0], [2, 0], [3, 0]] }], startingEquipment: { default: ['测试装备。'] } }], classFeature: [{ name: '测试特性', source: 'XPHB', className: '测试法师', classSource: 'XPHB', level: 1, entries: ['自制正文。参见 {@item 测试皮甲|XPHB}。', { name: '细节', type: 'entries', entries: ['第二段。'] }] }] } }));
  await page.route('**/data/items-base.json', route => route.fulfill({ json: { baseitem: [{ name: '测试皮甲', source: 'XPHB', weight: 2, value: 50, entries: [{ name: '装备正文', type: 'entries', entries: ['短正文。'] }] }] } }));
  await page.goto('/'); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled();
});

test('edit switch locks setup fields while additive modifiers follow level and survive reload', async ({ page }) => {
  await expect(page.getByRole('spinbutton', { name: '敏捷基础值' })).toHaveAttribute('readonly', '');
  await expect(page.getByRole('checkbox', { name: '察觉熟练', exact: true })).toHaveCount(0);
  await page.getByRole('spinbutton', { name: '当前生命值', exact: true }).fill('5');
  await page.locator('.catalog-row').filter({ hasText: '测试法师' }).dragTo(page.locator('.identity-class'));
  const mode = page.getByRole('switch', { name: '编辑模式' }); await mode.click();
  await page.getByRole('spinbutton', { name: '敏捷基础值' }).fill('14'); await page.getByRole('checkbox', { name: '察觉熟练', exact: true }).check();
  for (const [name, value] of [['熟练加值调整值', '1'], ['先攻调整值', '4'], ['速度调整值', '5'], ['被动察觉调整值', '2'], ['生命值上限调整值', '3']]) await page.getByRole('spinbutton', { name, exact: true }).fill(value);
  await page.getByRole('combobox', { name: '体型', exact: true }).selectOption('L');
  await page.getByRole('button', { name: '编辑装备训练与其他熟练' }).click(); await page.getByRole('textbox', { name: '工具熟练记录' }).fill('自制工具'); await page.getByRole('textbox', { name: '工具熟练记录' }).press('Tab');
  await expect(page.locator('[data-stat=proficiency]')).toHaveText('+3'); await expect(page.locator('[data-stat=initiative]')).toHaveText('+6'); await expect(page.locator('[data-stat=hp]')).toHaveText('9');
  await mode.click(); await expect(page.getByRole('spinbutton', { name: '速度调整值' })).toHaveCount(0); await expect(page.getByRole('checkbox', { name: '察觉熟练', exact: true })).toHaveCount(0);
  await page.getByRole('spinbutton', { name: '临时生命值', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: '测试法师等级', exact: true }).fill('5');
  await expect(page.locator('[data-stat=proficiency]')).toHaveText('+4'); await expect(page.locator('[data-stat=passive]')).toHaveText('16');
  await page.reload(); await expect(mode).toHaveAttribute('aria-checked', 'false'); await expect(page.locator('[data-stat=hp]')).toHaveText('25'); await expect(page.locator('.size-value')).toHaveText('大型'); await expect(page.locator('.training-cell')).toContainText('自制工具');
  const boxes = await page.locator('.proficiency-cell .cell-content,.overview-vitals .cell-content,.life-cell .cell-content').evaluateAll(es => es.map(e => ({ h: e.clientHeight, s: e.scrollHeight, w: e.clientWidth, sw: e.scrollWidth })));
  for (const b of boxes) { expect(b.s).toBeLessThanOrEqual(b.h + 1); expect(b.sw).toBeLessThanOrEqual(b.w + 1); }
});

test('reference prose uses compact full-width tables, corner badges and class-only navigation', async ({ page }) => {
  await page.locator('.catalog-row').first().click();
  await expect(page.getByRole('button', { name: '加入角色卡', exact: true })).toHaveCount(0);
  await expect(page.locator('.document-prose')).not.toContainText('自行填入'); await expect(page.locator('.document-prose')).not.toContainText('职业等级可');
  const table = page.locator('.document-prose table').first(); await expect(table.locator('tbody tr')).toHaveCount(4); await expect(table.locator('tbody tr').first().locator('td')).toHaveText(['1', '2', '0']); await expect(table.locator('td[rowspan]:not([rowspan="1"])')).toHaveCount(0);
  const widths = await table.evaluate(e => [e.getBoundingClientRect().width, e.parentElement!.getBoundingClientRect().width]); expect(Math.abs(widths[0] - widths[1])).toBeLessThan(3);
  await expect(page.getByRole('navigation', { name: '正文目录' })).toBeVisible();
  await page.locator('.detail-title').dragTo(page.locator('.identity-class'));
  const title = page.getByRole('button', { name: '展开全部特性', exact: true }); await title.click(); await expect(page.locator('.class-features .feature-bubble')).toHaveClass(/is-expanded/); await expect(title).toHaveCount(0);
  await expect(page.locator('.class-features .cell-heading')).toHaveText('特性'); await expect(page.locator('.quickbar-cell .cell-heading')).toHaveText('快捷栏');
  await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name: '装备', exact: true }).click(); await page.locator('.catalog-row').first().click();
  await expect(page.getByRole('navigation', { name: '正文目录' })).toHaveCount(0); await expect(page.locator('.detail-heading .entry-badges')).toHaveText('0.5 gp2 磅');
  await page.getByRole('button', { name: '折叠全部特性', exact: true }).click();
  await page.locator('.class-features .feature-caption').click(); await page.mouse.move(40, 40);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.locator('.document-prose').getByRole('button', { name: '测试皮甲', exact: true }).hover();
  await expect(page.getByRole('tooltip').last().locator('.entry-badges')).toHaveText('0.5 gp2 磅');
  const spacing = await page.getByRole('tooltip').last().locator('.keyword-content p').first().evaluate(e => ({ margin: parseFloat(getComputedStyle(e).marginBottom), line: parseFloat(getComputedStyle(e).lineHeight) })); expect(spacing.margin).toBeLessThanOrEqual(3); expect(spacing.line).toBeLessThanOrEqual(17);
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name: '体型', exact: true }).click(); await expect(page.locator('.catalog-row')).toHaveCount(6);
  await page.locator('.catalog-row').filter({ hasText: '超巨型' }).click(); await expect(page.locator('.entry-detail')).toContainText('力量值 × 120'); await expect(page.locator('.entry-detail')).toContainText('项目整理'); await expect(page.getByRole('navigation', { name: '正文目录' })).toHaveCount(0);
});
