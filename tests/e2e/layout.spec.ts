import { test, expect } from '@playwright/test';
import { mockSource } from './fixtures';

test.beforeEach(async ({ page }) => { await mockSource(page); await page.goto('/'); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled(); });

test('A4 stays fixed while only the content region scrolls; all five pages edit the same character', async ({ page }) => {
  await page.locator('.catalog-row').filter({ hasText: '测试法师' }).click();
  await page.getByRole('button', { name: '加入角色卡', exact: true }).click();
  await page.locator('.traits-box .choose-button').first().click();
  await page.locator('.catalog-row').first().click();
  await page.getByRole('button', { name: '填入当前要求', exact: true }).click();
  const paper = page.locator('.paper'); const before = await paper.boundingBox();
  await page.getByRole('tab', { name: /特性/ }).click();
  const content = page.locator('.detail-page-box > .box-content');
  await content.hover(); await page.mouse.wheel(0, 700);
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(300);
  expect(await paper.boundingBox()).toEqual(before);
  expect(await page.locator('.sheet-viewport').evaluate(el => el.scrollTop)).toBe(0);
  await page.getByRole('tab', { name: /背景/ }).click();
  await page.getByRole('textbox', { name: '冒险笔记' }).fill('纸页固定，故事继续。');
  await page.getByRole('textbox', { name: '性别', exact: true }).fill('女');
  await page.getByRole('textbox', { name: '阵营', exact: true }).fill('中立善良');
  await page.getByRole('tab', { name: /法术/ }).click(); await expect(page.locator('.sheet-page-heading h2')).toHaveText('法术');
  await page.getByRole('tab', { name: /法术/ }).press('ArrowRight'); await expect(page.locator('.sheet-page-heading h2')).toHaveText('背包');
  await page.getByRole('tab', { name: /背景/ }).click(); await expect(page.getByRole('textbox', { name: '冒险笔记' })).toHaveValue('纸页固定，故事继续。');
  await expect(page.getByRole('textbox', { name: '性别', exact: true })).toHaveValue('女');
  await expect(page.getByRole('textbox', { name: '阵营', exact: true })).toHaveValue('中立善良');
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1100, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => { const b = (await paper.boundingBox())!; return b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width && b.y + b.height < viewport.height - 30; }).toBe(true);
    const b = (await paper.boundingBox())!; expect(b.width / b.height).toBeCloseTo(210 / 297, 3);
    const top = b.y; await page.locator('.paper-heading').hover(); await page.mouse.wheel(0, 800);
    expect((await paper.boundingBox())!.y).toBe(top);
  }
});

test('subclass is part of the class line and keyword previews show the referenced source', async ({ page }) => {
  await page.locator('.catalog-row').filter({ hasText: '测试法师' }).click();
  await page.getByRole('button', { name: '加入角色卡', exact: true }).click();
  const keyword = page.locator('.entry-detail .inline-reference').filter({ hasText: '初始特性' }).first();
  await keyword.hover();
  await expect(page.getByRole('tooltip')).toContainText('这是一条为软件验收创作的测试规则');
  await expect(page.getByRole('tooltip')).toContainText('XPHB');
  await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toHaveCount(0);
  await keyword.click();
  const spell = page.locator('.entry-detail .inline-reference').filter({ hasText: '微光术' });
  await spell.focus(); await expect(page.getByRole('tooltip')).toContainText('为测试而创作的一点微光');
  const bounds = (await page.getByRole('tooltip').boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThan(983);
  await page.keyboard.press('Escape');
  await page.locator('.choose-subclass').click(); await page.locator('.catalog-row').filter({ hasText: '测试学派' }).click();
  await page.getByRole('button', { name: '加入角色卡', exact: true }).click();
  await expect(page.locator('.identity-main .selected-entry').filter({ hasText: '测试法师' })).toContainText('测试学派');
  await expect(page.locator('.identity-main .selected-entry')).toHaveCount(1);
  await page.getByRole('button', { name: '移除测试学派', exact: true }).click(); await expect(page.locator('.choose-subclass')).toBeVisible();
  await page.getByRole('button', { name: '加入角色卡', exact: true }).click();
  await page.getByRole('button', { name: '移除测试法师', exact: true }).click();
  await expect(page.locator('.orphan-subclass')).toContainText('测试学派');
  await page.getByRole('button', { name: '移除测试学派', exact: true }).click(); await expect(page.locator('.orphan-subclass')).toHaveCount(0);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 844 });
    if (width < 980) await page.getByRole('navigation', { name: '工作区' }).getByRole('button', { name: '规则资料', exact: true }).click();
    await expect(page.locator('.catalog-row').first()).toBeVisible(); await expect(page.locator('.detail-heading')).toBeVisible();
    const list = (await page.locator('.catalog-list').boundingBox())!, details = (await page.locator('.entry-detail').boundingBox())!;
    expect(list.height).toBeLessThanOrEqual(125); expect(list.y + list.height).toBeLessThanOrEqual(details.y + 1);
  }
});

test('real drag highlights eligible zones, previews the entry and clears after a drop', async ({ page }, info) => {
  const row = page.locator('.catalog-row').filter({ hasText: '测试法师' });
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 12); await page.mouse.down();
  await page.mouse.move(box.x + 65, box.y + 19, { steps: 5 });
  await expect(page.locator('[data-drop-kind="class"]').first()).toHaveClass(/drop-ready/);
  await expect(page.locator('[data-drop-kind="race"]').first()).not.toHaveClass(/drop-ready/);
  await expect(page.locator('.drag-ghost strong')).toHaveText('测试法师');
  const target = page.locator('[data-requirement="base:class"]'); const bounds = (await target.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 10 });
  await expect(page.locator('.drop-over')).not.toHaveCount(0);
  await info.attach('eligible-drop-regions', { body: await page.screenshot(), contentType: 'image/png' });
  await page.mouse.up();
  await expect(page.getByRole('spinbutton', { name: '测试法师等级' })).toHaveValue('1');
  await expect(page.locator('.drop-ready')).toHaveCount(0);
  await page.locator('.traits-box .choose-button').first().click();
  const feature = (await page.locator('.catalog-row').first().boundingBox())!;
  await page.mouse.move(feature.x + 25, feature.y + 10); await page.mouse.down();
  await page.mouse.move(feature.x + 60, feature.y + 15, { steps: 5 });
  await expect(page.locator('.ability-box .drop-ready')).toHaveCount(0);
  const tab = (await page.getByRole('tab', { name: /特性/ }).boundingBox())!;
  await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2, { steps: 10 });
  await expect(page.locator('.sheet-page-heading h2')).toHaveText('特性');
  const choice = page.locator('[data-requirement]').filter({ hasText: '填写「初始特性」' });
  const choiceBounds = (await choice.boundingBox())!;
  await page.mouse.move(choiceBounds.x + 25, choiceBounds.y + 15, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.detail-page-box .selected-entry')).toContainText('初始特性');
  await expect(page.locator('.drop-ready')).toHaveCount(0);
});
