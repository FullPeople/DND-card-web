import { test, expect } from '@playwright/test';
import { mockSource, fillFromDetail } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockSource(page);
  await page.route('**/data/spells/spells-test.json', route => route.fulfill({ json: { spell: [
    { name: '低环甲', ENG_name: 'Low Ember', source: 'XPHB', level: 1, school: 'V', time: [{ number: 1, unit: 'action' }], entries: ['用于验收的一点火光。'] },
    { name: '高环乙', ENG_name: 'High Ember', source: 'XPHB', level: 3, school: 'V', time: [{ number: 1, unit: 'action' }], entries: ['用于验收的另一点火光。'] },
    { name: '幻影丙', ENG_name: 'Test Mirage', source: 'XPHB', level: 2, school: 'I', entries: ['用于验收的幻象。'] },
  ] } }));
  await page.route('**/data/languages.json', route => route.fulfill({ json: { language: [{ name: '测试语', ENG_name: 'Test Speech', source: 'XPHB', type: 'standard', script: '测试文字', entries: ['自制语言正文。'] }] } }));
  await page.route('**/data/conditionsdiseases.json', route => route.fulfill({ json: { condition: [{ name: '测试状态', source: 'XPHB', entries: ['用于验收的状态正文。'] }] } }));
  await page.goto('/'); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled(); await page.getByRole('switch', { name: '编辑模式' }).click();
});

test('category documents, scroll positions, sorting and facet choices survive switching and refresh', async ({ page }) => {
  const tabs = page.getByRole('navigation', { name: '资料分类' });
  await expect(tabs.getByRole('button', { name: '子职', exact: true })).toHaveCount(0);
  await expect(tabs.getByRole('button', { name: '术语汇编', exact: true })).toBeVisible();
  await page.locator('.catalog-row').filter({ hasText: '测试法师' }).click();
  await expect(page.locator('.document-prose')).toContainText('这是一条为软件验收');
  await expect(page.locator('.document-nav')).toContainText('等级 1');
  await page.locator('.entry-detail').evaluate(e => { e.scrollTop = 280; });
  await expect.poll(() => page.locator('.entry-detail').evaluate(e => e.scrollTop)).toBeGreaterThan(200);
  const top = await page.locator('.entry-detail').evaluate(e => e.scrollTop);
  await tabs.getByRole('button', { name: '法术', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: /环阶/ })).toHaveAttribute('aria-sort','ascending');
  await expect(page.locator('.catalog-row').first()).toContainText('低环甲');
  await page.getByRole('columnheader', { name: '环阶' }).click();
  await expect(page.locator('.catalog-row').first()).toContainText('高环乙');
  await page.locator('.catalog-row').first().click();
  await tabs.getByRole('button', { name: '语言', exact: true }).click(); await page.locator('.catalog-row').first().click();
  await expect(page.locator('.entry-detail')).toContainText('自制语言正文');
  await tabs.getByRole('button', { name: '职业', exact: true }).click();
  await expect(page.locator('.detail-heading')).toContainText('测试法师');
  await expect.poll(() => page.locator('.entry-detail').evaluate(e => e.scrollTop)).toBeCloseTo(top, 0);
  await tabs.getByRole('button', { name: '法术', exact: true }).click();
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '筛选规则资料' });
  await dialog.getByRole('navigation').getByRole('button', { name: /^学派/ }).click();
  await dialog.getByRole('checkbox', { name: /塑能/ }).check();
  await dialog.getByRole('button', { name: '完成 · 查看结果' }).click();
  await expect(page.locator('.catalog-row')).toHaveCount(2);
  await page.reload(); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled();
  await expect(page.locator('.catalog-row')).toHaveCount(2);
  await expect(page.locator('.catalog-row').first()).toContainText('高环乙');
  await expect(page.locator('.detail-heading')).toContainText('高环乙');
  await tabs.getByRole('button', { name: '语言', exact: true }).click(); await expect(page.locator('.entry-detail')).toContainText('自制语言正文');
});

test('filter exclusions and paragraph collapse persist without changing the selected character', async ({ page }) => {
  await page.locator('.catalog-row').filter({ hasText: '测试法师' }).click();
  await page.getByRole('button', { name: '折叠段落 等级特性', exact: true }).click();
  await expect(page.locator('.document-prose')).not.toContainText('这是一条为软件验收');
  await page.reload(); await expect(page.getByRole('button', { name: '展开段落 等级特性', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '正文目录' }).getByRole('button', { name: '初始特性', exact: true }).click();
  await expect(page.locator('.document-prose')).toContainText('这是一条为软件验收');
  await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name: '法术', exact: true }).click();
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('navigation').getByRole('button', { name: /^学派/ }).click();
  await dialog.getByRole('button', { name: '排除塑能', exact: true }).click();
  await dialog.getByRole('button', { name: '完成 · 查看结果' }).click();
  await expect(page.locator('.catalog-row')).toHaveCount(1); await expect(page.locator('.catalog-row')).toContainText('幻影丙');
  await page.getByRole('button', { name: '清空', exact: true }).click(); await expect(page.locator('.catalog-row')).toHaveCount(3);
  await expect(page.locator('.identity-class')).toContainText('点击并拖拽填写');
});

test('empty training has no overflow and condition/spell chips respond immediately and persist manual training', async ({ page }) => {
  const sizes = await page.locator('.training-cell .cell-content,.status-strip .cell-content,.ability-cha .cell-content').evaluateAll(nodes => nodes.map(e => ({ h: e.clientHeight, s: e.scrollHeight })));
  for (const size of sizes) expect(size.s).toBeLessThanOrEqual(size.h + 1);
  await page.getByRole('button', { name: '编辑装备训练与其他熟练' }).click();
  await page.getByRole('textbox', { name: '语言熟练记录' }).fill('测试语、自由记录'); await page.getByRole('textbox', { name: '语言熟练记录' }).press('Enter'); await page.getByRole('button', { name: '编辑装备训练与其他熟练' }).click();
  await expect(page.locator('.training-chips .feature-bubble')).toHaveCount(2);
  const tabs = page.getByRole('navigation', { name: '资料分类' });
  await tabs.getByRole('button', { name: '状态', exact: true }).click(); await page.locator('.catalog-row').first().click(); await fillFromDetail(page);
  const chip = page.locator('.status-strip .feature-caption'); await expect(chip).toContainText('测试状态');
  await tabs.getByRole('button', { name: '法术', exact: true }).click(); await page.locator('.catalog-row').first().click();
  await chip.hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('.entry-detail')).toContainText('用于验收的状态正文');
  await page.mouse.move(40, 40);
  await expect(page.locator('.detail-heading')).toContainText('低环甲');
  await chip.click(); await expect(page.locator('.status-strip .feature-prose')).toHaveCount(0);
  await tabs.getByRole('button', { name: '法术', exact: true }).click(); await page.locator('.catalog-row').first().click(); await fillFromDetail(page);
  await expect(page.locator('.overview-spells .feature-bubble')).toHaveCount(1);
  await page.reload(); await expect(page.locator('.training-chips .feature-bubble')).toHaveCount(2); await expect(page.locator('.overview-spells .feature-bubble')).toHaveCount(1);
});
