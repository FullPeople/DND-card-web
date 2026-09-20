import { test, expect } from '@playwright/test';
import { mockSource } from './fixtures';

test('production shell, document and catalog all reopen after disconnecting the network', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await mockSource(page); await page.goto('/');
  await expect(page.locator('.catalog-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('textbox', { name: '角色姓名', exact: true }).fill('离线角色');
  await expect(page.locator('.save-status')).toContainText('已保存到本机');
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('textbox', { name: '角色姓名', exact: true })).toHaveValue('离线角色');
  await expect(page.locator('.catalog-row')).toHaveCount(1);
  await expect(page.locator('.catalog-status')).toContainText('份缓存');
  await page.locator('.catalog-row').click(); await expect(page.locator('.entry-detail')).toContainText('测试法师');
  expect(errors).toEqual([]);
});
