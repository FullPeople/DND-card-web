import { test, expect } from '@playwright/test';
import { newCharacter, type Entry } from '../../src/core/model';
import { mockSource } from './fixtures';

test('feature chips follow the pointer, expand, reorder across sources and persist without changing grants', async ({ page }) => {
  await mockSource(page); await page.goto('/');
  const c = newCharacter(); c.name = '气泡交互测试';
  const entry = (id: string, kind: Entry['kind'], name: string, entries: unknown[]): Entry => ({ id, kind, name, english: name, source: 'XPHB', edition: '2024', packId: 'test', revision: '1', entries, raw: {} });
  c.selections = [
    { id: 'class', entry: entry('class', 'class', '测试法师', []), level: 2, quantity: 1, equipped: false },
    ...['测试施法', '测试学者'].map((name, i) => ({ id: `f${i}`, entry: entry(`f${i}`, 'feature', name, [`这是${name}的测试效果。`]), requirementId: 'class:feature', level: 1, quantity: 1, equipped: false })),
    { id: 'race', entry: entry('race', 'race', '测试精灵', [{ type: 'entries', name: '测试敏锐感官', entries: Array.from({ length: 30 }, (_, i) => `第 ${i + 1} 段自制测试效果，用于验证长正文的区域滚动。`) }]), level: 1, quantity: 1, equipped: false },
  ];
  await page.getByRole('button', { name: '导入 / 导出', exact: true }).click();
  await page.getByTestId('character-file').setInputFiles({ name: 'test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(c)) });
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await expect(page.locator('.feature-bubble')).toHaveCount(3);
  await expect(page.locator('.feature-group h4').first()).toHaveText('职业 测试法师 Lv.2');
  await expect(page.getByText('尚未填写，点击跳转', { exact: true })).toHaveCount(0);
  const numeric = await page.locator('.proficiency-cell .cell-content,.overview-vitals .cell-content').evaluateAll(els => els.map(el => ({ height: el.clientHeight, scroll: el.scrollHeight })));
  for (const n of numeric) expect(n.scroll).toBeLessThanOrEqual(n.height);
  const spell = page.getByRole('button', { name: '展开测试施法', exact: true });
  await spell.hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('.entry-detail')).toContainText('这是测试施法的测试效果');
  await spell.click(); await page.mouse.move(40, 40);
  await expect(page.locator('.entry-detail')).toContainText('这是测试施法的测试效果');
  await page.getByRole('button', { name: '展开全部特性', exact: true }).click();
  await expect(page.locator('.feature-bubble.is-expanded')).toHaveCount(3);
  await expect(page.locator('.feature-bubble.is-expanded strong em').first()).toHaveText('测试施法。');
  await page.getByRole('button', { name: '折叠全部特性', exact: true }).click();
  // Preview rearranges before release; Escape cancels without writing the order.
  await page.evaluate(() => { (window as any).nativeDrags = 0; document.addEventListener('dragstart', () => (window as any).nativeDrags++); });
  const from = (await page.locator('[data-feature-id="f1"] .feature-caption').boundingBox())!;
  const destination = (await page.locator('[data-feature-id="f0"] .feature-caption').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(destination.x + 2, destination.y + 4, { steps: 10 });
  await expect(page.locator('.pointer-ghost')).toBeVisible();
  await expect(page.locator('.feature-caption').first()).toHaveText('测试学者');
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.locator('.feature-caption').first()).toHaveText('测试施法');
  await expect(page.locator('.pointer-ghost')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).nativeDrags)).toBe(0);
  await page.locator('[data-feature-id="f1"]').dragTo(page.locator('[data-feature-id="f0"]'), { targetPosition: { x: 2, y: 4 } });
  await expect(page.locator('.feature-caption').first()).toHaveText('测试学者');
  await page.locator('[data-feature-id="race:trait:0"]').dragTo(page.locator('[data-feature-id="f1"]'), { targetPosition: { x: 2, y: 4 } });
  await expect(page.locator('.feature-caption').first()).toHaveText('测试敏锐感官');
  await page.reload(); await expect(page.locator('.feature-caption')).toHaveText(['测试敏锐感官', '测试学者', '测试施法']);
  await expect(page.locator('.feature-group h4').first()).toHaveText('种族 测试精灵');
  await page.getByRole('button', { name: '展开全部特性', exact: true }).click();
  await expect(page.locator('.feature-bubble.is-expanded')).toHaveCount(3);
  const paper = await page.locator('.paper').boundingBox();
  const region = page.locator('.class-features .cell-content'); await region.hover(); await page.mouse.wheel(0, 500);
  await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.paper').boundingBox()).toEqual(paper);
  await page.reload(); await expect(page.locator('.feature-bubble.is-expanded')).toHaveCount(3);
  await page.getByRole('button', { name: '折叠全部特性', exact: true }).click();
  await expect(page.locator('.feature-bubble.is-expanded')).toHaveCount(0);
  await expect(page.locator('.feature-caption')).toHaveText(['测试敏锐感官', '测试学者', '测试施法']);
});
