import { test, expect } from '@playwright/test';
import { mockSource } from './fixtures';

test.beforeEach(async ({ page }) => { await mockSource(page); await page.goto('/'); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled(); });

test('reference layout groups skills by ability and marks the whole incomplete field', async ({ page }) => {
  const field = page.locator('.identity-class');
  await expect(field).toHaveClass(/cell-missing/);
  await expect(field).toContainText('尚未填写，点击跳转');
  const perimeter = field.locator('.cell-perimeter path');
  expect(await perimeter.evaluate(el => getComputedStyle(el).strokeDasharray)).not.toBe('none');
  expect(await perimeter.evaluate(el => getComputedStyle(el).animationName)).toBe('missing-perimeter');
  // The label/empty space is a hit target as well as the explicit keyboard button.
  await field.locator('h3').click(); await expect(page.locator('.target-banner')).toContainText('选择职业');
  await page.locator('.catalog-row').first().click(); await page.getByRole('button', { name: '填入当前要求', exact: true }).click();
  await expect(field).not.toHaveClass(/cell-missing/);
  await expect(page.locator('.ability-int')).toContainText('奥秘'); await expect(page.locator('.ability-dex')).toContainText('隐匿');
  await expect(page.locator('.ability-str')).not.toContainText('奥秘');
  await page.locator('.ability-int').getByRole('checkbox', { name: '奥秘', exact: true }).check();
  await page.locator('.ability-wis').getByRole('checkbox', { name: '洞悉', exact: true }).check();
  await expect(page.locator('.ability-int')).not.toHaveClass(/cell-missing/);
  await expect(page.locator('.ability-wis')).not.toHaveClass(/cell-missing/);
  await expect(page.locator('.ability-int').getByRole('checkbox', { name: '历史', exact: true })).toBeDisabled();
  await page.locator('.ability-wis').getByRole('checkbox', { name: '洞悉', exact: true }).uncheck();
  await expect(page.locator('.ability-int')).toHaveClass(/cell-missing/);
  await page.locator('.ability-int .cell-heading').click();
  await page.getByRole('region', { name: '当前填写选项' }).getByRole('checkbox', { name: '历史', exact: true }).check();
  await expect(page.locator('.ability-int').getByRole('checkbox', { name: '历史', exact: true })).toBeChecked();
  await expect(page.locator('.ability-int')).not.toHaveClass(/cell-missing/);
  await page.getByRole('spinbutton', { name: '测试法师等级' }).fill('3');
  await expect(page.locator('.total-level strong')).toHaveText('3');
  await expect(page.locator('.inspiration-cell')).toContainText('激励'); await expect(page.locator('.conditions-cell')).toContainText('状态');
  await expect(page.locator('.heritage-features')).toContainText('种族特性与专长'); await expect(page.locator('.overview-spells')).toContainText('法术');
  await expect(page.locator('.overview-sheet .requirement')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.conditions-cell .cell-perimeter path').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.reload(); await expect(page.locator('.total-level strong')).toHaveText('3');
  await expect(page.locator('.ability-int').getByRole('checkbox', { name: '历史', exact: true })).toBeChecked();
});

test('quickbar pins references without duplicate grants, survives reload and removes stale links with undo', async ({ page }) => {
  await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name: '装备', exact: true }).click();
  const item = page.locator('.catalog-row').filter({ hasText: '测试皮甲' });
  await item.dragTo(page.locator('.quickbar-cell'));
  await expect(page.locator('.quickbar-row')).toContainText('测试皮甲');
  await expect(page.locator('.quickbar-cell')).not.toHaveClass(/cell-missing/);
  await item.dragTo(page.locator('.quickbar-cell')); await expect(page.locator('.quickbar-row')).toHaveCount(1);
  await page.getByRole('tab', { name: /背包/ }).click(); await expect(page.locator('.detail-page-box .selected-entry')).toHaveCount(1);
  await page.getByRole('tab', { name: /主要/ }).click();
  await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name: '法术', exact: true }).click();
  await page.locator('.catalog-row').filter({ hasText: '微光术' }).dragTo(page.locator('.quickbar-cell'));
  await expect(page.locator('.quickbar-row')).toHaveCount(2);
  await page.getByRole('button', { name: '管理快捷栏' }).click();
  await page.getByRole('button', { name: '上移微光术' }).click(); await page.getByRole('button', { name: '关闭弹窗' }).click();
  await expect(page.locator('.quickbar-row').first()).toContainText('微光术');
  await page.reload(); await expect(page.locator('.quickbar-row').first()).toContainText('微光术');
  await page.locator('.quickbar-row').first().getByRole('button', { name: '微光术', exact: true }).click(); await expect(page.locator('.detail-heading h1')).toHaveText('微光术');
  await page.getByRole('button', { name: '移除微光术', exact: true }).click(); await expect(page.locator('.quickbar-row')).toHaveCount(1);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(page.locator('.quickbar-row')).toHaveCount(2);
  await page.getByRole('button', { name: '取消固定微光术', exact: true }).click();
  await expect(page.locator('.overview-spells .selected-entry')).toContainText('微光术');
});
