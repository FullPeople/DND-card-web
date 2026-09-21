import { test, expect, type Page, type Locator } from '@playwright/test';
import { mockSource, fillFromDetail } from './fixtures';

async function add(page: Page, category: string, name: string) {
  if (category === '子职') { await page.locator('.identity-subclass .cell-fill').click(); await page.locator('.class-subclasses button').filter({ hasText: name }).click(); }
  else { await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name: category, exact: true }).click(); await page.locator('.catalog-row').filter({ hasText: name }).click(); }
  await fillFromDetail(page);
}
async function dragOut(page: Page, source: Locator) {
  await source.hover();
  const b = (await source.boundingBox())!; await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(710, 420, { steps: 12 }); await expect(page.locator('.removal-preview')).toBeVisible(); await page.mouse.up();
}
test.beforeEach(async ({ page }) => { await mockSource(page); await page.route('https://5e.kiwee.top/data/races.json', route => route.fulfill({ json: { race: [{ name: '测试精灵', source: 'XPHB', size: ['M'], entries: [{ type: 'entries', name: '测试感官', entries: ['自制感官内容。'] }] }] } })); await page.goto('/'); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled(); await page.getByRole('switch', { name: '编辑模式' }).click(); });

test('declared features arrive automatically, controls are manual and HP follows the new layout', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('.edition-divider')).toHaveText('DND 五版角色卡');
  await add(page, '职业', '测试法师');
  await expect(page.locator('.class-features .feature-caption')).toHaveText(['初始特性']);
  await expect(page.locator('.identity-subclass')).toBeVisible();
  await expect(page.locator('.identity-class .remove')).toHaveCount(0);
  await expect(page.locator('.identity-class .cell-sheen')).toBeAttached();
  await add(page, '种族', '测试精灵'); await expect(page.locator('.class-features')).toContainText('测试感官');
  await add(page, '背景', '抄书员'); await expect(page.locator('.heritage-features .feature-caption')).toContainText(['旅行笔记']);
  await expect(page.locator('.target-banner,.wiki-choice-editor,.feature-pending,.requirement-field')).toHaveCount(0);
  for (const name of ['奥秘熟练', '自然熟练', '宗教熟练', '察觉熟练']) await page.getByRole('checkbox', { name, exact: true }).check();
  for (const name of ['奥秘熟练', '自然熟练', '宗教熟练', '察觉熟练']) await expect(page.getByRole('checkbox', { name, exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: '历史熟练', exact: true }).uncheck();
  await page.getByRole('button', { name: '编辑装备训练与其他熟练' }).click();
  await page.getByRole('textbox', { name: '工具熟练记录' }).fill('玩家自行填写');
  await page.getByRole('spinbutton', { name: '当前生命值', exact: true }).fill('9');
  await page.getByRole('spinbutton', { name: '生命值上限调整值', exact: true }).fill(String(15 - Number(await page.locator('[data-stat=hp]').textContent())));
  await page.getByRole('spinbutton', { name: '临时生命值', exact: true }).fill('3');
  await expect(page.locator('.life-actions')).toHaveCount(0); await expect(page.locator('.hp-slash')).toHaveText('/');
  await expect(page.locator('.life-fields input')).toHaveCount(3);
  const positions = await page.locator('.life-fields input').evaluateAll(els => els.map(e => e.getBoundingClientRect().x)); expect(positions[0]).toBeLessThan(positions[1]); expect(positions[1]).toBeLessThan(positions[2]);
  await page.reload(); await expect(page.locator('[data-stat=hp]')).toHaveText('15');
  await expect(page.locator('[aria-label="历史无熟练"]')).toBeVisible();
  await expect(page.locator('.training-chips')).toContainText(['玩家自行填写']);
  await expect(page.locator('.feature-panel .feature-caption')).toHaveCount(3); expect(errors).toEqual([]);
});

test('bubble and identity drag-out removal persists, cancellation and undo preserve content', async ({ page }) => {
  await add(page, '职业', '测试法师'); await add(page, '种族', '测试精灵');
  const chip = page.getByRole('button', { name: '展开测试感官', exact: true });
  const b = (await chip.boundingBox())!; await page.mouse.move(b.x + 8, b.y + 6); await page.mouse.down(); await page.mouse.move(710, 420, { steps: 10 });
  await expect(page.locator('.pointer-ghost')).toBeVisible();
  const anchor = await page.locator('.pointer-ghost').evaluate(el => { const e = el as HTMLElement; const matrix = new DOMMatrix(getComputedStyle(e).transform); return { x: matrix.e + Number(e.dataset.grabX), y: matrix.f + Number(e.dataset.grabY), width: e.offsetWidth }; });
  expect(anchor.x).toBeCloseTo(710, 0); expect(anchor.y).toBeCloseTo(420, 0); expect(anchor.width).toBeLessThanOrEqual(180);
  await page.keyboard.press('Escape'); await page.mouse.up(); await expect(chip).toBeVisible();
  await dragOut(page, chip); await expect(chip).toHaveCount(0);
  await page.reload(); await expect(chip).toHaveCount(0);
  const identity = page.locator('.identity-class .identity-title');
  await dragOut(page, identity); await expect(page.locator('.class-features .feature-caption')).toHaveCount(0);
  await expect(page.locator('.identity-class')).toHaveClass(/cell-missing/);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(page.locator('.class-features .feature-caption')).toHaveText(['初始特性']);
});

test('dragging a second class merges the two identity cells; removing it restores the split', async ({ page }) => {
  await add(page, '职业', '测试法师'); await add(page, '子职', '测试学派');
  await expect(page.locator('.identity-subclass')).toContainText('测试学派');
  const single = await page.locator('.identity-class').boundingBox();
  await page.getByRole('button', { name: '规则与扩展', exact: true }).click();
  await page.getByTestId('pack-file').setInputFiles({ name: 'warrior.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, id: 'test.warrior', name: '测试战士包', version: '1.0.0', editions: ['2024'], requires: [], conflicts: [], entries: [{ id: 'warrior', name: '测试战士', kind: 'class', entries: [], raw: { hd: { faces: 10 } } }] })) });
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name: '职业', exact: true }).click();
  await page.locator('.catalog-row').filter({ hasText: '测试战士' }).dragTo(page.locator('.identity-class'));
  await expect(page.locator('.identity-class')).toHaveClass(/identity-multiclass/); await expect(page.locator('.identity-subclass')).toHaveCount(0);
  expect((await page.locator('.identity-class').boundingBox())!.height).toBeGreaterThan(single!.height * 1.8);
  await expect(page.locator('.identity-class')).toContainText('测试学派');
  await dragOut(page, page.locator('.identity-class .identity-title').filter({ hasText: '测试战士' }));
  await expect(page.locator('.identity-subclass')).toContainText('测试学派'); await expect(page.locator('.identity-class')).not.toHaveClass(/identity-multiclass/);
  await page.reload(); await expect(page.locator('.identity-subclass')).toContainText('测试学派');
});
