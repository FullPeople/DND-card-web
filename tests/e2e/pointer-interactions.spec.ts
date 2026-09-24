import { test, expect } from '@playwright/test';
import { mockSource } from './fixtures';

test.beforeEach(async ({ page }) => { await mockSource(page); await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:{spell:[{name:'微光术',source:'XPHB',level:0,entries:['为测试而创作的一点微光。参阅 {@race 测试旅人|XPHB}。']}]}})); await page.goto('/'); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled(); });

test('right and middle buttons pin nested tooltips; one outside click dismisses without activating the page', async ({ page }) => {
  await page.locator('.catalog-row').filter({ hasText: '测试法师' }).click();
  const reference = page.locator('.entry-detail .inline-reference').filter({ hasText: '微光术' }).first();
  await reference.hover(); await expect(page.getByRole('tooltip')).toContainText('为测试而创作的一点微光');
  await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(1);
  await page.mouse.move(15, 15); await expect(page.getByRole('tooltip')).toHaveCount(1);
  const nested = page.getByRole('tooltip').getByRole('button', { name: '测试旅人', exact: true });
  await nested.hover(); await expect(page.getByRole('tooltip')).toHaveCount(2);
  await expect(page.getByRole('tooltip').last()).toContainText('自制测试种族');
  await page.mouse.down({ button: 'middle' }); await page.mouse.up({ button: 'middle' });
  await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(2);
  const target = (await page.getByRole('button', { name: '导入 / 导出', exact: true }).boundingBox())!;
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page.getByRole('tooltip')).toHaveCount(0); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2); await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await reference.hover(); await expect(page.getByRole('tooltip')).toHaveCount(1);
  await page.mouse.down({ button: 'middle' }); await page.mouse.up({ button: 'middle' });
  await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(1);
  await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('wiki separator resizes, remembers height and clamps on small screens', async ({ page }) => {
  await page.locator('.catalog-row').first().click();
  const separator = page.getByRole('separator', { name: '调整资料列表与正文高度' }), list = page.locator('.catalog-list');
  const before = (await list.boundingBox())!.height, b = (await separator.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + 4); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + 144, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await list.boundingBox())!.height).toBeGreaterThan(before + 120);
  const height = (await list.boundingBox())!.height;
  await separator.press('ArrowUp'); await expect.poll(async () => (await list.boundingBox())!.height).toBeLessThan(height - 10);
  const remembered = (await list.boundingBox())!.height;
  await page.reload(); await expect.poll(async () => Math.abs((await list.boundingBox())!.height - remembered)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 600 });
  await page.getByRole('navigation', { name: '工作区' }).getByRole('button', { name: '规则资料', exact: true }).click();
  await page.locator('.catalog-row').first().click();
  await separator.press('End'); expect((await page.locator('.entry-detail').boundingBox())!.height).toBeGreaterThan(100);
  await separator.press('Home'); expect((await list.boundingBox())!.height).toBeGreaterThan(50);
});
